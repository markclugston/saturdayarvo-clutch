using System.Text.Json;
using Clutch.API.Api.ProblemDetails;

namespace Clutch.API.Application.Imports;

public static class ImportMappingSettingsSerializer
{
    public const int CurrentSchemaVersion = 1;

    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    public static string Serialize(ImportMapping mapping)
    {
        ValidateShape(mapping);
        return JsonSerializer.Serialize(mapping, JsonOptions);
    }

    public static ImportMapping Deserialize(int schemaVersion, string settingsJson)
    {
        if (schemaVersion != CurrentSchemaVersion)
        {
            throw InvalidSettings();
        }

        try
        {
            var mapping = JsonSerializer.Deserialize<ImportMapping>(settingsJson, JsonOptions);
            if (mapping is null)
            {
                throw InvalidSettings();
            }

            ValidateShape(mapping);
            return mapping;
        }
        catch (JsonException)
        {
            throw InvalidSettings();
        }
        catch (ImportValidationException)
        {
            throw InvalidSettings();
        }
    }

    private static void ValidateShape(ImportMapping mapping)
    {
        if (string.IsNullOrWhiteSpace(mapping.NumberFormat))
        {
            throw new ImportValidationException(
                "InvalidMapping",
                "The number format is invalid.",
                field: "NumberFormat");
        }

        ImportMappingValidator.Validate(mapping, int.MaxValue);
    }

    private static ApiProblemException InvalidSettings() =>
        new(
            StatusCodes.Status500InternalServerError,
            "Saved import settings could not be read.",
            "The saved import configuration is invalid. Open settings to choose a valid mapping.");
}
