/**
 * @package fluid-2d/nodes
 * Pressure TSL Node - Jacobi pressure solver and gradient subtraction
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
    instanceIndex,
    textureLoad,
    textureStore,
    max,
    min,
    select,
} from 'three/tsl';
import * as THREE from 'three/webgpu';

export interface PressureCompute {
    compute: any;
    uniforms: { omega: any; solid: any };
}

export interface GradientSubtractCompute {
    compute: any;
    uniforms: { solid: any };
}

/**
 * Create pressure solve (Jacobi iteration) compute node
 */
export function createPressureSolveNode(
    pressureReadTex: THREE.StorageTexture,
    divergenceTex: THREE.StorageTexture,
    pressureWriteTex: THREE.StorageTexture,
    width: number,
    height: number
): PressureCompute {
    const omega = uniform(1.0);
    const solid = uniform(0);

    const pressureFn = Fn(() => {
        const idx = instanceIndex;
        const x = idx.mod(int(width));
        const y = idx.div(int(width));
        const coord = ivec2(x, y);

        const pOld = textureLoad(pressureReadTex, coord).x;

        const xL = max(x.sub(1), int(0));
        const xR = min(x.add(1), int(width - 1));
        const yB = max(y.sub(1), int(0));
        const yT = min(y.add(1), int(height - 1));

        const pL = textureLoad(pressureReadTex, ivec2(xL, y)).x;
        const pR = textureLoad(pressureReadTex, ivec2(xR, y)).x;
        const pB = textureLoad(pressureReadTex, ivec2(x, yB)).x;
        const pT = textureLoad(pressureReadTex, ivec2(x, yT)).x;
        const d = textureLoad(divergenceTex, coord).x;

        // Jacobi: p_new = (pL + pR + pB + pT + div) * 0.25
        const pJacobi = pL.add(pR).add(pB).add(pT).add(d).mul(float(0.25));
        // Relaxation (omega=1 => Jacobi, omega>1 => over-relaxed iteration)
        const pNew = pOld.add(pJacobi.sub(pOld).mul(omega));

        // Solid-wall boundary: keep pressure constant along the wall by copying nearest interior cell.
        const w2 = int(width).sub(int(2));
        const h2 = int(height).sub(int(2));
        const isEdge = x.lessThan(int(1)).or(x.greaterThan(w2)).or(y.lessThan(int(1))).or(y.greaterThan(h2));
        const solidOn = int(solid).equal(int(1));
        const ix = max(int(1), min(x, w2));
        const iy = max(int(1), min(y, h2));
        const pInterior = textureLoad(pressureReadTex, ivec2(ix, iy)).x;
        const outP = select(solidOn.and(isEdge), pInterior, pNew);

        textureStore(pressureWriteTex, coord, vec4(outP, float(0), float(0), float(1))).toWriteOnly();
    });

    return {
        compute: pressureFn().compute(width * height),
        uniforms: { omega, solid }
    };
}

/**
 * Create gradient subtraction compute node
 */
export function createGradientSubtractNode(
    velocityReadTex: THREE.StorageTexture,
    pressureTex: THREE.StorageTexture,
    velocityWriteTex: THREE.StorageTexture,
    width: number,
    height: number
): GradientSubtractCompute {
    const solid = uniform(0);

    const gradSubFn = Fn(() => {
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

        const pL = textureLoad(pressureTex, ivec2(xL, y)).x;
        const pR = textureLoad(pressureTex, ivec2(xR, y)).x;
        const pB = textureLoad(pressureTex, ivec2(x, yB)).x;
        const pT = textureLoad(pressureTex, ivec2(x, yT)).x;

        const gradPx = float(0.5).mul(pR.sub(pL));
        const gradPy = float(0.5).mul(pT.sub(pB));

        const vel = textureLoad(velocityReadTex, coord);
        const newVel = vel.xy.sub(vec2(gradPx, gradPy));
        const outVel = select(solidOn.and(isEdge), vec2(float(0.0), float(0.0)), newVel);

        textureStore(velocityWriteTex, coord, vec4(outVel, float(0), float(1))).toWriteOnly();
    });

    return {
        compute: gradSubFn().compute(width * height),
        uniforms: { solid }
    };
}

