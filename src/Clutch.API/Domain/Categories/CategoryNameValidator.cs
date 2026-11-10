namespace Clutch.API.Domain.Categories;

public static class CategoryNameValidator
{
    public const int MaximumLength = 100;

    public static bool IsValid(string? name) =>
        !string.IsNullOrWhiteSpace(name) && name.Trim().Length <= MaximumLength;
}
