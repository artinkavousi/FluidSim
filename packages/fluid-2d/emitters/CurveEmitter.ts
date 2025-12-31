/**
 * @package fluid-2d/emitters
 * CurveEmitter - Bezier/Catmull-Rom curve emitter
 */

import type { CurveEmitter as CurveEmitterType } from './types';
import type { Color3, Vec2 } from '../types';

/**
 * Create a new curve emitter configuration
 */
export function createCurveEmitter(
  config: Partial<Omit<CurveEmitterType, 'id' | 'type'>> = {}
): Omit<CurveEmitterType, 'id'> {
  return {
    type: 'curve',
    name: config.name ?? 'Curve Emitter',
    active: config.active ?? true,
    visible: config.visible ?? true,
    locked: config.locked ?? false,
    
    // Transform
    position: config.position ?? [0.5, 0.5],
    rotation: config.rotation ?? 0,
    scale: config.scale ?? [1, 1],
    
    // Curve-specific
    curveType: config.curveType ?? 'cubic',
    controlPoints: config.controlPoints ?? [
      [-0.2, 0],
      [-0.1, 0.1],
      [0.1, -0.1],
      [0.2, 0],
    ],
    samples: config.samples ?? 20,
    animationSpeed: config.animationSpeed ?? 0,
    gradient: config.gradient,
    
    // Emission properties
    force: config.force ?? 0.2,
    forceScale: config.forceScale ?? 1,
    radius: config.radius ?? 0.0006,
    radiusScale: config.radiusScale ?? 1,
    color: config.color ?? [0.6, 0.3, 0.9],
    opacity: config.opacity ?? 1,
    // Bursts-per-second. Each burst emits `samples + 1` splats, so keep the default modest.
    emissionRate: config.emissionRate ?? 10,
    
    // Direction
    directionMode: config.directionMode ?? 'normal',
    fixedDirection: config.fixedDirection ?? [0, 1],
    spread: config.spread ?? 0,
    
    // Audio
    audioReactive: config.audioReactive ?? false,
    audioConfig: config.audioConfig,
    animation: config.animation,
  };
}

/**
 * Curve emitter presets
 */
export const curveEmitterPresets = {
  /**
   * S-Wave - sinusoidal curve
   */
  sWave: (): Omit<CurveEmitterType, 'id'> => createCurveEmitter({
    name: 'S-Wave',
    position: [0.5, 0.5],
    curveType: 'cubic',
    controlPoints: [
      [-0.25, -0.1],
      [-0.1, 0.15],
      [0.1, -0.15],
      [0.25, 0.1],
    ],
    samples: 24,
    color: [0.3, 0.8, 0.5],
    force: 0.2,
    radius: 0.0006,
  }),

  /**
   * Heart shape - using catmull-rom
   */
  heartCurve: (): Omit<CurveEmitterType, 'id'> => createCurveEmitter({
    name: 'Heart Curve',
    position: [0.5, 0.5],
    curveType: 'catmull',
    controlPoints: [
      [0, -0.15],     // bottom point
      [-0.15, 0],     // left
      [-0.08, 0.12],  // left top
      [0, 0.05],      // center dip
      [0.08, 0.12],   // right top
      [0.15, 0],      // right
      [0, -0.15],     // back to bottom
    ],
    samples: 32,
    color: [1, 0.3, 0.4],
    force: 0.18,
    radius: 0.0005,
    animationSpeed: 0.3,
  }),

  /**
   * Spiral curve
   */
  spiralCurve: (): Omit<CurveEmitterType, 'id'> => createCurveEmitter({
    name: 'Spiral Curve',
    position: [0.5, 0.5],
    curveType: 'catmull',
    controlPoints: [
      [0.15, 0],
      [0, 0.12],
      [-0.1, 0],
      [0, -0.08],
      [0.05, 0],
      [0, 0.04],
      [0, 0],
    ],
    samples: 40,
    color: [0.5, 0.3, 1],
    force: 0.22,
    radius: 0.0007,
    animationSpeed: 0.5,
  }),

  /**
   * Rainbow wave - with gradient
   */
  rainbowWave: (): Omit<CurveEmitterType, 'id'> => createCurveEmitter({
    name: 'Rainbow Wave',
    position: [0.5, 0.3],
    curveType: 'cubic',
    controlPoints: [
      [-0.3, 0],
      [-0.15, 0.2],
      [0.15, 0.2],
      [0.3, 0],
    ],
    samples: 28,
    color: [1, 1, 1],
    gradient: {
      startColor: [1, 0.2, 0.3],
      endColor: [0.3, 0.2, 1],
    },
    force: 0.2,
    radius: 0.0008,
  }),

  /**
   * Infinity symbol
   */
  infinityCurve: (): Omit<CurveEmitterType, 'id'> => createCurveEmitter({
    name: 'Infinity',
    position: [0.5, 0.5],
    curveType: 'catmull',
    controlPoints: [
      [0, 0],
      [0.12, 0.08],
      [0.2, 0],
      [0.12, -0.08],
      [0, 0],
      [-0.12, 0.08],
      [-0.2, 0],
      [-0.12, -0.08],
      [0, 0],
    ],
    samples: 48,
    color: [0.9, 0.7, 0.3],
    force: 0.15,
    radius: 0.0005,
    animationSpeed: 0.2,
  }),

  /**
   * Gentle arc
   */
  gentleArc: (): Omit<CurveEmitterType, 'id'> => createCurveEmitter({
    name: 'Gentle Arc',
    position: [0.5, 0.6],
    curveType: 'quadratic',
    controlPoints: [
      [-0.25, 0],
      [0, -0.15],
      [0.25, 0],
    ],
    samples: 16,
    color: [0.4, 0.9, 0.8],
    force: 0.25,
    radius: 0.0007,
  }),

  /**
   * Animated snake
   */
  animatedSnake: (): Omit<CurveEmitterType, 'id'> => createCurveEmitter({
    name: 'Animated Snake',
    position: [0.5, 0.5],
    curveType: 'catmull',
    controlPoints: [
      [-0.3, 0],
      [-0.2, 0.1],
      [-0.1, -0.1],
      [0, 0.1],
      [0.1, -0.1],
      [0.2, 0.1],
      [0.3, 0],
    ],
    samples: 36,
    color: [0.2, 1, 0.5],
    gradient: {
      startColor: [0.2, 1, 0.5],
      endColor: [0.2, 0.5, 1],
    },
    force: 0.18,
    radius: 0.0006,
    animationSpeed: 0.8,
  }),
};

/**
 * Get all preset names
 */
export function getCurveEmitterPresetNames(): string[] {
  return Object.keys(curveEmitterPresets);
}

/**
 * Get a preset by name
 */
export function getCurveEmitterPreset(name: string): Omit<CurveEmitterType, 'id'> | null {
  const preset = curveEmitterPresets[name as keyof typeof curveEmitterPresets];
  return preset ? preset() : null;
}


