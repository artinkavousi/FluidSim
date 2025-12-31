# FluidStudio TSL — Unified Graph Pipeline TODO (v4)

This TODO list is the actionable companion to `DOCS/UPGRADE_PLANv4_UNIFIED_GRAPH.md`.

---

## ✅ Already implemented (verify + keep)

- [x] Simulation execution graph: `Fluidstudio_tsl/packages/fluid-2d/core/PassGraph.ts`
- [x] Field/resource registry: `Fluidstudio_tsl/packages/fluid-2d/core/FieldRegistry.ts`
- [x] Solver integrates PassGraph + FieldRegistry: `Fluidstudio_tsl/packages/fluid-2d/FluidSolver2D.ts`
- [x] PostFX node chain (WebGPU PostProcessing): `Fluidstudio_tsl/packages/fluid-2d/postfx/PostFXPipelineV3.ts`
- [x] PostFX effect metadata registry: `Fluidstudio_tsl/packages/fluid-2d/postfx/types.ts`
- [x] Material node registry + graph compiler: `Fluidstudio_tsl/packages/fluid-2d/materials/MaterialNodeRegistry.ts`, `Fluidstudio_tsl/packages/fluid-2d/materials/MaterialGraph.ts`
- [x] Built-in MaterialGraph presets exist: `Fluidstudio_tsl/packages/fluid-2d/materials/presets/*`
- [x] MaterialGraph can override present output (integration hook): `Fluidstudio_tsl/packages/fluid-2d/components/FluidCanvas2D.tsx`
- [x] Post stack mounting and fallback logic: `Fluidstudio_tsl/packages/fluid-2d/components/FluidPostProcessing2D.tsx`

---

## P0 — Fix wiring gaps (make existing graph features usable)

- [ ] Align Studio “Material preset” ids with actual preset ids in `packages/fluid-2d/materials/presets/*`
  - Current: UI uses `water/fire/...` while presets include `water-v2`, `fire-v2`, etc.
  - Target: one canonical id per preset (or explicit alias map).
- [ ] Define a consistent param binding format for MaterialGraph overrides
  - Target: use `nodeId.paramId` keys (matches `MaterialGraph.compile()` uniform map).
  - Add optional per-preset “quick controls” mapping (UI slider → graph uniform key).
- [ ] Replace hand-maintained PostFX UI definitions with `PostEffectDefinition.params`
  - Use registry: `PostFXPipelineV3.getEffects()` / `getAllEffects()`.
- [ ] Split `RenderOutput2DConfig` logically (even if kept physically)
  - Define clear boundaries: `simLook` vs `postFx` vs `debug` vs `output`.
  - Add a compatibility layer if needed (don’t break existing presets/history).

---

## P1 — Introduce `StudioGraphData` (single source of truth)

- [ ] Create a serializable `StudioGraphData` object (new file in `packages/studio` or a shared package)
  - Contains: sim pass toggles + material graph preset + post stack order + debug/output state.
- [ ] Add a “compiler/applicator” that drives runtime from `StudioGraphData`
  - Simulation: set pass enabled/group enabled via `PassGraph`
  - Material: compile graph preset into present material (or keep in-quad fallback)
  - Post: build PostFX stack and apply ordering/solo/bypass
- [ ] Create unified preset serialization for `StudioGraphData`
  - Export/import should round-trip reliably.

---

## P2 — Metadata-driven control panel (Inspector-first)

- [ ] Build a generic `NodeInspector` that renders controls from param metadata
  - Supports: float/int/bool/color/enum/colorStops/texture.
- [ ] Add a `NodeLibrary` view (search + category filter + cost hints)
- [ ] Add a `PipelineOverview` view
  - Shows PassGraph timings (CPU + GPU when enabled)
  - Shows FieldRegistry memory stats (per field + totals)

---

## P3 — Visual editor integration (React Flow)

- [ ] MaterialGraph editor (nodes + ports + edges)
  - Data: `MaterialGraphData`
  - Metadata: `MaterialNodeRegistry.getMetadata()`
  - Runtime: recompile on structural changes; hot-update uniforms on param changes.
- [ ] PostFX editor (optional)
  - Start with stack editor; upgrade to full graph only if needed.
- [ ] PassGraph viewer
  - Show pass dependencies (`after`) + groups + optional/budget skipping.

---

## P4 — Full pipeline presets (“one click hero looks”)

- [ ] Convert legacy look presets (`render/MaterialPresets.ts`) into MaterialGraph + PostFX presets
- [ ] Add preset categories + thumbnails (optional)
- [ ] Add per-emitter look overrides (advanced)

---

## Validation checklist (per phase)

- [ ] `npm run build` succeeds
- [ ] Visual sanity: 5+ distinct looks via graph presets
- [ ] Performance sanity: no per-frame recompiles; uniform updates only
- [ ] Preset round-trip: save → reload → identical pipeline state

