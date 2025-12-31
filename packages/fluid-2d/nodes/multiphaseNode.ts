/**
 * @package fluid-2d/nodes
 * Multiphase helpers (RGB phases)
 *
 * This is a lightweight "multi-phase" approximation:
 * - Dye RGB channels are treated as separate phase concentrations.
 * - Per-channel dissipation can be applied after advection.
 * - Buoyancy can optionally weight RGB channels differently.
 */

import * as THREE from 'three/webgpu';
import {
  Fn,
  uniform,
  float,
  int,
  ivec2,
  vec3,
  vec4,
  instanceIndex,
  textureLoad,
  textureStore,
  clamp,
} from 'three/tsl';

export interface DyeChannelDissipationCompute {
  compute: any;
  uniforms: { dissipationRGB: any };
}

/**
 * Multiply dye.rgb by a per-channel dissipation factor each step.
 * Expected range is ~0.9..1.0 (values outside are clamped).
 */
export function createDyeChannelDissipationNode(
  dyeReadTex: THREE.StorageTexture,
  dyeWriteTex: THREE.StorageTexture,
  width: number,
  height: number
): DyeChannelDissipationCompute {
  const dissipationRGB = uniform(vec3(0.99, 0.99, 0.99));

  const fn = Fn(() => {
    const idx = instanceIndex;
    const x = idx.mod(int(width));
    const y = idx.div(int(width));
    const coord = ivec2(x, y);

    const dye = textureLoad(dyeReadTex, coord).xyz;
    const d = clamp(dissipationRGB, vec3(0.0, 0.0, 0.0), vec3(1.0, 1.0, 1.0));
    const outRgb = dye.mul(d);
    textureStore(dyeWriteTex, coord, vec4(outRgb, float(1.0))).toWriteOnly();
  });

  return { compute: fn().compute(width * height), uniforms: { dissipationRGB } };
}

