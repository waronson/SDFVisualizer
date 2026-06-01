# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

A node-based 3D signed distance field (SDF) visualizer. The UI is two panels: a
**React Flow** node editor on the left for building distance fields from
primitives, boolean combinations, transforms, and noise/distortion nodes; and a
**WebGL2 raymarched preview** on the right that orbits on drag and zooms on
scroll. The graph is compiled to GLSL live on every change.

- `sdfvisualizer.client/` — React 19 + Vite frontend (JavaScript/JSX, not TypeScript). This is where all the app code lives.
- `SDFVisualizer.Server/` — ASP.NET Core (net10.0) Web API. Serves the built SPA in production;
- `SDFVisualizer.slnx` — XML solution file referencing both projects.

### Client architecture (`sdfvisualizer.client/src/`)

The data flow is: **graph → GLSL string → shader → pixels.**

- `sdf/nodes.js` — `NODE_DEFS`, the single source of truth for every node type. Each def declares its editor UI (label, category, input handles, slider params) **and** a `glsl(ctx)` function that emits its distance code. **Add a new node type here and it appears in the palette, the editor, and the compiler automatically** — no other file needs touching.
- `sdf/compile.js` — `compileGraph(nodes, edges)` walks the graph from the Output node and expands it (as a tree, with cycle guards) into the body of a GLSL `map(vec3 p)` function. Transform nodes thread a new position expression down to their children.
- `sdf/shader.js` — the GLSL prelude (primitive/op/noise helpers) and the raymarch fragment shader template; `buildFragmentShader(mapBody)` splices the compiled body in.
- `preview/SdfRenderer.js` — framework-free WebGL2 class: shader compile/link, render loop, camera state, pointer/wheel input, resize. `setFragmentShader()` returns an error string (and keeps the old program) instead of throwing, so shader errors surface in the UI without crashing.
- `preview/Preview.jsx` — thin React wrapper that owns the renderer lifecycle and recompiles the shader when `mapBody` changes.
- `editor/` — `NodeEditor.jsx` (React Flow canvas + palette), `SdfNode.jsx` (custom node with handles + param sliders), `graphConfig.js` (node factory, initial scene, and `GraphActionsContext` for param/delete callbacks).
- `App.jsx` — owns nodes/edges state (`useNodesState`/`useEdgesState`), recompiles `mapBody` via `useMemo`, and lays out the two panels.

When changing the node param schema in `nodes.js`, the GLSL generator for that
node and the slider rendering in `SdfNode.jsx` both read the same `params`
array, so they stay in sync as long as `glsl(ctx)` references the same keys.

## Commands

Run from the indicated directory.

**Full app (server + client together):** Open `SDFVisualizer.slnx` in Visual Studio and run, or:
```
dotnet run --project SDFVisualizer.Server
```
The server references the client `.esproj` and uses `Microsoft.AspNetCore.SpaProxy` to auto-launch `npm run dev` and proxy to it during development (`SpaProxyServerUrl` = `https://localhost:53685`).

**Client only** (in `sdfvisualizer.client/`):
```
npm install        # first time
npm run dev        # Vite dev server (https, port 53685)
npm run build      # production build to dist/
npm run lint       # ESLint
npm run preview    # preview production build
```

**Server only** (in `SDFVisualizer.Server/`):
```
dotnet build
dotnet run            # https://localhost:7149 + http://localhost:5150
```

There is no test project or test runner configured yet.

## Architecture notes

- **Dev request flow:** Vite is the entry point in development. The app currently makes no backend calls, so `vite.config.js` has no `server.proxy`. **If you add an API route, add a matching `server.proxy` entry** or the client won't reach the Kestrel backend in dev.
- **Production request flow:** `Program.cs` serves the built SPA via `UseDefaultFiles` + `MapStaticAssets`, exposes controllers, and falls back unmatched routes to `/index.html` (`MapFallbackToFile`) so client-side routing works.
- **HTTPS / dev certs:** `vite.config.js` generates and reads an ASP.NET dev certificate (`dotnet dev-certs https`) from `%APPDATA%/ASP.NET/https` so the Vite server can serve HTTPS. If dev startup fails on certs, run `dotnet dev-certs https --trust`.
- **Backend target resolution:** the proxy target is chosen from `ASPNETCORE_HTTPS_PORT`, then `ASPNETCORE_URLS`, defaulting to `https://localhost:7149` (matches `launchSettings.json`).
- **API conventions (if adding a backend):** controllers use attribute routing with `[Route("[controller]")]`; the leftover `WeatherForecastController` is the pattern to follow. OpenAPI is mapped only in Development (`/openapi`).
- **Client import alias:** `@` resolves to `sdfvisualizer.client/src` (configured in `vite.config.js`).
- C# project has `Nullable` and `ImplicitUsings` enabled (net10.0).
