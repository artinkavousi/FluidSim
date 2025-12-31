/**
 * @package fluid-2d/render
 * MaterialPresets — Curated visual presets for fluid rendering
 * 
 * Each preset contains partial RenderOutput2DConfig values that define a distinct look.
 * Apply a preset by merging with defaultPostConfig.
 */

import type { RenderOutput2DConfig } from './RenderOutput2D';

// ============================================
// Types
// ============================================

export interface MaterialPreset {
    id: string;
    name: string;
    description: string;
    category: 'liquid' | 'fire' | 'smoke' | 'abstract' | 'stylized' | 'cinematic';
    thumbnail?: string;
    config: Partial<RenderOutput2DConfig>;
}

// ============================================
// Preset Registry
// ============================================

const presetRegistry = new Map<string, MaterialPreset>();

export function registerMaterialPreset(preset: MaterialPreset): void {
    presetRegistry.set(preset.id, preset);
}

export function getMaterialPreset(id: string): MaterialPreset | undefined {
    return presetRegistry.get(id);
}

export function getMaterialPresets(): MaterialPreset[] {
    return Array.from(presetRegistry.values());
}

export function getMaterialPresetsByCategory(category: MaterialPreset['category']): MaterialPreset[] {
    return getMaterialPresets().filter(p => p.category === category);
}

export function getMaterialPresetCategories(): MaterialPreset['category'][] {
    return ['liquid', 'fire', 'smoke', 'abstract', 'stylized', 'cinematic'];
}

// ============================================
// Built-in Presets
// ============================================

// --- LIQUID PRESETS ---

export const presetWater: MaterialPreset = {
    id: 'water',
    name: 'Crystal Water',
    description: 'Clear blue water with soft foam and light refraction',
    category: 'liquid',
    config: {
        colorMode: 0,
        backgroundColor: [0.02, 0.04, 0.08],
        dyeBlendMode: 0,
        dyeOpacity: 0.95,
        dyeBrightness: 1.1,
        dyeSaturation: 1.2,
        dyeFresnelEnabled: true,
        dyeFresnelStrength: 0.4,
        dyeFresnelPower: 2.5,
        dyeFresnelTint: [0.7, 0.9, 1.0],
        dyeFoamEnabled: true,
        dyeFoamSource: 1,
        dyeFoamStrength: 0.3,
        dyeFoamThreshold: 0.15,
        dyeFoamTint: [1.0, 1.0, 1.0],
        postEnabled: true,
        bloomIntensity: 0.2,
        bloomThreshold: 0.7,
    },
};

export const presetOil: MaterialPreset = {
    id: 'oil',
    name: 'Iridescent Oil',
    description: 'Oily rainbow sheen with chromatic shifts',
    category: 'liquid',
    config: {
        colorMode: 0,
        backgroundColor: [0.02, 0.02, 0.03],
        dyeBlendMode: 0,
        dyeOpacity: 1.0,
        dyeBrightness: 1.3,
        dyeSaturation: 1.4,
        dyeHueFromVelocity: 0.4,
        dyeFresnelEnabled: true,
        dyeFresnelStrength: 0.6,
        dyeFresnelPower: 2.0,
        dyeFresnelTint: [1.0, 0.8, 1.0],
        postEnabled: true,
        chromaticAberration: 0.003,
        bloomIntensity: 0.25,
    },
};

export const presetInk: MaterialPreset = {
    id: 'ink',
    name: 'Flowing Ink',
    description: 'Rich dark ink with soft edges and depth',
    category: 'liquid',
    config: {
        colorMode: 0,
        backgroundColor: [0.95, 0.93, 0.88],
        dyeBlendMode: 0,
        dyeOpacity: 0.85,
        dyeBrightness: 0.4,
        dyeSaturation: 0.3,
        dyeContrast: 1.3,
        dyeEdgeStrength: 0.2,
        dyeMediumEnabled: true,
        dyeMediumDensity: 1.2,
        dyeAbsorptionStrength: 0.9,
        dyeAbsorptionColor: [0.1, 0.08, 0.05],
        postEnabled: false,
    },
};

// --- FIRE PRESETS ---

export const presetFire: MaterialPreset = {
    id: 'fire',
    name: 'Blazing Fire',
    description: 'Hot flames with bloom and emissive glow',
    category: 'fire',
    config: {
        colorMode: 7, // Ramp/gradient mode
        rampSource: 0,
        backgroundColor: [0.02, 0.01, 0.01],
        dyeBlendMode: 1, // Additive
        dyeOpacity: 1.0,
        dyeBrightness: 1.8,
        dyeSaturation: 1.5,
        paletteLowColor: [0.1, 0.02, 0.0],
        paletteMidColor: [1.0, 0.4, 0.05],
        paletteHighColor: [1.0, 0.95, 0.6],
        postEnabled: true,
        bloomIntensity: 0.5,
        bloomThreshold: 0.4,
        bloomRadius: 1.2,
        motionBlurEnabled: true,
        motionBlurSamples: 6,
    },
};

export const presetEmbers: MaterialPreset = {
    id: 'embers',
    name: 'Glowing Embers',
    description: 'Smoldering coals with orange-red glow',
    category: 'fire',
    config: {
        colorMode: 7,
        rampSource: 0,
        backgroundColor: [0.01, 0.005, 0.0],
        dyeBlendMode: 1,
        dyeOpacity: 1.0,
        dyeBrightness: 1.4,
        paletteLowColor: [0.05, 0.01, 0.0],
        paletteMidColor: [0.8, 0.2, 0.02],
        paletteHighColor: [1.0, 0.6, 0.1],
        postEnabled: true,
        bloomIntensity: 0.4,
        bloomThreshold: 0.5,
        noiseIntensity: 0.03,
    },
};

// --- SMOKE PRESETS ---

export const presetSmoke: MaterialPreset = {
    id: 'smoke',
    name: 'Wispy Smoke',
    description: 'Soft gray smoke with volumetric feel',
    category: 'smoke',
    config: {
        colorMode: 0,
        backgroundColor: [0.08, 0.1, 0.12],
        dyeBlendMode: 0,
        dyeOpacity: 0.7,
        dyeBrightness: 0.8,
        dyeSaturation: 0.2,
        dyeContrast: 1.1,
        dyeMediumEnabled: true,
        dyeMediumDensity: 0.8,
        dyeScatteringStrength: 0.5,
        dyeScatteringColor: [0.6, 0.65, 0.7],
        trailEnabled: true,
        trailDecay: 0.95,
        postEnabled: true,
        vignetteIntensity: 0.3,
    },
};

export const presetSteam: MaterialPreset = {
    id: 'steam',
    name: 'Hot Steam',
    description: 'Bright white steam with soft glow',
    category: 'smoke',
    config: {
        colorMode: 0,
        backgroundColor: [0.15, 0.18, 0.22],
        dyeBlendMode: 2, // Screen
        dyeOpacity: 0.6,
        dyeBrightness: 1.5,
        dyeSaturation: 0.1,
        dyeFresnelEnabled: true,
        dyeFresnelStrength: 0.3,
        dyeFresnelPower: 3.0,
        dyeFresnelTint: [1.0, 1.0, 1.0],
        postEnabled: true,
        bloomIntensity: 0.15,
        bloomThreshold: 0.8,
    },
};

// --- ABSTRACT PRESETS ---

export const presetNeon: MaterialPreset = {
    id: 'neon',
    name: 'Neon Glow',
    description: 'Vibrant neon colors with strong bloom',
    category: 'abstract',
    config: {
        colorMode: 0,
        backgroundColor: [0.0, 0.0, 0.02],
        dyeBlendMode: 1, // Additive
        dyeOpacity: 1.0,
        dyeBrightness: 2.0,
        dyeSaturation: 2.0,
        postEnabled: true,
        bloomIntensity: 0.7,
        bloomThreshold: 0.3,
        bloomRadius: 1.5,
        chromaticAberration: 0.002,
    },
};

export const presetPastel: MaterialPreset = {
    id: 'pastel',
    name: 'Soft Pastel',
    description: 'Muted pastel colors with dreamy softness',
    category: 'abstract',
    config: {
        colorMode: 0,
        backgroundColor: [0.95, 0.92, 0.9],
        dyeBlendMode: 0,
        dyeOpacity: 0.8,
        dyeBrightness: 1.2,
        dyeSaturation: 0.6,
        dyeContrast: 0.9,
        postEnabled: true,
        bloomIntensity: 0.1,
        bloomThreshold: 0.9,
        vignetteIntensity: 0.15,
        brightness: 1.1,
        contrast: 0.95,
        saturation: 0.8,
    },
};

// --- STYLIZED PRESETS ---

export const presetRetro: MaterialPreset = {
    id: 'retro',
    name: 'Retro VHS',
    description: 'Vintage look with grain and chromatic shift',
    category: 'stylized',
    config: {
        colorMode: 0,
        backgroundColor: [0.05, 0.05, 0.08],
        dyeBlendMode: 0,
        dyeOpacity: 1.0,
        dyeBrightness: 1.1,
        dyeSaturation: 1.3,
        postEnabled: true,
        chromaticAberration: 0.004,
        rgbShiftEnabled: true,
        rgbShiftAmount: 0.002,
        noiseIntensity: 0.08,
        vignetteIntensity: 0.4,
        vignetteRadius: 0.7,
        contrast: 1.15,
    },
};

export const presetComic: MaterialPreset = {
    id: 'comic',
    name: 'Comic Style',
    description: 'Bold colors with sharp edges',
    category: 'stylized',
    config: {
        colorMode: 0,
        backgroundColor: [1.0, 1.0, 1.0],
        dyeBlendMode: 0,
        dyeOpacity: 1.0,
        dyeBrightness: 1.3,
        dyeSaturation: 1.8,
        dyeContrast: 1.5,
        dyeEdgeStrength: 0.5,
        postEnabled: true,
        sharpenEnabled: true,
        sharpenAmount: 0.8,
        sharpenRadius: 0.8,
    },
};

// --- CINEMATIC PRESETS ---

export const presetCinematic: MaterialPreset = {
    id: 'cinematic',
    name: 'Cinematic',
    description: 'Film-quality look with teal-orange grading',
    category: 'cinematic',
    config: {
        colorMode: 0,
        backgroundColor: [0.02, 0.03, 0.04],
        dyeBlendMode: 0,
        dyeOpacity: 1.0,
        dyeBrightness: 1.15,
        dyeSaturation: 1.1,
        postEnabled: true,
        toneMapping: 1, // ACES
        exposure: 1.1,
        bloomIntensity: 0.2,
        bloomThreshold: 0.7,
        vignetteIntensity: 0.25,
        vignetteRadius: 0.8,
        noiseIntensity: 0.02,
        contrast: 1.1,
        saturation: 1.05,
    },
};

export const presetMonochrome: MaterialPreset = {
    id: 'monochrome',
    name: 'Monochrome',
    description: 'Black and white with high contrast',
    category: 'cinematic',
    config: {
        colorMode: 0,
        backgroundColor: [0.0, 0.0, 0.0],
        dyeBlendMode: 0,
        dyeOpacity: 1.0,
        dyeBrightness: 1.2,
        dyeSaturation: 0.0,
        dyeContrast: 1.4,
        postEnabled: true,
        saturation: 0.0,
        contrast: 1.3,
        vignetteIntensity: 0.35,
        noiseIntensity: 0.04,
    },
};

// ============================================
// Register All Built-in Presets
// ============================================

const builtInPresets: MaterialPreset[] = [
    presetWater,
    presetOil,
    presetInk,
    presetFire,
    presetEmbers,
    presetSmoke,
    presetSteam,
    presetNeon,
    presetPastel,
    presetRetro,
    presetComic,
    presetCinematic,
    presetMonochrome,
];

builtInPresets.forEach(registerMaterialPreset);

// ============================================
// Preset Application Helper
// ============================================

import { defaultPostConfig } from './RenderOutput2D';

/**
 * Apply a material preset to get a complete RenderOutput2DConfig
 */
export function applyMaterialPreset(presetId: string): RenderOutput2DConfig {
    const preset = getMaterialPreset(presetId);
    if (!preset) {
        return { ...defaultPostConfig };
    }
    return { ...defaultPostConfig, ...preset.config };
}

/**
 * Apply a material preset partially (for merging with existing config)
 */
export function getMaterialPresetConfig(presetId: string): Partial<RenderOutput2DConfig> {
    const preset = getMaterialPreset(presetId);
    return preset?.config ?? {};
}
