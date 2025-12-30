/**
 * @package fluid-2d/nodes
 * Clear TSL Node - GPU-side StorageTexture clear
 *
 * Fills a StorageTexture with `vec4(0,0,0,1)` (alpha kept at 1 for convenience).
 */

import { Fn, float, int, ivec2, instanceIndex, textureStore, vec4 } from 'three/tsl';
import * as THREE from 'three/webgpu';

export interface ClearCompute {
  compute: any;
}

export function createClearNode(
  texture: THREE.StorageTexture,
  width: number,
  height: number
): ClearCompute {
  const clearFn = Fn(() => {
    const idx = instanceIndex;
    const x = idx.mod(int(width));
    const y = idx.div(int(width));
    const coord = ivec2(x, y);

    textureStore(texture, coord, vec4(float(0), float(0), float(0), float(1))).toWriteOnly();
  });

  return {
    compute: clearFn().compute(width * height),
  };
}

