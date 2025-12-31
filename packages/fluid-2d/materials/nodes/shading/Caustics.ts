/**
 * @package fluid-2d/materials/nodes/shading
 * CausticsNode — Animated water caustics pattern for liquid effects
 * 
 * Generates animated caustic patterns that simulate light refraction
 * through a wavy water surface, adding realistic underwater/pool looks.
 */

import { Fn, vec3, vec4, float, vec2, sin, cos, dot, abs, clamp, mix, fract, floor } from 'three/tsl';
import type { MaterialNodeDefinition, MaterialBuildContext, ShaderNodeObject, UniformNode } from '../../types';
import { registerMaterialNode } from '../../MaterialNodeRegistry';

/**
 * Simple hash function for pseudo-random values
 */
const hash22 = Fn(([p]: [any]) => {
    const k = vec2(0.3183099, 0.3678794);
    const pp = p.mul(k).add(k.yx);
    return fract(float(16).mul(fract(pp.x.mul(pp.y).mul(pp.x.add(pp.y)))).mul(k));
});

/**
 * Voronoi-based caustics pattern
 */
const voronoiCaustics = Fn(([uv, time, scale, speed]: [any, any, any, any]) => {
    const p = uv.mul(scale);
    const t = time.mul(speed);

    const ip = floor(p);
    const fp = fract(p);

    // Find minimum distance to cell centers
    const minDist = float(1.0).toVar();

    // Simple 3x3 neighbor search (unrolled for TSL)
    const offsets = [
        vec2(-1, -1), vec2(0, -1), vec2(1, -1),
        vec2(-1, 0), vec2(0, 0), vec2(1, 0),
        vec2(-1, 1), vec2(0, 1), vec2(1, 1),
    ];

    // We'll compute a simplified caustics using trigonometry instead
    // as full voronoi is expensive
    const angle1 = t.mul(0.7).add(p.x.mul(2.5)).add(p.y.mul(1.3));
    const angle2 = t.mul(0.9).add(p.x.mul(1.7)).sub(p.y.mul(2.1));
    const angle3 = t.mul(1.1).sub(p.x.mul(1.9)).add(p.y.mul(1.8));

    const wave1 = sin(angle1).mul(0.5).add(0.5);
    const wave2 = sin(angle2).mul(0.5).add(0.5);
    const wave3 = sin(angle3).mul(0.5).add(0.5);

    // Combine waves and apply caustics function
    const combined = wave1.mul(wave2).add(wave3.mul(wave1)).mul(0.5);
    const caustic = combined.mul(combined).mul(combined); // Sharpen peaks

    return caustic;
});

export const causticsNodeDef: MaterialNodeDefinition = {
    id: 'caustics',
    label: 'Caustics',
    category: 'shading',
    gpuCost: 4,

    inputs: [
        { id: 'color', label: 'Base Color', type: 'color' },
        { id: 'uv', label: 'UV', type: 'vec2' },
    ],

    outputs: [
        { id: 'color', label: 'Color', type: 'color' },
        { id: 'caustics', label: 'Caustics', type: 'float' },
    ],

    params: {
        intensity: {
            label: 'Intensity',
            type: 'float',
            default: 0.35,
            min: 0,
            max: 2,
            step: 0.01,
        },
        scale: {
            label: 'Scale',
            type: 'float',
            default: 4.0,
            min: 0.5,
            max: 20,
            step: 0.1,
        },
        speed: {
            label: 'Speed',
            type: 'float',
            default: 0.5,
            min: 0,
            max: 3,
            step: 0.01,
        },
        colorR: {
            label: 'Caustic R',
            type: 'float',
            default: 0.9,
            min: 0,
            max: 1,
            step: 0.01,
        },
        colorG: {
            label: 'Caustic G',
            type: 'float',
            default: 0.95,
            min: 0,
            max: 1,
            step: 0.01,
        },
        colorB: {
            label: 'Caustic B',
            type: 'float',
            default: 1.0,
            min: 0,
            max: 1,
            step: 0.01,
        },
        distortion: {
            label: 'Distortion',
            type: 'float',
            default: 0.1,
            min: 0,
            max: 0.5,
            step: 0.01,
        },
    },

    build: (
        inputs: Record<string, ShaderNodeObject>,
        params: Record<string, UniformNode>,
        context: MaterialBuildContext
    ): Record<string, ShaderNodeObject> => {
        const baseColor = inputs.color ?? vec4(0.2, 0.4, 0.6, 1.0);

        // Use input UV or generate from resolution
        const uv = inputs.uv ?? vec2(0.5, 0.5);

        // Get time from context
        const time = context.time !== undefined ? float(context.time) : float(0);

        // Add distortion to UV
        const distortedUV = uv.add(vec2(
            sin(time.mul(0.5).add(uv.y.mul(5))).mul(params.distortion),
            cos(time.mul(0.4).add(uv.x.mul(4))).mul(params.distortion)
        ));

        // Calculate caustics pattern
        const causticsValue = voronoiCaustics(
            distortedUV,
            time,
            params.scale,
            params.speed
        );

        // Caustics color
        const causticsColor = vec3(
            params.colorR,
            params.colorG,
            params.colorB
        );

        // Apply caustics to base color
        const causticsContrib = causticsColor.mul(causticsValue).mul(params.intensity);
        const finalColor = baseColor.xyz.add(causticsContrib);

        return {
            color: vec4(clamp(finalColor, vec3(0), vec3(10)), float(1.0)),
            caustics: causticsValue.mul(params.intensity),
        };
    },

    documentation: `
Generates animated caustic patterns for underwater/pool effects.
Simulates light refraction through wavy water surface.

**Inputs:**
- Color: Base water color
- UV: Texture coordinates (optional, uses default if not connected)

**Outputs:**
- Color: Base color with caustics added
- Caustics: Raw caustics intensity

**Tips:**
- Combine with Subsurface for realistic underwater scenes
- Use low distortion for calm water, high for choppy
    `,
};

// Register the node
registerMaterialNode(causticsNodeDef);

export default causticsNodeDef;
