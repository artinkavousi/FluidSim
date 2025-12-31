/**
 * @package fluid-2d/materials/presets
 * NeonMaterial — Vibrant neon glow with HDR bloom-ready output
 */

import type { MaterialPresetV2 } from '../types';

export const neonPreset: MaterialPresetV2 = {
    id: 'neon',
    name: 'Neon',
    category: 'stylized',
    description: 'Vibrant neon glow perfect for cyberpunk/synthwave aesthetics',

    graph: {
        nodes: [
            { id: 'dye', type: 'dyeSampler', params: {} },
            { id: 'velocity', type: 'velocitySampler', params: {} },
            {
                id: 'hueShift',
                type: 'hueShift',
                params: {
                    hue: 0.0,        // Can animate for rainbow effect
                    saturation: 1.8, // Super saturated
                    lightness: 0.2,
                },
            },
            {
                id: 'colorRamp',
                type: 'colorRamp',
                params: {
                    stops: [
                        { position: 0.0, color: [0.0, 0.0, 0.0] },     // Black core
                        { position: 0.2, color: [0.1, 0.0, 0.3] },    // Deep purple
                        { position: 0.4, color: [0.8, 0.1, 0.5] },    // Hot pink
                        { position: 0.6, color: [0.2, 0.8, 1.0] },    // Cyan
                        { position: 0.8, color: [0.0, 1.0, 0.6] },    // Neon green
                        { position: 1.0, color: [1.5, 1.5, 2.0] },    // HDR white bloom
                    ],
                    interpolation: 'smooth',
                },
            },
            {
                id: 'fresnel',
                type: 'fresnelRim',
                params: {
                    intensity: 0.8,
                    power: 2.0,
                    tintR: 0.5,
                    tintG: 0.8,
                    tintB: 1.0,
                },
            },
            { id: 'blend', type: 'blend', params: { mode: 'add', opacity: 0.5 } },
            { id: 'output', type: 'output', params: { exposure: 1.5, gamma: 0.85 } },
        ],
        edges: [
            { from: { node: 'dye', port: 'color' }, to: { node: 'hueShift', port: 'color' } },
            { from: { node: 'dye', port: 'density' }, to: { node: 'colorRamp', port: 'value' } },
            { from: { node: 'colorRamp', port: 'color' }, to: { node: 'fresnel', port: 'color' } },
            { from: { node: 'fresnel', port: 'color' }, to: { node: 'blend', port: 'base' } },
            { from: { node: 'hueShift', port: 'color' }, to: { node: 'blend', port: 'blend' } },
            { from: { node: 'blend', port: 'color' }, to: { node: 'output', port: 'color' } },
        ],
        outputNode: 'output',
    },
};

export default neonPreset;
