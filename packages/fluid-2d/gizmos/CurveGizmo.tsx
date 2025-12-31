/**
 * @package fluid-2d/gizmos
 * CurveGizmo - Gizmo for curve emitter manipulation
 */

import React, { useCallback, useRef, useState, useMemo } from 'react';
import type { GizmoProps, DragKind } from './types';
import type { CurveEmitter } from '../emitters/types';
import type { Vec2 } from '../types';
import { deltaPxToWorld, getSimRectPx, pxToWorld, worldToPx } from './space';

// ============================================
// Utility Functions
// ============================================

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
const clamp01 = (v: number) => clamp(v, 0, 1);

// Bezier evaluation
const cubicBezier = (p0: Vec2, p1: Vec2, p2: Vec2, p3: Vec2, t: number): Vec2 => {
  const mt = 1 - t;
  const mt2 = mt * mt;
  const t2 = t * t;
  return [
    mt2 * mt * p0[0] + 3 * mt2 * t * p1[0] + 3 * mt * t2 * p2[0] + t2 * t * p3[0],
    mt2 * mt * p0[1] + 3 * mt2 * t * p1[1] + 3 * mt * t2 * p2[1] + t2 * t * p3[1],
  ];
};

const quadraticBezier = (p0: Vec2, p1: Vec2, p2: Vec2, t: number): Vec2 => {
  const mt = 1 - t;
  return [
    mt * mt * p0[0] + 2 * mt * t * p1[0] + t * t * p2[0],
    mt * mt * p0[1] + 2 * mt * t * p1[1] + t * t * p2[1],
  ];
};

// ============================================
// Component
// ============================================

export const CurveGizmo: React.FC<GizmoProps<CurveEmitter>> = ({
  emitter,
  manager,
  canvasWidth,
  canvasHeight,
  textureAspect = 1,
  selected,
  enabled = true,
  snapToGrid = false,
  gridSize = 0.05,
  style,
}) => {
  const surfaceRef = useRef<SVGSVGElement>(null);
  const [hovered, setHovered] = useState<number | 'center' | null>(null);
  const [dragging, setDragging] = useState<DragKind>(null);
  const dragRef = useRef<{
    kind: number | 'center';
    startPointerPx: Vec2;
    startValue: unknown;
  } | null>(null);

  const geom = useMemo(() => {
    const simRect = getSimRectPx(canvasWidth, canvasHeight, textureAspect);
    const base = Math.min(simRect.w, simRect.h);
    const k = clamp(base / 900, 0.75, 1.35);
    return { k, handleR: 7 * k, centerR: 10 * k };
  }, [canvasWidth, canvasHeight, textureAspect]);

  const transform = manager.getWorldTransform(emitter.id);
  if (!transform || !enabled) return null;

  // Transform local to world to screen
  const localToScreen = (local: Vec2): Vec2 => {
    const rad = (transform.rotation * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const sx = transform.scale[0];
    const sy = transform.scale[1];
    const worldX = transform.position[0] + (local[0] * sx * cos - local[1] * sy * sin);
    const worldY = transform.position[1] + (local[0] * sx * sin + local[1] * sy * cos);
    return worldToPx([worldX, worldY], canvasWidth, canvasHeight, textureAspect);
  };

  const centerPx = worldToPx(transform.position, canvasWidth, canvasHeight, textureAspect);
  const controlPointsPx = emitter.controlPoints.map(localToScreen);

  // Generate curve path
  const generateCurvePath = (): string => {
    if (controlPointsPx.length < 2) return '';
    
    const samples = 32;
    const pts: Vec2[] = [];
    
    for (let i = 0; i <= samples; i++) {
      const t = i / samples;
      let pt: Vec2;
      
      if (emitter.curveType === 'quadratic' && controlPointsPx.length >= 3) {
        pt = quadraticBezier(controlPointsPx[0], controlPointsPx[1], controlPointsPx[2], t);
      } else if (emitter.curveType === 'cubic' && controlPointsPx.length >= 4) {
        pt = cubicBezier(controlPointsPx[0], controlPointsPx[1], controlPointsPx[2], controlPointsPx[3], t);
      } else {
        // Linear fallback
        const idx = Math.min(Math.floor(t * (controlPointsPx.length - 1)), controlPointsPx.length - 2);
        const localT = t * (controlPointsPx.length - 1) - idx;
        const p0 = controlPointsPx[idx];
        const p1 = controlPointsPx[idx + 1];
        pt = [
          p0[0] + (p1[0] - p0[0]) * localT,
          p0[1] + (p1[1] - p0[1]) * localT,
        ];
      }
      pts.push(pt);
    }
    
    return pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p[0].toFixed(2)} ${p[1].toFixed(2)}`).join(' ');
  };

  // Handlers
  const handleCenterDrag = useCallback((e: React.PointerEvent) => {
    if (emitter.locked) return;
    e.preventDefault();
    e.stopPropagation();

    dragRef.current = {
      kind: 'center',
      startPointerPx: [e.clientX, e.clientY],
      startValue: [...transform.position],
    };
    setDragging('move');

    const handleMove = (ev: PointerEvent) => {
      if (!dragRef.current) return;
      const rect = surfaceRef.current?.getBoundingClientRect();
      if (!rect) return;

      const dWorld = deltaPxToWorld(
        [ev.clientX - dragRef.current.startPointerPx[0], ev.clientY - dragRef.current.startPointerPx[1]],
        rect.width,
        rect.height,
        textureAspect
      );
      const dx = dWorld[0];
      const dy = dWorld[1];
      const start = dragRef.current.startValue as Vec2;
      let x = clamp01(start[0] + dx);
      let y = clamp01(start[1] + dy);
      if (snapToGrid) {
        x = Math.round(x / gridSize) * gridSize;
        y = Math.round(y / gridSize) * gridSize;
      }
      manager.setEmitterPosition(emitter.id, x, y);
    };

    const handleUp = () => {
      dragRef.current = null;
      setDragging(null);
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
    };

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
  }, [emitter, manager, transform, snapToGrid, gridSize, textureAspect]);

  const handleControlPointDrag = useCallback((idx: number, e: React.PointerEvent) => {
    if (emitter.locked) return;
    e.preventDefault();
    e.stopPropagation();

    dragRef.current = {
      kind: idx,
      startPointerPx: [e.clientX, e.clientY],
      startValue: [...emitter.controlPoints[idx]],
    };
    setDragging('control' as DragKind);

    const handleMove = (ev: PointerEvent) => {
      if (!dragRef.current || typeof dragRef.current.kind !== 'number') return;
      const rect = surfaceRef.current?.getBoundingClientRect();
      if (!rect) return;

      const worldPos = pxToWorld(
        [ev.clientX - rect.left, ev.clientY - rect.top],
        rect.width,
        rect.height,
        textureAspect
      );
      if (!worldPos) return;
      
      // Convert to local coordinates
      const dx = worldPos[0] - transform.position[0];
      const dy = worldPos[1] - transform.position[1];
      const rad = -(transform.rotation * Math.PI) / 180;
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);
      let localX = (dx * cos - dy * sin) / transform.scale[0];
      let localY = (dx * sin + dy * cos) / transform.scale[1];
      
      if (snapToGrid) {
        localX = Math.round(localX / gridSize) * gridSize;
        localY = Math.round(localY / gridSize) * gridSize;
      }

      const newPoints = [...emitter.controlPoints];
      newPoints[dragRef.current.kind] = [localX, localY];
      manager.updateEmitter(emitter.id, { controlPoints: newPoints } as Partial<CurveEmitter>);
    };

    const handleUp = () => {
      dragRef.current = null;
      setDragging(null);
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
    };

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
  }, [emitter, manager, transform, snapToGrid, gridSize, textureAspect]);

  const isLocked = emitter.locked;
  const glowActive = hovered !== null || dragging;
  const curvePath = generateCurvePath();

  return (
    <svg
      ref={surfaceRef}
      width={canvasWidth}
      height={canvasHeight}
      viewBox={`0 0 ${canvasWidth} ${canvasHeight}`}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        overflow: 'visible',
        pointerEvents: 'none',
        ...style,
      }}
    >
      <defs>
        <filter id={`glow-curve-${emitter.id}`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feColorMatrix in="blur" type="matrix" values="0 0 0 0 0.6 0 0 0 0 0.3 0 0 0 0 0.9 0 0 0 0.8 0" result="tint" />
          <feMerge>
            <feMergeNode in="tint" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Curve path */}
      {curvePath && (
        <path
          d={curvePath}
          fill="transparent"
          stroke="rgba(150, 100, 220, 0.7)"
          strokeWidth={3 * geom.k}
          strokeLinecap="round"
          filter={glowActive ? `url(#glow-curve-${emitter.id})` : undefined}
        />
      )}

      {selected && (
        <>
          {/* Control point connections */}
          {controlPointsPx.map((pt, i) => {
            if (i === 0) return null;
            const prev = controlPointsPx[i - 1];
            return (
              <line
                key={`line-${i}`}
                x1={prev[0]}
                y1={prev[1]}
                x2={pt[0]}
                y2={pt[1]}
                stroke="rgba(255,255,255,0.15)"
                strokeWidth={1}
                strokeDasharray="3 3"
              />
            );
          })}

          {/* Control points */}
          {controlPointsPx.map((pt, i) => (
            <g key={`cp-${i}`}>
              <circle
                cx={pt[0]}
                cy={pt[1]}
                r={geom.handleR}
                fill={hovered === i ? 'rgba(150, 100, 220, 0.95)' : 'rgba(150, 100, 220, 0.75)'}
                stroke="rgba(255,255,255,0.3)"
                strokeWidth={1}
              />
              <circle
                cx={pt[0]}
                cy={pt[1]}
                r={geom.handleR * 2.5}
                fill="transparent"
                style={{ pointerEvents: 'all', cursor: isLocked ? 'not-allowed' : 'grab' }}
                onPointerEnter={() => setHovered(i)}
                onPointerLeave={() => setHovered(null)}
                onPointerDown={(e) => handleControlPointDrag(i, e)}
              />
              <text
                x={pt[0] + 10 * geom.k}
                y={pt[1] - 8 * geom.k}
                fontSize={9 * geom.k}
                fill="rgba(255,255,255,0.3)"
                style={{ pointerEvents: 'none' }}
              >
                P{i}
              </text>
            </g>
          ))}
        </>
      )}

      {/* Center handle */}
      <circle
        cx={centerPx[0]}
        cy={centerPx[1]}
        r={geom.centerR}
        fill="rgba(255,255,255,0.12)"
        stroke="rgba(255,255,255,0.35)"
        strokeWidth={1.5}
      />
      <circle
        cx={centerPx[0]}
        cy={centerPx[1]}
        r={geom.centerR * 2}
        fill="transparent"
        style={{ pointerEvents: 'all', cursor: isLocked ? 'not-allowed' : 'move' }}
        onPointerEnter={() => setHovered('center')}
        onPointerLeave={() => setHovered(null)}
        onPointerDown={handleCenterDrag}
      />

      {isLocked && (
        <text
          x={centerPx[0]}
          y={centerPx[1] + geom.centerR + 18 * geom.k}
          textAnchor="middle"
          fontSize={10 * geom.k}
          fill="rgba(255,255,255,0.40)"
          style={{ pointerEvents: 'none' }}
        >
          LOCKED
        </text>
      )}
    </svg>
  );
};

export default CurveGizmo;


