/**
 * @package fluid-2d/gizmos
 * CircleGizmo - Advanced Interactive Gizmo for Circle Emitters
 * 
 * Features:
 * - Center position handle
 * - Radius adjustment handle
 * - Arc start/end handles
 * - Direction indicators (inward/outward)
 * - Inner radius for ring emitters
 */

import React, { useCallback, useRef, useState, useMemo } from 'react';
import type { GizmoProps, DragKind } from './types';
import type { CircleEmitter } from '../emitters/types';
import type { Vec2 } from '../types';
import { deltaPxToWorld, getSimRectPx, worldToPx } from './space';

// ============================================
// Utilities
// ============================================

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
const clamp01 = (v: number) => clamp(v, 0, 1);
const deg = (d: number) => (d * Math.PI) / 180;
const radToDeg = (r: number) => (r * 180) / Math.PI;

const arcPoint = (c: Vec2, r: number, a: number): Vec2 => [c[0] + Math.cos(a) * r, c[1] + Math.sin(a) * r];

const svgArc = (c: Vec2, r: number, s: number, e: number, large = false): string => {
  const p0 = arcPoint(c, r, s);
  const p1 = arcPoint(c, r, e);
  const sweep = e - s;
  const lg = large || Math.abs(sweep) > Math.PI ? 1 : 0;
  return `M ${p0[0].toFixed(1)} ${p0[1].toFixed(1)} A ${r.toFixed(1)} ${r.toFixed(1)} 0 ${lg} 1 ${p1[0].toFixed(1)} ${p1[1].toFixed(1)}`;
};

const color3ToHex = (c: [number, number, number]): string => {
  const [r, g, b] = c.map(v => Math.round(clamp(v, 0, 1) * 255).toString(16).padStart(2, '0'));
  return `#${r}${g}${b}`;
};

// ============================================
// Component
// ============================================

export const CircleGizmo: React.FC<GizmoProps<CircleEmitter>> = ({
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
  const svgRef = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<'center' | 'radius' | 'arcStart' | 'arcEnd' | 'circle' | null>(null);
  const [drag, setDrag] = useState<DragKind>(null);
  const dragData = useRef<{ kind: string; startPx: Vec2; startVal: unknown } | null>(null);

  // Geometry
  const g = useMemo(() => {
    const simRect = getSimRectPx(canvasWidth, canvasHeight, textureAspect);
    const base = Math.min(simRect.w, simRect.h);
    const k = clamp(base / 900, 0.7, 1.4);
    return {
      k,
      centerR: 12 * k,
      centerHit: 24 * k,
      handleR: 9 * k,
      handleHit: 18 * k,
      strokeW: 3 * k,
      hitW: 14 * k,
    };
  }, [canvasWidth, canvasHeight, textureAspect]);

  const transform = manager.getWorldTransform(emitter.id);
  if (!transform || !enabled) return null;

  const emitterColor = color3ToHex(emitter.color);
  const centerPx = worldToPx(transform.position, canvasWidth, canvasHeight, textureAspect);
  const simBase = Math.min(getSimRectPx(canvasWidth, canvasHeight, textureAspect).w, getSimRectPx(canvasWidth, canvasHeight, textureAspect).h);
  
  // Radius in pixels
  const outerRadiusPx = emitter.outerRadius * simBase;
  const innerRadiusPx = (emitter.innerRadius || 0) * simBase;
  
  // Arc angles (screen space uses Y-down)
  const [arcStartDeg, arcEndDeg] = emitter.arc;
  const arcStart = deg(arcStartDeg);
  const arcEnd = deg(arcEndDeg);
  const isFullCircle = arcStartDeg === 0 && arcEndDeg === 360;

  // Handle positions
  const radiusHandlePx = arcPoint(centerPx, outerRadiusPx, 0);
  const arcStartHandlePx = arcPoint(centerPx, outerRadiusPx, arcStart);
  const arcEndHandlePx = arcPoint(centerPx, outerRadiusPx, arcEnd);

  // Direction arrows
  const arrowAngles = [0, 90, 180, 270].map(d => deg(d));

  // ============================================
  // Drag Handlers
  // ============================================

  const startDrag = useCallback((kind: string, e: React.PointerEvent, startVal: unknown) => {
    if (emitter.locked) return;
    e.preventDefault();
    e.stopPropagation();
    manager.select(emitter.id);

    dragData.current = { kind, startPx: [e.clientX, e.clientY], startVal };
    setDrag(kind as DragKind);

    const onMove = (ev: PointerEvent) => {
      if (!dragData.current || !svgRef.current) return;
      const rect = svgRef.current.getBoundingClientRect();
      const mult = ev.altKey ? 0.25 : 1;

      if (kind === 'center') {
        const dWorld = deltaPxToWorld(
          [ev.clientX - dragData.current.startPx[0], ev.clientY - dragData.current.startPx[1]],
          rect.width,
          rect.height,
          textureAspect
        );
        const dx = dWorld[0] * mult;
        const dy = dWorld[1] * mult;
        const start = dragData.current.startVal as Vec2;
        let x = clamp01(start[0] + dx);
        let y = clamp01(start[1] + dy);
        if (snapToGrid || ev.shiftKey) {
          x = Math.round(x / gridSize) * gridSize;
          y = Math.round(y / gridSize) * gridSize;
        }
        manager.setEmitterPosition(emitter.id, x, y);
      } else if (kind === 'radius') {
        const px = ev.clientX - rect.left;
        const py = ev.clientY - rect.top;
        const dx = px - centerPx[0];
        const dy = py - centerPx[1];
        const distPx = Math.sqrt(dx * dx + dy * dy);
        const simRect = getSimRectPx(rect.width, rect.height, textureAspect);
        const worldRadius = distPx / Math.min(simRect.w, simRect.h);
        manager.updateEmitter(emitter.id, {
          outerRadius: clamp(worldRadius * mult, 0.02, 0.5),
        } as Partial<CircleEmitter>);
      } else if (kind === 'arcStart' || kind === 'arcEnd') {
        const px = ev.clientX - rect.left;
        const py = ev.clientY - rect.top;
        const angle = Math.atan2(py - centerPx[1], px - centerPx[0]);
        const angleDeg = -radToDeg(angle);
        const normalizedDeg = ((angleDeg % 360) + 360) % 360;
        
        if (kind === 'arcStart') {
          manager.updateEmitter(emitter.id, {
            arc: [normalizedDeg, emitter.arc[1]],
          } as Partial<CircleEmitter>);
        } else {
          manager.updateEmitter(emitter.id, {
            arc: [emitter.arc[0], normalizedDeg],
          } as Partial<CircleEmitter>);
        }
      }
    };

    const onUp = () => {
      dragData.current = null;
      setDrag(null);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }, [emitter, manager, centerPx, snapToGrid, gridSize, textureAspect]);

  const isLocked = emitter.locked;
  const isActive = hover || drag;
  const showExpanded = selected || isActive;

  // Colors
  const primary = '#60a5fa';
  const secondary = '#3b82f6';

  return (
    <svg
      ref={svgRef}
      width={canvasWidth}
      height={canvasHeight}
      viewBox={`0 0 ${canvasWidth} ${canvasHeight}`}
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        overflow: 'visible',
        ...style,
      }}
    >
      <defs>
        <filter id={`glow-circle-${emitter.id}`} x="-100%" y="-100%" width="300%" height="300%">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feColorMatrix in="blur" type="matrix" 
            values="0 0 0 0 0.38 0 0 0 0 0.65 0 0 0 0 0.98 0 0 0 0.8 0" />
          <feMerge><feMergeNode /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      {/* Outer circle - dashed background */}
      <circle
        cx={centerPx[0]}
        cy={centerPx[1]}
        r={outerRadiusPx}
        fill="transparent"
        stroke="rgba(255,255,255,0.15)"
        strokeWidth={1.5 * g.k}
        strokeDasharray="6 4"
      />

      {/* Inner circle (if ring emitter) */}
      {innerRadiusPx > 0 && (
        <circle
          cx={centerPx[0]}
          cy={centerPx[1]}
          r={innerRadiusPx}
          fill="transparent"
          stroke="rgba(255,255,255,0.1)"
          strokeWidth={1 * g.k}
          strokeDasharray="4 4"
        />
      )}

      {/* Active arc or full circle */}
      {isFullCircle ? (
        <circle
          cx={centerPx[0]}
          cy={centerPx[1]}
          r={outerRadiusPx}
          fill="transparent"
          stroke={isActive ? primary : emitterColor}
          strokeWidth={g.strokeW}
          opacity={0.8}
          filter={isActive ? `url(#glow-circle-${emitter.id})` : undefined}
        />
      ) : (
        <path
          d={svgArc(centerPx, outerRadiusPx, arcStart, arcEnd, Math.abs(arcEndDeg - arcStartDeg) > 180)}
          fill="transparent"
          stroke={isActive ? primary : emitterColor}
          strokeWidth={g.strokeW}
          strokeLinecap="round"
          opacity={0.8}
          filter={isActive ? `url(#glow-circle-${emitter.id})` : undefined}
        />
      )}

      {/* Circle hit area */}
      <circle
        cx={centerPx[0]}
        cy={centerPx[1]}
        r={outerRadiusPx}
        fill="transparent"
        stroke="transparent"
        strokeWidth={g.hitW}
        style={{ pointerEvents: 'all', cursor: isLocked ? 'not-allowed' : 'move' }}
        onPointerEnter={() => setHover('circle')}
        onPointerLeave={() => setHover(null)}
        onPointerDown={(e) => startDrag('center', e, [...transform.position])}
      />

      {/* Direction arrows */}
      {showExpanded && arrowAngles.map((angle, i) => {
        const innerPt = arcPoint(centerPx, outerRadiusPx * (emitter.inward ? 1 : 0.85), angle);
        const outerPt = arcPoint(centerPx, outerRadiusPx * (emitter.inward ? 0.7 : 1.15), angle);
        const midPt = arcPoint(centerPx, outerRadiusPx * (emitter.inward ? 0.85 : 1), angle);
        const perpAngle = angle + Math.PI / 2;
        const arrowSize = 5 * g.k;
        
        return (
          <g key={i}>
            <line
              x1={innerPt[0]}
              y1={innerPt[1]}
              x2={outerPt[0]}
              y2={outerPt[1]}
              stroke={emitter.inward ? '#f97316' : '#22d3ee'}
              strokeWidth={2 * g.k}
              opacity={0.5}
            />
            {/* Arrow head */}
            <polygon
              points={`
                ${outerPt[0]},${outerPt[1]}
                ${midPt[0] + Math.cos(perpAngle) * arrowSize},${midPt[1] + Math.sin(perpAngle) * arrowSize}
                ${midPt[0] - Math.cos(perpAngle) * arrowSize},${midPt[1] - Math.sin(perpAngle) * arrowSize}
              `}
              fill={emitter.inward ? '#f97316' : '#22d3ee'}
              opacity={0.5}
            />
          </g>
        );
      })}

      {/* Radius Handle */}
      <circle
        cx={radiusHandlePx[0]}
        cy={radiusHandlePx[1]}
        r={g.handleR}
        fill={hover === 'radius' || drag === 'radius' ? primary : 'rgba(96, 165, 250, 0.85)'}
        stroke="rgba(255,255,255,0.4)"
        strokeWidth={1.5}
        filter={hover === 'radius' || drag === 'radius' ? `url(#glow-circle-${emitter.id})` : undefined}
      />
      <circle
        cx={radiusHandlePx[0]}
        cy={radiusHandlePx[1]}
        r={g.handleHit}
        fill="transparent"
        style={{ pointerEvents: 'all', cursor: isLocked ? 'not-allowed' : 'ew-resize' }}
        onPointerEnter={() => setHover('radius')}
        onPointerLeave={() => setHover(null)}
        onPointerDown={(e) => startDrag('radius', e, emitter.outerRadius)}
      />

      {/* Arc handles (if not full circle) */}
      {!isFullCircle && showExpanded && (
        <>
          {/* Arc Start Handle */}
          <circle
            cx={arcStartHandlePx[0]}
            cy={arcStartHandlePx[1]}
            r={g.handleR * 0.9}
            fill={hover === 'arcStart' || drag === 'arcStart' ? '#4ade80' : 'rgba(74, 222, 128, 0.85)'}
            stroke="rgba(255,255,255,0.4)"
            strokeWidth={1.5}
          />
          <circle
            cx={arcStartHandlePx[0]}
            cy={arcStartHandlePx[1]}
            r={g.handleHit}
            fill="transparent"
            style={{ pointerEvents: 'all', cursor: isLocked ? 'not-allowed' : 'grab' }}
            onPointerEnter={() => setHover('arcStart')}
            onPointerLeave={() => setHover(null)}
            onPointerDown={(e) => startDrag('arcStart', e, arcStartDeg)}
          />

          {/* Arc End Handle */}
          <circle
            cx={arcEndHandlePx[0]}
            cy={arcEndHandlePx[1]}
            r={g.handleR * 0.9}
            fill={hover === 'arcEnd' || drag === 'arcEnd' ? '#f97316' : 'rgba(249, 115, 22, 0.85)'}
            stroke="rgba(255,255,255,0.4)"
            strokeWidth={1.5}
          />
          <circle
            cx={arcEndHandlePx[0]}
            cy={arcEndHandlePx[1]}
            r={g.handleHit}
            fill="transparent"
            style={{ pointerEvents: 'all', cursor: isLocked ? 'not-allowed' : 'grab' }}
            onPointerEnter={() => setHover('arcEnd')}
            onPointerLeave={() => setHover(null)}
            onPointerDown={(e) => startDrag('arcEnd', e, arcEndDeg)}
          />
        </>
      )}

      {/* Center Handle */}
      <circle
        cx={centerPx[0]}
        cy={centerPx[1]}
        r={g.centerR}
        fill="rgba(10, 12, 18, 0.7)"
        stroke={hover === 'center' || drag === 'move' ? primary : selected ? primary : 'rgba(255,255,255,0.5)'}
        strokeWidth={selected ? 2.5 : 2}
        filter={selected ? `url(#glow-circle-${emitter.id})` : undefined}
      />
      <circle
        cx={centerPx[0]}
        cy={centerPx[1]}
        r={g.centerHit}
        fill="transparent"
        style={{ pointerEvents: 'all', cursor: isLocked ? 'not-allowed' : 'move' }}
        onPointerEnter={() => setHover('center')}
        onPointerLeave={() => setHover(null)}
        onPointerDown={(e) => startDrag('center', e, [...transform.position])}
      />

      {/* Labels */}
      {showExpanded && (
        <>
          <text
            x={radiusHandlePx[0] + 14 * g.k}
            y={radiusHandlePx[1] + 4 * g.k}
            fontSize={10 * g.k}
            fill={primary}
            fontFamily="system-ui"
            fontWeight="500"
            style={{ pointerEvents: 'none' }}
          >
            R: {emitter.outerRadius.toFixed(2)}
          </text>
          {!isFullCircle && (
            <>
              <text
                x={arcStartHandlePx[0] + 14 * g.k}
                y={arcStartHandlePx[1]}
                fontSize={9 * g.k}
                fill="rgba(74, 222, 128, 0.7)"
                fontFamily="system-ui"
                style={{ pointerEvents: 'none' }}
              >
                {arcStartDeg.toFixed(0)}°
              </text>
              <text
                x={arcEndHandlePx[0] + 14 * g.k}
                y={arcEndHandlePx[1]}
                fontSize={9 * g.k}
                fill="rgba(249, 115, 22, 0.7)"
                fontFamily="system-ui"
                style={{ pointerEvents: 'none' }}
              >
                {arcEndDeg.toFixed(0)}°
              </text>
            </>
          )}
        </>
      )}

      {/* Name label */}
      {selected && (
        <text
          x={centerPx[0]}
          y={centerPx[1] - outerRadiusPx - 12 * g.k}
          textAnchor="middle"
          fontSize={11 * g.k}
          fill="rgba(255,255,255,0.6)"
          fontFamily="system-ui"
          fontWeight="500"
          style={{ pointerEvents: 'none' }}
        >
          {emitter.name}
        </text>
      )}

      {/* Direction mode label */}
      {showExpanded && (
        <text
          x={centerPx[0]}
          y={centerPx[1] + outerRadiusPx + 18 * g.k}
          textAnchor="middle"
          fontSize={9 * g.k}
          fill={emitter.inward ? '#f97316' : '#22d3ee'}
          fontFamily="system-ui"
          fontWeight="500"
          style={{ pointerEvents: 'none' }}
        >
          {emitter.inward ? '⬅ INWARD' : 'OUTWARD ➡'}
        </text>
      )}

      {/* Locked indicator */}
      {isLocked && (
        <text
          x={centerPx[0]}
          y={centerPx[1] + outerRadiusPx + 32 * g.k}
          textAnchor="middle"
          fontSize={9 * g.k}
          fill="rgba(255,255,255,0.4)"
          fontFamily="system-ui"
          style={{ pointerEvents: 'none' }}
        >
          🔒 LOCKED
        </text>
      )}
    </svg>
  );
};

export default CircleGizmo;
