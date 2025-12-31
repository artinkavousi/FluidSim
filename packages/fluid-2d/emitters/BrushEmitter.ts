/**
 * @package fluid-2d/emitters
 * BrushEmitter - Manual paint brush emitter
 */

import type { BrushEmitter as BrushEmitterType, BrushStroke } from './types';
import type { Color3, Vec2 } from '../types';

/**
 * Create a new brush emitter configuration
 */
export function createBrushEmitter(
  config: Partial<Omit<BrushEmitterType, 'id' | 'type'>> = {}
): Omit<BrushEmitterType, 'id'> {
  return {
    type: 'brush',
    name: config.name ?? 'Brush Emitter',
    active: config.active ?? true,
    visible: config.visible ?? true,
    locked: config.locked ?? false,
    
    // Transform
    position: config.position ?? [0.5, 0.5],
    rotation: config.rotation ?? 0,
    scale: config.scale ?? [1, 1],
    
    // Brush-specific
    strokes: config.strokes ?? [],
    brushSize: config.brushSize ?? 0.02,
    brushHardness: config.brushHardness ?? 0.7,
    playbackMode: config.playbackMode ?? 'loop',
    playbackSpeed: config.playbackSpeed ?? 1,
    
    // Emission properties
    force: config.force ?? 0.2,
    forceScale: config.forceScale ?? 1,
    radius: config.radius ?? 0.0008,
    radiusScale: config.radiusScale ?? 1,
    color: config.color ?? [1, 0.5, 0.3],
    opacity: config.opacity ?? 1,
    // Bursts-per-second. Brush playback emits ~1 splat per burst, so 60 feels responsive.
    emissionRate: config.emissionRate ?? 60,
    
    // Direction
    directionMode: config.directionMode ?? 'tangent',
    fixedDirection: config.fixedDirection ?? [0, 1],
    spread: config.spread ?? 5,
    
    // Audio
    audioReactive: config.audioReactive ?? false,
    audioConfig: config.audioConfig,
    animation: config.animation,
  };
}

/**
 * Create a stroke from an array of points
 */
export function createStroke(
  points: Vec2[],
  color: Color3 = [1, 1, 1],
  pressure?: number[]
): BrushStroke {
  return {
    points: [...points],
    pressure: pressure ?? points.map(() => 1),
    timestamp: Date.now(),
    color,
  };
}

/**
 * Brush emitter presets
 */
export const brushEmitterPresets = {
  /**
   * Circle stroke
   */
  circleStroke: (): Omit<BrushEmitterType, 'id'> => {
    const points: Vec2[] = [];
    const samples = 32;
    for (let i = 0; i <= samples; i++) {
      const t = i / samples;
      const angle = t * Math.PI * 2;
      points.push([
        Math.cos(angle) * 0.15,
        Math.sin(angle) * 0.15,
      ]);
    }
    
    return createBrushEmitter({
      name: 'Circle Stroke',
      strokes: [createStroke(points, [0.3, 0.8, 1])],
      brushSize: 0.015,
      color: [0.3, 0.8, 1],
      playbackMode: 'loop',
      playbackSpeed: 0.5,
    });
  },

  /**
   * Spiral stroke
   */
  spiralStroke: (): Omit<BrushEmitterType, 'id'> => {
    const points: Vec2[] = [];
    const samples = 60;
    for (let i = 0; i <= samples; i++) {
      const t = i / samples;
      const angle = t * Math.PI * 4;
      const radius = 0.05 + t * 0.15;
      points.push([
        Math.cos(angle) * radius,
        Math.sin(angle) * radius,
      ]);
    }
    
    return createBrushEmitter({
      name: 'Spiral Stroke',
      strokes: [createStroke(points, [0.9, 0.4, 0.6])],
      brushSize: 0.012,
      color: [0.9, 0.4, 0.6],
      playbackMode: 'once',
      playbackSpeed: 0.8,
    });
  },

  /**
   * Wave stroke
   */
  waveStroke: (): Omit<BrushEmitterType, 'id'> => {
    const points: Vec2[] = [];
    const samples = 40;
    for (let i = 0; i <= samples; i++) {
      const t = i / samples;
      const x = -0.3 + t * 0.6;
      const y = Math.sin(t * Math.PI * 3) * 0.1;
      points.push([x, y]);
    }
    
    return createBrushEmitter({
      name: 'Wave Stroke',
      strokes: [createStroke(points, [0.5, 1, 0.6])],
      brushSize: 0.018,
      color: [0.5, 1, 0.6],
      playbackMode: 'pingpong',
      playbackSpeed: 0.6,
    });
  },
};

export function getBrushEmitterPresetNames(): string[] {
  return Object.keys(brushEmitterPresets);
}

export function getBrushEmitterPreset(name: string): Omit<BrushEmitterType, 'id'> | null {
  const preset = brushEmitterPresets[name as keyof typeof brushEmitterPresets];
  return preset ? preset() : null;
}


