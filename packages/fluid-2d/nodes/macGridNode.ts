/**
 * @package fluid-2d/nodes
 * MAC-grid projection nodes (staggered-style divergence and pressure gradient)
 *
 * This mode reinterprets the existing `velocity` RG texture as a staggered layout:
 * - `velocity.x` acts like the u component on vertical faces
 * - `velocity.y` acts like the v component on horizontal faces
 *
 * While stored in a single texture for simplicity, the projection (divergence + gradient subtract)
 * uses forward/backward differences appropriate for a MAC-style discretization.
 */

import * as THREE from 'three/webgpu';
import {
  Fn,
  uniform,
  float,
  int,
  ivec2,
  vec2,
  vec4,
  instanceIndex,
  textureLoad,
  textureStore,
  max,
  min,
  clamp,
  select,
} from 'three/tsl';

export interface MacDivergenceCompute {
  compute: any;
  uniforms: { solid: any };
}

export function createMacDivergenceNode(
  velocityTex: THREE.StorageTexture,
  divergenceTex: THREE.StorageTexture,
  width: number,
  height: number
): MacDivergenceCompute {
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

    // Treat vel.x as u on vertical faces and vel.y as v on horizontal faces.
    // Divergence at cell center (x,y):
    // div = -(u(x+1,y)-u(x,y) + v(x,y+1)-v(x,y))
    const xR = min(x.add(1), int(width - 1));
    const yT = min(y.add(1), int(height - 1));

    const uL = textureLoad(velocityTex, coord).x;
    const uR = textureLoad(velocityTex, ivec2(xR, y)).x;
    const vB = textureLoad(velocityTex, coord).y;
    const vT = textureLoad(velocityTex, ivec2(x, yT)).y;

    const div = uR.sub(uL).add(vT.sub(vB)).negate();
    const outDiv = select(solidOn.and(isEdge), float(0.0), div);

    textureStore(divergenceTex, coord, vec4(outDiv, float(0), float(0), float(1))).toWriteOnly();
  });

  return { compute: fn().compute(width * height), uniforms: { solid } };
}

export interface MacGradientSubtractCompute {
  compute: any;
  uniforms: { solid: any };
}

export function createMacGradientSubtractNode(
  velocityReadTex: THREE.StorageTexture,
  pressureTex: THREE.StorageTexture,
  velocityWriteTex: THREE.StorageTexture,
  width: number,
  height: number
): MacGradientSubtractCompute {
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

    // Backward differences map pressure gradient onto faces.
    const xL = max(x.sub(1), int(0));
    const yB = max(y.sub(1), int(0));

    const pC = textureLoad(pressureTex, coord).x;
    const pL = textureLoad(pressureTex, ivec2(xL, y)).x;
    const pB = textureLoad(pressureTex, ivec2(x, yB)).x;

    // u(x,y) -= p(x,y)-p(x-1,y)
    // v(x,y) -= p(x,y)-p(x,y-1)
    const gradU = pC.sub(pL);
    const gradV = pC.sub(pB);

    const vel = textureLoad(velocityReadTex, coord);
    const outU = vel.x.sub(gradU);
    const outV = vel.y.sub(gradV);

    // Enforce solid edges when containFluid is on: zero both components at the boundary.
    const out = select(solidOn.and(isEdge), vec2(float(0.0), float(0.0)), vec2(outU, outV));
    textureStore(velocityWriteTex, coord, vec4(out, float(0), float(1))).toWriteOnly();
  });

  return { compute: fn().compute(width * height), uniforms: { solid } };
}

export interface MacVelocityBoundaryCompute {
  compute: any;
}

/**
 * Simple MAC boundary clamp:
 * - u = 0 at left/right edges
 * - v = 0 at bottom/top edges
 * Copies interior values for the tangential component to reduce seams.
 */
export function createMacVelocityBoundaryNode(
  velocityReadTex: THREE.StorageTexture,
  velocityWriteTex: THREE.StorageTexture,
  width: number,
  height: number
): MacVelocityBoundaryCompute {
  const fn = Fn(() => {
    const idx = instanceIndex;
    const x = idx.mod(int(width));
    const y = idx.div(int(width));
    const coord = ivec2(x, y);

    const w2 = int(width).sub(int(2));
    const h2 = int(height).sub(int(2));

    const isLeft = x.lessThan(int(1));
    const isRight = x.greaterThan(w2);
    const isBottom = y.lessThan(int(1));
    const isTop = y.greaterThan(h2);

    const ix = clamp(x, int(1), w2);
    const iy = clamp(y, int(1), h2);
    const sample = textureLoad(velocityReadTex, ivec2(ix, iy)).xy;

    const cur = textureLoad(velocityReadTex, coord).xy;
    const u = select(isLeft.or(isRight), float(0.0), sample.x);
    const v = select(isBottom.or(isTop), float(0.0), sample.y);

    // If not on any edge, keep original.
    const isEdge = isLeft.or(isRight).or(isBottom).or(isTop);
    const out = select(isEdge, vec2(u, v), cur);
    textureStore(velocityWriteTex, coord, vec4(out, float(0), float(1))).toWriteOnly();
  });

  return { compute: fn().compute(width * height) };
}

