/**
 * @package fluid-2d/nodes
 * Viscosity TSL Node - Simple velocity diffusion
 *
 * This is a lightweight diffusion step that smooths the velocity field using a Laplacian.
 * It's not a full implicit viscosity solve, but matches the Studio controls well and is stable for small dt.
 */

import { Fn, If, float, int, ivec2, instanceIndex, textureLoad, textureStore, vec2, vec4, uniform, max, min } from 'three/tsl';
import * as THREE from 'three/webgpu';

export interface ViscosityCompute {
  compute: any;
  uniforms: { diffusion: any };
}

export function createViscosityNode(
  velocityReadTex: THREE.StorageTexture,
  velocityWriteTex: THREE.StorageTexture,
  width: number,
  height: number
): ViscosityCompute {
  // diffusion factor already includes dt scaling (set by solver)
  const diffusion = uniform(0.0);

  const viscosityFn = Fn(() => {
    const idx = instanceIndex;
    const x = idx.mod(int(width));
    const y = idx.div(int(width));
    const coord = ivec2(x, y);

    const xL = max(x.sub(1), int(0));
    const xR = min(x.add(1), int(width - 1));
    const yB = max(y.sub(1), int(0));
    const yT = min(y.add(1), int(height - 1));

    const c = textureLoad(velocityReadTex, coord).xy;
    const l = textureLoad(velocityReadTex, ivec2(xL, y)).xy;
    const r = textureLoad(velocityReadTex, ivec2(xR, y)).xy;
    const b = textureLoad(velocityReadTex, ivec2(x, yB)).xy;
    const t = textureLoad(velocityReadTex, ivec2(x, yT)).xy;

    const lap = l.add(r).add(b).add(t).sub(c.mul(4.0));
    const out = c.add(lap.mul(diffusion));

    textureStore(velocityWriteTex, coord, vec4(out, float(0), float(1))).toWriteOnly();
  });

  return {
    compute: viscosityFn().compute(width * height),
    uniforms: { diffusion },
  };
}

