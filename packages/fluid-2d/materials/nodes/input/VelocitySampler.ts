/**
 * @package fluid-2d/materials/nodes/input
 * VelocitySampler — Sample velocity field for motion effects
 */

import {
    vec2,
    vec4,
    float,
    int,
    ivec2,
    floor,
    fract,
    clamp,
    textureLoad,
    sqrt,
    atan2,
    abs,
} from 'three/tsl';
import type { MaterialNodeDefinition, ShaderNodeObject } from '../../types';
import { registerMaterialNode } from '../../MaterialNodeRegistry';

const PI = 3.14159265359;

/**
 * Bilinear sample from storage texture
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

export const velocitySamplerNode: MaterialNodeDefinition = {
    id: 'velocitySampler',
    label: 'Velocity Sampler',
    category: 'input',
    gpuCost: 2,

    inputs: [
        { id: 'uv', label: 'UV', type: 'vec2' },
    ],
    outputs: [
        { id: 'velocity', label: 'Velocity', type: 'vec2' },
        { id: 'speed', label: 'Speed', type: 'float' },
        { id: 'direction', label: 'Direction', type: 'float' },
        { id: 'normalized', label: 'Normalized', type: 'vec2' },
    ],
    params: {
        scale: {
            label: 'Scale',
            type: 'float',
            default: 1.0,
            min: 0,
            max: 10,
            step: 0.01,
        },
    },

    build: (inputs, params, context) => {
        const { velocityTexture, velocityResolution, uvNode } = context;

        const uv = inputs.uv ?? uvNode;

        // Convert UV to texture coordinates
        const texCoord = vec2(
            uv.x.mul(float(velocityResolution.width)),
            uv.y.mul(float(velocityResolution.height))
        );

        // Sample velocity
        const sampled = bilinearSampleTSL(
            velocityTexture,
            texCoord,
            velocityResolution.width,
            velocityResolution.height
        );

        const velocity = sampled.xy.mul(params.scale);

        // Calculate speed (magnitude)
        const speed = sqrt(velocity.x.mul(velocity.x).add(velocity.y.mul(velocity.y)));

        // Calculate direction (angle in radians, 0 = right, PI/2 = up)
        const direction = atan2(velocity.y, velocity.x);

        // Normalize velocity (with safety for zero magnitude)
        const safeSpeed = speed.add(float(0.0001));
        const normalized = vec2(velocity.x.div(safeSpeed), velocity.y.div(safeSpeed));

        return {
            velocity,
            speed,
            direction,
            normalized,
        };
    },

    documentation: 'Samples the velocity field texture. Outputs raw velocity vector, speed magnitude, direction angle, and normalized direction.',
};

// Auto-register on import
registerMaterialNode(velocitySamplerNode);
