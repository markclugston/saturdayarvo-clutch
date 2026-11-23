using System.Globalization;
using System.Text;
using Clutch.API.Api.ProblemDetails;
using Clutch.API.Domain.Accounts;
using Clutch.API.Domain.Audit;
using Clutch.API.Domain.Transactions;
using Clutch.API.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Clutch.API.Application.Transactions;

public sealed class TransactionService(
    AppDbContext dbContext,
    ILogger<TransactionService> logger)
{
    private const int DefaultPageSize = 50;
    private const int MaximumPageSize = 100;
    private static readonly UTF8Encoding StrictUtf8 = new(false, true);
    private static readonly TimeSpan DeleteTimeout = TimeSpan.FromSeconds(8);

    public async Task<TransactionPageResponse> GetPageAsync(
        string ownerUserId,
        Guid accountId,
        string? cursor,
        int? pageSize,
        CancellationToken cancellationToken)
    {
        var accountExists = await dbContext.Accounts
            .AsNoTracking()
            .AnyAsync(account =>
                account.Id == accountId && account.OwnerUserId == ownerUserId,
                cancellationToken);
        if (!accountExists)
        {
            throw new ApiProblemException(
                StatusCodes.Status404NotFound,
                "Account not found.",
                "The account does not exist or is not available to this user.");
        }

        var size = pageSize ?? DefaultPageSize;
        if (size is < 1 or > MaximumPageSize)
        {
            var message = $"Page size must be between 1 and {MaximumPageSize}.";
            throw new ApiProblemException(
                StatusCodes.Status400BadRequest,
                "The page size is invalid.",
                message,
                new Dictionary<string, string[]> { ["pageSize"] = [message] });
        }

        var query = dbContext.Transactions
            .AsNoTracking()
            .Where(transaction => transaction.AccountId == accountId);
        if (!string.IsNullOrWhiteSpace(cursor))
        {
            var parsedCursor = DecodeCursor(cursor);
            query = query.Where(transaction =>
                transaction.TransactionDate < parsedCursor.TransactionDate
                || transaction.TransactionDate == parsedCursor.TransactionDate
                    && transaction.Sequence < parsedCursor.Sequence);
        }

        var values = await query
            .OrderByDescending(transaction => transaction.TransactionDate)
            .ThenByDescending(transaction => transaction.Sequence)
            .Take(size + 1)
            .Select(transaction => new TransactionProjection(
                transaction.Id,
                transaction.TransactionDate,
                transaction.Sequence,
                transaction.Description,
                transaction.Amount,
                transaction.Direction,
                transaction.Balance))
            .ToListAsync(cancellationToken);
        var hasMore = values.Count > size;
        if (hasMore)
        {
            values.RemoveAt(values.Count - 1);
        }

        var nextCursor = hasMore && values.Count > 0
            ? EncodeCursor(values[^1].TransactionDate, values[^1].Sequence)
            : null;
        return new TransactionPageResponse(
            values.Select(value => new TransactionListItem(
                value.Id,
                value.TransactionDate,
                value.Description,
                value.Amount.ToString("0.############################", CultureInfo.InvariantCulture),
                value.Direction.ToString(),
                value.Balance?.ToString("0.############################", CultureInfo.InvariantCulture))).ToArray(),
            nextCursor);
    }

    public async Task<TransactionDeleteResult> DeleteAsync(
        string ownerUserId,
        Guid accountId,
        Guid transactionId,
        CancellationToken cancellationToken)
    {
        var startedAt = TransactionMetrics.StartDelete();
        using var timeout = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        timeout.CancelAfter(DeleteTimeout);
        var token = timeout.Token;

        try
        {
            var deletion = await (
                from candidate in dbContext.Transactions
                join account in dbContext.Accounts on candidate.AccountId equals account.Id
                where candidate.Id == transactionId
                    && candidate.AccountId == accountId
                    && account.OwnerUserId == ownerUserId
                select new
                {
                    Transaction = candidate,
                    AccountDescription = account.Description,
                })
                .SingleOrDefaultAsync(token);
            if (deletion is null)
            {
                TransactionMetrics.RecordDelete("not_found", startedAt);
                return TransactionDeleteResult.NotFound;
            }

            var transaction = deletion.Transaction;
            var transactionDescription = string.IsNullOrWhiteSpace(transaction.Description)
                ? "A transaction"
                : $"Transaction {transaction.Description}";
            var duplicateFingerprint =
                $"({transaction.TransactionDate.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture)}, "
                + $"{transaction.Amount.ToString("0.############################", CultureInfo.InvariantCulture)}, "
                + $"{transaction.Direction})";
            var description =
                $"{transactionDescription} {duplicateFingerprint} was reviewed and deleted in account {deletion.AccountDescription}.";
            dbContext.Transactions.Remove(transaction);
            dbContext.Audits.Add(new Audit(
                ownerUserId,
                DateTimeOffset.UtcNow,
                "TransactionDelete",
                description));
            await dbContext.SaveChangesAsync(token);

            TransactionMetrics.RecordDelete("success", startedAt);
            return TransactionDeleteResult.Deleted;
        }
        catch (DbUpdateConcurrencyException)
        {
            // Another request removed the row between the load and the save.
            TransactionMetrics.RecordDelete("not_found", startedAt);
            return TransactionDeleteResult.NotFound;
        }
        catch (Exception exception)
        {
            TransactionMetrics.RecordDelete("error", startedAt);
            logger.LogError(
                exception,
                "Transaction {TransactionId} could not be deleted from account {AccountId}.",
                transactionId,
                accountId);
            throw;
        }
    }

    private static string EncodeCursor(DateOnly date, int sequence)
    {
        var value = string.Create(CultureInfo.InvariantCulture, $"{date:yyyy-MM-dd}|{sequence}");
        return Convert.ToBase64String(Encoding.UTF8.GetBytes(value))
            .TrimEnd('=')
            .Replace('+', '-')
            .Replace('/', '_');
    }

    private static TransactionCursor DecodeCursor(string cursor)
    {
        if (cursor.Length > 128 || !cursor.All(IsBase64UrlCharacter))
        {
            throw InvalidCursor();
        }

        try
        {
            var normalized = cursor.Replace('-', '+').Replace('_', '/');
            normalized = normalized.PadRight(normalized.Length + (4 - normalized.Length % 4) % 4, '=');
            var bytes = Convert.FromBase64String(normalized);
            var value = StrictUtf8.GetString(bytes);
            var pieces = value.Split('|', StringSplitOptions.None);
            if (pieces.Length == 2
                && DateOnly.TryParseExact(
                    pieces[0],
                    "yyyy-MM-dd",
                    CultureInfo.InvariantCulture,
                    DateTimeStyles.None,
                    out var date)
                && pieces[1].All(char.IsAsciiDigit)
                && int.TryParse(
                    pieces[1],
                    NumberStyles.None,
                    CultureInfo.InvariantCulture,
                    out var sequence)
                && sequence >= 1)
            {
                var parsed = new TransactionCursor(date, sequence);
                // Only cursors this service issues are accepted: re-encoding must give the same text.
                if (EncodeCursor(parsed.TransactionDate, parsed.Sequence) == cursor)
                {
                    return parsed;
                }
            }
        }
        catch (Exception exception) when (exception is FormatException or ArgumentException)
        {
            // Invalid opaque cursors return a generic validation response.
        }

        throw InvalidCursor();
    }

    private static bool IsBase64UrlCharacter(char value) =>
        char.IsAsciiLetterOrDigit(value) || value is '-' or '_';

    private static ApiProblemException InvalidCursor() =>
        new(
            StatusCodes.Status400BadRequest,
            "The transaction cursor is invalid.",
            "Request a page without a cursor and try again.",
            new Dictionary<string, string[]>
            {
                ["cursor"] = ["The page cursor is not valid. Request the first page without a cursor."],
            });

    private sealed record TransactionCursor(DateOnly TransactionDate, int Sequence);

    private sealed record TransactionProjection(
        Guid Id,
        DateOnly TransactionDate,
        int Sequence,
        string Description,
        decimal Amount,
        TransactionDirection Direction,
        decimal? Balance);
}

public sealed record TransactionListItem(
    Guid Id,
    DateOnly TransactionDate,
    string Description,
    string Amount,
    string Direction,
    string? Balance);

public sealed record TransactionPageResponse(
    IReadOnlyList<TransactionListItem> Items,
    string? NextCursor);
