/**
 * @package fluid-2d/emitters
 * SVGEmitter - SVG path emitter
 */

import type { SVGEmitter as SVGEmitterType } from './types';
import type { Color3, Vec2 } from '../types';

/**
 * Create a new SVG emitter configuration
 */
export function createSVGEmitter(
  config: Partial<Omit<SVGEmitterType, 'id' | 'type'>> = {}
): Omit<SVGEmitterType, 'id'> {
  return {
    type: 'svg',
    name: config.name ?? 'SVG Emitter',
    active: config.active ?? true,
    visible: config.visible ?? true,
    locked: config.locked ?? false,
    
    // Transform
    position: config.position ?? [0.5, 0.5],
    rotation: config.rotation ?? 0,
    scale: config.scale ?? [1, 1],
    
    // SVG-specific
    svgPath: config.svgPath ?? 'M 0 0 L 100 0 L 100 100 L 0 100 Z',
    samples: config.samples ?? 50,
    normalizeSize: config.normalizeSize ?? true,
    
    // Emission properties
    force: config.force ?? 0.18,
    forceScale: config.forceScale ?? 1,
    radius: config.radius ?? 0.0006,
    radiusScale: config.radiusScale ?? 1,
    color: config.color ?? [0.8, 0.5, 1],
    opacity: config.opacity ?? 1,
    emissionRate: config.emissionRate ?? 1,
    
    // Direction
    directionMode: config.directionMode ?? 'normal',
    fixedDirection: config.fixedDirection ?? [0, 1],
    spread: config.spread ?? 10,
    
    // Audio
    audioReactive: config.audioReactive ?? false,
    audioConfig: config.audioConfig,
    animation: config.animation,
  };
}

/**
 * Common SVG path presets
 */
export const svgPathPresets = {
  // Star shape
  star: 'M 50 0 L 61 35 L 98 35 L 68 57 L 79 91 L 50 70 L 21 91 L 32 57 L 2 35 L 39 35 Z',
  
  // Heart shape
  heart: 'M 50 90 C 20 60 0 40 0 25 C 0 10 15 0 30 0 C 40 0 50 10 50 20 C 50 10 60 0 70 0 C 85 0 100 10 100 25 C 100 40 80 60 50 90 Z',
  
  // Triangle
  triangle: 'M 50 0 L 100 100 L 0 100 Z',
  
  // Diamond
  diamond: 'M 50 0 L 100 50 L 50 100 L 0 50 Z',
  
  // Pentagon
  pentagon: 'M 50 0 L 97 35 L 79 91 L 21 91 L 3 35 Z',
  
  // Hexagon
  hexagon: 'M 50 0 L 93 25 L 93 75 L 50 100 L 7 75 L 7 25 Z',
  
  // Arrow
  arrow: 'M 50 0 L 100 40 L 70 40 L 70 100 L 30 100 L 30 40 L 0 40 Z',
  
  // Lightning bolt
  lightning: 'M 60 0 L 30 45 L 50 45 L 40 100 L 70 55 L 50 55 Z',
  
  // Crescent moon
  crescent: 'M 70 5 C 45 5 25 25 25 50 C 25 75 45 95 70 95 C 55 85 45 70 45 50 C 45 30 55 15 70 5 Z',
  
  // Simple wave
  wave: 'M 0 50 Q 25 25 50 50 Q 75 75 100 50',
};

/**
 * SVG emitter presets
 */
export const svgEmitterPresets = {
  /**
   * Star shape
   */
  starEmitter: (): Omit<SVGEmitterType, 'id'> => createSVGEmitter({
    name: 'Star',
    svgPath: svgPathPresets.star,
    samples: 60,
    color: [1, 0.9, 0.3],
    force: 0.2,
    radius: 0.0006,
  }),

  /**
   * Heart shape
   */
  heartEmitter: (): Omit<SVGEmitterType, 'id'> => createSVGEmitter({
    name: 'Heart',
    svgPath: svgPathPresets.heart,
    samples: 70,
    color: [1, 0.3, 0.4],
    force: 0.18,
    radius: 0.0005,
  }),

  /**
   * Diamond shape
   */
  diamondEmitter: (): Omit<SVGEmitterType, 'id'> => createSVGEmitter({
    name: 'Diamond',
    svgPath: svgPathPresets.diamond,
    samples: 40,
    color: [0.4, 0.8, 1],
    force: 0.22,
    radius: 0.0007,
  }),

  /**
   * Lightning bolt
   */
  lightningEmitter: (): Omit<SVGEmitterType, 'id'> => createSVGEmitter({
    name: 'Lightning',
    svgPath: svgPathPresets.lightning,
    samples: 50,
    color: [1, 1, 0.5],
    force: 0.3,
    radius: 0.0008,
    spread: 15,
  }),

  /**
   * Crescent moon
   */
  crescentEmitter: (): Omit<SVGEmitterType, 'id'> => createSVGEmitter({
    name: 'Crescent',
    svgPath: svgPathPresets.crescent,
    samples: 45,
    color: [0.6, 0.7, 1],
    force: 0.15,
    radius: 0.0005,
  }),

  /**
   * Hexagon
   */
  hexagonEmitter: (): Omit<SVGEmitterType, 'id'> => createSVGEmitter({
    name: 'Hexagon',
    svgPath: svgPathPresets.hexagon,
    samples: 36,
    color: [0.3, 1, 0.6],
    force: 0.2,
    radius: 0.0006,
  }),
};

/**
 * Get all preset names
 */
export function getSVGEmitterPresetNames(): string[] {
  return Object.keys(svgEmitterPresets);
}

/**
 * Get a preset by name
 */
export function getSVGEmitterPreset(name: string): Omit<SVGEmitterType, 'id'> | null {
  const preset = svgEmitterPresets[name as keyof typeof svgEmitterPresets];
  return preset ? preset() : null;
}

// ============================================
// SVG Path Parsing & Sampling
// ============================================

interface PathCommand {
  type: string;
  args: number[];
}

/**
 * Parse SVG path data into commands
 */
export function parseSVGPath(d: string): PathCommand[] {
  const commands: PathCommand[] = [];
  const regex = /([MmLlHhVvCcSsQqTtAaZz])([^MmLlHhVvCcSsQqTtAaZz]*)/g;
  
  let match;
  while ((match = regex.exec(d)) !== null) {
    const type = match[1];
    const argsStr = match[2].trim();
    const args = argsStr.length > 0 
      ? argsStr.split(/[\s,]+/).map(parseFloat).filter(n => !isNaN(n))
      : [];
    commands.push({ type, args });
  }
  
  return commands;
}

/**
 * Sample points along an SVG path
 * Returns normalized (0-1) coordinates
 */
export function sampleSVGPath(
  pathData: string,
  samples: number,
  normalize: boolean = true
): Vec2[] {
  const commands = parseSVGPath(pathData);
  if (commands.length === 0) return [];
  
  const points: Vec2[] = [];
  let currentX = 0;
  let currentY = 0;
  let startX = 0;
  let startY = 0;
  
  // First pass: collect all segment endpoints and control points
  const segments: { start: Vec2; end: Vec2; control?: Vec2[]; type: string }[] = [];
  
  for (const cmd of commands) {
    const { type, args } = cmd;
    const isRelative = type === type.toLowerCase();
    
    switch (type.toUpperCase()) {
      case 'M': // Move to
        if (isRelative) {
          currentX += args[0];
          currentY += args[1];
        } else {
          currentX = args[0];
          currentY = args[1];
        }
        startX = currentX;
        startY = currentY;
        break;
        
      case 'L': // Line to
        for (let i = 0; i < args.length; i += 2) {
          const newX = isRelative ? currentX + args[i] : args[i];
          const newY = isRelative ? currentY + args[i + 1] : args[i + 1];
          segments.push({
            start: [currentX, currentY],
            end: [newX, newY],
            type: 'line',
          });
          currentX = newX;
          currentY = newY;
        }
        break;
        
      case 'H': // Horizontal line
        for (const arg of args) {
          const newX = isRelative ? currentX + arg : arg;
          segments.push({
            start: [currentX, currentY],
            end: [newX, currentY],
            type: 'line',
          });
          currentX = newX;
        }
        break;
        
      case 'V': // Vertical line
        for (const arg of args) {
          const newY = isRelative ? currentY + arg : arg;
          segments.push({
            start: [currentX, currentY],
            end: [currentX, newY],
            type: 'line',
          });
          currentY = newY;
        }
        break;
        
      case 'Q': // Quadratic bezier
        for (let i = 0; i < args.length; i += 4) {
          const cx = isRelative ? currentX + args[i] : args[i];
          const cy = isRelative ? currentY + args[i + 1] : args[i + 1];
          const newX = isRelative ? currentX + args[i + 2] : args[i + 2];
          const newY = isRelative ? currentY + args[i + 3] : args[i + 3];
          segments.push({
            start: [currentX, currentY],
            end: [newX, newY],
            control: [[cx, cy]],
            type: 'quadratic',
          });
          currentX = newX;
          currentY = newY;
        }
        break;
        
      case 'C': // Cubic bezier
        for (let i = 0; i < args.length; i += 6) {
          const c1x = isRelative ? currentX + args[i] : args[i];
          const c1y = isRelative ? currentY + args[i + 1] : args[i + 1];
          const c2x = isRelative ? currentX + args[i + 2] : args[i + 2];
          const c2y = isRelative ? currentY + args[i + 3] : args[i + 3];
          const newX = isRelative ? currentX + args[i + 4] : args[i + 4];
          const newY = isRelative ? currentY + args[i + 5] : args[i + 5];
          segments.push({
            start: [currentX, currentY],
            end: [newX, newY],
            control: [[c1x, c1y], [c2x, c2y]],
            type: 'cubic',
          });
          currentX = newX;
          currentY = newY;
        }
        break;
        
      case 'Z': // Close path
        if (currentX !== startX || currentY !== startY) {
          segments.push({
            start: [currentX, currentY],
            end: [startX, startY],
            type: 'line',
          });
        }
        currentX = startX;
        currentY = startY;
        break;
    }
  }
  
  if (segments.length === 0) return [];
  
  // Sample points from segments
  const samplesPerSegment = Math.max(2, Math.ceil(samples / segments.length));
  
  for (const seg of segments) {
    for (let i = 0; i < samplesPerSegment; i++) {
      const t = i / (samplesPerSegment - 1);
      let point: Vec2;
      
      if (seg.type === 'line') {
        point = [
          seg.start[0] + (seg.end[0] - seg.start[0]) * t,
          seg.start[1] + (seg.end[1] - seg.start[1]) * t,
        ];
      } else if (seg.type === 'quadratic' && seg.control) {
        const mt = 1 - t;
        point = [
          mt * mt * seg.start[0] + 2 * mt * t * seg.control[0][0] + t * t * seg.end[0],
          mt * mt * seg.start[1] + 2 * mt * t * seg.control[0][1] + t * t * seg.end[1],
        ];
      } else if (seg.type === 'cubic' && seg.control && seg.control.length >= 2) {
        const mt = 1 - t;
        const mt2 = mt * mt;
        const t2 = t * t;
        point = [
          mt2 * mt * seg.start[0] + 3 * mt2 * t * seg.control[0][0] + 3 * mt * t2 * seg.control[1][0] + t2 * t * seg.end[0],
          mt2 * mt * seg.start[1] + 3 * mt2 * t * seg.control[0][1] + 3 * mt * t2 * seg.control[1][1] + t2 * t * seg.end[1],
        ];
      } else {
        point = seg.start;
      }
      
      points.push(point);
    }
  }
  
  // Normalize to 0-1 range if requested
  if (normalize && points.length > 0) {
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    
    for (const p of points) {
      minX = Math.min(minX, p[0]);
      maxX = Math.max(maxX, p[0]);
      minY = Math.min(minY, p[1]);
      maxY = Math.max(maxY, p[1]);
    }
    
    const rangeX = maxX - minX || 1;
    const rangeY = maxY - minY || 1;
    const maxRange = Math.max(rangeX, rangeY);
    
    // Center and normalize
    for (const p of points) {
      p[0] = ((p[0] - minX) / maxRange - 0.5) * 0.4;
      p[1] = ((p[1] - minY) / maxRange - 0.5) * 0.4;
    }
  }
  
  // Subsample to exact count
  if (points.length > samples) {
    const step = points.length / samples;
    const result: Vec2[] = [];
    for (let i = 0; i < samples; i++) {
      result.push(points[Math.floor(i * step)]);
    }
    return result;
  }
  
  return points;
}

