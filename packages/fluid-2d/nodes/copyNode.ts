/**
 * @package fluid-2d/nodes
 * Copy TSL Node - GPU-side buffer copy
 * 
 * Copies data from one StorageInstancedBufferAttribute to another on the GPU.
 */

import {
    Fn,
    instanceIndex,
    storage,
} from 'three/tsl';
import type { StorageInstancedBufferAttribute } from 'three/webgpu';

export interface CopyCompute {
    compute: any;
}

/**
 * Create a GPU copy compute node (vec4)
 */
export function createCopyNode(
    source: StorageInstancedBufferAttribute,
    destination: StorageInstancedBufferAttribute,
    count: number
): CopyCompute {
    const copyFn = Fn(() => {
        const idx = instanceIndex;

        const src = storage(source, 'vec4', count);
        const dst = storage(destination, 'vec4', count);

        const value = src.element(idx);
        const result = dst.element(idx);
        result.x.assign(value.x);
        result.y.assign(value.y);
        result.z.assign(value.z);
        result.w.assign(value.w);
    });

    return {
        compute: copyFn().compute(count)
    };
}
