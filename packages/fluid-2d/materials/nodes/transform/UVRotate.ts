/**
 * @package fluid-2d/materials/nodes/transform
 * UVRotate — UV rotation around center point
 */

import { Fn, vec2, float, sin, cos } from 'three/tsl';
import type { MaterialNodeDefinition, MaterialBuildContext, ShaderNodeObject, UniformNode } from '../../types';
import { registerMaterialNode } from '../../MaterialNodeRegistry';

export const uvRotateNodeDef: MaterialNodeDefinition = {
    id: 'uvRotate',
    label: 'UV Rotate',
    category: 'transform',
    gpuCost: 1,

    inputs: [
        { id: 'uv', label: 'UV', type: 'vec2' },
    ],

    outputs: [
        { id: 'uv', label: 'UV', type: 'vec2' },
    ],

    params: {
        angle: {
            label: 'Angle',
            type: 'float',
            default: 0,
            min: -6.283,
            max: 6.283,
            step: 0.01,
            unit: 'rad',
        },
        centerX: {
            label: 'Center X',
            type: 'float',
            default: 0.5,
            min: 0,
            max: 1,
            step: 0.01,
        },
        centerY: {
            label: 'Center Y',
            type: 'float',
            default: 0.5,
            min: 0,
            max: 1,
            step: 0.01,
        },
    },

    build: (
        inputs: Record<string, ShaderNodeObject>,
        params: Record<string, UniformNode>,
        context: MaterialBuildContext
    ): Record<string, ShaderNodeObject> => {
        const inputUV = inputs.uv ?? vec2(0.5, 0.5);

        // Center point
        const center = vec2(params.centerX, params.centerY);

        // Translate to center, rotate, translate back
        const translated = inputUV.sub(center);

        const s = sin(params.angle);
        const c = cos(params.angle);

        const rotated = vec2(
            translated.x.mul(c).sub(translated.y.mul(s)),
            translated.x.mul(s).add(translated.y.mul(c))
        );

        const outputUV = rotated.add(center);

        return { uv: outputUV };
    },

    documentation: `
Rotates UV coordinates around a center point.
Useful for spinning/vortex effects.

**Inputs:**
- UV: Input texture coordinates

**Outputs:**
- UV: Rotated coordinates

**Parameters:**
- Angle: Rotation in radians
- Center X/Y: Rotation pivot point
    `,
};

registerMaterialNode(uvRotateNodeDef);

export default uvRotateNodeDef;
