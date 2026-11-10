using System.Net;
using System.Net.Http.Json;
using Clutch.API.Tests.Integration.Accounts;
using Microsoft.AspNetCore.Mvc.Testing;

namespace Clutch.API.Tests.Integration.Categories;

[Collection(SqlServerCollection.Name)]
public sealed class CategoryNodeTests(SqlServerFixture fixture)
{
    [Fact]
    [Trait("Category", "SqlServer")]
    public async Task Requires_authentication()
    {
        using var client = CreateClient();
        using var response = await client.GetAsync("/api/category-nodes");
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    [Trait("Category", "SqlServer")]
    public async Task Create_orders_at_bottom_nests_and_enforces_rules()
    {
        using var client = await CreateSignedInClientAsync();

        var food = await CreateAsync(client, "Food", null);
        var home = await CreateAsync(client, "Home", null);
        var groceries = await CreateAsync(client, "Groceries", food.Id);
        await CreateAsync(client, "Produce", groceries.Id);
        var dining = await CreateAsync(client, "Dining", food.Id);
        await CreateAsync(client, "Rent", home.Id);

        var tree = await GetTreeAsync(client);
        Assert.Equal(
            ["Food", "Groceries", "Produce", "Dining", "Home", "Rent"],
            tree.Select(node => node.Name));
        Assert.Equal([0, 1, 2, 1, 0, 1], tree.Select(node => node.Depth));

        using var duplicate = await SendAsync(client, HttpMethod.Post, "/api/category-nodes", new { name = " groceries ", parentId = food.Id });
        Assert.Equal(HttpStatusCode.Conflict, duplicate.StatusCode);

        using var duplicateGroup = await SendAsync(client, HttpMethod.Post, "/api/category-nodes", new { name = "FOOD", parentId = (Guid?)null });
        Assert.Equal(HttpStatusCode.Conflict, duplicateGroup.StatusCode);

        var sameNameElsewhere = await CreateAsync(client, "Groceries", home.Id);
        Assert.Equal(home.Id, sameNameElsewhere.ParentId);

        using var blank = await SendAsync(client, HttpMethod.Post, "/api/category-nodes", new { name = "   ", parentId = food.Id });
        Assert.Equal(HttpStatusCode.BadRequest, blank.StatusCode);

        using var tooLong = await SendAsync(client, HttpMethod.Post, "/api/category-nodes", new { name = new string('a', 101), parentId = food.Id });
        Assert.Equal(HttpStatusCode.BadRequest, tooLong.StatusCode);

        using var missingParent = await SendAsync(client, HttpMethod.Post, "/api/category-nodes", new { name = "X", parentId = Guid.NewGuid() });
        Assert.Equal(HttpStatusCode.NotFound, missingParent.StatusCode);

        using var rename = await SendAsync(client, HttpMethod.Patch, $"/api/category-nodes/{dining.Id}", new { name = "Restaurants" });
        Assert.Equal(HttpStatusCode.OK, rename.StatusCode);
        using var renameConflict = await SendAsync(client, HttpMethod.Patch, $"/api/category-nodes/{dining.Id}", new { name = "groceries" });
        Assert.Equal(HttpStatusCode.Conflict, renameConflict.StatusCode);
        Assert.Equal(
            ["Food", "Groceries", "Produce", "Restaurants", "Home", "Rent", "Groceries"],
            (await GetTreeAsync(client)).Select(node => node.Name));

        using var impact = await client.GetAsync($"/api/category-nodes/{food.Id}/deletion-impact");
        var count = await impact.Content.ReadFromJsonAsync<ImpactResponse>();
        Assert.Equal(4, count!.ItemCount);

        using var delete = await SendAsync(client, HttpMethod.Delete, $"/api/category-nodes/{food.Id}", null);
        Assert.Equal(HttpStatusCode.NoContent, delete.StatusCode);
        Assert.Equal(["Home", "Rent", "Groceries"], (await GetTreeAsync(client)).Select(node => node.Name));

        var again = await CreateAsync(client, "Food", null);
        Assert.Equal("Food", (await GetTreeAsync(client)).Last().Name);
        Assert.NotEqual(food.Id, again.Id);
    }

    [Fact]
    [Trait("Category", "SqlServer")]
    public async Task Nodes_are_isolated_per_user()
    {
        using var owner = await CreateSignedInClientAsync();
        using var other = await CreateSignedInClientAsync();
        var group = await CreateAsync(owner, "Private", null);

        Assert.Empty(await GetTreeAsync(other));
        using var rename = await SendAsync(other, HttpMethod.Patch, $"/api/category-nodes/{group.Id}", new { name = "Hacked" });
        Assert.Equal(HttpStatusCode.NotFound, rename.StatusCode);
        using var delete = await SendAsync(other, HttpMethod.Delete, $"/api/category-nodes/{group.Id}", null);
        Assert.Equal(HttpStatusCode.NotFound, delete.StatusCode);
        using var child = await SendAsync(other, HttpMethod.Post, "/api/category-nodes", new { name = "Sneaky", parentId = group.Id });
        Assert.Equal(HttpStatusCode.NotFound, child.StatusCode);
        Assert.Single(await GetTreeAsync(owner));
    }

    private HttpClient CreateClient() =>
        fixture.Factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            BaseAddress = new Uri("https://localhost"),
            AllowAutoRedirect = false,
        });

    private async Task<HttpClient> CreateSignedInClientAsync()
    {
        var client = CreateClient();
        var email = $"{Guid.NewGuid():N}@example.test";
        var credentials = new { email, password = "Test-only!Password-123" };
        using var register = await SendAsync(client, HttpMethod.Post, "/api/security/register", credentials);
        Assert.Equal(HttpStatusCode.Created, register.StatusCode);
        using var login = await SendAsync(client, HttpMethod.Post, "/api/security/login", credentials);
        Assert.Equal(HttpStatusCode.NoContent, login.StatusCode);
        return client;
    }

    private static async Task<NodeResponse> CreateAsync(HttpClient client, string name, Guid? parentId)
    {
        using var response = await SendAsync(client, HttpMethod.Post, "/api/category-nodes", new { name, parentId });
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return (await response.Content.ReadFromJsonAsync<NodeResponse>())!;
    }

    private static async Task<List<NodeResponse>> GetTreeAsync(HttpClient client)
    {
        using var response = await client.GetAsync("/api/category-nodes");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return (await response.Content.ReadFromJsonAsync<List<NodeResponse>>())!;
    }

    private static async Task<HttpResponseMessage> SendAsync(
        HttpClient client,
        HttpMethod method,
        string path,
        object? content)
    {
        using var tokenResponse = await client.GetAsync("/api/security/csrf-token");
        tokenResponse.EnsureSuccessStatusCode();
        var csrfToken = await tokenResponse.Content.ReadFromJsonAsync<CsrfTokenResponse>();
        Assert.NotNull(csrfToken);

        using var request = new HttpRequestMessage(method, path);
        if (content is not null)
        {
            request.Content = JsonContent.Create(content);
        }

        request.Headers.Add("X-CSRF-TOKEN", csrfToken.RequestToken);
        return await client.SendAsync(request);
    }

    private sealed record CsrfTokenResponse(string RequestToken);

    private sealed record NodeResponse(Guid Id, Guid? ParentId, string Name, int Depth);

    private sealed record ImpactResponse(int ItemCount);
}
