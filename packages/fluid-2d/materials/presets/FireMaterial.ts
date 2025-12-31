/**
 * @package fluid-2d/materials/presets
 * FireMaterial — Blazing fire preset using node graph
 */

import type { MaterialPresetV2 } from '../types';

export const firePreset: MaterialPresetV2 = {
    id: 'fire-v2',
    name: 'Blazing Fire',
    description: 'Hot flames with temperature-based coloring and emissive glow',
    category: 'fire',

    graph: {
        nodes: [
            // Input nodes
            { id: 'dye', type: 'dyeSampler', params: { exposure: 1.5 } },
            { id: 'velocity', type: 'velocitySampler', params: { scale: 1.0 } },

            // Color processing - fire gradient
            {
                id: 'ramp',
                type: 'paletteMap',
                params: {
                    lowColor: [0.1, 0.02, 0.0],      // Dark red/black core
                    midColor: [0.95, 0.4, 0.05],     // Orange flames
                    highColor: [1.0, 0.95, 0.4],     // Yellow/white tips
                    midPosition: 0.35,
                    smoothness: 0.3,
                }
            },

            // Hue variation based on motion
            {
                id: 'hue',
                type: 'hueShift',
                params: {
                    shift: 0.02,    // Slight shift toward orange
                    saturation: 1.3,
                    lightness: 1.1,
                }
            },

            // Foam as ember particles
            {
                id: 'embers',
                type: 'foam',
                params: {
                    source: 0,      // Speed-based
                    threshold: 0.4,
                    softness: 0.2,
                    intensity: 1.2,
                    tint: [1.0, 0.8, 0.3],
                    densityMask: 0.3,
                }
            },

            // Compositing
            { id: 'blend1', type: 'blend', params: { mode: 'add', opacity: 0.5 } },

            // Output with high exposure for glow
            { id: 'output', type: 'output', params: { exposure: 1.3, gamma: 0.9 } },
        ],

        edges: [
            // Dye to color ramp
            { from: { node: 'dye', port: 'density' }, to: { node: 'ramp', port: 'factor' } },

            // Ramp through hue shift
            { from: { node: 'ramp', port: 'color' }, to: { node: 'hue', port: 'color' } },

            // Embers from velocity
            { from: { node: 'velocity', port: 'speed' }, to: { node: 'embers', port: 'speed' } },
            { from: { node: 'dye', port: 'density' }, to: { node: 'embers', port: 'density' } },

            // Blend embers onto fire
            { from: { node: 'hue', port: 'color' }, to: { node: 'blend1', port: 'a' } },
            { from: { node: 'embers', port: 'color' }, to: { node: 'blend1', port: 'b' } },

            // Final output
            { from: { node: 'blend1', port: 'color' }, to: { node: 'output', port: 'color' } },
        ],

        outputNode: 'output',
    },

    legacyConfig: {
        colorMode: 7,
        rampSource: 0,
        backgroundColor: [0.02, 0.01, 0.0],
        dyeExposure: 1.5,
        paletteLowColor: [0.1, 0.02, 0.0],
        paletteMidColor: [0.95, 0.4, 0.05],
        paletteHighColor: [1.0, 0.95, 0.4],
        postEnabled: true,
        bloomIntensity: 0.5,
        bloomThreshold: 0.4,
    },
};
