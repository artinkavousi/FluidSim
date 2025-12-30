/**
 * @package fluid-2d/gizmos
 * GizmoRenderer - Renders appropriate gizmo for each emitter type
 */

import React, { useMemo } from 'react';
import type { Emitter, EmitterManagerAPI } from '../emitters/types';
import { PointGizmo } from './PointGizmo';
import { LineGizmo } from './LineGizmo';
import { CircleGizmo } from './CircleGizmo';
import { CurveGizmo } from './CurveGizmo';
import { TextGizmo } from './TextGizmo';
import { SVGGizmo } from './SVGGizmo';
import { BrushGizmo } from './BrushGizmo';
import type { GizmoTheme } from './types';

// ============================================
// Types
// ============================================

export interface GizmoRendererProps {
  emitters: Emitter[];
  manager: EmitterManagerAPI;
  selectedIds: Set<string>;
  canvasWidth: number;
  canvasHeight: number;
  /** Sim texture aspect ratio (dyeW/dyeH); used for aspect-correct gizmo mapping. */
  textureAspect?: number;
  enabled?: boolean;
  snapToGrid?: boolean;
  gridSize?: number;
  snapAngle?: number;
  theme?: Partial<GizmoTheme>;
}

// ============================================
// Component
// ============================================

export const GizmoRenderer: React.FC<GizmoRendererProps> = ({
  emitters,
  manager,
  selectedIds,
  canvasWidth,
  canvasHeight,
  textureAspect = 1,
  enabled = true,
  snapToGrid = false,
  gridSize = 0.05,
  snapAngle = 15,
  theme: _theme,
}) => {
  // Sort emitters: selected ones on top
  const sortedEmitters = useMemo(() => {
    return [...emitters].sort((a, b) => {
      const aSelected = selectedIds.has(a.id) ? 1 : 0;
      const bSelected = selectedIds.has(b.id) ? 1 : 0;
      return aSelected - bSelected;
    });
  }, [emitters, selectedIds]);

  if (!enabled) return null;

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 100,
      }}
    >
      {sortedEmitters.map((emitter) => {
        const isSelected = selectedIds.has(emitter.id);
        if (!emitter.visible) return null;

        const commonProps = {
          manager,
          canvasWidth,
          canvasHeight,
          textureAspect,
          selected: isSelected,
          enabled,
          snapToGrid,
          gridSize,
          snapAngle,
        };

        switch (emitter.type) {
          case 'point':
            return <PointGizmo key={emitter.id} {...commonProps} emitter={emitter} />;
          case 'line':
            return <LineGizmo key={emitter.id} {...commonProps} emitter={emitter} />;
          case 'circle':
            return <CircleGizmo key={emitter.id} {...commonProps} emitter={emitter} />;
          case 'curve':
            return <CurveGizmo key={emitter.id} {...commonProps} emitter={emitter} />;
          case 'text':
            return <TextGizmo key={emitter.id} {...commonProps} emitter={emitter} />;
          case 'svg':
            return <SVGGizmo key={emitter.id} {...commonProps} emitter={emitter} />;
          case 'brush':
            return <BrushGizmo key={emitter.id} {...commonProps} emitter={emitter} />;
          default:
            return null;
        }
      })}
    </div>
  );
};

export default GizmoRenderer;
