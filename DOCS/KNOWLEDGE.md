# FluidStudio TSL/WebGPU (r182) — Porting Knowledge Base

This document captures the practical knowledge needed to rebuild `FluidStudiov1` into `Fluidstudio_tsl` using **Three.js r182 WebGPU + native TSL + React Three Fiber**.

Start with `Fluidstudio_tsl/ARCHITECTURE.md` for the “what we’re building”, then use this file for “how to build/port it safely”.

---

## 0) Repository Map (Sources of Truth)

This rebuild is based on:

- `FluidStudiov1/` (feature inventory + UX + emitter/gizmo/studio behavior)
  - Fluid simulation: **raw WebGPU compute** + **raw WGSL render output** (GPU-to-canvas)
- `Resource_examples/Threejsr182_webgpuexamples/` (Three.js r182 WebGPU + TSL ground-truth patterns)

### Three.js r182 example corpus (local)

- `Resource_examples/Threejsr182_webgpuexamples/`
  - Official-style WebGPU + TSL examples; treat these as the "ground truth" for API patterns in r182.

### 0.1 Current rebuild status (this folder)

Key entry points:

- Solver: `Fluidstudio_tsl/packages/fluid-2d/FluidSolver2D.ts`
- Rendering + interaction: `Fluidstudio_tsl/packages/fluid-2d/components/FluidCanvas2D.tsx`
- Studio UI: `Fluidstudio_tsl/packages/studio/App.tsx`

What is already implemented:

- StorageTexture ping-pong simulation (velocity/dye/pressure) + splats + vorticity
- Studio-facing physics toggles (viscosity diffusion, turbulence, buoyancy, containment, SOR-style relaxation)
- Studio-facing post FX (in-material): grading + vignette (+ radius) + bloom + chromatic aberration + distortion + motion blur + film grain + gamma

---

## 1) Three.js r182 WebGPU + TSL: The Mental Model

### 1.1 Imports that matter

In r182 the most important split is:

- `three/webgpu`: WebGPU renderer + WebGPU-enabled materials/classes (including node materials)
- `three/tsl`: TSL nodes and helpers (for materials, post FX, and compute)

Typical project imports (bundler/NPM):

```ts
import * as THREE from 'three/webgpu';
import { Fn, uniform, texture, uv } from 'three/tsl';
```

### 1.2 WebGPURenderer is async-initialized

WebGPU needs an adapter/device, so initialization is async:

```ts
const renderer = new THREE.WebGPURenderer({ antialias: true });
await renderer.init();
```

In R3F, you generally gate rendering until init completes (see section 6).

### 1.3 You can pass an existing `GPUDevice` into Three.js

In r182, `WebGPUBackend` supports a `device` parameter:

- Reference: `FluidStudiov1/three.js-r182/build/three.webgpu.js` (see `WebGPUBackend~Options`)

This enables “hybrid” architectures (raw WebGPU compute + Three rendering) when needed.

### 1.4 StorageTexture is the workhorse for compute + rendering

`THREE.StorageTexture`:

- can be written in compute via `textureStore(storageTexture(tex), ...)`
- can be read in compute via `textureLoad(storageTexture(tex), ...)`
- can be sampled in fragment shaders via `texture(tex, uv())` (because it extends `Texture`)

This is the core trick that makes a fully GPU-resident fluid sim displayable in-scene.

---

## 2) What the Local r182 Examples Teach (Key Patterns)

### 2.1 Ping-pong storage textures

Example: `Resource_examples/Threejsr182_webgpuexamples/webgpu_compute_texture_pingpong.html`

Key patterns:

- Create two `StorageTexture`s, treat one as read and one as write.
- Wrap with `storageTexture(tex).setAccess(NodeAccess.READ_ONLY|WRITE_ONLY)` when using `wgslFn` with explicit WGSL access types.
- Execute per-frame with `renderer.compute(node)` and then swap.

Why it matters for FluidStudio:

- Fluid solvers require ping-pong for velocity/dye/pressure (and sometimes intermediate fields).

### 2.2 Compute + render from storage buffers

Example: `Resource_examples/Threejsr182_webgpuexamples/webgpu_compute_water.html`

Key patterns:

- `instancedArray(typedArray)` creates a GPU storage buffer that can be read/written in compute.
- Compute nodes can be 2D workgrouped: `.compute(WIDTH*WIDTH, [16,16])` and dispatched with `[WIDTH/16, WIDTH/16, 1]`.
- Materials can read from the *current* ping-pong buffer using `select(uniform, A, B)`.

Why it matters:

- Demonstrates that Three’s node system can render directly from storage buffers if we ever choose buffers over textures.

### 2.3 Pure TSL compute for simulation steps

Examples:

- `Resource_examples/Threejsr182_webgpuexamples/webgpu_compute_texture.html` (minimal “compute into StorageTexture” + render via `texture()`)
- `Resource_examples/Threejsr182_webgpuexamples/webgpu_compute_water.html` (ping-pong + selecting the current read buffer in node graphs)
- Current implementation: `Fluidstudio_tsl/packages/fluid-2d/nodes/*`

Key patterns:

- Use `Fn(() => { ... })().compute(N)` compute nodes.
- Use `textureLoad/textureStore` with `THREE.StorageTexture`.
- Manual bilinear sampling inside compute (`floor/fract/mix`) because `textureLoad` is unfiltered.

Why it matters:

- This is the simplest path to a “native TSL compute” solver (no raw WebGPU pipeline management).

### 2.4 WGSL/TSL interoperability (escape hatch)

Example: `Resource_examples/Threejsr182_webgpuexamples/webgpu_tsl_interoperability.html`

Key patterns:

- `wgslFn()` embeds WGSL functions while still participating in the node system.
- `varyingProperty()` bridges vertex->fragment varyings.

Why it matters:

- If a fluid step is too awkward in pure TSL (or you already have WGSL from v1), you can wrap WGSL code inside the TSL node pipeline.

### 2.5 Node-based post processing (WebGPU only)

Example: `Resource_examples/Threejsr182_webgpuexamples/webgpu_postprocessing_motion_blur.html`

Key patterns:

- `pass(scene,camera)` creates a scene render node.
- `mrt({ output, velocity })` demonstrates multi-render-target outputs.
- `new THREE.PostProcessing(renderer)` runs node post FX via `postProcessing.render()`.

Why it matters:

- This is the “future” for v1’s post FX, but integrating it into R3F’s render loop requires care (see section 6.6).

### 2.5.1 Reusing Three.js example TSL modules (local)

Three r182 ships a growing library of reusable TSL nodes under:

- `Fluidstudio_tsl/node_modules/three/examples/jsm/tsl/display/*`

These are designed for WebGPU + node materials/postprocessing and are useful even in an "in-material" pipeline.

What we currently reuse in the rebuild:

- Film grain: `film()` from `three/examples/jsm/tsl/display/FilmNode.js`
- Chromatic aberration: `chromaticAberration()` from `three/examples/jsm/tsl/display/ChromaticAberrationNode.js`

Where it is wired:

- `Fluidstudio_tsl/packages/fluid-2d/components/FluidCanvas2D.tsx`

TypeScript note:

- `three/examples/jsm/tsl/*` modules are JS-first; this repo adds minimal typings in `Fluidstudio_tsl/src/types/three-examples-tsl.d.ts`.

### 2.6 Advanced compute patterns: atomics + indirect dispatch

Example: `Resource_examples/Threejsr182_webgpuexamples/webgpu_compute_particles_fluid.html`

Key patterns:

- Atomics exist in TSL (`atomicAdd`, `atomicLoad`, `atomicStore`).
- Indirect dispatch via `renderer.compute(kernel, indirectBufferAttribute)`.

Why it matters:

- Not required for the 2D stable-fluids solver, but useful for future 3D/particle-based extensions and performance tricks.

---

## 3) Fluid Simulation Pipeline (What We’re Porting)

### 3.1 Core fields

For 2D stable fluids you typically maintain:

- Velocity `u(x,y)` (2 channels)
- Dye/color `d(x,y)` (3–4 channels)
- Pressure `p(x,y)` (1 channel)
- Divergence `div(x,y)` (1 channel)
- Vorticity `ω(x,y)` (1 channel) + optional confinement force

### 3.2 Typical per-frame order

1. Splat injection (velocity + dye)
2. Vorticity compute + confinement force (optional)
3. Advect velocity (semi-Lagrangian; optional MacCormack)
4. Divergence
5. Pressure solve (Jacobi; optional SOR)
6. Gradient subtract (projection)
7. Advect dye

### 3.3 What v1 already has (feature inventory)

`FluidStudiov1/packages/fluid-2d/FluidSolver2D.ts` includes:

- MacCormack option (`useMacCormack`)
- SOR pressure solver option (`pressureSolver`, `sorOmega`)
- Buoyancy, turbulence, viscosity, boundary pass, symmetry
- Many studio-facing controls (splat falloff/blend, softness, boosts, etc.)

The “baseline” in this rebuild lives in:

- `Fluidstudio_tsl/packages/fluid-2d/FluidSolver2D.ts`
- `Fluidstudio_tsl/packages/fluid-2d/nodes/*`

Porting means: **keep the Three.js r182 StorageTexture + TSL compute architecture**, then **add v1 features** pass-by-pass.

---

## 4) Porting Strategy: v1 -> Fluidstudio_tsl (Recommended Order)

### Phase A — Get the “new core” stable

Goal: a minimal, correct, R3F-native fluid sim loop.

Use (or copy/adapt) from:

- `Fluidstudio_tsl/packages/fluid-2d/*` (TSL compute + R3F Canvas)

Definition of done:

- WebGPU renderer is created via R3F `Canvas gl={...}` and `await renderer.init()` completes.
- Simulation runs via `renderer.compute()` inside `useFrame()`.
- Dye texture displays on a quad with a node material.
- Pointer splats work.

### Phase B — Port v1 studio UX + systems

Goal: bring back the “product” features without changing the compute architecture.

Port from:

- `FluidStudiov1/packages/studio/*` (history, presets, panels)
- `FluidStudiov1/packages/fluid-2d/emitters/*`
- `FluidStudiov1/packages/fluid-2d/gizmos/*`

Keep these largely renderer-agnostic:

- Emitters should output *splats* in normalized coordinates.
- Gizmos can remain DOM overlays and don’t need to be inside the 3D scene.

### Phase C — Add v1 solver features as compute nodes

Goal: feature parity of the sim.

Approach:

1. Implement features in pure TSL when simple (extra uniforms, extra math).
2. For complex steps (MacCormack, SOR, turbulence), decide:
   - pure TSL node implementation, or
   - `wgslFn()` wrappers using v1 WGSL as a starting point.

Port targets (in order):

- Config + uniform wiring parity (no algorithm change)
- Viscosity (diffusion)
- Buoyancy/temperature (if used)
- Turbulence/noise injection
- MacCormack advection
- SOR pressure solve (optional; speed/quality trade)
- Obstacles/boundaries (if desired; see other projects in repo)

### Phase D — Post FX parity

Goal: match or exceed v1’s `RenderOutput2D` look (bloom/trails/velocity viz).

Start with:

- “in-material” post: vignette, brightness/contrast/saturation, chromatic offset, simple glow.

Then choose:

- stay in-material with extra ping-pong render targets, or
- move to Three’s node `PostProcessing` pipeline.

---

## 5) Field Formats and GPU Constraints (Practical Notes)

### 5.1 Prefer half-float unless you truly need float

- Half float (rgba16float) is often the sweet spot for bandwidth and quality.
- Full float (rgba32float) increases bandwidth and can reduce performance.

Device support varies; build conservative defaults and allow overrides.

### 5.2 Don’t read & write the same storage texture in one pass

Even if APIs allow “read_write”, many algorithms become undefined or non-portable.

Use explicit ping-pong:

- `readTex` -> `writeTex`, then swap.

### 5.3 Workgroup sizing

- 8×8 or 16×16 are typical for 2D grid compute.
- If using `instanceIndex` 1D mapping, you still benefit from good workgroup size but you lose 2D locality.

Rule of thumb:

- Start with a 1D `instanceIndex` mapping for simplicity.
- Optimize later to 2D dispatch (`globalId.xy`) once correctness is stable.

---

## 6) React Three Fiber + WebGPURenderer Integration

### 6.1 The working pattern (this repo)

See: `Fluidstudio_tsl/packages/fluid-2d/components/FluidCanvas2D.tsx`

Core idea:

- Use `Canvas gl={async (props) => { ... }}` to construct a `THREE.WebGPURenderer`
- `await renderer.init()` before starting the frameloop

Practical gating:

- `frameloop="never"` until the renderer/solver are ready
- then flip to `frameloop="always"`

### 6.2 Where to run compute

Run compute inside `useFrame()` so it happens before the draw:

```ts
useFrame((_, dt) => solver.step(dt));
```

### 6.3 Pointer -> splat mapping

Simplest reliable method:

- Render a full-screen quad (plane) and use R3F pointer events.
- Use `e.uv` as normalized coordinates.

This avoids manual “screen -> sim” conversion logic.

### 6.4 Avoid shader recompiles

Do not rebuild node graphs per frame.

- Build materials once.
- Update only uniform `.value` fields.

### 6.5 WebGPU support handling

For user-facing UX:

- Detect support via `navigator.gpu` (or `three/addons/capabilities/WebGPU.js`).
- Render a fallback UI state if unsupported.

### 6.6 PostProcessing and R3F (known integration question)

Three’s `PostProcessing` uses `postProcessing.render()` instead of `renderer.render(scene,camera)`.

R3F always calls `gl.render(scene, camera)` internally.

Options:

1. Keep post in the quad material (recommended for the rebuild's first milestone).
2. Take ownership of the render loop (advanced; requires deeper R3F integration choices).

### 6.7 Critical TSL gotcha: calling `Fn`

TSL `Fn` parameters are **node arguments**, not JavaScript arrays.

If you define:

```ts
const fx = Fn(([input]) => input.mul(2.0));
```

Call it like:

```ts
fx(input)
```

Do **not** call `fx([input])` — that can produce runtime errors like `Cannot read properties of undefined (reading 'mul')`.

---

## 7) Debugging & Validation

### 7.1 WebGPU validation errors

In raw WebGPU code you can use:

```ts
device.pushErrorScope('validation');
// create pipelines/bind groups...
const err = await device.popErrorScope();
```

In Three’s WebGPU path:

- Prefer the `Inspector` (examples use it heavily).
- Keep compute kernels small and test incrementally.

### 7.2 Visual debugging

Expose debug “render modes”:

- dye
- velocity magnitude
- pressure
- divergence
- vorticity

This is the fastest way to catch broken math or boundary conditions.

---

## 8) Concrete Port Checklist (Actionable)

### Starter milestone

- [ ] Create `Fluidstudio_tsl` app scaffolding (Vite + React + R3F + three@0.182).
- [ ] Implement WebGPURenderer `gl` init pattern.
- [ ] Implement TSL compute nodes + ping-pong textures.
- [ ] Display dye StorageTexture on a quad with `MeshBasicNodeMaterial`.
- [ ] Pointer splats.

### Studio milestone (v1 UX parity)

- [ ] Port v1 emitter types + EmitterManager.
- [ ] Port v1 gizmo overlay renderer.
- [ ] Port v1 history/presets store (Zustand).
- [ ] Rebuild UI panel layout (can start by copying v1).

### Solver parity milestone (v1 sim features)

- [ ] Add viscosity
- [ ] Add buoyancy/temperature
- [ ] Add turbulence injection
- [ ] Add MacCormack option
- [ ] Add SOR option
- [ ] Add boundary/obstacle handling (optional)

### Visual parity milestone

- [ ] Color grading controls
- [ ] Vignette/chromatic/glow
- [ ] Trails / history buffer approach
- [ ] Bloom (approx or full node post)

---

## 9) References (Local Files)

- Target design: `Fluidstudio_tsl/ARCHITECTURE.md`
- v1 solver + UI (feature inventory): `FluidStudiov1/packages/fluid-2d/FluidSolver2D.ts`, `FluidStudiov1/packages/studio/App.tsx`
- Current implementation (entry points): `Fluidstudio_tsl/packages/fluid-2d/FluidSolver2D.ts`, `Fluidstudio_tsl/packages/fluid-2d/components/FluidCanvas2D.tsx`, `Fluidstudio_tsl/packages/studio/App.tsx`
- Key examples:
  - `Resource_examples/Threejsr182_webgpuexamples/webgpu_compute_texture_pingpong.html`
  - `Resource_examples/Threejsr182_webgpuexamples/webgpu_compute_water.html`
  - `Resource_examples/Threejsr182_webgpuexamples/webgpu_tsl_interoperability.html`
  - `Resource_examples/Threejsr182_webgpuexamples/webgpu_postprocessing_motion_blur.html`
  - `Resource_examples/Threejsr182_webgpuexamples/webgpu_compute_particles_fluid.html`
