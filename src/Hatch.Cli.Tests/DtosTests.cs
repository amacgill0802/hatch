using System.Text.Json;

namespace Hatch.Cli.Tests;

/// <summary>
/// <see cref="HatchClient.Json"/>'s own round trip for the two fields HA-808
/// adds - <see cref="PlaybookDto.Source"/> and <see cref="WorkDto.PlaybookFile"/> -
/// since a type a server might send is also one the CLI's trimmed, source-generated
/// resolver has to actually know about (<c>HatchJson</c>), not just compile against.
/// </summary>
public sealed class DtosTests
{
    [Fact]
    public void PlaybookDto_round_trips_through_HatchClient_Json_with_its_source()
    {
        var playbook = Fixtures.Playbook() with { Source = "file" };

        var json = JsonSerializer.Serialize(playbook, HatchClient.Json);
        var back = JsonSerializer.Deserialize<PlaybookDto>(json, HatchClient.Json);

        Assert.NotNull(back);
        Assert.Equal("file", back.Source);
    }

    [Fact]
    public void WorkDto_round_trips_through_HatchClient_Json_with_its_playbook_file()
    {
        var file = new PlaybookFileReferenceDto(".hatch/playbooks.yaml", "example.com/o/r", "main", "abc123", "deadbeef");
        var work = Fixtures.Work("AER-1") with { PlaybookFile = file };

        var json = JsonSerializer.Serialize(work, HatchClient.Json);
        var back = JsonSerializer.Deserialize<WorkDto>(json, HatchClient.Json);

        Assert.NotNull(back);
        Assert.Equal(file, back.PlaybookFile);
    }
}
