using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using Clutch.API.Application.Imports;
using Clutch.API.Domain.Imports;
using Clutch.API.Infrastructure.Identity;
using Clutch.API.Tests.Integration.Accounts;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;

namespace Clutch.API.Tests.Integration.Admin;

[Collection(SqlServerCollection.Name)]
public sealed class ImportLimitSettingsTests(SqlServerFixture fixture)
{
    [Fact]
    [Trait("Category", "SqlServer")]
    public async Task Admin_can_update_shared_limits_and_updates_are_enforced_immediately()
    {
        using var client = CreateClient();
        var email = await RegisterAsync(client);
        await GrantAdministratorRoleAsync(email);
        await SignInAsync(client, email);

        using var defaultsResponse = await client.GetAsync("/api/admin/import-limits");
        Assert.Equal(HttpStatusCode.OK, defaultsResponse.StatusCode);
        var defaults = await defaultsResponse.Content.ReadFromJsonAsync<ImportLimits>();
        Assert.Equal(ImportLimits.Default, defaults);

        using var invalidResponse = await SendJsonAsync(
            client,
            HttpMethod.Put,
            "/api/admin/import-limits",
            new
            {
                maxFileSizeBytes = ImportLimits.Default.MaxFileSizeBytes,
                maxRowsPerImport = 0,
                maxImportAttemptsPerUserPerMinute =
                    ImportLimits.Default.MaxImportAttemptsPerUserPerMinute,
            });
        Assert.Equal(HttpStatusCode.BadRequest, invalidResponse.StatusCode);

        using var afterInvalidResponse = await client.GetAsync("/api/admin/import-limits");
        var afterInvalid = await afterInvalidResponse.Content.ReadFromJsonAsync<ImportLimits>();
        Assert.Equal(ImportLimits.Default, afterInvalid);

        using var updatedResponse = await SendJsonAsync(
            client,
            HttpMethod.Put,
            "/api/admin/import-limits",
            new
            {
                maxFileSizeBytes = 1,
                maxRowsPerImport = 1,
                maxImportAttemptsPerUserPerMinute = 6,
            });
        Assert.Equal(HttpStatusCode.OK, updatedResponse.StatusCode);
        var updatedLimits = await updatedResponse.Content.ReadFromJsonAsync<ImportLimits>();
        Assert.Equal(new ImportLimits(1, 1, 6), updatedLimits);

        try
        {
            await CreateFamilyAsync(client);
            var accountId = await CreateAccountAsync(client);
            using var reviewResponse = await CreateReviewAsync(client, accountId);
            Assert.Equal(HttpStatusCode.RequestEntityTooLarge, reviewResponse.StatusCode);

            using var rowLimitResponse = await SendJsonAsync(
                client,
                HttpMethod.Put,
                "/api/admin/import-limits",
                new
                {
                    maxFileSizeBytes = ImportLimits.Default.MaxFileSizeBytes,
                    maxRowsPerImport = 1,
                    maxImportAttemptsPerUserPerMinute =
                        ImportLimits.Default.MaxImportAttemptsPerUserPerMinute,
                });
            Assert.Equal(HttpStatusCode.OK, rowLimitResponse.StatusCode);

            using var rowLimitReviewResponse = await CreateReviewAsync(client, accountId);
            Assert.Equal(HttpStatusCode.RequestEntityTooLarge, rowLimitReviewResponse.StatusCode);

            using var transactionsResponse = await client.GetAsync(
                $"/api/accounts/{accountId}/transactions");
            var transactions = await transactionsResponse.Content
                .ReadFromJsonAsync<TransactionPage>();
            Assert.NotNull(transactions);
            Assert.Empty(transactions.Items);
        }
        finally
        {
            using var restoreResponse = await SendJsonAsync(
                client,
                HttpMethod.Put,
                "/api/admin/import-limits",
                ImportLimits.Default);
            Assert.Equal(HttpStatusCode.OK, restoreResponse.StatusCode);
        }
    }

    [Fact]
    [Trait("Category", "SqlServer")]
    public async Task Non_administrator_cannot_view_or_change_import_limits()
    {
        using var client = CreateClient();
        var email = await RegisterAsync(client);
        await SignInAsync(client, email);

        using var getResponse = await client.GetAsync("/api/admin/import-limits");
        Assert.Equal(HttpStatusCode.Forbidden, getResponse.StatusCode);

        using var updateResponse = await SendJsonAsync(
            client,
            HttpMethod.Put,
            "/api/admin/import-limits",
            ImportLimits.Default);
        Assert.Equal(HttpStatusCode.Forbidden, updateResponse.StatusCode);
    }

    private HttpClient CreateClient() =>
        fixture.Factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            BaseAddress = new Uri("https://localhost"),
            AllowAutoRedirect = false,
        });

    private static async Task<string> RegisterAsync(HttpClient client)
    {
        var email = $"{Guid.NewGuid():N}@example.test";
        using var response = await SendJsonAsync(
            client,
            HttpMethod.Post,
            "/api/security/register",
            new { email, password = "Test-only!Password-123" });
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return email;
    }

    private async Task GrantAdministratorRoleAsync(string email)
    {
        await using var scope = fixture.Factory.Services.CreateAsyncScope();
        var userManager = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
        var roleManager = scope.ServiceProvider.GetRequiredService<RoleManager<IdentityRole>>();
        if (!await roleManager.RoleExistsAsync(AdminBootstrapper.AdministratorRole))
        {
            var roleResult = await roleManager.CreateAsync(
                new IdentityRole(AdminBootstrapper.AdministratorRole));
            Assert.True(roleResult.Succeeded);
        }

        var user = await userManager.FindByEmailAsync(email);
        Assert.NotNull(user);
        var result = await userManager.AddToRoleAsync(user, AdminBootstrapper.AdministratorRole);
        Assert.True(result.Succeeded);
    }

    private static async Task SignInAsync(HttpClient client, string email)
    {
        using var response = await SendJsonAsync(
            client,
            HttpMethod.Post,
            "/api/security/login",
            new { email, password = "Test-only!Password-123" });
        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
    }

    private static async Task CreateFamilyAsync(HttpClient client)
    {
        using var response = await SendJsonAsync(client, HttpMethod.Post, "/api/families", null);
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
    }

    private static async Task<Guid> CreateAccountAsync(HttpClient client)
    {
        using var response = await SendJsonAsync(
            client,
            HttpMethod.Post,
            "/api/accounts",
            new { description = "Everyday account", currencyCode = "AUD" });
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var account = await response.Content.ReadFromJsonAsync<AccountResponse>();
        Assert.NotNull(account);
        return account.Id;
    }

    private static async Task<HttpResponseMessage> CreateReviewAsync(
        HttpClient client,
        Guid accountId)
    {
        using var tokenResponse = await client.GetAsync("/api/security/csrf-token");
        tokenResponse.EnsureSuccessStatusCode();
        var csrfToken = await tokenResponse.Content.ReadFromJsonAsync<CsrfTokenResponse>();
        Assert.NotNull(csrfToken);

        using var content = new MultipartFormDataContent();
        var csv = "Date,Description,Amount\n2025-01-15,Market,12.34\n2025-01-16,Meal,9.00";
        content.Add(
            new ByteArrayContent(Encoding.UTF8.GetBytes(csv)),
            "file",
            "transactions.csv");
        var mapping = new ImportMapping(
            0,
            1,
            "yyyy-MM-dd",
            ImportAmountMode.Signed,
            SignedAmountColumn: 2,
            IncomingSign: IncomingSign.Positive,
            NumberFormat: "dot-decimal-comma-grouping");
        content.Add(
            new StringContent(JsonSerializer.Serialize(
                mapping,
                new JsonSerializerOptions(JsonSerializerDefaults.Web))),
            "mapping");

        using var request = new HttpRequestMessage(
            HttpMethod.Post,
            $"/api/accounts/{accountId}/import-reviews")
        {
            Content = content,
        };
        request.Headers.Add("X-CSRF-TOKEN", csrfToken.RequestToken);
        return await client.SendAsync(request);
    }

    private static async Task<HttpResponseMessage> SendJsonAsync(
        HttpClient client,
        HttpMethod method,
        string path,
        object? content)
    {
        using var tokenResponse = await client.GetAsync("/api/security/csrf-token");
        tokenResponse.EnsureSuccessStatusCode();
        var csrfToken = await tokenResponse.Content.ReadFromJsonAsync<CsrfTokenResponse>();
        Assert.NotNull(csrfToken);

        using var request = new HttpRequestMessage(method, path)
        {
            Content = content is null ? null : JsonContent.Create(content),
        };
        request.Headers.Add("X-CSRF-TOKEN", csrfToken.RequestToken);
        return await client.SendAsync(request);
    }

    private sealed record CsrfTokenResponse(string RequestToken);

    private sealed record AccountResponse(Guid Id);

    private sealed record TransactionPage(TransactionResponse[] Items);

    private sealed record TransactionResponse(
        Guid Id,
        DateOnly TransactionDate,
        string Description,
        string Amount,
        string Direction);
}
