/**
 * @package fluid-2d/nodes
 * Vorticity TSL Node - Vorticity calculation and confinement force
 * 
 * Uses textureLoad/textureStore with storageTexture() for compute shaders.
 */

import {
    Fn,
    uniform,
    float,
    int,
    ivec2,
    vec2,
    vec4,
    abs,
    sqrt,
    instanceIndex,
    textureLoad,
    textureStore,
    max,
    min,
    select,
    clamp,
} from 'three/tsl';
import * as THREE from 'three/webgpu';

export interface VorticityCompute {
    compute: any;
    uniforms: { solid: any };
}

export interface VorticityForceCompute {
    compute: any;
    uniforms: { vorticityStrength: any; dt: any; solid: any; edgeAwareEnabled: any; edgeAwareStrength: any; scaleMix: any };
}

/**
 * Create vorticity (curl) compute node
 */
export function createVorticityNode(
    velocityTex: THREE.StorageTexture,
    vorticityTex: THREE.StorageTexture,
    width: number,
    height: number
): VorticityCompute {
    const solid = uniform(0);

    const vorticityFn = Fn(() => {
        const idx = instanceIndex;
        const x = idx.mod(int(width));
        const y = idx.div(int(width));
        const coord = ivec2(x, y);

        const w2 = int(width).sub(int(2));
        const h2 = int(height).sub(int(2));
        const isEdge = x.lessThan(int(1)).or(x.greaterThan(w2)).or(y.lessThan(int(1))).or(y.greaterThan(h2));
        const solidOn = int(solid).equal(int(1));

        const xL = max(x.sub(1), int(0));
        const xR = min(x.add(1), int(width - 1));
        const yB = max(y.sub(1), int(0));
        const yT = min(y.add(1), int(height - 1));

        const vL = textureLoad(velocityTex, ivec2(xL, y));
        const vR = textureLoad(velocityTex, ivec2(xR, y));
        const vB = textureLoad(velocityTex, ivec2(x, yB));
        const vT = textureLoad(velocityTex, ivec2(x, yT));

        // Curl = dVy/dx - dVx/dy
        const curl = float(0.5).mul(vR.y.sub(vL.y).sub(vT.x.sub(vB.x)));
        const outCurl = select(solidOn.and(isEdge), float(0.0), curl);

        textureStore(vorticityTex, coord, vec4(outCurl, float(0), float(0), float(1))).toWriteOnly();
    });

    return {
        compute: vorticityFn().compute(width * height),
        uniforms: { solid },
    };
}

/**
 * Create vorticity confinement force compute node
 */
export function createVorticityForceNode(
    velocityReadTex: THREE.StorageTexture,
    vorticityTex: THREE.StorageTexture,
    velocityWriteTex: THREE.StorageTexture,
    width: number,
    height: number,
    obstaclesTex: THREE.StorageTexture
): VorticityForceCompute {
    const vorticityStrength = uniform(30.0);
    const dt = uniform(1.0 / 60.0);
    const solid = uniform(0);
    const edgeAwareEnabled = uniform(0);
    const edgeAwareStrength = uniform(1.0);
    const scaleMix = uniform(0.0);

    const vortForceFn = Fn(() => {
        const idx = instanceIndex;
        const x = idx.mod(int(width));
        const y = idx.div(int(width));
        const coord = ivec2(x, y);

        const w2 = int(width).sub(int(2));
        const h2 = int(height).sub(int(2));
        const isEdge = x.lessThan(int(1)).or(x.greaterThan(w2)).or(y.lessThan(int(1))).or(y.greaterThan(h2));
        const solidOn = int(solid).equal(int(1));

        const xL = max(x.sub(1), int(0));
        const xR = min(x.add(1), int(width - 1));
        const yB = max(y.sub(1), int(0));
        const yT = min(y.add(1), int(height - 1));

        const xL2 = max(x.sub(2), int(0));
        const xR2 = min(x.add(2), int(width - 1));
        const yB2 = max(y.sub(2), int(0));
        const yT2 = min(y.add(2), int(height - 1));

        const wL = abs(textureLoad(vorticityTex, ivec2(xL, y)).x);
        const wR = abs(textureLoad(vorticityTex, ivec2(xR, y)).x);
        const wB = abs(textureLoad(vorticityTex, ivec2(x, yB)).x);
        const wT = abs(textureLoad(vorticityTex, ivec2(x, yT)).x);
        const wC = textureLoad(vorticityTex, coord).x;

        // Gradient of |vorticity|
        const gradX = float(0.5).mul(wR.sub(wL));
        const gradY = float(0.5).mul(wT.sub(wB));

        // Normalize
        const len = sqrt(gradX.mul(gradX).add(gradY.mul(gradY))).add(float(0.0001));
        const nx = gradX.div(len);
        const ny = gradY.div(len);

        // Larger-scale gradient (2-cell central difference), blended in via `scaleMix`.
        const wL2 = abs(textureLoad(vorticityTex, ivec2(xL2, y)).x);
        const wR2 = abs(textureLoad(vorticityTex, ivec2(xR2, y)).x);
        const wB2 = abs(textureLoad(vorticityTex, ivec2(x, yB2)).x);
        const wT2 = abs(textureLoad(vorticityTex, ivec2(x, yT2)).x);

        const gradX2 = float(0.25).mul(wR2.sub(wL2));
        const gradY2 = float(0.25).mul(wT2.sub(wB2));

        const len2 = sqrt(gradX2.mul(gradX2).add(gradY2.mul(gradY2))).add(float(0.0001));
        const nx2 = gradX2.div(len2);
        const ny2 = gradY2.div(len2);

        // Force = strength * (N × ω) * dt / gridSize
        const scale = vorticityStrength.mul(dt).div(float(width));
        const fX0 = ny.mul(wC).mul(scale);
        const fY0 = nx.negate().mul(wC).mul(scale);
        const fX1 = ny2.mul(wC).mul(scale);
        const fY1 = nx2.negate().mul(wC).mul(scale);

        const mixV = clamp(scaleMix, float(0.0), float(1.0));
        const forceX = fX0.mul(float(1.0).sub(mixV)).add(fX1.mul(mixV));
        const forceY = fY0.mul(float(1.0).sub(mixV)).add(fY1.mul(mixV));

        const edgeOn = int(edgeAwareEnabled).equal(int(1));
        const oC = textureLoad(obstaclesTex, coord).x;
        const oL = textureLoad(obstaclesTex, ivec2(xL, y)).x;
        const oR = textureLoad(obstaclesTex, ivec2(xR, y)).x;
        const oB = textureLoad(obstaclesTex, ivec2(x, yB)).x;
        const oT = textureLoad(obstaclesTex, ivec2(x, yT)).x;
        const nearSolid = max(max(max(oC, oL), max(oR, oB)), oT);
        const atten = float(1.0).sub(clamp(nearSolid.mul(edgeAwareStrength), float(0.0), float(1.0)));
        const att = select(edgeOn, atten, float(1.0));

        const vel = textureLoad(velocityReadTex, coord);
        const newVel = vel.xy.add(vec2(forceX, forceY).mul(att));
        const outVel = select(solidOn.and(isEdge), vec2(float(0.0), float(0.0)), newVel);

        textureStore(velocityWriteTex, coord, vec4(outVel, float(0), float(1))).toWriteOnly();
    });

    return {
        compute: vortForceFn().compute(width * height),
        uniforms: { vorticityStrength, dt, solid, edgeAwareEnabled, edgeAwareStrength, scaleMix }
    };
}
