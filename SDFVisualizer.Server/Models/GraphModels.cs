using System.Text.Json;

namespace SDFVisualizer.Server.Models;

// Lightweight listing entry returned to the editor's "Open" menu.
public record GraphSummary(string Id, string Name, DateTimeOffset UpdatedAt);

// A saved graph. `Data` holds the opaque client payload (nodes + edges); the
// server never interprets it.
public class GraphRecord
{
    public string Id { get; set; } = "";
    public string Name { get; set; } = "Untitled";
    public JsonElement Data { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }

    public GraphSummary ToSummary() => new(Id, Name, UpdatedAt);
}

// Request body for create (POST) and update (PUT).
public record SaveGraphRequest(string? Name, JsonElement Data);
