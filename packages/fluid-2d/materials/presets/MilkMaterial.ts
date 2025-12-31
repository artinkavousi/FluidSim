/**
 * @package fluid-2d/materials/presets
 * MilkMaterial — Translucent subsurface scattering milk/cream preset
 */

import type { MaterialPresetV2 } from '../types';

export const milkPreset: MaterialPresetV2 = {
    id: 'milk',
    name: 'Milk',
    category: 'liquid',
    description: 'Translucent milk/cream with soft subsurface scattering',

    graph: {
        nodes: [
            { id: 'dye', type: 'dyeSampler', params: {} },
            { id: 'velocity', type: 'velocitySampler', params: {} },
            { id: 'normal', type: 'normalFromGradient', params: { strength: 1.5 } },
            {
                id: 'subsurface',
                type: 'subsurface',
                params: {
                    intensity: 0.6,
                    thickness: 0.8,
                    scatterColorR: 1.0,
                    scatterColorG: 0.95,
                    scatterColorB: 0.85,
                    distortion: 0.3,
                    power: 1.5,
                    ambient: 0.15,
                },
            },
            {
                id: 'specular',
                type: 'specular',
                params: {
                    intensity: 0.25,
                    roughness: 0.15,
                    specularColor: [1.0, 1.0, 0.98],
                    lightX: 0.3,
                    lightY: 0.6,
                    lightZ: 1.0,
                    model: 0,
                },
            },
            { id: 'output', type: 'output', params: { exposure: 1.1, gamma: 1.0 } },
        ],
        edges: [
            { from: { node: 'dye', port: 'color' }, to: { node: 'subsurface', port: 'color' } },
            { from: { node: 'dye', port: 'density' }, to: { node: 'subsurface', port: 'density' } },
            { from: { node: 'dye', port: 'density' }, to: { node: 'normal', port: 'density' } },
            { from: { node: 'velocity', port: 'velocity' }, to: { node: 'normal', port: 'velocity' } },
            { from: { node: 'normal', port: 'normal' }, to: { node: 'subsurface', port: 'normal' } },
            { from: { node: 'subsurface', port: 'color' }, to: { node: 'specular', port: 'color' } },
            { from: { node: 'normal', port: 'normal' }, to: { node: 'specular', port: 'normal' } },
            { from: { node: 'specular', port: 'color' }, to: { node: 'output', port: 'color' } },
        ],
        outputNode: 'output',
    },
};

export default milkPreset;
