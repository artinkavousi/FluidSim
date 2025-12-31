# FluidStudio TSL — "Next Generation" Upgrade Proposal

> **Vision**: Transform Fluidstudio_tsl from a functional fluid simulation into a **professional-grade creative tool** with unmatched visual fidelity, performance scalability, and artistic control.

---

## Current Implementation Assessment

### What's Already Excellent ✅

| Component | Status | Notes |
|-----------|--------|-------|
| **PassGraph Architecture** | ✅ Implemented | Dependency-ordered execution with timing |
| **FieldRegistry** | ✅ Implemented | Centralized field management with ping-pong |
| **17 Compute Nodes** | ✅ Implemented | Full simulation pipeline |
| **RK2/MacCormack Advection** | ✅ Implemented | High-quality advection |
| **Curl-Noise Turbulence** | ✅ Implemented | Divergence-free turbulence |
| **Dynamic Resolution** | ✅ Implemented | FPS-based adaptive scaling |
| **PostFX Pipeline** | ✅ Implemented | 8 effects with WebGPU node chain |
| **Rich Emitter System** | ✅ Implemented | 7 emitter types |
| **Tiled Splat Injection** | ✅ Implemented | Bounds-aware dispatch (NEW!) |

### What Needs Polish 🔧

- [x] Tiled in-place splats (bounding-box dispatch) — **DONE**
- [x] GPU splat batching (buffer-based) - **DONE** (`SplatBatch.ts`, ping-pong safe)
- [x] Panel modularization - **DONE** (`packages/studio/panels/unified/controls.tsx`)
- [x] Material preset system - **DONE** (`MaterialPresets.ts`)
- [ ] MRT-based motion blur
- [x] PostFX v3 refactor - **DONE** (`PostFXPipelineV3.ts`)

---

## 1) Core Architecture: The Graph Evolution

### Implementation Checklist

- [x] PassGraph basic implementation
- [x] Dependency-ordered execution
- [x] Timing collection (`setTimingEnabled`, `getTimings`)
- [x] `FieldMemoryStats` via `getMemoryStats()`
- [x] `PassMetadata` via `getPassMetadata()`
- [x] `setPassEnabled(id, enabled)` method
- [x] `setGroupEnabled(group, enabled)` method
- [x] **PassGraph v2 Enhancements**
  - [x] Hot-swap passes without full rebuild (`graph.replace(id, newPass)`)
  - [x] Pass grouping with `PassGroup` enum (`sim`, `post`, `debug`)
  - [x] Conditional execution based on frame budgets
  - [x] GPU timestamp queries (true GPU timing via `setGpuTimingEnabled` + `resolveGpuTimingsAsync`)
  - [x] Visual node editor integration hooks (`getPassMetadata` + `subscribe`)

### 1.1 FieldRegistry v2: Smart Resource Management

- [x] Basic field registration and ping-pong
- [x] Resize method for dynamic resolution
- [x] Memory stats collection
- [x] **FieldRegistry v2 Enhancements**
  - [x] Lazy allocation (create textures on first use)
  - [x] Resolution tiers per field (`resolutionScale: 0.5`)
  - [x] Memory budget tracking with warnings
  - [x] Format auto-selection based on GPU capabilities (via `isFormatSupported` + `fallbackFormat`)
  - [x] Field aliasing (reuse textures across passes)

### 1.2 Node Registry: Plugin System

- [x] Create `ComputeNodeDefinition` interface
- [x] Create node registration API
- [x] Node discovery from filesystem/bundler (via dynamic importers, e.g. `import.meta.glob`)
- [x] Node metadata for visual editor
- [x] Example custom node template

---

## 2) Simulation Excellence

### 2.1 Physics Fidelity Upgrades

- [x] Semi-Lagrangian advection
- [x] MacCormack correction option
- [x] Vorticity confinement
- [x] Curl-noise turbulence
- [x] Boundary conditions (reflective + Neumann)
- [x] Soft wall thickness
- [ ] **P2: Advanced Physics**
  - [x] Staggered grid (MAC) option (projection mode)
  - [x] Multi-resolution pressure solver (2-level V-cycle)
  - [x] Multiple substeps per display frame
  - [x] Edge-aware vorticity confinement (obstacle-aware attenuation)
  - [x] Scale-dependent confinement (multi-radius blend)

### 2.2 Extended Physics Features

- [x] Temperature field
- [x] Temperature-driven buoyancy
- [ ] **P3: Additional Fields**
  - [x] Obstacle mask texture (paintable)
  - [x] Obstacle boundary enforcement (velocity/dye/temp masking)
  - [x] Multi-phase fluid (ink/oil/water) (RGB phases + per-channel buoyancy/dissipation)
  - [x] Combustion/reaction system (fuel -> heat)
  - [x] Fuel + temperature → fire (temperature -> dye injection)

---

## 3) Visual Rendering Mastery

### 3.1 Material System

- [x] Gradient-map texture pipeline
- [x] Ramp-by-density mode
- [x] Foam/edge highlights
- [x] Fresnel rim highlights
- [x] Medium absorption/scatter
- [ ] **P2: Material System v2**
  - [ ] Material preset definitions
  - [ ] Per-emitter material override
  - [ ] Multi-scale normal blending
  - [ ] Environment reflection sampling
  - [ ] Ramp-by-velocity mode
  - [ ] Ramp-by-vorticity mode

### 3.2 HDR + Lighting

- [x] HDR render target (rgba16float)
- [x] ACES tone mapping option
- [ ] **P2: Advanced Lighting**
  - [ ] Full filmic curve options
  - [ ] Directional light shading
  - [ ] Point light support
  - [ ] Emissive dye (self-illumination)

### 3.3 Velocity Visualization

- [ ] Streamlines mode
- [ ] Arrows grid mode
- [ ] Noise distortion mode
- [ ] Particle traces mode
- [ ] LIC (Line Integral Convolution)

---

## 4) PostFX Pipeline v3

### 4.1 Architecture Refactor

- [x] Basic PostFX pipeline
- [x] 8 effect nodes implemented
- [x] LUT 3D texture support
- [ ] **P1: Unified Pipeline**
  - [x] Single `PostFXPipelineV3.ts` manager
  - [x] Effect definition interface with UI metadata
  - [ ] Centralized resource loading/caching
  - [x] Effect reordering support
  - [x] Effect solo/bypass modes
  - [x] GPU cost estimation per effect

### 4.2 New Effects

- [x] Bloom (basic)
- [x] Chromatic aberration
- [x] Vignette
- [x] Film grain
- [x] Color grading
- [x] Sharpen/clarity
- [x] Motion blur (in-material taps)
- [ ] **P1: MRT Motion Blur**
  - [ ] MRT output (color + velocity)
  - [ ] Screen-space velocity calculation
  - [ ] Multi-sample motion blur kernel
- [ ] **P2: Additional Effects**
  - [ ] Halftone/dither
  - [ ] Trails/AfterImage v2
  - [ ] Selective color
  - [ ] Radial blur
  - [ ] Directional blur
  - [ ] Anamorphic lens flares

### 4.3 Post UI

- [ ] Stack-based PostFX panel
- [ ] Drag-to-reorder effects
- [ ] Per-effect enable toggle
- [ ] Effect presets
- [ ] A/B comparison mode
- [ ] GPU timing per effect

---

## 5) Studio UX Revolution

### 5.1 Panel Architecture

- [x] UnifiedPanel.tsx (103KB monolith)
- [ ] **P1: Modularization**
  - [ ] Extract `SimulationSection.tsx`
  - [ ] Extract `EmitterSection.tsx`
  - [ ] Extract `MaterialSection.tsx`
  - [ ] Extract `PostFXSection.tsx`
  - [ ] Extract `DebugSection.tsx`
  - [ ] Extract `PresetsSection.tsx`
  - [ ] Shared control components (`SliderControl`, `ColorControl`)

### 5.2 Preset System v2

- [x] Basic preset save/load
- [ ] **P2: Advanced Presets**
  - [ ] Preset categories (sim/visual/postfx/complete)
  - [ ] Thumbnail generation
  - [ ] Preset browser grid view
  - [ ] Tag-based search
  - [ ] Per-effect defaults
  - [ ] Preset import/export

### 5.3 Emitter Enhancements

- [x] 7 emitter types
- [x] Emitter selection + gizmos
- [ ] **P3: Advanced Emitters**
  - [ ] Emitter timeline (keyframes)
  - [ ] Position/rotation animation
  - [ ] Color/intensity over time
  - [ ] Spline path following
  - [ ] Array instancing (grid, radial)
  - [ ] Per-instance variation

### 5.4 Audio Reactive v2

- [x] Basic audio analyzer
- [ ] **P3: Audio System v2**
  - [ ] Multi-band analysis (bass/mid/high)
  - [ ] Beat detection + BPM
  - [ ] Envelope followers
  - [ ] FFT visualization in UI
  - [ ] Per-emitter audio parameter bindings

---

## 6) Performance Optimization

### 6.1 Splat System

- [x] CPU splat queue with backlog cap
- [x] Tiled in-place splats (bounds dispatch)
- [x] `splatTiledEnabled` config option
- [x] **GPU Splat Batching** → `SplatBatch.ts`
  - [x] GPU buffer for splat list (StorageBufferAttribute)
  - [x] Single compute dispatch for all splats
  - [x] `createBatchedVelocitySplatNode()` and `createBatchedDyeSplatNode()`
  - [ ] 1000+ splats per frame target

### 6.2 Resolution Scaling

- [x] Dynamic grid/dye resolution
- [x] FPS-based auto quality
- [x] Quality bounds + cooldown
- [ ] **P2: Advanced Scaling**
  - [x] PostFX internal downsample chain
  - [ ] Per-effect resolution scale
  - [ ] Temporal reprojection for expensive effects
  - [ ] Quality presets (Ultra/High/Medium/Low)

### 6.3 Compute Optimization

- [x] Ping-pong state tracking
- [ ] **P3: Advanced Compute**
  - [ ] Pass merging (combine compatible passes)
  - [ ] Async compute where beneficial
  - [ ] Workgroup size auto-tuning
  - [ ] Memory barrier optimization

---

## 7) Developer Experience

### 7.1 Debug Tooling

- [x] Debug field views (velocity/pressure/divergence/vorticity/dye)
- [x] Performance HUD (FPS + per-pass timing)
- [x] PassMetadata exposure
- [ ] **P2: Enhanced Debug**
  - [ ] Field statistics (min/max/mean)
  - [ ] Field histogram visualization
  - [ ] Pass graph visual editor
  - [ ] GPU profiler integration
  - [x] Memory usage display

### 7.2 Documentation

- [ ] TypeDoc API generation
- [ ] Interactive examples
- [ ] Node creation tutorial
- [ ] Effect creation tutorial

### 7.3 Testing

- [ ] Vitest unit tests for utilities
- [ ] Visual regression tests
- [ ] Performance baseline tests
- [ ] Browser compatibility matrix

---

## 8) Advanced Features (Phase 4+)

- [ ] 3D fluid simulation (StorageTexture3D)
- [ ] Volume raymarching renderer
- [ ] GPU particle coupling
- [ ] FLIP/PIC hybrid methods
- [ ] Neural style transfer
- [ ] Learned super-resolution
- [ ] Video export (WebCodecs)
- [ ] Image sequence export

---

## 9) Production Readiness

- [x] WebGPU availability detection
- [ ] **P3: Robustness**
  - [ ] Device lost recovery
  - [ ] Graceful fallback UI
  - [ ] Error boundary components
  - [ ] Telemetry (opt-in)
  - [ ] Crash reporting

---

## Priority Summary

### P0 - Immediate (1-2 weeks)
- [x] ~~Tiled splat injection~~
- [ ] MRT motion blur
- [x] GPU splat batching (buffer-based)
- [x] PostFX unified pipeline

### P1 - Short-term (2-4 weeks)
- [x] Panel modularization (`packages/studio/panels/unified/controls.tsx`)
- [x] Material preset system (`MaterialPresets.ts`, `MaterialPresetPicker.tsx`)
- [x] Enhanced debug tools (`PerformanceHUD.tsx`)
- [x] Effect reordering UI (basic up/down exists)
### P2 — Medium-term (1-2 months)
- [ ] Advanced lighting
- [ ] Preset browser
- [ ] Resolution scaling v2
- [ ] Audio reactive v2

### P3 — Long-term (3+ months)

- [ ] 3D simulation
- [ ] Export features

---

## Acceptance Criteria

### Visual Excellence
- [ ] 5+ distinct "hero looks" via presets
- [ ] Motion blur matches reference footage
- [ ] HDR bloom without clipping

### Performance
- [ ] 60 FPS at 512x512 grid + 1024 dye
- [ ] <16ms total frame time with PostFX
- [ ] 100+ simultaneous emitters

### Usability
- [ ] New user achieves results in <2 minutes
- [ ] All panels independently collapsible
- [ ] Full undo/redo support

### Stability
- [ ] No device-lost crashes
- [ ] Graceful fallback messaging
- [ ] All presets load without errors
