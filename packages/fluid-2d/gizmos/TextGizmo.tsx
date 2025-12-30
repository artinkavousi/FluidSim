/**
 * @package fluid-2d/gizmos
 * TextGizmo - Gizmo for text emitter manipulation
 */

import React, { useCallback, useRef, useState, useMemo } from 'react';
import type { GizmoProps, DragKind } from './types';
import type { TextEmitter } from '../emitters/types';
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

export const TextGizmo: React.FC<GizmoProps<TextEmitter>> = ({
  emitter,
  manager,
  canvasWidth,
  canvasHeight,
  textureAspect = 1,
  selected,
  enabled = true,
  snapToGrid = false,
  gridSize = 0.05,
  snapAngle = 15,
  style,
}) => {
  const surfaceRef = useRef<SVGSVGElement>(null);
  const [hovered, setHovered] = useState<'center' | 'scale' | 'rotate' | null>(null);
  const [dragging, setDragging] = useState<DragKind>(null);
  const dragRef = useRef<{
    kind: 'move' | 'scale' | 'rotate';
    startPointerPx: Vec2;
    startValue: unknown;
  } | null>(null);

  const geom = useMemo(() => {
    const simRect = getSimRectPx(canvasWidth, canvasHeight, textureAspect);
    const base = Math.min(simRect.w, simRect.h);
    const k = clamp(base / 900, 0.75, 1.35);
    return {
      k,
      centerR: 12 * k,
      handleR: 7 * k,
      boxPadding: 40 * k,
      rotateHandleOffset: 30 * k,
    };
  }, [canvasWidth, canvasHeight, textureAspect]);

  const transform = manager.getWorldTransform(emitter.id);
  if (!transform || !enabled) return null;

  const centerPx = worldToPx(transform.position, canvasWidth, canvasHeight, textureAspect);
  const simRect = getSimRectPx(canvasWidth, canvasHeight, textureAspect);
  const simBase = Math.min(simRect.w, simRect.h);
  
  // Calculate text bounding box (approximation based on scale)
  const textScale = 0.3;
  const boxWidth = textScale * transform.scale[0] * simBase;
  const boxHeight = textScale * transform.scale[1] * simBase * 0.3;
  
  // Corner handles
  const corners: Vec2[] = [
    [centerPx[0] - boxWidth / 2, centerPx[1] - boxHeight / 2], // top-left
    [centerPx[0] + boxWidth / 2, centerPx[1] - boxHeight / 2], // top-right
    [centerPx[0] + boxWidth / 2, centerPx[1] + boxHeight / 2], // bottom-right
    [centerPx[0] - boxWidth / 2, centerPx[1] + boxHeight / 2], // bottom-left
  ];

  // Rotation handle position (above center)
  const rotateHandlePx: Vec2 = [centerPx[0], centerPx[1] - boxHeight / 2 - geom.rotateHandleOffset];

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
      const baseDistance = Math.sqrt(boxWidth * boxWidth + boxHeight * boxHeight) / 2;
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
  }, [emitter, manager, centerPx, boxWidth, boxHeight, transform]);

  const handleRotateDrag = useCallback((e: React.PointerEvent) => {
    if (emitter.locked) return;
    e.preventDefault();
    e.stopPropagation();

    dragRef.current = {
      kind: 'rotate',
      startPointerPx: [e.clientX, e.clientY],
      startValue: transform.rotation,
    };
    setDragging('rotate');

    const handleMove = (ev: PointerEvent) => {
      if (!dragRef.current) return;
      const rect = surfaceRef.current?.getBoundingClientRect();
      if (!rect) return;

      const dx = ev.clientX - centerPx[0] - rect.left;
      const dy = ev.clientY - centerPx[1] - rect.top;
      let angle = Math.atan2(dy, dx) * 180 / Math.PI + 90;

      if (ev.shiftKey && snapAngle > 0) {
        angle = Math.round(angle / snapAngle) * snapAngle;
      }

      manager.setEmitterRotation(emitter.id, angle);
    };

    const handleUp = () => {
      dragRef.current = null;
      setDragging(null);
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
    };

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
  }, [emitter, manager, centerPx, transform, snapAngle]);

  const isLocked = emitter.locked;
  const glowActive = hovered || dragging;

  // Rotate corners based on emitter rotation
  const rad = (transform.rotation * Math.PI) / 180;
  const rotatePoint = (p: Vec2, center: Vec2, angle: number): Vec2 => {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const dx = p[0] - center[0];
    const dy = p[1] - center[1];
    return [
      center[0] + dx * cos - dy * sin,
      center[1] + dx * sin + dy * cos,
    ];
  };

  const rotatedCorners = corners.map(c => rotatePoint(c, centerPx, rad));
  const rotatedRotateHandle = rotatePoint(rotateHandlePx, centerPx, rad);

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
        <filter id={`glow-text-${emitter.id}`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feColorMatrix in="blur" type="matrix" values="0 0 0 0 1.0 0 0 0 0 0.75 0 0 0 0 0.2 0 0 0 0.8 0" result="tint" />
          <feMerge>
            <feMergeNode in="tint" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Bounding box */}
      <polygon
        points={rotatedCorners.map(c => c.join(',')).join(' ')}
        fill="transparent"
        stroke="rgba(255, 200, 50, 0.4)"
        strokeWidth={1.5 * geom.k}
        strokeDasharray={selected ? 'none' : `${6 * geom.k},${4 * geom.k}`}
        filter={glowActive ? `url(#glow-text-${emitter.id})` : undefined}
      />

      {/* Center handle */}
      <circle
        cx={centerPx[0]}
        cy={centerPx[1]}
        r={geom.centerR}
        fill="rgba(255, 200, 50, 0.25)"
        stroke="rgba(255, 200, 50, 0.8)"
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

      {/* Text label */}
      <text
        x={centerPx[0]}
        y={centerPx[1] + 4 * geom.k}
        textAnchor="middle"
        fontSize={10 * geom.k}
        fontWeight="bold"
        fill="rgba(255, 200, 50, 0.95)"
        style={{ pointerEvents: 'none' }}
      >
        T
      </text>

      {selected && (
        <>
          {/* Corner scale handles */}
          {rotatedCorners.map((corner, i) => (
            <React.Fragment key={i}>
              <rect
                x={corner[0] - geom.handleR}
                y={corner[1] - geom.handleR}
                width={geom.handleR * 2}
                height={geom.handleR * 2}
                fill={hovered === 'scale' ? 'rgba(255, 200, 50, 0.95)' : 'rgba(255, 200, 50, 0.75)'}
                stroke="rgba(255, 255, 255, 0.4)"
                strokeWidth={1}
                rx={2}
              />
              <rect
                x={corner[0] - geom.handleR * 2}
                y={corner[1] - geom.handleR * 2}
                width={geom.handleR * 4}
                height={geom.handleR * 4}
                fill="transparent"
                style={{ pointerEvents: 'all', cursor: isLocked ? 'not-allowed' : 'nwse-resize' }}
                onPointerEnter={() => setHovered('scale')}
                onPointerLeave={() => setHovered(null)}
                onPointerDown={handleScaleDrag}
              />
            </React.Fragment>
          ))}

          {/* Rotation handle */}
          <line
            x1={centerPx[0]}
            y1={centerPx[1]}
            x2={rotatedRotateHandle[0]}
            y2={rotatedRotateHandle[1]}
            stroke="rgba(255, 200, 50, 0.4)"
            strokeWidth={1.5 * geom.k}
          />
          <circle
            cx={rotatedRotateHandle[0]}
            cy={rotatedRotateHandle[1]}
            r={geom.handleR}
            fill={hovered === 'rotate' ? 'rgba(180, 150, 255, 0.95)' : 'rgba(180, 150, 255, 0.75)'}
            stroke="rgba(255, 255, 255, 0.4)"
            strokeWidth={1}
          />
          <circle
            cx={rotatedRotateHandle[0]}
            cy={rotatedRotateHandle[1]}
            r={geom.handleR * 2.5}
            fill="transparent"
            style={{ pointerEvents: 'all', cursor: isLocked ? 'not-allowed' : 'grab' }}
            onPointerEnter={() => setHovered('rotate')}
            onPointerLeave={() => setHovered(null)}
            onPointerDown={handleRotateDrag}
          />

          {/* Text content preview */}
          <text
            x={centerPx[0]}
            y={centerPx[1] + boxHeight / 2 + 18 * geom.k}
            textAnchor="middle"
            fontSize={9 * geom.k}
            fill="rgba(255, 255, 255, 0.35)"
            style={{ pointerEvents: 'none' }}
          >
            "{emitter.text}"
          </text>
        </>
      )}

      {isLocked && (
        <text
          x={centerPx[0]}
          y={centerPx[1] + boxHeight / 2 + 35 * geom.k}
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

export default TextGizmo;


