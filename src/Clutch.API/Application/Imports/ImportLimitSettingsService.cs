using Clutch.API.Api.ProblemDetails;
using Clutch.API.Domain.Imports;
using Clutch.API.Infrastructure.Persistence;
using Clutch.API.Infrastructure.Persistence.Entities;
using Microsoft.EntityFrameworkCore;

namespace Clutch.API.Application.Imports;

public sealed class ImportLimitSettingsService(
    AppDbContext dbContext,
    TimeProvider timeProvider)
{
    public async Task<ImportLimits> GetAsync(CancellationToken cancellationToken) =>
        await dbContext.ImportLimitSettings
            .AsNoTracking()
            .Select(settings => new ImportLimits(
                settings.MaxFileSizeBytes,
                settings.MaxRowsPerImport,
                settings.MaxImportAttemptsPerUserPerMinute))
            .SingleOrDefaultAsync(cancellationToken) ?? ImportLimits.Default;

    public async Task<ImportLimits> UpdateAsync(
        ImportLimits limits,
        string administratorUserId,
        CancellationToken cancellationToken)
    {
        var errors = limits.Validate();
        if (errors.Count > 0)
        {
            throw new ApiProblemException(
                StatusCodes.Status400BadRequest,
                "The import limits are invalid.",
                "Provide positive values for all import limits.",
                errors);
        }

        var settings = await dbContext.ImportLimitSettings
            .SingleOrDefaultAsync(candidate => candidate.Id == 1, cancellationToken);
        if (settings is null)
        {
            settings = ImportLimitSettings.Create(
                limits,
                administratorUserId,
                timeProvider.GetUtcNow());
            dbContext.ImportLimitSettings.Add(settings);
        }
        else
        {
            settings.Update(limits, administratorUserId, timeProvider.GetUtcNow());
        }

        await dbContext.SaveChangesAsync(cancellationToken);
        return settings.ToDomain();
    }
}
