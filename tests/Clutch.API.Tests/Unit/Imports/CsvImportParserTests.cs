using System.Text;
using Clutch.API.Application.Imports;
using Clutch.API.Domain.Imports;
using Clutch.API.Domain.Transactions;
using Clutch.API.Infrastructure.Imports;

namespace Clutch.API.Tests.Unit.Imports;

public sealed class CsvImportParserTests
{
    private readonly CsvImportParser parser = new();

    [Fact]
    public async Task ParsesQuotedDescriptionsWithDelimitersAndEmbeddedLineBreaks()
    {
        const string csv = "Date,Description,Amount\r\n15/01/2025,\"Coffee, meeting\nwith team\",1234.50";
        var mapping = SignedAmountMapping();

        var result = await ParseAsync(csv, "AUD", mapping);

        var row = Assert.Single(result.Rows);
        Assert.Equal(new DateOnly(2025, 1, 15), row.TransactionDate);
        Assert.Equal("Coffee, meeting\nwith team", row.Description);
        Assert.Equal(1234.50m, row.Amount);
        Assert.Equal(TransactionDirection.Incoming, row.Direction);
    }

    [Fact]
    public async Task ParsesSeparateIncomingAndOutgoingColumns()
    {
        const string csv = "Date,Description,Incoming,Outgoing\n2025-01-15,Salary,2500.00,\n2025-01-16,Groceries,,45.99";
        var mapping = new ImportMapping(
            0,
            1,
            "yyyy-MM-dd",
            ImportAmountMode.SeparateIncomingOutgoing,
            IncomingAmountColumn: 2,
            OutgoingAmountColumn: 3,
            NumberFormat: "dot-decimal-comma-grouping");

        var result = await ParseAsync(csv, "AUD", mapping);

        Assert.Collection(
            result.Rows,
            row =>
            {
                Assert.Equal(2500.00m, row.Amount);
                Assert.Equal(TransactionDirection.Incoming, row.Direction);
            },
            row =>
            {
                Assert.Equal(45.99m, row.Amount);
                Assert.Equal(TransactionDirection.Outgoing, row.Direction);
            });
    }

    [Theory]
    [InlineData("-150.00", "", 150.00, TransactionDirection.Incoming)]
    [InlineData("+200.00", "", 200.00, TransactionDirection.Incoming)]
    [InlineData("", "-10.60", 10.60, TransactionDirection.Outgoing)]
    [InlineData("", "100.00", 100.00, TransactionDirection.Outgoing)]
    [InlineData("-150.00", "0", 150.00, TransactionDirection.Incoming)]
    [InlineData("-0.00", "-10.60", 10.60, TransactionDirection.Outgoing)]
    [InlineData("0.00", "", 0, TransactionDirection.Incoming)]
    [InlineData("", "0.00", 0, TransactionDirection.Outgoing)]
    [InlineData("0", "-0.00", 0, TransactionDirection.Outgoing)]
    public async Task SeparateAmountColumnsDetermineDirectionRegardlessOfSign(
        string incoming,
        string outgoing,
        decimal expectedAmount,
        TransactionDirection expectedDirection)
    {
        var csv = $"Date,Description,Incoming,Outgoing\n2025-01-15,Market,{incoming},{outgoing}";
        var result = await ParseAsync(csv, "AUD", SeparateAmountMapping());

        var row = Assert.Single(result.Rows);
        Assert.Equal(expectedAmount, row.Amount);
        Assert.Equal(expectedDirection, row.Direction);
    }

    [Theory]
    [InlineData("", "")]
    [InlineData("-1.00", "2.00")]
    [InlineData("-1.00", "-2.00")]
    [InlineData("--1.00", "")]
    public async Task SeparateAmountColumnsRejectMissingAmbiguousOrMalformedAmounts(
        string incoming,
        string outgoing)
    {
        var csv = $"Date,Description,Incoming,Outgoing\n2025-01-15,Market,{incoming},{outgoing}";
        var exception = await Assert.ThrowsAsync<ImportValidationException>(
            () => ParseAsync(csv, "AUD", SeparateAmountMapping()));

        Assert.Equal("InvalidAmount", exception.Code);
        Assert.Equal(2, exception.RowNumber);
    }

    [Fact]
    public async Task ParsesAmountWithMappedDirectionValues()
    {
        const string csv = "Date,Description,Amount,Type\n2025-01-15,Refund,20.00,CREDIT\n2025-01-16,Meal,9.50,DEBIT";
        var mapping = new ImportMapping(
            0,
            1,
            "yyyy-MM-dd",
            ImportAmountMode.AmountWithDirection,
            AmountColumn: 2,
            DirectionColumn: 3,
            IncomingDirectionValue: "CREDIT",
            OutgoingDirectionValue: "DEBIT",
            NumberFormat: "dot-decimal-comma-grouping");

        var result = await ParseAsync(csv, "AUD", mapping);

        Assert.Collection(
            result.Rows,
            row => Assert.Equal(TransactionDirection.Incoming, row.Direction),
            row => Assert.Equal(TransactionDirection.Outgoing, row.Direction));
    }

    [Fact]
    public async Task UsesTheSelectedCurrencyRegistryConvention()
    {
        var mapping = SignedAmountMapping(
            "yyyy-MM-dd",
            "comma-decimal-dot-grouping");
        const string quotedCsv = "Date,Description,Amount\n2025-01-15,Market,\"1.234,56\"";

        var result = await ParseAsync(quotedCsv, "EUR", mapping);

        Assert.Equal(1234.56m, Assert.Single(result.Rows).Amount);
        Assert.Equal("CLDR", result.CurrencyFormat.Reference);
        Assert.False(string.IsNullOrWhiteSpace(result.CurrencyFormat.Version));
    }

    [Fact]
    public async Task RequiresFormatSelectionWhenCurrencyHasMultipleConventions()
    {
        const string csv = "Date,Description,Amount\n2025-01-15,Market,1.234,56";
        var mapping = SignedAmountMapping("yyyy-MM-dd", numberFormat: null);

        var exception = await Assert.ThrowsAsync<ImportValidationException>(
            () => ParseAsync(csv, "EUR", mapping));

        Assert.Equal("CurrencyFormatRequired", exception.Code);
        Assert.Null(exception.RowNumber);
        Assert.DoesNotContain("1.234", exception.Message, StringComparison.Ordinal);
    }

    [Fact]
    public async Task RejectsASeparatorMismatchWithoutEchoingTheSource()
    {
        const string csv = "Date;Description;Amount\n2025-01-15;Market;12.00";

        var exception = await Assert.ThrowsAsync<ImportValidationException>(
            () => ParseAsync(csv, "AUD", SignedAmountMapping("yyyy-MM-dd")));

        Assert.Equal("InvalidMapping", exception.Code);
        Assert.DoesNotContain("Market", exception.Message, StringComparison.Ordinal);
    }

    [Theory]
    [InlineData(IncomingSign.Positive, "0.00")]
    [InlineData(IncomingSign.Negative, "-0.00")]
    public async Task ZeroSignedAmountsAreOutgoing(IncomingSign incomingSign, string amount)
    {
        var csv = $"Date,Description,Amount\n2025-01-15,Refund,{amount}";
        var mapping = SignedAmountMapping("yyyy-MM-dd") with { IncomingSign = incomingSign };

        var result = await ParseAsync(csv, "AUD", mapping);

        var row = Assert.Single(result.Rows);
        Assert.Equal(0m, row.Amount);
        Assert.Equal(TransactionDirection.Outgoing, row.Direction);
    }

    [Theory]
    [InlineData("CREDIT", TransactionDirection.Incoming)]
    [InlineData("DEBIT", TransactionDirection.Outgoing)]
    public async Task ZeroAmountWithDirectionUsesMappedDirection(string value, TransactionDirection direction)
    {
        var csv = $"Date,Description,Amount,Type\n2025-01-15,Refund,0.00,{value}";
        var mapping = new ImportMapping(
            0, 1, "yyyy-MM-dd", ImportAmountMode.AmountWithDirection,
            AmountColumn: 2, DirectionColumn: 3,
            IncomingDirectionValue: "CREDIT", OutgoingDirectionValue: "DEBIT",
            NumberFormat: "dot-decimal-comma-grouping");
        var result = await ParseAsync(csv, "AUD", mapping);
        var row = Assert.Single(result.Rows);
        Assert.Equal(0m, row.Amount);
        Assert.Equal(direction, row.Direction);
    }

    [Fact]
    public async Task RejectsAnAmountCurrencyThatConflictsWithTheAccount()
    {
        const string csv = "Date,Description,Amount\n2025-01-15,Market,USD 10.00";

        var exception = await Assert.ThrowsAsync<ImportValidationException>(
            () => ParseAsync(csv, "AUD", SignedAmountMapping("yyyy-MM-dd")));

        Assert.Equal("CurrencyMismatch", exception.Code);
        Assert.Equal(2, exception.RowNumber);
        Assert.DoesNotContain("USD", exception.Message, StringComparison.Ordinal);
    }

    [Fact]
    public async Task RejectsUnmappedDirectionValuesWithoutEchoingThem()
    {
        const string csv = "Date,Description,Amount,Type\n2025-01-15,Meal,9.50,UNKNOWN";
        var mapping = new ImportMapping(
            0,
            1,
            "yyyy-MM-dd",
            ImportAmountMode.AmountWithDirection,
            AmountColumn: 2,
            DirectionColumn: 3,
            IncomingDirectionValue: "CREDIT",
            OutgoingDirectionValue: "DEBIT",
            NumberFormat: "dot-decimal-comma-grouping");

        var exception = await Assert.ThrowsAsync<ImportValidationException>(
            () => ParseAsync(csv, "AUD", mapping));

        Assert.Equal("InvalidDirection", exception.Code);
        Assert.Equal(2, exception.RowNumber);
        Assert.DoesNotContain("UNKNOWN", exception.Message, StringComparison.Ordinal);
    }

    [Fact]
    public async Task AcceptsUnlabelledNumericMerchantReferences()
    {
        const string csv = "Date,Description,Amount\n2025-01-15,Merchant 4029357700 AUS,9.50";
        var result = await ParseAsync(csv, "AUD", SignedAmountMapping("yyyy-MM-dd"));
        Assert.Equal("Merchant 4029357700 AUS", Assert.Single(result.Rows).Description);
    }

    [Fact]
    public async Task RejectsSensitiveDescriptionsWithoutEchoingTheirContents()
    {
        const string csv = "Date,Description,Amount\n2025-01-15,Account 1234567890,9.50";

        var exception = await Assert.ThrowsAsync<ImportValidationException>(
            () => ParseAsync(csv, "AUD", SignedAmountMapping("yyyy-MM-dd")));

        Assert.Equal("InvalidDescription", exception.Code);
        Assert.Equal(2, exception.RowNumber);
        Assert.Equal("Description", exception.Field);
        Assert.Contains("financial identifiers", exception.Message, StringComparison.Ordinal);
        Assert.DoesNotContain("1234567890", exception.Message, StringComparison.Ordinal);
    }

    [Fact]
    public async Task EnforcesRowAndByteLimits()
    {
        const string csv = "Date,Description,Amount\n2025-01-15,Market,1.00\n2025-01-16,Meal,2.00";
        var mapping = SignedAmountMapping("yyyy-MM-dd");
        var rowLimit = await Assert.ThrowsAsync<ImportValidationException>(
            () => ParseAsync(csv, "AUD", mapping, new ImportLimits(1024, 1, 5)));
        var byteLimit = await Assert.ThrowsAsync<ImportValidationException>(
            () => ParseAsync(csv, "AUD", mapping, new ImportLimits(20, 10, 5)));

        Assert.Equal("RowLimitExceeded", rowLimit.Code);
        Assert.Equal("FileSizeLimitExceeded", byteLimit.Code);
    }

    private Task<CsvImportResult> ParseAsync(
        string csv,
        string currencyCode,
        ImportMapping mapping,
        ImportLimits? limits = null) =>
        parser.ParseAsync(
            new MemoryStream(Encoding.UTF8.GetBytes(csv)),
            currencyCode,
            mapping,
            limits ?? new ImportLimits(1024 * 1024, 10_000, 5),
            CancellationToken.None);

    private static ImportMapping SignedAmountMapping(
        string dateFormat = "dd/MM/yyyy",
        string? numberFormat = "dot-decimal-comma-grouping") =>
        new(
            0,
            1,
            dateFormat,
            ImportAmountMode.Signed,
            SignedAmountColumn: 2,
            IncomingSign: IncomingSign.Positive,
            NumberFormat: numberFormat);

    private static ImportMapping SeparateAmountMapping() =>
        new(
            0,
            1,
            "yyyy-MM-dd",
            ImportAmountMode.SeparateIncomingOutgoing,
            IncomingAmountColumn: 2,
            OutgoingAmountColumn: 3,
            NumberFormat: "dot-decimal-comma-grouping");
}
