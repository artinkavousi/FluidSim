# FluidStudio TSL (r182) — Target Architecture

## Goal

Rebuild `FluidStudiov1` into `Fluidstudio_tsl` using:

- **Three.js r182** with **WebGPU backend**
- **TSL (Three.js Shading Language)** for rendering and (where feasible) compute
- **React Three Fiber** as the scene/runtime layer

The target is an app that feels like “R3F-native”: components, hooks, controls, and ecosystem tooling should compose cleanly.

## Current Baselines in This Repo

- `FluidStudiov1/`:
  - Raw WebGPU compute + raw WGSL render-to-canvas (`packages/fluid-2d/render/RenderOutput2D.ts`)
  - Large feature surface: emitters, gizmos, history, presets, post FX
  - Not R3F-native; Three.js usage is minimal and not the render backbone

`Fluidstudio_tsl/` should become the "v1 feature set" rebuilt on top of the **Three.js r182 WebGPU + native TSL** approach, following the patterns in `Resource_examples/Threejsr182_webgpuexamples/`.

## Key Design Decisions

### 1) Everything stays GPU-resident

- No CPU readback (`GPUBuffer.mapAsync`) for display.
- Simulation outputs are **StorageTextures** (or storage buffers where justified), sampled directly in shaders.

### 2) Primary field representation: `THREE.StorageTexture`

Use ping-pong `StorageTexture` for:

- Velocity (RG/rgba textures; store `xy`)
- Dye (RGB(A))
- Pressure (R)

Use single `StorageTexture` for intermediate fields:

- Divergence
- Vorticity

Rationale:

- Matches Three.js WebGPU examples.
- Integrates naturally with TSL `textureLoad/textureStore` and with fragment sampling via `texture()`.

### 3) Compute orchestration via `WebGPURenderer.compute()`

- Each simulation pass is a compute node (`Fn(...).compute(...)` or `wgslFn(...).compute(...)`).
- The solver calls `renderer.compute()` in a deterministic pass order per frame.

### 4) R3F as the runtime and event system

- `Canvas` uses a `WebGPURenderer` (async init).
- The simulation step runs in `useFrame()` (runs before the renderer draw).
- Pointer interaction uses R3F pointer events (`e.uv`) on a full-screen quad.

### 5) Post effects start “in-material”, not full post chain

Three’s node-based `PostProcessing` is powerful, but integrating it cleanly with R3F’s render loop is non-trivial.

Initial approach:

- Do color grading / vignette / chromatic aberration / simple bloom approximation in the quad’s node material.

Later (optional):

- Swap to a dedicated post pipeline (Three `PostProcessing`) once the render loop ownership story is decided.

## Runtime Data Flow

Per frame:

1. Gather splats:
   - Pointer splats (direct manipulation)
   - EmitterManager splats (procedural emitters)
   - Audio-reactive modulation (optional)
2. Run simulation compute:
   - Splat inject -> vorticity -> advect velocity -> divergence -> pressure iterations -> gradient subtract -> advect dye
3. Render:
   - Full-screen quad samples dye `StorageTexture` (and optionally velocity) via TSL `texture()`
4. UI overlay:
   - Panels, gizmos, history, presets remain standard React DOM overlays.

## Module Boundaries

- `packages/fluid-2d/`
  - Solver (`FluidSolver2D`)
  - Compute nodes (TSL/WGSL via nodes)
  - R3F renderer component (`FluidCanvas2D` or `FluidScene2D`)
  - Emitter/gizmo system (ported from v1)
- `packages/studio/`
  - UI shell, panels, Zustand store, history/presets/audio
- `shared/` (optional but recommended)
  - Types and utilities shared across packages

## Porting Strategy (High Level)

1. **Adopt the r182 example patterns** (WebGPU+TSL+R3F).
2. **Port v1 features** into the new architecture:
   - Emitter types + sampling (v1 has the most complete version)
   - Gizmo overlays
   - Studio store/history/presets/audio
   - Advanced sim features (MacCormack, viscosity, buoyancy, turbulence, SOR) as compute nodes
3. Replace v1’s raw WGSL render output with:
   - TSL-driven quad shading (start)
   - Optional node post-processing chain (later)

## Known Risks

- **R3F WebGPU maturity**: some features assume WebGL; keep the render path simple at first.
- **TSL compute limitations**: complex fluid steps may need `wgslFn()` wrappers or remain raw WGSL initially.
- **Texture formats**: float/half-float support and filtering differences vary by device; keep configs conservative.
