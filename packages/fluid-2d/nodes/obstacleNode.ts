/**
 * @package fluid-2d/nodes
 * Obstacle Nodes - Paint obstacles and enforce solid regions
 *
 * Obstacles are represented as a scalar mask in the R channel:
 * - 0.0 = free fluid
 * - 1.0 = solid obstacle
 */

import * as THREE from 'three/webgpu';
import {
  Fn,
  If,
  Return,
  uniform,
  float,
  int,
  ivec2,
  vec2,
  vec4,
  exp,
  max,
  min,
  select,
  clamp,
  sqrt,
  instanceIndex,
  textureLoad,
  textureStore,
} from 'three/tsl';

export interface ObstacleSplatUniforms {
  splatPos: any;
  obstacleValue: any; // 0..1 (usually 1)
  radius: any;
  softness: any;
  falloff: any; // 0..3
  mode: any; // 0 paint, 1 erase
  blendMode: any; // 0 replace, 1 max, 2 add
  tileOrigin: any;
  cutoffDistSq: any;
}

export interface ObstacleSplatCompute {
  compute: any;
  uniforms: ObstacleSplatUniforms;
}

export function createObstacleSplatInPlaceTileNode(
  obstaclesTex: THREE.StorageTexture,
  width: number,
  height: number,
  tileSize = 32
): ObstacleSplatCompute {
  const splatPos = uniform(vec2(0.5, 0.5));
  const obstacleValue = uniform(1.0);
  const radius = uniform(0.02);
  const softness = uniform(1.0);
  const falloff = uniform(2); // 0..3
  const mode = uniform(0); // 0 paint, 1 erase
  const blendMode = uniform(0); // 0 replace, 1 max, 2 add

  const tileOrigin = uniform(ivec2(0, 0));
  const cutoffDistSq = uniform(0.0);

  const splatFn = Fn(() => {
    const idx = instanceIndex;
    const lx = idx.mod(int(tileSize));
    const ly = idx.div(int(tileSize));

    const x = tileOrigin.x.add(lx);
    const y = tileOrigin.y.add(ly);

    If(
      x.lessThan(int(0))
        .or(y.lessThan(int(0)))
        .or(x.greaterThanEqual(int(width)))
        .or(y.greaterThanEqual(int(height))),
      () => {
        Return();
      }
    );

    const coord = ivec2(x, y);

    const u = float(x).add(0.5).div(float(width));
    const v = float(y).add(0.5).div(float(height));

    const dx = u.sub(splatPos.x);
    const dy = v.sub(splatPos.y);
    const distSq = dx.mul(dx).add(dy.mul(dy));

    If(distSq.greaterThan(cutoffDistSq.max(float(0.0))), () => {
      Return();
    });

    const falloffI = int(falloff);
    const blendI = int(blendMode);
    const modeI = int(mode);

    const falloffK = select(
      falloffI.equal(int(3)),
      float(4.0),
      select(falloffI.equal(int(2)), float(2.0), select(falloffI.equal(int(1)), float(1.0), float(0.5)))
    );

    const r = radius.mul(softness.max(float(0.05)));
    const w = exp(distSq.negate().div(r.max(float(1e-6))).mul(falloffK));

    const current = textureLoad(obstaclesTex, coord).x;

    const paintValue = clamp(obstacleValue, float(0.0), float(1.0));
    const target = select(modeI.equal(int(1)), float(0.0), paintValue); // erase -> 0
    const signed = select(modeI.equal(int(1)), float(-1.0), float(1.0));

    const replace = current.mul(float(1.0).sub(w)).add(target.mul(w));
    const maxed = max(current, target.mul(w)); // erase doesn't max; it will keep current
    const added = clamp(current.add(paintValue.mul(w).mul(signed)), float(0.0), float(1.0));

    const out = select(blendI.equal(int(2)), added, select(blendI.equal(int(1)), maxed, replace));

    // In-place read+write to the same storage texture.
    textureStore(obstaclesTex, coord, vec4(out, float(0), float(0), float(1)));
  });

  return {
    compute: splatFn().compute(tileSize * tileSize),
    uniforms: { splatPos, obstacleValue, radius, softness, falloff, mode, blendMode, tileOrigin, cutoffDistSq },
  };
}

export interface ObstacleEnforceUniforms {
  threshold: any; // 0..1
}

export interface ObstacleEnforceCompute {
  compute: any;
  uniforms: ObstacleEnforceUniforms;
}

export function createObstacleEnforceVelocityNode(
  velocityReadTex: THREE.StorageTexture,
  obstaclesTex: THREE.StorageTexture,
  velocityWriteTex: THREE.StorageTexture,
  width: number,
  height: number
): ObstacleEnforceCompute {
  const threshold = uniform(0.5);

  const enforceFn = Fn(() => {
    const idx = instanceIndex;
    const x = idx.mod(int(width));
    const y = idx.div(int(width));
    const coord = ivec2(x, y);

    const obs = textureLoad(obstaclesTex, coord).x;
    const blocked = obs.greaterThan(threshold);

    const vel = textureLoad(velocityReadTex, coord).xy;
    const outVel = select(blocked, vec2(float(0.0), float(0.0)), vel);
    textureStore(velocityWriteTex, coord, vec4(outVel, float(0), float(1))).toWriteOnly();
  });

  return { compute: enforceFn().compute(width * height), uniforms: { threshold } };
}

export function createObstacleEnforceDyeNode(
  dyeReadTex: THREE.StorageTexture,
  obstaclesTex: THREE.StorageTexture,
  dyeWriteTex: THREE.StorageTexture,
  dyeWidth: number,
  dyeHeight: number,
  obstacleWidth: number,
  obstacleHeight: number
): ObstacleEnforceCompute {
  const threshold = uniform(0.5);

  const enforceFn = Fn(() => {
    const idx = instanceIndex;
    const x = idx.mod(int(dyeWidth));
    const y = idx.div(int(dyeWidth));
    const coord = ivec2(x, y);

    const ox = int(float(x).mul(float(obstacleWidth)).div(float(dyeWidth)));
    const oy = int(float(y).mul(float(obstacleHeight)).div(float(dyeHeight)));
    const obsCoord = ivec2(
      max(int(0), min(ox, int(obstacleWidth - 1))),
      max(int(0), min(oy, int(obstacleHeight - 1)))
    );

    const obs = textureLoad(obstaclesTex, obsCoord).x;
    const blocked = obs.greaterThan(threshold);

    const dye = textureLoad(dyeReadTex, coord);
    const outDye = select(blocked, vec4(float(0), float(0), float(0), float(1)), dye);
    textureStore(dyeWriteTex, coord, outDye).toWriteOnly();
  });

  return { compute: enforceFn().compute(dyeWidth * dyeHeight), uniforms: { threshold } };
}

export function createObstacleEnforceScalarNode(
  scalarReadTex: THREE.StorageTexture,
  obstaclesTex: THREE.StorageTexture,
  scalarWriteTex: THREE.StorageTexture,
  scalarWidth: number,
  scalarHeight: number,
  obstacleWidth: number,
  obstacleHeight: number
): ObstacleEnforceCompute {
  const threshold = uniform(0.5);

  const enforceFn = Fn(() => {
    const idx = instanceIndex;
    const x = idx.mod(int(scalarWidth));
    const y = idx.div(int(scalarWidth));
    const coord = ivec2(x, y);

    const ox = int(float(x).mul(float(obstacleWidth)).div(float(scalarWidth)));
    const oy = int(float(y).mul(float(obstacleHeight)).div(float(scalarHeight)));
    const obsCoord = ivec2(
      max(int(0), min(ox, int(obstacleWidth - 1))),
      max(int(0), min(oy, int(obstacleHeight - 1)))
    );

    const obs = textureLoad(obstaclesTex, obsCoord).x;
    const blocked = obs.greaterThan(threshold);

    const v = textureLoad(scalarReadTex, coord).x;
    const outV = select(blocked, float(0.0), v);
    textureStore(scalarWriteTex, coord, vec4(outV, float(0), float(0), float(1))).toWriteOnly();
  });

  return { compute: enforceFn().compute(scalarWidth * scalarHeight), uniforms: { threshold } };
}

