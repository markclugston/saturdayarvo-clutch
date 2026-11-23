using Clutch.API.Tests.Integration.Accounts;
using static Clutch.API.Tests.Integration.Imports.ImportOrderTestSupport;
using static Clutch.API.Tests.Integration.Mortgages.MortgageTestSupport;

namespace Clutch.API.Tests.Integration.Imports;

[Collection(SqlServerCollection.Name)]
public sealed class ImportOrderTests(SqlServerFixture fixture)
{
    private const string Day = "2025-02-01";

    // Chronological: A (+100 -> 1100), B (-50 -> 1050), C (+25 -> 1075).
    private static readonly (string, string, string, string?) A = (Day, "A", "100", "1100");
    private static readonly (string, string, string, string?) B = (Day, "B", "-50", "1050");
    private static readonly (string, string, string, string?) C = (Day, "C", "25", "1075");

    [Fact]
    [Trait("Category", "SqlServer")]
    public async Task Newest_first_file_is_stored_chronologically_and_listed_latest_first()
    {
        using var client = await SignedInClientAsync(fixture.Factory);
        var accountId = await CreateAccountAsync(client);

        await ImportAsync(client, accountId, Csv(C, B, A));

        var listed = await ListAsync(client, accountId);
        Assert.Equal(["C", "B", "A"], listed.Items.Select(item => item.Description));
        var stored = await StoredAsync(fixture, accountId);
        Assert.Equal(["A", "B", "C"], stored.Select(row => row.Description));
        AssertReconcile(stored);
        // FR-009: the file's own values are saved unchanged.
        Assert.Equal(["25", "50", "100"], listed.Items.Select(item => item.Amount));
        Assert.Equal(["Incoming", "Outgoing", "Incoming"], listed.Items.Select(item => item.Direction));
        Assert.Equal(["1075", "1050", "1100"], listed.Items.Select(item => item.Balance));
    }

    [Fact]
    [Trait("Category", "SqlServer")]
    public async Task Oldest_first_file_is_stored_chronologically_and_listed_latest_first()
    {
        using var client = await SignedInClientAsync(fixture.Factory);
        var accountId = await CreateAccountAsync(client);

        await ImportAsync(client, accountId, Csv(A, B, C));

        Assert.Equal(["C", "B", "A"], (await ListAsync(client, accountId)).Items.Select(item => item.Description));
        var stored = await StoredAsync(fixture, accountId);
        Assert.Equal(["A", "B", "C"], stored.Select(row => row.Description));
        AssertReconcile(stored);
    }

    [Fact]
    [Trait("Category", "SqlServer")]
    public async Task All_same_date_file_without_balances_is_treated_as_newest_first()
    {
        using var client = await SignedInClientAsync(fixture.Factory);
        var accountId = await CreateAccountAsync(client);

        await ImportAsync(
            client,
            accountId,
            Csv((Day, "X", "10", null), (Day, "Y", "10", null), (Day, "Z", "10", null)));

        Assert.Equal(["X", "Y", "Z"], (await ListAsync(client, accountId)).Items.Select(item => item.Description));
        Assert.Equal(["Z", "Y", "X"], (await StoredAsync(fixture, accountId)).Select(row => row.Description));
    }

    [Fact]
    [Trait("Category", "SqlServer")]
    public async Task A_later_import_is_appended_after_saved_rows_whatever_its_balances()
    {
        using var client = await SignedInClientAsync(fixture.Factory);
        var accountId = await CreateAccountAsync(client);
        await ImportAsync(client, accountId, Csv((Day, "X", "10", "110"), (Day, "Y", "20", "130")));
        var before = await StoredAsync(fixture, accountId);

        // P and Q reconcile with each other (oldest first) at balances lower than X and Y.
        await ImportAsync(client, accountId, Csv((Day, "P", "10", "50"), (Day, "Q", "10", "60")));

        var stored = await StoredAsync(fixture, accountId);
        Assert.Equal(["X", "Y", "P", "Q"], stored.Select(row => row.Description));
        Assert.Equal(before.Select(row => row.Sequence), stored.Take(2).Select(row => row.Sequence));
        Assert.Equal(
            ["Q", "P", "Y", "X"],
            (await ListAsync(client, accountId)).Items.Select(item => item.Description));
    }

    [Fact]
    [Trait("Category", "SqlServer")]
    public async Task An_older_statement_confirmed_later_still_appends_shared_date_rows_after_saved_rows()
    {
        using var client = await SignedInClientAsync(fixture.Factory);
        var accountId = await CreateAccountAsync(client);
        await ImportAsync(
            client,
            accountId,
            Csv(("2025-03-03", "New3", "1", null), ("2025-03-02", "New2", "1", null)));

        await ImportAsync(
            client,
            accountId,
            Csv(("2025-03-02", "Old2", "1", null), ("2025-03-01", "Old1", "1", null)));

        var stored = await StoredAsync(fixture, accountId);
        Assert.Equal(["Old1", "New2", "Old2", "New3"], stored.Select(row => row.Description));
    }

    [Fact]
    [Trait("Category", "SqlServer")]
    public async Task Possible_duplicates_keep_their_own_position_and_flags_match_the_review()
    {
        using var client = await SignedInClientAsync(fixture.Factory);
        var accountId = await CreateAccountAsync(client);
        await ImportAsync(client, accountId, Csv((Day, "Coffee", "-5", null)));

        var review = await CreateReviewAsync(
            client,
            accountId,
            Csv((Day, "Other1", "-1", null), (Day, "Coffee", "-5", null), (Day, "Other2", "-2", null)));
        Assert.Equal([false, true, false], review.Rows.Select(row => row.IsPossibleDuplicate));
        await ConfirmAsync(client, review.Id, confirmPossibleDuplicates: true);

        var stored = await StoredAsync(fixture, accountId);
        Assert.Equal(["Coffee", "Other2", "Coffee", "Other1"], stored.Select(row => row.Description));
        var listed = await ListAsync(client, accountId);
        Assert.Equal(["Other1", "Coffee", "Other2", "Coffee"], listed.Items.Select(item => item.Description));
        Assert.Equal(["Outgoing", "Outgoing", "Outgoing", "Outgoing"], listed.Items.Select(item => item.Direction));
    }

    [Fact]
    [Trait("Category", "SqlServer")]
    public async Task Review_rows_are_listed_in_file_order_including_possible_duplicates()
    {
        using var client = await SignedInClientAsync(fixture.Factory);
        var accountId = await CreateAccountAsync(client);
        await ImportAsync(client, accountId, Csv((Day, "Coffee", "-5", null)));

        var review = await CreateReviewAsync(
            client,
            accountId,
            Csv(
                (Day, "R1", "-1", null),
                (Day, "Coffee", "-5", null),
                (Day, "R3", "-3", null),
                (Day, "Coffee", "-5", null),
                (Day, "R5", "-5", null)));

        var numbers = review.Rows.Select(row => row.SourceRowNumber).ToArray();
        Assert.Equal(numbers.Order(), numbers);
        Assert.Equal(5, numbers.Distinct().Count());
        Assert.Equal(
            ["R1", "Coffee", "R3", "Coffee", "R5"],
            review.Rows.Select(row => row.Description));
        Assert.Contains(review.Rows, row => row.IsPossibleDuplicate);
    }

    // SC-004: consecutive same-date rows reconcile when read in stored order.
    private static void AssertReconcile(IReadOnlyList<StoredRow> stored)
    {
        Assert.Equal(1100m, stored[0].Balance);
        Assert.Equal(1050m, stored[1].Balance);
        Assert.Equal(1075m, stored[2].Balance);
        Assert.Equal(1050m, stored[0].Balance - 50m);
        Assert.Equal(1075m, stored[1].Balance + 25m);
    }
}
