/**
 * @package fluid-2d
 * Public API exports
 */

// Solver + config
export { FluidSolver2D, defaultConfig2D } from './FluidSolver2D';
export type { FluidConfig2D } from './FluidSolver2D';

// Core types
export type { Splat, Vec2, Vec3, Vec4, Color3, Color4, RenderMode } from './types';

// React components + hooks
export { FluidCanvas2D } from './components/FluidCanvas2D';
export type { FluidCanvas2DProps } from './components/FluidCanvas2D';
export { FluidProvider2D, useFluid2D, useFluid2DOptional } from './components/FluidProvider2D';
export type { FluidProvider2DProps, FluidContext2D } from './components/FluidProvider2D';
export * from './hooks';

// Emitters
export { EmitterManager, getEmitterManager, createEmitterManager } from './emitters/EmitterManager';
export type {
    Emitter,
    EmitterType,
    DirectionMode,
    BaseEmitter,
    PointEmitter,
    LineEmitter,
    CircleEmitter,
    CurveEmitter,
    TextEmitter,
    SVGEmitter,
    BrushEmitter,
    SelectionState,
} from './emitters/types';
export * from './emitters/presets';

// Gizmos
export { GizmoRenderer } from './gizmos/GizmoRenderer';
export * from './gizmos/types';

// Post-processing config
export { defaultPostConfig } from './render/RenderOutput2D';
export type { RenderOutput2DConfig } from './render/RenderOutput2D';

// TSL nodes (advanced users)
export * from './nodes';
