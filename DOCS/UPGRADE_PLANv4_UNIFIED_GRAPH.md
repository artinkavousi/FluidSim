# FluidStudio TSL — Unified Graph + TSL Node Pipeline (Plan v4)

## Why this exists

FluidStudio already has strong building blocks:

- **Simulation execution graph**: `packages/fluid-2d/core/PassGraph.ts` + `packages/fluid-2d/FluidSolver2D.ts`
- **GPU field/resource graph**: `packages/fluid-2d/core/FieldRegistry.ts`
- **Material node graph**: `packages/fluid-2d/materials/*`
- **PostFX chain + effect metadata**: `packages/fluid-2d/postfx/*`
- **Studio UI shell + controls**: `packages/studio/*`

But these pieces still behave like **separate pipelines with separate data models** (config objects, presets, registries, UI controls).

**Plan v4** defines how to unify *simulation → look/material → post-processing → output* into **one graph-driven, TSL-node-first pipeline** with a **single, metadata-driven control panel**.

---

## Current implementation snapshot (what’s in the repo today)

### Runtime flow (per frame)

1. **Inputs**
   - Pointer + emitters generate splats (`packages/fluid-2d/emitters/*` → `FluidSolver2D.addSplats`)
2. **Simulation**
   - `FluidSolver2D.step(dt)` executes a compute pipeline via `PassGraph.run()` (compute nodes in `packages/fluid-2d/nodes/*`)
3. **Present / “Look”**
   - `FluidCanvas2D.tsx` builds a TSL present material (large inline node graph) and can optionally **override** the output via `MaterialGraph` presets (`packages/fluid-2d/materials/*`)
4. **PostFX**
   - Optional Three WebGPU node post chain: `FluidPostProcessing2D.tsx` → `PostFXPipelineV3` → `PostFXPipeline2D`

### What’s already “graph-ready”

- `PassGraph.getPassMetadata()` exposes passes for UI/editor tooling
- `MaterialGraph.toJSON()/fromJSON()` + `MaterialNodeRegistry.getMetadata()` exposes a visual-editor-ready material graph
- PostFX has `PostEffectDefinition` metadata + ordering (`RenderOutput2DConfig.postFxOrder`)

### Pain points blocking “one unified pipeline”

- Rendering controls are split across:
  - `RenderOutput2DConfig` (monolithic: sim look + post look + debug + output)
  - MaterialGraph preset graphs (separate look model)
  - PostFX pipeline uniforms + order (separate look model)
- Studio UI is mostly **hand-wired sliders**; it does not yet use node metadata to generate controls.
- “Look presets” exist in multiple incompatible formats (config presets vs graph presets).
- MaterialGraph UI wiring is incomplete (preset ids + param bindings need alignment).
- Compute node registry exists (`ComputeNodeRegistry`) but simulation passes are not yet authored/registered as plug-in node definitions.

---

## Target outcome (definition of “Unified Pipeline”)

### Functional goals

- A single **Pipeline Graph** is the authoritative source of truth for:
  - simulation execution (which passes run, in what order/conditions)
  - material/look (how fields become color)
  - post-processing (stack/graph, ordering, params)
  - debug/output routing
- One **control panel** drives the pipeline by introspecting node metadata:
  - parameters (min/max/step/units/visibility)
  - ports (what connects to what)
  - performance hints (gpuCost/needsMRT/allocations)

### UX goals

- “Add effect / add look node / add pass” becomes:
  - register node definition → appears in node library → add to graph
  - UI controls auto-generate from metadata (no bespoke UI work per node)
- Presets are **graph presets**, not “a giant config object”.

---

## Proposed architecture (v4)

### 1) A single *top-level* `StudioGraph`

**Keep the internal stage implementations**, but unify them under one model:

- **Input Graph (optional in v4.0)**: emitters + modulators → splat stream
- **Simulation Graph**: `PassGraph` (compute passes)
- **Look Graph**: `MaterialGraph` (field sampling + shading + compositing)
- **Post Graph**: PostFX chain (start as stack, later allow full graph)
- **Output Node**: display/record/export

This is a **hierarchical graph**:

- Top-level graph wires stages and asset routing.
- Each stage is its own graph type (already exists for PassGraph/MaterialGraph/PostFX).

### 2) A shared node metadata contract

Unify the *UI-facing* shape across compute/material/post nodes (without forcing the same runtime backend):

- `id`, `label`, `category`
- `inputs[]`, `outputs[]`
- `params{}` (type, default, min/max/step, unit, visibility rules)
- optional performance hints (`gpuCost`, `allocatesRT`, `needsMRT`, `memoryCostHint`)

Adapters:

- Material nodes already match this shape (`packages/fluid-2d/materials/types.ts`)
- Post effects already have metadata (`packages/fluid-2d/postfx/types.ts`)
- Simulation nodes can be incrementally migrated by wrapping existing passes into definitions (`packages/fluid-2d/core/ComputeNodeRegistry.ts`)

### 3) One “look” data model (split the monolith)

Replace the monolithic `RenderOutput2DConfig` conceptually with:

- `simLook`: MaterialGraph preset + overrides (and any remaining inline legacy settings)
- `postFx`: Post chain order + per-effect params + quality settings
- `debug`: debug view routing and visualization params
- `output`: background, tone mapping, export hooks

During migration, keep `RenderOutput2DConfig` as a compatibility layer, but treat it as **derived** from graph state.

---

## Studio control panel design (v4)

### Panels (high-level)

- **Pipeline**
  - stage toggles (sim/look/post/debug)
  - performance budget controls (frameBudgetMs, optional passes)
  - memory view (FieldRegistry stats)
- **Graph Library**
  - searchable node library (compute/material/post)
  - badges: GPU cost, allocates RTs, needs MRT velocity/depth/normal
- **Inspector**
  - auto-generated controls for the selected node (params + contextual help)
- **Presets**
  - save/load/export/import unified graph presets
  - thumbnails later

### Minimal “graph UX” that ships fast

Start with **stack/list-first** UIs (before full visual editor):

- Simulation: ordered pass list + enable toggles + group filters + timings
- PostFX: stack list + reorder + enable/solo + inspector
- Material: preset picker + inspector for key nodes (later: full editor)

Then graduate to a visual node editor (React Flow) once data model + inspector are stable.

---

## Roadmap (phased)

### Phase 0 — Align and de-duplicate (ship in small PRs)

- Make MaterialGraph presets selectable + controllable from Studio (id alignment + param binding)
- Move PostFX UI to metadata-driven rendering (use `PostEffectDefinition.params`)
- Start splitting `RenderOutput2DConfig` into sub-configs (or add a new `PipelineLookState` alongside it)

### Phase 1 — Introduce `StudioGraph` data model

- Define a serializable `StudioGraphData` that references:
  - enabled sim passes + options
  - active material graph preset + overrides
  - active post stack order + overrides
- Create a “compiler” layer that applies `StudioGraphData` to the existing runtime (no behavior change)

### Phase 2 — Control panel becomes graph-driven

- Inspector reads node metadata and edits values via a single binding system
- Preset save/load round-trips the entire pipeline state

### Phase 3 — Visual editors

- Material graph editor (React Flow) using `MaterialGraph` + metadata
- Post graph editor (optional; stack UI may be enough)
- PassGraph viewer (show dependencies + group/budget skipping)

---

## Acceptance criteria (v4)

- The app has one authoritative pipeline state object (graph-based), with full export/import.
- UI controls for Material and PostFX are generated from node metadata (no bespoke controls per node).
- “Look presets” become graph presets and can be applied without touching shader code.
- PassGraph/MaterialGraph/PostFX can be inspected consistently (metadata + timings + cost hints).

