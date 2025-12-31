# FluidStudio TSL — Visual Excellence & Material System Upgrade Proposal

> **Vision**: Elevate FluidStudio into a **professional creative tool** with industry-leading visual fidelity through a unified, node-graph-driven **Material & Color System** built natively on Three.js TSL.

---

## Executive Summary

This proposal outlines a comprehensive upgrade path for FluidStudio TSL focused on three pillars:

1. **TSL Material Node System** — A node-graph-driven material architecture that unifies visual styling through composable TSL nodes
2. **Visual Polish & Rendering Excellence** — Enhanced shading, lighting, and material presets for "hero look" quality
3. **Pipeline Integration** — Seamless integration with existing `PassGraph`, `FieldRegistry`, and `ComputeNodeRegistry` infrastructure

---

## Current State Assessment

### Strengths ✅

| Component | Status | Quality |
|-----------|--------|---------|
| [PassGraph](file:///c:/Users/ARTDESKTOP/Desktop/CODE/.DEC/Fluidstudio_tsl/packages/fluid-2d/core/PassGraph.ts) | Excellent | Dependency ordering, GPU timing, group enable |
| [FieldRegistry](file:///c:/Users/ARTDESKTOP/Desktop/CODE/.DEC/Fluidstudio_tsl/packages/fluid-2d/core/FieldRegistry.ts) | Excellent | Lazy allocation, resolution tiers, aliasing |
| [ComputeNodeRegistry](file:///c:/Users/ARTDESKTOP/Desktop/CODE/.DEC/Fluidstudio_tsl/packages/fluid-2d/core/ComputeNodeRegistry.ts) | Scaffolded | Plugin architecture ready |
| [MaterialPresets](file:///c:/Users/ARTDESKTOP/Desktop/CODE/.DEC/Fluidstudio_tsl/packages/fluid-2d/render/MaterialPresets.ts) | Good | 14 presets, 6 categories |
| [PostEffectDefinition](file:///c:/Users/ARTDESKTOP/Desktop/CODE/.DEC/Fluidstudio_tsl/packages/fluid-2d/postfx/types.ts) | Good | UI metadata pattern established |

### Areas for Improvement 🔧

| Area | Current State | Target State |
|------|---------------|--------------|
| Material System | Flat config object (100+ fields) | Node-graph composable materials |
| Color Pipeline | Scattered across components | Unified TSL color processing chain |
| Visual Presets | Config-based only | Visual node presets + thumbnails |
| Shading Model | Basic gradient + fresnel | Multi-layer physically-inspired shading |
| Node Editor Integration | Scaffolded but unused | Full visual material editor hooks |

---

## 1) TSL Material Node System

### 1.1 Architecture: `MaterialNodeDefinition`

Create a unified node definition mirroring `PostEffectDefinition` and `ComputeNodeDefinition`:

```typescript
// packages/fluid-2d/materials/types.ts [NEW]

export type MaterialNodeCategory = 
  | 'input'      // Field samplers (dye, velocity, pressure, temp)
  | 'transform'  // UV transforms, distortion
  | 'color'      // Color operations (ramp, palette, grading)
  | 'shading'    // Normals, fresnel, lighting
  | 'composite'  // Blend modes, masking
  | 'output';    // Final output

export interface MaterialNodePort {
  id: string;
  label: string;
  type: 'color' | 'float' | 'vec2' | 'vec3' | 'vec4' | 'texture';
  default?: any;
}

export interface MaterialNodeDefinition<TParams = unknown> {
  id: string;
  label: string;
  category: MaterialNodeCategory;
  
  inputs: MaterialNodePort[];
  outputs: MaterialNodePort[];
  params: Record<string, MaterialNodeParam>;
  
  // TSL build function (composable)
  build: (
    inputs: Record<string, ShaderNodeObject>,
    params: Record<string, UniformNode>,
    context: MaterialBuildContext
  ) => Record<string, ShaderNodeObject>;
  
  icon?: string;
  gpuCost?: number;
  documentation?: string;
}
```

### 1.2 Core Material Nodes [NEW]

#### Input Nodes
| Node | Purpose | Outputs |
|------|---------|---------|
| `DyeSampler` | Sample dye field with ping-pong awareness | color, density |
| `VelocitySampler` | Sample velocity field | velocity, speed, direction |
| `PressureSampler` | Sample pressure field | pressure, gradient |
| `VorticitySampler` | Sample vorticity/curl | vorticity, sign |
| `TemperatureSampler` | Sample temperature field | temperature |

#### Transform Nodes
| Node | Purpose | I/O |
|------|---------|-----|
| `UVDistort` | Velocity-based UV distortion | uv → uv |
| `UVTile` | Tiling and offset | uv → uv |
| `UVRotate` | Rotation around center | uv → uv |

#### Color Nodes
| Node | Purpose | I/O |
|------|---------|-----|
| `ColorRamp` | Map scalar to gradient | float → color |
| `PaletteMap` | Map via palette (low/mid/high) | float → color |
| `HueShift` | HSL hue rotation | color → color |
| `Saturation` | Saturation adjustment | color → color |
| `Contrast` | Contrast curve | color → color |
| `LUTApply` | 3D LUT application | color → color |
| `ColorGrade` | Temperature/tint/lift/gamma/gain | color → color |

#### Shading Nodes
| Node | Purpose | I/O |
|------|---------|-----|
| `NormalFromGradient` | Derive normal from density gradient | density → normal |
| `FresnelRim` | Fresnel-based rim lighting | normal → color |
| `DirectionalShade` | Directional light shading | normal → color |
| `Foam` | Speed/vorticity-based foam mask | velocity, vorticity → float |
| `Specular` | Specular highlight | normal → color |
| `Subsurface` | Subsurface scatter approximation | density → color |

#### Composite Nodes
| Node | Purpose | I/O |
|------|---------|-----|
| `Blend` | Blend modes (normal, add, multiply, screen, overlay) | color, color → color |
| `Mask` | Mask application | color, float → color |
| `AlphaOver` | Alpha compositing | color, color → color |

---

### 1.3 Module Structure

```
packages/fluid-2d/materials/         [NEW DIRECTORY]
├── types.ts                         # MaterialNodeDefinition, ports, context
├── MaterialNodeRegistry.ts          # Registry (mirrors ComputeNodeRegistry)
├── MaterialGraph.ts                 # Graph builder / evaluator
├── nodes/
│   ├── index.ts
│   ├── input/
│   │   ├── DyeSampler.ts
│   │   ├── VelocitySampler.ts
│   │   ├── PressureSampler.ts
│   │   └── ...
│   ├── transform/
│   │   ├── UVDistort.ts
│   │   └── ...
│   ├── color/
│   │   ├── ColorRamp.ts
│   │   ├── PaletteMap.ts
│   │   ├── HueShift.ts
│   │   ├── LUTApply.ts
│   │   └── ...
│   ├── shading/
│   │   ├── NormalFromGradient.ts
│   │   ├── FresnelRim.ts
│   │   ├── Foam.ts
│   │   └── ...
│   └── composite/
│       ├── Blend.ts
│       └── Mask.ts
├── presets/
│   ├── WaterMaterial.ts
│   ├── FireMaterial.ts
│   ├── SmokeMaterial.ts
│   └── ...
└── index.ts
```

---

## 2) Material Graph Execution

### 2.1 `MaterialGraph` Class

```typescript
// packages/fluid-2d/materials/MaterialGraph.ts [NEW]

export interface MaterialGraphNode {
  id: string;
  type: string;  // MaterialNodeDefinition.id
  params: Record<string, unknown>;
  position?: { x: number; y: number };  // For visual editor
}

export interface MaterialGraphEdge {
  from: { node: string; port: string };
  to: { node: string; port: string };
}

export interface MaterialGraphData {
  nodes: MaterialGraphNode[];
  edges: MaterialGraphEdge[];
  outputNode: string;  // ID of the final output node
}

export class MaterialGraph {
  private registry: MaterialNodeRegistry;
  private data: MaterialGraphData;
  private compiledNode: ShaderNodeObject | null = null;
  private uniforms: Map<string, UniformNode> = new Map();
  
  constructor(registry: MaterialNodeRegistry, data: MaterialGraphData) {
    this.registry = registry;
    this.data = data;
  }
  
  // Compile graph to single TSL node
  compile(context: MaterialBuildContext): ShaderNodeObject {
    // Topological sort + build each node
    // Connect outputs → inputs via edge definitions
    // Return final output node
  }
  
  // Update uniform values (hot path, no rebuild)
  updateParams(nodeId: string, params: Record<string, unknown>): void;
  
  // Serialize for preset save
  toJSON(): MaterialGraphData;
  
  // Visual editor: get metadata for all nodes
  getNodeMetadata(): MaterialNodeMetadata[];
}
```

### 2.2 Integration with FluidCanvas2D

```typescript
// In FluidCanvas2D.tsx or a new MaterialRenderer component

// Option A: Direct graph evaluation in the present shader
const materialGraph = useMemo(() => {
  const graph = new MaterialGraph(materialRegistry, activePreset.graphData);
  return graph.compile({ dyeTexture, velocityTexture, ... });
}, [activePreset, materialRegistry]);

// The compiled TSL node replaces the current material expression
const presentMaterial = new MeshBasicNodeMaterial();
presentMaterial.colorNode = materialGraph;  // ← TSL node from graph
```

---

## 3) Visual Polish Upgrades

### 3.1 Enhanced Shading Model

#### Multi-Layer Shading Pipeline

```
┌─────────────┐    ┌───────────────┐    ┌──────────────┐    ┌────────────┐
│ Base Color  │ →  │ Normal/Shading│ →  │ Fresnel/Rim  │ →  │ Foam/Edge  │ → Output
│ (Ramp/LUT)  │    │ (Gradient)    │    │ (Highlight)  │    │ (Detail)   │
└─────────────┘    └───────────────┘    └──────────────┘    └────────────┘
```

#### [MODIFY] [RenderOutput2D.ts](file:///c:/Users/ARTDESKTOP/Desktop/CODE/.DEC/Fluidstudio_tsl/packages/fluid-2d/render/RenderOutput2D.ts)

Add new shading parameters:

```typescript
// Add to RenderOutput2DConfig

// === Normal/Shading ===
normalSmoothRadius: number;    // Blur radius for gradient normal
normalStrength: number;        // Normal intensity

// === Multi-Layer Shading ===
shadingMode: 'flat' | 'soft' | 'dramatic' | 'physical';
ambientColor: [number, number, number];
lightDirection: [number, number, number];
lightIntensity: number;
shadowSoftness: number;

// === Specular ===
specularEnabled: boolean;
specularIntensity: number;
specularPower: number;
specularColor: [number, number, number];

// === Subsurface ===
subsurfaceEnabled: boolean;
subsurfaceColor: [number, number, number];
subsurfaceIntensity: number;
subsurfaceDistortion: number;

// === Foam V2 ===
foamMultiScale: boolean;
foamScales: [number, number, number];  // 3 scale levels
foamWeights: [number, number, number];
```

### 3.2 Color Ramp System V2

#### [NEW] `ColorRampNode.ts`

```typescript
// packages/fluid-2d/materials/nodes/color/ColorRampNode.ts

export interface ColorStop {
  position: number;  // 0-1
  color: [number, number, number, number];  // RGBA
}

export const colorRampNode: MaterialNodeDefinition = {
  id: 'colorRamp',
  label: 'Color Ramp',
  category: 'color',
  
  inputs: [
    { id: 'factor', label: 'Factor', type: 'float', default: 0 }
  ],
  outputs: [
    { id: 'color', label: 'Color', type: 'color' }
  ],
  params: {
    stops: {
      label: 'Color Stops',
      type: 'colorStops',  // Custom UI type
      default: [
        { position: 0, color: [0, 0, 0, 1] },
        { position: 1, color: [1, 1, 1, 1] }
      ]
    },
    interpolation: {
      label: 'Interpolation',
      type: 'enum',
      default: 'linear',
      options: [
        { label: 'Linear', value: 'linear' },
        { label: 'Smooth', value: 'smooth' },
        { label: 'Step', value: 'step' },
        { label: 'B-Spline', value: 'bspline' }
      ]
    }
  },
  
  build: (inputs, params, context) => {
    // Generate TSL gradient evaluation
    const factor = inputs.factor;
    const stops = params.stops;
    
    // Build multi-stop gradient interpolation
    return { color: evaluateGradient(factor, stops) };
  }
};
```

### 3.3 Environment & Lighting

#### [NEW] `EnvironmentNode.ts`

```typescript
export const environmentNode: MaterialNodeDefinition = {
  id: 'environment',
  label: 'Environment',
  category: 'shading',
  
  inputs: [
    { id: 'normal', label: 'Normal', type: 'vec3' }
  ],
  outputs: [
    { id: 'reflection', label: 'Reflection', type: 'color' },
    { id: 'ambient', label: 'Ambient', type: 'color' }
  ],
  params: {
    envMap: { label: 'Environment Map', type: 'texture' },
    intensity: { label: 'Intensity', type: 'float', default: 1, min: 0, max: 5 },
    roughness: { label: 'Roughness', type: 'float', default: 0.5, min: 0, max: 1 }
  },
  
  build: (inputs, params, context) => {
    // Sample environment map based on reflected normal
    // Apply roughness as blur level
  }
};
```

---

## 4) Material Preset System V2

### 4.1 Graph-Based Presets

Each preset becomes a serialized `MaterialGraphData`:

```typescript
// packages/fluid-2d/materials/presets/WaterMaterial.ts

export const waterMaterialPreset: MaterialPresetV2 = {
  id: 'water-v2',
  name: 'Crystal Water V2',
  description: 'Clear water with caustic-like highlights and subsurface',
  category: 'liquid',
  thumbnail: 'water_thumb.png',
  
  // The actual graph data
  graph: {
    nodes: [
      { id: 'dye', type: 'dyeSampler', params: {} },
      { id: 'velocity', type: 'velocitySampler', params: {} },
      { id: 'ramp', type: 'colorRamp', params: { 
        stops: [
          { position: 0, color: [0.05, 0.15, 0.3, 1] },
          { position: 0.5, color: [0.2, 0.5, 0.8, 1] },
          { position: 1, color: [0.8, 0.95, 1, 1] }
        ]
      }},
      { id: 'normal', type: 'normalFromGradient', params: { smoothRadius: 2 } },
      { id: 'fresnel', type: 'fresnelRim', params: { power: 3, intensity: 0.4 } },
      { id: 'foam', type: 'foam', params: { threshold: 0.2, intensity: 0.5 } },
      { id: 'blend1', type: 'blend', params: { mode: 'add' } },
      { id: 'output', type: 'output', params: {} }
    ],
    edges: [
      { from: { node: 'dye', port: 'density' }, to: { node: 'ramp', port: 'factor' } },
      { from: { node: 'dye', port: 'density' }, to: { node: 'normal', port: 'density' } },
      { from: { node: 'ramp', port: 'color' }, to: { node: 'blend1', port: 'a' } },
      { from: { node: 'fresnel', port: 'color' }, to: { node: 'blend1', port: 'b' } },
      // ...
    ],
    outputNode: 'output'
  },
  
  // Legacy fallback config (for compatibility)
  legacyConfig: { ... }
};
```

### 4.2 Preset Browser UI

#### [NEW] `MaterialPresetBrowser.tsx`

- Grid view with thumbnails
- Category filtering (liquid, fire, smoke, abstract, stylized, cinematic)
- Search by name/tags
- Preview on hover
- One-click apply
- "Edit in Node Graph" button

---

## 5) Node Graph Visual Editor Integration

### 5.1 Hooks for External Editor

The `MaterialGraph` and `MaterialNodeRegistry` expose all metadata needed for a visual editor:

```typescript
// API for visual node editor (e.g. Rete.js, React Flow)

// Get all available nodes with their ports/params
materialRegistry.list(): MaterialNodeDefinition[]

// Get current graph structure for visualization
materialGraph.toJSON(): MaterialGraphData

// Update graph from editor
materialGraph.fromJSON(data: MaterialGraphData): void

// Real-time param updates
materialGraph.updateParams(nodeId, params): void

// Compile after structural changes
materialGraph.compile(context): ShaderNodeObject
```

### 5.2 Integration Points

| Component | Integration |
|-----------|-------------|
| `PassGraph` | Material compilation as a "material pass" |
| `FieldRegistry` | Access field textures via registry |
| `ComputeNodeRegistry` | Parallel pattern for compute nodes |
| `PostEffectDefinition` | Same param/UI metadata pattern |

---

## 6) Implementation Phases

### Phase 1: Foundation (1-2 weeks)

1. Create `packages/fluid-2d/materials/` directory structure
2. Implement `MaterialNodeDefinition` and `MaterialNodeRegistry`
3. Implement core input nodes (DyeSampler, VelocitySampler)
4. Implement basic color nodes (ColorRamp, PaletteMap)
5. Create `MaterialGraph` evaluator (no visual editor yet)
6. Wire into `FluidCanvas2D` as alternative material mode

### Phase 2: Shading Excellence (1-2 weeks)

1. Implement shading nodes (NormalFromGradient, FresnelRim, Foam)
2. Add specular and subsurface nodes
3. Implement blend/composite nodes
4. Create 5 "hero" graph-based presets
5. Add preset browser UI skeleton

### Phase 3: Color Pipeline (1 week)

1. Implement full ColorRamp with multi-stop gradients
2. Add HSL nodes (HueShift, Saturation, Lightness)
3. Implement LUT node with improved loading
4. Add ColorGrade node (lift/gamma/gain)

### Phase 4: Visual Editor Integration (2-3 weeks)

1. Document node metadata API
2. Create React Flow or Rete.js adapter component
3. Implement bidirectional sync (graph ↔ editor)
4. Add preset save/load from editor
5. Thumbnail generation for presets

---

## 7) File Changes Summary

### New Files
| Path | Purpose |
|------|---------|
| `packages/fluid-2d/materials/types.ts` | Core type definitions |
| `packages/fluid-2d/materials/MaterialNodeRegistry.ts` | Node registry |
| `packages/fluid-2d/materials/MaterialGraph.ts` | Graph evaluator |
| `packages/fluid-2d/materials/nodes/input/*.ts` | Input sampler nodes |
| `packages/fluid-2d/materials/nodes/color/*.ts` | Color processing nodes |
| `packages/fluid-2d/materials/nodes/shading/*.ts` | Shading nodes |
| `packages/fluid-2d/materials/nodes/composite/*.ts` | Blend/mask nodes |
| `packages/fluid-2d/materials/presets/*.ts` | Graph-based presets |

### Modified Files
| Path | Changes |
|------|---------|
| [RenderOutput2D.ts](file:///c:/Users/ARTDESKTOP/Desktop/CODE/.DEC/Fluidstudio_tsl/packages/fluid-2d/render/RenderOutput2D.ts) | Add new shading/color params |
| [FluidCanvas2D.tsx](file:///c:/Users/ARTDESKTOP/Desktop/CODE/.DEC/Fluidstudio_tsl/packages/fluid-2d/components/FluidCanvas2D.tsx) | Integrate MaterialGraph |
| [MaterialPresets.ts](file:///c:/Users/ARTDESKTOP/Desktop/CODE/.DEC/Fluidstudio_tsl/packages/fluid-2d/render/MaterialPresets.ts) | Add V2 graph presets |

---

## 8) Acceptance Criteria

### Visual Excellence
- [ ] 5+ "hero look" presets achievable via node graph
- [ ] Smooth gradient color ramps with 8+ stops
- [ ] Fresnel rim + specular highlights with adjustable roughness
- [ ] Multi-scale foam rendering
- [ ] Subsurface scatter for liquid feels

### Architecture
- [ ] `MaterialNodeDefinition` mirrors `PostEffectDefinition` pattern
- [ ] `MaterialGraph` compiles to single TSL node
- [ ] Hot uniform updates without recompilation
- [ ] Preset serialization/deserialization works round-trip

### Integration
- [ ] Material graph nodes visible in debug metadata
- [ ] compatible with existing `PassGraph` timing
- [ ] No performance regression vs current flat material

### Editor Ready
- [ ] All node definitions have complete UI metadata
- [ ] Graph can be visualized in React Flow / Rete.js
- [ ] Live preview updates on param change

---

## 9) Verification Plan

### Automated Testing
> **Note**: The project doesn't currently have a test framework configured. We recommend adding Vitest for unit tests.

1. **Type checking**: `npx tsc --noEmit` to verify all new types compile
2. **Registry tests**: Unit tests for `MaterialNodeRegistry` operations
3. **Graph compilation tests**: Verify graph serialization/deserialization

### Manual Verification

1. **Build verification**: Run `npm run dev` and verify no console errors
2. **Visual comparison**: 
   - Apply each of the 5 new presets
   - Compare side-by-side with current presets
   - Verify improved visual quality
3. **Performance check**:
   - Enable PerformanceHUD
   - Verify material pass timing < 2ms at 1080p
4. **Preset round-trip**:
   - Save a custom graph preset
   - Reload application
   - Verify preset loads correctly

---

---

> [!IMPORTANT]
> This proposal focuses on creating the **foundation** for a visual node editor without implementing the full editor UI. The node system architecture is designed to be editor-agnostic, supporting future integration with React Flow, Rete.js, or custom solutions.

---

## 10) Three.js Native TSL Node Integration

### 10.1 Philosophy: Build on Three.js TSL Foundation

Rather than reinventing the wheel, FluidStudio should **leverage Three.js's native TSL node system** as its foundation. This provides:

- **Full compatibility** with Three.js updates and examples
- **Access to 130+ battle-tested nodes** across 17 categories
- **Consistent API patterns** with the broader ecosystem
- **GPU-optimized implementations** maintained by the Three.js team

### 10.2 Three.js TSL Node Catalog (r182+)

#### Core Nodes (available via `three/tsl`)

| Category | Key Nodes | Description |
|----------|-----------|-------------|
| **Math** | `add`, `mul`, `sub`, `div`, `pow`, `sqrt`, `sin`, `cos`, `tan`, `abs`, `floor`, `ceil`, `clamp`, `mix`, `smoothstep`, `step`, `dot`, `cross`, `normalize`, `length` | Full GLSL math operations |
| **Flow Control** | `If`, `Loop`, `Switch`, `Discard`, `Return`, `Break`, `Continue` | Shader control flow |
| **Variables** | `uniform`, `attribute`, `varying`, `Var`, `Const` | Shader variable types |
| **Functions** | `Fn`, `wgslFn`, `glslFn`, `FunctionNode` | Custom functions |

#### Display Nodes (for color/output processing)

| Node | Purpose | Import |
|------|---------|--------|
| `luminance` | Compute luminance from RGB | `three/tsl` |
| `saturation` | Super-saturate/desaturate color | `three/tsl` (ColorAdjustment) |
| `vibrance` | Natural color enhancement | `three/tsl` (ColorAdjustment) |
| `hue` | Hue rotation | `three/tsl` (ColorAdjustment) |
| `grayscale` | Convert to grayscale | `three/tsl` (ColorAdjustment) |
| `cdl` | Color Decision List grading | `three/tsl` (ColorAdjustment) |
| `renderOutput` | Final render transformation | `three/tsl` |
| `toneMappingExposure` | Tone mapping | `three/tsl` |

#### Blend Modes (from `BlendModes.js`)

| Function | Description |
|----------|-------------|
| `blendNormal` | Standard alpha blend |
| `blendAdd` | Additive blend |
| `blendMultiply` | Multiply blend |
| `blendScreen` | Screen blend |
| `blendOverlay` | Overlay blend |
| `blendDodge` | Color dodge |
| `blendBurn` | Color burn |

#### Utility Nodes

| Node | Purpose |
|------|---------|
| `oscSine`, `oscSquare`, `oscSawtooth`, `oscTriangle` | Oscillators for animation |
| `timer`, `timerLocal`, `timerGlobal`, `timerDelta` | Time uniforms |
| `rotate`, `rotateUV` | Rotation utilities |
| `remap` | Remap value range |
| `Loop` | GPU loop for iterations |
| `vec2`, `vec3`, `vec4`, `mat3`, `mat4` | Vector/matrix constructors |

### 10.3 Existing Local TSL Nodes

Already in `packages/fluid-2d/three-tsl/display/`:

| File | Status | Notes |
|------|--------|-------|
| [AfterImageNode.js](file:///c:/Users/ARTDESKTOP/Desktop/CODE/.DEC/Fluidstudio_tsl/packages/fluid-2d/three-tsl/display/AfterImageNode.js) | ✅ Local | Frame persistence effect |
| [BloomNode.js](file:///c:/Users/ARTDESKTOP/Desktop/CODE/.DEC/Fluidstudio_tsl/packages/fluid-2d/three-tsl/display/BloomNode.js) | ✅ Local | Multi-mip bloom |
| [ChromaticAberrationNode.js](file:///c:/Users/ARTDESKTOP/Desktop/CODE/.DEC/Fluidstudio_tsl/packages/fluid-2d/three-tsl/display/ChromaticAberrationNode.js) | ✅ Local | Chromatic shift |
| [FXAANode.js](file:///c:/Users/ARTDESKTOP/Desktop/CODE/.DEC/Fluidstudio_tsl/packages/fluid-2d/three-tsl/display/FXAANode.js) | ✅ Local | Anti-aliasing |
| [FilmNode.js](file:///c:/Users/ARTDESKTOP/Desktop/CODE/.DEC/Fluidstudio_tsl/packages/fluid-2d/three-tsl/display/FilmNode.js) | ✅ Local | Film grain |
| [RGBShiftNode.js](file:///c:/Users/ARTDESKTOP/Desktop/CODE/.DEC/Fluidstudio_tsl/packages/fluid-2d/three-tsl/display/RGBShiftNode.js) | ✅ Local | RGB shift |
| [TrailNode.ts](file:///c:/Users/ARTDESKTOP/Desktop/CODE/.DEC/Fluidstudio_tsl/packages/fluid-2d/three-tsl/display/TrailNode.ts) | ✅ Local | Motion trails |

### 10.4 Recommended Local Imports (for Independence)

Copy from `node_modules/three/src/nodes/` to `packages/fluid-2d/three-tsl/`:

#### Priority 1: Color Processing
```
display/
├── ColorAdjustment.js     # saturation, vibrance, hue, luminance, cdl
├── BlendModes.js          # All blend mode functions
├── ColorSpaceFunctions.js # sRGB/linear conversion
└── ToneMappingFunctions.js # ACES, Reinhard, etc.
```

#### Priority 2: Animation & Motion
```
utils/
├── Oscillators.js         # oscSine, oscSquare, etc.
├── Timer.js               # timerLocal, timerGlobal, timerDelta
└── RotateNode.js          # rotate, rotateUV
```

#### Priority 3: Post-Processing
```
display/
├── GaussianBlurNode.js    # From examples/jsm
├── MotionBlurNode.js      # Motion blur with velocity
├── SSRNode.js             # Screen-space reflections
└── DenoiseNode.js         # Temporal anti-aliasing/denoise
```

#### Priority 4: Procedural
```
procedural/
├── Checker.js             # Procedural checker pattern
└── noise/                 # Perlin, simplex, etc. (from examples)
```

### 10.5 Integration Strategy

#### Option A: Direct Import (Recommended)

Use Three.js exports directly and supplement with local extensions:

```typescript
// Direct use of Three.js TSL
import { 
  luminance, saturation, vibrance, hue,
  mix, smoothstep, vec3, vec4, float, uniform, Fn
} from 'three/tsl';

// Local fluid-specific nodes
import { dyeSamplerNode } from './materials/nodes/input/DyeSampler';
```

#### Option B: Wrapper Registry

Create thin wrappers to integrate Three.js nodes into MaterialNodeRegistry:

```typescript
// packages/fluid-2d/materials/three-tsl-bridge.ts

import { saturation, vibrance, hue, luminance } from 'three/tsl';
import { registerMaterialNode } from './MaterialNodeRegistry';
import type { MaterialNodeDefinition } from './types';

// Wrap Three.js saturation as a MaterialNodeDefinition
export const saturationNode: MaterialNodeDefinition = {
  id: 'saturation',
  label: 'Saturation',
  category: 'color',
  gpuCost: 1,
  inputs: [
    { id: 'color', label: 'Color', type: 'color' },
    { id: 'amount', label: 'Amount', type: 'float', default: 1 }
  ],
  outputs: [
    { id: 'color', label: 'Color', type: 'color' }
  ],
  params: {
    amount: { label: 'Amount', type: 'float', default: 1, min: 0, max: 2, step: 0.01 }
  },
  build: (inputs, params, context) => {
    const color = inputs.color ?? vec3(1, 1, 1);
    return { color: saturation(color, params.amount) };
  }
};

registerMaterialNode(saturationNode);
```

### 10.6 Compatibility Guidelines

#### Port Types Mapping

| Our Type | Three.js TSL | Notes |
|----------|--------------|-------|
| `float` | `float()`, `uniform(0)` | Scalar values |
| `vec2` | `vec2()` | 2D coordinates, UV |
| `vec3` | `vec3()` | RGB colors, positions |
| `vec4` | `vec4()` | RGBA colors |
| `color` | `vec3()` or `vec4()` | Color values |
| `texture` | `texture()`, `storageTexture()` | Texture samplers |

#### Pattern Compatibility

Our nodes use the same TSL patterns as Three.js:

```typescript
// Three.js pattern
const myEffect = Fn(([color, amount]) => {
  return color.mul(amount);
});

// Our pattern (identical)
build: (inputs, params, context) => {
  const color = inputs.color;
  return { out: color.mul(params.amount) };
}
```

### 10.7 Module Structure Update

Extend `three-tsl/` with organized categories:

```
packages/fluid-2d/three-tsl/
├── display/           # ✅ Existing (7 files)
│   ├── BloomNode.js
│   ├── FXAANode.js
│   └── ...
├── color/             # [NEW] Color processing
│   ├── ColorAdjustment.ts   # Local TS adaptation
│   ├── BlendModes.ts
│   └── ToneMappingFunctions.ts
├── utils/             # [NEW] Utilities
│   ├── Oscillators.ts
│   ├── Timer.ts
│   └── RotateNode.ts
├── procedural/        # [NEW] Procedural generation
│   ├── Noise.ts       # Unified noise functions
│   └── Checker.ts
└── index.ts           # Re-export all
```

### 10.8 Implementation Checklist

- [x] Copy and adapt ColorAdjustment.js functions to local TS (`packages/fluid-2d/three-tsl/color/ColorEffects.ts`, `packages/fluid-2d/materials/three-tsl-bridge.ts`)
- [x] Copy BlendModes.js for local blend mode access (local blend nodes + `packages/fluid-2d/three-tsl/color/ColorEffects.ts`)
- [x] Create `three-tsl-bridge.ts` with `MaterialNodeDefinition` wrappers (`packages/fluid-2d/materials/three-tsl-bridge.ts`)
- [x] Add oscillator nodes from Oscillators.js (`oscSine`, `oscTriangle` in `packages/fluid-2d/materials/three-tsl-bridge.ts`)
- [x] Add RotateNode for UV rotation effects (`packages/fluid-2d/materials/nodes/transform/UVRotate.ts`)
- [ ] Document which nodes come from Three.js vs custom
- [ ] Create type definitions for all local TSL nodes
- [ ] Test compatibility with Three.js r182+ updates

---

## 11) Acceptance Criteria (Updated)

### Visual Excellence
- [ ] 5+ "hero look" presets achievable via node graph
- [ ] Smooth gradient color ramps with 8+ stops
- [ ] Fresnel rim + specular highlights with adjustable roughness
- [ ] Multi-scale foam rendering
- [ ] Subsurface scatter for liquid feels

### Architecture
- [ ] `MaterialNodeDefinition` mirrors `PostEffectDefinition` pattern
- [ ] `MaterialGraph` compiles to single TSL node
- [ ] Hot uniform updates without recompilation
- [ ] Preset serialization/deserialization works round-trip

### Three.js Integration
- [ ] Full compatibility with `three/tsl` imports
- [ ] Local TSL nodes can be used interchangeably with Three.js nodes
- [ ] All color processing uses Three.js ColorAdjustment functions
- [ ] Blend modes from BlendModes.js work in material nodes

### Integration
- [ ] Material graph nodes visible in debug metadata
- [ ] Compatible with existing `PassGraph` timing
- [ ] No performance regression vs current flat material

### Editor Ready
- [ ] All node definitions have complete UI metadata
- [ ] Graph can be visualized in React Flow / Rete.js
- [ ] Live preview updates on param change

---

## 12) Verification Plan

### Automated Testing
> **Note**: The project doesn't currently have a test framework configured. We recommend adding Vitest for unit tests.

1. **Type checking**: `npx tsc --noEmit` to verify all new types compile
2. **Registry tests**: Unit tests for `MaterialNodeRegistry` operations
3. **Graph compilation tests**: Verify graph serialization/deserialization

### Manual Verification

1. **Build verification**: Run `npm run dev` and verify no console errors
2. **Visual comparison**: 
   - Apply each of the 5 new presets
   - Compare side-by-side with current presets
   - Verify improved visual quality
3. **Performance check**:
   - Enable PerformanceHUD
   - Verify material pass timing < 2ms at 1080p
4. **Preset round-trip**:
   - Save a custom graph preset
   - Reload application
   - Verify preset loads correctly
5. **Three.js TSL compatibility**:
   - Verify `saturation()`, `luminance()`, `hue()` work in material nodes
   - Test blend mode compositions
   - Confirm oscillators animate correctly
