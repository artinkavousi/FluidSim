/**
 * @package fluid-2d/gizmos
 * BrushGizmo - Gizmo for brush emitter manipulation
 */

import React, { useCallback, useRef, useState, useMemo } from 'react';
import type { GizmoProps, DragKind } from './types';
import type { BrushEmitter } from '../emitters/types';
import type { Vec2 } from '../types';
import { deltaPxToWorld, getSimRectPx, worldToPx } from './space';

// ============================================
// Utility Functions
// ============================================

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
const clamp01 = (v: number) => clamp(v, 0, 1);

// ============================================
// Component
// ============================================

export const BrushGizmo: React.FC<GizmoProps<BrushEmitter>> = ({
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
  const [hovered, setHovered] = useState<'center' | 'scale' | null>(null);
  const [dragging, setDragging] = useState<DragKind>(null);
  const dragRef = useRef<{
    kind: 'move' | 'scale';
    startPointerPx: Vec2;
    startValue: unknown;
  } | null>(null);

  const geom = useMemo(() => {
    const simRect = getSimRectPx(canvasWidth, canvasHeight, textureAspect);
    const base = Math.min(simRect.w, simRect.h);
    const k = clamp(base / 900, 0.75, 1.35);
    return {
      k,
      centerR: 14 * k,
      handleR: 7 * k,
      strokeScale: 200 * k,
    };
  }, [canvasWidth, canvasHeight, textureAspect]);

  const transform = manager.getWorldTransform(emitter.id);
  if (!transform || !enabled) return null;

  const centerPx = worldToPx(transform.position, canvasWidth, canvasHeight, textureAspect);
  const scale = geom.strokeScale * Math.max(transform.scale[0], transform.scale[1]);

  // Transform stroke points to screen
  const transformStrokePoint = (p: Vec2): Vec2 => {
    const rad = (transform.rotation * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    // Stroke points are centered at 0.5, offset them
    const x = (p[0] - 0.5) * scale * transform.scale[0];
    const y = -(p[1] - 0.5) * scale * transform.scale[1]; // Flip Y
    return [
      centerPx[0] + x * cos - y * sin,
      centerPx[1] + x * sin + y * cos,
    ];
  };

  // Handlers
  const handleCenterDrag = useCallback((e: React.PointerEvent) => {
    if (emitter.locked) return;
    e.preventDefault();
    e.stopPropagation();

    dragRef.current = {
      kind: 'move',
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

  const handleScaleDrag = useCallback((e: React.PointerEvent) => {
    if (emitter.locked) return;
    e.preventDefault();
    e.stopPropagation();

    dragRef.current = {
      kind: 'scale',
      startPointerPx: [e.clientX, e.clientY],
      startValue: [...transform.scale],
    };
    setDragging('scale');

    const handleMove = (ev: PointerEvent) => {
      if (!dragRef.current) return;
      const rect = surfaceRef.current?.getBoundingClientRect();
      if (!rect) return;

      const dx = ev.clientX - centerPx[0] - rect.left;
      const dy = ev.clientY - centerPx[1] - rect.top;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const startScale = dragRef.current.startValue as Vec2;
      const baseDistance = scale / 2;
      const scaleFactor = clamp(distance / baseDistance, 0.2, 3);

      manager.setEmitterScale(emitter.id, startScale[0] * scaleFactor, startScale[1] * scaleFactor);
    };

    const handleUp = () => {
      dragRef.current = null;
      setDragging(null);
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
    };

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
  }, [emitter, manager, centerPx, scale, transform]);

  const isLocked = emitter.locked;
  const glowActive = hovered || dragging;

  // Get color from first stroke or default
  const strokeColor = emitter.strokes.length > 0
    ? `rgba(${emitter.strokes[0].color[0] * 255}, ${emitter.strokes[0].color[1] * 255}, ${emitter.strokes[0].color[2] * 255}, 0.7)`
    : 'rgba(100, 200, 80, 0.7)';

  const accentColor = emitter.strokes.length > 0
    ? `rgba(${emitter.strokes[0].color[0] * 255}, ${emitter.strokes[0].color[1] * 255}, ${emitter.strokes[0].color[2] * 255}, 0.9)`
    : 'rgba(100, 200, 80, 0.9)';

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
        <filter id={`glow-brush-${emitter.id}`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feColorMatrix in="blur" type="matrix" values="0 0 0 0 0.4 0 0 0 0 0.8 0 0 0 0 0.3 0 0 0 0.8 0" result="tint" />
          <feMerge>
            <feMergeNode in="tint" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Stroke previews */}
      {emitter.strokes.map((stroke, strokeIndex) => {
        if (stroke.points.length < 2) return null;
        
        const screenPoints = stroke.points.map(transformStrokePoint);
        const pathD = `M ${screenPoints[0][0]} ${screenPoints[0][1]} ` +
          screenPoints.slice(1).map(p => `L ${p[0]} ${p[1]}`).join(' ');

        const color = `rgba(${stroke.color[0] * 255}, ${stroke.color[1] * 255}, ${stroke.color[2] * 255}, 0.6)`;

        return (
          <path
            key={strokeIndex}
            d={pathD}
            fill="none"
            stroke={color}
            strokeWidth={emitter.brushSize * 100 * geom.k}
            strokeLinecap="round"
            strokeLinejoin="round"
            filter={glowActive ? `url(#glow-brush-${emitter.id})` : undefined}
          />
        );
      })}

      {/* Center handle */}
      <circle
        cx={centerPx[0]}
        cy={centerPx[1]}
        r={geom.centerR}
        fill="rgba(100, 200, 80, 0.2)"
        stroke={accentColor}
        strokeWidth={2}
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

      {/* Brush icon */}
      <text
        x={centerPx[0]}
        y={centerPx[1] + 4 * geom.k}
        textAnchor="middle"
        fontSize={12 * geom.k}
        fontWeight="bold"
        fill={accentColor}
        style={{ pointerEvents: 'none' }}
      >
        ✎
      </text>

      {selected && (
        <>
          {/* Scale handle indicator (outer ring) */}
          <circle
            cx={centerPx[0]}
            cy={centerPx[1]}
            r={scale / 2}
            fill="transparent"
            stroke="rgba(100, 200, 80, 0.25)"
            strokeWidth={1.5 * geom.k}
            strokeDasharray={`${8 * geom.k},${4 * geom.k}`}
          />

          {/* Scale handle */}
          <circle
            cx={centerPx[0] + scale / 2}
            cy={centerPx[1]}
            r={geom.handleR}
            fill={hovered === 'scale' ? 'rgba(100, 200, 80, 0.95)' : 'rgba(100, 200, 80, 0.75)'}
            stroke="rgba(255, 255, 255, 0.4)"
            strokeWidth={1}
          />
          <circle
            cx={centerPx[0] + scale / 2}
            cy={centerPx[1]}
            r={geom.handleR * 2.5}
            fill="transparent"
            style={{ pointerEvents: 'all', cursor: isLocked ? 'not-allowed' : 'ew-resize' }}
            onPointerEnter={() => setHovered('scale')}
            onPointerLeave={() => setHovered(null)}
            onPointerDown={handleScaleDrag}
          />

          {/* Info */}
          <text
            x={centerPx[0]}
            y={centerPx[1] + scale / 2 + 20 * geom.k}
            textAnchor="middle"
            fontSize={9 * geom.k}
            fill="rgba(255, 255, 255, 0.35)"
            style={{ pointerEvents: 'none' }}
          >
            {emitter.strokes.length} stroke{emitter.strokes.length !== 1 ? 's' : ''} • {emitter.playbackMode}
          </text>

          {/* Playback speed */}
          <text
            x={centerPx[0]}
            y={centerPx[1] + scale / 2 + 34 * geom.k}
            textAnchor="middle"
            fontSize={8 * geom.k}
            fill="rgba(255, 255, 255, 0.25)"
            style={{ pointerEvents: 'none' }}
          >
            {emitter.playbackSpeed.toFixed(1)}x speed
          </text>
        </>
      )}

      {/* Empty state */}
      {emitter.strokes.length === 0 && (
        <text
          x={centerPx[0]}
          y={centerPx[1] + geom.centerR + 20 * geom.k}
          textAnchor="middle"
          fontSize={9 * geom.k}
          fill="rgba(255, 255, 255, 0.3)"
          style={{ pointerEvents: 'none' }}
        >
          No strokes recorded
        </text>
      )}

      {isLocked && (
        <text
          x={centerPx[0]}
          y={centerPx[1] + scale / 2 + 50 * geom.k}
          textAnchor="middle"
          fontSize={10 * geom.k}
          fill="rgba(255, 255, 255, 0.40)"
          style={{ pointerEvents: 'none' }}
        >
          LOCKED
        </text>
      )}
    </svg>
  );
};

export default BrushGizmo;


