/**
 * @package fluid-2d/gizmos
 * PointGizmo - Advanced Interactive Gizmo for Point Emitters
 * 
 * Features:
 * - Always visible position handle
 * - Direction arrow with force control
 * - Rate arc control (left side)
 * - Size arc control (right side)
 * - Color preview ring
 * - Keyboard modifiers (Shift = constrain, Alt = fine control)
 */

import React, { useCallback, useMemo, useRef, useState } from 'react';
import type { GizmoProps, DragKind } from './types';
import type { PointEmitter } from '../emitters/types';
import type { Vec2 } from '../types';
import { deltaPxToWorld, getSimRectPx, worldToPx } from './space';

// ============================================
// Constants
// ============================================

const TAU = Math.PI * 2;
const PARAM_FORCE_MIN = 0;
const PARAM_FORCE_MAX = 5;
const PARAM_RATE_MIN = 0;
const PARAM_RATE_MAX = 5;
const PARAM_SIZE_MIN = 0.1;
const PARAM_SIZE_MAX = 5;

// ============================================
// Utilities
// ============================================

const deg = (d: number) => (d * Math.PI) / 180;
const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
const clamp01 = (v: number) => clamp(v, 0, 1);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

const normalize = (v: Vec2): Vec2 => {
  const len = Math.sqrt(v[0] * v[0] + v[1] * v[1]);
  return len > 1e-6 ? [v[0] / len, v[1] / len] : [0, 1];
};

const arcPoint = (c: Vec2, r: number, a: number): Vec2 => [c[0] + Math.cos(a) * r, c[1] + Math.sin(a) * r];
const svgArc = (c: Vec2, r: number, s: number, e: number): string => {
  const p0 = arcPoint(c, r, s);
  const p1 = arcPoint(c, r, e);
  const large = Math.abs(e - s) > Math.PI ? 1 : 0;
  return `M ${p0[0].toFixed(1)} ${p0[1].toFixed(1)} A ${r.toFixed(1)} ${r.toFixed(1)} 0 ${large} 1 ${p1[0].toFixed(1)} ${p1[1].toFixed(1)}`;
};

const color3ToHex = (c: [number, number, number]): string => {
  const [r, g, b] = c.map(v => Math.round(clamp(v, 0, 1) * 255).toString(16).padStart(2, '0'));
  return `#${r}${g}${b}`;
};

// ============================================
// Component
// ============================================

export const PointGizmo: React.FC<GizmoProps<PointEmitter>> = ({
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
  const svgRef = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<string | null>(null);
  const [drag, setDrag] = useState<DragKind>(null);
  const dragData = useRef<{ kind: DragKind; startPx: Vec2; startVal: unknown } | null>(null);

  // Geometry
  const g = useMemo(() => {
    const simRect = getSimRectPx(canvasWidth, canvasHeight, textureAspect);
    const base = Math.min(simRect.w, simRect.h);
    const k = clamp(base / 900, 0.7, 1.4);
    return {
      k,
      hub: 14 * k,
      hubHit: 24 * k,
      arcR: 72 * k,
      arcW: 6 * k,
      arcHit: 16 * k,
      dot: 9 * k,
      arrowMin: 40 * k,
      arrowMax: 140 * k,
      tipR: 11 * k,
      colorRing: 22 * k,
      // Arc ranges
      rateStart: Math.PI * 0.6,
      rateEnd: Math.PI * 1.4,
      sizeStart: -Math.PI * 0.4,
      sizeEnd: Math.PI * 0.4,
    };
  }, [canvasWidth, canvasHeight, textureAspect]);

  // Transform
  const transform = manager.getWorldTransform(emitter.id);
  if (!transform || !enabled) return null;

  const center = worldToPx(transform.position, canvasWidth, canvasHeight, textureAspect);
  const emitterColor = color3ToHex(emitter.color);

  // Direction (world and screen are both Y-down in this app)
  const dir = normalize(emitter.fixedDirection || [0, 1]);

  // Force → arrow length
  const force = clamp(emitter.forceScale ?? 1, PARAM_FORCE_MIN, PARAM_FORCE_MAX);
  const forceT = force / PARAM_FORCE_MAX;
  const arrowLen = lerp(g.arrowMin, g.arrowMax, forceT);
  const tip: Vec2 = [center[0] + dir[0] * arrowLen, center[1] + dir[1] * arrowLen];

  // Arrow polygon
  const perp: Vec2 = [-dir[1], dir[0]];
  const baseW = 2 + forceT * 3;
  const headW = baseW * 2.2;
  const headLen = 14 * g.k + forceT * 12 * g.k;
  const headBase: Vec2 = [tip[0] - dir[0] * headLen, tip[1] - dir[1] * headLen];
  const arrowPts = [
    [center[0] + perp[0] * baseW, center[1] + perp[1] * baseW],
    [headBase[0] + perp[0] * baseW, headBase[1] + perp[1] * baseW],
    [headBase[0] + perp[0] * headW, headBase[1] + perp[1] * headW],
    tip,
    [headBase[0] - perp[0] * headW, headBase[1] - perp[1] * headW],
    [headBase[0] - perp[0] * baseW, headBase[1] - perp[1] * baseW],
    [center[0] - perp[0] * baseW, center[1] - perp[1] * baseW],
  ].map(p => p.join(',')).join(' ');

  // Rate & Size arcs
  const rateT = clamp01((emitter.emissionRate ?? 1) / PARAM_RATE_MAX);
  const sizeT = clamp01(((emitter.radiusScale ?? 1) - PARAM_SIZE_MIN) / (PARAM_SIZE_MAX - PARAM_SIZE_MIN));
  const rateAngle = lerp(g.rateStart, g.rateEnd, rateT);
  const sizeAngle = lerp(g.sizeStart, g.sizeEnd, sizeT);
  const rateDot = arcPoint(center, g.arcR, rateAngle);
  const sizeDot = arcPoint(center, g.arcR, sizeAngle);

  // ============================================
  // Drag Handlers
  // ============================================

  const startDrag = useCallback((kind: DragKind, e: React.PointerEvent, startVal: unknown) => {
    if (emitter.locked) return;
    e.preventDefault();
    e.stopPropagation();
    manager.select(emitter.id);

    dragData.current = { kind, startPx: [e.clientX, e.clientY], startVal };
    setDrag(kind);

    const onMove = (ev: PointerEvent) => {
      if (!dragData.current || !svgRef.current) return;
      const rect = svgRef.current.getBoundingClientRect();
      const mult = ev.altKey ? 0.25 : 1; // Fine control with Alt

      if (kind === 'move') {
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
      } else if (kind === 'arrow') {
        // Direction + force from center to pointer
        const cx = center[0], cy = center[1];
        const px = (ev.clientX - rect.left), py = (ev.clientY - rect.top);
        const dx = px - cx, dy = (py - cy);
        let dirW = normalize([dx, dy]);
        if (ev.shiftKey && snapAngle > 0) {
          const a = Math.atan2(dirW[1], dirW[0]);
          const snap = Math.round(a / deg(snapAngle)) * deg(snapAngle);
          dirW = [Math.cos(snap), Math.sin(snap)];
        }
        const dist = Math.sqrt(dx * dx + dy * dy);
        const newForce = clamp(dist / g.arrowMax * PARAM_FORCE_MAX * mult, PARAM_FORCE_MIN, PARAM_FORCE_MAX);
        manager.updateEmitter(emitter.id, {
          directionMode: 'fixed',
          fixedDirection: dirW,
          forceScale: newForce,
        } as Partial<PointEmitter>);
      } else if (kind === 'rate') {
        const px = ev.clientX - rect.left, py = ev.clientY - rect.top;
        const angle = Math.atan2(py - center[1], px - center[0]);
        let t = clamp01((angle - g.rateStart) / (g.rateEnd - g.rateStart));
        const rate = clamp(t * PARAM_RATE_MAX * mult, PARAM_RATE_MIN, PARAM_RATE_MAX);
        manager.updateEmitter(emitter.id, { emissionRate: rate });
      } else if (kind === 'size') {
        const px = ev.clientX - rect.left, py = ev.clientY - rect.top;
        const angle = Math.atan2(py - center[1], px - center[0]);
        let t = clamp01((angle - g.sizeStart) / (g.sizeEnd - g.sizeStart));
        const size = clamp(PARAM_SIZE_MIN + t * (PARAM_SIZE_MAX - PARAM_SIZE_MIN) * mult, PARAM_SIZE_MIN, PARAM_SIZE_MAX);
        manager.updateEmitter(emitter.id, { radiusScale: size });
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
  }, [emitter, manager, center, g, snapToGrid, gridSize, snapAngle, textureAspect]);

  const isLocked = emitter.locked;
  const isActive = hover || drag;
  const showExpanded = selected || isActive;

  // Colors
  const primary = '#00d4aa';
  const secondary = '#64b5f6';
  const tertiary = '#f472b6';
  const hubColor = selected ? primary : 'rgba(255,255,255,0.5)';

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
        <filter id={`glow-${emitter.id}`} x="-100%" y="-100%" width="300%" height="300%">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feColorMatrix in="blur" type="matrix" 
            values="0 0 0 0 0 0 0 0 0 0.83 0 0 0 0 0.67 0 0 0 0.8 0" />
          <feMerge><feMergeNode /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <filter id={`glowBlue-${emitter.id}`} x="-100%" y="-100%" width="300%" height="300%">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feColorMatrix in="blur" type="matrix" 
            values="0 0 0 0 0.39 0 0 0 0 0.71 0 0 0 0 0.96 0 0 0 0.8 0" />
          <feMerge><feMergeNode /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <filter id={`glowPink-${emitter.id}`} x="-100%" y="-100%" width="300%" height="300%">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feColorMatrix in="blur" type="matrix" 
            values="0 0 0 0 0.96 0 0 0 0 0.45 0 0 0 0 0.71 0 0 0 0.8 0" />
          <feMerge><feMergeNode /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      {/* Color Ring */}
      <circle
        cx={center[0]}
        cy={center[1]}
        r={g.colorRing}
        fill="transparent"
        stroke={emitterColor}
        strokeWidth={3}
        opacity={showExpanded ? 0.6 : 0.3}
      />

      {/* Direction Arrow - Always visible */}
      <polygon
        points={arrowPts}
        fill={drag === 'arrow' || hover === 'arrow' ? primary : 'rgba(0, 212, 170, 0.5)'}
        opacity={0.9}
        filter={drag === 'arrow' || hover === 'arrow' ? `url(#glow-${emitter.id})` : undefined}
      />
      <polygon
        points={arrowPts}
        fill="transparent"
        stroke="rgba(255,255,255,0.25)"
        strokeWidth={1}
      />

      {/* Arrow Tip Handle */}
      <circle
        cx={tip[0]}
        cy={tip[1]}
        r={g.tipR}
        fill={hover === 'arrow' || drag === 'arrow' ? primary : 'rgba(0, 212, 170, 0.85)'}
        stroke="rgba(255,255,255,0.4)"
        strokeWidth={1.5}
        filter={hover === 'arrow' || drag === 'arrow' ? `url(#glow-${emitter.id})` : undefined}
      />
      <circle
        cx={tip[0]}
        cy={tip[1]}
        r={g.tipR * 3}
        fill="transparent"
        style={{ pointerEvents: 'all', cursor: isLocked ? 'not-allowed' : 'grab' }}
        onPointerEnter={() => setHover('arrow')}
        onPointerLeave={() => setHover(null)}
        onPointerDown={(e) => startDrag('arrow', e, force)}
      />

      {/* Force value label */}
      {(hover === 'arrow' || drag === 'arrow' || selected) && (
        <text
          x={tip[0] + 16 * g.k}
          y={tip[1]}
          fontSize={11 * g.k}
          fill={primary}
          fontFamily="system-ui"
          fontWeight="600"
          style={{ pointerEvents: 'none' }}
        >
          {force.toFixed(1)}
        </text>
      )}

      {/* Expanded Controls - Show when selected */}
      {showExpanded && (
        <>
          {/* Rate Arc (Left) */}
          <path
            d={svgArc(center, g.arcR, g.rateStart, g.rateEnd)}
            stroke="rgba(255,255,255,0.12)"
            strokeWidth={g.arcW}
            strokeLinecap="round"
            fill="none"
          />
          <path
            d={svgArc(center, g.arcR, g.rateStart, rateAngle)}
            stroke={hover === 'rate' || drag === 'rate' ? primary : 'rgba(0, 212, 170, 0.75)'}
            strokeWidth={g.arcW + 2}
            strokeLinecap="round"
            fill="none"
            filter={hover === 'rate' || drag === 'rate' ? `url(#glow-${emitter.id})` : undefined}
          />
          {/* Rate Handle */}
          <circle
            cx={rateDot[0]}
            cy={rateDot[1]}
            r={g.dot}
            fill={hover === 'rate' || drag === 'rate' ? primary : 'rgba(0, 212, 170, 0.9)'}
            stroke="rgba(255,255,255,0.4)"
            strokeWidth={1.5}
            filter={hover === 'rate' || drag === 'rate' ? `url(#glow-${emitter.id})` : undefined}
          />
          <circle
            cx={rateDot[0]}
            cy={rateDot[1]}
            r={g.arcHit}
            fill="transparent"
            style={{ pointerEvents: 'all', cursor: isLocked ? 'not-allowed' : 'grab' }}
            onPointerEnter={() => setHover('rate')}
            onPointerLeave={() => setHover(null)}
            onPointerDown={(e) => startDrag('rate', e, emitter.emissionRate)}
          />
          {/* Rate Label */}
          <text
            x={center[0] - g.arcR - 20 * g.k}
            y={center[1]}
            textAnchor="end"
            fontSize={10 * g.k}
            fill="rgba(0, 212, 170, 0.6)"
            fontFamily="system-ui"
            fontWeight="500"
            style={{ pointerEvents: 'none' }}
          >
            RATE
          </text>
          <text
            x={center[0] - g.arcR - 20 * g.k}
            y={center[1] + 12 * g.k}
            textAnchor="end"
            fontSize={11 * g.k}
            fill={primary}
            fontFamily="system-ui"
            fontWeight="600"
            style={{ pointerEvents: 'none' }}
          >
            {(emitter.emissionRate ?? 1).toFixed(1)}
          </text>

          {/* Size Arc (Right) */}
          <path
            d={svgArc(center, g.arcR, g.sizeStart, g.sizeEnd)}
            stroke="rgba(255,255,255,0.12)"
            strokeWidth={g.arcW}
            strokeLinecap="round"
            fill="none"
          />
          <path
            d={svgArc(center, g.arcR, g.sizeStart, sizeAngle)}
            stroke={hover === 'size' || drag === 'size' ? secondary : 'rgba(100, 181, 246, 0.75)'}
            strokeWidth={g.arcW + 2}
            strokeLinecap="round"
            fill="none"
            filter={hover === 'size' || drag === 'size' ? `url(#glowBlue-${emitter.id})` : undefined}
          />
          {/* Size Handle */}
          <circle
            cx={sizeDot[0]}
            cy={sizeDot[1]}
            r={g.dot}
            fill={hover === 'size' || drag === 'size' ? secondary : 'rgba(100, 181, 246, 0.9)'}
            stroke="rgba(255,255,255,0.4)"
            strokeWidth={1.5}
            filter={hover === 'size' || drag === 'size' ? `url(#glowBlue-${emitter.id})` : undefined}
          />
          <circle
            cx={sizeDot[0]}
            cy={sizeDot[1]}
            r={g.arcHit}
            fill="transparent"
            style={{ pointerEvents: 'all', cursor: isLocked ? 'not-allowed' : 'grab' }}
            onPointerEnter={() => setHover('size')}
            onPointerLeave={() => setHover(null)}
            onPointerDown={(e) => startDrag('size', e, emitter.radiusScale)}
          />
          {/* Size Label */}
          <text
            x={center[0] + g.arcR + 20 * g.k}
            y={center[1]}
            textAnchor="start"
            fontSize={10 * g.k}
            fill="rgba(100, 181, 246, 0.6)"
            fontFamily="system-ui"
            fontWeight="500"
            style={{ pointerEvents: 'none' }}
          >
            SIZE
          </text>
          <text
            x={center[0] + g.arcR + 20 * g.k}
            y={center[1] + 12 * g.k}
            textAnchor="start"
            fontSize={11 * g.k}
            fill={secondary}
            fontFamily="system-ui"
            fontWeight="600"
            style={{ pointerEvents: 'none' }}
          >
            {(emitter.radiusScale ?? 1).toFixed(1)}
          </text>
        </>
      )}

      {/* Center Hub - Always visible */}
      <circle
        cx={center[0]}
        cy={center[1]}
        r={g.hub}
        fill="rgba(10, 12, 18, 0.7)"
        stroke={hover === 'hub' || drag === 'move' ? primary : hubColor}
        strokeWidth={selected ? 2.5 : 2}
        filter={selected ? `url(#glow-${emitter.id})` : undefined}
      />
      <circle
        cx={center[0]}
        cy={center[1]}
        r={g.hubHit}
        fill="transparent"
        style={{ pointerEvents: 'all', cursor: isLocked ? 'not-allowed' : 'move' }}
        onPointerEnter={() => setHover('hub')}
        onPointerLeave={() => setHover(null)}
        onPointerDown={(e) => startDrag('move', e, [...transform.position])}
      />

      {/* Locked indicator */}
      {isLocked && (
        <text
          x={center[0]}
          y={center[1] + g.arcR + 24 * g.k}
          textAnchor="middle"
          fontSize={9 * g.k}
          fill="rgba(255,255,255,0.4)"
          fontFamily="system-ui"
          style={{ pointerEvents: 'none' }}
        >
          🔒 LOCKED
        </text>
      )}

      {/* Name label when selected */}
      {selected && (
        <text
          x={center[0]}
          y={center[1] - g.arcR - 12 * g.k}
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
    </svg>
  );
};

export default PointGizmo;
