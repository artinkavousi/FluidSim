/**
 * @package fluid-2d/materials/presets
 * Preset exports — 6 built-in material presets
 */

export { waterPreset } from './WaterMaterial';
export { firePreset } from './FireMaterial';
export { milkPreset } from './MilkMaterial';
export { lavaPreset } from './LavaMaterial';
export { smokePreset } from './SmokeMaterial';
export { neonPreset } from './NeonMaterial';

import { waterPreset } from './WaterMaterial';
import { firePreset } from './FireMaterial';
import { milkPreset } from './MilkMaterial';
import { lavaPreset } from './LavaMaterial';
import { smokePreset } from './SmokeMaterial';
import { neonPreset } from './NeonMaterial';
import type { MaterialPresetV2 } from '../types';

// Preset registry
const presetRegistry = new Map<string, MaterialPresetV2>();

export function registerMaterialPresetV2(preset: MaterialPresetV2): void {
    presetRegistry.set(preset.id, preset);
}

export function getMaterialPresetV2(id: string): MaterialPresetV2 | undefined {
    return presetRegistry.get(id);
}

// Alias for useMaterialGraph hook
export const getPreset = getMaterialPresetV2;

export function listMaterialPresetsV2(): MaterialPresetV2[] {
    return Array.from(presetRegistry.values());
}

export function listMaterialPresetsByCategory(
    category: MaterialPresetV2['category']
): MaterialPresetV2[] {
    return listMaterialPresetsV2().filter(p => p.category === category);
}

// Auto-register built-in presets
registerMaterialPresetV2(waterPreset);
registerMaterialPresetV2(firePreset);
registerMaterialPresetV2(milkPreset);
registerMaterialPresetV2(lavaPreset);
registerMaterialPresetV2(smokePreset);
registerMaterialPresetV2(neonPreset);
