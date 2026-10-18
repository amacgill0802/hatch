namespace Hatch.Cli.Tests;

/// <summary>
/// Numbers as somebody reads them off a terminal.
/// </summary>
public sealed class FormatTests
{
    [Fact]
    public void Spent_SaysUnpricedForNull_AndNeverReadsACheapSessionAsFree()
    {
        Assert.Equal("unpriced", Format.Spent(null));
        Assert.Equal("$1.5", Format.Spent(1.5m));
        Assert.Equal("$0.0012", Format.Spent(0.0012m));
    }
}
