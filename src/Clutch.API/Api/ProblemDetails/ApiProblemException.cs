namespace Clutch.API.Api.ProblemDetails;

public sealed class ApiProblemException(
    int statusCode,
    string title,
    string detail,
    IReadOnlyDictionary<string, string[]>? errors = null) : Exception(title)
{
    public int StatusCode { get; } = statusCode;

    public string Title { get; } = title;

    public string Detail { get; } = detail;

    public IReadOnlyDictionary<string, string[]>? Errors { get; } = errors;
}
