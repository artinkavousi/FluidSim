/**
 * @package fluid-2d/nodes
 * CopyTexture TSL Node - GPU-side StorageTexture copy (vec4)
 *
 * Used to stabilize ping-pong outputs for rendering/debug by copying the "latest"
 * texture into a canonical target texture.
 */

import { Fn, float, int, ivec2, instanceIndex, textureLoad, textureStore, vec4 } from 'three/tsl';
import * as THREE from 'three/webgpu';

export interface CopyTextureCompute {
  compute: any;
}

export function createCopyTextureNode(
  sourceTex: THREE.StorageTexture,
  destTex: THREE.StorageTexture,
  width: number,
  height: number
): CopyTextureCompute {
  const copyFn = Fn(() => {
    const idx = instanceIndex;
    const x = idx.mod(int(width));
    const y = idx.div(int(width));
    const coord = ivec2(x, y);

    const v = textureLoad(sourceTex, coord);
    textureStore(destTex, coord, vec4(v.x, v.y, v.z, v.w)).toWriteOnly();
  });

  return { compute: copyFn().compute(width * height) };
}

