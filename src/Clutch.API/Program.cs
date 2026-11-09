using Clutch.API.Api.ProblemDetails;
using Clutch.API.Api.Endpoints;
using Clutch.API.Api.Security;
using Clutch.API.Application.Imports;
using Clutch.API.Infrastructure;
using Clutch.API.Infrastructure.Identity;
using Clutch.API.Infrastructure.Persistence;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using OpenTelemetry.Metrics;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddOpenApi();
builder.Services.AddProblemDetails();
builder.Services.AddExceptionHandler<ApiExceptionHandler>();
builder.Services.AddOpenTelemetry()
    .WithMetrics(metrics => metrics
        .AddMeter(ImportMetrics.MeterName)
        .AddOtlpExporter());
builder.Services.AddHealthChecks();
builder.Services.AddInfrastructure(builder.Configuration);
builder.Services.AddAntiforgery(options =>
{
    options.HeaderName = "X-CSRF-TOKEN";
    options.Cookie.Name = "__Host-Clutch.Antiforgery";
    options.Cookie.HttpOnly = true;
    options.Cookie.Path = "/";
    options.Cookie.SecurePolicy = CookieSecurePolicy.Always;
    options.Cookie.SameSite = SameSiteMode.Lax;
});

var app = builder.Build();

app.UseExceptionHandler();
if (!app.Environment.IsDevelopment())
{
    app.UseHsts();
}

app.UseHttpsRedirection();
app.Use(async (context, next) =>
{
    context.Response.Headers.TryAdd("X-Content-Type-Options", "nosniff");
    context.Response.Headers.TryAdd("X-Frame-Options", "DENY");
    context.Response.Headers.TryAdd("Referrer-Policy", "strict-origin-when-cross-origin");
    context.Response.Headers.TryAdd("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'; base-uri 'none'");
    await next();
});

app.UseAuthentication();
app.Use(async (context, next) =>
{
    var method = context.Request.Method;
    var isMutation = HttpMethods.IsPost(method)
        || HttpMethods.IsPut(method)
        || HttpMethods.IsPatch(method)
        || HttpMethods.IsDelete(method);

    if (context.Request.Path.StartsWithSegments("/api") && isMutation)
    {
        var antiforgery = context.RequestServices.GetRequiredService<IAntiforgery>();
        if (!await antiforgery.IsRequestValidAsync(context))
        {
            await Results.Problem(
                title: "A valid anti-forgery token is required.",
                statusCode: StatusCodes.Status400BadRequest).ExecuteAsync(context);
            return;
        }
    }

    await next();
});
app.UseAuthorization();
app.UseAntiforgery();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.MapSecurityEndpoints();
app.MapAccountEndpoints();
app.MapImportEndpoints();
app.MapTransactionEndpoints();
app.MapAdminImportLimitEndpoints();
app.MapThemePreferenceEndpoints();
app.MapHealthChecks("/health/live", new HealthCheckOptions
{
    Predicate = _ => false,
}).AllowAnonymous();
app.MapHealthChecks("/health/ready", new HealthCheckOptions
{
    Predicate = check => check.Tags.Contains("ready"),
}).AllowAnonymous();

if (builder.Configuration["AdminBootstrap:Email"] is not null
    || builder.Configuration["AdminBootstrap:Password"] is not null)
{
    await using var scope = app.Services.CreateAsyncScope();
    await scope.ServiceProvider
        .GetRequiredService<AdminBootstrapper>()
        .ProvisionAsync(CancellationToken.None);
}

app.Run();

public partial class Program;
