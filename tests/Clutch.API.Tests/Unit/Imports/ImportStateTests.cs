using Clutch.API.Domain.Imports;
using Clutch.API.Domain.Transactions;

namespace Clutch.API.Tests.Unit.Imports;

public sealed class ImportStateTests
{
    [Fact]
    public void Processing_claim_protects_staged_rows_until_the_attempt_is_rejected()
    {
        var review = CreateReview();
        var attemptId = Guid.NewGuid();
        var startedAt = DateTimeOffset.UtcNow;

        Assert.True(review.TryClaimProcessing(attemptId, startedAt));

        Assert.Equal(ImportReviewState.Processing, review.State);
        Assert.Equal(attemptId, review.ConfirmationAttemptId);
        Assert.Equal(startedAt, review.ProcessingStartedAtUtc);
        Assert.Single(review.Rows);
        Assert.False(review.TryTransition(ImportReviewState.Cancelled));
        Assert.False(review.TryEndElsewhere("owner", startedAt));

        Assert.True(review.TryRejectProcessing(attemptId, new HashSet<int> { 2 }));

        Assert.Equal(ImportReviewState.Ready, review.State);
        Assert.Null(review.ConfirmationAttemptId);
        Assert.Null(review.ProcessingStartedAtUtc);
        Assert.Single(review.Rows);
        Assert.True(review.Rows.Single().IsPossibleDuplicate);
    }

    [Fact]
    public void Ending_ready_review_retains_actor_and_time_but_removes_staging()
    {
        var review = CreateReview();
        var endedAt = DateTimeOffset.UtcNow;

        Assert.True(review.TryEndElsewhere("owner-id", endedAt));

        Assert.Equal(ImportReviewState.Cancelled, review.State);
        Assert.Equal("owner-id", review.EndedByUserId);
        Assert.Equal(endedAt, review.EndedAtUtc);
        Assert.Empty(review.Rows);
        Assert.Null(review.SchemaVersion);
        Assert.Null(review.MappingJson);
        Assert.Null(review.ConfirmationAttemptId);
        Assert.Null(review.ProcessingStartedAtUtc);
        Assert.False(review.TryEndElsewhere("another-owner", endedAt.AddSeconds(1)));
        Assert.False(review.TryClaimProcessing(Guid.NewGuid(), endedAt.AddSeconds(1)));
    }

    [Fact]
    public void Processing_attempt_cannot_be_rejected_by_a_different_attempt()
    {
        var review = CreateReview();
        var attemptId = Guid.NewGuid();

        Assert.True(review.TryClaimProcessing(attemptId, DateTimeOffset.UtcNow));
        Assert.False(review.TryRejectProcessing(Guid.NewGuid(), new HashSet<int>()));

        Assert.Equal(ImportReviewState.Processing, review.State);
        Assert.Equal(attemptId, review.ConfirmationAttemptId);
        Assert.Single(review.Rows);
    }

    private static ImportReview CreateReview()
    {
        var review = new ImportReview(
            Guid.NewGuid(),
            Guid.NewGuid(),
            "owner",
            DateTimeOffset.UtcNow,
            DateTimeOffset.UtcNow.AddMinutes(5),
            1,
            """{"dateColumn":0}""");
        review.AddRows(
        [
            new ImportReviewRow(
                review.Id,
                2,
                new DateOnly(2025, 1, 1),
                "Market",
                12.34m,
                TransactionDirection.Incoming,
                false),
        ]);
        return review;
    }
}
