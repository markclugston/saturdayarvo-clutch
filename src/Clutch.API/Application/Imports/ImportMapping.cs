using System.Text.Json.Serialization;

namespace Clutch.API.Application.Imports;

[JsonConverter(typeof(JsonStringEnumConverter<ImportAmountMode>))]
public enum ImportAmountMode
{
    Signed,
    SeparateIncomingOutgoing,
    AmountWithDirection,
}

[JsonConverter(typeof(JsonStringEnumConverter<IncomingSign>))]
public enum IncomingSign
{
    Positive,
    Negative,
}

public sealed record ImportMapping(
    int DateColumn,
    int DescriptionColumn,
    string DateFormat,
    ImportAmountMode AmountMode,
    int? SignedAmountColumn = null,
    int? IncomingAmountColumn = null,
    int? OutgoingAmountColumn = null,
    int? AmountColumn = null,
    int? DirectionColumn = null,
    IncomingSign? IncomingSign = null,
    string? IncomingDirectionValue = null,
    string? OutgoingDirectionValue = null,
    string? NumberFormat = null);

public sealed record ParsedImportRow(
    int SourceRowNumber,
    DateOnly TransactionDate,
    string Description,
    decimal Amount,
    Clutch.API.Domain.Transactions.TransactionDirection Direction);

public sealed record CsvImportResult(
    IReadOnlyList<ParsedImportRow> Rows,
    Clutch.API.Domain.Shared.CurrencyAmountFormat CurrencyFormat);
