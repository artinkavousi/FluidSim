/**
 * @package fluid-2d/materials/nodes/color
 * ColorRamp — Map a scalar value to a multi-stop color gradient
 */

import {
    Fn,
    vec3,
    vec4,
    float,
    If,
    select,
    smoothstep,
    mix,
} from 'three/tsl';
import type { MaterialNodeDefinition, ShaderNodeObject } from '../../types';
import { registerMaterialNode } from '../../MaterialNodeRegistry';

export interface ColorStop {
    position: number;  // 0-1
    color: [number, number, number];  // RGB
}

/**
 * Build a gradient evaluation TSL node from color stops
 * Uses nested conditional blending for multi-stop gradients
 */
function buildGradientTSL(
    factor: ShaderNodeObject,
    stops: ColorStop[],
    interpolation: string
): ShaderNodeObject {
    if (stops.length === 0) {
        return vec3(0, 0, 0);
    }
    if (stops.length === 1) {
        const c = stops[0].color;
        return vec3(c[0], c[1], c[2]);
    }

    // Sort stops by position
    const sorted = [...stops].sort((a, b) => a.position - b.position);

    // Start with the first color
    let result: ShaderNodeObject = vec3(sorted[0].color[0], sorted[0].color[1], sorted[0].color[2]);

    // Chain through each segment
    for (let i = 0; i < sorted.length - 1; i++) {
        const stop0 = sorted[i];
        const stop1 = sorted[i + 1];
        const c0 = vec3(stop0.color[0], stop0.color[1], stop0.color[2]);
        const c1 = vec3(stop1.color[0], stop1.color[1], stop1.color[2]);

        // Calculate interpolation factor within this segment
        const segmentStart = float(stop0.position);
        const segmentEnd = float(stop1.position);
        const segmentWidth = segmentEnd.sub(segmentStart);

        // Avoid division by zero
        const safeWidth = segmentWidth.add(float(0.0001));
        const localT = factor.sub(segmentStart).div(safeWidth).clamp(0, 1);

        // Apply interpolation mode
        let blendT: ShaderNodeObject;
        if (interpolation === 'smooth') {
            blendT = smoothstep(float(0), float(1), localT);
        } else if (interpolation === 'step') {
            blendT = select(localT.lessThan(0.5), float(0), float(1));
        } else {
            // Default: linear
            blendT = localT;
        }

        // Blend colors
        const blended = mix(c0, c1, blendT);

        // Only apply this segment when factor is within range
        const inSegment = factor.greaterThanEqual(segmentStart);
        result = select(inSegment, blended, result);
    }

    return result;
}

export const colorRampNode: MaterialNodeDefinition = {
    id: 'colorRamp',
    label: 'Color Ramp',
    category: 'color',
    gpuCost: 2,

    inputs: [
        { id: 'factor', label: 'Factor', type: 'float', default: 0 },
    ],
    outputs: [
        { id: 'color', label: 'Color', type: 'color' },
        { id: 'rgb', label: 'RGB', type: 'vec3' },
    ],
    params: {
        stops: {
            label: 'Color Stops',
            type: 'colorStops',
            default: [
                { position: 0, color: [0, 0, 0] },
                { position: 1, color: [1, 1, 1] },
            ],
        },
        interpolation: {
            label: 'Interpolation',
            type: 'enum',
            default: 'linear',
            options: [
                { label: 'Linear', value: 'linear' },
                { label: 'Smooth', value: 'smooth' },
                { label: 'Step', value: 'step' },
            ],
        },
    },

    build: (inputs, params, context) => {
        // Get the input factor (0-1 scalar)
        const factor = inputs.factor ?? float(0);

        // Get stops from params (at compile time)
        // Note: Dynamic stops would require uniform arrays which is more complex
        const stopsValue = params.stops?.value as ColorStop[] ?? [
            { position: 0, color: [0, 0, 0] },
            { position: 1, color: [1, 1, 1] },
        ];
        const interpolation = params.interpolation?.value as string ?? 'linear';

        // Build the gradient evaluation
        const rgb = buildGradientTSL(factor, stopsValue, interpolation);

        return {
            color: vec4(rgb, float(1.0)),
            rgb,
        };
    },

    documentation: 'Maps a 0-1 scalar value to a multi-stop color gradient. Supports linear, smooth, and step interpolation modes.',
};

// Auto-register on import
registerMaterialNode(colorRampNode);
