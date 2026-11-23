using System.Net;
using System.Text;
using Clutch.API.Tests.Integration.Accounts;
using static Clutch.API.Tests.Integration.Imports.ImportOrderTestSupport;
using static Clutch.API.Tests.Integration.Mortgages.MortgageTestSupport;

namespace Clutch.API.Tests.Integration.Transactions;

[Collection(SqlServerCollection.Name)]
public sealed class TransactionOrderTests(SqlServerFixture fixture)
{
    private const string Day = "2025-02-01";

    private static string SameDateCsv(int count) =>
        Csv(Enumerable.Range(1, count)
            .Select(index => (Day, $"Row{index}", "1", (string?)null))
            .Append(("2025-01-31", "Earlier", "1", null))
            .ToArray());

    private static string Cursor(string value) =>
        Convert.ToBase64String(Encoding.UTF8.GetBytes(value))
            .TrimEnd('=')
            .Replace('+', '-')
            .Replace('/', '_');

    [Fact]
    [Trait("Category", "SqlServer")]
    public async Task The_same_order_is_returned_on_every_load()
    {
        using var client = await SignedInClientAsync(fixture.Factory);
        var accountId = await CreateAccountAsync(client);
        await ImportAsync(client, accountId, SameDateCsv(6));

        var first = await ListAsync(client, accountId);
        var second = await ListAsync(client, accountId);

        Assert.Equal(first.Items.Select(item => item.Id), second.Items.Select(item => item.Id));
        Assert.Equal(
            ["Row1", "Row2", "Row3", "Row4", "Row5", "Row6", "Earlier"],
            first.Items.Select(item => item.Description));
    }

    [Theory]
    [Trait("Category", "SqlServer")]
    [InlineData(1)]
    [InlineData(2)]
    [InlineData(3)]
    public async Task A_page_size_smaller_than_a_same_date_group_pages_without_repeats_or_gaps(int pageSize)
    {
        using var client = await SignedInClientAsync(fixture.Factory);
        var accountId = await CreateAccountAsync(client);
        await ImportAsync(client, accountId, SameDateCsv(7));

        var whole = await ListAsync(client, accountId);
        var paged = await ListAllAsync(client, accountId, pageSize);

        Assert.Equal(8, paged.Count);
        Assert.Equal(paged.Count, paged.Select(item => item.Id).Distinct().Count());
        Assert.Equal(whole.Items.Select(item => item.Id), paged.Select(item => item.Id));
    }

    [Fact]
    [Trait("Category", "SqlServer")]
    public async Task Deleting_a_middle_row_keeps_the_rest_in_order()
    {
        using var client = await SignedInClientAsync(fixture.Factory);
        var accountId = await CreateAccountAsync(client);
        await ImportAsync(client, accountId, SameDateCsv(5));
        var before = await ListAsync(client, accountId);
        var middle = before.Items.Single(item => item.Description == "Row3");

        using var delete = await SendAsync(
            client,
            HttpMethod.Delete,
            $"/api/accounts/{accountId}/transactions/{middle.Id}",
            null);
        Assert.Equal(HttpStatusCode.NoContent, delete.StatusCode);

        var after = await ListAllAsync(client, accountId, 2);
        Assert.Equal(
            ["Row1", "Row2", "Row4", "Row5", "Earlier"],
            after.Select(item => item.Description));
    }

    [Theory]
    [Trait("Category", "SqlServer")]
    [InlineData("old-format", "2025-02-01|0f8fad5bd9cb469fa16570867728950e")]
    [InlineData("extra-part", "2025-02-01|1|2")]
    [InlineData("missing-part", "2025-02-01")]
    [InlineData("plus-sign", "2025-02-01|+1")]
    [InlineData("minus-sign", "2025-02-01|-1")]
    [InlineData("padded-spaces", "2025-02-01| 1")]
    [InlineData("leading-zero", "2025-02-01|01")]
    [InlineData("zero", "2025-02-01|0")]
    [InlineData("overflow", "2025-02-01|99999999999")]
    [InlineData("bad-date", "2025-13-01|1")]
    [InlineData("wrong-date-format", "2025-2-1|1")]
    [InlineData("empty-sequence", "2025-02-01|")]
    public async Task A_malformed_cursor_is_a_field_level_400_that_discloses_nothing(string name, string raw)
    {
        using var client = await SignedInClientAsync(fixture.Factory);
        var accountId = await CreateAccountAsync(client);

        await AssertInvalidCursorAsync(client, accountId, Cursor(raw), name);
    }

    [Theory]
    [Trait("Category", "SqlServer")]
    [InlineData("not-base64", "!!!!")]
    [InlineData("padded-base64", "MjAyNS0wMi0wMXwx=")]
    [InlineData("too-long", "QUFB")]
    public async Task A_cursor_that_is_not_base64url_or_too_long_is_a_field_level_400(string name, string raw)
    {
        using var client = await SignedInClientAsync(fixture.Factory);
        var accountId = await CreateAccountAsync(client);
        var cursor = name == "too-long" ? new string('A', 129) : raw;

        await AssertInvalidCursorAsync(client, accountId, cursor, name);
    }

    [Fact]
    [Trait("Category", "SqlServer")]
    public async Task A_cursor_issued_by_the_service_is_accepted()
    {
        using var client = await SignedInClientAsync(fixture.Factory);
        var accountId = await CreateAccountAsync(client);
        await ImportAsync(client, accountId, SameDateCsv(3));

        var firstPage = await ListAsync(client, accountId, 1);
        Assert.NotNull(firstPage.NextCursor);
        var secondPage = await ListAsync(client, accountId, 1, firstPage.NextCursor);

        Assert.Equal("Row2", Assert.Single(secondPage.Items).Description);
    }

    private static async Task AssertInvalidCursorAsync(
        HttpClient client,
        Guid accountId,
        string cursor,
        string name)
    {
        using var response = await client.GetAsync(
            $"/api/accounts/{accountId}/transactions?cursor={Uri.EscapeDataString(cursor)}");

        Assert.True(response.StatusCode == HttpStatusCode.BadRequest, $"{name}: {response.StatusCode}");
        var text = await response.Content.ReadAsStringAsync();
        var problem = System.Text.Json.JsonSerializer.Deserialize<ProblemDto>(
            text,
            new System.Text.Json.JsonSerializerOptions(System.Text.Json.JsonSerializerDefaults.Web))!;
        Assert.Equal("The transaction cursor is invalid.", problem.Title);
        Assert.Equal(
            ["The page cursor is not valid. Request the first page without a cursor."],
            problem.Errors!["cursor"]);
        // SEC-004: no format, check or internal details are disclosed.
        Assert.DoesNotContain("yyyy", text, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("base64", text, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("sequence", text, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("Exception", text, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("   at ", text, StringComparison.Ordinal);
    }
}
