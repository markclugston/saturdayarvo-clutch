namespace Clutch.API.Api.Endpoints;

public static class RequestBodyLimit
{
    // Rejects oversized POST and PUT bodies under a path (413, never 500) before anything binds
    // them. A declared length is checked at once; an undeclared one is buffered up to the limit and
    // no further.
    public static IApplicationBuilder UseRequestBodyLimit(
        this IApplicationBuilder app,
        PathString path,
        int maximumBytes) =>
        app.Use(async (context, next) =>
        {
            var request = context.Request;
            if (!request.Path.StartsWithSegments(path)
                || !(HttpMethods.IsPost(request.Method) || HttpMethods.IsPut(request.Method)))
            {
                await next();
                return;
            }

            if (request.ContentLength > maximumBytes)
            {
                await TooLargeAsync(context);
                return;
            }

            if (request.ContentLength is null)
            {
                var buffer = new MemoryStream();
                var chunk = new byte[4096];
                int read;
                while ((read = await request.Body.ReadAsync(chunk, context.RequestAborted)) > 0)
                {
                    await buffer.WriteAsync(chunk.AsMemory(0, read), context.RequestAborted);
                    if (buffer.Length > maximumBytes)
                    {
                        await TooLargeAsync(context);
                        return;
                    }
                }

                buffer.Position = 0;
                request.Body = buffer;
            }

            await next();
        });

    private static Task TooLargeAsync(HttpContext context) =>
        Results.Problem(
            title: "The request is too large.",
            statusCode: StatusCodes.Status413PayloadTooLarge).ExecuteAsync(context);
}
