namespace Clutch.API.Application.Imports;

public sealed class ImportValidationException(
    string code,
    string message,
    int? rowNumber = null,
    string? field = null) : Exception(message)
{
    public string Code { get; } = code;

    public int? RowNumber { get; } = rowNumber;

    public string? Field { get; } = field;
}
