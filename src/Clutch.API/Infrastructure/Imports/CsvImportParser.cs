using System.Globalization;
using System.Text;
using Clutch.API.Application.Imports;
using Clutch.API.Domain.Accounts;
using Clutch.API.Domain.Imports;
using Clutch.API.Domain.Shared;
using Clutch.API.Domain.Transactions;
using CsvHelper;
using CsvHelper.Configuration;

namespace Clutch.API.Infrastructure.Imports;

public sealed class CsvImportParser
{
    private const int MaximumCellLength = 4096;

    public async Task<CsvImportResult> ParseAsync(
        Stream source,
        string currencyCode,
        ImportMapping mapping,
        ImportLimits limits,
        CancellationToken cancellationToken)
    {
        if (!Currency.TryGet(currencyCode, out var currency) || currency is null)
        {
            throw new ImportValidationException(
                "InvalidCurrency",
                "The account currency is not supported.");
        }

        if (source.CanSeek && source.Length - source.Position > limits.MaxFileSizeBytes)
        {
            throw new ImportValidationException(
                "FileSizeLimitExceeded",
                "The file exceeds the configured size limit.");
        }

        var formats = CurrencyAmountFormatRegistry.GetFormats(currencyCode);
        if (formats.Count == 0)
        {
            throw new ImportValidationException(
                "InvalidCurrency",
                "The account currency is not supported.");
        }

        var format = ResolveFormat(currencyCode, formats, mapping.NumberFormat);
        var configuration = new CsvConfiguration(CultureInfo.InvariantCulture)
        {
            Delimiter = ",",
            HasHeaderRecord = true,
            Mode = CsvMode.RFC4180,
            TrimOptions = TrimOptions.Trim,
            ExceptionMessagesContainRawData = false,
        };

        try
        {
            using var boundedStream = new BoundedReadStream(source, limits.MaxFileSizeBytes);
            using var reader = new StreamReader(
                boundedStream,
                new UTF8Encoding(encoderShouldEmitUTF8Identifier: false, throwOnInvalidBytes: true),
                detectEncodingFromByteOrderMarks: true,
                leaveOpen: true);
            using var csv = new CsvReader(reader, configuration);

            if (!await csv.ReadAsync().ConfigureAwait(false) || !csv.ReadHeader())
            {
                throw new ImportValidationException(
                    "EmptyFile",
                    "The file does not contain a header row.");
            }

            var header = csv.HeaderRecord;
            if (header is null || header.Length == 0)
            {
                throw new ImportValidationException(
                    "EmptyFile",
                    "The file does not contain a header row.");
            }

            ImportMappingValidator.Validate(mapping, header.Length);
            var rows = new List<ParsedImportRow>();
            var rowNumber = 1;
            while (await csv.ReadAsync().ConfigureAwait(false))
            {
                cancellationToken.ThrowIfCancellationRequested();
                rowNumber++;

                if (rows.Count >= limits.MaxRowsPerImport)
                {
                    throw new ImportValidationException(
                        "RowLimitExceeded",
                        "The file exceeds the configured row limit.",
                        rowNumber);
                }

                var columns = csv.Parser.Record;
                if (columns is null || columns.Length < header.Length)
                {
                    throw InvalidRow(rowNumber, "Columns");
                }

                var dateValue = ReadField(csv, mapping.DateColumn, rowNumber, "TransactionDate");
                var description = ReadField(csv, mapping.DescriptionColumn, rowNumber, "Description");
                if (description.Length > AccountDescriptionValidator.MaximumLength
                    || description.Length > MaximumCellLength
                    || !AccountDescriptionValidator.IsValid(description))
                {
                    throw new ImportValidationException(
                        "InvalidDescription",
                        "A transaction description must be non-empty, at most 200 characters, and must not contain financial identifiers.",
                        rowNumber,
                        "Description");
                }

                if (!DateOnly.TryParseExact(
                    dateValue,
                    mapping.DateFormat,
                    CultureInfo.InvariantCulture,
                    DateTimeStyles.None,
                    out var transactionDate))
                {
                    throw new ImportValidationException(
                        "InvalidDate",
                        "A transaction date does not match the selected date format.",
                        rowNumber,
                        "TransactionDate");
                }

                var (amount, direction) = ParseAmount(csv, mapping, format, currency!, rowNumber);
                rows.Add(new ParsedImportRow(
                    rowNumber,
                    transactionDate,
                    description,
                    amount,
                    direction));
            }

            if (rows.Count == 0)
            {
                throw new ImportValidationException(
                    "EmptyFile",
                    "The file does not contain any transaction rows.");
            }

            return new CsvImportResult(rows, format);
        }
        catch (ImportValidationException)
        {
            throw;
        }
        catch (CsvHelperException)
        {
            throw new ImportValidationException(
                "MalformedCsv",
                "The file is malformed or does not match the selected delimiter.");
        }
        catch (DecoderFallbackException)
        {
            throw new ImportValidationException(
                "MalformedCsv",
                "The file must use a supported text encoding.");
        }
        catch (IOException exception) when (exception is FileSizeLimitIOException)
        {
            throw new ImportValidationException(
                "FileSizeLimitExceeded",
                "The file exceeds the configured size limit.");
        }
    }

    private static CurrencyAmountFormat ResolveFormat(
        string currencyCode,
        IReadOnlyList<CurrencyAmountFormat> formats,
        string? formatId)
    {
        if (formats.Count > 1 && string.IsNullOrWhiteSpace(formatId))
        {
            throw new ImportValidationException(
                "CurrencyFormatRequired",
                "Select the number format used by the file.");
        }

        if (CurrencyAmountFormatRegistry.TryGetFormat(currencyCode, formatId, out var selectedFormat)
            && selectedFormat is not null)
        {
            return selectedFormat;
        }

        if (formats.Count == 1 && string.IsNullOrWhiteSpace(formatId))
        {
            return formats[0];
        }

        throw new ImportValidationException(
            "InvalidMapping",
            "The selected number format is not supported.",
            field: "NumberFormat");
    }

    private static (decimal Amount, TransactionDirection Direction) ParseAmount(
        CsvReader csv,
        ImportMapping mapping,
        CurrencyAmountFormat format,
        Currency currency,
        int rowNumber)
    {
        switch (mapping.AmountMode)
        {
            case ImportAmountMode.Signed:
            {
                var value = ParseDecimal(
                    ReadField(csv, mapping.SignedAmountColumn!.Value, rowNumber, "Amount"),
                    format,
                    currency,
                    rowNumber);
                if (value == 0)
                {
                    return (0, TransactionDirection.Outgoing);
                }

                var incoming = mapping.IncomingSign == IncomingSign.Positive
                    ? value > 0
                    : value < 0;
                return (decimal.Abs(value), incoming
                    ? TransactionDirection.Incoming
                    : TransactionDirection.Outgoing);
            }
            case ImportAmountMode.SeparateIncomingOutgoing:
            {
                var incomingValue = ReadField(
                    csv,
                    mapping.IncomingAmountColumn!.Value,
                    rowNumber,
                    "IncomingAmount");
                var outgoingValue = ReadField(
                    csv,
                    mapping.OutgoingAmountColumn!.Value,
                    rowNumber,
                    "OutgoingAmount");
                var incomingAmount = ParseOptionalMagnitude(
                    incomingValue,
                    format,
                    currency,
                    rowNumber);
                var outgoingAmount = ParseOptionalMagnitude(
                    outgoingValue,
                    format,
                    currency,
                    rowNumber);

                if ((incomingAmount is > 0 && outgoingAmount is > 0)
                    || (incomingAmount is null && outgoingAmount is null))
                {
                    throw InvalidAmount(rowNumber);
                }

                if (incomingAmount is > 0)
                {
                    return (incomingAmount.Value, TransactionDirection.Incoming);
                }

                if (outgoingAmount is > 0)
                {
                    return (outgoingAmount.Value, TransactionDirection.Outgoing);
                }

                return incomingAmount is not null && outgoingAmount is null
                    ? (0, TransactionDirection.Incoming)
                    : (0, TransactionDirection.Outgoing);
            }
            case ImportAmountMode.AmountWithDirection:
            {
                var amount = ParseDecimal(
                    ReadField(csv, mapping.AmountColumn!.Value, rowNumber, "Amount"),
                    format,
                    currency,
                    rowNumber);
                var directionValue = ReadField(
                    csv,
                    mapping.DirectionColumn!.Value,
                    rowNumber,
                    "Direction");
                if (amount < 0)
                {
                    throw InvalidAmount(rowNumber);
                }

                var direction = directionValue == mapping.IncomingDirectionValue
                    ? TransactionDirection.Incoming
                    : directionValue == mapping.OutgoingDirectionValue
                        ? TransactionDirection.Outgoing
                        : (TransactionDirection?)null;
                if (direction is null)
                {
                    throw new ImportValidationException(
                        "InvalidDirection",
                        "A transaction direction does not match the selected mapping.",
                        rowNumber,
                        "Direction");
                }

                return (amount, direction.Value);
            }
            default:
                throw new ImportValidationException(
                    "InvalidMapping",
                    "The amount mapping is invalid.",
                    field: "AmountMode");
        }
    }

    private static decimal? ParseOptionalMagnitude(
        string value,
        CurrencyAmountFormat format,
        Currency currency,
        int rowNumber)
    {
        if (value.Length == 0)
        {
            return null;
        }

        return decimal.Abs(ParseDecimal(value, format, currency, rowNumber));
    }

    private static decimal ParseDecimal(
        string value,
        CurrencyAmountFormat format,
        Currency currency,
        int rowNumber)
    {
        if (value.Length == 0 || value.Length > MaximumCellLength)
        {
            throw InvalidAmount(rowNumber);
        }

        value = RemoveCurrencyCode(value, currency, rowNumber);
        var isNegative = value[0] == '-';
        var hasSign = isNegative || value[0] == '+';
        var unsignedValue = hasSign ? value[1..] : value;
        var pieces = unsignedValue.Split(format.DecimalSeparator, StringSplitOptions.None);
        if (pieces.Length > 2
            || pieces[0].Length == 0
            || (pieces.Length == 2 && pieces[1].Length == 0))
        {
            throw InvalidAmount(rowNumber);
        }

        if (pieces.Length == 2
            && (pieces[1].Length > currency.MinorUnits
                || !pieces[1].All(character => character is >= '0' and <= '9')))
        {
            throw InvalidAmount(rowNumber);
        }

        var integerGroups = pieces[0].Split(format.GroupSeparator, StringSplitOptions.None);
        if (integerGroups.Any(group => group.Length == 0
                || !group.All(character => character is >= '0' and <= '9'))
            || integerGroups.Length > 1
                && (integerGroups[0].Length > 3
                    || integerGroups.Skip(1).Any(group => group.Length != 3)))
        {
            throw InvalidAmount(rowNumber);
        }

        var normalized = string.Concat(integerGroups);
        if (pieces.Length == 2)
        {
            normalized += $".{pieces[1]}";
        }

        if (!decimal.TryParse(
            normalized,
            NumberStyles.AllowDecimalPoint,
            CultureInfo.InvariantCulture,
            out var amount))
        {
            throw InvalidAmount(rowNumber);
        }

        return isNegative ? -amount : amount;
    }

    private static string RemoveCurrencyCode(string value, Currency currency, int rowNumber)
    {
        var tokens = value.Split([' ', '\t'], StringSplitOptions.RemoveEmptyEntries);
        var codes = tokens.Where(token => Currency.TryGet(token, out _)).ToArray();
        if (codes.Length == 0)
        {
            return value;
        }

        if (codes.Length != 1
            || !string.Equals(codes[0], currency.Code, StringComparison.Ordinal))
        {
            throw new ImportValidationException(
                "CurrencyMismatch",
                "A mapped amount uses a currency that conflicts with the selected account.",
                rowNumber,
                "Amount");
        }

        return string.Join(' ', tokens.Where(token => !string.Equals(
            token,
            currency.Code,
            StringComparison.Ordinal)));
    }

    private static string ReadField(
        CsvReader csv,
        int column,
        int rowNumber,
        string field)
    {
        var value = csv.GetField(column);
        if (value is null || value.Length > MaximumCellLength)
        {
            throw InvalidRow(rowNumber, field);
        }

        return value;
    }

    private static ImportValidationException InvalidRow(int rowNumber, string field) =>
        new("InvalidRow", "A mapped value is missing or invalid.", rowNumber, field);

    private static ImportValidationException InvalidAmount(int rowNumber) =>
        new("InvalidAmount", "A transaction amount is invalid.", rowNumber, "Amount");

    private sealed class BoundedReadStream(Stream inner, int maximumBytes) : Stream
    {
        private int bytesRead;

        public override bool CanRead => inner.CanRead;
        public override bool CanSeek => false;
        public override bool CanWrite => false;
        public override long Length => throw new NotSupportedException();
        public override long Position
        {
            get => throw new NotSupportedException();
            set => throw new NotSupportedException();
        }

        public override int Read(byte[] buffer, int offset, int count)
        {
            var read = ReadBounded(buffer.AsSpan(offset, count));
            return read;
        }

        public override int Read(Span<byte> buffer) => ReadBounded(buffer);

        public override async ValueTask<int> ReadAsync(
            Memory<byte> buffer,
            CancellationToken cancellationToken = default)
        {
            if (bytesRead >= maximumBytes)
            {
                var probe = new byte[1];
                var probeRead = await inner.ReadAsync(probe, cancellationToken).ConfigureAwait(false);
                if (probeRead > 0)
                {
                    throw new FileSizeLimitIOException();
                }

                return 0;
            }

            var allowed = Math.Min(buffer.Length, maximumBytes - bytesRead);
            var read = await inner.ReadAsync(buffer[..allowed], cancellationToken).ConfigureAwait(false);
            bytesRead += read;
            return read;
        }

        public override Task<int> ReadAsync(
            byte[] buffer,
            int offset,
            int count,
            CancellationToken cancellationToken) =>
            ReadAsync(buffer.AsMemory(offset, count), cancellationToken).AsTask();

        public override void Flush() => throw new NotSupportedException();
        public override long Seek(long offset, SeekOrigin origin) => throw new NotSupportedException();
        public override void SetLength(long value) => throw new NotSupportedException();
        public override void Write(byte[] buffer, int offset, int count) =>
            throw new NotSupportedException();

        protected override void Dispose(bool disposing)
        {
            if (disposing)
            {
                inner.Dispose();
            }

            base.Dispose(disposing);
        }

        private int ReadBounded(Span<byte> buffer)
        {
            if (bytesRead >= maximumBytes)
            {
                Span<byte> probe = stackalloc byte[1];
                if (inner.Read(probe) > 0)
                {
                    throw new FileSizeLimitIOException();
                }

                return 0;
            }

            var allowed = Math.Min(buffer.Length, maximumBytes - bytesRead);
            var read = inner.Read(buffer[..allowed]);
            bytesRead += read;
            return read;
        }
    }

    private sealed class FileSizeLimitIOException : IOException
    {
    }
}
