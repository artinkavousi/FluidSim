/**
 * @package fluid-2d
 * Core type definitions for 2D fluid simulation
 */

// ============================================
// Vector & Color Types
// ============================================

export type Vec2 = [number, number];
export type Vec3 = [number, number, number];
export type Vec4 = [number, number, number, number];
export type Color3 = [number, number, number];
export type Color4 = [number, number, number, number];

// ============================================
// Splat Types
// ============================================

export interface Splat {
  /** X position (0-1 normalized) */
  x: number;
  /** Y position (0-1 normalized, 0=top, 1=bottom) */
  y: number;
  /** X velocity component */
  dx: number;
  /** Y velocity component (positive = down) */
  dy: number;
  /**
   * Whether to flip `dy` when uploading to the GPU buffer.
   * This is useful when different sources (mouse vs emitters) produce velocities in different Y conventions.
   * Defaults to `false` (app coordinates are normalized Y-down).
   */
  flipDy?: boolean;
  /** RGB color (0-1) */
  color: Color3;
  /** Splat radius */
  radius: number;
  /** Optional opacity (0-1) */
  opacity?: number;

  // Optional per-splat override multipliers (1 = no change)
  /** Multiplier applied to velocity injection for this splat */
  velocityScale?: number;
  /** Multiplier applied to dye injection for this splat */
  dyeScale?: number;
  /** Multiplier applied to base radius for this splat */
  radiusScale?: number;
  /** Additional color boost multiplier for this splat */
  colorBoost?: number;

  // Optional per-splat shape controls (fallback to global config when omitted)
  /** Splat softness multiplier (0.1..2) */
  splatSoftness?: number;
  /** Splat falloff mode (0=soft,1=med,2=sharp,3=ultra) */
  splatFalloff?: number;
  /** Splat blend mode (0=add,1=max,2=mix) */
  splatBlendMode?: number;

  // Temperature field (for combustion-like effects)
  /** Optional temperature value to inject at this splat (0..10 typical range) */
  temperature?: number;
}

export interface SplatSource {
  /** Unique source identifier */
  id: string;
  /** Source enabled state */
  enabled: boolean;
  /** Generate splats for current frame */
  generateSplats(time: number, dt: number): Splat[];
  /** Cleanup resources */
  dispose?(): void;
}

// ============================================
// Simulation Types
// ============================================

export type RenderMode =
  | 'dye'           // Standard dye visualization
  | 'velocity'      // Velocity field
  | 'pressure'      // Pressure field
  | 'vorticity'     // Vorticity field
  | 'smoke-flat'    // Flat smoke style
  | 'smoke-3d';     // Pseudo-3D smoke

export type BoundaryCondition =
  | 'wrap'          // Wrap around edges
  | 'contain'       // Reflect at edges
  | 'open';         // Allow outflow

// ============================================
// Audio Reactivity Types
// ============================================

export interface AudioReactiveConfig {
  enabled: boolean;
  /** Frequency band (0-7) or -1 for overall level */
  band: number;
  /** Sensitivity multiplier (0.1-5.0) */
  sensitivity: number;
  /** Smoothing factor (0-1) */
  smoothing: number;
  /** Properties affected by audio */
  targets: {
    force: boolean;
    radius: boolean;
    color: boolean;
    emission: boolean;
  };
  /** Force range [min, max] multiplier */
  forceRange: [number, number];
  /** Radius range [min, max] multiplier */
  radiusRange: [number, number];
  /** Emission range [min, max] multiplier */
  emissionRange: [number, number];
  /** React to beat detection */
  beatReactive: boolean;
  /** Beat burst multiplier */
  beatMultiplier: number;
}

// ============================================
// Transform Types
// ============================================

export interface Transform2D {
  position: Vec2;
  rotation: number;  // Degrees
  scale: Vec2;
}

export interface TransformMatrix2D {
  // 3x3 matrix stored as flat array
  elements: [
    number, number, number,
    number, number, number,
    number, number, number
  ];
}

// ============================================
// Event Types
// ============================================

export type FluidEventType =
  | 'splat'
  | 'reset'
  | 'configChange'
  | 'pause'
  | 'resume';

export interface FluidEvent {
  type: FluidEventType;
  timestamp: number;
  data?: unknown;
}

export type FluidEventListener = (event: FluidEvent) => void;

// ============================================
// Simulation API Types
// ============================================

export interface FluidSolver2DAPI {
  /** Step simulation forward */
  step(dt?: number): void;
  /** Render current state */
  render(): void;
  /** Reset simulation to initial state */
  reset(): void;
  /** Pause simulation */
  pause(): void;
  /** Resume simulation */
  resume(): void;
  /** Check if simulation is running */
  isRunning(): boolean;
  /** Get current simulation time */
  getTime(): number;
  /** Add splats to simulation */
  addSplats(splats: Splat[]): void;
  /** Update configuration */
  setConfig(config: Partial<import('./FluidSolver2D').FluidConfig2D>): void;
  /** Get current configuration */
  getConfig(): import('./FluidSolver2D').FluidConfig2D;
  /** Cleanup resources */
  dispose(): void;
}


