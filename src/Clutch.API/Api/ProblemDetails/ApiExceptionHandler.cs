using System.Text.Json;
using Microsoft.AspNetCore.Diagnostics;
using ProblemDetailsResponse = Microsoft.AspNetCore.Mvc.ProblemDetails;

namespace Clutch.API.Api.ProblemDetails;

public sealed class ApiExceptionHandler(
    ILogger<ApiExceptionHandler> logger,
    IProblemDetailsService problemDetailsService) : IExceptionHandler
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    public async ValueTask<bool> TryHandleAsync(
        HttpContext httpContext,
        Exception exception,
        CancellationToken cancellationToken)
    {
        if (exception is ApiProblemException apiException)
        {
            var problem = new ProblemDetailsResponse
            {
                Status = apiException.StatusCode,
                Title = apiException.Title,
                Detail = apiException.Detail,
                Instance = httpContext.Request.Path,
            };

            if (apiException.Errors is not null)
            {
                problem.Extensions["errors"] = apiException.Errors;
            }

            httpContext.Response.StatusCode = apiException.StatusCode;
            await problemDetailsService.WriteAsync(new ProblemDetailsContext
            {
                HttpContext = httpContext,
                ProblemDetails = problem,
            });
            return true;
        }

        logger.LogError(
            "Unhandled request exception of type {ExceptionType}.",
            exception.GetType().Name);

        httpContext.Response.StatusCode = StatusCodes.Status500InternalServerError;
        httpContext.Response.ContentType = "application/problem+json";
        await JsonSerializer.SerializeAsync(
            httpContext.Response.Body,
            new ProblemDetailsResponse
            {
                Status = StatusCodes.Status500InternalServerError,
                Title = "An unexpected error occurred.",
                Instance = httpContext.Request.Path,
            },
            JsonOptions,
            cancellationToken);
        return true;
    }
}
