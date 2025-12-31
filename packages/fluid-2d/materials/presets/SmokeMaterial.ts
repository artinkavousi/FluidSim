/**
 * @package fluid-2d/materials/presets
 * SmokeMaterial — Soft volumetric smoke with wispy edges
 */

import type { MaterialPresetV2 } from '../types';

export const smokePreset: MaterialPresetV2 = {
    id: 'smoke',
    name: 'Smoke',
    category: 'smoke',
    description: 'Soft volumetric smoke with wispy dissipating edges',

    graph: {
        nodes: [
            { id: 'dye', type: 'dyeSampler', params: {} },
            { id: 'velocity', type: 'velocitySampler', params: {} },
            {
                id: 'palette',
                type: 'paletteMap',
                params: {
                    lowR: 0.15, lowG: 0.15, lowB: 0.18,    // Dark gray
                    midR: 0.4, midG: 0.42, midB: 0.45,     // Mid gray
                    highR: 0.85, highG: 0.88, highB: 0.9,  // Light gray
                    midPosition: 0.4,
                    smoothness: 0.6,
                },
            },
            {
                id: 'fresnel',
                type: 'fresnelRim',
                params: {
                    intensity: 0.2,
                    power: 3.0,
                    tintR: 0.9,
                    tintG: 0.92,
                    tintB: 1.0,
                },
            },
            { id: 'output', type: 'output', params: { exposure: 0.95, gamma: 1.1 } },
        ],
        edges: [
            { from: { node: 'dye', port: 'density' }, to: { node: 'palette', port: 'value' } },
            { from: { node: 'palette', port: 'color' }, to: { node: 'fresnel', port: 'color' } },
            { from: { node: 'fresnel', port: 'color' }, to: { node: 'output', port: 'color' } },
        ],
        outputNode: 'output',
    },
};

export default smokePreset;
