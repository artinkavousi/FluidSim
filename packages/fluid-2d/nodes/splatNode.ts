/**
 * @package fluid-2d/nodes
 * Splat TSL Node - Velocity and dye splat injection
 * 
 * Uses textureLoad/textureStore with storageTexture() for compute shaders.
 */

import {
    Fn,
    If,
    Return,
    uniform,
    float,
    int,
    ivec2,
    vec2,
    vec3,
    vec4,
    sqrt,
    exp,
    mix,
    select,
    max,
    instanceIndex,
    textureLoad,
    textureStore,
} from 'three/tsl';
import * as THREE from 'three/webgpu';

export interface SplatUniforms {
    splatPos: any;
    splatVel: any;
    splatColor: any;
    radius: any;
    softness: any;
    falloff: any;
    blendMode: any;

    // Optional: tiled in-place splats
    tileOrigin?: any;
    cutoffDistSq?: any;
}

export interface SplatCompute {
    compute: any;
    uniforms: SplatUniforms;
}

/**
 * Create an in-place velocity splat compute node operating over a fixed tile region.
 * This avoids ping-pong flips and avoids full-texture dispatch per splat by only updating tiles that cover the splat bounds.
 */
export function createVelocitySplatInPlaceTileNode(
    velocityTex: THREE.StorageTexture,
    width: number,
    height: number,
    tileSize = 32
): SplatCompute {
    const splatPos = uniform(vec2(0.5, 0.5));
    const splatVel = uniform(vec2(0.0, 0.0));
    const splatColor = uniform(vec4(1.0, 1.0, 1.0, 1.0)); // unused for velocity
    const radius = uniform(0.01);
    const softness = uniform(1.0);
    const falloff = uniform(2); // 0..3
    const blendMode = uniform(0); // 0 add, 1 max, 2 mix

    const tileOrigin = uniform(ivec2(0, 0));
    const cutoffDistSq = uniform(0.0);

    const splatFn = Fn(() => {
        const idx = instanceIndex;
        const lx = idx.mod(int(tileSize));
        const ly = idx.div(int(tileSize));

        const x = tileOrigin.x.add(lx);
        const y = tileOrigin.y.add(ly);

        // Out of bounds tile pixels (edges when tiling near the texture border).
        If(x.lessThan(int(0)).or(y.lessThan(int(0))).or(x.greaterThanEqual(int(width))).or(y.greaterThanEqual(int(height))), () => {
            Return();
        });

        const coord = ivec2(x, y);

        // UV coordinates at pixel centers (0..1)
        const u = float(x).add(0.5).div(float(width));
        const v = float(y).add(0.5).div(float(height));

        // Distance from splat center
        const dx = u.sub(splatPos.x);
        const dy = v.sub(splatPos.y);
        const distSq = dx.mul(dx).add(dy.mul(dy));

        // Skip work (and avoid touching the texel) when outside the meaningful influence region.
        If(distSq.greaterThan(cutoffDistSq.max(float(0.0))), () => {
            Return();
        });

        const falloffI = int(falloff);
        const blendI = int(blendMode);

        const falloffK = select(
            falloffI.equal(int(3)),
            float(4.0),
            select(
                falloffI.equal(int(2)),
                float(2.0),
                select(falloffI.equal(int(1)), float(1.0), float(0.5))
            )
        );
        const r = radius.mul(softness.max(float(0.05)));

        // Gaussian-like falloff
        const w = exp(distSq.negate().div(r.max(float(1e-6))).mul(falloffK));

        const current = textureLoad(velocityTex, coord);
        const injected = current.xy.add(splatVel.xy.mul(w));

        const maxed = vec2(
            max(current.x, injected.x),
            max(current.y, injected.y)
        );
        // Avoid mix(vec2, vec2, float) since WGSL doesn't allow implicit scalar->vec promotion.
        const mixed = current.xy.mul(float(1.0).sub(w)).add(injected.mul(w));
        const newVel = select(blendI.equal(int(1)), maxed, select(blendI.equal(int(2)), mixed, injected));

        // In-place splat reads + writes the same storage texture, so we must allow read_write access.
        // (Marking the store as write-only would make the preceding textureLoad invalid in WGSL.)
        textureStore(velocityTex, coord, vec4(newVel, float(0), float(1)));
    });

    return {
        compute: splatFn().compute(tileSize * tileSize),
        uniforms: { splatPos, splatVel, splatColor, radius, softness, falloff, blendMode, tileOrigin, cutoffDistSq },
    };
}

/**
 * Create an in-place dye splat compute node operating over a fixed tile region.
 */
export function createDyeSplatInPlaceTileNode(
    dyeTex: THREE.StorageTexture,
    width: number,
    height: number,
    tileSize = 32
): SplatCompute {
    const splatPos = uniform(vec2(0.5, 0.5));
    const splatVel = uniform(vec2(0.0, 0.0)); // used for intensity
    const splatColor = uniform(vec4(1.0, 0.0, 0.0, 1.0));
    const radius = uniform(0.005);
    const softness = uniform(1.0);
    const falloff = uniform(2); // 0..3
    const blendMode = uniform(0); // 0 add, 1 max, 2 mix

    const tileOrigin = uniform(ivec2(0, 0));
    const cutoffDistSq = uniform(0.0);

    const splatFn = Fn(() => {
        const idx = instanceIndex;
        const lx = idx.mod(int(tileSize));
        const ly = idx.div(int(tileSize));

        const x = tileOrigin.x.add(lx);
        const y = tileOrigin.y.add(ly);

        If(x.lessThan(int(0)).or(y.lessThan(int(0))).or(x.greaterThanEqual(int(width))).or(y.greaterThanEqual(int(height))), () => {
            Return();
        });

        const coord = ivec2(x, y);

        const u = float(x).add(0.5).div(float(width));
        const v = float(y).add(0.5).div(float(height));

        const dx = u.sub(splatPos.x);
        const dy = v.sub(splatPos.y);
        const distSq = dx.mul(dx).add(dy.mul(dy));

        If(distSq.greaterThan(cutoffDistSq.max(float(0.0))), () => {
            Return();
        });

        const falloffI = int(falloff);
        const blendI = int(blendMode);

        const falloffK = select(
            falloffI.equal(int(3)),
            float(4.0),
            select(
                falloffI.equal(int(2)),
                float(2.0),
                select(falloffI.equal(int(1)), float(1.0), float(0.5))
            )
        );
        const r = radius.mul(softness.max(float(0.05)));
        const w = exp(distSq.negate().div(r.max(float(1e-6))).mul(falloffK));

        // Scale by velocity magnitude for intensity
        const speed = sqrt(splatVel.x.mul(splatVel.x).add(splatVel.y.mul(splatVel.y)));
        const intensity = w.mul(speed.add(float(0.1)));

        const current = textureLoad(dyeTex, coord);
        const injected = current.xyz.add(splatColor.xyz.mul(intensity));
        const maxed = vec3(
            max(current.x, injected.x),
            max(current.y, injected.y),
            max(current.z, injected.z)
        );
        const mixed = current.xyz.mul(float(1.0).sub(w)).add(injected.mul(w));
        const newDye = select(blendI.equal(int(1)), maxed, select(blendI.equal(int(2)), mixed, injected));

        // In-place splat reads + writes the same storage texture, so we must allow read_write access.
        textureStore(dyeTex, coord, vec4(newDye, float(1)));
    });

    return {
        compute: splatFn().compute(tileSize * tileSize),
        uniforms: { splatPos, splatVel, splatColor, radius, softness, falloff, blendMode, tileOrigin, cutoffDistSq },
    };
}

/**
 * Create a ping-pong tiled velocity splat (reads A, writes B) over a fixed tile region.
 * This is the safe fallback for GPUs/backends that do not support read+write from the same storage texture.
 */
export function createVelocitySplatTileNode(
    velocityReadTex: THREE.StorageTexture,
    velocityWriteTex: THREE.StorageTexture,
    width: number,
    height: number,
    tileSize = 32
): SplatCompute {
    const splatPos = uniform(vec2(0.5, 0.5));
    const splatVel = uniform(vec2(0.0, 0.0));
    const splatColor = uniform(vec4(1.0, 1.0, 1.0, 1.0)); // unused for velocity
    const radius = uniform(0.01);
    const softness = uniform(1.0);
    const falloff = uniform(2); // 0..3
    const blendMode = uniform(0); // 0 add, 1 max, 2 mix

    const tileOrigin = uniform(ivec2(0, 0));
    const cutoffDistSq = uniform(0.0);

    const splatFn = Fn(() => {
        const idx = instanceIndex;
        const lx = idx.mod(int(tileSize));
        const ly = idx.div(int(tileSize));

        const x = tileOrigin.x.add(lx);
        const y = tileOrigin.y.add(ly);

        If(x.lessThan(int(0)).or(y.lessThan(int(0))).or(x.greaterThanEqual(int(width))).or(y.greaterThanEqual(int(height))), () => {
            Return();
        });

        const coord = ivec2(x, y);

        const u = float(x).add(0.5).div(float(width));
        const v = float(y).add(0.5).div(float(height));

        const dx = u.sub(splatPos.x);
        const dy = v.sub(splatPos.y);
        const distSq = dx.mul(dx).add(dy.mul(dy));

        If(distSq.greaterThan(cutoffDistSq.max(float(0.0))), () => {
            Return();
        });

        const falloffI = int(falloff);
        const blendI = int(blendMode);

        const falloffK = select(
            falloffI.equal(int(3)),
            float(4.0),
            select(
                falloffI.equal(int(2)),
                float(2.0),
                select(falloffI.equal(int(1)), float(1.0), float(0.5))
            )
        );
        const r = radius.mul(softness.max(float(0.05)));
        const w = exp(distSq.negate().div(r.max(float(1e-6))).mul(falloffK));

        const current = textureLoad(velocityReadTex, coord);
        const injected = current.xy.add(splatVel.xy.mul(w));

        const maxed = vec2(
            max(current.x, injected.x),
            max(current.y, injected.y)
        );
        const mixed = current.xy.mul(float(1.0).sub(w)).add(injected.mul(w));
        const newVel = select(blendI.equal(int(1)), maxed, select(blendI.equal(int(2)), mixed, injected));

        textureStore(velocityWriteTex, coord, vec4(newVel, float(0), float(1))).toWriteOnly();
    });

    return {
        compute: splatFn().compute(tileSize * tileSize),
        uniforms: { splatPos, splatVel, splatColor, radius, softness, falloff, blendMode, tileOrigin, cutoffDistSq },
    };
}

/**
 * Create a ping-pong tiled dye splat (reads A, writes B) over a fixed tile region.
 */
export function createDyeSplatTileNode(
    dyeReadTex: THREE.StorageTexture,
    dyeWriteTex: THREE.StorageTexture,
    width: number,
    height: number,
    tileSize = 32
): SplatCompute {
    const splatPos = uniform(vec2(0.5, 0.5));
    const splatVel = uniform(vec2(0.0, 0.0)); // used for intensity
    const splatColor = uniform(vec4(1.0, 0.0, 0.0, 1.0));
    const radius = uniform(0.005);
    const softness = uniform(1.0);
    const falloff = uniform(2); // 0..3
    const blendMode = uniform(0); // 0 add, 1 max, 2 mix

    const tileOrigin = uniform(ivec2(0, 0));
    const cutoffDistSq = uniform(0.0);

    const splatFn = Fn(() => {
        const idx = instanceIndex;
        const lx = idx.mod(int(tileSize));
        const ly = idx.div(int(tileSize));

        const x = tileOrigin.x.add(lx);
        const y = tileOrigin.y.add(ly);

        If(x.lessThan(int(0)).or(y.lessThan(int(0))).or(x.greaterThanEqual(int(width))).or(y.greaterThanEqual(int(height))), () => {
            Return();
        });

        const coord = ivec2(x, y);

        const u = float(x).add(0.5).div(float(width));
        const v = float(y).add(0.5).div(float(height));

        const dx = u.sub(splatPos.x);
        const dy = v.sub(splatPos.y);
        const distSq = dx.mul(dx).add(dy.mul(dy));

        If(distSq.greaterThan(cutoffDistSq.max(float(0.0))), () => {
            Return();
        });

        const falloffI = int(falloff);
        const blendI = int(blendMode);

        const falloffK = select(
            falloffI.equal(int(3)),
            float(4.0),
            select(
                falloffI.equal(int(2)),
                float(2.0),
                select(falloffI.equal(int(1)), float(1.0), float(0.5))
            )
        );
        const r = radius.mul(softness.max(float(0.05)));
        const w = exp(distSq.negate().div(r.max(float(1e-6))).mul(falloffK));

        const speed = sqrt(splatVel.x.mul(splatVel.x).add(splatVel.y.mul(splatVel.y)));
        const intensity = w.mul(speed.add(float(0.1)));

        const current = textureLoad(dyeReadTex, coord);
        const injected = current.xyz.add(splatColor.xyz.mul(intensity));
        const maxed = vec3(
            max(current.x, injected.x),
            max(current.y, injected.y),
            max(current.z, injected.z)
        );
        const mixed = current.xyz.mul(float(1.0).sub(w)).add(injected.mul(w));
        const newDye = select(blendI.equal(int(1)), maxed, select(blendI.equal(int(2)), mixed, injected));

        textureStore(dyeWriteTex, coord, vec4(newDye, float(1))).toWriteOnly();
    });

    return {
        compute: splatFn().compute(tileSize * tileSize),
        uniforms: { splatPos, splatVel, splatColor, radius, softness, falloff, blendMode, tileOrigin, cutoffDistSq },
    };
}

/**
 * Create velocity splat compute node
 */
export function createVelocitySplatNode(
    velocityReadTex: THREE.StorageTexture,
    velocityWriteTex: THREE.StorageTexture,
    width: number,
    height: number
): SplatCompute {
    const splatPos = uniform(vec2(0.5, 0.5));
    const splatVel = uniform(vec2(0.0, 0.0));
    const splatColor = uniform(vec4(1.0, 1.0, 1.0, 1.0)); // unused for velocity
    const radius = uniform(0.01);
    const softness = uniform(1.0);
    const falloff = uniform(2); // 0..3
    const blendMode = uniform(0); // 0 add, 1 max, 2 mix

    const splatFn = Fn(() => {
        const idx = instanceIndex;
        const x = idx.mod(int(width));
        const y = idx.div(int(width));
        const coord = ivec2(x, y);

        // UV coordinates at pixel centers (0..1)
        const u = float(x).add(0.5).div(float(width));
        const v = float(y).add(0.5).div(float(height));

        // Distance from splat center
        const dx = u.sub(splatPos.x);
        const dy = v.sub(splatPos.y);
        const distSq = dx.mul(dx).add(dy.mul(dy));

        const falloffI = int(falloff);
        const blendI = int(blendMode);

        const falloffK = select(
            falloffI.equal(int(3)),
            float(4.0),
            select(
                falloffI.equal(int(2)),
                float(2.0),
                select(falloffI.equal(int(1)), float(1.0), float(0.5))
            )
        );
        const r = radius.mul(softness.max(float(0.05)));

        // Gaussian-like falloff
        const w = exp(distSq.negate().div(r.max(float(1e-6))).mul(falloffK));

        const current = textureLoad(velocityReadTex, coord);
        const injected = current.xy.add(splatVel.xy.mul(w));

        const maxed = vec2(
            max(current.x, injected.x),
            max(current.y, injected.y)
        );
        const mixed = current.xy.mul(float(1.0).sub(w)).add(injected.mul(w));
        const newVel = select(blendI.equal(int(1)), maxed, select(blendI.equal(int(2)), mixed, injected));

        textureStore(velocityWriteTex, coord, vec4(newVel, float(0), float(1))).toWriteOnly();
    });

    return {
        compute: splatFn().compute(width * height),
        uniforms: { splatPos, splatVel, splatColor, radius, softness, falloff, blendMode }
    };
}

/**
 * Create dye splat compute node
 */
export function createDyeSplatNode(
    dyeReadTex: THREE.StorageTexture,
    dyeWriteTex: THREE.StorageTexture,
    width: number,
    height: number
): SplatCompute {
    const splatPos = uniform(vec2(0.5, 0.5));
    const splatVel = uniform(vec2(0.0, 0.0)); // used for intensity
    const splatColor = uniform(vec4(1.0, 0.0, 0.0, 1.0));
    const radius = uniform(0.005);
    const softness = uniform(1.0);
    const falloff = uniform(2); // 0..3
    const blendMode = uniform(0); // 0 add, 1 max, 2 mix

    const splatFn = Fn(() => {
        const idx = instanceIndex;
        const x = idx.mod(int(width));
        const y = idx.div(int(width));
        const coord = ivec2(x, y);

        const u = float(x).add(0.5).div(float(width));
        const v = float(y).add(0.5).div(float(height));

        const dx = u.sub(splatPos.x);
        const dy = v.sub(splatPos.y);
        const distSq = dx.mul(dx).add(dy.mul(dy));

        const falloffI = int(falloff);
        const blendI = int(blendMode);

        const falloffK = select(
            falloffI.equal(int(3)),
            float(4.0),
            select(
                falloffI.equal(int(2)),
                float(2.0),
                select(falloffI.equal(int(1)), float(1.0), float(0.5))
            )
        );
        const r = radius.mul(softness.max(float(0.05)));
        const w = exp(distSq.negate().div(r.max(float(1e-6))).mul(falloffK));

        // Scale by velocity magnitude for intensity
        const speed = sqrt(splatVel.x.mul(splatVel.x).add(splatVel.y.mul(splatVel.y)));
        const intensity = w.mul(speed.add(float(0.1)));

        const current = textureLoad(dyeReadTex, coord);
        const injected = current.xyz.add(splatColor.xyz.mul(intensity));
        const maxed = vec3(
            max(current.x, injected.x),
            max(current.y, injected.y),
            max(current.z, injected.z)
        );
        const mixed = current.xyz.mul(float(1.0).sub(w)).add(injected.mul(w));
        const newDye = select(blendI.equal(int(1)), maxed, select(blendI.equal(int(2)), mixed, injected));

        textureStore(dyeWriteTex, coord, vec4(newDye, float(1))).toWriteOnly();
    });

    return {
        compute: splatFn().compute(width * height),
        uniforms: { splatPos, splatVel, splatColor, radius, softness, falloff, blendMode }
    };
}
