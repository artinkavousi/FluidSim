/**
 * @package fluid-2d/materials/nodes/shading
 * FresnelRim — Fresnel-based rim lighting effect
 */

import {
    vec3,
    vec4,
    float,
    normalize,
    dot,
    pow,
    clamp,
    mix,
} from 'three/tsl';
import type { MaterialNodeDefinition, ShaderNodeObject } from '../../types';
import { registerMaterialNode } from '../../MaterialNodeRegistry';

export const fresnelRimNode: MaterialNodeDefinition = {
    id: 'fresnelRim',
    label: 'Fresnel Rim',
    category: 'shading',
    gpuCost: 2,

    inputs: [
        { id: 'normal', label: 'Normal', type: 'vec3' },
        { id: 'baseColor', label: 'Base Color', type: 'color' },
    ],
    outputs: [
        { id: 'color', label: 'Color', type: 'color' },
        { id: 'factor', label: 'Factor', type: 'float' },
    ],
    params: {
        power: {
            label: 'Power',
            type: 'float',
            default: 3.0,
            min: 0.1,
            max: 10,
            step: 0.1,
        },
        intensity: {
            label: 'Intensity',
            type: 'float',
            default: 0.5,
            min: 0,
            max: 2,
            step: 0.01,
        },
        tint: {
            label: 'Tint',
            type: 'color',
            default: [1, 1, 1],
        },
        bias: {
            label: 'Bias',
            type: 'float',
            default: 0.02,
            min: 0,
            max: 0.5,
            step: 0.01,
        },
    },

    build: (inputs, params, context) => {
        // Get input normal (default to up)
        const normal = inputs.normal ?? vec3(0, 0, 1);
        const baseColor = inputs.baseColor ?? vec4(0, 0, 0, 1);

        // View direction (for 2D, assume straight-on view)
        const viewDir = vec3(0, 0, 1);

        // Calculate fresnel factor
        const nDotV = dot(normalize(normal), viewDir).clamp(0, 1);
        const fresnel = pow(float(1).sub(nDotV), params.power);
        const factor = fresnel.mul(params.intensity).add(params.bias).clamp(0, 1);

        // Apply tint
        const tint = vec3(
            params.tint.x ?? float(1),
            params.tint.y ?? float(1),
            params.tint.z ?? float(1)
        );

        // Blend tinted rim onto base color
        const rimColor = tint.mul(factor);
        const finalRgb = baseColor.xyz.add(rimColor);

        return {
            color: vec4(finalRgb, float(1.0)),
            factor,
        };
    },

    documentation: 'Adds a Fresnel-based rim lighting effect. Connect a normal input from NormalFromGradient for best results.',
};

// Auto-register on import
registerMaterialNode(fresnelRimNode);
