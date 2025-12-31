/**
 * @package fluid-2d/materials/nodes/transform
 * UVDistort — Velocity-based UV distortion for fluid distortion effects
 */

import { Fn, vec2, float, clamp } from 'three/tsl';
import type { MaterialNodeDefinition, MaterialBuildContext, ShaderNodeObject, UniformNode } from '../../types';
import { registerMaterialNode } from '../../MaterialNodeRegistry';

export const uvDistortNodeDef: MaterialNodeDefinition = {
    id: 'uvDistort',
    label: 'UV Distort',
    category: 'transform',
    gpuCost: 1,

    inputs: [
        { id: 'uv', label: 'UV', type: 'vec2' },
        { id: 'velocity', label: 'Velocity', type: 'vec2' },
    ],

    outputs: [
        { id: 'uv', label: 'UV', type: 'vec2' },
    ],

    params: {
        strength: {
            label: 'Strength',
            type: 'float',
            default: 0.1,
            min: 0,
            max: 1,
            step: 0.01,
        },
        clampOutput: {
            label: 'Clamp Output',
            type: 'bool',
            default: true,
        },
    },

    build: (
        inputs: Record<string, ShaderNodeObject>,
        params: Record<string, UniformNode>,
        context: MaterialBuildContext
    ): Record<string, ShaderNodeObject> => {
        const inputUV = inputs.uv ?? vec2(0.5, 0.5);
        const velocity = inputs.velocity ?? vec2(0, 0);

        // Apply velocity-based distortion
        const distortedUV = inputUV.add(velocity.mul(params.strength));

        // Optionally clamp to prevent sampling outside texture bounds
        const shouldClamp = params.clampOutput?.value ?? true;
        const outputUV = shouldClamp
            ? vec2(
                clamp(distortedUV.x, float(0), float(1)),
                clamp(distortedUV.y, float(0), float(1))
            )
            : distortedUV;

        return { uv: outputUV };
    },

    documentation: `
Distorts UV coordinates based on velocity field.
Creates fluid-like warping effects.

**Inputs:**
- UV: Input texture coordinates
- Velocity: Velocity vector for distortion direction

**Outputs:**
- UV: Distorted coordinates

**Use with:** VelocitySampler → UVDistort → DyeSampler
    `,
};

registerMaterialNode(uvDistortNodeDef);

export default uvDistortNodeDef;
