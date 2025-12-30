/**
 * @package fluid-2d/gizmos
 * LineGizmo - Advanced Interactive Gizmo for Line Emitters
 * 
 * Features:
 * - Start/End point handles
 * - Center position handle
 * - Rotation via endpoints
 * - Force visualization along line
 * - Length indicator
 */

import React, { useCallback, useRef, useState, useMemo } from 'react';
import type { GizmoProps, DragKind } from './types';
import type { LineEmitter } from '../emitters/types';
import type { Vec2 } from '../types';
import { deltaPxToWorld, getSimRectPx, pxToWorld, worldToPx } from './space';

// ============================================
// Utilities
// ============================================

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
const clamp01 = (v: number) => clamp(v, 0, 1);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const dist = (a: Vec2, b: Vec2) => Math.sqrt((b[0] - a[0]) ** 2 + (b[1] - a[1]) ** 2);

const color3ToHex = (c: [number, number, number]): string => {
  const [r, g, b] = c.map(v => Math.round(clamp(v, 0, 1) * 255).toString(16).padStart(2, '0'));
  return `#${r}${g}${b}`;
};

// ============================================
// Component
// ============================================

export const LineGizmo: React.FC<GizmoProps<LineEmitter>> = ({
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
  const [hover, setHover] = useState<'start' | 'end' | 'center' | 'line' | null>(null);
  const [drag, setDrag] = useState<DragKind>(null);
  const dragData = useRef<{ kind: string; startPx: Vec2; startVal: unknown } | null>(null);

  // Geometry
  const g = useMemo(() => {
    const simRect = getSimRectPx(canvasWidth, canvasHeight, textureAspect);
    const base = Math.min(simRect.w, simRect.h);
    const k = clamp(base / 900, 0.7, 1.4);
    return {
      k,
      handleR: 10 * k,
      handleHit: 20 * k,
      centerR: 12 * k,
      centerHit: 24 * k,
      lineWidth: 4 * k,
      lineHit: 12 * k,
    };
  }, [canvasWidth, canvasHeight, textureAspect]);

  const transform = manager.getWorldTransform(emitter.id);
  if (!transform || !enabled) return null;

  const emitterColor = color3ToHex(emitter.color);

  // Transform local to world
  const localToWorld = (local: Vec2): Vec2 => {
    const rad = (transform.rotation * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const sx = transform.scale[0];
    const sy = transform.scale[1];
    return [
      transform.position[0] + (local[0] * sx * cos - local[1] * sy * sin),
      transform.position[1] + (local[0] * sx * sin + local[1] * sy * cos),
    ];
  };

  const startWorld = localToWorld(emitter.start);
  const endWorld = localToWorld(emitter.end);
  const centerWorld = transform.position;

  const startPx = worldToPx(startWorld, canvasWidth, canvasHeight, textureAspect);
  const endPx = worldToPx(endWorld, canvasWidth, canvasHeight, textureAspect);
  const centerPx = worldToPx(centerWorld, canvasWidth, canvasHeight, textureAspect);

  const lineLength = dist(startPx, endPx);
  const midPx: Vec2 = [(startPx[0] + endPx[0]) / 2, (startPx[1] + endPx[1]) / 2];

  // Direction arrows along line
  const lineDirPx: Vec2 = lineLength > 0 
    ? [(endPx[0] - startPx[0]) / lineLength, (endPx[1] - startPx[1]) / lineLength] 
    : [1, 0];
  const perpPx: Vec2 = [-lineDirPx[1], lineDirPx[0]];

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
      } else if (kind === 'start' || kind === 'end') {
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
        let localX = (dx * cos - dy * sin) / transform.scale[0] * mult;
        let localY = (dx * sin + dy * cos) / transform.scale[1] * mult;
        
        if (snapToGrid || ev.shiftKey) {
          localX = Math.round(localX / gridSize) * gridSize;
          localY = Math.round(localY / gridSize) * gridSize;
        }

        const updates: Partial<LineEmitter> = kind === 'start'
          ? { start: [localX, localY] }
          : { end: [localX, localY] };
        manager.updateEmitter(emitter.id, updates);
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
  }, [emitter, manager, transform, snapToGrid, gridSize, textureAspect]);

  const isLocked = emitter.locked;
  const isActive = hover || drag;
  const showExpanded = selected || isActive;

  // Colors
  const primary = '#4ade80';
  const secondary = '#22c55e';

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
        <filter id={`glow-line-${emitter.id}`} x="-100%" y="-100%" width="300%" height="300%">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feColorMatrix in="blur" type="matrix" 
            values="0 0 0 0 0.29 0 0 0 0 0.87 0 0 0 0 0.50 0 0 0 0.8 0" />
          <feMerge><feMergeNode /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <marker id={`arrow-${emitter.id}`} markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto">
          <path d="M0,0 L6,3 L0,6 Z" fill={emitterColor} opacity="0.6" />
        </marker>
      </defs>

      {/* Line with glow on active */}
      <line
        x1={startPx[0]}
        y1={startPx[1]}
        x2={endPx[0]}
        y2={endPx[1]}
        stroke={isActive ? primary : emitterColor}
        strokeWidth={g.lineWidth}
        strokeLinecap="round"
        opacity={0.8}
        filter={isActive ? `url(#glow-line-${emitter.id})` : undefined}
      />

      {/* Flow direction arrows */}
      {showExpanded && lineLength > 60 && (
        <>
          {[0.25, 0.5, 0.75].map((t) => {
            const px = lerp(startPx[0], endPx[0], t);
            const py = lerp(startPx[1], endPx[1], t);
            const size = 6 * g.k;
            return (
              <polygon
                key={t}
                points={`${px + lineDirPx[0] * size},${py + lineDirPx[1] * size} ${px - lineDirPx[0] * size + perpPx[0] * size},${py - lineDirPx[1] * size + perpPx[1] * size} ${px - lineDirPx[0] * size - perpPx[0] * size},${py - lineDirPx[1] * size - perpPx[1] * size}`}
                fill={emitterColor}
                opacity={0.5}
              />
            );
          })}
        </>
      )}

      {/* Line hit area */}
      <line
        x1={startPx[0]}
        y1={startPx[1]}
        x2={endPx[0]}
        y2={endPx[1]}
        stroke="transparent"
        strokeWidth={g.lineHit}
        style={{ pointerEvents: 'all', cursor: isLocked ? 'not-allowed' : 'move' }}
        onPointerEnter={() => setHover('line')}
        onPointerLeave={() => setHover(null)}
        onPointerDown={(e) => startDrag('center', e, [...transform.position])}
      />

      {/* Start Handle */}
      <circle
        cx={startPx[0]}
        cy={startPx[1]}
        r={g.handleR}
        fill={hover === 'start' || drag === 'start' ? primary : 'rgba(74, 222, 128, 0.85)'}
        stroke="rgba(255,255,255,0.4)"
        strokeWidth={1.5}
        filter={hover === 'start' || drag === 'start' ? `url(#glow-line-${emitter.id})` : undefined}
      />
      <circle
        cx={startPx[0]}
        cy={startPx[1]}
        r={g.handleHit}
        fill="transparent"
        style={{ pointerEvents: 'all', cursor: isLocked ? 'not-allowed' : 'grab' }}
        onPointerEnter={() => setHover('start')}
        onPointerLeave={() => setHover(null)}
        onPointerDown={(e) => startDrag('start', e, [...emitter.start])}
      />

      {/* End Handle */}
      <circle
        cx={endPx[0]}
        cy={endPx[1]}
        r={g.handleR}
        fill={hover === 'end' || drag === 'end' ? primary : 'rgba(74, 222, 128, 0.85)'}
        stroke="rgba(255,255,255,0.4)"
        strokeWidth={1.5}
        filter={hover === 'end' || drag === 'end' ? `url(#glow-line-${emitter.id})` : undefined}
      />
      <circle
        cx={endPx[0]}
        cy={endPx[1]}
        r={g.handleHit}
        fill="transparent"
        style={{ pointerEvents: 'all', cursor: isLocked ? 'not-allowed' : 'grab' }}
        onPointerEnter={() => setHover('end')}
        onPointerLeave={() => setHover(null)}
        onPointerDown={(e) => startDrag('end', e, [...emitter.end])}
      />

      {/* Center Handle */}
      <circle
        cx={centerPx[0]}
        cy={centerPx[1]}
        r={g.centerR}
        fill="rgba(10, 12, 18, 0.7)"
        stroke={hover === 'center' || drag === 'move' ? primary : selected ? primary : 'rgba(255,255,255,0.5)'}
        strokeWidth={selected ? 2.5 : 2}
        filter={selected ? `url(#glow-line-${emitter.id})` : undefined}
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
            x={startPx[0]}
            y={startPx[1] - 16 * g.k}
            textAnchor="middle"
            fontSize={10 * g.k}
            fill="rgba(74, 222, 128, 0.7)"
            fontFamily="system-ui"
            fontWeight="500"
            style={{ pointerEvents: 'none' }}
          >
            START
          </text>
          <text
            x={endPx[0]}
            y={endPx[1] - 16 * g.k}
            textAnchor="middle"
            fontSize={10 * g.k}
            fill="rgba(74, 222, 128, 0.7)"
            fontFamily="system-ui"
            fontWeight="500"
            style={{ pointerEvents: 'none' }}
          >
            END
          </text>
          {/* Length indicator */}
          <text
            x={midPx[0] + perpPx[0] * 20 * g.k}
            y={midPx[1] + perpPx[1] * 20 * g.k}
            textAnchor="middle"
            fontSize={10 * g.k}
            fill="rgba(255,255,255,0.5)"
            fontFamily="system-ui"
            style={{ pointerEvents: 'none' }}
          >
            {(lineLength / Math.min(canvasWidth, canvasHeight)).toFixed(2)}
          </text>
        </>
      )}

      {/* Name label */}
      {selected && (
        <text
          x={centerPx[0]}
          y={centerPx[1] - g.centerR - 12 * g.k}
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

      {/* Locked indicator */}
      {isLocked && (
        <text
          x={centerPx[0]}
          y={centerPx[1] + g.centerR + 20 * g.k}
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

export default LineGizmo;
