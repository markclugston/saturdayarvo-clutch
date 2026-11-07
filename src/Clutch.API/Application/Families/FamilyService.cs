using Clutch.API.Api.ProblemDetails;
using Clutch.API.Domain.Families;
using Clutch.API.Infrastructure.Persistence;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;

namespace Clutch.API.Application.Families;

public sealed class FamilyService(AppDbContext dbContext)
{
    public Task<Family?> GetOwnedAsync(string ownerUserId, CancellationToken cancellationToken) =>
        dbContext.Families
            .AsNoTracking()
            .SingleOrDefaultAsync(family => family.OwnerUserId == ownerUserId, cancellationToken);

    public async Task<Family> CreateAsync(string ownerUserId, CancellationToken cancellationToken)
    {
        if (await dbContext.Families.AnyAsync(
                family => family.OwnerUserId == ownerUserId,
                cancellationToken))
        {
            throw FamilyAlreadyExists();
        }

        var family = new Family(ownerUserId);
        dbContext.Families.Add(family);
        try
        {
            await dbContext.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException exception) when (IsOwnerUniquenessViolation(exception))
        {
            throw FamilyAlreadyExists();
        }

        return family;
    }

    private static bool IsOwnerUniquenessViolation(DbUpdateException exception) =>
        exception.InnerException is SqlException { Number: 2601 or 2627 };

    private static ApiProblemException FamilyAlreadyExists() =>
        new(
            StatusCodes.Status409Conflict,
            "A Family already exists for this user.",
            "Each user can create one Family.");
}
