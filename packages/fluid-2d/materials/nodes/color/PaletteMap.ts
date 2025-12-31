/**
 * @package fluid-2d/materials/nodes/color
 * PaletteMap — Map a scalar to a 3-color palette (low/mid/high)
 */

import {
    vec3,
    vec4,
    float,
    smoothstep,
    mix,
} from 'three/tsl';
import type { MaterialNodeDefinition, ShaderNodeObject } from '../../types';
import { registerMaterialNode } from '../../MaterialNodeRegistry';

export const paletteMapNode: MaterialNodeDefinition = {
    id: 'paletteMap',
    label: 'Palette Map',
    category: 'color',
    gpuCost: 1,

    inputs: [
        { id: 'factor', label: 'Factor', type: 'float', default: 0 },
    ],
    outputs: [
        { id: 'color', label: 'Color', type: 'color' },
        { id: 'rgb', label: 'RGB', type: 'vec3' },
    ],
    params: {
        lowColor: {
            label: 'Low Color',
            type: 'color',
            default: [0.1, 0.2, 0.4],
        },
        midColor: {
            label: 'Mid Color',
            type: 'color',
            default: [0.3, 0.6, 0.9],
        },
        highColor: {
            label: 'High Color',
            type: 'color',
            default: [0.9, 0.95, 1.0],
        },
        midPosition: {
            label: 'Mid Position',
            type: 'float',
            default: 0.5,
            min: 0.01,
            max: 0.99,
            step: 0.01,
        },
        smoothness: {
            label: 'Smoothness',
            type: 'float',
            default: 0.3,
            min: 0,
            max: 1,
            step: 0.01,
        },
    },

    build: (inputs, params, context) => {
        const factor = inputs.factor ?? float(0);

        // Get colors from uniforms
        const lowColor = vec3(
            params.lowColor.x ?? float(0.1),
            params.lowColor.y ?? float(0.2),
            params.lowColor.z ?? float(0.4)
        );
        const midColor = vec3(
            params.midColor.x ?? float(0.3),
            params.midColor.y ?? float(0.6),
            params.midColor.z ?? float(0.9)
        );
        const highColor = vec3(
            params.highColor.x ?? float(0.9),
            params.highColor.y ?? float(0.95),
            params.highColor.z ?? float(1.0)
        );

        const midPos = params.midPosition;
        const smooth = params.smoothness;

        // Two-segment blend: low→mid and mid→high
        const halfSmooth = smooth.mul(0.5);

        // Low to mid transition
        const t1Start = midPos.sub(halfSmooth).clamp(0.0, 1.0);
        const t1End = midPos.add(halfSmooth).clamp(0.0, 1.0);
        const t1 = smoothstep(t1Start, t1End, factor);
        const lowMidBlend = mix(lowColor, midColor, t1);

        // Mid to high transition
        const t2Start = midPos.add(halfSmooth).clamp(0.0, 1.0);
        const t2End = float(1.0);
        const t2 = smoothstep(t2Start, t2End, factor);
        const rgb = mix(lowMidBlend, highColor, t2);

        return {
            color: vec4(rgb, float(1.0)),
            rgb,
        };
    },

    documentation: 'Maps a 0-1 scalar through a 3-color palette (low, mid, high) with adjustable mid position and transition smoothness.',
};

// Auto-register on import
registerMaterialNode(paletteMapNode);
