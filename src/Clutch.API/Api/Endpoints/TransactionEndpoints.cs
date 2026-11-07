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

        return endpoints;
    }
}
