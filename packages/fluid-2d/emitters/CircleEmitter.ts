/**
 * @package fluid-2d/emitters
 * CircleEmitter - Circular/ring emitter
 */

import type { CircleEmitter as CircleEmitterType } from './types';
import type { Color3, Vec2 } from '../types';

/**
 * Create a new circle emitter configuration
 */
export function createCircleEmitter(
  config: Partial<Omit<CircleEmitterType, 'id' | 'type'>> = {}
): Omit<CircleEmitterType, 'id'> {
  return {
    type: 'circle',
    name: config.name ?? 'Circle Emitter',
    active: config.active ?? true,
    visible: config.visible ?? true,
    locked: config.locked ?? false,
    
    // Transform
    position: config.position ?? [0.5, 0.5],
    rotation: config.rotation ?? 0,
    scale: config.scale ?? [1, 1],
    
    // Circle-specific
    innerRadius: config.innerRadius ?? 0,
    outerRadius: config.outerRadius ?? 0.1,
    arc: config.arc ?? [0, 360],
    points: config.points ?? 12,
    inward: config.inward ?? false,
    
    // Emission properties
    force: config.force ?? 0.2,
    forceScale: config.forceScale ?? 1,
    radius: config.radius ?? 0.0006,
    radiusScale: config.radiusScale ?? 1,
    color: config.color ?? [0.4, 0.6, 1],
    opacity: config.opacity ?? 1,
    // Bursts-per-second. Each burst emits `points` splats, so keep the default modest.
    emissionRate: config.emissionRate ?? 10,
    
    // Direction
    directionMode: config.directionMode ?? 'outward',
    fixedDirection: config.fixedDirection ?? [0, 1],
    spread: config.spread ?? 0,
    
    // Audio
    audioReactive: config.audioReactive ?? false,
    audioConfig: config.audioConfig,
    animation: config.animation,
  };
}

/**
 * Circle emitter presets
 */
export const circleEmitterPresets = {
  /**
   * Outward ring - expanding circle
   */
  outwardRing: (): Omit<CircleEmitterType, 'id'> => createCircleEmitter({
    name: 'Outward Ring',
    position: [0.5, 0.5],
    outerRadius: 0.12,
    points: 16,
    inward: false,
    color: [0.4, 0.8, 1],
    force: 0.25,
    radius: 0.0006,
  }),

  /**
   * Black hole - inward vortex
   */
  blackHole: (): Omit<CircleEmitterType, 'id'> => createCircleEmitter({
    name: 'Black Hole',
    position: [0.5, 0.5],
    outerRadius: 0.2,
    points: 24,
    inward: true,
    color: [0.2, 0.1, 0.3],
    force: 0.35,
    radius: 0.0005,
  }),

  /**
   * Dual vortex - two spinning rings
   */
  vortexLeft: (): Omit<CircleEmitterType, 'id'> => createCircleEmitter({
    name: 'Vortex Left',
    position: [0.35, 0.5],
    outerRadius: 0.1,
    points: 8,
    inward: false,
    color: [1, 0.3, 0.4],
    force: 0.2,
    radius: 0.0004,
    animation: {
      enabled: true,
      type: 'rotate',
      speed: 2,
      amplitude: 1,
      phase: 0,
    },
  }),

  vortexRight: (): Omit<CircleEmitterType, 'id'> => createCircleEmitter({
    name: 'Vortex Right',
    position: [0.65, 0.5],
    outerRadius: 0.1,
    points: 8,
    inward: false,
    color: [0.3, 0.4, 1],
    force: 0.2,
    radius: 0.0004,
    animation: {
      enabled: true,
      type: 'rotate',
      speed: -2,
      amplitude: 1,
      phase: 0,
    },
  }),

  /**
   * Half circle arc - semi-circular spray
   */
  halfArc: (): Omit<CircleEmitterType, 'id'> => createCircleEmitter({
    name: 'Half Arc',
    position: [0.5, 0.2],
    outerRadius: 0.15,
    arc: [0, 180],
    points: 10,
    inward: false,
    color: [0.9, 0.6, 0.2],
    force: 0.3,
    radius: 0.0008,
  }),

  /**
   * Pulsing ring - audio reactive
   */
  pulsingRing: (): Omit<CircleEmitterType, 'id'> => createCircleEmitter({
    name: 'Pulsing Ring',
    position: [0.5, 0.5],
    outerRadius: 0.15,
    points: 20,
    inward: false,
    color: [0.8, 0.3, 0.9],
    force: 0.25,
    radius: 0.0007,
    audioReactive: true,
    audioConfig: {
      enabled: true,
      band: 2,
      sensitivity: 1.8,
      smoothing: 0.6,
      targets: {
        force: true,
        radius: true,
        color: false,
        emission: false,
      },
      forceRange: [0.5, 2.5],
      radiusRange: [0.5, 2.0],
      emissionRange: [1, 1],
      beatReactive: true,
      beatMultiplier: 3.0,
    },
  }),

  /**
   * Spiral source - animated rotation
   */
  spiralSource: (): Omit<CircleEmitterType, 'id'> => createCircleEmitter({
    name: 'Spiral Source',
    position: [0.5, 0.5],
    outerRadius: 0.08,
    points: 6,
    inward: false,
    color: [0.5, 1, 0.6],
    force: 0.18,
    radius: 0.0005,
    animation: {
      enabled: true,
      type: 'rotate',
      speed: 3,
      amplitude: 1,
      phase: 0,
    },
  }),
};

/**
 * Get all preset names
 */
export function getCircleEmitterPresetNames(): string[] {
  return Object.keys(circleEmitterPresets);
}

/**
 * Get a preset by name
 */
export function getCircleEmitterPreset(name: string): Omit<CircleEmitterType, 'id'> | null {
  const preset = circleEmitterPresets[name as keyof typeof circleEmitterPresets];
  return preset ? preset() : null;
}


