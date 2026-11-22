using System.Data;
using Clutch.API.Api.ProblemDetails;
using Clutch.API.Application.Accounts;
using Clutch.API.Domain.Audit;
using Clutch.API.Domain.Mortgages;
using Clutch.API.Infrastructure.Persistence;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;

namespace Clutch.API.Application.Mortgages;

public sealed class MortgageService(
    AppDbContext dbContext,
    AccountService accountService,
    TimeProvider timeProvider,
    ILogger<MortgageService> logger)
{
    private const string NameIndexName = "IX_Mortgages_OwnerUserId_Name";
    public const string ChangedProblemType = "/problems/mortgage-changed";

    public async Task<IReadOnlyList<Mortgage>> ListAsync(
        string ownerUserId,
        CancellationToken cancellationToken) =>
        await dbContext.Mortgages
            .AsNoTracking()
            .Include(mortgage => mortgage.InterestRateChanges.OrderBy(change => change.EffectiveDate))
            .Where(mortgage => mortgage.OwnerUserId == ownerUserId)
            .OrderBy(mortgage => mortgage.CreatedAtUtc)
            .ThenBy(mortgage => mortgage.Id)
            .ToListAsync(cancellationToken);

    public async Task<Mortgage> CreateAsync(
        string ownerUserId,
        MortgageCandidate candidate,
        CancellationToken cancellationToken)
    {
        var started = MortgageMetrics.Start();
        var outcome = "failure";
        try
        {
            var strategy = dbContext.Database.CreateExecutionStrategy();
            var created = await strategy.ExecuteAsync(async () =>
            {
                dbContext.ChangeTracker.Clear();
                await using var transaction = await dbContext.Database.BeginTransactionAsync(
                    IsolationLevel.Serializable,
                    cancellationToken);

                var result = MortgageValidator.Validate(candidate, timeProvider);
                var errors = new Dictionary<string, string>(result.Errors);
                if (await dbContext.Mortgages.CountAsync(
                        mortgage => mortgage.OwnerUserId == ownerUserId,
                        cancellationToken) >= Mortgage.MaximumPerOwner)
                {
                    errors["mortgages"] = "You can save up to 20 mortgages";
                }

                if (result.Value is { } valid
                    && await NameExistsAsync(ownerUserId, valid.Name, null, cancellationToken))
                {
                    errors["name"] = DuplicateNameMessage;
                }

                await CheckAccountOwnedAsync(ownerUserId, result.Value, errors, cancellationToken);

                if (errors.Count > 0 || result.Value is null)
                {
                    throw Invalid(errors);
                }

                var valid2 = result.Value;
                var now = timeProvider.GetUtcNow();
                var mortgage = Mortgage.Create(
                    ownerUserId,
                    valid2.Name,
                    valid2.OpeningBalance,
                    valid2.Duration,
                    valid2.DisbursalDate,
                    valid2.PaymentFrequency,
                    valid2.RateChanges,
                    valid2.AccountId,
                    now);
                dbContext.Mortgages.Add(mortgage);
                dbContext.Audits.Add(new Audit(
                    ownerUserId,
                    now,
                    "MortgageCreate",
                    $"Mortgage {mortgage.Name} was created."));
                try
                {
                    await dbContext.SaveChangesAsync(cancellationToken);
                }
                catch (DbUpdateException exception) when (IsNameViolation(exception))
                {
                    throw Invalid(new Dictionary<string, string> { ["name"] = DuplicateNameMessage });
                }

                await transaction.CommitAsync(cancellationToken);
                return mortgage;
            });

            outcome = "success";
            logger.LogInformation("Mortgage {MortgageId} was created.", created.Id);
            return created;
        }
        catch (ApiProblemException exception)
        {
            outcome = "invalid";
            logger.LogInformation("A mortgage create was rejected with status {StatusCode}.", exception.StatusCode);
            throw;
        }
        finally
        {
            MortgageMetrics.RecordSave("create", outcome, started);
        }
    }

    public async Task<Mortgage> UpdateAsync(
        string ownerUserId,
        Guid id,
        int version,
        MortgageCandidate candidate,
        CancellationToken cancellationToken)
    {
        var started = MortgageMetrics.Start();
        var outcome = "failure";
        try
        {
            dbContext.ChangeTracker.Clear();
            var mortgage = await dbContext.Mortgages
                .Include(item => item.InterestRateChanges)
                .SingleOrDefaultAsync(
                    item => item.Id == id && item.OwnerUserId == ownerUserId,
                    cancellationToken);
            if (mortgage is null)
            {
                outcome = "not_found";
                throw NotFound();
            }

            if (mortgage.Version != version)
            {
                outcome = "conflict";
                throw Changed();
            }

            var result = MortgageValidator.Validate(candidate, timeProvider);
            var errors = new Dictionary<string, string>(result.Errors);
            if (result.Value is { } valid
                && await NameExistsAsync(ownerUserId, valid.Name, id, cancellationToken))
            {
                errors["name"] = DuplicateNameMessage;
            }

            await CheckAccountOwnedAsync(ownerUserId, result.Value, errors, cancellationToken);

            if (errors.Count > 0 || result.Value is null)
            {
                outcome = "invalid";
                throw Invalid(errors);
            }

            var update = result.Value;
            var oldName = mortgage.Name;
            mortgage.Update(
                update.Name,
                update.OpeningBalance,
                update.Duration,
                update.DisbursalDate,
                update.PaymentFrequency,
                update.RateChanges,
                update.AccountId);
            var description = string.Equals(oldName, mortgage.Name, StringComparison.Ordinal)
                ? $"Mortgage {mortgage.Name} was updated."
                : $"Mortgage {mortgage.Name} was updated, renamed from {oldName} to {mortgage.Name}.";
            dbContext.Audits.Add(new Audit(
                ownerUserId,
                timeProvider.GetUtcNow(),
                "MortgageUpdate",
                description));

            try
            {
                await dbContext.SaveChangesAsync(cancellationToken);
            }
            catch (DbUpdateConcurrencyException)
            {
                outcome = "conflict";
                dbContext.ChangeTracker.Clear();
                throw await ChangedOrGoneAsync(ownerUserId, id, cancellationToken);
            }
            catch (DbUpdateException exception) when (IsNameViolation(exception))
            {
                outcome = "invalid";
                dbContext.ChangeTracker.Clear();
                throw Invalid(new Dictionary<string, string> { ["name"] = DuplicateNameMessage });
            }
            catch (DbUpdateException exception) when (IsUniqueViolation(exception))
            {
                // Two edits replaced the same rate-change dates at once: the other one won.
                outcome = "conflict";
                dbContext.ChangeTracker.Clear();
                throw Changed();
            }

            outcome = "success";
            logger.LogInformation("Mortgage {MortgageId} was updated.", id);
            return mortgage;
        }
        catch (ApiProblemException exception)
        {
            if (outcome == "failure")
            {
                outcome = "invalid";
            }

            logger.LogInformation(
                "Mortgage {MortgageId} update was rejected with status {StatusCode}.",
                id,
                exception.StatusCode);
            throw;
        }
        finally
        {
            MortgageMetrics.RecordSave("update", outcome, started);
        }
    }

    public async Task DeleteAsync(
        string ownerUserId,
        Guid id,
        int version,
        CancellationToken cancellationToken)
    {
        var started = MortgageMetrics.Start();
        var outcome = "failure";
        try
        {
            dbContext.ChangeTracker.Clear();
            var mortgage = await dbContext.Mortgages
                .SingleOrDefaultAsync(
                    item => item.Id == id && item.OwnerUserId == ownerUserId,
                    cancellationToken);
            if (mortgage is null)
            {
                outcome = "not_found";
                throw NotFound();
            }

            if (mortgage.Version != version)
            {
                outcome = "conflict";
                throw Changed();
            }

            dbContext.Mortgages.Remove(mortgage);
            dbContext.Audits.Add(new Audit(
                ownerUserId,
                timeProvider.GetUtcNow(),
                "MortgageDelete",
                $"Mortgage {mortgage.Name} was deleted."));
            try
            {
                await dbContext.SaveChangesAsync(cancellationToken);
            }
            catch (DbUpdateConcurrencyException)
            {
                outcome = "conflict";
                dbContext.ChangeTracker.Clear();
                throw await ChangedOrGoneAsync(ownerUserId, id, cancellationToken);
            }

            outcome = "success";
            logger.LogInformation("Mortgage {MortgageId} was deleted.", id);
        }
        catch (ApiProblemException exception)
        {
            logger.LogInformation(
                "Mortgage {MortgageId} delete was rejected with status {StatusCode}.",
                id,
                exception.StatusCode);
            throw;
        }
        finally
        {
            MortgageMetrics.RecordDelete(outcome, started);
        }
    }

    private const string DuplicateNameMessage = "A mortgage with this name already exists";

    // A foreign or unknown account looks the same as an invalid id (SEC-001).
    private async Task CheckAccountOwnedAsync(
        string ownerUserId,
        ValidMortgage? valid,
        Dictionary<string, string> errors,
        CancellationToken cancellationToken)
    {
        if (valid?.AccountId is { } accountId
            && await accountService.GetOwnedAsync(ownerUserId, accountId, cancellationToken) is null)
        {
            errors["accountId"] = MortgageValidator.AccountIdMessage;
        }
    }

    private Task<bool> NameExistsAsync(
        string ownerUserId,
        string name,
        Guid? excludingId,
        CancellationToken cancellationToken) =>
        dbContext.Mortgages.AnyAsync(
            mortgage => mortgage.OwnerUserId == ownerUserId
                && mortgage.Name == name
                && (excludingId == null || mortgage.Id != excludingId),
            cancellationToken);

    private async Task<ApiProblemException> ChangedOrGoneAsync(
        string ownerUserId,
        Guid id,
        CancellationToken cancellationToken) =>
        await dbContext.Mortgages.AsNoTracking().AnyAsync(
            mortgage => mortgage.Id == id && mortgage.OwnerUserId == ownerUserId,
            cancellationToken)
            ? Changed()
            : NotFound();

    private static bool IsUniqueViolation(DbUpdateException exception) =>
        exception.InnerException is SqlException { Number: 2601 or 2627 };

    private static bool IsNameViolation(DbUpdateException exception) =>
        exception.InnerException is SqlException { Number: 2601 or 2627 } sql
        && sql.Message.Contains(NameIndexName, StringComparison.Ordinal);

    private static ApiProblemException Invalid(IReadOnlyDictionary<string, string> errors) =>
        new(
            StatusCodes.Status400BadRequest,
            "The mortgage is invalid.",
            "Correct the highlighted fields and try again.",
            errors.ToDictionary(pair => pair.Key, pair => new[] { pair.Value }));

    private static ApiProblemException NotFound() =>
        new(
            StatusCodes.Status404NotFound,
            "Mortgage not found.",
            "The mortgage does not exist or is not available to this user.");

    private static ApiProblemException Changed() =>
        new(
            StatusCodes.Status409Conflict,
            "The mortgage changed.",
            "This mortgage was changed elsewhere; reload to see the latest",
            type: ChangedProblemType);
}
