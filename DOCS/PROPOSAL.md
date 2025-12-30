# Fluidstudio_tsl - "Next Level" Upgrade Proposal (Sim + Visuals)

This document proposes a concrete, staged plan to evolve the current `Fluidstudio_tsl` 2D solver + renderer into a "next level" experience: higher visual fidelity, more controllable art direction, and better performance scalability-without borrowing code from `Fluidstudiov2`.

## Status (Implemented So Far)

- RK2 / midpoint advection + optional MacCormack
- Divergence-free turbulence (curl noise)
- Improved boundary conditions + solid-wall pressure/projection
- Adaptive pressure iterations + timestep substepping controls
- Debug views (velocity/pressure/divergence/vorticity/dye)
- Render upgrades: palette/ramp modes, foam/highlights, medium absorption/scatter
- Performance: removed per-frame ping-pong stabilization copies; rendering selects via ping-pong state uniforms
- Ramp upgrade: optional gradient-map texture import + Fresnel rim highlight controls
- Dynamic resolution: auto quality (FPS-based grid/dye scaling with bounds + cooldown)
- Soft wall thickness: configurable boundary damping band (reduces ringing/edge artifacts)
- Splat injection optimization: in-place tiled splats + bounding-box dispatch (avoids full-texture splat passes)
- Performance HUD: optional CPU-side per-pass timings + FPS readout (for tuning)
- Output grading always works in-quad unless the Three post stack is active
- Creative LUT: image-based 3D LUT import (Hald-style) + intensity control

## Status (Still To Do / Next Up)

- Pass graph abstraction + field registry (Section 4)
- MRT-based motion blur using velocity (Section 3C.1)
- Sharpen/unsharp + richer LUT workflow (Section 3C.3)
- GPU splat batching (Section 3D.3)

It is written against the current architecture:

- Solver: `Fluidstudio_tsl/packages/fluid-2d/FluidSolver2D.ts`
- Nodes (compute): `Fluidstudio_tsl/packages/fluid-2d/nodes/*`
- Present shader (quad): `Fluidstudio_tsl/packages/fluid-2d/components/FluidCanvas2D.tsx`
- Post stack (Three PostProcessing): `Fluidstudio_tsl/packages/fluid-2d/components/FluidPostProcessing2D.tsx`
- Studio UI: `Fluidstudio_tsl/packages/studio/*` (controls in `UnifiedPanel.tsx`)

---

## 1) Current Baseline (What We Have)

**Simulation core (GPU-resident, StorageTexture ping-pong):**

- Velocity, dye, pressure ping-pong + divergence/vorticity temps.
- Semi-Lagrangian advection with optional MacCormack correction.
- Vorticity confinement, viscosity diffusion, buoyancy (dye-density driven), gravity, turbulence force.
- Pressure solve = Jacobi with optional over-relaxation (`omega`) for a “SOR-like” speedup.
- Optional “contain” boundary that zeros velocity/dye at edges.
- CPU-side emitters generate splats; splats inject dye + force.

**Rendering:**

- Full-screen quad samples dye/velocity.
- In-quad presentation features (distortion, motion blur taps, dye shading/edges, medium absorption/scattering, blend modes).
- Dye “look” controls: density exposure, stylization mixing, hue rotation, grading, animated micro-noise.

**Post-processing:**

- WebGPU node post chain driven by `THREE.PostProcessing`:
  - `pass(scene,camera)` -> grading -> vignette -> bloom -> chromatic aberration -> optional RGB shift -> film grain -> output transform (`renderOutput`) -> optional FXAA.

**Studio:**

- Rich emitter system (point/line/circle/curve/text/svg/brush), selection + gizmos.
- Undo/redo + preset system, basic audio analyzer integration.

---

## 2) What “Next Level” Means (Target Outcomes)

### Visual goals

- More “material feel” for dye: pigment/ink/watercolor/smoke-like options.
- Better readability: crisp edges where desired + smooth body shading where desired.
- More compelling motion: coherent curls, reduced numerical diffusion, less “muddy” dye.
- Art direction tools: gradient-map textures, LUTs, palettes, style presets, per-emitter overrides.

### Simulation goals

- Higher-quality advection and pressure projection for the same GPU cost (or better).
- More stable dynamics across resolution / timestep changes.
- Optional features for “hero” looks: obstacles, sources/sinks, temperature/combustion-like fields.

### Product goals

- Predictable performance (adaptive quality), strong presets, and a debug workflow.
- Clean extensibility: adding a new “pass” shouldn’t require touching 10 files.

---

## 3) High-Impact Upgrades (Prioritized)

### A) Simulation fidelity upgrades (most visible)

1) **RK2 / midpoint backtrace for advection**
   - Why: semi-Lagrangian backtrace accuracy improves swirl coherence; less smearing at same resolution.
   - Where: `packages/fluid-2d/nodes/advectNode.ts` and `macCormackNode.ts` (coordinate computations).
   - Effort: Medium.

2) **Divergence-free turbulence (curl noise)**
   - Current `turbulenceNode.ts` is directional and can inject divergence.
   - Replace with a curl-noise field computed from a scalar noise potential and finite differences.
   - Effort: Medium.

3) **Better boundary conditions**
   - Current “contain” = hard zero outer cells (causes artifacts).
   - Improve to: reflective walls (flip normal component), dye clamp, pressure boundary condition (Neumann).
   - Add an optional “soft wall thickness” region to reduce hard-edge ringing.
   - Where: `boundaryNode.ts`, `pressureNode.ts`, divergence/gradient passes.
   - Effort: Medium–Large (needs coordinated changes).

4) **Adaptive pressure iterations**
   - Use a simple heuristic: fewer iterations when divergence is already low; more when high.
   - Optional: keep a “divergence energy” scalar tracked per frame (downsample reduction pass).
   - Effort: Medium.

5) **Optional MAC grid (staggered velocity)**
   - Biggest physical accuracy jump, but largest refactor.
   - Adds separate U/V textures and changes divergence/projection math.
   - Treat as Phase 3+ (only if needed).
   - Effort: Large.

### B) Dye “material” upgrades (art direction)

1) **Gradient-map texture pipeline**
   - Let users map dye density/intensity to a 1D/2D “ramp” texture (image import).
   - Add modes: ramp-by-density, ramp-by-speed, ramp-by-vorticity.
   - Where: `FluidCanvas2D.tsx` (sampling), Studio config + import.
   - Effort: Medium.

2) **Pigment vs water (watercolor-ish)**
   - Add a second scalar field: “wetness” or “water”.
   - Pigment advects + diffuses differently based on wetness; paper absorption drains wetness.
   - Rendering uses wetness for soft edges and diffusion halos.
   - Effort: Large (new field + passes + UI).

3) **Foam/edge highlights**
   - Compute a foam mask from gradients/vorticity/speed; render as bright outline or bubbles.
   - Can be done in-material (cheap) or as a post node.
   - Effort: Small–Medium.

4) **Specular + Fresnel “liquid” shading**
   - Current dye shading is a simple pseudo-normal from gradient.
   - Upgrade: compute a smoother normal (blurred gradient) + fresnel term + controlled roughness.
   - Effort: Medium.

### C) Post-processing upgrades (cinematic polish)

1) **Motion blur driven by velocity buffer (MRT)**
   - Current blur is a few taps in-material; better is post blur using a velocity target.
   - Implement MRT pass: output color + velocity; feed velocity into a motion blur node.
   - Reference: `Resource_examples/Threejsr182_webgpuexamples/webgpu_postprocessing_motion_blur.html`.
   - Effort: Medium–Large (pipeline restructure).

2) **Tone mapping + exposure (filmic)**
   - Add an exposure control and a filmic curve (ACES-like) before `renderOutput()`.
   - Effort: Small.

3) **Sharpen / clarity + LUT**
   - Add unsharp mask or contrast-adaptive sharpen node; add LUT (3D or strip texture).
   - Effort: Medium.

### D) Performance + scalability upgrades (make it smooth)

1) **Dynamic resolution / quality scaling**
   - Separate “sim resolution” from “display resolution” and auto-adjust based on GPU frame time.
   - E.g. keep dye at 512 on fast GPUs, drop to 384/256 on slower ones while upscaling.
   - Effort: Medium.

2) **Pass scheduling + caching (no rebuilds)**
   - Ensure node graphs are created once and only uniforms update (already mostly true).
   - Consolidate toggles to avoid reallocating PostProcessing chains unnecessarily.
   - Effort: Small–Medium.

3) **GPU splat batching**
   - When emitter count is high, CPU -> GPU splat submission becomes a bottleneck.
   - Path: upload a splat list buffer and apply splats in a compute pass (tile-based or loop-based).
   - Effort: Medium–Large (depends on desired max splats).

---

## 4) Architectural Proposal (So Features Don’t Become Spaghetti)

### 4.1 Introduce a “Pass Graph” abstraction

Goal: each simulation or render pass becomes a small unit with:

- inputs (textures/buffers)
- outputs
- uniforms
- enable predicate
- run order constraints

Proposed structure (new module):

- `packages/fluid-2d/core/PassGraph.ts`
  - `Pass` interface + `ResourceRegistry`
  - `graph.run(renderer)` executes enabled passes in order
  - debug hooks for timing + texture preview

Then `FluidSolver2D.step()` becomes mostly “configure uniforms + graph.run()”.

### 4.2 Standardize “field” definitions

Create a small registry so “velocity”, “dye”, “pressure”, etc are declared once:

- format, size, ping-pong, sampling helpers, resize behavior

This makes future fields (temperature, wetness, obstacles) low-risk to add.

### 4.3 Separate “Sim Look” vs “Post Look”

Today both exist, but controls can confuse:

- **Sim Look** (in-material): dye shading/edges/medium/gradient mapping.
- **Post Look** (post chain): grading/vignette/bloom/film/aberration.

Proposal:

- Panel has a clear split; presets can store both groups independently.

### 4.4 Unify Post-Processing (One Pipeline, One Owner)

Goal: replace the current “some post in the quad + some post in `THREE.PostProcessing`” split with **one canonical post-processing pipeline** that is:

- driven by a **WebGPU node post chain** (TSL nodes, `THREE.PostProcessing`)
- **owned by one component/manager** (single place that builds/disposes the chain)
- integrated with a node-graph approach (effects are composable nodes with metadata)
- paired with a **single clean Post FX panel** (no scattered/duplicated controls)

#### 4.4.1 Current implementation (what’s messy today)

The post “surface area” is currently spread across multiple places:

- Post chain implementation: `packages/fluid-2d/components/FluidPostProcessing2D.tsx`
- In-quad “output grading” (and LUT loading) still lives in the present shader: `packages/fluid-2d/components/FluidCanvas2D.tsx`
- Shared config type for *everything* (sim look + post look + debug): `packages/fluid-2d/render/RenderOutput2D.ts`
- UI controls are duplicated across multiple panel implementations (legacy + current): `packages/studio/components/ControlPanel.tsx`, `packages/studio/panels/ControlSidebar.tsx`, `packages/studio/panels/UnifiedPanel.tsx`

Symptoms:

- Two sources of truth for grading/vignette/LUT (post chain vs in-quad path).
- `postEnabled` semantics are unclear: some “post” values affect the quad even when post is “off”, while other effects require the post stack to be “on”.
- Resource loading and uniform wiring are repeated (LUT loaders + many uniform nodes).
- The panel UX isn’t pipeline-aware: there’s no single “Post Stack” concept (order, enable, dependencies, quality), and controls sprawl.

#### 4.4.2 Target design (PostFX v2)

Introduce a single “PostFX pipeline” layer with three explicit concepts:

1) **Global output transform** (always present)
- `renderOutput()` + (optional) output-gamma / tone map policy.

2) **A Post FX stack** (ordered list)
- each entry is an effect node (Bloom, Chromatic, Grain, Trails, AfterImage, RGBShift, LUT, Sharpen/Clarity, MotionBlur (future MRT)).

3) **A backend contract**
- Primary: WebGPU node post chain via `THREE.PostProcessing`
- Optional fallback: “inline” (in-quad) only for minimal output transform or when WebGPU post compilation fails.

#### 4.4.3 Proposed module layout (concrete)

Add a small PostFX package area:

- `packages/fluid-2d/postfx/PostFXPipeline.ts`
  - builds the node chain once (based on enabled effects + ordering)
  - exposes `setConfig()` to rebuild only on structural changes (enable/order/backend)
  - exposes `updateUniforms()` for hot updates (no rebuild)
  - owns disposal for nodes that allocate render targets (AfterImage/Trail/Bloom)
- `packages/fluid-2d/postfx/effects/*`
  - one file per effect, exporting a `PostEffectDefinition`
- `packages/fluid-2d/postfx/resources/*` (or hooks)
  - LUT/gradient loaders + caching (`LUTImageLoader` usage should live here, not in two components)

This enables a single R3F integration component:

- `packages/fluid-2d/components/FluidPostFX2D.tsx`
  - mounts once, owns the render override (`postProcessing.render()`)
  - observes store/config changes, routes them into the pipeline manager
  - handles safe fallback if a device/driver fails to compile

#### 4.4.4 Node-graph integration (WebGPU node post chain driven)

Make PostFX effects first-class “nodes” (not ad-hoc `useMemo` chains) by standardizing an effect definition:

- `id`, `label`, `category`
- typed `params` with UI metadata (min/max/step, units, visibility predicates)
- `build(inputNode, ctx) -> outputNode` (pure composition)
- optional `requires` (e.g. motion blur requires MRT velocity)

Result:

- The runtime pipeline builder can assemble a deterministic chain.
- The UI can auto-generate a clean panel from the same metadata.
- A future node-graph editor can render the same PostFX stack as a graph (ports = color/velocity/depth, etc).

#### 4.4.5 Migration plan (minimize risk)

Phase 1 (cleanup, no feature change):

- Extract duplicated grading/vignette/LUT logic into shared PostFX nodes.
- Centralize LUT loading/caching so both render paths stop duplicating it.
- Document which parameters belong to “Sim Look” vs “Post Look”.

Phase 2 (make PostFX the canonical pipeline):

- Move grading/vignette/LUT fully into the PostFX chain (WebGPU).
- Keep in-quad only as a fallback when PostFX is unavailable.
- Redefine `postEnabled` to mean “PostFX stack on/off” (not “some grading still happens”).

Phase 3 (data model + UI):

- Split `RenderOutput2DConfig` into:
  - `simLook` (material/field presentation)
  - `postFx` (stack + params)
  - `debug`
- Replace the current scattered Post controls with one `PostFXPanel` that is stack-driven.

Phase 4 (advanced effects):

- MRT velocity output + proper motion blur node.
- Sharpen/unsharp, better bloom, selective color, optional DOF (if needed).

### 4.5 PostFX Panel v2 (Stack-First UI)

Replace the current scattered “Post sliders everywhere” approach with a single, pipeline-aware panel that mirrors the runtime reality: **a global output stage + an ordered PostFX stack**.

#### 4.5.1 Layout (simple, predictable)

- **Global**: Post On/Off, Backend (WebGPU Post / Inline fallback), Quality/Resolution scale, FXAA toggle, quick A/B (Bypass), Reset.
- **Stack**: ordered list of enabled effects (reorder, enable toggle, solo, duplicate, remove).
- **Inspector**: focused controls for the selected effect (only show relevant controls; hide disabled/irrelevant sub-controls).

#### 4.5.2 Controls generated from effect metadata

Each effect definition exposes UI metadata (min/max/step, units, conditional visibility), so:

- adding a new effect is “add effect node + metadata”, not “touch 3 UI files”
- the UI stays consistent (same slider style, same labels, same defaults)

#### 4.5.3 Presets that match user intent

- **Look presets** split into `Sim Look` and `PostFX Look` (with an option to bundle both).
- **Per-effect defaults**: “Reset effect” resets only that node to defaults.
- **Performance hints**: lightweight badges (e.g. “allocates RTs”, “needs MRT velocity”) to avoid surprise slowdowns.

---

## 5) Suggested Roadmap (Phased, Each Phase Shippable)

### Phase 1 - Quality foundations (1-2 weeks)

- RK2 advection (velocity + dye).
- Curl-noise turbulence replacement.
- Better boundary conditions (reflective + pressure Neumann).
- Add debug views: show velocity/divergence/pressure/density.
- PostFX v2 groundwork: shared grading/LUT nodes + centralized loaders + effect metadata schema.

### Phase 2 - "Hero look" visuals (1-2 weeks)

- Gradient-map texture import + ramp controls.
- Foam/highlight mask + fresnel liquid shading.
- Tone mapping/exposure + clarity sharpen.
- PostFX v2: ship `PostFXPipeline` + `FluidPostFX2D` + stack-driven `PostFXPanel`.

### Phase 3 - Cinematic motion + scalability (2-4 weeks)

- MRT-based motion blur using velocity.
- Dynamic resolution + adaptive pressure iterations.
- GPU splat batching (if emitter counts are a priority).
- PostFX quality controls: internal downsample chain + resolution scale for heavy effects (bloom/trails).

### Phase 4 — Watercolor/pigment system (optional, large)

- Add wetness field + paper absorption.
- Pigment diffusion dependent on wetness.
- New render model tuned for watercolor styles.

---

## 6) Risks / Constraints (And Mitigations)

- **TSL stack gotchas (`Fn()` requirements)**: keep `If()`/`assign()` inside `Fn()` (already documented).
- **Precision / formats**: half-float vs float tradeoffs; add “safe defaults” and expose only if needed.
- **R3F render ownership**: PostProcessing currently renders inside `useFrame(priority=1)`; MRT will add complexity—keep it opt-in and well-tested.
- **Performance cliffs**: avoid per-frame node rebuilding; keep uniform updates hot; prefer downsample chains over full-res expensive passes.

---

## 7) Acceptance Criteria (How We Know It Worked)

- Visual: dye retains detail longer (less diffusion), curls look coherent at medium resolution.
- Control: users can achieve at least 5 distinct looks via presets (ink, neon, smoke, watercolor-ish, cinematic).
- Performance: stable 60 FPS on target machine at default settings; adaptive scaling avoids "death spirals".
- Debuggability: one-click debug view toggles for core fields and at least basic per-pass timing.
- PostFX: one canonical chain (WebGPU node post) with graceful fallback; no duplicated grading/LUT logic.
- UX: one PostFX panel (stack-first) drives all post controls; presets round-trip the stack + params.

---

## 8) Appendix: Local Example References (WebGPU r182)

Use these as ground truth patterns:

- Ping-pong compute textures: `Resource_examples/Threejsr182_webgpuexamples/webgpu_compute_texture_pingpong.html`
- Compute + render: `Resource_examples/Threejsr182_webgpuexamples/webgpu_compute_texture.html`
- Post motion blur + MRT: `Resource_examples/Threejsr182_webgpuexamples/webgpu_postprocessing_motion_blur.html`
