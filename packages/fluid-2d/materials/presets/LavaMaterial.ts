/**
 * @package fluid-2d/materials/presets
 * LavaMaterial — Molten lava with emissive glow and heat distortion
 */

import type { MaterialPresetV2 } from '../types';

export const lavaPreset: MaterialPresetV2 = {
    id: 'lava',
    name: 'Lava',
    category: 'fire',
    description: 'Molten lava with emissive cracks and heat shimmer',

    graph: {
        nodes: [
            { id: 'dye', type: 'dyeSampler', params: {} },
            { id: 'velocity', type: 'velocitySampler', params: {} },
            {
                id: 'colorRamp',
                type: 'colorRamp',
                params: {
                    stops: [
                        { position: 0.0, color: [0.1, 0.02, 0.0] },    // Dark cooled rock
                        { position: 0.3, color: [0.6, 0.1, 0.0] },    // Dark red
                        { position: 0.5, color: [0.95, 0.3, 0.0] },   // Orange
                        { position: 0.7, color: [1.0, 0.6, 0.1] },    // Yellow-orange
                        { position: 1.0, color: [1.0, 0.95, 0.7] },   // Hot white
                    ],
                    interpolation: 'smooth',
                },
            },
            {
                id: 'fresnel',
                type: 'fresnelRim',
                params: {
                    intensity: 0.4,
                    power: 2.5,
                    tintR: 1.0,
                    tintG: 0.4,
                    tintB: 0.1,
                },
            },
            { id: 'blend', type: 'blend', params: { mode: 'add', opacity: 0.6 } },
            { id: 'output', type: 'output', params: { exposure: 1.3, gamma: 0.9 } },
        ],
        edges: [
            { from: { node: 'dye', port: 'density' }, to: { node: 'colorRamp', port: 'value' } },
            { from: { node: 'colorRamp', port: 'color' }, to: { node: 'fresnel', port: 'color' } },
            { from: { node: 'fresnel', port: 'color' }, to: { node: 'blend', port: 'base' } },
            { from: { node: 'colorRamp', port: 'color' }, to: { node: 'blend', port: 'blend' } },
            { from: { node: 'blend', port: 'color' }, to: { node: 'output', port: 'color' } },
        ],
        outputNode: 'output',
    },
};

export default lavaPreset;
