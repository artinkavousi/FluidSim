/**
 * @package fluid-2d/materials/nodes/shading
 * Foam — Generate foam/edge highlights from velocity and vorticity
 */

import {
    vec3,
    vec4,
    float,
    smoothstep,
    clamp,
    pow,
    max,
} from 'three/tsl';
import type { MaterialNodeDefinition, ShaderNodeObject } from '../../types';
import { registerMaterialNode } from '../../MaterialNodeRegistry';

export const foamNode: MaterialNodeDefinition = {
    id: 'foam',
    label: 'Foam',
    category: 'shading',
    gpuCost: 2,

    inputs: [
        { id: 'speed', label: 'Speed', type: 'float' },
        { id: 'vorticity', label: 'Vorticity', type: 'float' },
        { id: 'density', label: 'Density', type: 'float' },
    ],
    outputs: [
        { id: 'color', label: 'Color', type: 'color' },
        { id: 'factor', label: 'Factor', type: 'float' },
    ],
    params: {
        source: {
            label: 'Source',
            type: 'enum',
            default: 0,
            options: [
                { label: 'Speed', value: 0 },
                { label: 'Vorticity', value: 1 },
                { label: 'Speed + Vorticity', value: 2 },
            ],
        },
        threshold: {
            label: 'Threshold',
            type: 'float',
            default: 0.2,
            min: 0,
            max: 1,
            step: 0.01,
        },
        softness: {
            label: 'Softness',
            type: 'float',
            default: 0.3,
            min: 0.01,
            max: 1,
            step: 0.01,
        },
        intensity: {
            label: 'Intensity',
            type: 'float',
            default: 1.0,
            min: 0,
            max: 3,
            step: 0.01,
        },
        tint: {
            label: 'Tint',
            type: 'color',
            default: [1, 1, 1],
        },
        densityMask: {
            label: 'Density Mask',
            type: 'float',
            default: 0.5,
            min: 0,
            max: 1,
            step: 0.01,
        },
    },

    build: (inputs, params, context) => {
        const speed = inputs.speed ?? float(0);
        const vort = inputs.vorticity ?? float(0);
        const density = inputs.density ?? float(1);

        // Select source based on mode
        const sourceValue = params.source;

        // Calculate base foam value from source
        // Note: In compiled TSL, we'll use both weighted by source type
        const srcSpeed = speed;
        const srcVort = vort.abs();
        const srcCombined = max(srcSpeed, srcVort);

        // Apply threshold with soft edge
        const threshLow = params.threshold;
        const threshHigh = threshLow.add(params.softness);

        // Foam factor from each source
        const foamFromSpeed = smoothstep(threshLow, threshHigh, srcSpeed);
        const foamFromVort = smoothstep(threshLow, threshHigh, srcVort);
        const foamCombined = smoothstep(threshLow, threshHigh, srcCombined);

        // Blend based on source (simplified - use combined for now)
        const rawFoam = foamCombined;

        // Apply density masking (foam appears more on edges)
        const densityFactor = float(1).sub(pow(density, params.densityMask.add(0.1)));
        const foamFactor = rawFoam.mul(densityFactor).mul(params.intensity).clamp(0, 1);

        // Apply tint
        const tint = vec3(
            params.tint.x ?? float(1),
            params.tint.y ?? float(1),
            params.tint.z ?? float(1)
        );
        const foamColor = tint.mul(foamFactor);

        return {
            color: vec4(foamColor, foamFactor),
            factor: foamFactor,
        };
    },

    documentation: 'Generates foam/edge highlights based on velocity speed and/or vorticity. Use density masking to make foam appear on fluid edges.',
};

// Auto-register on import
registerMaterialNode(foamNode);
