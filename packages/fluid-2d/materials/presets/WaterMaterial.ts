/**
 * @package fluid-2d/materials/presets
 * WaterMaterial — Crystal water preset using node graph
 */

import type { MaterialPresetV2 } from '../types';

export const waterPreset: MaterialPresetV2 = {
    id: 'water-v2',
    name: 'Crystal Water',
    description: 'Clear water with caustic-like highlights, rim lighting, and subtle foam',
    category: 'liquid',

    graph: {
        nodes: [
            // Input nodes
            { id: 'dye', type: 'dyeSampler', params: { exposure: 1.2 } },
            { id: 'velocity', type: 'velocitySampler', params: { scale: 1.0 } },

            // Color processing
            {
                id: 'ramp',
                type: 'paletteMap',
                params: {
                    lowColor: [0.05, 0.15, 0.35],
                    midColor: [0.2, 0.5, 0.85],
                    highColor: [0.85, 0.95, 1.0],
                    midPosition: 0.4,
                    smoothness: 0.4,
                }
            },

            // Shading
            {
                id: 'normal',
                type: 'normalFromGradient',
                params: { strength: 1.5, offset: 1.0 }
            },
            {
                id: 'fresnel',
                type: 'fresnelRim',
                params: {
                    power: 3.0,
                    intensity: 0.4,
                    tint: [0.9, 0.95, 1.0],
                    bias: 0.02,
                }
            },
            {
                id: 'foam',
                type: 'foam',
                params: {
                    source: 2,
                    threshold: 0.25,
                    softness: 0.3,
                    intensity: 0.5,
                    tint: [1.0, 1.0, 1.0],
                    densityMask: 0.6,
                }
            },

            // Compositing
            { id: 'blend1', type: 'blend', params: { mode: 'add', opacity: 1.0 } },
            { id: 'blend2', type: 'blend', params: { mode: 'add', opacity: 0.6 } },

            // Output
            { id: 'output', type: 'output', params: { exposure: 1.0, gamma: 1.0 } },
        ],

        edges: [
            // Dye to color ramp
            { from: { node: 'dye', port: 'density' }, to: { node: 'ramp', port: 'factor' } },

            // Normal generation
            { from: { node: 'dye', port: 'density' }, to: { node: 'normal', port: 'uv' } },

            // Fresnel from normal
            { from: { node: 'normal', port: 'normal' }, to: { node: 'fresnel', port: 'normal' } },
            { from: { node: 'ramp', port: 'color' }, to: { node: 'fresnel', port: 'baseColor' } },

            // Foam from velocity
            { from: { node: 'velocity', port: 'speed' }, to: { node: 'foam', port: 'speed' } },
            { from: { node: 'dye', port: 'density' }, to: { node: 'foam', port: 'density' } },

            // Blend fresnel rim onto base
            { from: { node: 'ramp', port: 'color' }, to: { node: 'blend1', port: 'a' } },
            { from: { node: 'fresnel', port: 'color' }, to: { node: 'blend1', port: 'b' } },

            // Blend foam onto result
            { from: { node: 'blend1', port: 'color' }, to: { node: 'blend2', port: 'a' } },
            { from: { node: 'foam', port: 'color' }, to: { node: 'blend2', port: 'b' } },

            // Final output
            { from: { node: 'blend2', port: 'color' }, to: { node: 'output', port: 'color' } },
        ],

        outputNode: 'output',
    },

    // Legacy config fallback for backwards compatibility
    legacyConfig: {
        colorMode: 0,
        backgroundColor: [0.02, 0.04, 0.08],
        dyeExposure: 1.2,
        dyeFresnelEnabled: true,
        dyeFresnelStrength: 0.4,
        dyeFresnelPower: 3.0,
        dyeFresnelTint: [0.9, 0.95, 1.0],
        dyeFoamEnabled: true,
        dyeFoamSource: 2,
        dyeFoamStrength: 0.5,
        dyeFoamThreshold: 0.25,
        dyeFoamTint: [1.0, 1.0, 1.0],
        paletteLowColor: [0.05, 0.15, 0.35],
        paletteMidColor: [0.2, 0.5, 0.85],
        paletteHighColor: [0.85, 0.95, 1.0],
    },
};
