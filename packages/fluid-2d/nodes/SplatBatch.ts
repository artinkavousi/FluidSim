/**
 * @package fluid-2d/nodes
 * SplatBatch — GPU buffer-based splat batching for high-performance multi-splat injection
 * 
 * Instead of dispatching one compute per splat, this uploads all splats to a GPU buffer
 * and processes them in a single dispatch where each texel accumulates contributions.
 */

import {
    Fn,
    Loop,
    uniform,
    float,
    int,
    ivec2,
    vec2,
    vec3,
    vec4,
    sqrt,
    exp,
    max,
    select,
    instanceIndex,
    textureLoad,
    textureStore,
    storage,
} from 'three/tsl';
import * as THREE from 'three/webgpu';

// ============================================
// Types
// ============================================

/**
 * Packed splat data for GPU buffer
 * 12 floats = 48 bytes per splat
 */
export interface PackedSplat {
    x: number;
    y: number;
    dx: number;
    dy: number;
    r: number;
    g: number;
    b: number;
    a: number;
    radius: number;
    softness: number;
    falloff: number;
    blendMode: number;
}

export interface SplatBatchUniforms {
    splatCount: any; // TSL uniform node
}

export interface SplatBatchCompute {
    compute: any;
    uniforms: SplatBatchUniforms;
    buffer: Float32Array;
    bufferAttribute: THREE.StorageBufferAttribute;
    maxSplats: number;
    /** Upload splats to GPU buffer before dispatching */
    uploadSplats: (splats: PackedSplat[]) => void;
}

// ============================================
// Constants
// ============================================

const FLOATS_PER_SPLAT = 12;

// ============================================
// Velocity Splat Batch
// ============================================

/**
 * Create a batched velocity splat compute node.
 * Each texel iterates over all splats and accumulates velocity contributions.
 */
export function createBatchedVelocitySplatNode(
    velocityReadTex: THREE.StorageTexture,
    velocityWriteTex: THREE.StorageTexture,
    width: number,
    height: number,
    maxSplats: number = 256
): SplatBatchCompute {
    // Create CPU-side buffer for splat data
    const buffer = new Float32Array(maxSplats * FLOATS_PER_SPLAT);
    const bufferAttribute = new THREE.StorageBufferAttribute(buffer, 1); // 1 float per element for indexed access
    const splatStorage = storage(bufferAttribute, 'float', buffer.length);

    const splatCount = uniform(0);

    const batchSplatFn = Fn(() => {
        const idx = instanceIndex;
        const x = idx.mod(int(width));
        const y = idx.div(int(width));
        const coord = ivec2(x, y);

        // UV coordinates at pixel centers (0..1)
        const u = float(x).add(0.5).div(float(width));
        const v = float(y).add(0.5).div(float(height));

        // Load current velocity (read texture)
        const current = textureLoad(velocityReadTex, coord);
        const accum = vec2(current.x, current.y).toVar();

        // Loop over all active splats
        Loop({ start: int(0), end: splatCount, type: 'int', condition: '<' }, ({ i }: { i: any }) => {
            // Calculate base index for this splat in the buffer
            const base = i.mul(int(FLOATS_PER_SPLAT));

            // Read splat data from buffer
            const splatX = splatStorage.element(base.add(int(0)));
            const splatY = splatStorage.element(base.add(int(1)));
            const splatDx = splatStorage.element(base.add(int(2)));
            const splatDy = splatStorage.element(base.add(int(3)));
            const splatRadius = splatStorage.element(base.add(int(8)));
            const splatSoftness = splatStorage.element(base.add(int(9)));
            const splatFalloff = splatStorage.element(base.add(int(10)));
            const splatBlendMode = splatStorage.element(base.add(int(11)));

            // Distance from splat center
            const dx = u.sub(splatX);
            const dy = v.sub(splatY);
            const distSq = dx.mul(dx).add(dy.mul(dy));

            // Falloff calculation
            const falloffI = int(splatFalloff);
            const falloffK = select(
                falloffI.equal(int(3)),
                float(4.0),
                select(
                    falloffI.equal(int(2)),
                    float(2.0),
                    select(falloffI.equal(int(1)), float(1.0), float(0.5))
                )
            );

            const r = splatRadius.mul(splatSoftness.max(float(0.05)));
            const w = exp(distSq.negate().div(r.max(float(1e-6))).mul(falloffK));

            // Accumulate velocity contribution
            const injected = accum.add(vec2(splatDx, splatDy).mul(w));
            const blendI = int(splatBlendMode);
            const maxed = vec2(max(accum.x, injected.x), max(accum.y, injected.y));
            const mixed = accum.mul(float(1.0).sub(w)).add(injected.mul(w));
            const newVal = select(blendI.equal(int(1)), maxed, select(blendI.equal(int(2)), mixed, injected));

            accum.assign(newVal);
        });

        // Write accumulated velocity (write texture)
        textureStore(velocityWriteTex, coord, vec4(accum, float(0), float(1))).toWriteOnly();
    });

    const uploadSplats = (splats: PackedSplat[]) => {
        const count = Math.min(splats.length, maxSplats);
        for (let i = 0; i < count; i++) {
            const s = splats[i];
            const offset = i * FLOATS_PER_SPLAT;
            buffer[offset + 0] = s.x;
            buffer[offset + 1] = s.y;
            buffer[offset + 2] = s.dx;
            buffer[offset + 3] = s.dy;
            buffer[offset + 4] = s.r;
            buffer[offset + 5] = s.g;
            buffer[offset + 6] = s.b;
            buffer[offset + 7] = s.a;
            buffer[offset + 8] = s.radius;
            buffer[offset + 9] = s.softness;
            buffer[offset + 10] = s.falloff;
            buffer[offset + 11] = s.blendMode;
        }
        splatCount.value = count;
        bufferAttribute.needsUpdate = true;
    };

    return {
        compute: batchSplatFn().compute(width * height),
        uniforms: { splatCount },
        buffer,
        bufferAttribute,
        maxSplats,
        uploadSplats,
    };
}

// ============================================
// Dye Splat Batch
// ============================================

/**
 * Create a batched dye splat compute node.
 * Each texel iterates over all splats and accumulates dye contributions.
 */
export function createBatchedDyeSplatNode(
    dyeReadTex: THREE.StorageTexture,
    dyeWriteTex: THREE.StorageTexture,
    width: number,
    height: number,
    maxSplats: number = 256
): SplatBatchCompute {
    // Create CPU-side buffer for splat data
    const buffer = new Float32Array(maxSplats * FLOATS_PER_SPLAT);
    const bufferAttribute = new THREE.StorageBufferAttribute(buffer, 1);
    const splatStorage = storage(bufferAttribute, 'float', buffer.length);

    const splatCount = uniform(0);

    const batchSplatFn = Fn(() => {
        const idx = instanceIndex;
        const x = idx.mod(int(width));
        const y = idx.div(int(width));
        const coord = ivec2(x, y);

        // UV coordinates at pixel centers (0..1)
        const u = float(x).add(0.5).div(float(width));
        const v = float(y).add(0.5).div(float(height));

        // Load current dye (read texture)
        const current = textureLoad(dyeReadTex, coord);
        const accum = vec3(current.x, current.y, current.z).toVar();

        // Loop over all active splats
        Loop({ start: int(0), end: splatCount, type: 'int', condition: '<' }, ({ i }: { i: any }) => {
            // Calculate base index for this splat in the buffer
            const base = i.mul(int(FLOATS_PER_SPLAT));

            // Read splat data from buffer
            const splatX = splatStorage.element(base.add(int(0)));
            const splatY = splatStorage.element(base.add(int(1)));
            const splatDx = splatStorage.element(base.add(int(2)));
            const splatDy = splatStorage.element(base.add(int(3)));
            const splatR = splatStorage.element(base.add(int(4)));
            const splatG = splatStorage.element(base.add(int(5)));
            const splatB = splatStorage.element(base.add(int(6)));
            const splatRadius = splatStorage.element(base.add(int(8)));
            const splatSoftness = splatStorage.element(base.add(int(9)));
            const splatFalloff = splatStorage.element(base.add(int(10)));
            const splatBlendMode = splatStorage.element(base.add(int(11)));

            const splatColor = vec3(splatR, splatG, splatB);

            // Distance from splat center
            const dx = u.sub(splatX);
            const dy = v.sub(splatY);
            const distSq = dx.mul(dx).add(dy.mul(dy));

            // Falloff calculation
            const falloffI = int(splatFalloff);
            const falloffK = select(
                falloffI.equal(int(3)),
                float(4.0),
                select(
                    falloffI.equal(int(2)),
                    float(2.0),
                    select(falloffI.equal(int(1)), float(1.0), float(0.5))
                )
            );

            const r = splatRadius.mul(splatSoftness.max(float(0.05)));
            const w = exp(distSq.negate().div(r.max(float(1e-6))).mul(falloffK));

            // Scale by velocity magnitude for intensity
            const speed = sqrt(splatDx.mul(splatDx).add(splatDy.mul(splatDy)));
            const intensity = w.mul(speed.add(float(0.1)));

            // Accumulate dye contribution
            const injected = accum.add(splatColor.mul(intensity));
            const blendI = int(splatBlendMode);
            const maxed = vec3(
                max(accum.x, injected.x),
                max(accum.y, injected.y),
                max(accum.z, injected.z)
            );
            const mixed = accum.mul(float(1.0).sub(w)).add(injected.mul(w));
            const newVal = select(blendI.equal(int(1)), maxed, select(blendI.equal(int(2)), mixed, injected));

            accum.assign(newVal);
        });

        // Write accumulated dye (write texture)
        textureStore(dyeWriteTex, coord, vec4(accum, float(1))).toWriteOnly();
    });

    const uploadSplats = (splats: PackedSplat[]) => {
        const count = Math.min(splats.length, maxSplats);
        for (let i = 0; i < count; i++) {
            const s = splats[i];
            const offset = i * FLOATS_PER_SPLAT;
            buffer[offset + 0] = s.x;
            buffer[offset + 1] = s.y;
            buffer[offset + 2] = s.dx;
            buffer[offset + 3] = s.dy;
            buffer[offset + 4] = s.r;
            buffer[offset + 5] = s.g;
            buffer[offset + 6] = s.b;
            buffer[offset + 7] = s.a;
            buffer[offset + 8] = s.radius;
            buffer[offset + 9] = s.softness;
            buffer[offset + 10] = s.falloff;
            buffer[offset + 11] = s.blendMode;
        }
        splatCount.value = count;
        bufferAttribute.needsUpdate = true;
    };

    return {
        compute: batchSplatFn().compute(width * height),
        uniforms: { splatCount },
        buffer,
        bufferAttribute,
        maxSplats,
        uploadSplats,
    };
}
