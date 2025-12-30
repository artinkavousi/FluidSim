/**
 * @package fluid-2d/nodes
 * MacCormack (BFECC-style) correction nodes for advection.
 *
 * These nodes assume a separate forward advection pass has produced an "advected" texture.
 * The correction pass uses a reverse advection sample to estimate error and clamps against
 * the original neighborhood to reduce overshoot.
 */

import {
  Fn,
  uniform,
  float,
  int,
  ivec2,
  vec2,
  vec3,
  vec4,
  floor,
  fract,
  mix,
  clamp,
  instanceIndex,
  textureLoad,
  textureStore,
  min,
  max,
} from 'three/tsl';
import * as THREE from 'three/webgpu';

export interface MacCormackUniforms {
  dt: any;
}

export interface MacCormackCompute {
  compute: any;
  uniforms: MacCormackUniforms;
}

function bilinearSample(tex: THREE.StorageTexture, coord: any, width: number, height: number) {
  const fx = fract(coord.x);
  const fy = fract(coord.y);
  const ix = int(floor(coord.x));
  const iy = int(floor(coord.y));

  const w = int(width);
  const h = int(height);

  const x0 = clamp(ix, int(0), w.sub(1));
  const y0 = clamp(iy, int(0), h.sub(1));
  const x1 = clamp(ix.add(1), int(0), w.sub(1));
  const y1 = clamp(iy.add(1), int(0), h.sub(1));

  const c00 = textureLoad(tex, ivec2(x0, y0));
  const c10 = textureLoad(tex, ivec2(x1, y0));
  const c01 = textureLoad(tex, ivec2(x0, y1));
  const c11 = textureLoad(tex, ivec2(x1, y1));

  // Avoid mix(vec4, vec4, float) since WGSL doesn't allow implicit scalar->vec promotion.
  const one = float(1.0);
  const c0 = c00.mul(one.sub(fx)).add(c10.mul(fx));
  const c1 = c01.mul(one.sub(fx)).add(c11.mul(fx));
  return c0.mul(one.sub(fy)).add(c1.mul(fy));
}

function neighborhoodMinMax2(tex: THREE.StorageTexture, coord: any, width: number, height: number) {
  const ix = int(floor(coord.x));
  const iy = int(floor(coord.y));

  const w = int(width);
  const h = int(height);

  const x0 = clamp(ix, int(0), w.sub(1));
  const y0 = clamp(iy, int(0), h.sub(1));
  const x1 = clamp(ix.add(1), int(0), w.sub(1));
  const y1 = clamp(iy.add(1), int(0), h.sub(1));

  const c00 = textureLoad(tex, ivec2(x0, y0)).xy;
  const c10 = textureLoad(tex, ivec2(x1, y0)).xy;
  const c01 = textureLoad(tex, ivec2(x0, y1)).xy;
  const c11 = textureLoad(tex, ivec2(x1, y1)).xy;

  const mn = vec2(
    min(c00.x, min(c10.x, min(c01.x, c11.x))),
    min(c00.y, min(c10.y, min(c01.y, c11.y)))
  );
  const mx = vec2(
    max(c00.x, max(c10.x, max(c01.x, c11.x))),
    max(c00.y, max(c10.y, max(c01.y, c11.y)))
  );

  return { mn, mx };
}

function neighborhoodMinMax3(tex: THREE.StorageTexture, coord: any, width: number, height: number) {
  const ix = int(floor(coord.x));
  const iy = int(floor(coord.y));

  const w = int(width);
  const h = int(height);

  const x0 = clamp(ix, int(0), w.sub(1));
  const y0 = clamp(iy, int(0), h.sub(1));
  const x1 = clamp(ix.add(1), int(0), w.sub(1));
  const y1 = clamp(iy.add(1), int(0), h.sub(1));

  const c00 = textureLoad(tex, ivec2(x0, y0)).xyz;
  const c10 = textureLoad(tex, ivec2(x1, y0)).xyz;
  const c01 = textureLoad(tex, ivec2(x0, y1)).xyz;
  const c11 = textureLoad(tex, ivec2(x1, y1)).xyz;

  const mn = vec3(
    min(c00.x, min(c10.x, min(c01.x, c11.x))),
    min(c00.y, min(c10.y, min(c01.y, c11.y))),
    min(c00.z, min(c10.z, min(c01.z, c11.z)))
  );
  const mx = vec3(
    max(c00.x, max(c10.x, max(c01.x, c11.x))),
    max(c00.y, max(c10.y, max(c01.y, c11.y))),
    max(c00.z, max(c10.z, max(c01.z, c11.z)))
  );

  return { mn, mx };
}

export function createVelocityMacCormackCorrectNode(
  velocityOriginal: THREE.StorageTexture,
  velocityAdvected: THREE.StorageTexture,
  velocityWrite: THREE.StorageTexture,
  width: number,
  height: number
): MacCormackCompute {
  const dt = uniform(1.0 / 60.0);

  const correctFn = Fn(() => {
    const idx = instanceIndex;
    const x = idx.mod(int(width));
    const y = idx.div(int(width));
    const coord = ivec2(x, y);

    const vel0 = textureLoad(velocityOriginal, coord).xy;
    const vel1 = textureLoad(velocityAdvected, coord).xy;

    const pos = vec2(float(x).add(0.5), float(y).add(0.5));

    // Reverse advection sample: sample vel1 at pos + vel0*dt*width
    const revPos = pos.add(vel0.mul(dt).mul(float(width)));
    const revClamped = clamp(revPos, vec2(0.5), vec2(float(width).sub(0.5), float(height).sub(0.5)));
    const vel2 = bilinearSample(velocityAdvected, revClamped, width, height).xy;

    const corrected = vel1.add(vel0.sub(vel2).mul(0.5));

    // Clamp against original neighborhood around forward backtrace position (pos - vel0*dt*width)
    const backPos = pos.sub(vel0.mul(dt).mul(float(width)));
    const backClamped = clamp(backPos, vec2(0.5), vec2(float(width).sub(0.5), float(height).sub(0.5)));
    const { mn, mx } = neighborhoodMinMax2(velocityOriginal, backClamped, width, height);
    const clamped = vec2(clamp(corrected.x, mn.x, mx.x), clamp(corrected.y, mn.y, mx.y));

    textureStore(velocityWrite, coord, vec4(clamped, float(0), float(1))).toWriteOnly();
  });

  return { compute: correctFn().compute(width * height), uniforms: { dt } };
}

export function createDyeMacCormackCorrectNode(
  velocityTex: THREE.StorageTexture,
  dyeOriginal: THREE.StorageTexture,
  dyeAdvected: THREE.StorageTexture,
  dyeWrite: THREE.StorageTexture,
  velWidth: number,
  velHeight: number,
  dyeWidth: number,
  dyeHeight: number
): MacCormackCompute {
  const dt = uniform(1.0 / 60.0);

  const correctFn = Fn(() => {
    const idx = instanceIndex;
    const x = idx.mod(int(dyeWidth));
    const y = idx.div(int(dyeWidth));
    const coord = ivec2(x, y);

    const dye0 = textureLoad(dyeOriginal, coord).xyz;
    const dye1 = textureLoad(dyeAdvected, coord).xyz;

    const pos = vec2(float(x).add(0.5), float(y).add(0.5));

    // Velocity sample in velocity grid space (bilinear)
    const velCoord = pos.mul(
      vec2(float(velWidth).div(float(dyeWidth)), float(velHeight).div(float(dyeHeight)))
    );
    const vel0 = bilinearSample(velocityTex, velCoord, velWidth, velHeight).xy;

    // Reverse advection sample: sample dye1 at pos + vel0*dt*dyeWidth
    const revPos = pos.add(vel0.mul(dt).mul(float(dyeWidth)));
    const revClamped = clamp(revPos, vec2(0.5), vec2(float(dyeWidth).sub(0.5), float(dyeHeight).sub(0.5)));
    const dye2 = bilinearSample(dyeAdvected, revClamped, dyeWidth, dyeHeight).xyz;

    const corrected = dye1.add(dye0.sub(dye2).mul(0.5));

    // Clamp against original neighborhood around forward backtrace position (pos - vel0*dt*dyeWidth)
    const backPos = pos.sub(vel0.mul(dt).mul(float(dyeWidth)));
    const backClamped = clamp(backPos, vec2(0.5), vec2(float(dyeWidth).sub(0.5), float(dyeHeight).sub(0.5)));
    const { mn, mx } = neighborhoodMinMax3(dyeOriginal, backClamped, dyeWidth, dyeHeight);
    const clamped = vec3(
      clamp(corrected.x, mn.x, mx.x),
      clamp(corrected.y, mn.y, mx.y),
      clamp(corrected.z, mn.z, mx.z)
    );

    textureStore(dyeWrite, coord, vec4(clamped, float(1))).toWriteOnly();
  });

  return { compute: correctFn().compute(dyeWidth * dyeHeight), uniforms: { dt } };
}
