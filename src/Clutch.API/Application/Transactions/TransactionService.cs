using System.Globalization;
using System.Text;
using Clutch.API.Api.ProblemDetails;
using Clutch.API.Domain.Accounts;
using Clutch.API.Domain.Transactions;
using Clutch.API.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Clutch.API.Application.Transactions;

public sealed class TransactionService(AppDbContext dbContext)
{
    private const int DefaultPageSize = 50;
    private const int MaximumPageSize = 100;

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
            throw new ApiProblemException(
                StatusCodes.Status400BadRequest,
                "The page size is invalid.",
                $"Page size must be between 1 and {MaximumPageSize}.");
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
                    && transaction.Id.CompareTo(parsedCursor.Id) < 0);
        }

        var values = await query
            .OrderByDescending(transaction => transaction.TransactionDate)
            .ThenByDescending(transaction => transaction.Id)
            .Take(size + 1)
            .Select(transaction => new TransactionProjection(
                transaction.Id,
                transaction.TransactionDate,
                transaction.Description,
                transaction.Amount,
                transaction.Direction))
            .ToListAsync(cancellationToken);
        var hasMore = values.Count > size;
        if (hasMore)
        {
            values.RemoveAt(values.Count - 1);
        }

        var nextCursor = hasMore && values.Count > 0
            ? EncodeCursor(values[^1].TransactionDate, values[^1].Id)
            : null;
        return new TransactionPageResponse(
            values.Select(value => new TransactionListItem(
                value.Id,
                value.TransactionDate,
                value.Description,
                value.Amount.ToString("0.############################", CultureInfo.InvariantCulture),
                value.Direction.ToString())).ToArray(),
            nextCursor);
    }

    private static string EncodeCursor(DateOnly date, Guid id)
    {
        var value = $"{date:yyyy-MM-dd}|{id:N}";
        return Convert.ToBase64String(Encoding.UTF8.GetBytes(value))
            .TrimEnd('=')
            .Replace('+', '-')
            .Replace('/', '_');
    }

    private static TransactionCursor DecodeCursor(string cursor)
    {
        if (cursor.Length > 128)
        {
            throw InvalidCursor();
        }

        try
        {
            var normalized = cursor.Replace('-', '+').Replace('_', '/');
            normalized = normalized.PadRight(normalized.Length + (4 - normalized.Length % 4) % 4, '=');
            var value = Encoding.UTF8.GetString(Convert.FromBase64String(normalized));
            var pieces = value.Split('|', StringSplitOptions.None);
            if (pieces.Length == 2
                && DateOnly.TryParseExact(
                    pieces[0],
                    "yyyy-MM-dd",
                    CultureInfo.InvariantCulture,
                    DateTimeStyles.None,
                    out var date)
                && Guid.TryParseExact(pieces[1], "N", out var id))
            {
                return new TransactionCursor(date, id);
            }
        }
        catch (FormatException)
        {
            // Invalid opaque cursors return a generic validation response.
        }

        throw InvalidCursor();
    }

    private static ApiProblemException InvalidCursor() =>
        new(
            StatusCodes.Status400BadRequest,
            "The transaction cursor is invalid.",
            "Request a page without a cursor and try again.");

    private sealed record TransactionCursor(DateOnly TransactionDate, Guid Id);

    private sealed record TransactionProjection(
        Guid Id,
        DateOnly TransactionDate,
        string Description,
        decimal Amount,
        TransactionDirection Direction);
}

public sealed record TransactionListItem(
    Guid Id,
    DateOnly TransactionDate,
    string Description,
    string Amount,
    string Direction);

public sealed record TransactionPageResponse(
    IReadOnlyList<TransactionListItem> Items,
    string? NextCursor);
