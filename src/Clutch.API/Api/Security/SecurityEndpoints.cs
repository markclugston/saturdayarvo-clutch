using System.ComponentModel.DataAnnotations;
using System.Security.Claims;
using Clutch.API.Infrastructure.Identity;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Identity;

namespace Clutch.API.Api.Security;

public static class SecurityEndpoints
{
    public static IEndpointRouteBuilder MapSecurityEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/security").WithTags("Security");

        group.MapGet("/csrf-token", (HttpContext context, IAntiforgery antiforgery) =>
        {
            var tokens = antiforgery.GetAndStoreTokens(context);
            return Results.Ok(new CsrfTokenResponse(
                tokens.RequestToken
                    ?? throw new InvalidOperationException("The anti-forgery request token was not issued.")));
        }).AllowAnonymous();

        group.MapPost("/register", async (
            RegisterRequest request,
            UserManager<ApplicationUser> userManager) =>
        {
            if (string.IsNullOrWhiteSpace(request.Email)
                || request.Email.Length > 256
                || !new EmailAddressAttribute().IsValid(request.Email)
                || string.IsNullOrWhiteSpace(request.Password)
                || request.Password.Length > 256)
            {
                return Results.Problem(
                    title: "The registration details are invalid.",
                    statusCode: StatusCodes.Status400BadRequest);
            }

            var user = new ApplicationUser
            {
                UserName = request.Email,
                Email = request.Email,
            };
            var result = await userManager.CreateAsync(user, request.Password);
            if (!result.Succeeded)
            {
                return Results.Problem(
                    title: "The account could not be created.",
                    detail: "Check that your password meets the requirements, or try signing in if you already have an account.",
                    statusCode: StatusCodes.Status400BadRequest);
            }

            return Results.Created("/api/security/session", new RegistrationResponse(user.Id));
        }).AllowAnonymous();

        group.MapGet("/session", async (
            ClaimsPrincipal principal,
            UserManager<ApplicationUser> userManager) =>
        {
            var userId = principal.FindFirstValue(ClaimTypes.NameIdentifier);
            if (userId is null)
            {
                return Results.Problem(statusCode: StatusCodes.Status401Unauthorized);
            }

            var user = await userManager.FindByIdAsync(userId);
            if (user is null)
            {
                return Results.Problem(statusCode: StatusCodes.Status401Unauthorized);
            }

            var roles = await userManager.GetRolesAsync(user);
            return Results.Ok(new SessionResponse(userId, roles.ToArray()));
        }).RequireAuthorization();

        group.MapPost("/login", async (
            LoginRequest request,
            UserManager<ApplicationUser> userManager,
            SignInManager<ApplicationUser> signInManager) =>
        {
            if (string.IsNullOrWhiteSpace(request.Email)
                || request.Email.Length > 256
                || string.IsNullOrWhiteSpace(request.Password)
                || request.Password.Length > 256)
            {
                return Results.Problem(
                    title: "The sign-in details are invalid.",
                    statusCode: StatusCodes.Status401Unauthorized);
            }

            var user = await userManager.FindByEmailAsync(request.Email);
            if (user is null)
            {
                return Results.Problem(
                    title: "The sign-in details are invalid.",
                    statusCode: StatusCodes.Status401Unauthorized);
            }

            var result = await signInManager.PasswordSignInAsync(
                user,
                request.Password,
                isPersistent: false,
                lockoutOnFailure: true);
            if (!result.Succeeded)
            {
                return Results.Problem(
                    title: "The sign-in details are invalid.",
                    statusCode: StatusCodes.Status401Unauthorized);
            }

            return Results.NoContent();
        }).AllowAnonymous();

        group.MapPost("/logout", async (SignInManager<ApplicationUser> signInManager) =>
        {
            await signInManager.SignOutAsync();
            return Results.NoContent();
        }).RequireAuthorization();

        return endpoints;
    }

    private sealed record CsrfTokenResponse(string RequestToken);

    private sealed record RegisterRequest(string Email, string Password);

    private sealed record LoginRequest(string Email, string Password);

    private sealed record RegistrationResponse(string Id);

    private sealed record SessionResponse(string Id, IReadOnlyList<string> Roles);
}
