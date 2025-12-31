/**
 * @package fluid-2d/nodes
 * Fuel + combustion/reaction nodes
 *
 * Fuel is a scalar (R channel). Combustion consumes fuel, generates heat (temperature),
 * and can inject emissive dye.
 */

import * as THREE from 'three/webgpu';
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
  max,
  min,
  sqrt,
  instanceIndex,
  textureLoad,
  textureStore,
  select,
} from 'three/tsl';

export interface FuelAdvectCompute {
  compute: any;
  uniforms: { dt: any; dissipation: any };
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

  const c00 = textureLoad(tex, ivec2(x0, y0)).x;
  const c10 = textureLoad(tex, ivec2(x1, y0)).x;
  const c01 = textureLoad(tex, ivec2(x0, y1)).x;
  const c11 = textureLoad(tex, ivec2(x1, y1)).x;

  const one = float(1.0);
  const c0 = c00.mul(one.sub(fx)).add(c10.mul(fx));
  const c1 = c01.mul(one.sub(fx)).add(c11.mul(fx));
  return c0.mul(one.sub(fy)).add(c1.mul(fy));
}

export function createFuelAdvectNode(
  velocityTex: THREE.StorageTexture,
  fuelRead: THREE.StorageTexture,
  fuelWrite: THREE.StorageTexture,
  velWidth: number,
  velHeight: number,
  fuelWidth: number,
  fuelHeight: number
): FuelAdvectCompute {
  const dt = uniform(1 / 60);
  const dissipation = uniform(0.99);

  const fn = Fn(() => {
    const idx = instanceIndex;
    const x = idx.mod(int(fuelWidth));
    const y = idx.div(int(fuelWidth));
    const coord = ivec2(x, y);

    const pos = vec2(float(x).add(0.5), float(y).add(0.5));
    const toVel = vec2(float(velWidth).div(float(fuelWidth)), float(velHeight).div(float(fuelHeight)));

    const vel0 = bilinearSample(velocityTex, pos.mul(toVel), velWidth, velHeight);
    const midPos = clamp(
      pos.sub(vel0.mul(dt).mul(float(fuelWidth)).mul(0.5)),
      vec2(0.5),
      vec2(float(fuelWidth).sub(0.5), float(fuelHeight).sub(0.5))
    );
    const velMid = bilinearSample(velocityTex, midPos.mul(toVel), velWidth, velHeight);
    const backPos = clamp(
      pos.sub(velMid.mul(dt).mul(float(fuelWidth))),
      vec2(0.5),
      vec2(float(fuelWidth).sub(0.5), float(fuelHeight).sub(0.5))
    );

    const sampled = bilinearSample(fuelRead, backPos, fuelWidth, fuelHeight);
    const out = clamp(sampled.mul(dissipation), float(0.0), float(10.0));
    textureStore(fuelWrite, coord, vec4(out, float(0), float(0), float(1))).toWriteOnly();
  });

  return { compute: fn().compute(fuelWidth * fuelHeight), uniforms: { dt, dissipation } };
}

export interface FuelSplatCompute {
  compute: any;
  uniforms: { splatPos: any; fuel: any; radius: any; softness: any; falloff: any; blendMode: any };
}

export function createFuelSplatNode(
  fuelRead: THREE.StorageTexture,
  fuelWrite: THREE.StorageTexture,
  width: number,
  height: number
): FuelSplatCompute {
  const splatPos = uniform(vec2(0.5, 0.5));
  const fuel = uniform(1.0);
  const radius = uniform(0.02);
  const softness = uniform(0.8);
  const falloff = uniform(2);
  const blendMode = uniform(0); // 0 add, 1 replace, 2 max

  const fn = Fn(() => {
    const idx = instanceIndex;
    const x = idx.mod(int(width));
    const y = idx.div(int(width));
    const coord = ivec2(x, y);

    const u = float(x).add(0.5).div(float(width));
    const v = float(y).add(0.5).div(float(height));

    const dx = u.sub(splatPos.x);
    const dy = v.sub(splatPos.y);
    const distSq = dx.mul(dx).add(dy.mul(dy));

    const falloffI = int(falloff);
    const blendI = int(blendMode);

    const falloffK = select(
      falloffI.equal(int(3)),
      float(4.0),
      select(falloffI.equal(int(2)), float(2.0), select(falloffI.equal(int(1)), float(1.0), float(0.5)))
    );

    const r = radius.mul(softness.max(float(0.05)));
    const w = distSq.negate().div(r.max(float(1e-6))).mul(falloffK).exp();

    const cur = textureLoad(fuelRead, coord).x;
    const add = cur.add(fuel.mul(w));
    const rep = mix(cur, fuel, w);
    const mx = max(cur, fuel.mul(w));
    const out = select(blendI.equal(int(2)), mx, select(blendI.equal(int(1)), rep, add));
    textureStore(fuelWrite, coord, vec4(clamp(out, float(0.0), float(10.0)), float(0), float(0), float(1))).toWriteOnly();
  });

  return { compute: fn().compute(width * height), uniforms: { splatPos, fuel, radius, softness, falloff, blendMode } };
}

export interface CombustionCompute {
  compute: any;
  uniforms: { dt: any; rate: any; igniteTemp: any; heatPerFuel: any; tempDamp: any };
}

/**
 * Updates fuel+temperature via a simple reaction:
 * burn = min(fuel, rate * dt * max(0, temp - igniteTemp))
 * fuel -= burn
 * temp += burn * heatPerFuel
 * temp *= tempDamp
 */
export function createCombustionNode(
  fuelRead: THREE.StorageTexture,
  tempRead: THREE.StorageTexture,
  fuelWrite: THREE.StorageTexture,
  tempWrite: THREE.StorageTexture,
  width: number,
  height: number
): CombustionCompute {
  const dt = uniform(1 / 60);
  const rate = uniform(1.0);
  const igniteTemp = uniform(0.25);
  const heatPerFuel = uniform(2.0);
  const tempDamp = uniform(0.995);

  const fn = Fn(() => {
    const idx = instanceIndex;
    const x = idx.mod(int(width));
    const y = idx.div(int(width));
    const coord = ivec2(x, y);

    const fuel = textureLoad(fuelRead, coord).x;
    const temp = textureLoad(tempRead, coord).x;

    const hot = max(float(0.0), temp.sub(igniteTemp));
    const want = rate.mul(dt).mul(hot);
    const burn = min(fuel, want);

    const outFuel = max(float(0.0), fuel.sub(burn));
    const outTemp = clamp(temp.add(burn.mul(heatPerFuel)).mul(tempDamp), float(0.0), float(10.0));

    textureStore(fuelWrite, coord, vec4(outFuel, float(0), float(0), float(1))).toWriteOnly();
    textureStore(tempWrite, coord, vec4(outTemp, float(0), float(0), float(1))).toWriteOnly();
  });

  return { compute: fn().compute(width * height), uniforms: { dt, rate, igniteTemp, heatPerFuel, tempDamp } };
}

export interface FireDyeCompute {
  compute: any;
  uniforms: { intensity: any; temperatureScale: any; colorA: any; colorB: any };
}

/**
 * Adds emissive dye based on temperature (simple fire coloring).
 */
export function createFireDyeNode(
  dyeRead: THREE.StorageTexture,
  tempTex: THREE.StorageTexture,
  dyeWrite: THREE.StorageTexture,
  dyeWidth: number,
  dyeHeight: number,
  tempWidth: number,
  tempHeight: number
): FireDyeCompute {
  const intensity = uniform(0.25);
  const temperatureScale = uniform(1.0);
  const colorA = uniform(vec3(1.0, 0.35, 0.05));
  const colorB = uniform(vec3(1.0, 0.95, 0.6));

  const fn = Fn(() => {
    const idx = instanceIndex;
    const x = idx.mod(int(dyeWidth));
    const y = idx.div(int(dyeWidth));
    const coord = ivec2(x, y);

    const tx = int(float(x).mul(float(tempWidth)).div(float(dyeWidth)));
    const ty = int(float(y).mul(float(tempHeight)).div(float(dyeHeight)));
    const tcoord = ivec2(
      max(int(0), min(tx, int(tempWidth - 1))),
      max(int(0), min(ty, int(tempHeight - 1)))
    );

    const t = clamp(textureLoad(tempTex, tcoord).x.mul(temperatureScale), float(0.0), float(1.0));
    const col = colorA.mul(float(1.0).sub(t)).add(colorB.mul(t));

    const dye = textureLoad(dyeRead, coord);
    const outRgb = dye.xyz.add(col.mul(intensity).mul(t));
    textureStore(dyeWrite, coord, vec4(outRgb, float(1.0))).toWriteOnly();
  });

  return { compute: fn().compute(dyeWidth * dyeHeight), uniforms: { intensity, temperatureScale, colorA, colorB } };
}

