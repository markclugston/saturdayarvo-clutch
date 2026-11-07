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
                NumberFormat: "dot-decimal-comma-grouping"),
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
