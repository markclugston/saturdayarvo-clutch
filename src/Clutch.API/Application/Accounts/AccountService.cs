using Clutch.API.Api.ProblemDetails;
using Clutch.API.Domain.Accounts;
using Clutch.API.Domain.Shared;
using Clutch.API.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Clutch.API.Application.Accounts;

public sealed class AccountService(AppDbContext dbContext)
{
    public async Task<IReadOnlyList<Account>> GetOwnedAccountsAsync(
        string ownerUserId,
        CancellationToken cancellationToken) =>
        await OwnedAccounts(ownerUserId)
            .AsNoTracking()
            .OrderBy(account => account.Description)
            .ToListAsync(cancellationToken);

    public async Task<Account> CreateAsync(
        string ownerUserId,
        string? description,
        string? currencyCode,
        CancellationToken cancellationToken)
    {
        var validationErrors = new Dictionary<string, string[]>();
        if (!AccountDescriptionValidator.IsValid(description))
        {
            validationErrors.Add(
                "description",
                ["Enter a valid description without sensitive identifiers."]);
        }

        if (!Currency.TryGet(currencyCode, out _))
        {
            validationErrors.Add("currencyCode", ["Select a supported currency."]);
        }

        if (validationErrors.Count > 0)
        {
            throw InvalidAccountDetails(validationErrors);
        }

        if (!Account.TryCreate(ownerUserId, description, currencyCode, out var account)
            || account is null)
        {
            throw InvalidAccountDetails(validationErrors);
        }

        dbContext.Accounts.Add(account);
        await dbContext.SaveChangesAsync(cancellationToken);
        return account;
    }

    public Task<Account?> GetOwnedAsync(
        string ownerUserId,
        Guid accountId,
        CancellationToken cancellationToken) =>
        OwnedAccounts(ownerUserId)
            .AsNoTracking()
            .SingleOrDefaultAsync(account => account.Id == accountId, cancellationToken);

    public async Task<Account> UpdateDescriptionAsync(
        string ownerUserId,
        Guid accountId,
        string? description,
        CancellationToken cancellationToken)
    {
        var account = await OwnedAccounts(ownerUserId)
            .SingleOrDefaultAsync(account => account.Id == accountId, cancellationToken);
        if (account is null)
        {
            throw AccountNotFound();
        }

        if (!account.TryUpdateDescription(description))
        {
            throw InvalidAccountDescription();
        }

        await dbContext.SaveChangesAsync(cancellationToken);
        return account;
    }

    public static IReadOnlyList<Currency> GetCurrencies() => Currency.All;

    private IQueryable<Account> OwnedAccounts(string ownerUserId) =>
        dbContext.Accounts.Where(account => account.OwnerUserId == ownerUserId);

    private static ApiProblemException InvalidAccountDetails(
        IReadOnlyDictionary<string, string[]> errors) =>
        new(
            StatusCodes.Status400BadRequest,
            "The account details are invalid.",
            "Provide a supported currency and a description without financial identifiers.",
            errors);

    private static ApiProblemException InvalidAccountDescription() =>
        new(
            StatusCodes.Status400BadRequest,
            "The account description is invalid.",
            "Enter a non-empty description without sensitive identifiers.",
            new Dictionary<string, string[]>
            {
                ["description"] = ["Enter a valid description without sensitive identifiers."],
            });

    private static ApiProblemException AccountNotFound() =>
        new(
            StatusCodes.Status404NotFound,
            "Account not found.",
            "The account does not exist or is not available to this user.");
}
