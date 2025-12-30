/**
 * @package fluid-2d/nodes
 * Turbulence TSL Node - Divergence-free curl-noise force (procedural)
 */

import { Fn, float, int, ivec2, instanceIndex, textureLoad, textureStore, vec2, vec4, uniform, sin, cos, select, max, length } from 'three/tsl';
import * as THREE from 'three/webgpu';

export interface TurbulenceCompute {
  compute: any;
  uniforms: { strength: any; scale: any; time: any; speed: any; octaves: any; dt: any };
}

export function createTurbulenceNode(
  velocityReadTex: THREE.StorageTexture,
  velocityWriteTex: THREE.StorageTexture,
  width: number,
  height: number
): TurbulenceCompute {
  const strength = uniform(0.0);
  const scale = uniform(1.0);
  const time = uniform(0.0);
  const speed = uniform(1.0);
  const octaves = uniform(3);
  const dt = uniform(1.0 / 60.0);

  const turbulenceFn = Fn(() => {
    const idx = instanceIndex;
    const x = idx.mod(int(width));
    const y = idx.div(int(width));
    const coord = ivec2(x, y);

    const u = float(x).div(float(width));
    const v = float(y).div(float(height));

    // Divergence-free curl-noise from a scalar potential psi(u,v).
    const s = scale.mul(6.2831853);
    const t = time.mul(speed).mul(0.75);
    const o = int(octaves);

    const psi = (uu: any, vv: any) => {
      const p0 = sin(uu.mul(s).add(t)).mul(cos(vv.mul(s).sub(t)));
      const p1 = sin(uu.mul(s.mul(2.0)).sub(t.mul(1.3))).mul(cos(vv.mul(s.mul(2.0)).add(t.mul(1.1)))).mul(0.5);
      const p2 = sin(uu.mul(s.mul(4.0)).add(t.mul(0.7))).mul(cos(vv.mul(s.mul(4.0)).sub(t.mul(0.9)))).mul(0.25);
      const p3 = sin(uu.mul(s.mul(8.0)).sub(t.mul(0.4))).mul(cos(vv.mul(s.mul(8.0)).add(t.mul(0.6)))).mul(0.125);

      const pp1 = select(o.greaterThan(int(1)), p1, float(0.0));
      const pp2 = select(o.greaterThan(int(2)), p2, float(0.0));
      const pp3 = select(o.greaterThan(int(3)), p3, float(0.0));
      return p0.add(pp1).add(pp2).add(pp3);
    };

    const du = float(1.0).div(float(width));
    const dv = float(1.0).div(float(height));
    const denomU = du.mul(2.0).max(float(1e-6));
    const denomV = dv.mul(2.0).max(float(1e-6));

    const psiR = psi(u.add(du), v);
    const psiL = psi(u.sub(du), v);
    const psiU = psi(u, v.add(dv));
    const psiD = psi(u, v.sub(dv));

    const dpsiDx = psiR.sub(psiL).div(denomU);
    const dpsiDy = psiU.sub(psiD).div(denomV);

    // curl(psi) = ( dpsi/dy, -dpsi/dx )
    const curl = vec2(dpsiDy, dpsiDx.negate());
    const curlLen = max(length(curl), float(1e-4));
    const curlDir = curl.div(curlLen);

    const force = curlDir.mul(strength).mul(dt);

    const vel = textureLoad(velocityReadTex, coord).xy;
    textureStore(velocityWriteTex, coord, vec4(vel.add(force), float(0), float(1))).toWriteOnly();
  });

  return {
    compute: turbulenceFn().compute(width * height),
    uniforms: { strength, scale, time, speed, octaves, dt },
  };
}
