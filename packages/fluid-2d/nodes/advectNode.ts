/**
 * @package fluid-2d/nodes
 * Advection TSL Node - Semi-Lagrangian advection for velocity and dye fields
 * 
 * Uses textureLoad/textureStore with storageTexture() for compute shaders.
 */

import {
    Fn,
    uniform,
    float,
    vec2,
    vec4,
    int,
    ivec2,
    floor,
    fract,
    mix,
    clamp,
    instanceIndex,
    textureLoad,
    textureStore,
} from 'three/tsl';
import * as THREE from 'three/webgpu';

export interface AdvectionUniforms {
    dt: ReturnType<typeof uniform>;
    dissipation: ReturnType<typeof uniform>;
}

export interface AdvectionCompute {
    compute: any;
    uniforms: AdvectionUniforms;
}

/**
 * Bilinear sample from storage texture
 */
function bilinearSample(tex: THREE.StorageTexture, coord: any, width: number, height: number) {
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

    // Avoid mix(vec4, vec4, float) since WGSL doesn't allow implicit scalar->vec promotion.
    const one = float(1.0);
    const c0 = c00.mul(one.sub(fx)).add(c10.mul(fx));
    const c1 = c01.mul(one.sub(fx)).add(c11.mul(fx));
    return c0.mul(one.sub(fy)).add(c1.mul(fy));
}

/**
 * Create advection compute node for velocity field
 */
export function createAdvectionNode(
    readTex: THREE.StorageTexture,
    writeTex: THREE.StorageTexture,
    width: number,
    height: number
): AdvectionCompute {
    const dt = uniform(1.0 / 60.0);
    const dissipation = uniform(0.98);

    const advectFn = Fn(() => {
        const idx = instanceIndex;
        const x = idx.mod(int(width));
        const y = idx.div(int(width));
        const coord = ivec2(x, y);

        const pos = vec2(float(x).add(0.5), float(y).add(0.5));

        // Midpoint (RK2) backtrace: improves advection coherence vs basic semi-Lagrangian.
        const vel0 = textureLoad(readTex, coord).xy;
        const midPos = clamp(
            pos.sub(vel0.mul(dt).mul(float(width)).mul(0.5)),
            vec2(0.5),
            vec2(float(width).sub(0.5), float(height).sub(0.5))
        );
        const velMid = bilinearSample(readTex, midPos, width, height).xy;
        const backPos = clamp(
            pos.sub(velMid.mul(dt).mul(float(width))),
            vec2(0.5),
            vec2(float(width).sub(0.5), float(height).sub(0.5))
        );

        const sampled = bilinearSample(readTex, backPos, width, height);

        // Write with dissipation
        textureStore(writeTex, coord, vec4(sampled.xy.mul(dissipation), float(0), float(1))).toWriteOnly();
    });

    return {
        compute: advectFn().compute(width * height),
        uniforms: { dt, dissipation }
    };
}

/**
 * Create advection for dye field
 */
export function createDyeAdvectionNode(
    velocityTex: THREE.StorageTexture,
    dyeReadTex: THREE.StorageTexture,
    dyeWriteTex: THREE.StorageTexture,
    velWidth: number,
    velHeight: number,
    dyeWidth: number,
    dyeHeight: number
): AdvectionCompute {
    const dt = uniform(1.0 / 60.0);
    const dissipation = uniform(0.99);

    const advectFn = Fn(() => {
        const idx = instanceIndex;
        const x = idx.mod(int(dyeWidth));
        const y = idx.div(int(dyeWidth));
        const coord = ivec2(x, y);

        const pos = vec2(float(x).add(0.5), float(y).add(0.5));
        const toVel = vec2(
            float(velWidth).div(float(dyeWidth)),
            float(velHeight).div(float(dyeHeight))
        );

        // Midpoint (RK2) backtrace using velocity sampled in velocity grid space.
        const vel0 = bilinearSample(velocityTex, pos.mul(toVel), velWidth, velHeight).xy;
        const midPos = clamp(
            pos.sub(vel0.mul(dt).mul(float(dyeWidth)).mul(0.5)),
            vec2(0.5),
            vec2(float(dyeWidth).sub(0.5), float(dyeHeight).sub(0.5))
        );
        const velMid = bilinearSample(velocityTex, midPos.mul(toVel), velWidth, velHeight).xy;
        const backPos = clamp(
            pos.sub(velMid.mul(dt).mul(float(dyeWidth))),
            vec2(0.5),
            vec2(float(dyeWidth).sub(0.5), float(dyeHeight).sub(0.5))
        );

        const sampled = bilinearSample(dyeReadTex, backPos, dyeWidth, dyeHeight);

        // Write with dissipation
        textureStore(dyeWriteTex, coord, vec4(sampled.xyz.mul(dissipation), float(1))).toWriteOnly();
    });

    return {
        compute: advectFn().compute(dyeWidth * dyeHeight),
        uniforms: { dt, dissipation }
    };
}
