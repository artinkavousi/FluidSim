/**
 * @package fluid-2d/core
 * PingPongBuffer - StorageTexture-based ping-pong for TSL compute
 * 
 * Uses StorageTexture for compute shaders (textureStore/textureLoad).
 * StorageTexture extends Texture and can be sampled with texture() in fragment shaders.
 */

import * as THREE from 'three/webgpu';

/**
 * Ping-pong textures for fluid simulation using StorageTexture.
 * StorageTexture works in both compute (textureStore/textureLoad) AND fragment shaders (texture()).
 */
export class PingPongTexture {
    private textures: [THREE.StorageTexture, THREE.StorageTexture];
    private currentIdx: number = 0;
    public readonly width: number;
    public readonly height: number;

    constructor(width: number, height: number) {
        this.width = width;
        this.height = height;

        // Create two StorageTextures for ping-pong
        // StorageTexture extends Texture, so it can be sampled in fragment shaders
        this.textures = [
            new THREE.StorageTexture(width, height),
            new THREE.StorageTexture(width, height),
        ];

        // Configure for fluid simulation (float type for precision)
        for (const tex of this.textures) {
            // Half float is typically faster and widely supported in WebGPU (rgba16float storage textures).
            tex.type = THREE.HalfFloatType;
            tex.minFilter = THREE.LinearFilter;
            tex.magFilter = THREE.LinearFilter;
            tex.wrapS = THREE.ClampToEdgeWrapping;
            tex.wrapT = THREE.ClampToEdgeWrapping;
        }
    }

    /** Get the current read texture (for textureLoad in compute or texture() in fragment) */
    get read(): THREE.StorageTexture {
        return this.textures[this.currentIdx];
    }

    /** Get the current write texture (for textureStore in compute) */
    get write(): THREE.StorageTexture {
        return this.textures[1 - this.currentIdx];
    }

    /** Direct access: texture A (index 0) */
    get a(): THREE.StorageTexture {
        return this.textures[0];
    }

    /** Direct access: texture B (index 1) */
    get b(): THREE.StorageTexture {
        return this.textures[1];
    }

    /** Swap read and write textures after a compute pass */
    swap(): void {
        this.currentIdx = 1 - this.currentIdx;
    }

    /** Dispose both textures */
    dispose(): void {
        this.textures[0].dispose();
        this.textures[1].dispose();
    }
}

/**
 * Single StorageTexture for intermediate results (divergence, vorticity)
 */
export class SingleTexture {
    public readonly texture: THREE.StorageTexture;
    public readonly width: number;
    public readonly height: number;

    constructor(width: number, height: number) {
        this.width = width;
        this.height = height;

        this.texture = new THREE.StorageTexture(width, height);
        this.texture.type = THREE.HalfFloatType;
        this.texture.minFilter = THREE.NearestFilter;
        this.texture.magFilter = THREE.NearestFilter;
        this.texture.wrapS = THREE.ClampToEdgeWrapping;
        this.texture.wrapT = THREE.ClampToEdgeWrapping;
    }

    dispose(): void {
        this.texture.dispose();
    }
}
