/**
 * @package fluid-2d/materials/nodes/input
 * DyeSampler — Sample the dye field with ping-pong awareness
 */

import {
    Fn,
    vec2,
    vec4,
    float,
    int,
    ivec2,
    floor,
    fract,
    clamp,
    textureLoad,
    mix,
} from 'three/tsl';
import type { MaterialNodeDefinition, ShaderNodeObject } from '../../types';
import { registerMaterialNode } from '../../MaterialNodeRegistry';

/**
 * Bilinear sample from storage texture using TSL
 */
function bilinearSampleTSL(
    tex: any,
    coord: ShaderNodeObject,
    width: number,
    height: number
): ShaderNodeObject {
    const fx = fract(coord.x);
    const fy = fract(coord.y);
    const ix = int(floor(coord.x));
    const iy = int(floor(coord.y));

    const w = int(width);
    const h = int(height);

    const x0 = clamp(ix, int(0), w.sub(1));
    const y0 = clamp(iy, int(0), h.sub(1));
    const x1 = clamp(ix.add(1), int(0), w.sub(1));
    const y1 = clamp(iy.add(1), int(0), h.sub(1));

    const c00 = textureLoad(tex, ivec2(x0, y0));
    const c10 = textureLoad(tex, ivec2(x1, y0));
    const c01 = textureLoad(tex, ivec2(x0, y1));
    const c11 = textureLoad(tex, ivec2(x1, y1));

    const one = float(1.0);
    const c0 = c00.mul(one.sub(fx)).add(c10.mul(fx));
    const c1 = c01.mul(one.sub(fx)).add(c11.mul(fx));
    return c0.mul(one.sub(fy)).add(c1.mul(fy));
}

export const dyeSamplerNode: MaterialNodeDefinition = {
    id: 'dyeSampler',
    label: 'Dye Sampler',
    category: 'input',
    gpuCost: 2,

    inputs: [
        { id: 'uv', label: 'UV', type: 'vec2' },
    ],
    outputs: [
        { id: 'color', label: 'Color', type: 'color' },
        { id: 'density', label: 'Density', type: 'float' },
        { id: 'rgb', label: 'RGB', type: 'vec3' },
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
    },

    build: (inputs, params, context) => {
        const { dyeTexture, dyeResolution, uvNode } = context;

        // Use provided UV or default from context
        const uv = inputs.uv ?? uvNode;

        // Convert UV (0-1) to texture coordinates
        const texCoord = vec2(
            uv.x.mul(float(dyeResolution.width)),
            uv.y.mul(float(dyeResolution.height))
        );

        // Sample dye with bilinear interpolation
        const sampled = bilinearSampleTSL(
            dyeTexture,
            texCoord,
            dyeResolution.width,
            dyeResolution.height
        );

        // Apply exposure
        const exposed = sampled.mul(params.exposure);

        // Calculate density (luminance of RGB)
        const density = exposed.x.mul(0.299).add(exposed.y.mul(0.587)).add(exposed.z.mul(0.114));

        return {
            color: vec4(exposed.xyz, float(1.0)),
            density,
            rgb: exposed.xyz,
        };
    },

    documentation: 'Samples the dye field texture with bilinear interpolation. Outputs color, RGB, and luminance-based density.',
};

// Auto-register on import
registerMaterialNode(dyeSamplerNode);
