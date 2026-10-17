namespace Hatch.Api.Modules.Hatch;

/// <summary>
/// A range of time as a caller types it, read once for every read that takes
/// one - so "the last N days ending now" is a single definition rather than a
/// copy per controller.
/// </summary>
/// <remarks>
/// Bounds are parsed with <see cref="IssueMoment.TryParse"/>, so a value written
/// without an offset is read as UTC and a bare date is that day's midnight UTC.
/// </remarks>
public static class RangeBounds
{
    /// <summary>A bound as it was typed, or the default when nothing was.</summary>
    public static bool TryBound(string? text, DateTimeOffset fallback, out DateTimeOffset at)
    {
        if (string.IsNullOrWhiteSpace(text))
        {
            at = fallback;
            return true;
        }

        var parsed = IssueMoment.TryParse(text, out var moment);
        at = parsed ? moment.At : default;
        return parsed;
    }

    /// <summary>In the house's own words, rather than as a framework 400.</summary>
    public static string NotAnInstant(string? text) =>
        $"a range bound is an instant (2026-09-12T17:00:00Z) - not \"{text}\"";

    /// <summary>
    /// The range a caller asked for, or the sentence refusing it: <c>null</c>
    /// when <paramref name="start"/> and <paramref name="end"/> are good.
    /// </summary>
    /// <remarks>
    /// The order matters - <c>to</c> (default <paramref name="now"/>), then
    /// <c>from</c> (default <paramref name="defaultRange"/> before the end), then
    /// the inversion - so a request that is wrong twice comes back with the
    /// sentence it always did.
    /// </remarks>
    public static string? Resolve(
        string? from, string? to, DateTimeOffset now, TimeSpan defaultRange,
        out DateTimeOffset start, out DateTimeOffset end)
    {
        start = default;
        if (!TryBound(to, now, out end)) return NotAnInstant(to);
        if (!TryBound(from, end - defaultRange, out start)) return NotAnInstant(from);

        // Equal is legal - one bucket next door, an empty list here. Inverted is
        // not a range at all.
        return start > end ? "a range ends before it begins" : null;
    }
}
