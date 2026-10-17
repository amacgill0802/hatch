using System.Text.Json;
using Hatch.Api.Modules.Hatch;

namespace Hatch.Api.Tests.Hatch;

public class IssueEventPayloadTests
{
    private static EfHatchStatus Column(int id, string name) => new() { Id = id, Name = name, SortOrder = id * 10 };

    [Fact]
    public void StatusChanged_NamesAndNumbersBothColumns()
    {
        var payload = IssueEventPayload.StatusChanged(Column(3, "todo"), Column(4, "doing"));

        var json = JsonSerializer.SerializeToElement(payload);
        Assert.Equal("todo", json.GetProperty("from").GetString());
        Assert.Equal("doing", json.GetProperty("to").GetString());
        Assert.Equal(3, json.GetProperty("fromId").GetInt32());
        Assert.Equal(4, json.GetProperty("toId").GetInt32());
    }

    [Fact]
    public void StatusChanged_WithNoPreviousColumn_SerialisesFromAndFromIdAsNull()
    {
        var payload = IssueEventPayload.StatusChanged(null, Column(4, "doing"));

        var json = JsonSerializer.SerializeToElement(payload);
        Assert.Equal(JsonValueKind.Null, json.GetProperty("from").ValueKind);
        Assert.Equal(JsonValueKind.Null, json.GetProperty("fromId").ValueKind);
        Assert.Equal("doing", json.GetProperty("to").GetString());
        Assert.Equal(4, json.GetProperty("toId").GetInt32());
    }

    [Fact]
    public void StatusChanged_AnExtraPair_LandsBesideTheFourKeys()
    {
        var payload = IssueEventPayload.StatusChanged(Column(3, "todo"), Column(4, "doing"), ("expedited", true));

        Assert.Equal(["from", "to", "fromId", "toId", "expedited"], payload.Keys);
        var json = JsonSerializer.SerializeToElement(payload);
        Assert.True(json.GetProperty("expedited").GetBoolean());
    }
}
