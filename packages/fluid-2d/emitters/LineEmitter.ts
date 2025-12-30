/**
 * @package fluid-2d/emitters
 * LineEmitter - Line segment emitter
 */

import type { LineEmitter as LineEmitterType } from './types';
import type { Color3, Vec2 } from '../types';

/**
 * Create a new line emitter configuration
 */
export function createLineEmitter(
  config: Partial<Omit<LineEmitterType, 'id' | 'type'>> = {}
): Omit<LineEmitterType, 'id'> {
  return {
    type: 'line',
    name: config.name ?? 'Line Emitter',
    active: config.active ?? true,
    visible: config.visible ?? true,
    locked: config.locked ?? false,
    
    // Transform
    position: config.position ?? [0.5, 0.5],
    rotation: config.rotation ?? 0,
    scale: config.scale ?? [1, 1],
    
    // Line-specific
    start: config.start ?? [-0.2, 0],
    end: config.end ?? [0.2, 0],
    segments: config.segments ?? 16,
    gradient: config.gradient,
    
    // Emission properties
    force: config.force ?? 0.2,
    forceScale: config.forceScale ?? 1,
    radius: config.radius ?? 0.0008,
    radiusScale: config.radiusScale ?? 1,
    color: config.color ?? [0.5, 1, 0.5],
    opacity: config.opacity ?? 1,
    // Bursts-per-second. Each burst emits `segments + 1` splats, so keep the default modest.
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
 * Line emitter presets
 */
export const lineEmitterPresets = {
  /**
   * Horizontal wave - bottom of screen
   */
  horizontalWave: (): Omit<LineEmitterType, 'id'> => createLineEmitter({
    name: 'Horizontal Wave',
    position: [0.5, 0.1],
    start: [-0.35, 0],
    end: [0.35, 0],
    segments: 24,
    color: [0.3, 0.7, 1],
    force: 0.25,
    radius: 0.0006,
  }),

  /**
   * Vertical wall - side spray
   */
  verticalWall: (): Omit<LineEmitterType, 'id'> => createLineEmitter({
    name: 'Vertical Wall',
    position: [0.1, 0.5],
    start: [0, -0.25],
    end: [0, 0.25],
    rotation: 0,
    segments: 20,
    color: [1, 0.5, 0.2],
    force: 0.3,
    radius: 0.0008,
  }),

  /**
   * Diagonal slash
   */
  diagonalSlash: (): Omit<LineEmitterType, 'id'> => createLineEmitter({
    name: 'Diagonal Slash',
    position: [0.3, 0.3],
    start: [-0.15, -0.15],
    end: [0.15, 0.15],
    segments: 16,
    color: [0.9, 0.3, 0.7],
    force: 0.2,
    radius: 0.0007,
  }),

  /**
   * Rainbow line - with gradient
   */
  rainbowLine: (): Omit<LineEmitterType, 'id'> => createLineEmitter({
    name: 'Rainbow Line',
    position: [0.5, 0.2],
    start: [-0.3, 0],
    end: [0.3, 0],
    segments: 32,
    color: [1, 1, 1],
    gradient: {
      startColor: [1, 0.2, 0.3],
      endColor: [0.3, 0.2, 1],
    },
    force: 0.22,
    radius: 0.0008,
  }),

  /**
   * Curtain - wide horizontal spray
   */
  curtain: (): Omit<LineEmitterType, 'id'> => createLineEmitter({
    name: 'Curtain',
    position: [0.5, 0.9],
    start: [-0.4, 0],
    end: [0.4, 0],
    segments: 40,
    directionMode: 'fixed',
    fixedDirection: [0, -1],
    color: [0.6, 0.8, 1],
    force: 0.15,
    radius: 0.0005,
  }),

  /**
   * Fire wall - hot gradient
   */
  fireWall: (): Omit<LineEmitterType, 'id'> => createLineEmitter({
    name: 'Fire Wall',
    position: [0.5, 0.1],
    start: [-0.25, 0],
    end: [0.25, 0],
    segments: 20,
    color: [1, 0.5, 0.1],
    gradient: {
      startColor: [1, 0.8, 0.2],
      endColor: [1, 0.2, 0.1],
    },
    force: 0.35,
    radius: 0.001,
    spread: 10,
  }),
};

/**
 * Get all preset names
 */
export function getLineEmitterPresetNames(): string[] {
  return Object.keys(lineEmitterPresets);
}

/**
 * Get a preset by name
 */
export function getLineEmitterPreset(name: string): Omit<LineEmitterType, 'id'> | null {
  const preset = lineEmitterPresets[name as keyof typeof lineEmitterPresets];
  return preset ? preset() : null;
}


