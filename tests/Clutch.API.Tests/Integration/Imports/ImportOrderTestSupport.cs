using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using Clutch.API.Application.Imports;
using Clutch.API.Infrastructure.Persistence;
using Clutch.API.Tests.Integration.Accounts;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using static Clutch.API.Tests.Integration.Mortgages.MortgageTestSupport;

namespace Clutch.API.Tests.Integration.Imports;

internal static class ImportOrderTestSupport
{
    public sealed record ReviewRow(
        int SourceRowNumber,
        DateOnly TransactionDate,
        string Description,
        string Amount,
        string Direction,
        bool IsPossibleDuplicate,
        string? Balance);

    public sealed record Review(Guid Id, ReviewRow[] Rows);

    public sealed record ListItem(
        Guid Id,
        DateOnly TransactionDate,
        string Description,
        string Amount,
        string Direction,
        string? Balance);

    public sealed record ListPage(ListItem[] Items, string? NextCursor);

    public sealed record StoredRow(DateOnly TransactionDate, int Sequence, string Description, decimal? Balance);

    // Columns: Date, Description, Amount (signed, incoming positive), Balance.
    public static ImportMapping Mapping() =>
        new(
            0,
            1,
            "yyyy-MM-dd",
            ImportAmountMode.Signed,
            SignedAmountColumn: 2,
            IncomingSign: IncomingSign.Positive,
            NumberFormat: "dot-decimal-comma-grouping",
            BalanceColumn: 3);

    public static string Csv(params (string Date, string Description, string Amount, string? Balance)[] rows) =>
        "Date,Description,Amount,Balance\n"
        + string.Join("\n", rows.Select(row => $"{row.Date},{row.Description},{row.Amount},{row.Balance}"));

    public static async Task<Review> CreateReviewAsync(HttpClient client, Guid accountId, string csv)
    {
        var token = await client.GetFromJsonAsync<JsonElement>("/api/security/csrf-token");
        using var content = new MultipartFormDataContent();
        var file = new ByteArrayContent(Encoding.UTF8.GetBytes(csv));
        file.Headers.ContentType = new System.Net.Http.Headers.MediaTypeHeaderValue("text/csv");
        content.Add(file, "file", "transactions.csv");
        content.Add(
            new StringContent(JsonSerializer.Serialize(Mapping(), new JsonSerializerOptions(JsonSerializerDefaults.Web))),
            "mapping");
        using var request = new HttpRequestMessage(
            HttpMethod.Post,
            $"/api/accounts/{accountId}/import-reviews")
        {
            Content = content,
        };
        request.Headers.Add("X-CSRF-TOKEN", token.GetProperty("requestToken").GetString());
        using var response = await client.SendAsync(request);
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return (await response.Content.ReadFromJsonAsync<Review>())!;
    }

    public static async Task ConfirmAsync(HttpClient client, Guid reviewId, bool confirmPossibleDuplicates = false)
    {
        using var response = await SendAsync(
            client,
            HttpMethod.Post,
            $"/api/import-reviews/{reviewId}/confirm",
            new { confirmPossibleDuplicates });
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    public static async Task<Review> ImportAsync(
        HttpClient client,
        Guid accountId,
        string csv,
        bool confirmPossibleDuplicates = false)
    {
        var review = await CreateReviewAsync(client, accountId, csv);
        await ConfirmAsync(client, review.Id, confirmPossibleDuplicates);
        return review;
    }

    public static async Task<ListPage> ListAsync(
        HttpClient client,
        Guid accountId,
        int? pageSize = null,
        string? cursor = null)
    {
        var query = new List<string>();
        if (pageSize is not null)
        {
            query.Add($"pageSize={pageSize}");
        }

        if (cursor is not null)
        {
            query.Add($"cursor={Uri.EscapeDataString(cursor)}");
        }

        using var response = await client.GetAsync(
            $"/api/accounts/{accountId}/transactions?{string.Join('&', query)}");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return (await response.Content.ReadFromJsonAsync<ListPage>())!;
    }

    public static async Task<List<ListItem>> ListAllAsync(HttpClient client, Guid accountId, int pageSize)
    {
        var all = new List<ListItem>();
        string? cursor = null;
        do
        {
            var page = await ListAsync(client, accountId, pageSize, cursor);
            all.AddRange(page.Items);
            cursor = page.NextCursor;
        }
        while (cursor is not null);

        return all;
    }

    // Stored order: date then Sequence ascending.
    public static async Task<List<StoredRow>> StoredAsync(SqlServerFixture fixture, Guid accountId)
    {
        await using var scope = fixture.Factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        return await db.Transactions
            .AsNoTracking()
            .Where(transaction => transaction.AccountId == accountId)
            .OrderBy(transaction => transaction.TransactionDate)
            .ThenBy(transaction => transaction.Sequence)
            .Select(transaction => new StoredRow(
                transaction.TransactionDate,
                transaction.Sequence,
                transaction.Description,
                transaction.Balance))
            .ToListAsync();
    }
}
