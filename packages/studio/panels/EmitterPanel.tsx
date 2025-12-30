/**
 * @package studio/panels
 * EmitterPanel - Editorial Glassmorphism Design
 * All controls visible in one view, magazine-style layout
 */

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  colors, typography, radius, effects, spacing, emitterTypeColors, zIndex
} from '../ui';
import type { Emitter, EmitterType, DirectionMode } from '../../fluid-2d/emitters/types';
import type { Color3 } from '../../fluid-2d/types';
import { getPresetNames, getPreset } from '../../fluid-2d/emitters/presets';

// ============================================
// Color Utilities
// ============================================

const color3ToHex = (c: Color3): string => {
  const r = Math.round(c[0] * 255).toString(16).padStart(2, '0');
  const g = Math.round(c[1] * 255).toString(16).padStart(2, '0');
  const b = Math.round(c[2] * 255).toString(16).padStart(2, '0');
  return `#${r}${g}${b}`;
};

const hexToColor3 = (hex: string): Color3 => {
  const h = hex.replace('#', '');
  return [
    parseInt(h.substring(0, 2), 16) / 255,
    parseInt(h.substring(2, 4), 16) / 255,
    parseInt(h.substring(4, 6), 16) / 255,
  ];
};

// ============================================
// Types
// ============================================

interface EmitterPanelProps {
  emitters: Emitter[];
  selectedIds: Set<string>;
  onAddEmitter: (config: Omit<Emitter, 'id'>) => string;
  onRemoveEmitter: (id: string) => void;
  onSelectEmitter: (id: string, additive?: boolean) => void;
  onUpdateEmitter: (id: string, updates: Partial<Emitter>) => void;
  onDuplicateEmitter: (id: string) => void;
}

// ============================================
// Type Icons (SVG)
// ============================================

const TypeIcon: React.FC<{ type: EmitterType; size?: number }> = ({ type, size = 18 }) => {
  const iconProps = { width: size, height: size, viewBox: "0 0 24 24" };
  
  const icons: Record<EmitterType, React.ReactNode> = {
    point: <svg {...iconProps} fill="currentColor"><circle cx="12" cy="12" r="5"/></svg>,
    line: <svg {...iconProps} stroke="currentColor" strokeWidth="2.5" fill="none"><line x1="4" y1="12" x2="20" y2="12"/></svg>,
    circle: <svg {...iconProps} stroke="currentColor" strokeWidth="2" fill="none"><circle cx="12" cy="12" r="8"/></svg>,
    curve: <svg {...iconProps} stroke="currentColor" strokeWidth="2" fill="none"><path d="M3 17C9 17 4 7 12 7s3 10 9 10"/></svg>,
    text: <svg {...iconProps} fill="currentColor"><text x="6" y="18" fontSize="16" fontWeight="bold">T</text></svg>,
    svg: <svg {...iconProps} stroke="currentColor" strokeWidth="2" fill="none"><polygon points="12 2 22 8 22 16 12 22 2 16 2 8"/></svg>,
    brush: <svg {...iconProps} fill="currentColor"><path d="M7 14c-1.66 0-3 1.34-3 3 0 1.31-1.16 2-2 2 .92 1.22 2.49 2 4 2 2.21 0 4-1.79 4-4 0-1.66-1.34-3-3-3zm13.71-9.37l-1.34-1.34a.996.996 0 00-1.41 0L9 12.25 11.75 15l8.96-8.96a.996.996 0 000-1.41z"/></svg>,
  };
  
  return <>{icons[type]}</>;
};

// ============================================
// Inline Emitter Controls
// ============================================

interface EmitterControlsProps {
  emitter: Emitter;
  onUpdate: (updates: Partial<Emitter>) => void;
  typeColor: { primary: string; glow: string; bg: string };
}

const EmitterControls: React.FC<EmitterControlsProps> = ({ emitter, onUpdate, typeColor }) => {
  return (
    <div className="emitter-controls">
      {/* Position Row */}
      <div className="control-row position-row">
        <div className="mini-input-group">
          <span className="mini-label">X</span>
          <input
            type="number"
            className="mini-input"
            value={emitter.position[0].toFixed(2)}
            onChange={(e) => onUpdate({ position: [Number(e.target.value), emitter.position[1]] })}
            step={0.01}
            min={0}
            max={1}
          />
        </div>
        <div className="mini-input-group">
          <span className="mini-label">Y</span>
          <input
            type="number"
            className="mini-input"
            value={emitter.position[1].toFixed(2)}
            onChange={(e) => onUpdate({ position: [emitter.position[0], Number(e.target.value)] })}
            step={0.01}
            min={0}
            max={1}
          />
        </div>
        <div className="mini-input-group">
          <span className="mini-label">°</span>
          <input
            type="number"
            className="mini-input"
            value={emitter.rotation.toFixed(0)}
            onChange={(e) => onUpdate({ rotation: Number(e.target.value) })}
            step={5}
            min={0}
            max={360}
          />
        </div>
      </div>

      {/* Emission Row */}
      <div className="control-row sliders-row">
        <div className="slider-compact">
          <div className="slider-header">
            <span>Force</span>
            <span className="slider-value">{emitter.forceScale.toFixed(1)}</span>
          </div>
          <input
            type="range"
            className="compact-slider"
            value={emitter.forceScale}
            onChange={(e) => onUpdate({ forceScale: Number(e.target.value) })}
            min={0}
            max={5}
            step={0.1}
            style={{ '--accent': typeColor.primary } as React.CSSProperties}
          />
        </div>
        <div className="slider-compact">
          <div className="slider-header">
            <span>Rate</span>
            <span className="slider-value">{emitter.emissionRate.toFixed(1)}</span>
          </div>
          <input
            type="range"
            className="compact-slider"
            value={emitter.emissionRate}
            onChange={(e) => onUpdate({ emissionRate: Number(e.target.value) })}
            min={0}
            max={5}
            step={0.1}
            style={{ '--accent': colors.accent.blue } as React.CSSProperties}
          />
        </div>
        <div className="slider-compact">
          <div className="slider-header">
            <span>Size</span>
            <span className="slider-value">{emitter.radiusScale.toFixed(1)}</span>
          </div>
          <input
            type="range"
            className="compact-slider"
            value={emitter.radiusScale}
            onChange={(e) => onUpdate({ radiusScale: Number(e.target.value) })}
            min={0.1}
            max={5}
            step={0.1}
            style={{ '--accent': colors.accent.amber } as React.CSSProperties}
          />
        </div>
      </div>

      {/* Color & Direction Row */}
      <div className="control-row appearance-row">
        <div className="color-control">
          <input
            type="color"
            className="color-input"
            value={color3ToHex(emitter.color)}
            onChange={(e) => onUpdate({ color: hexToColor3(e.target.value) })}
          />
          <span className="color-hex">{color3ToHex(emitter.color).toUpperCase()}</span>
        </div>
        <div className="opacity-control">
          <span className="mini-label">α</span>
          <input
            type="range"
            className="compact-slider opacity-slider"
            value={emitter.opacity}
            onChange={(e) => onUpdate({ opacity: Number(e.target.value) })}
            min={0}
            max={1}
            step={0.05}
          />
        </div>
        <select
          className="direction-select"
          value={emitter.directionMode}
          onChange={(e) => onUpdate({ directionMode: e.target.value as DirectionMode })}
        >
          <option value="fixed">Fixed</option>
          <option value="normal">Normal</option>
          <option value="tangent">Tangent</option>
          <option value="outward">Outward</option>
          <option value="inward">Inward</option>
          <option value="random">Random</option>
        </select>
        <div className="spread-control">
          <span className="mini-label">±</span>
          <input
            type="number"
            className="mini-input spread-input"
            value={emitter.spread.toFixed(0)}
            onChange={(e) => onUpdate({ spread: Number(e.target.value) })}
            step={5}
            min={0}
            max={180}
          />
          <span className="mini-unit">°</span>
        </div>
      </div>

      <style>{`
        .emitter-controls {
          display: flex;
          flex-direction: column;
          gap: ${spacing[2]};
        }
        
        .control-row {
          display: flex;
          gap: ${spacing[2]};
          align-items: center;
        }
        
        .position-row {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: ${spacing[1.5]};
        }
        
        .mini-input-group {
          display: flex;
          align-items: center;
          gap: ${spacing[1]};
          background: rgba(0, 0, 0, 0.25);
          border-radius: ${radius.sm};
          padding: 0 ${spacing[1.5]};
          height: 28px;
          border: 1px solid ${colors.glass.borderSubtle};
        }
        
        .mini-label {
          font-family: ${typography.fontFamily.mono};
          font-size: ${typography.fontSize.xs};
          color: ${colors.text.muted};
          min-width: 12px;
        }
        
        .mini-unit {
          font-family: ${typography.fontFamily.mono};
          font-size: ${typography.fontSize.xs};
          color: ${colors.text.muted};
        }
        
        .mini-input {
          width: 100%;
          background: transparent;
          border: none;
          font-family: ${typography.fontFamily.mono};
          font-size: ${typography.fontSize.xs};
          color: ${colors.text.primary};
          outline: none;
          text-align: right;
          padding: 0;
        }
        
        .mini-input::-webkit-outer-spin-button,
        .mini-input::-webkit-inner-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }
        
        .sliders-row {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: ${spacing[2]};
        }
        
        .slider-compact {
          display: flex;
          flex-direction: column;
          gap: ${spacing[0.5]};
        }
        
        .slider-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: ${typography.fontSize['2xs']};
          color: ${colors.text.tertiary};
          text-transform: uppercase;
          letter-spacing: ${typography.letterSpacing.wide};
        }
        
        .slider-value {
          font-family: ${typography.fontFamily.mono};
          color: ${colors.text.secondary};
        }
        
        .compact-slider {
          -webkit-appearance: none;
          width: 100%;
          height: 3px;
          background: rgba(255, 255, 255, 0.1);
          border-radius: 2px;
          cursor: pointer;
        }
        
        .compact-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 10px;
          height: 10px;
          background: var(--accent, ${colors.accent.primary});
          border-radius: 50%;
          box-shadow: 0 0 6px var(--accent, ${colors.accent.primary});
          cursor: pointer;
          transition: transform 0.1s ease;
        }
        
        .compact-slider::-webkit-slider-thumb:hover {
          transform: scale(1.2);
        }
        
        .appearance-row {
          display: flex;
          gap: ${spacing[1.5]};
          align-items: center;
        }
        
        .color-control {
          display: flex;
          align-items: center;
          gap: ${spacing[1]};
          background: rgba(0, 0, 0, 0.25);
          border-radius: ${radius.sm};
          padding: ${spacing[0.5]} ${spacing[1.5]};
          border: 1px solid ${colors.glass.borderSubtle};
        }
        
        .color-input {
          width: 20px;
          height: 20px;
          border: none;
          border-radius: ${radius.xs};
          cursor: pointer;
          padding: 0;
          background: transparent;
        }
        
        .color-input::-webkit-color-swatch-wrapper {
          padding: 0;
        }
        
        .color-input::-webkit-color-swatch {
          border: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: ${radius.xs};
        }
        
        .color-hex {
          font-family: ${typography.fontFamily.mono};
          font-size: ${typography.fontSize['2xs']};
          color: ${colors.text.tertiary};
          width: 54px;
        }
        
        .opacity-control {
          display: flex;
          align-items: center;
          gap: ${spacing[1]};
          flex: 1;
          min-width: 60px;
        }
        
        .opacity-slider {
          flex: 1;
        }
        
        .direction-select {
          background: rgba(0, 0, 0, 0.25);
          border: 1px solid ${colors.glass.borderSubtle};
          border-radius: ${radius.sm};
          color: ${colors.text.secondary};
          font-family: ${typography.fontFamily.body};
          font-size: ${typography.fontSize['2xs']};
          padding: ${spacing[1]} ${spacing[2]};
          height: 28px;
          cursor: pointer;
          outline: none;
          min-width: 70px;
        }
        
        .direction-select:focus {
          border-color: ${colors.border.focus};
        }
        
        .spread-control {
          display: flex;
          align-items: center;
          gap: ${spacing[0.5]};
          background: rgba(0, 0, 0, 0.25);
          border-radius: ${radius.sm};
          padding: 0 ${spacing[1.5]};
          height: 28px;
          border: 1px solid ${colors.glass.borderSubtle};
        }
        
        .spread-input {
          width: 28px;
        }
      `}</style>
    </div>
  );
};

// ============================================
// Emitter Card (Compact, Everything Visible)
// ============================================

interface EmitterCardProps {
  emitter: Emitter;
  selected: boolean;
  onSelect: (additive?: boolean) => void;
  onUpdate: (updates: Partial<Emitter>) => void;
  onRemove: () => void;
  onDuplicate: () => void;
}

const EmitterCard: React.FC<EmitterCardProps> = ({
  emitter,
  selected,
  onSelect,
  onUpdate,
  onRemove,
  onDuplicate,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(emitter.name);
  const typeColor = emitterTypeColors[emitter.type] || emitterTypeColors.point;

  const handleNameSubmit = () => {
    if (editName.trim() && editName !== emitter.name) {
      onUpdate({ name: editName.trim() });
    }
    setIsEditing(false);
  };

  return (
    <motion.div
      className={`emitter-card ${selected ? 'selected' : ''} ${!emitter.active ? 'inactive' : ''}`}
      layout
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8, height: 0 }}
      transition={{ duration: 0.15 }}
      onClick={(e) => onSelect(e.shiftKey)}
      style={{
        '--type-color': typeColor.primary,
        '--type-glow': typeColor.glow,
        '--type-bg': typeColor.bg,
      } as React.CSSProperties}
    >
      {/* Header */}
      <div className="card-header">
        <div className="header-left">
          <div className="type-badge" style={{ color: typeColor.primary }}>
            <TypeIcon type={emitter.type} size={14} />
          </div>
          {isEditing ? (
            <input
              type="text"
              className="name-edit"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onBlur={handleNameSubmit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleNameSubmit();
                if (e.key === 'Escape') { setEditName(emitter.name); setIsEditing(false); }
              }}
              autoFocus
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <span 
              className="emitter-name"
              onDoubleClick={(e) => { e.stopPropagation(); setIsEditing(true); }}
            >
              {emitter.name}
            </span>
          )}
        </div>
        
        <div className="header-actions">
          <button 
            className={`action-btn ${emitter.visible ? '' : 'off'}`}
            onClick={(e) => { e.stopPropagation(); onUpdate({ visible: !emitter.visible }); }}
            title={emitter.visible ? 'Hide' : 'Show'}
          >
            {emitter.visible ? '◉' : '○'}
          </button>
          <button 
            className={`action-btn ${emitter.active ? 'active' : ''}`}
            onClick={(e) => { e.stopPropagation(); onUpdate({ active: !emitter.active }); }}
            title={emitter.active ? 'Disable' : 'Enable'}
            style={{ color: emitter.active ? typeColor.primary : undefined }}
          >
            ●
          </button>
          <button 
            className="action-btn"
            onClick={(e) => { e.stopPropagation(); onDuplicate(); }}
            title="Duplicate"
          >
            ⧉
          </button>
          <button 
            className="action-btn delete"
            onClick={(e) => { e.stopPropagation(); onRemove(); }}
            title="Delete"
          >
            ×
          </button>
        </div>
      </div>

      {/* All Controls Visible */}
      <EmitterControls 
        emitter={emitter} 
        onUpdate={onUpdate} 
        typeColor={typeColor}
      />

      <style>{`
        .emitter-card {
          background: ${effects.glassmorphism.background};
          backdrop-filter: ${effects.blur.md};
          border: 1px solid ${colors.glass.borderSubtle};
          border-radius: ${radius.lg};
          padding: ${spacing[3]};
          margin-bottom: ${spacing[2]};
          cursor: pointer;
          transition: all ${effects.transition.fast};
        }
        
        .emitter-card:hover {
          border-color: ${colors.glass.border};
          background: rgba(18, 22, 28, 0.82);
        }
        
        .emitter-card.selected {
          border-color: var(--type-color);
          box-shadow: 0 0 0 1px var(--type-color), 0 4px 20px var(--type-glow);
          background: linear-gradient(135deg, var(--type-bg) 0%, ${effects.glassmorphism.background} 100%);
        }
        
        .emitter-card.inactive {
          opacity: 0.5;
        }
        
        .card-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: ${spacing[2.5]};
          padding-bottom: ${spacing[2]};
          border-bottom: 1px solid ${colors.glass.borderSubtle};
        }
        
        .header-left {
          display: flex;
          align-items: center;
          gap: ${spacing[2]};
        }
        
        .type-badge {
          width: 24px;
          height: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--type-bg);
          border-radius: ${radius.sm};
        }
        
        .emitter-name {
          font-family: ${typography.fontFamily.body};
          font-size: ${typography.fontSize.md};
          font-weight: ${typography.fontWeight.semibold};
          color: ${colors.text.primary};
          letter-spacing: ${typography.letterSpacing.tight};
        }
        
        .name-edit {
          background: rgba(0, 0, 0, 0.3);
          border: 1px solid var(--type-color);
          border-radius: ${radius.sm};
          padding: ${spacing[0.5]} ${spacing[2]};
          font-family: ${typography.fontFamily.body};
          font-size: ${typography.fontSize.md};
          color: ${colors.text.primary};
          outline: none;
          width: 120px;
        }
        
        .header-actions {
          display: flex;
          gap: ${spacing[0.5]};
        }
        
        .action-btn {
          width: 24px;
          height: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: transparent;
          border: none;
          border-radius: ${radius.sm};
          color: ${colors.text.muted};
          font-size: 12px;
          cursor: pointer;
          transition: all ${effects.transition.fast};
        }
        
        .action-btn:hover {
          background: ${colors.glass.medium};
          color: ${colors.text.secondary};
        }
        
        .action-btn.off {
          opacity: 0.4;
        }
        
        .action-btn.active {
          text-shadow: 0 0 8px currentColor;
        }
        
        .action-btn.delete:hover {
          color: ${colors.accent.secondary};
          background: rgba(255, 107, 107, 0.15);
        }
      `}</style>
    </motion.div>
  );
};

// ============================================
// Add Emitter Modal
// ============================================

interface AddEmitterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (config: Omit<Emitter, 'id'>) => void;
}

const AddEmitterModal: React.FC<AddEmitterModalProps> = ({ isOpen, onClose, onAdd }) => {
  const [selectedType, setSelectedType] = useState<EmitterType>('point');
  const presets = useMemo(() => getPresetNames(selectedType), [selectedType]);
  const types: EmitterType[] = ['point', 'line', 'circle', 'curve', 'text', 'svg', 'brush'];

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="modal-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="modal-content"
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ type: 'spring', damping: 25 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h2>Add Emitter</h2>
              <button className="close-btn" onClick={onClose}>×</button>
            </div>
            
            <div className="type-grid">
              {types.map((type) => {
                const tc = emitterTypeColors[type];
                return (
                  <button
                    key={type}
                    className={`type-btn ${selectedType === type ? 'active' : ''}`}
                    onClick={() => setSelectedType(type)}
                    style={{ '--tc': tc.primary, '--tcg': tc.glow, '--tcb': tc.bg } as React.CSSProperties}
                  >
                    <TypeIcon type={type} size={20} />
                    <span>{type}</span>
                  </button>
                );
              })}
            </div>
            
            <div className="presets-section">
              <span className="presets-label">Presets</span>
              <div className="presets-grid">
                {presets.map((name) => (
                  <button
                    key={name}
                    className="preset-btn"
                    onClick={() => {
                      const preset = getPreset(selectedType, name);
                      if (preset) { onAdd(preset); onClose(); }
                    }}
                  >
                    {name}
                  </button>
                ))}
              </div>
            </div>
          </motion.div>

          <style>{`
            .modal-overlay {
              position: fixed;
              inset: 0;
              background: rgba(0, 0, 0, 0.7);
              backdrop-filter: blur(8px);
              display: flex;
              align-items: center;
              justify-content: center;
              z-index: ${zIndex.modal};
            }
            
            .modal-content {
              width: 420px;
              max-width: 90vw;
              background: ${effects.glassmorphism.backgroundStrong};
              backdrop-filter: ${effects.glassmorphism.blur};
              border: 1px solid ${colors.glass.border};
              border-radius: ${radius['2xl']};
              padding: ${spacing[5]};
              box-shadow: ${effects.shadow.xl};
            }
            
            .modal-header {
              display: flex;
              align-items: center;
              justify-content: space-between;
              margin-bottom: ${spacing[5]};
            }
            
            .modal-header h2 {
              margin: 0;
              font-family: ${typography.fontFamily.display};
              font-size: ${typography.fontSize['2xl']};
              font-weight: ${typography.fontWeight.bold};
              color: ${colors.text.headline};
              letter-spacing: ${typography.letterSpacing.tight};
            }
            
            .close-btn {
              width: 32px;
              height: 32px;
              display: flex;
              align-items: center;
              justify-content: center;
              background: ${colors.glass.medium};
              border: 1px solid ${colors.glass.borderSubtle};
              border-radius: ${radius.md};
              color: ${colors.text.secondary};
              font-size: 18px;
              cursor: pointer;
              transition: all ${effects.transition.fast};
            }
            
            .close-btn:hover {
              background: ${colors.glass.strong};
              color: ${colors.text.primary};
            }
            
            .type-grid {
              display: grid;
              grid-template-columns: repeat(4, 1fr);
              gap: ${spacing[2]};
              margin-bottom: ${spacing[5]};
            }
            
            .type-btn {
              display: flex;
              flex-direction: column;
              align-items: center;
              gap: ${spacing[1.5]};
              padding: ${spacing[3]} ${spacing[2]};
              background: ${colors.glass.light};
              border: 1px solid ${colors.glass.borderSubtle};
              border-radius: ${radius.lg};
              color: ${colors.text.secondary};
              font-family: ${typography.fontFamily.body};
              font-size: ${typography.fontSize.xs};
              text-transform: uppercase;
              letter-spacing: ${typography.letterSpacing.wide};
              cursor: pointer;
              transition: all ${effects.transition.fast};
            }
            
            .type-btn:hover {
              background: ${colors.glass.medium};
              border-color: ${colors.glass.border};
            }
            
            .type-btn.active {
              background: var(--tcb);
              border-color: var(--tc);
              color: var(--tc);
              box-shadow: 0 0 16px var(--tcg);
            }
            
            .presets-section {
              border-top: 1px solid ${colors.glass.borderSubtle};
              padding-top: ${spacing[4]};
            }
            
            .presets-label {
              display: block;
              font-family: ${typography.fontFamily.body};
              font-size: ${typography.fontSize.xs};
              font-weight: ${typography.fontWeight.semibold};
              color: ${colors.text.muted};
              text-transform: uppercase;
              letter-spacing: ${typography.letterSpacing.widest};
              margin-bottom: ${spacing[3]};
            }
            
            .presets-grid {
              display: grid;
              grid-template-columns: repeat(2, 1fr);
              gap: ${spacing[1.5]};
            }
            
            .preset-btn {
              padding: ${spacing[2.5]} ${spacing[3]};
              background: ${colors.glass.light};
              border: 1px solid ${colors.glass.borderSubtle};
              border-radius: ${radius.md};
              color: ${colors.text.secondary};
              font-family: ${typography.fontFamily.body};
              font-size: ${typography.fontSize.sm};
              text-align: left;
              cursor: pointer;
              transition: all ${effects.transition.fast};
            }
            
            .preset-btn:hover {
              background: ${colors.accent.primaryMuted};
              border-color: ${colors.border.accentSubtle};
              color: ${colors.text.primary};
            }
          `}</style>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

// ============================================
// Main EmitterPanel
// ============================================

export const EmitterPanel: React.FC<EmitterPanelProps> = ({
  emitters,
  selectedIds,
  onAddEmitter,
  onRemoveEmitter,
  onSelectEmitter,
  onUpdateEmitter,
  onDuplicateEmitter,
}) => {
  const [showModal, setShowModal] = useState(false);

  return (
    <aside className="emitter-panel">
      {/* Editorial Header */}
      <header className="panel-header">
        <div className="header-title">
          <span className="title-accent">◈</span>
          <h1>Emitters</h1>
          <span className="count-badge">{emitters.length}</span>
        </div>
        <button className="add-btn" onClick={() => setShowModal(true)}>
          <span className="add-icon">+</span>
          <span className="add-text">New</span>
        </button>
      </header>

      {/* Emitter List */}
      <div className="emitter-list">
        {emitters.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">◇</div>
            <h3>No Emitters</h3>
            <p>Create your first emitter to start the simulation</p>
            <button className="empty-add-btn" onClick={() => setShowModal(true)}>
              + Add Emitter
            </button>
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            {emitters.map((emitter) => (
              <EmitterCard
                key={emitter.id}
                emitter={emitter}
                selected={selectedIds.has(emitter.id)}
                onSelect={(additive) => onSelectEmitter(emitter.id, additive)}
                onUpdate={(updates) => onUpdateEmitter(emitter.id, updates)}
                onRemove={() => onRemoveEmitter(emitter.id)}
                onDuplicate={() => onDuplicateEmitter(emitter.id)}
              />
            ))}
          </AnimatePresence>
        )}
      </div>

      {/* Add Modal */}
      <AddEmitterModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onAdd={onAddEmitter}
      />

      <style>{`
        .emitter-panel {
          display: flex;
          flex-direction: column;
          height: 100%;
          width: 320px;
          background: ${effects.glassmorphism.backgroundStrong};
          backdrop-filter: ${effects.glassmorphism.blur};
          border: 1px solid ${colors.glass.border};
          border-radius: ${radius['2xl']};
        }
        
        .panel-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: ${spacing[4]} ${spacing[4]};
          border-bottom: 1px solid ${colors.glass.borderSubtle};
          background: ${colors.gradient.glassVertical};
        }
        
        .header-title {
          display: flex;
          align-items: center;
          gap: ${spacing[2]};
        }
        
        .title-accent {
          font-size: ${typography.fontSize.xl};
          color: ${colors.accent.primary};
        }
        
        .panel-header h1 {
          margin: 0;
          font-family: ${typography.fontFamily.display};
          font-size: ${typography.fontSize.xl};
          font-weight: ${typography.fontWeight.bold};
          color: ${colors.text.headline};
          letter-spacing: ${typography.letterSpacing.tight};
        }
        
        .count-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 20px;
          height: 20px;
          padding: 0 ${spacing[1.5]};
          background: ${colors.accent.primaryMuted};
          border-radius: ${radius.full};
          font-family: ${typography.fontFamily.mono};
          font-size: ${typography.fontSize.xs};
          font-weight: ${typography.fontWeight.semibold};
          color: ${colors.accent.primary};
        }
        
        .add-btn {
          display: flex;
          align-items: center;
          gap: ${spacing[1.5]};
          padding: ${spacing[2]} ${spacing[3]};
          background: ${colors.accent.primaryMuted};
          border: 1px solid ${colors.border.accentSubtle};
          border-radius: ${radius.md};
          color: ${colors.accent.primary};
          font-family: ${typography.fontFamily.body};
          font-size: ${typography.fontSize.sm};
          font-weight: ${typography.fontWeight.semibold};
          cursor: pointer;
          transition: all ${effects.transition.fast};
        }
        
        .add-btn:hover {
          background: ${colors.accent.primary};
          color: ${colors.text.inverse};
          box-shadow: ${effects.shadow.glow};
        }
        
        .add-icon {
          font-size: ${typography.fontSize.lg};
          line-height: 1;
        }
        
        .emitter-list {
          flex: 1;
          overflow-y: auto;
          padding: ${spacing[3]};
        }
        
        .empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: ${spacing[10]} ${spacing[4]};
          text-align: center;
        }
        
        .empty-icon {
          font-size: 48px;
          color: ${colors.accent.primary};
          opacity: 0.3;
          margin-bottom: ${spacing[4]};
        }
        
        .empty-state h3 {
          margin: 0 0 ${spacing[1]};
          font-family: ${typography.fontFamily.display};
          font-size: ${typography.fontSize.lg};
          font-weight: ${typography.fontWeight.semibold};
          color: ${colors.text.secondary};
        }
        
        .empty-state p {
          margin: 0 0 ${spacing[5]};
          font-size: ${typography.fontSize.sm};
          color: ${colors.text.muted};
          max-width: 200px;
        }
        
        .empty-add-btn {
          padding: ${spacing[3]} ${spacing[5]};
          background: ${colors.accent.primary};
          border: none;
          border-radius: ${radius.md};
          color: ${colors.text.inverse};
          font-family: ${typography.fontFamily.body};
          font-size: ${typography.fontSize.sm};
          font-weight: ${typography.fontWeight.semibold};
          cursor: pointer;
          transition: all ${effects.transition.fast};
          box-shadow: ${effects.shadow.glow};
        }
        
        .empty-add-btn:hover {
          transform: translateY(-1px);
          box-shadow: ${effects.shadow.glowStrong};
        }
      `}</style>
    </aside>
  );
};

export default EmitterPanel;
