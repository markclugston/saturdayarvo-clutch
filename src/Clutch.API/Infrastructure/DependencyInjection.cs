using Clutch.API.Application.Accounts;
using Clutch.API.Application.Categories;
using Clutch.API.Application.Imports;
using Clutch.API.Application.Preferences;
using Clutch.API.Application.Transactions;
using Clutch.API.Infrastructure.Identity;
using Clutch.API.Infrastructure.Imports;
using Clutch.API.Infrastructure.Persistence;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace Clutch.API.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        var connectionString = configuration.GetConnectionString("Clutch");
        if (string.IsNullOrWhiteSpace(connectionString))
        {
            throw new InvalidOperationException(
                "A database connection string must be provided using protected configuration.");
        }

        services.AddDbContext<AppDbContext>(options =>
            options.UseSqlServer(connectionString, sqlOptions => sqlOptions.EnableRetryOnFailure()));
        services.AddHealthChecks().AddCheck<DatabaseHealthCheck>("database", tags: ["ready"]);
        services.AddSingleton(TimeProvider.System);

        services.AddIdentityCore<ApplicationUser>(options =>
            {
                options.User.RequireUniqueEmail = true;
                options.Password.RequiredLength = 12;
                options.Password.RequireDigit = true;
                options.Password.RequireLowercase = true;
                options.Password.RequireUppercase = true;
                options.Password.RequireNonAlphanumeric = true;
                options.Lockout.MaxFailedAccessAttempts = 5;
                options.Lockout.DefaultLockoutTimeSpan = TimeSpan.FromMinutes(15);
                options.Lockout.AllowedForNewUsers = true;
            })
            .AddRoles<IdentityRole>()
            .AddEntityFrameworkStores<AppDbContext>()
            .AddSignInManager()
            .AddDefaultTokenProviders();

        services
            .AddAuthentication(options =>
            {
                options.DefaultAuthenticateScheme = IdentityConstants.ApplicationScheme;
                options.DefaultChallengeScheme = IdentityConstants.ApplicationScheme;
                options.DefaultSignInScheme = IdentityConstants.ApplicationScheme;
            })
            .AddIdentityCookies();

        services.ConfigureApplicationCookie(options =>
        {
            options.Cookie.HttpOnly = true;
            options.Cookie.SecurePolicy = CookieSecurePolicy.Always;
            options.Cookie.SameSite = SameSiteMode.Lax;
            options.ExpireTimeSpan = TimeSpan.FromHours(8);
            options.SlidingExpiration = true;
            options.Events.OnRedirectToLogin = context =>
            {
                context.Response.StatusCode = StatusCodes.Status401Unauthorized;
                return Task.CompletedTask;
            };
            options.Events.OnRedirectToAccessDenied = context =>
            {
                context.Response.StatusCode = StatusCodes.Status403Forbidden;
                return Task.CompletedTask;
            };
        });

        services.AddAuthorization();
        services.AddScoped<AdminBootstrapper>();
        services.AddScoped<AccountService>();
        services.AddScoped<CategoryNodeService>();
        services.AddScoped<CsvImportParser>();
        services.AddScoped<AccountImportLease>();
        services.AddScoped<ImportAuditWriter>();
        services.AddScoped<ImportReviewService>();
        services.AddScoped<ConfirmImportService>();
        services.AddScoped<AccountImportSettingsService>();
        services.AddScoped<ImportLimitSettingsService>();
        services.AddScoped<ThemePreferenceService>();
        services.AddScoped<TransactionService>();
        services.AddScoped<IImportAttemptLimiter, ImportAttemptLimiter>();
        services.AddHostedService<ImportReviewCleanupService>();
        return services;
    }
}
