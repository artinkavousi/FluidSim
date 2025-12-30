/**
 * @package fluid-2d/nodes
 * Boundary TSL Node - Simple "contain" boundary conditions
 */

import { Fn, If, Return, float, int, ivec2, instanceIndex, textureLoad, textureStore, vec4, clamp, select } from 'three/tsl';
import * as THREE from 'three/webgpu';

export interface BoundaryCompute {
  compute: any;
}

export function createVelocityBoundaryNode(
  velocityReadTex: THREE.StorageTexture,
  velocityWriteTex: THREE.StorageTexture,
  width: number,
  height: number
): BoundaryCompute {
  const boundaryFn = Fn(() => {
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
    const isEdge = isLeft.or(isRight).or(isBottom).or(isTop);

    // Copy from nearest interior cell and zero the normal component at the boundary.
    If(isEdge, () => {
      const ix = clamp(x, int(1), w2);
      const iy = clamp(y, int(1), h2);
      const sample = textureLoad(velocityReadTex, ivec2(ix, iy)).xy;

      const vx = select(isLeft.or(isRight), float(0.0), sample.x);
      const vy = select(isBottom.or(isTop), float(0.0), sample.y);

      textureStore(velocityWriteTex, coord, vec4(vx, vy, float(0), float(1))).toWriteOnly();
      Return();
    });

    textureStore(velocityWriteTex, coord, textureLoad(velocityReadTex, coord)).toWriteOnly();
  });

  return { compute: boundaryFn().compute(width * height) };
}

export function createDyeBoundaryNode(
  dyeReadTex: THREE.StorageTexture,
  dyeWriteTex: THREE.StorageTexture,
  width: number,
  height: number
): BoundaryCompute {
  const boundaryFn = Fn(() => {
    const idx = instanceIndex;
    const x = idx.mod(int(width));
    const y = idx.div(int(width));
    const coord = ivec2(x, y);

    const w2 = int(width).sub(int(2));
    const h2 = int(height).sub(int(2));

    const isEdge = x.lessThan(int(1)).or(x.greaterThan(w2)).or(y.lessThan(int(1))).or(y.greaterThan(h2));

    // Clamp-to-edge by copying the nearest interior cell (prevents a hard "black border").
    If(isEdge, () => {
      const ix = clamp(x, int(1), w2);
      const iy = clamp(y, int(1), h2);
      textureStore(dyeWriteTex, coord, textureLoad(dyeReadTex, ivec2(ix, iy))).toWriteOnly();
      Return();
    });

    textureStore(dyeWriteTex, coord, textureLoad(dyeReadTex, coord)).toWriteOnly();
  });

  return { compute: boundaryFn().compute(width * height) };
}

