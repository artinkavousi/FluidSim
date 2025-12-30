/**
 * @package fluid-2d/gizmos
 * Gizmo Type Definitions
 */

import type { Vec2 } from '../types';
import type { Emitter, EmitterManagerAPI } from '../emitters/types';

// ============================================
// Gizmo Types
// ============================================

export type GizmoHandleType = 
  | 'position'    // Move handle
  | 'rotation'    // Rotate handle
  | 'scale'       // Scale handle
  | 'control'     // Control point (curves)
  | 'radius'      // Radius adjustment
  | 'arc'         // Arc angle adjustment
  | 'direction'   // Direction arrow
  | 'rate'        // Emission rate
  | 'size';       // Size/radius control

export interface GizmoHandle {
  /** Handle identifier */
  id: string;
  /** Handle type */
  type: GizmoHandleType;
  /** Screen position (pixels) */
  position: Vec2;
  /** Cursor style */
  cursor: string;
  /** Optional metadata */
  data?: Record<string, unknown>;
}

export type DragKind = 
  | null 
  | 'move' 
  | 'rotate' 
  | 'scale' 
  | 'control' 
  | 'arrow' 
  | 'rate' 
  | 'size'
  | 'radius'
  | 'arcStart'
  | 'arcEnd'
  | 'start'
  | 'end';

export interface DragState {
  kind: DragKind;
  emitterId: string;
  startPointerPx: Vec2;
  startValue: unknown;
}

// ============================================
// Gizmo Props
// ============================================

export interface GizmoProps<T extends Emitter = Emitter> {
  /** The emitter to visualize/control */
  emitter: T;
  /** Emitter manager reference */
  manager: EmitterManagerAPI;
  /** Canvas width in pixels */
  canvasWidth: number;
  /** Canvas height in pixels */
  canvasHeight: number;
  /** Sim texture aspect ratio (dyeW/dyeH); used for aspect-correct gizmo mapping. */
  textureAspect?: number;
  /** Is this emitter selected */
  selected: boolean;
  /** Is gizmo enabled */
  enabled?: boolean;
  /** Snap to grid */
  snapToGrid?: boolean;
  /** Grid size (0-1 normalized) */
  gridSize?: number;
  /** Snap angle in degrees */
  snapAngle?: number;
  /** Callback when emitter is updated */
  onUpdate?: (updates: Partial<T>) => void;
  /** Custom styles */
  style?: React.CSSProperties;
}

// ============================================
// Gizmo Theme
// ============================================

export interface GizmoTheme {
  // Colors
  accentPrimary: string;
  accentSecondary: string;
  accentTertiary: string;
  handleFill: string;
  handleStroke: string;
  arcFill: string;
  arcStroke: string;
  textColor: string;
  
  // Sizes
  hubRadius: number;
  handleRadius: number;
  arcRadius: number;
  strokeWidth: number;
  
  // Effects
  glowIntensity: number;
  glowColor: string;
}

export const defaultGizmoTheme: GizmoTheme = {
  accentPrimary: 'rgba(0, 212, 170, 0.92)',
  accentSecondary: 'rgba(100, 181, 246, 0.92)',
  accentTertiary: 'rgba(168, 85, 247, 0.92)',
  handleFill: 'rgba(255, 255, 255, 0.9)',
  handleStroke: 'rgba(255, 255, 255, 0.3)',
  arcFill: 'transparent',
  arcStroke: 'rgba(255, 255, 255, 0.15)',
  textColor: 'rgba(255, 255, 255, 0.4)',
  
  hubRadius: 13,
  handleRadius: 6,
  arcRadius: 78,
  strokeWidth: 1.5,
  
  glowIntensity: 0.5,
  glowColor: 'rgba(0, 212, 170, 0.4)',
};

// ============================================
// Gizmo Manager Types
// ============================================

export interface GizmoManagerConfig {
  /** Enable all gizmos */
  enabled: boolean;
  /** Show handles on hover */
  showOnHover: boolean;
  /** Theme configuration */
  theme: Partial<GizmoTheme>;
  /** Snap configuration */
  snap: {
    position: boolean;
    angle: boolean;
    gridSize: number;
    angleStep: number;
  };
}

export interface GizmoManagerAPI {
  /** Set global enabled state */
  setEnabled(enabled: boolean): void;
  /** Get current configuration */
  getConfig(): GizmoManagerConfig;
  /** Update configuration */
  setConfig(config: Partial<GizmoManagerConfig>): void;
  /** Get active gizmo handles for an emitter */
  getHandles(emitterId: string): GizmoHandle[];
}


