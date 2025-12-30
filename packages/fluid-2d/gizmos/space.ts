/**
 * @package fluid-2d/gizmos
 * Screen/simulation space mapping helpers.
 *
 * The renderer uses an aspect-correct "contain" fit (letterboxing) so the sim is not stretched.
 * Gizmos must map through the same fitted sim-rect to stay aligned with splats/emitters.
 */

import type { Vec2 } from '../types';

export interface SimRectPx {
  x0: number; // left
  y0: number; // top
  w: number;  // width
  h: number;  // height
}

export function getSimRectPx(
  canvasWidth: number,
  canvasHeight: number,
  textureAspect: number = 1
): SimRectPx {
  const viewW = Math.max(1e-6, canvasWidth);
  const viewH = Math.max(1e-6, canvasHeight);
  const texAspect = textureAspect || 1;
  const viewAspect = viewW / viewH;

  if (Math.abs(viewAspect - texAspect) < 1e-6) {
    return { x0: 0, y0: 0, w: viewW, h: viewH };
  }

  if (viewAspect > texAspect) {
    // Wider viewport -> letterbox left/right.
    const simH = viewH;
    const simW = simH * texAspect;
    return { x0: (viewW - simW) * 0.5, y0: 0, w: simW, h: simH };
  }

  // Taller viewport -> letterbox top/bottom.
  const simW = viewW;
  const simH = simW / texAspect;
  return { x0: 0, y0: (viewH - simH) * 0.5, w: simW, h: simH };
}

/**
 * Convert sim-normalized world coordinates (0..1, Y-up) to gizmo pixels (SVG, Y-down).
 */
export function worldToPx(
  world: Vec2,
  canvasWidth: number,
  canvasHeight: number,
  textureAspect: number = 1
): Vec2 {
  const r = getSimRectPx(canvasWidth, canvasHeight, textureAspect);
  return [r.x0 + world[0] * r.w, r.y0 + world[1] * r.h];
}

/**
 * Convert gizmo pixels (SVG, Y-down) to sim-normalized world coordinates (0..1, Y-up).
 * Returns null if the point is outside the sim-rect (in the letterbox region).
 */
export function pxToWorld(
  px: Vec2,
  canvasWidth: number,
  canvasHeight: number,
  textureAspect: number = 1
): Vec2 | null {
  const r = getSimRectPx(canvasWidth, canvasHeight, textureAspect);
  const x = (px[0] - r.x0) / r.w;
  const y = (px[1] - r.y0) / r.h;
  if (x < 0 || x > 1 || y < 0 || y > 1) return null;
  return [x, y];
}

/**
 * Convert pixel delta (Y-down) to world delta (Y-up) in normalized sim space.
 */
export function deltaPxToWorld(
  deltaPx: Vec2,
  canvasWidth: number,
  canvasHeight: number,
  textureAspect: number = 1
): Vec2 {
  const r = getSimRectPx(canvasWidth, canvasHeight, textureAspect);
  return [deltaPx[0] / r.w, deltaPx[1] / r.h];
}
