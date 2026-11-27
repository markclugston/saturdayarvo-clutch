using Clutch.API.Api.ProblemDetails;

namespace Clutch.API.Application.Assets;

internal static class AssetProblems
{
    public const string EditActiveCode = "AssetEditActive";
    public const string EditActiveTitle = "This asset is being edited in another session.";

    public static ApiProblemException Invalid(IReadOnlyDictionary<string, string> errors) =>
        new(
            StatusCodes.Status400BadRequest,
            "The asset is invalid.",
            "Correct the highlighted fields and try again.",
            errors.ToDictionary(pair => pair.Key, pair => new[] { pair.Value }));

    // A foreign asset or edit looks exactly like an unknown one (SEC-001).
    public static ApiProblemException NotFound() =>
        Coded(
            StatusCodes.Status404NotFound,
            "Asset not found.",
            "The asset does not exist or is not available to this user.",
            "AssetNotFound");

    public static ApiProblemException EditNotFound() =>
        new(
            StatusCodes.Status404NotFound,
            "Asset edit not found.",
            "The asset edit does not exist or is not available to this user.");

    public static ApiProblemException EditEnded() =>
        Coded(
            StatusCodes.Status409Conflict,
            "The edit was ended elsewhere.",
            "Return to the assets list before continuing.",
            "AssetEditEnded");

    public static ApiProblemException EditExpired() =>
        Coded(
            StatusCodes.Status409Conflict,
            "The edit expired.",
            "Open the asset again to continue.",
            "AssetEditExpired");

    public static ApiProblemException EditChanged() =>
        Coded(
            StatusCodes.Status409Conflict,
            "The edit has changed.",
            "Recheck the asset edit status before continuing.",
            "AssetEditChanged");

    public static ApiProblemException DeleteBlocked() =>
        Coded(
            StatusCodes.Status409Conflict,
            EditActiveTitle,
            "End the other edit or wait for it to finish before deleting the asset.",
            EditActiveCode);

    public static ApiProblemException TargetRequired() =>
        Coded(
            StatusCodes.Status400BadRequest,
            "An asset edit target is required.",
            "Provide the exact edit ID returned by edit status.",
            "AssetEditTargetRequired");

    public static ApiProblemException StatusUnavailable() =>
        Coded(
            StatusCodes.Status500InternalServerError,
            "Edit status is unavailable.",
            "The current edit status could not be established.",
            "AssetEditStatusUnavailable");

    private static ApiProblemException Coded(int status, string title, string detail, string code) =>
        new(status, title, detail, new Dictionary<string, string[]> { ["code"] = [code] });
}
