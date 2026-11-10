using Clutch.API.Api.ProblemDetails;
using Clutch.API.Application.Imports;
using Microsoft.AspNetCore.Http;

namespace Clutch.API.Tests.Unit.Imports;

public sealed class AccountImportSettingsServiceTests
{
    [Theory]
    [MemberData(nameof(Mappings))]
    public void Versioned_mapping_round_trips_all_configuration(ImportMapping mapping)
    {
        var json = ImportMappingSettingsSerializer.Serialize(mapping);

        var restored = ImportMappingSettingsSerializer.Deserialize(
            ImportMappingSettingsSerializer.CurrentSchemaVersion,
            json);

        Assert.Equal(mapping, restored);
    }

    [Theory]
    [InlineData(0, """{"dateColumn":0}""")]
    [InlineData(2, """{"dateColumn":0}""")]
    [InlineData(1, "{")]
    [InlineData(1, "null")]
    public void Unsupported_or_invalid_settings_fail_as_a_typed_retrieval_error(
        int schemaVersion,
        string settingsJson)
    {
        var exception = Assert.Throws<ApiProblemException>(
            () => ImportMappingSettingsSerializer.Deserialize(schemaVersion, settingsJson));

        Assert.Equal(StatusCodes.Status500InternalServerError, exception.StatusCode);
        Assert.Equal("Saved import settings could not be read.", exception.Title);
    }

    [Fact]
    public void Legacy_settings_without_a_balance_column_deserialize_with_no_balance_column()
    {
        const string legacyJson = """{"dateColumn":0,"descriptionColumn":1,"dateFormat":"yyyy-MM-dd","amountMode":"Signed","signedAmountColumn":2,"incomingSign":"Positive","numberFormat":"dot-decimal-comma-grouping"}""";

        var restored = ImportMappingSettingsSerializer.Deserialize(
            ImportMappingSettingsSerializer.CurrentSchemaVersion,
            legacyJson);

        Assert.Null(restored.BalanceColumn);
    }

    [Fact]
    public void Saved_balance_column_outside_the_file_range_is_a_settings_error()
    {
        const string json = """{"dateColumn":0,"descriptionColumn":1,"dateFormat":"yyyy-MM-dd","amountMode":"Signed","signedAmountColumn":2,"incomingSign":"Positive","numberFormat":"dot-decimal-comma-grouping","balanceColumn":-1}""";

                var exception = Assert.Throws<ApiProblemException>(            () => ImportMappingSettingsSerializer.Deserialize(
                ImportMappingSettingsSerializer.CurrentSchemaVersion,
                json));

        Assert.Equal(StatusCodes.Status500InternalServerError, exception.StatusCode);
    }

    [Fact]
    public void Validator_rejects_a_balance_column_that_duplicates_another_column()
    {
        var mapping = new ImportMapping(
            0,
            1,
            "yyyy-MM-dd",
            ImportAmountMode.Signed,
            SignedAmountColumn: 2,
            IncomingSign: IncomingSign.Positive,
            NumberFormat: "dot-decimal-comma-grouping",
            BalanceColumn: 2);

        Assert.Throws<ImportValidationException>(() => ImportMappingValidator.Validate(mapping, 5));
    }

    [Fact]
    public void Validator_rejects_a_balance_column_beyond_the_header()
    {
        var mapping = new ImportMapping(
            0,
            1,
            "yyyy-MM-dd",
            ImportAmountMode.Signed,
            SignedAmountColumn: 2,
            IncomingSign: IncomingSign.Positive,
            NumberFormat: "dot-decimal-comma-grouping",
            BalanceColumn: 5);

        Assert.Throws<ImportValidationException>(() => ImportMappingValidator.Validate(mapping, 4));
    }

    public static IEnumerable<object[]> Mappings =>
    [
        [
            new ImportMapping(
                0,
                1,
                "yyyy-MM-dd",
                ImportAmountMode.Signed,
                SignedAmountColumn: 2,
                IncomingSign: IncomingSign.Negative,
                NumberFormat: "dot-decimal-comma-grouping",
                BalanceColumn: 3),
        ],
        [
            new ImportMapping(
                1,
                2,
                "dd/MM/yyyy",
                ImportAmountMode.SeparateIncomingOutgoing,
                IncomingAmountColumn: 3,
                OutgoingAmountColumn: 4,
                NumberFormat: "comma-decimal-dot-grouping"),
        ],
        [
            new ImportMapping(
                0,
                1,
                "yyyyMMdd",
                ImportAmountMode.AmountWithDirection,
                AmountColumn: 2,
                DirectionColumn: 3,
                IncomingDirectionValue: "CR",
                OutgoingDirectionValue: "DR",
                NumberFormat: "dot-decimal-comma-grouping"),
        ],
    ];
}
