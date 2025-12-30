/**
 * @package fluid-2d/nodes
 * Divergence TSL Node - Computes velocity field divergence
 * 
 * Uses textureLoad/textureStore with storageTexture() for compute shaders.
 */

import {
    Fn,
    uniform,
    float,
    int,
    ivec2,
    vec4,
    instanceIndex,
    textureLoad,
    textureStore,
    max,
    min,
    select,
} from 'three/tsl';
import * as THREE from 'three/webgpu';

export interface DivergenceCompute {
    compute: any;
    uniforms: { solid: any };
}

/**
 * Create divergence compute node
 */
export function createDivergenceNode(
    velocityTex: THREE.StorageTexture,
    divergenceTex: THREE.StorageTexture,
    width: number,
    height: number
): DivergenceCompute {
    const solid = uniform(0);

    const divergenceFn = Fn(() => {
        const idx = instanceIndex;
        const x = idx.mod(int(width));
        const y = idx.div(int(width));
        const coord = ivec2(x, y);

        const w2 = int(width).sub(int(2));
        const h2 = int(height).sub(int(2));
        const isEdge = x.lessThan(int(1)).or(x.greaterThan(w2)).or(y.lessThan(int(1))).or(y.greaterThan(h2));
        const solidOn = int(solid).equal(int(1));

        // Neighbor coordinates with boundary clamping
        const xL = max(x.sub(1), int(0));
        const xR = min(x.add(1), int(width - 1));
        const yB = max(y.sub(1), int(0));
        const yT = min(y.add(1), int(height - 1));

        const vL = textureLoad(velocityTex, ivec2(xL, y)).x;
        const vR = textureLoad(velocityTex, ivec2(xR, y)).x;
        const vB = textureLoad(velocityTex, ivec2(x, yB)).y;
        const vT = textureLoad(velocityTex, ivec2(x, yT)).y;

        // Central difference: div = (vR - vL) / 2 + (vT - vB) / 2
        const divergence = float(0.5).mul(vR.sub(vL).add(vT.sub(vB))).negate();
        const outDiv = select(solidOn.and(isEdge), float(0.0), divergence);

        textureStore(divergenceTex, coord, vec4(outDiv, float(0), float(0), float(1))).toWriteOnly();
    });

    return {
        compute: divergenceFn().compute(width * height),
        uniforms: { solid },
    };
}

