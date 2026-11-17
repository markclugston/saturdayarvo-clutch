using Clutch.API.Domain.Accounts;
using Clutch.API.Domain.Audit;
using Clutch.API.Domain.Categories;
using Clutch.API.Domain.Imports;
using Clutch.API.Domain.Preferences;
using Clutch.API.Domain.Transactions;
using Clutch.API.Infrastructure.Identity;
using Clutch.API.Infrastructure.Persistence.Entities;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;

namespace Clutch.API.Infrastructure.Persistence;

public sealed class AppDbContext(DbContextOptions<AppDbContext> options)
    : IdentityDbContext<ApplicationUser>(options)
{
    public DbSet<Account> Accounts => Set<Account>();
    public DbSet<CategoryNode> CategoryNodes => Set<CategoryNode>();

    public DbSet<ImportLimitSettings> ImportLimitSettings => Set<ImportLimitSettings>();

    public DbSet<AccountImportSettings> AccountImportSettings => Set<AccountImportSettings>();

    public DbSet<ImportRateWindow> ImportRateWindows => Set<ImportRateWindow>();

    public DbSet<Transaction> Transactions => Set<Transaction>();

    public DbSet<Audit> Audits => Set<Audit>();

    public DbSet<ImportReview> ImportReviews => Set<ImportReview>();

    public DbSet<ImportReviewRow> ImportReviewRows => Set<ImportReviewRow>();

    public DbSet<UserThemePreference> UserThemePreferences => Set<UserThemePreference>();

    protected override void OnModelCreating(ModelBuilder builder)
    {
        base.OnModelCreating(builder);

        builder.Entity<Account>(entity =>
        {
            entity.ToTable("Accounts", table =>
            {
                table.HasCheckConstraint(
                    "CK_Accounts_NonBlankDescription",
                    "LEN(LTRIM(RTRIM([Description]))) > 0");
                table.HasCheckConstraint(
                    "CK_Accounts_SupportedCurrency",
                    "[CurrencyCode] IN ('AUD', 'CAD', 'EUR', 'GBP', 'HKD', 'INR', 'JPY', 'NZD', 'SGD', 'USD')");
            });
            entity.HasKey(account => account.Id);
            entity.Property(account => account.Description)
                .HasMaxLength(AccountDescriptionValidator.MaximumLength)
                .IsRequired();
            entity.Property(account => account.CurrencyCode)
                .HasMaxLength(3)
                .IsUnicode(false)
                .IsRequired();
            entity.Property(account => account.LastSuccessfulImportAtUtc)
                .HasColumnType("datetimeoffset");
            entity.Property(account => account.ActiveImportId);
            entity.Property(account => account.OwnerUserId)
                .HasMaxLength(450);
            entity.HasIndex(account => account.OwnerUserId);
            entity.HasIndex(account => account.ActiveImportId)
                .IsUnique()
                .HasFilter("[ActiveImportId] IS NOT NULL");
            entity.HasOne<ApplicationUser>()
                .WithMany()
                .HasForeignKey(account => account.OwnerUserId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        builder.Entity<CategoryNode>(entity =>
        {
            entity.ToTable("CategoryNodes", table =>
                table.HasCheckConstraint(
                    "CK_CategoryNodes_NonBlankName",
                    "LEN(LTRIM(RTRIM([Name]))) > 0"));
            entity.HasKey(node => node.Id);
            entity.Property(node => node.OwnerUserId)
                .HasMaxLength(450)
                .IsRequired();
            entity.Property(node => node.Name)
                .HasMaxLength(CategoryNameValidator.MaximumLength)
                .IsRequired();
            entity.Property(node => node.Position);
            entity.Ignore(node => node.IsGroup);
            entity.HasOne<ApplicationUser>()
                .WithMany()
                .HasForeignKey(node => node.OwnerUserId)
                .OnDelete(DeleteBehavior.Restrict);
            entity.HasOne<CategoryNode>()
                .WithMany()
                .HasForeignKey(node => node.ParentId)
                .OnDelete(DeleteBehavior.NoAction);
            entity.HasIndex(node => new { node.OwnerUserId, node.ParentId });
            entity.HasIndex(node => new { node.OwnerUserId, node.ParentId, node.Name })
                            .IsUnique()
                            .HasFilter(null);
                        entity.HasIndex(node => new { node.OwnerUserId, node.ParentId, node.Position })
                            .IsUnique()
                            .HasFilter(null);
        });

        builder.Entity<ImportLimitSettings>(entity =>
        {
            entity.ToTable(table =>
            {
                table.HasCheckConstraint("CK_ImportLimitSettings_SingletonId", "[Id] = 1");
                table.HasCheckConstraint(
                    "CK_ImportLimitSettings_PositiveValues",
                    "[MaxFileSizeBytes] > 0 AND [MaxRowsPerImport] > 0 AND [MaxImportAttemptsPerUserPerMinute] > 0");
            });
            entity.HasKey(settings => settings.Id);
            entity.Property(settings => settings.Id).ValueGeneratedNever();
            entity.Property(settings => settings.UpdatedByUserId)
                .HasMaxLength(450)
                .IsRequired();
            entity.Property(settings => settings.UpdatedAtUtc).IsRequired();
        });

        builder.Entity<AccountImportSettings>(entity =>
        {
            entity.ToTable("AccountImportSettings", table =>
                table.HasCheckConstraint(
                    "CK_AccountImportSettings_SchemaVersion",
                    "[SchemaVersion] > 0"));
            entity.HasKey(settings => settings.AccountId);
            entity.Property(settings => settings.SchemaVersion).IsRequired();
            entity.Property(settings => settings.SettingsJson).IsRequired();
            entity.Property(settings => settings.SavedAtUtc)
                .HasColumnType("datetimeoffset")
                .IsRequired();
            entity.HasOne<Account>()
                .WithOne()
                .HasForeignKey<AccountImportSettings>(settings => settings.AccountId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        builder.Entity<ImportRateWindow>(entity =>
        {
            entity.ToTable(table => table.HasCheckConstraint(
                "CK_ImportRateWindows_PositiveAttemptCount",
                "[AttemptCount] > 0"));
            entity.HasKey(window => new { window.UserId, window.WindowStartedAtUtc });
            entity.Property(window => window.UserId)
                .HasMaxLength(450)
                .IsRequired();
            entity.Property(window => window.WindowStartedAtUtc)
                .HasColumnType("datetimeoffset")
                .IsRequired();
            entity.HasIndex(window => window.WindowStartedAtUtc);
            entity.HasOne<ApplicationUser>()
                .WithMany()
                .HasForeignKey(window => window.UserId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        builder.Entity<UserThemePreference>(entity =>
        {
            entity.ToTable("UserThemePreferences", table => table.HasCheckConstraint(
                "CK_UserThemePreferences_Mode",
                "[Mode] IN ('Light', 'Dark', 'System')"));
            entity.HasKey(preference => preference.UserId);
            entity.Property(preference => preference.UserId)
                .HasMaxLength(450)
                .IsRequired();
            entity.Property(preference => preference.Mode)
                .HasConversion<string>()
                .HasMaxLength(16)
                .IsUnicode(false)
                .IsRequired();
            entity.Property(preference => preference.UpdatedAtUtc)
                .HasColumnType("datetimeoffset")
                .IsRequired();
            entity.HasOne<ApplicationUser>()
                .WithMany()
                .HasForeignKey(preference => preference.UserId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        builder.Entity<Transaction>(entity =>
        {
            entity.ToTable("Transactions", table =>
            {
                table.HasCheckConstraint(
                    "CK_Transactions_NonNegativeAmount",
                    "[Amount] >= 0");
                table.HasCheckConstraint(
                    "CK_Transactions_ValidDirection",
                    "[Direction] IN ('Incoming', 'Outgoing')");
                table.HasCheckConstraint(
                    "CK_Transactions_NonBlankDescription",
                    "LEN(LTRIM(RTRIM([Description]))) > 0");
            });
            entity.HasKey(transaction => transaction.Id);
            entity.Property(transaction => transaction.TransactionDate)
                .HasColumnType("date");
            entity.Property(transaction => transaction.Description)
                .HasMaxLength(AccountDescriptionValidator.MaximumLength)
                .IsRequired();
            entity.Property(transaction => transaction.Amount)
                .HasPrecision(19, 4);
            entity.Property(transaction => transaction.Balance)
                .HasPrecision(19, 4);
            entity.Property(transaction => transaction.Direction)
                .HasConversion<string>()
                .HasMaxLength(16)
                .IsUnicode(false)
                .IsRequired();
            entity.Property(transaction => transaction.CreatedAtUtc)
                .HasColumnType("datetimeoffset");
            entity.HasIndex(transaction => new
            {
                transaction.AccountId,
                transaction.TransactionDate,
            });
            entity.HasOne<Account>()
                .WithMany()
                .HasForeignKey(transaction => transaction.AccountId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        builder.Entity<ImportReview>(entity =>
        {
            entity.ToTable("ImportReviews", table =>
            {
                table.HasCheckConstraint(
                    "CK_ImportReviews_ValidState",
                    "[State] IN ('Ready', 'Processing', 'Confirmed', 'Cancelled', 'Expired')");
                table.HasCheckConstraint(
                    "CK_ImportReviews_Mapping",
                    "([SchemaVersion] IS NULL AND [MappingJson] IS NULL) OR ([SchemaVersion] IS NOT NULL AND [SchemaVersion] > 0 AND [MappingJson] IS NOT NULL)");
                table.HasCheckConstraint(
                    "CK_ImportReviews_ProcessingMetadata",
                    "(([State] = 'Processing' AND [ConfirmationAttemptId] IS NOT NULL AND [ProcessingStartedAtUtc] IS NOT NULL AND [EndedByUserId] IS NULL AND [EndedAtUtc] IS NULL) OR ([State] <> 'Processing' AND [ConfirmationAttemptId] IS NULL AND [ProcessingStartedAtUtc] IS NULL))");
                table.HasCheckConstraint(
                    "CK_ImportReviews_EndedMetadata",
                    "(([EndedByUserId] IS NULL AND [EndedAtUtc] IS NULL) OR ([State] = 'Cancelled' AND [EndedByUserId] IS NOT NULL AND LEN(LTRIM(RTRIM([EndedByUserId]))) > 0 AND [EndedAtUtc] IS NOT NULL AND [ConfirmationAttemptId] IS NULL AND [ProcessingStartedAtUtc] IS NULL))");
            });
            entity.Property(review => review.MappingJson);
            entity.HasKey(review => review.Id);
            entity.Property(review => review.ActingUserId)
                .HasMaxLength(450)
                .IsRequired();
            entity.Property(review => review.ConfirmationAttemptId);
            entity.Property(review => review.ProcessingStartedAtUtc)
                .HasColumnType("datetimeoffset");
            entity.Property(review => review.EndedByUserId)
                .HasMaxLength(450);
            entity.Property(review => review.EndedAtUtc)
                .HasColumnType("datetimeoffset");
            entity.Property(review => review.State)
                .HasConversion<string>()
                .HasMaxLength(16)
                .IsUnicode(false)
                .IsRequired();
            entity.HasIndex(review => new { review.AccountId, review.State });
            entity.HasIndex(review => review.ExpiresAtUtc);
            entity.HasIndex(review => new { review.ProcessingStartedAtUtc, review.Id })
                .HasFilter("[State] = 'Processing'");
            entity.HasOne<Account>()
                .WithMany()
                .HasForeignKey(review => review.AccountId)
                .OnDelete(DeleteBehavior.Restrict);
            entity.HasMany(review => review.Rows)
                .WithOne()
                .HasForeignKey(row => row.ReviewId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        builder.Entity<ImportReviewRow>(entity =>
        {
            entity.ToTable("ImportReviewRows", table =>
            {
                table.HasCheckConstraint(
                    "CK_ImportReviewRows_NonNegativeAmount",
                    "[Amount] >= 0");
                table.HasCheckConstraint(
                    "CK_ImportReviewRows_ValidDirection",
                    "[Direction] IN ('Incoming', 'Outgoing')");
                table.HasCheckConstraint(
                    "CK_ImportReviewRows_NonBlankDescription",
                    "LEN(LTRIM(RTRIM([Description]))) > 0");
            });
            entity.HasKey(row => new { row.ReviewId, row.SourceRowNumber });
            entity.Property(row => row.Description)
                .HasMaxLength(AccountDescriptionValidator.MaximumLength)
                .IsRequired();
            entity.Property(row => row.Amount)
                .HasPrecision(19, 4);
            entity.Property(row => row.Balance)
                .HasPrecision(19, 4);
            entity.Property(row => row.Direction)
                .HasConversion<string>()
                .HasMaxLength(16)
                .IsUnicode(false)
                .IsRequired();
            entity.Property(row => row.TransactionDate)
                .HasColumnType("date");
        });

        builder.Entity<Audit>(entity =>
        {
            entity.ToTable("Audit", table =>
            {
                table.HasCheckConstraint(
                    "CK_Audit_NonBlankEventCode",
                    "LEN(LTRIM(RTRIM([EventCode]))) > 0");
                table.HasCheckConstraint(
                    "CK_Audit_NonBlankDescription",
                    "LEN(LTRIM(RTRIM([Description]))) > 0");
            });
            entity.HasKey(audit => audit.Id);
            entity.Property(audit => audit.ActingUserId)
                .HasMaxLength(450)
                .IsRequired();
            entity.Property(audit => audit.EventCode)
                .HasMaxLength(50)
                .IsUnicode(false)
                .IsRequired();
            entity.Property(audit => audit.Description)
                .HasMaxLength(500)
                .IsRequired();
            entity.Property(audit => audit.OccurredAtUtc)
                .HasColumnType("datetimeoffset");
            entity.HasIndex(audit => audit.OccurredAtUtc);
        });
    }
}
