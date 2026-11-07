namespace Clutch.API.Infrastructure.Persistence.Entities;

public sealed class ImportReviewMappingSnapshot
{
    private ImportReviewMappingSnapshot()
    {
    }

    private ImportReviewMappingSnapshot(Guid reviewId, int schemaVersion, string mappingJson)
    {
        ReviewId = reviewId;
        SchemaVersion = schemaVersion;
        MappingJson = mappingJson;
    }

    public Guid ReviewId { get; private set; }

    public int SchemaVersion { get; private set; }

    public string MappingJson { get; private set; } = string.Empty;

    public static ImportReviewMappingSnapshot Create(
        Guid reviewId,
        int schemaVersion,
        string mappingJson) =>
        new(reviewId, schemaVersion, mappingJson);
}
