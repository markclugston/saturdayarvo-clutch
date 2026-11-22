using Clutch.API.Api.ProblemDetails;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging.Abstractions;

namespace Clutch.API.Tests.Unit;

public sealed class ApiExceptionHandlerTests
{
    private static ApiExceptionHandler Handler() => new(NullLogger<ApiExceptionHandler>.Instance, null!);

    [Fact]
    public async Task Client_aborted_request_is_handled_as_client_closed_request()
    {
        using var aborted = new CancellationTokenSource();
        var context = new DefaultHttpContext { RequestAborted = aborted.Token };
        await aborted.CancelAsync();

        var handled = await Handler().TryHandleAsync(
            context, new OperationCanceledException(aborted.Token), CancellationToken.None);

        Assert.True(handled);
        Assert.Equal(StatusCodes.Status499ClientClosedRequest, context.Response.StatusCode);
    }

    [Fact]
    public async Task Cancellation_while_the_client_is_still_connected_is_a_server_error()
    {
        var context = new DefaultHttpContext();
        context.Response.Body = new MemoryStream();

        var handled = await Handler().TryHandleAsync(
            context, new OperationCanceledException(), CancellationToken.None);

        Assert.True(handled);
        Assert.Equal(StatusCodes.Status500InternalServerError, context.Response.StatusCode);
    }
}
