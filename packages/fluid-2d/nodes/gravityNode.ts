/**
 * @package fluid-2d/nodes
 * Gravity TSL Node - Adds a constant acceleration to velocity.
 */

import { Fn, uniform, float, int, ivec2, instanceIndex, textureLoad, textureStore, vec2, vec4 } from 'three/tsl';
import * as THREE from 'three/webgpu';

export interface GravityUniforms {
  dt: any;
  gravity: any;
}

export interface GravityCompute {
  compute: any;
  uniforms: GravityUniforms;
}

export function createGravityNode(
  velocityReadTex: THREE.StorageTexture,
  velocityWriteTex: THREE.StorageTexture,
  width: number,
  height: number
): GravityCompute {
  const dt = uniform(1.0 / 60.0);
  const gravity = uniform(vec2(0.0, 0.0));

  const gravityFn = Fn(() => {
    const idx = instanceIndex;
    const x = idx.mod(int(width));
    const y = idx.div(int(width));
    const coord = ivec2(x, y);

    const current = textureLoad(velocityReadTex, coord);
    const next = current.xy.add(gravity.mul(dt));
    textureStore(velocityWriteTex, coord, vec4(next, float(0), float(1))).toWriteOnly();
  });

  return { compute: gravityFn().compute(width * height), uniforms: { dt, gravity } };
}

