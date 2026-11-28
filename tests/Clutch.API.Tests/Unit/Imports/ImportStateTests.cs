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

    [Fact]
    public void Review_row_is_included_unless_it_is_constructed_as_excluded()
    {
        var reviewId = Guid.NewGuid();

        Assert.False(Row(reviewId, 2).IsExcluded);
        Assert.True(Row(reviewId, 3, isExcluded: true).IsExcluded);
    }

    [Fact]
    public void Excluded_row_cannot_be_constructed_as_a_possible_duplicate()
    {
        Assert.Throws<ArgumentException>(
            () => Row(Guid.NewGuid(), 2, isPossibleDuplicate: true, isExcluded: true));
    }

    [Fact]
    public void Excluded_row_is_never_marked_as_a_possible_duplicate()
    {
        var row = Row(Guid.NewGuid(), 2, isExcluded: true);

        row.MarkPossibleDuplicate();

        Assert.False(row.IsPossibleDuplicate);
        Assert.True(row.IsExcluded);
    }

    [Fact]
    public void Duplicate_confirmation_ignores_excluded_rows()
    {
        var review = NewReview();
        review.AddRows([Row(review.Id, 2), Row(review.Id, 3, isExcluded: true)]);

        review.UpdateDuplicateWarnings(new HashSet<int> { 3 });

        Assert.False(review.DuplicateConfirmationRequired);

        review.UpdateDuplicateWarnings(new HashSet<int> { 2, 3 });

        Assert.True(review.DuplicateConfirmationRequired);
        Assert.Equal(
            [2],
            review.Rows.Where(row => row.IsPossibleDuplicate).Select(row => row.SourceRowNumber));
    }

    [Fact]
    public void Review_of_only_excluded_rows_can_be_claimed_for_confirmation()
    {
        var review = NewReview();
        review.AddRows([Row(review.Id, 2, isExcluded: true)]);

        Assert.False(review.DuplicateConfirmationRequired);
        Assert.True(review.TryClaimProcessing(Guid.NewGuid(), DateTimeOffset.UtcNow));
    }

    private static ImportReview CreateReview()
    {
        var review = NewReview();
        review.AddRows([Row(review.Id, 2)]);
        return review;
    }

    private static ImportReview NewReview() =>
        new(
            Guid.NewGuid(),
            Guid.NewGuid(),
            "owner",
            DateTimeOffset.UtcNow,
            DateTimeOffset.UtcNow.AddMinutes(5),
            1,
            """{"dateColumn":0}""");

    private static ImportReviewRow Row(
        Guid reviewId,
        int sourceRowNumber,
        bool isPossibleDuplicate = false,
        bool isExcluded = false) =>
        new(
            reviewId,
            sourceRowNumber,
            new DateOnly(2025, 1, 1),
            "Market",
            12.34m,
            TransactionDirection.Incoming,
            isPossibleDuplicate,
            isExcluded: isExcluded);
}
