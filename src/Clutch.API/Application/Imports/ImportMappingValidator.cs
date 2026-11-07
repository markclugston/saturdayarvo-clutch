namespace Clutch.API.Application.Imports;

public static class ImportMappingValidator
{
    private static readonly HashSet<string> SupportedDateFormats = new(StringComparer.Ordinal)
    {
        "yyyy-MM-dd",
        "yyyyMMdd",
        "dd/MM/yyyy",
        "d/M/yyyy",
        "MM/dd/yyyy",
        "M/d/yyyy",
        "dd-MM-yyyy",
        "MM-dd-yyyy",
        "dd.MM.yyyy",
    };

    public static void Validate(ImportMapping mapping, int columnCount)
    {
        if (!SupportedDateFormats.Contains(mapping.DateFormat))
        {
            throw InvalidMapping("DateFormat");
        }

        var columns = new List<int> { mapping.DateColumn, mapping.DescriptionColumn };
        switch (mapping.AmountMode)
        {
            case ImportAmountMode.Signed:
                if (mapping.SignedAmountColumn is null || mapping.IncomingSign is null
                    || mapping.IncomingAmountColumn is not null
                    || mapping.OutgoingAmountColumn is not null
                    || mapping.AmountColumn is not null
                    || mapping.DirectionColumn is not null
                    || mapping.IncomingDirectionValue is not null
                    || mapping.OutgoingDirectionValue is not null)
                {
                    throw InvalidMapping("AmountMode");
                }

                columns.Add(mapping.SignedAmountColumn.Value);
                break;
            case ImportAmountMode.SeparateIncomingOutgoing:
                if (mapping.IncomingAmountColumn is null || mapping.OutgoingAmountColumn is null
                    || mapping.SignedAmountColumn is not null
                    || mapping.AmountColumn is not null
                    || mapping.DirectionColumn is not null
                    || mapping.IncomingSign is not null
                    || mapping.IncomingDirectionValue is not null
                    || mapping.OutgoingDirectionValue is not null)
                {
                    throw InvalidMapping("AmountMode");
                }

                columns.Add(mapping.IncomingAmountColumn.Value);
                columns.Add(mapping.OutgoingAmountColumn.Value);
                break;
            case ImportAmountMode.AmountWithDirection:
                if (mapping.AmountColumn is null || mapping.DirectionColumn is null
                    || mapping.IncomingDirectionValue is null
                    || mapping.OutgoingDirectionValue is null
                    || string.IsNullOrWhiteSpace(mapping.IncomingDirectionValue)
                    || string.IsNullOrWhiteSpace(mapping.OutgoingDirectionValue)
                    || mapping.IncomingDirectionValue.Length > 100
                    || mapping.OutgoingDirectionValue.Length > 100
                    || string.Equals(
                        mapping.IncomingDirectionValue,
                        mapping.OutgoingDirectionValue,
                        StringComparison.Ordinal)
                    || mapping.SignedAmountColumn is not null
                    || mapping.IncomingAmountColumn is not null
                    || mapping.OutgoingAmountColumn is not null
                    || mapping.IncomingSign is not null)
                {
                    throw InvalidMapping("AmountMode");
                }

                columns.Add(mapping.AmountColumn.Value);
                columns.Add(mapping.DirectionColumn.Value);
                break;
            default:
                throw InvalidMapping("AmountMode");
        }

        if (columns.Any(column => column < 0 || column >= columnCount)
            || columns.Distinct().Count() != columns.Count)
        {
            throw InvalidMapping("Columns");
        }
    }

    private static ImportValidationException InvalidMapping(string field) =>
        new("InvalidMapping", "The column mapping is invalid.", field: field);
}
