using System.Collections.Concurrent;
using System.Diagnostics.Metrics;
using Clutch.API.Application.Transactions;
using Clutch.API.Domain.Accounts;
using Clutch.API.Domain.Audit;
using Clutch.API.Domain.Shared;
using Clutch.API.Domain.Transactions;
using Clutch.API.Infrastructure.Identity;
using Clutch.API.Infrastructure.Persistence;
using Clutch.API.Tests.Integration.Accounts;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;

namespace Clutch.API.Tests.Integration.Transactions;

[Collection(SqlServerCollection.Name)]
public sealed class TransactionServiceDeleteTests(SqlServerFixture fixture)
{
    [Fact]
    [Trait("Category", "SqlServer")]
    public async Task DeleteAsync_removes_owned_transaction_and_writes_audit_in_same_save()
    {
        var ownerUserId = await SeedUserAsync();
        var (accountId, transactionId) = await SeedTransactionAsync(ownerUserId);

        await using var scope = fixture.Factory.Services.CreateAsyncScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var service = new TransactionService(dbContext, NullLogger<TransactionService>.Instance);

        var result = await service.DeleteAsync(
            ownerUserId,
            accountId,
            transactionId,
            CancellationToken.None);

        Assert.Equal(TransactionDeleteResult.Deleted, result);
        Assert.False(await dbContext.Transactions.AnyAsync(transaction => transaction.Id == transactionId));
        var audit = await dbContext.Audits.SingleAsync(entry =>
            entry.EventCode == "TransactionDelete"
            && entry.ActingUserId == ownerUserId);
        Assert.Equal(ownerUserId, audit.ActingUserId);
        Assert.False(string.IsNullOrWhiteSpace(audit.EventCode));
        Assert.False(string.IsNullOrWhiteSpace(audit.Description));
        Assert.Contains("reviewed and deleted", audit.Description, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("Delete test transaction", audit.Description, StringComparison.Ordinal);
        Assert.Contains("2026-01-15", audit.Description, StringComparison.Ordinal);
        Assert.Contains("12.34", audit.Description, StringComparison.Ordinal);
        Assert.Contains("Outgoing", audit.Description, StringComparison.Ordinal);
        Assert.Contains("Delete test account", audit.Description, StringComparison.Ordinal);
        Assert.DoesNotContain(accountId.ToString(), audit.Description, StringComparison.Ordinal);
        Assert.DoesNotContain(transactionId.ToString(), audit.Description, StringComparison.Ordinal);
        Assert.InRange(audit.OccurredAtUtc, DateTimeOffset.UtcNow.AddMinutes(-1), DateTimeOffset.UtcNow);
    }

    [Fact]
    [Trait("Category", "SqlServer")]
    public async Task DeleteAsync_returns_NotFound_when_account_is_not_owned()
    {
        var ownerUserId = await SeedUserAsync();
        var otherUserId = await SeedUserAsync();
        var (accountId, transactionId) = await SeedTransactionAsync(ownerUserId);

        await using var scope = fixture.Factory.Services.CreateAsyncScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var service = new TransactionService(dbContext, NullLogger<TransactionService>.Instance);

        var result = await service.DeleteAsync(
            otherUserId,
            accountId,
            transactionId,
            CancellationToken.None);

        Assert.Equal(TransactionDeleteResult.NotFound, result);
        Assert.True(await dbContext.Transactions.AnyAsync(transaction => transaction.Id == transactionId));
        Assert.False(await dbContext.Audits.AnyAsync(entry =>
            entry.EventCode == "TransactionDelete" && entry.ActingUserId == otherUserId));
    }

    [Fact]
    [Trait("Category", "SqlServer")]
    public async Task DeleteAsync_returns_NotFound_when_transaction_is_missing()
    {
        var ownerUserId = await SeedUserAsync();
        var (accountId, _) = await SeedTransactionAsync(ownerUserId);

        await using var scope = fixture.Factory.Services.CreateAsyncScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var service = new TransactionService(dbContext, NullLogger<TransactionService>.Instance);

        var result = await service.DeleteAsync(
            ownerUserId,
            accountId,
            Guid.NewGuid(),
            CancellationToken.None);

        Assert.Equal(TransactionDeleteResult.NotFound, result);
    }

    [Fact]
    [Trait("Category", "SqlServer")]
    public async Task DeleteAsync_returns_NotFound_when_transaction_belongs_to_another_account()
    {
        var ownerUserId = await SeedUserAsync();
        var (_, transactionId) = await SeedTransactionAsync(ownerUserId);
        var (otherAccountId, _) = await SeedTransactionAsync(ownerUserId);

        await using var scope = fixture.Factory.Services.CreateAsyncScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var service = new TransactionService(dbContext, NullLogger<TransactionService>.Instance);

        var result = await service.DeleteAsync(
            ownerUserId,
            otherAccountId,
            transactionId,
            CancellationToken.None);

        Assert.Equal(TransactionDeleteResult.NotFound, result);
        Assert.True(await dbContext.Transactions.AnyAsync(transaction => transaction.Id == transactionId));
    }

    [Fact]
    [Trait("Category", "SqlServer")]
    public async Task DeleteAsync_propagates_cancellation_records_error_and_keeps_transaction()
    {
        var ownerUserId = await SeedUserAsync();
        var (accountId, transactionId) = await SeedTransactionAsync(ownerUserId);
        using var cancelled = new CancellationTokenSource();
        await cancelled.CancelAsync();

        var outcomes = new ConcurrentQueue<string>();
        using var listener = new MeterListener();
        listener.InstrumentPublished = (instrument, meterListener) =>
        {
            if (instrument.Meter.Name == TransactionMetrics.MeterName
                && instrument.Name == "clutch.transaction.delete.outcomes")
            {
                meterListener.EnableMeasurementEvents(instrument);
            }
        };
        listener.SetMeasurementEventCallback<long>((_, _, tags, _) =>
        {
            foreach (var tag in tags)
            {
                if (tag.Key == "outcome" && tag.Value is string outcome)
                {
                    outcomes.Enqueue(outcome);
                }
            }
        });
        listener.Start();

        await using var scope = fixture.Factory.Services.CreateAsyncScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var service = new TransactionService(dbContext, NullLogger<TransactionService>.Instance);

        await Assert.ThrowsAnyAsync<OperationCanceledException>(() => service.DeleteAsync(
            ownerUserId,
            accountId,
            transactionId,
            cancelled.Token));

        Assert.Contains("error", outcomes);

        await using var verifyScope = fixture.Factory.Services.CreateAsyncScope();
        var verifyContext = verifyScope.ServiceProvider.GetRequiredService<AppDbContext>();
        Assert.True(await verifyContext.Transactions.AnyAsync(transaction => transaction.Id == transactionId));
    }

    private async Task<string> SeedUserAsync()
    {
        var userId = Guid.NewGuid().ToString("N");
        var email = $"{userId}@example.test";
        await using var scope = fixture.Factory.Services.CreateAsyncScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        dbContext.Users.Add(new ApplicationUser
        {
            Id = userId,
            UserName = email,
            NormalizedUserName = email.ToUpperInvariant(),
            Email = email,
            NormalizedEmail = email.ToUpperInvariant(),
            EmailConfirmed = true,
            SecurityStamp = Guid.NewGuid().ToString("N"),
            ConcurrencyStamp = Guid.NewGuid().ToString("N"),
        });
        await dbContext.SaveChangesAsync();
        return userId;
    }

    private async Task<(Guid AccountId, Guid TransactionId)> SeedTransactionAsync(string ownerUserId)
    {
        await using var scope = fixture.Factory.Services.CreateAsyncScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        Assert.True(Account.TryCreate(ownerUserId, "Delete test account", "AUD", out var account));
        dbContext.Accounts.Add(account!);

        Assert.True(Currency.TryGet("AUD", out var currency));
        Assert.True(Transaction.TryCreate(
            account!.Id,
            new DateOnly(2026, 1, 15),
            "Delete test transaction",
            12.34m,
            TransactionDirection.Outgoing,
            100m,
            1,
            currency!,
            DateTimeOffset.UtcNow,
            out var transaction));
        dbContext.Transactions.Add(transaction!);
        await dbContext.SaveChangesAsync();

        return (account.Id, transaction!.Id);
    }
}
