/**
 * @package fluid-2d/emitters
 * All emitter presets aggregated
 */

import { pointEmitterPresets, getPointEmitterPreset } from './PointEmitter';
import { lineEmitterPresets, getLineEmitterPreset } from './LineEmitter';
import { circleEmitterPresets, getCircleEmitterPreset } from './CircleEmitter';
import { curveEmitterPresets, getCurveEmitterPreset } from './CurveEmitter';
import { textEmitterPresets, getTextEmitterPreset } from './TextEmitter';
import { svgEmitterPresets, getSVGEmitterPreset } from './SVGEmitter';
import { brushEmitterPresets, getBrushEmitterPreset } from './BrushEmitter';
import type { Emitter, EmitterType } from './types';

// ============================================
// All Presets
// ============================================

export const allPresets = {
  point: pointEmitterPresets,
  line: lineEmitterPresets,
  circle: circleEmitterPresets,
  curve: curveEmitterPresets,
  text: textEmitterPresets,
  svg: svgEmitterPresets,
  brush: brushEmitterPresets,
};

// ============================================
// Preset Getters
// ============================================

/**
 * Get all preset names for a specific emitter type
 */
export function getPresetNames(type: EmitterType): string[] {
  const presets = allPresets[type];
  return presets ? Object.keys(presets) : [];
}

/**
 * Get all available presets grouped by type
 */
export function getAllPresetNames(): Record<EmitterType, string[]> {
  return {
    point: Object.keys(pointEmitterPresets),
    line: Object.keys(lineEmitterPresets),
    circle: Object.keys(circleEmitterPresets),
    curve: Object.keys(curveEmitterPresets),
    text: Object.keys(textEmitterPresets),
    svg: Object.keys(svgEmitterPresets),
    brush: Object.keys(brushEmitterPresets),
  };
}

/**
 * Get a preset by type and name
 */
export function getPreset(type: EmitterType, name: string): Omit<Emitter, 'id'> | null {
  switch (type) {
    case 'point': return getPointEmitterPreset(name);
    case 'line': return getLineEmitterPreset(name);
    case 'circle': return getCircleEmitterPreset(name);
    case 'curve': return getCurveEmitterPreset(name);
    case 'text': return getTextEmitterPreset(name);
    case 'svg': return getSVGEmitterPreset(name);
    case 'brush': return getBrushEmitterPreset(name);
    default: return null;
  }
}

/**
 * Get the first/default preset for a type
 */
export function getDefaultPreset(type: EmitterType): Omit<Emitter, 'id'> | null {
  const names = getPresetNames(type);
  if (names.length === 0) return null;
  return getPreset(type, names[0]);
}

// ============================================
// Quick Access Presets
// ============================================

/**
 * Most commonly used presets for quick access
 */
export const quickPresets = {
  fountain: () => getPreset('point', 'fountain'),
  fireJet: () => getPreset('point', 'fireJet'),
  horizontalWave: () => getPreset('line', 'horizontalWave'),
  rainbowLine: () => getPreset('line', 'rainbowLine'),
  outwardRing: () => getPreset('circle', 'outwardRing'),
  blackHole: () => getPreset('circle', 'blackHole'),
  sWave: () => getPreset('curve', 'sWave'),
  heartCurve: () => getPreset('curve', 'heartCurve'),
  basicText: () => getPreset('text', 'basicText'),
  starEmitter: () => getPreset('svg', 'starEmitter'),
};

// Re-export individual preset collections
export {
  pointEmitterPresets,
  lineEmitterPresets,
  circleEmitterPresets,
  curveEmitterPresets,
  textEmitterPresets,
  svgEmitterPresets,
  brushEmitterPresets,
};


