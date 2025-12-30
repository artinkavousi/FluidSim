/**
 * @package fluid-2d/emitters
 * TextEmitter - Text outline/fill emitter
 */

import type { TextEmitter as TextEmitterType } from './types';
import type { Color3, Vec2 } from '../types';

/**
 * Create a new text emitter configuration
 */
export function createTextEmitter(
  config: Partial<Omit<TextEmitterType, 'id' | 'type'>> = {}
): Omit<TextEmitterType, 'id'> {
  return {
    type: 'text',
    name: config.name ?? 'Text Emitter',
    active: config.active ?? true,
    visible: config.visible ?? true,
    locked: config.locked ?? false,
    
    // Transform
    position: config.position ?? [0.5, 0.5],
    rotation: config.rotation ?? 0,
    scale: config.scale ?? [1, 1],
    
    // Text-specific
    text: config.text ?? 'FLUID',
    fontFamily: config.fontFamily ?? 'Arial',
    fontSize: config.fontSize ?? 72,
    fontWeight: config.fontWeight ?? 700,
    letterSpacing: config.letterSpacing ?? 0,
    outline: config.outline ?? true,
    samples: config.samples ?? 100,
    
    // Emission properties
    force: config.force ?? 0.15,
    forceScale: config.forceScale ?? 1,
    radius: config.radius ?? 0.0005,
    radiusScale: config.radiusScale ?? 1,
    color: config.color ?? [1, 0.8, 0.3],
    opacity: config.opacity ?? 1,
    emissionRate: config.emissionRate ?? 1,
    
    // Direction
    directionMode: config.directionMode ?? 'normal',
    fixedDirection: config.fixedDirection ?? [0, 1],
    spread: config.spread ?? 15,
    
    // Audio
    audioReactive: config.audioReactive ?? false,
    audioConfig: config.audioConfig,
    animation: config.animation,
  };
}

/**
 * Text emitter presets
 */
export const textEmitterPresets = {
  /**
   * Basic text - simple text emission
   */
  basicText: (): Omit<TextEmitterType, 'id'> => createTextEmitter({
    name: 'Basic Text',
    text: 'HELLO',
    fontFamily: 'Arial',
    fontSize: 80,
    fontWeight: 700,
    outline: true,
    color: [1, 0.8, 0.2],
    force: 0.18,
    samples: 120,
  }),

  /**
   * Neon glow - bright colored text
   */
  neonGlow: (): Omit<TextEmitterType, 'id'> => createTextEmitter({
    name: 'Neon Glow',
    text: 'NEON',
    fontFamily: 'Impact',
    fontSize: 100,
    fontWeight: 900,
    outline: true,
    color: [0.2, 1, 0.8],
    force: 0.22,
    radius: 0.0007,
    samples: 150,
  }),

  /**
   * Fire text - warm colors
   */
  fireText: (): Omit<TextEmitterType, 'id'> => createTextEmitter({
    name: 'Fire Text',
    text: 'FIRE',
    fontFamily: 'Arial Black',
    fontSize: 90,
    fontWeight: 900,
    outline: true,
    color: [1, 0.4, 0.1],
    force: 0.25,
    radius: 0.0008,
    spread: 20,
    samples: 100,
  }),

  /**
   * Ice text - cool colors
   */
  iceText: (): Omit<TextEmitterType, 'id'> => createTextEmitter({
    name: 'Ice Text',
    text: 'ICE',
    fontFamily: 'Georgia',
    fontSize: 85,
    fontWeight: 700,
    outline: true,
    color: [0.3, 0.7, 1],
    force: 0.12,
    radius: 0.0004,
    spread: 5,
    samples: 80,
  }),

  /**
   * Glowing outline
   */
  glowingOutline: (): Omit<TextEmitterType, 'id'> => createTextEmitter({
    name: 'Glowing Outline',
    text: 'GLOW',
    fontFamily: 'Verdana',
    fontSize: 75,
    fontWeight: 700,
    outline: true,
    color: [0.9, 0.3, 0.9],
    force: 0.15,
    radius: 0.0006,
    samples: 140,
  }),

  /**
   * Audio reactive text
   */
  audioText: (): Omit<TextEmitterType, 'id'> => createTextEmitter({
    name: 'Audio Text',
    text: 'BEAT',
    fontFamily: 'Impact',
    fontSize: 95,
    fontWeight: 900,
    outline: true,
    color: [1, 0.3, 0.5],
    force: 0.2,
    radius: 0.0006,
    samples: 100,
    audioReactive: true,
    audioConfig: {
      enabled: true,
      band: 1,
      sensitivity: 2.0,
      smoothing: 0.5,
      targets: {
        force: true,
        radius: true,
        color: false,
        emission: true,
      },
      forceRange: [0.5, 3.0],
      radiusRange: [0.5, 2.5],
      emissionRange: [0.5, 2.0],
      beatReactive: true,
      beatMultiplier: 3.0,
    },
  }),
};

/**
 * Get all preset names
 */
export function getTextEmitterPresetNames(): string[] {
  return Object.keys(textEmitterPresets);
}

/**
 * Get a preset by name
 */
export function getTextEmitterPreset(name: string): Omit<TextEmitterType, 'id'> | null {
  const preset = textEmitterPresets[name as keyof typeof textEmitterPresets];
  return preset ? preset() : null;
}

// ============================================
// Text Path Sampling Utilities
// ============================================

/**
 * Sample points from text path using canvas
 * Returns array of normalized (0-1) coordinates
 */
export function sampleTextPath(
  text: string,
  fontFamily: string,
  fontSize: number,
  fontWeight: number,
  samples: number,
  outline: boolean = true
): Vec2[] {
  // Create offscreen canvas for text rendering
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return [];
  
  // Set up font
  ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
  const metrics = ctx.measureText(text);
  
  // Size canvas to fit text
  const padding = fontSize * 0.2;
  canvas.width = Math.ceil(metrics.width + padding * 2);
  canvas.height = Math.ceil(fontSize * 1.5 + padding * 2);
  
  // Re-apply font after resize
  ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
  ctx.textBaseline = 'middle';
  
  // Draw text
  ctx.fillStyle = 'white';
  ctx.fillText(text, padding, canvas.height / 2);
  
  // Get image data
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  
  // Collect edge/fill points
  const points: Vec2[] = [];
  
  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      const idx = (y * canvas.width + x) * 4;
      const alpha = data[idx + 3];
      
      if (outline) {
        // Edge detection: check if this pixel is on the boundary
        if (alpha > 128) {
          const isEdge = 
            x === 0 || x === canvas.width - 1 ||
            y === 0 || y === canvas.height - 1 ||
            data[((y - 1) * canvas.width + x) * 4 + 3] < 128 ||
            data[((y + 1) * canvas.width + x) * 4 + 3] < 128 ||
            data[(y * canvas.width + x - 1) * 4 + 3] < 128 ||
            data[(y * canvas.width + x + 1) * 4 + 3] < 128;
          
          if (isEdge) {
            points.push([
              x / canvas.width,
              y / canvas.height,
            ]);
          }
        }
      } else {
        // Fill: include all opaque pixels
        if (alpha > 128) {
          points.push([
            x / canvas.width,
            y / canvas.height,
          ]);
        }
      }
    }
  }
  
  // Subsample to desired count
  if (points.length <= samples) {
    return points;
  }
  
  const step = points.length / samples;
  const result: Vec2[] = [];
  for (let i = 0; i < samples; i++) {
    const idx = Math.floor(i * step);
    result.push(points[idx]);
  }
  
  return result;
}


