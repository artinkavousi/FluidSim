/**
 * @package fluid-2d/nodes
 * Buoyancy TSL Node - Dye-density driven vertical force
 */

import { Fn, float, int, ivec2, instanceIndex, textureLoad, textureStore, vec4, uniform, max, min } from 'three/tsl';
import * as THREE from 'three/webgpu';

export interface BuoyancyCompute {
  compute: any;
  uniforms: { strength: any; ambient: any; dt: any };
}

export function createBuoyancyNode(
  velocityReadTex: THREE.StorageTexture,
  dyeTex: THREE.StorageTexture,
  velocityWriteTex: THREE.StorageTexture,
  width: number,
  height: number,
  dyeWidth: number,
  dyeHeight: number
): BuoyancyCompute {
  const strength = uniform(0.0);
  const ambient = uniform(0.0);
  const dt = uniform(1.0 / 60.0);

  const buoyancyFn = Fn(() => {
    const idx = instanceIndex;
    const x = idx.mod(int(width));
    const y = idx.div(int(width));
    const coord = ivec2(x, y);

    // Map grid coord -> dye coord
    const dx = int(float(x).mul(float(dyeWidth)).div(float(width)));
    const dy = int(float(y).mul(float(dyeHeight)).div(float(height)));
    const dyeX = max(int(0), min(dx, int(dyeWidth - 1)));
    const dyeY = max(int(0), min(dy, int(dyeHeight - 1)));

    const dye = textureLoad(dyeTex, ivec2(dyeX, dyeY)).xyz;
    const density = dye.x.add(dye.y).add(dye.z).mul(0.3333333);

    // Y-down velocity: buoyancy pushes upward => negative Y.
    const f = density.sub(ambient).mul(strength).mul(dt);

    const vel = textureLoad(velocityReadTex, coord);
    const outY = vel.y.sub(f);

    textureStore(velocityWriteTex, coord, vec4(vel.x, outY, float(0), float(1))).toWriteOnly();
  });

  return {
    compute: buoyancyFn().compute(width * height),
    uniforms: { strength, ambient, dt },
  };
}

