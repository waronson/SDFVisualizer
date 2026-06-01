using System.Text.Json;
using SDFVisualizer.Server.Models;

namespace SDFVisualizer.Server.Services;

public interface IGraphStore
{
    Task<IReadOnlyList<GraphSummary>> ListAsync(string userId);
    Task<GraphRecord?> GetAsync(string userId, string id);
    Task<GraphRecord> CreateAsync(string userId, string? name, JsonElement data);
    Task<GraphRecord?> UpdateAsync(string userId, string id, string? name, JsonElement data);
    Task<bool> DeleteAsync(string userId, string id);
}

// Simple JSON-file backed store: all users' graphs live in one file under
// App_Data. Adequate for anonymous, single-instance use; swap for a real
// database if this ever needs to scale or run multi-instance. All access is
// serialized through a semaphore so concurrent requests stay consistent.
public sealed class GraphStore : IGraphStore
{
    private readonly string _path;
    private readonly SemaphoreSlim _gate = new(1, 1);
    private readonly Dictionary<string, List<GraphRecord>> _byUser;

    private static readonly JsonSerializerOptions FileOptions = new() { WriteIndented = false };

    public GraphStore(IHostEnvironment env)
    {
        var dir = Path.Combine(env.ContentRootPath, "App_Data");
        Directory.CreateDirectory(dir);
        _path = Path.Combine(dir, "graphs.json");
        _byUser = LoadFromDisk();
    }

    private Dictionary<string, List<GraphRecord>> LoadFromDisk()
    {
        try
        {
            if (File.Exists(_path))
            {
                var json = File.ReadAllText(_path);
                var data = JsonSerializer.Deserialize<Dictionary<string, List<GraphRecord>>>(json, FileOptions);
                if (data is not null) return data;
            }
        }
        catch
        {
            // Corrupt or unreadable store: start fresh rather than crash on boot.
        }
        return new Dictionary<string, List<GraphRecord>>();
    }

    private Task PersistAsync()
    {
        var json = JsonSerializer.Serialize(_byUser, FileOptions);
        return File.WriteAllTextAsync(_path, json);
    }

    private List<GraphRecord> Bucket(string userId)
        => _byUser.TryGetValue(userId, out var list) ? list : _byUser[userId] = new List<GraphRecord>();

    public async Task<IReadOnlyList<GraphSummary>> ListAsync(string userId)
    {
        await _gate.WaitAsync();
        try
        {
            return Bucket(userId)
                .OrderByDescending(g => g.UpdatedAt)
                .Select(g => g.ToSummary())
                .ToList();
        }
        finally { _gate.Release(); }
    }

    public async Task<GraphRecord?> GetAsync(string userId, string id)
    {
        await _gate.WaitAsync();
        try { return Bucket(userId).FirstOrDefault(g => g.Id == id); }
        finally { _gate.Release(); }
    }

    public async Task<GraphRecord> CreateAsync(string userId, string? name, JsonElement data)
    {
        await _gate.WaitAsync();
        try
        {
            var now = DateTimeOffset.UtcNow;
            var record = new GraphRecord
            {
                Id = Guid.NewGuid().ToString("N"),
                Name = Normalize(name),
                Data = data.Clone(), // detach from the request's JsonDocument
                CreatedAt = now,
                UpdatedAt = now,
            };
            Bucket(userId).Add(record);
            await PersistAsync();
            return record;
        }
        finally { _gate.Release(); }
    }

    public async Task<GraphRecord?> UpdateAsync(string userId, string id, string? name, JsonElement data)
    {
        await _gate.WaitAsync();
        try
        {
            var record = Bucket(userId).FirstOrDefault(g => g.Id == id);
            if (record is null) return null;
            if (!string.IsNullOrWhiteSpace(name)) record.Name = Normalize(name);
            record.Data = data.Clone();
            record.UpdatedAt = DateTimeOffset.UtcNow;
            await PersistAsync();
            return record;
        }
        finally { _gate.Release(); }
    }

    public async Task<bool> DeleteAsync(string userId, string id)
    {
        await _gate.WaitAsync();
        try
        {
            var removed = Bucket(userId).RemoveAll(g => g.Id == id) > 0;
            if (removed) await PersistAsync();
            return removed;
        }
        finally { _gate.Release(); }
    }

    private static string Normalize(string? name)
        => string.IsNullOrWhiteSpace(name) ? "Untitled" : name.Trim();
}
