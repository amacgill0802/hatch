using Hatch.Api.Modules.Hatch;

namespace Hatch.Api.Tests.Hatch;

/// <summary>
/// The range both the work log and the reports read: blank bounds are "the
/// last so many days ending now", and the refusals come in a fixed order.
/// </summary>
public class RangeBoundsTests
{
    private static readonly DateTimeOffset Now = new(2026, 9, 12, 17, 0, 0, TimeSpan.Zero);
    private static readonly TimeSpan Fortnight = TimeSpan.FromDays(14);

    [Theory]
    [InlineData(null, null)]
    [InlineData("", "  ")]
    public void BlankBounds_AreNowAndTheDefaultRangeBeforeIt(string? from, string? to)
    {
        var refusal = RangeBounds.Resolve(from, to, Now, Fortnight, out var start, out var end);

        Assert.Null(refusal);
        Assert.Equal(Now, end);
        Assert.Equal(Now - Fortnight, start);
    }

    [Fact]
    public void ADateOnlyBound_IsMidnightUtc_AndAnInstantKeepsItsTime()
    {
        var refusal = RangeBounds.Resolve(
            "2026-09-01", "2026-09-05T13:30:00Z", Now, Fortnight, out var start, out var end);

        Assert.Null(refusal);
        Assert.Equal(new DateTimeOffset(2026, 9, 1, 0, 0, 0, TimeSpan.Zero), start);
        Assert.Equal(new DateTimeOffset(2026, 9, 5, 13, 30, 0, TimeSpan.Zero), end);
    }

    [Fact]
    public void AnUnparseableTo_IsRefusedBeforeFromIsLookedAt()
    {
        var refusal = RangeBounds.Resolve("also-not-one", "yesterday", Now, Fortnight, out _, out _);

        Assert.Equal(RangeBounds.NotAnInstant("yesterday"), refusal);
        Assert.Contains("\"yesterday\"", refusal);
    }

    [Fact]
    public void AnUnparseableFrom_IsRefusedByName()
    {
        var refusal = RangeBounds.Resolve("last week", "2026-09-05", Now, Fortnight, out _, out _);

        Assert.Equal(RangeBounds.NotAnInstant("last week"), refusal);
    }

    [Fact]
    public void AnInvertedRange_IsRefused()
    {
        var refusal = RangeBounds.Resolve("2026-09-05", "2026-09-01", Now, Fortnight, out _, out _);

        Assert.Equal("a range ends before it begins", refusal);
    }

    [Fact]
    public void AnEqualRange_IsLegal()
    {
        var refusal = RangeBounds.Resolve("2026-09-05", "2026-09-05", Now, Fortnight, out var start, out var end);

        Assert.Null(refusal);
        Assert.Equal(start, end);
    }
}
