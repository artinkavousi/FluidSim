/**
 * @package fluid-2d/materials/nodes/shading
 * NormalFromGradient — Derive surface normals from density gradient
 */

import {
    vec2,
    vec3,
    vec4,
    float,
    int,
    ivec2,
    floor,
    normalize,
    clamp,
    textureLoad,
} from 'three/tsl';
import type { MaterialNodeDefinition, ShaderNodeObject } from '../../types';
import { registerMaterialNode } from '../../MaterialNodeRegistry';

export const normalFromGradientNode: MaterialNodeDefinition = {
    id: 'normalFromGradient',
    label: 'Normal from Gradient',
    category: 'shading',
    gpuCost: 3,

    inputs: [
        { id: 'uv', label: 'UV', type: 'vec2' },
    ],
    outputs: [
        { id: 'normal', label: 'Normal', type: 'vec3' },
        { id: 'gradient', label: 'Gradient', type: 'vec2' },
    ],
    params: {
        strength: {
            label: 'Strength',
            type: 'float',
            default: 1.0,
            min: 0,
            max: 5,
            step: 0.01,
        },
        offset: {
            label: 'Sample Offset',
            type: 'float',
            default: 1.0,
            min: 0.5,
            max: 4,
            step: 0.1,
        },
    },

    build: (inputs, params, context) => {
        const { dyeTexture, dyeResolution, uvNode } = context;

        const uv = inputs.uv ?? uvNode;
        const offset = params.offset;

        // Convert UV to pixel coordinates
        const texCoord = vec2(
            uv.x.mul(float(dyeResolution.width)),
            uv.y.mul(float(dyeResolution.height))
        );

        const x = int(floor(texCoord.x));
        const y = int(floor(texCoord.y));
        const w = int(dyeResolution.width);
        const h = int(dyeResolution.height);
        const off = int(floor(offset));

        // Sample neighbors for gradient calculation
        const xL = clamp(x.sub(off), int(0), w.sub(1));
        const xR = clamp(x.add(off), int(0), w.sub(1));
        const yD = clamp(y.sub(off), int(0), h.sub(1));
        const yU = clamp(y.add(off), int(0), h.sub(1));

        // Sample density at neighbors (using red channel as density proxy)
        const left = textureLoad(dyeTexture, ivec2(xL, y)).x;
        const right = textureLoad(dyeTexture, ivec2(xR, y)).x;
        const down = textureLoad(dyeTexture, ivec2(x, yD)).x;
        const up = textureLoad(dyeTexture, ivec2(x, yU)).x;

        // Calculate gradient (Sobel-like)
        const gx = right.sub(left);
        const gy = up.sub(down);
        const gradient = vec2(gx, gy).mul(params.strength);

        // Convert gradient to normal (treating density as height)
        // Normal = normalize(vec3(-dh/dx, -dh/dy, 1))
        const normal = normalize(vec3(
            gradient.x.negate(),
            gradient.y.negate(),
            float(1.0)
        ));

        return {
            normal,
            gradient,
        };
    },

    documentation: 'Derives surface normal from dye density gradient. Use for fresnel rim lighting and specular effects.',
};

// Auto-register on import
registerMaterialNode(normalFromGradientNode);
