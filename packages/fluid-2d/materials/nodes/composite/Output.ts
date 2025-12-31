/**
 * @package fluid-2d/materials/nodes/composite
 * Output — Final output node for material graphs
 */

import {
    vec4,
    float,
    clamp,
    pow,
} from 'three/tsl';
import type { MaterialNodeDefinition, ShaderNodeObject } from '../../types';
import { registerMaterialNode } from '../../MaterialNodeRegistry';

export const outputNode: MaterialNodeDefinition = {
    id: 'output',
    label: 'Output',
    category: 'output',
    gpuCost: 1,

    inputs: [
        { id: 'color', label: 'Color', type: 'color' },
        { id: 'alpha', label: 'Alpha', type: 'float', default: 1 },
    ],
    outputs: [
        { id: 'color', label: 'Color', type: 'color' },
        { id: 'output', label: 'Output', type: 'color' },
    ],
    params: {
        exposure: {
            label: 'Exposure',
            type: 'float',
            default: 1.0,
            min: 0,
            max: 5,
            step: 0.01,
        },
        gamma: {
            label: 'Gamma',
            type: 'float',
            default: 1.0,
            min: 0.1,
            max: 3,
            step: 0.01,
        },
        clampOutput: {
            label: 'Clamp Output',
            type: 'bool',
            default: true,
        },
    },

    build: (inputs, params, context) => {
        const inputColor = inputs.color ?? vec4(0, 0, 0, 1);
        const alpha = inputs.alpha ?? float(1);

        // Apply exposure
        const exposed = inputColor.xyz.mul(params.exposure);

        // Apply gamma correction
        const invGamma = float(1).div(params.gamma);
        const gammaCorrected = pow(exposed.clamp(0.0001, 100), invGamma);

        // Optionally clamp to 0-1 range
        // Note: In TSL, we'll always clamp for safety
        const finalRgb = gammaCorrected.clamp(0, 1);

        const output = vec4(finalRgb, alpha);

        return {
            color: output,
            output: output,
        };
    },

    documentation: 'Final output node for material graphs. Applies exposure and gamma correction before output.',
};

// Auto-register on import
registerMaterialNode(outputNode);
