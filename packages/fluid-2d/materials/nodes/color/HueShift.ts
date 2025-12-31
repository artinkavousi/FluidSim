/**
 * @package fluid-2d/materials/nodes/color
 * HueShift — HSL-based hue rotation
 */

import {
    Fn,
    vec3,
    vec4,
    float,
    min,
    max,
    abs,
    mod,
    select,
} from 'three/tsl';
import type { MaterialNodeDefinition, ShaderNodeObject } from '../../types';
import { registerMaterialNode } from '../../MaterialNodeRegistry';

/**
 * Convert RGB to HSL in TSL
 */
function rgbToHsl(rgb: ShaderNodeObject): ShaderNodeObject {
    const r = rgb.x;
    const g = rgb.y;
    const b = rgb.z;

    const maxC = max(r, max(g, b));
    const minC = min(r, min(g, b));
    const delta = maxC.sub(minC);

    // Lightness
    const l = maxC.add(minC).mul(0.5);

    // Saturation
    const s = select(
        delta.lessThanEqual(0.0001),
        float(0),
        delta.div(float(1).sub(abs(l.mul(2).sub(1))))
    );

    // Hue (simplified calculation)
    const deltaInv = float(1).div(delta.add(0.0001));
    const hR = g.sub(b).mul(deltaInv).mod(6);
    const hG = b.sub(r).mul(deltaInv).add(2);
    const hB = r.sub(g).mul(deltaInv).add(4);

    const h = select(
        delta.lessThanEqual(0.0001),
        float(0),
        select(
            maxC.equal(r),
            hR.div(6),
            select(maxC.equal(g), hG.div(6), hB.div(6))
        )
    );

    return vec3(h, s, l);
}

/**
 * Convert HSL to RGB in TSL
 */
function hslToRgb(hsl: ShaderNodeObject): ShaderNodeObject {
    const h = hsl.x;
    const s = hsl.y;
    const l = hsl.z;

    const c = float(1).sub(abs(l.mul(2).sub(1))).mul(s);
    const x = c.mul(float(1).sub(abs(mod(h.mul(6), float(2)).sub(1))));
    const m = l.sub(c.mul(0.5));

    const h6 = h.mul(6);

    // Sector-based RGB calculation
    const r = select(
        h6.lessThan(1), c,
        select(h6.lessThan(2), x,
            select(h6.lessThan(3), float(0),
                select(h6.lessThan(4), float(0),
                    select(h6.lessThan(5), x, c))))
    ).add(m);

    const g = select(
        h6.lessThan(1), x,
        select(h6.lessThan(2), c,
            select(h6.lessThan(3), c,
                select(h6.lessThan(4), x,
                    select(h6.lessThan(5), float(0), float(0)))))
    ).add(m);

    const b = select(
        h6.lessThan(1), float(0),
        select(h6.lessThan(2), float(0),
            select(h6.lessThan(3), x,
                select(h6.lessThan(4), c,
                    select(h6.lessThan(5), c, x))))
    ).add(m);

    return vec3(r, g, b);
}

export const hueShiftNode: MaterialNodeDefinition = {
    id: 'hueShift',
    label: 'Hue Shift',
    category: 'color',
    gpuCost: 3,

    inputs: [
        { id: 'color', label: 'Color', type: 'color' },
    ],
    outputs: [
        { id: 'color', label: 'Color', type: 'color' },
        { id: 'rgb', label: 'RGB', type: 'vec3' },
    ],
    params: {
        shift: {
            label: 'Hue Shift',
            type: 'float',
            default: 0,
            min: -1,
            max: 1,
            step: 0.01,
            unit: 'turns',
        },
        saturation: {
            label: 'Saturation',
            type: 'float',
            default: 1,
            min: 0,
            max: 2,
            step: 0.01,
        },
        lightness: {
            label: 'Lightness',
            type: 'float',
            default: 1,
            min: 0,
            max: 2,
            step: 0.01,
        },
    },

    build: (inputs, params, context) => {
        const inputColor = inputs.color ?? vec4(1, 1, 1, 1);
        const rgb = inputColor.xyz ?? vec3(1, 1, 1);

        // Convert to HSL
        const hsl = rgbToHsl(rgb);

        // Apply modifications
        const newH = mod(hsl.x.add(params.shift), float(1));
        const newS = hsl.y.mul(params.saturation).clamp(0, 1);
        const newL = hsl.z.mul(params.lightness).clamp(0, 1);

        // Convert back to RGB
        const resultRgb = hslToRgb(vec3(newH, newS, newL));

        return {
            color: vec4(resultRgb, float(1.0)),
            rgb: resultRgb,
        };
    },

    documentation: 'Shifts hue, adjusts saturation and lightness in HSL color space.',
};

// Auto-register on import
registerMaterialNode(hueShiftNode);
