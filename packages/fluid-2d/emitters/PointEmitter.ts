/**
 * @package fluid-2d/emitters
 * PointEmitter - Single point source emitter
 */

import type { PointEmitter as PointEmitterType, BaseEmitter } from './types';
import type { Color3, Vec2 } from '../types';

/**
 * Create a new point emitter configuration
 */
export function createPointEmitter(
  config: Partial<Omit<PointEmitterType, 'id' | 'type'>> = {}
): Omit<PointEmitterType, 'id'> {
  return {
    type: 'point',
    name: config.name ?? 'Point Emitter',
    active: config.active ?? true,
    visible: config.visible ?? true,
    locked: config.locked ?? false,
    
    // Transform
    position: config.position ?? [0.5, 0.5],
    rotation: config.rotation ?? 0,
    scale: config.scale ?? [1, 1],
    
    // Emission properties
    force: config.force ?? 0.6,
    forceScale: config.forceScale ?? 1,
    radius: config.radius ?? 0.012,
    radiusScale: config.radiusScale ?? 1,
    color: config.color ?? [1, 0.4, 0.2],
    opacity: config.opacity ?? 1,
    // Bursts-per-second. For point emitters, 60 gives a continuous stream at ~60fps.
    emissionRate: config.emissionRate ?? 60,
    
    // Direction
    directionMode: config.directionMode ?? 'fixed',
    fixedDirection: config.fixedDirection ?? [0, 1],
    spread: config.spread ?? 20,
    
    // Audio
    audioReactive: config.audioReactive ?? false,
    audioConfig: config.audioConfig,
    animation: config.animation,
  };
}

/**
 * Point emitter presets
 */
export const pointEmitterPresets = {
  /**
   * Fountain - upward spray
   */
  fountain: (): Omit<PointEmitterType, 'id'> => createPointEmitter({
    name: 'Fountain',
    position: [0.5, 0.1],
    fixedDirection: [0, 1],
    color: [0.2, 0.6, 1],
    force: 0.8,
    radius: 0.015,
    spread: 20,
  }),

  /**
   * Fire jet - upward with warm colors
   */
  fireJet: (): Omit<PointEmitterType, 'id'> => createPointEmitter({
    name: 'Fire Jet',
    position: [0.5, 0.1],
    fixedDirection: [0, 1],
    color: [1, 0.4, 0.1],
    force: 1.0,
    radius: 0.012,
    spread: 25,
  }),

  /**
   * Smoke plume - slow rising
   */
  smokePlume: (): Omit<PointEmitterType, 'id'> => createPointEmitter({
    name: 'Smoke Plume',
    position: [0.5, 0.2],
    fixedDirection: [0, 1],
    color: [0.4, 0.4, 0.45],
    force: 0.4,
    radius: 0.025,
    spread: 35,
  }),

  /**
   * Side jet - horizontal spray
   */
  sideJet: (): Omit<PointEmitterType, 'id'> => createPointEmitter({
    name: 'Side Jet',
    position: [0.1, 0.5],
    fixedDirection: [1, 0],
    color: [0.3, 0.9, 0.5],
    force: 0.9,
    radius: 0.01,
    spread: 15,
  }),

  /**
   * Center burst - omnidirectional
   */
  centerBurst: (): Omit<PointEmitterType, 'id'> => createPointEmitter({
    name: 'Center Burst',
    position: [0.5, 0.5],
    directionMode: 'random',
    color: [0.9, 0.3, 1.0],
    force: 0.6,
    radius: 0.018,
    spread: 180,
  }),

  /**
   * Audio reactive pulse
   */
  audioPulse: (): Omit<PointEmitterType, 'id'> => createPointEmitter({
    name: 'Audio Pulse',
    position: [0.5, 0.3],
    fixedDirection: [0, 1],
    color: [0.9, 0.3, 0.5],
    force: 0.3,
    radius: 0.001,
    spread: 25,
    audioReactive: true,
    audioConfig: {
      enabled: true,
      band: 1,
      sensitivity: 1.5,
      smoothing: 0.7,
      targets: {
        force: true,
        radius: true,
        color: false,
        emission: true,
      },
      forceRange: [0.5, 2.0],
      radiusRange: [0.5, 2.0],
      emissionRange: [0.5, 3.0],
      beatReactive: true,
      beatMultiplier: 2.5,
    },
  }),
};

/**
 * Get all preset names
 */
export function getPointEmitterPresetNames(): string[] {
  return Object.keys(pointEmitterPresets);
}

/**
 * Get a preset by name
 */
export function getPointEmitterPreset(name: string): Omit<PointEmitterType, 'id'> | null {
  const preset = pointEmitterPresets[name as keyof typeof pointEmitterPresets];
  return preset ? preset() : null;
}
