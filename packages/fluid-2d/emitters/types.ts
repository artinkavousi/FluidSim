/**
 * @package fluid-2d/emitters
 * Emitter Type Definitions
 */

import type { Vec2, Color3, AudioReactiveConfig, Transform2D, Splat } from '../types';

// ============================================
// Base Emitter Types
// ============================================

export type EmitterType =
  | 'point'
  | 'line'
  | 'circle'
  | 'curve'
  | 'text'
  | 'svg'
  | 'brush';

export type DirectionMode =
  | 'fixed'      // Fixed direction vector
  | 'normal'     // Perpendicular to shape
  | 'tangent'    // Along shape
  | 'outward'    // Away from center
  | 'inward'     // Toward center
  | 'random';    // Random per splat

export interface EmitterAnimation {
  enabled: boolean;
  type: 'oscillate' | 'rotate' | 'pulse' | 'orbit';
  speed: number;
  amplitude: number;
  phase: number;
}

// ============================================
// Base Emitter Interface
// ============================================

/** Per-emitter splat quality overrides (undefined = use global) */
export interface EmitterSplatOverrides {
  /** Splat falloff (0=soft, 1=medium, 2=sharp, 3=ultra-sharp) */
  splatFalloff?: number;
  /** Edge softness multiplier (0.1-2.0) */
  splatSoftness?: number;
  /** Color intensity boost (0.5-3.0) */
  splatColorBoost?: number;
  /** Dye intensity override */
  dyeIntensity?: number;
  /** Velocity contribution scale */
  velocityScale?: number;
  /** Blend mode (0=additive, 1=max, 2=blend) */
  blendMode?: number;
}

export interface BaseEmitter {
  /** Unique identifier */
  id: string;
  /** Emitter type discriminator */
  type: EmitterType;
  /** Display name */
  name: string;
  /** Is emitter active (emitting) */
  active: boolean;
  /** Is emitter visible in UI */
  visible: boolean;
  /** Is emitter locked from editing */
  locked: boolean;

  // Transform
  /** World position (0-1 normalized) */
  position: Vec2;
  /** Rotation in degrees */
  rotation: number;
  /** Scale factor */
  scale: Vec2;

  // Emission properties
  /** Base emission force */
  force: number;
  /** Force multiplier */
  forceScale: number;
  /** Base splat radius */
  radius: number;
  /** Radius multiplier */
  radiusScale: number;
  /** RGB color (0-1) */
  color: Color3;
  /** Opacity (0-1) */
  opacity: number;
  /** Splats per second */
  emissionRate: number;

  /** Temperature to inject (0 = neutral, >0 = heat) */
  temperature?: number;

  // Direction
  /** Direction mode */
  directionMode: DirectionMode;
  /** Fixed direction vector (for 'fixed' mode) */
  fixedDirection: Vec2;
  /** Spread angle in degrees (0-180) */
  spread: number;

  // Per-emitter splat quality overrides
  /** Splat quality overrides (undefined = use global settings) */
  splatOverrides?: EmitterSplatOverrides;

  // Optional features
  /** Animation configuration */
  animation?: EmitterAnimation;
  /** Audio reactivity configuration */
  audioReactive?: boolean;
  audioConfig?: AudioReactiveConfig;
}

// ============================================
// Specific Emitter Types
// ============================================

export interface PointEmitter extends BaseEmitter {
  type: 'point';
}

export interface LineEmitter extends BaseEmitter {
  type: 'line';
  /** Line start point (relative to position) */
  start: Vec2;
  /** Line end point (relative to position) */
  end: Vec2;
  /** Number of emission segments */
  segments: number;
  /** Optional gradient */
  gradient?: {
    startColor: Color3;
    endColor: Color3;
  };
}

export interface CircleEmitter extends BaseEmitter {
  type: 'circle';
  /** Inner radius (0 = filled circle) */
  innerRadius: number;
  /** Outer radius */
  outerRadius: number;
  /** Arc start/end angles in degrees [start, end] */
  arc: [number, number];
  /** Number of emission points */
  points: number;
  /** Emit inward vs outward */
  inward: boolean;
}

export interface CurveEmitter extends BaseEmitter {
  type: 'curve';
  /** Curve interpolation type */
  curveType: 'quadratic' | 'cubic' | 'catmull';
  /** Control points (relative to position) */
  controlPoints: Vec2[];
  /** Number of samples along curve */
  samples: number;
  /** Animation speed (0 = static) */
  animationSpeed: number;
  /** Optional gradient */
  gradient?: {
    startColor: Color3;
    endColor: Color3;
  };
}

export interface TextEmitter extends BaseEmitter {
  type: 'text';
  /** Text content */
  text: string;
  /** Font family */
  fontFamily: string;
  /** Font size in pixels */
  fontSize: number;
  /** Font weight */
  fontWeight: number;
  /** Letter spacing */
  letterSpacing: number;
  /** Emit from outline vs fill */
  outline: boolean;
  /** Number of samples along text path */
  samples: number;
}

export interface SVGEmitter extends BaseEmitter {
  type: 'svg';
  /** SVG path data (d attribute) */
  svgPath: string;
  /** Number of samples along path */
  samples: number;
  /** Normalize to unit size */
  normalizeSize: boolean;
}

export interface BrushStroke {
  /** Stroke points */
  points: Vec2[];
  /** Pressure at each point (0-1) */
  pressure: number[];
  /** Stroke timestamp */
  timestamp: number;
  /** Stroke color */
  color: Color3;
}

export interface BrushEmitter extends BaseEmitter {
  type: 'brush';
  /** Recorded brush strokes */
  strokes: BrushStroke[];
  /** Brush size */
  brushSize: number;
  /** Brush hardness (0-1) */
  brushHardness: number;
  /** Playback mode */
  playbackMode: 'once' | 'loop' | 'pingpong';
  /** Playback speed */
  playbackSpeed: number;
}

// Union type for all emitter types
export type Emitter =
  | PointEmitter
  | LineEmitter
  | CircleEmitter
  | CurveEmitter
  | TextEmitter
  | SVGEmitter
  | BrushEmitter;

// ============================================
// Emitter Manager Types
// ============================================

export interface SelectionState {
  /** Primary selected emitter ID */
  primary: string | null;
  /** All selected emitter IDs */
  emitterIds: Set<string>;
}

export type EmitterChangeListener = (emitters: Emitter[]) => void;
export type SelectionChangeListener = (selection: SelectionState) => void;

export interface EmitterManagerAPI {
  // CRUD
  addEmitter(config: Omit<Emitter, 'id'>): string;
  removeEmitter(id: string): boolean;
  updateEmitter(id: string, updates: Partial<Emitter>): void;
  getEmitter(id: string): Emitter | undefined;
  getAllEmitters(): Emitter[];
  getActiveEmitters(): Emitter[];

  // Selection
  select(id: string, additive?: boolean): void;
  deselect(): void;
  toggleSelection(id: string): void;
  getSelection(): SelectionState;

  // Transform
  setEmitterPosition(id: string, x: number, y: number): void;
  setEmitterRotation(id: string, degrees: number): void;
  setEmitterScale(id: string, sx: number, sy: number): void;
  getWorldTransform(id: string): Transform2D | null;

  // Generation
  generateSplats(time: number, dt: number, audioData?: Float32Array): Splat[];

  // Events
  onChange(callback: EmitterChangeListener): () => void;
  onSelectionChange(callback: SelectionChangeListener): () => void;

  // Utilities
  clear(): void;
  duplicate(id: string): string | null;
}

