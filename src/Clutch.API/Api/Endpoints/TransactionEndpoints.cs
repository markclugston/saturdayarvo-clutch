using System.Security.Claims;
using Clutch.API.Application.Transactions;

namespace Clutch.API.Api.Endpoints;

public static class TransactionEndpoints
{
    public static IEndpointRouteBuilder MapTransactionEndpoints(
        this IEndpointRouteBuilder endpoints)
    {
        endpoints.MapGet(
            "/api/accounts/{accountId:guid}/transactions",
            async (
                Guid accountId,
                string? cursor,
                int? pageSize,
                ClaimsPrincipal principal,
                TransactionService transactionService,
                CancellationToken cancellationToken) =>
            {
                var ownerUserId = principal.FindFirstValue(ClaimTypes.NameIdentifier);
                if (ownerUserId is null)
                {
                    return Results.Problem(statusCode: StatusCodes.Status401Unauthorized);
                }

                var response = await transactionService.GetPageAsync(
                    ownerUserId,
                    accountId,
                    cursor,
                    pageSize,
                    cancellationToken);
                return Results.Ok(response);
            })
            .WithTags("Transactions")
            .RequireAuthorization();

        endpoints.MapDelete(
            "/api/accounts/{accountId:guid}/transactions/{transactionId:guid}",
            async (
                Guid accountId,
                Guid transactionId,
                ClaimsPrincipal principal,
                TransactionService transactionService,
                CancellationToken cancellationToken) =>
            {
                var ownerUserId = principal.FindFirstValue(ClaimTypes.NameIdentifier);
                if (ownerUserId is null)
                {
                    return Results.Problem(statusCode: StatusCodes.Status401Unauthorized);
                }

                var result = await transactionService.DeleteAsync(
                    ownerUserId,
                    accountId,
                    transactionId,
                    cancellationToken);
                return result == TransactionDeleteResult.Deleted
                    ? Results.NoContent()
                    : Results.Problem(
                        type: "about:blank",
                        title: "Transaction not found",
                        detail: "The transaction could not be found.",
                        statusCode: StatusCodes.Status404NotFound);
            })
            .WithTags("Transactions")
            .RequireAuthorization();

        return endpoints;
    }
}
