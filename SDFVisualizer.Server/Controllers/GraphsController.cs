using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using SDFVisualizer.Server.Models;
using SDFVisualizer.Server.Services;

namespace SDFVisualizer.Server.Controllers;

// CRUD for the current user's saved SDF graphs. The "user" is anonymous and
// identified solely by a long-lived cookie (no accounts yet); the cookie is
// minted on first contact.
[ApiController]
[Route("api/graphs")]
public class GraphsController : ControllerBase
{
    private const string CookieName = "sdf_uid";
    private readonly IGraphStore _store;

    public GraphsController(IGraphStore store) => _store = store;

    [HttpGet]
    public Task<IReadOnlyList<GraphSummary>> List() => _store.ListAsync(UserId());

    [HttpGet("{id}")]
    public async Task<ActionResult<GraphRecord>> Get(string id)
    {
        var record = await _store.GetAsync(UserId(), id);
        return record is null ? NotFound() : record;
    }

    [HttpPost]
    public async Task<ActionResult<GraphSummary>> Create([FromBody] SaveGraphRequest request)
    {
        if (request.Data.ValueKind == JsonValueKind.Undefined)
            return BadRequest("Missing graph data.");

        var record = await _store.CreateAsync(UserId(), request.Name, request.Data);
        return CreatedAtAction(nameof(Get), new { id = record.Id }, record.ToSummary());
    }

    [HttpPut("{id}")]
    public async Task<ActionResult<GraphSummary>> Update(string id, [FromBody] SaveGraphRequest request)
    {
        if (request.Data.ValueKind == JsonValueKind.Undefined)
            return BadRequest("Missing graph data.");

        var record = await _store.UpdateAsync(UserId(), id, request.Name, request.Data);
        return record is null ? NotFound() : record.ToSummary();
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(string id)
        => await _store.DeleteAsync(UserId(), id) ? NoContent() : NotFound();

    // Read the anonymous-user cookie, minting and setting one if absent.
    private string UserId()
    {
        if (Request.Cookies.TryGetValue(CookieName, out var id) && !string.IsNullOrWhiteSpace(id))
            return id;

        id = Guid.NewGuid().ToString("N");
        Response.Cookies.Append(CookieName, id, new CookieOptions
        {
            HttpOnly = true,
            SameSite = SameSiteMode.Lax,
            Secure = Request.IsHttps,
            IsEssential = true,
            Path = "/",
            Expires = DateTimeOffset.UtcNow.AddYears(1),
        });
        return id;
    }
}
