/**
 * @package fluid-2d/nodes
 * Multigrid helper nodes (restriction, prolongation, residual)
 *
 * These are generic building blocks used by the (optional) multi-resolution pressure solver.
 */

import * as THREE from 'three/webgpu';
import {
  Fn,
  uniform,
  float,
  int,
  ivec2,
  vec4,
  floor,
  fract,
  mix,
  clamp,
  max,
  min,
  select,
  instanceIndex,
  textureLoad,
  textureStore,
} from 'three/tsl';

export interface ResidualCompute {
  compute: any;
  uniforms: { solid: any };
}

/**
 * Residual for Poisson: r = b - A p, where A is the discrete Laplacian.
 * Here, `rhsTex` is `b` (divergence) and `pressureTex` is `p`.
 */
export function createPressureResidualNode(
  pressureTex: THREE.StorageTexture,
  rhsTex: THREE.StorageTexture,
  residualTex: THREE.StorageTexture,
  width: number,
  height: number
): ResidualCompute {
  const solid = uniform(0);

  const fn = Fn(() => {
    const idx = instanceIndex;
    const x = idx.mod(int(width));
    const y = idx.div(int(width));
    const coord = ivec2(x, y);

    const w2 = int(width).sub(int(2));
    const h2 = int(height).sub(int(2));
    const isEdge = x.lessThan(int(1)).or(x.greaterThan(w2)).or(y.lessThan(int(1))).or(y.greaterThan(h2));
    const solidOn = int(solid).equal(int(1));

    const xL = max(x.sub(1), int(0));
    const xR = min(x.add(1), int(width - 1));
    const yB = max(y.sub(1), int(0));
    const yT = min(y.add(1), int(height - 1));

    const pC = textureLoad(pressureTex, coord).x;
    const pL = textureLoad(pressureTex, ivec2(xL, y)).x;
    const pR = textureLoad(pressureTex, ivec2(xR, y)).x;
    const pB = textureLoad(pressureTex, ivec2(x, yB)).x;
    const pT = textureLoad(pressureTex, ivec2(x, yT)).x;

    const lap = pL.add(pR).add(pB).add(pT).sub(pC.mul(float(4.0)));
    const b = textureLoad(rhsTex, coord).x;
    const r = b.sub(lap);
    const outR = select(solidOn.and(isEdge), float(0.0), r);

    textureStore(residualTex, coord, vec4(outR, float(0), float(0), float(1))).toWriteOnly();
  });

  return { compute: fn().compute(width * height), uniforms: { solid } };
}

export interface RestrictCompute {
  compute: any;
}

/**
 * Restrict (downsample) a scalar RHS field by 2x using a 2x2 average.
 * Assumes `coarseWidth`/`coarseHeight` correspond to the downsampled size.
 */
export function createRestrict2xNode(
  fineTex: THREE.StorageTexture,
  coarseTex: THREE.StorageTexture,
  fineWidth: number,
  fineHeight: number,
  coarseWidth: number,
  coarseHeight: number
): RestrictCompute {
  const fn = Fn(() => {
    const idx = instanceIndex;
    const x = idx.mod(int(coarseWidth));
    const y = idx.div(int(coarseWidth));
    const coord = ivec2(x, y);

    const fx0 = clamp(x.mul(int(2)), int(0), int(fineWidth - 1));
    const fy0 = clamp(y.mul(int(2)), int(0), int(fineHeight - 1));
    const fx1 = clamp(fx0.add(int(1)), int(0), int(fineWidth - 1));
    const fy1 = clamp(fy0.add(int(1)), int(0), int(fineHeight - 1));

    const a = textureLoad(fineTex, ivec2(fx0, fy0)).x;
    const b = textureLoad(fineTex, ivec2(fx1, fy0)).x;
    const c = textureLoad(fineTex, ivec2(fx0, fy1)).x;
    const d = textureLoad(fineTex, ivec2(fx1, fy1)).x;

    const avg = a.add(b).add(c).add(d).mul(float(0.25));
    textureStore(coarseTex, coord, vec4(avg, float(0), float(0), float(1))).toWriteOnly();
  });

  return { compute: fn().compute(coarseWidth * coarseHeight) };
}

export interface ProlongateAddCompute {
  compute: any;
  uniforms: { scale: any };
}

/**
 * Prolongate (upsample) a scalar coarse field and add it to a fine pressure field.
 * Uses bilinear sampling in coarse grid space.
 */
export function createProlongateAddNode(
  finePressureRead: THREE.StorageTexture,
  coarseTex: THREE.StorageTexture,
  finePressureWrite: THREE.StorageTexture,
  fineWidth: number,
  fineHeight: number,
  coarseWidth: number,
  coarseHeight: number
): ProlongateAddCompute {
  const scale = uniform(1.0);

  const fn = Fn(() => {
    const idx = instanceIndex;
    const x = idx.mod(int(fineWidth));
    const y = idx.div(int(fineWidth));
    const coord = ivec2(x, y);

    // Map fine pixel center to coarse pixel space (center-aligned).
    const u = float(x).add(0.5).div(float(fineWidth));
    const v = float(y).add(0.5).div(float(fineHeight));
    const cx = u.mul(float(coarseWidth)).sub(0.5);
    const cy = v.mul(float(coarseHeight)).sub(0.5);

    const fx = fract(cx);
    const fy = fract(cy);
    const ix = int(floor(cx));
    const iy = int(floor(cy));

    const x0 = clamp(ix, int(0), int(coarseWidth - 1));
    const y0 = clamp(iy, int(0), int(coarseHeight - 1));
    const x1 = clamp(ix.add(1), int(0), int(coarseWidth - 1));
    const y1 = clamp(iy.add(1), int(0), int(coarseHeight - 1));

    const c00 = textureLoad(coarseTex, ivec2(x0, y0)).x;
    const c10 = textureLoad(coarseTex, ivec2(x1, y0)).x;
    const c01 = textureLoad(coarseTex, ivec2(x0, y1)).x;
    const c11 = textureLoad(coarseTex, ivec2(x1, y1)).x;

    const one = float(1.0);
    const c0 = c00.mul(one.sub(fx)).add(c10.mul(fx));
    const c1 = c01.mul(one.sub(fx)).add(c11.mul(fx));
    const up = c0.mul(one.sub(fy)).add(c1.mul(fy));

    const p = textureLoad(finePressureRead, coord).x;
    const outP = p.add(up.mul(scale));
    textureStore(finePressureWrite, coord, vec4(outP, float(0), float(0), float(1))).toWriteOnly();
  });

  return { compute: fn().compute(fineWidth * fineHeight), uniforms: { scale } };
}

