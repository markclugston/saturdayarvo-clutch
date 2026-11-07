using Microsoft.AspNetCore.Identity;

namespace Clutch.API.Infrastructure.Identity;

public sealed class AdminBootstrapper(
    IConfiguration configuration,
    UserManager<ApplicationUser> userManager,
    RoleManager<IdentityRole> roleManager)
{
    public const string AdministratorRole = "Administrator";

    public async Task ProvisionAsync(CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();

        var email = configuration["AdminBootstrap:Email"];
        var password = configuration["AdminBootstrap:Password"];
        if (string.IsNullOrWhiteSpace(email) && string.IsNullOrWhiteSpace(password))
        {
            return;
        }

        if (string.IsNullOrWhiteSpace(email) || string.IsNullOrWhiteSpace(password))
        {
            throw new InvalidOperationException(
                "Both protected administrator bootstrap settings must be provided.");
        }

        if (!await roleManager.RoleExistsAsync(AdministratorRole))
        {
            var roleResult = await roleManager.CreateAsync(new IdentityRole(AdministratorRole));
            if (!roleResult.Succeeded)
            {
                throw new InvalidOperationException("Administrator role provisioning failed.");
            }
        }

        var user = await userManager.FindByEmailAsync(email);
        if (user is null)
        {
            user = new ApplicationUser
            {
                UserName = email,
                Email = email,
                EmailConfirmed = true,
            };
            var createResult = await userManager.CreateAsync(user, password);
            if (!createResult.Succeeded)
            {
                throw new InvalidOperationException("Administrator account provisioning failed.");
            }
        }

        if (!await userManager.IsInRoleAsync(user, AdministratorRole))
        {
            var addRoleResult = await userManager.AddToRoleAsync(user, AdministratorRole);
            if (!addRoleResult.Succeeded)
            {
                throw new InvalidOperationException("Administrator role assignment failed.");
            }
        }
    }
}
