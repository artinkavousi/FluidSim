/**
 * @package studio/panels
 * UnifiedPanel v4 - Single Continuous View
 * Everything in one scrollable panel - no tabs, no separate views
 */

import React, { useState, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { emitterTypeColors } from '../ui';
import { useStudioStore } from '../store';
import type {
  Emitter, EmitterType, DirectionMode,
  LineEmitter, CircleEmitter, CurveEmitter, TextEmitter, SVGEmitter, BrushEmitter
} from '../../fluid-2d/emitters/types';
import type { Color3 } from '../../fluid-2d/types';
import { defaultPostFxOrder, sanitizePostFxOrder, type PostFxEffectId, type RenderOutput2DConfig } from '../../fluid-2d/render/RenderOutput2D';
import { getPresetNames, getPreset } from '../../fluid-2d/emitters/presets';

// ============================================
// Utilities
// ============================================

const c3hex = (c: Color3): string =>
  `#${[c[0], c[1], c[2]].map(v => Math.round(v * 255).toString(16).padStart(2, '0')).join('')}`;

const hex2c3 = (h: string): Color3 => {
  const x = h.replace('#', '');
  return [parseInt(x.slice(0, 2), 16) / 255, parseInt(x.slice(2, 4), 16) / 255, parseInt(x.slice(4, 6), 16) / 255];
};

// ============================================
// Types
// ============================================

interface UnifiedPanelProps {
  emitters: Emitter[];
  selectedIds: Set<string>;
  onAddEmitter: (config: Omit<Emitter, 'id'>) => string;
  onRemoveEmitter: (id: string) => void;
  onSelectEmitter: (id: string, additive?: boolean) => void;
  onDeselectAll: () => void;
  onUpdateEmitter: (id: string, updates: Partial<Emitter>) => void;
  onDuplicateEmitter: (id: string) => void;
}

// ============================================
// Micro Controls
// ============================================

const Slider: React.FC<{
  label: string; v: number; min: number; max: number; step?: number;
  onChange: (v: number) => void; accent?: string; unit?: string;
}> = ({ label, v, min, max, step = 0.01, onChange, accent = '#00e5cc', unit = '' }) => {
  const pct = ((v - min) / (max - min)) * 100;
  return (
    <div className="ctrl-slider">
      <div className="cs-head">
        <span className="cs-label">{label}</span>
        <span className="cs-val">{v.toFixed(step >= 1 ? 0 : step >= 0.1 ? 1 : 2)}{unit}</span>
      </div>
      <div className="cs-track">
        <div className="cs-fill" style={{ width: `${pct}%`, background: accent }} />
        <input type="range" min={min} max={max} step={step} value={v}
          onChange={e => onChange(parseFloat(e.target.value))} />
      </div>
    </div>
  );
};

const Num: React.FC<{
  label: string; v: number; step?: number; onChange: (v: number) => void;
}> = ({ label, v, step = 0.01, onChange }) => (
  <div className="ctrl-num">
    <span className="cn-label">{label}</span>
    <input type="number" value={v.toFixed(step >= 1 ? 0 : 2)} step={step}
      onChange={e => onChange(parseFloat(e.target.value) || 0)} />
  </div>
);

const Toggle: React.FC<{
  options: { l: string; v: any }[];
  value: any; onChange: (v: any) => void; accent?: string;
}> = ({ options, value, onChange, accent = '#00e5cc' }) => (
  <div className="ctrl-toggle">
    {options.map(o => (
      <button key={String(o.v)} className={value === o.v ? 'active' : ''}
        style={{ '--ta': accent } as React.CSSProperties}
        onClick={() => onChange(o.v)}>{o.l}</button>
    ))}
  </div>
);

const Color: React.FC<{ c: Color3; onChange: (c: Color3) => void }> = ({ c, onChange }) => (
  <div className="ctrl-color">
    <input type="color" value={c3hex(c)} onChange={e => onChange(hex2c3(e.target.value))} />
    <span>{c3hex(c).toUpperCase()}</span>
  </div>
);

const Select: React.FC<{
  value: string; options: { l: string; v: string }[]; onChange: (v: string) => void;
}> = ({ value, options, onChange }) => (
  <select className="ctrl-select" value={value} onChange={e => onChange(e.target.value)}>
    {options.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
  </select>
);

const Chip: React.FC<{
  active?: boolean; onClick: () => void; children: React.ReactNode; accent?: string;
}> = ({ active, onClick, children, accent = '#00e5cc' }) => (
  <button className={`ctrl-chip ${active ? 'active' : ''}`}
    style={{ '--ca': accent } as React.CSSProperties} onClick={onClick}>{children}</button>
);

const postFxLabel: Record<PostFxEffectId, string> = {
  grading: 'Grading',
  vignette: 'Vignette',
  bloom: 'Bloom',
  sharpen: 'Sharpen',
  motionBlur: 'Motion Blur',
  chromatic: 'Chromatic',
  rgbShift: 'RGB Shift',
  clarity: 'Clarity',
  grain: 'Grain',
  afterImage: 'AfterImage',
  trails: 'Trails',
};

function postFxIsActive(id: PostFxEffectId, postConfig: RenderOutput2DConfig): boolean {
  if (id === 'grading') return true;
  if (id === 'vignette') return true;
  if (id === 'bloom') return (postConfig.bloomIntensity ?? 0) > 1e-3;
  if (id === 'sharpen') return postConfig.sharpenEnabled ?? false;
  if (id === 'motionBlur') return postConfig.motionBlurEnabled ?? false;
  if (id === 'chromatic') return (postConfig.chromaticAberration ?? 0) > 1e-6;
  if (id === 'rgbShift') return postConfig.rgbShiftEnabled ?? false;
  if (id === 'clarity') return (postConfig.clarity ?? 0) > 1e-6;
  if (id === 'grain') return (postConfig.noiseIntensity ?? 0) > 1e-6;
  if (id === 'afterImage') return postConfig.afterImageEnabled ?? false;
  if (id === 'trails') return postConfig.trailEnabled ?? false;
  return false;
}

function movePostFxOrder(order: PostFxEffectId[], id: PostFxEffectId, dir: -1 | 1): PostFxEffectId[] {
  const idx = order.indexOf(id);
  if (idx < 0) return order;
  const next = idx + dir;
  if (next < 0 || next >= order.length) return order;
  const copy = order.slice();
  const tmp = copy[idx];
  copy[idx] = copy[next];
  copy[next] = tmp;
  return copy;
}

// ============================================
// Section Divider
// ============================================

const Divider: React.FC<{ children: React.ReactNode; accent?: string }> = ({ children, accent = '#00e5cc' }) => (
  <div className="divider" style={{ '--da': accent } as React.CSSProperties}>
    <span>{children}</span>
    <div className="div-line" />
  </div>
);

// ============================================
// Emitter Card - Full Inline Properties
// ============================================

const EmitterCard: React.FC<{
  em: Emitter;
  expanded: boolean;
  onToggleExpand: () => void;
  onUpdate: (u: Partial<Emitter>) => void;
  onRemove: () => void;
  onDuplicate: () => void;
}> = ({ em, expanded, onToggleExpand, onUpdate, onRemove, onDuplicate }) => {
  const tc = emitterTypeColors[em.type];
  const icons: Record<EmitterType, string> = {
    point: '●', line: '━', circle: '◯', curve: '〰', text: 'A', svg: '◇', brush: '✎'
  };

  const dirModes: { l: string; v: DirectionMode }[] = [
    { l: 'Fixed', v: 'fixed' }, { l: 'Normal', v: 'normal' }, { l: 'Tangent', v: 'tangent' },
    { l: 'Out', v: 'outward' }, { l: 'In', v: 'inward' }, { l: 'Rand', v: 'random' }
  ];

  const updateSplatOverrides = (updates: Record<string, number | undefined>): void => {
    const current = em.splatOverrides ?? {};
    const next: Record<string, number | undefined> = { ...(current as Record<string, number | undefined>), ...updates };
    Object.keys(next).forEach((k) => {
      if (next[k] === undefined) delete next[k];
    });
    onUpdate({ splatOverrides: Object.keys(next).length ? (next as any) : undefined });
  };

  return (
    <div className={`emitter-card ${expanded ? 'expanded' : ''}`}
      style={{ '--ec': tc?.primary || '#00e5cc' } as React.CSSProperties}>

      {/* Header - Always Visible */}
      <div className="ec-header" onClick={onToggleExpand}>
        <span className="ec-icon">{icons[em.type]}</span>
        <Color c={em.color} onChange={c => onUpdate({ color: c })} />
        <input className="ec-name" value={em.name} onClick={e => e.stopPropagation()}
          onChange={e => onUpdate({ name: e.target.value })} />
        <div className="ec-actions">
          <Chip active={em.active} onClick={() => onUpdate({ active: !em.active })} accent={tc?.primary}>
            {em.active ? '●' : '○'}
          </Chip>
          <button className="ec-btn" onClick={e => { e.stopPropagation(); onDuplicate(); }} title="Duplicate">⧉</button>
          <button className="ec-btn danger" onClick={e => { e.stopPropagation(); onRemove(); }} title="Delete">×</button>
        </div>
        <span className={`ec-expand ${expanded ? 'open' : ''}`}>▾</span>
      </div>

      {/* Properties - Expanded */}
      <AnimatePresence>
        {expanded && (
          <motion.div className="ec-body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}>

            {/* Row 1: Transform */}
            <div className="ec-row r4">
              <Slider label="X" v={em.position[0]} min={0} max={1} step={0.001}
                onChange={v => onUpdate({ position: [v, em.position[1]] })} accent={tc?.primary} />
              <Slider label="Y" v={em.position[1]} min={0} max={1} step={0.001}
                onChange={v => onUpdate({ position: [em.position[0], v] })} accent={tc?.primary} />
              <Slider label="Rot" v={em.rotation || 0} min={0} max={360} step={1} unit="°"
                onChange={v => onUpdate({ rotation: v })} accent={tc?.primary} />
              <Num label="Scale" v={em.scale?.[0] || 1} step={0.1}
                onChange={v => onUpdate({ scale: [v, v] })} />
            </div>

            {/* Row 2: Emission */}
            <div className="ec-row r4">
              <Slider label="Force" v={em.force} min={0} max={10} step={0.05}
                onChange={v => onUpdate({ force: v })} accent="#ff6b6b" />
              <Slider label="Rate" v={em.emissionRate} min={0} max={200} step={1}
                onChange={v => onUpdate({ emissionRate: v })} accent="#ff6b6b" />
              <Slider label="Radius" v={em.radius} min={0.001} max={0.2} step={0.001}
                onChange={v => onUpdate({ radius: v })} accent="#ff6b6b" />
              <Slider label="Temp" v={em.temperature ?? 0} min={0} max={10} step={0.1}
                onChange={v => onUpdate({ temperature: v })} accent="#f97316" />
            </div>

            {/* Row 3: Modulators */}
            <div className="ec-row r3">
              <Slider label="F Scale" v={em.forceScale} min={0.1} max={3} step={0.05}
                onChange={v => onUpdate({ forceScale: v })} accent="#ff6b6b" />
              <Slider label="R Scale" v={em.radiusScale} min={0.1} max={3} step={0.05}
                onChange={v => onUpdate({ radiusScale: v })} accent="#ff6b6b" />
              <Slider label="Opacity" v={em.opacity} min={0} max={1} step={0.01}
                onChange={v => onUpdate({ opacity: v })} accent="#ff6b6b" />
            </div>

            {/* Row 4: Direction & Spread */}
            <div className="ec-row inline">
              <span className="ec-label">Direction</span>
              <Toggle options={dirModes} value={em.directionMode || 'fixed'}
                onChange={v => onUpdate({ directionMode: v })} accent="#a78bfa" />
              <Num label="Spread" v={em.spread} step={1}
                onChange={v => onUpdate({ spread: v })} />
            </div>

            {/* Row 5: Splat Overrides */}
            <div className="ec-row inline">
              <span className="ec-label">Splat</span>
              <Toggle options={[{ l: 'S', v: 0 }, { l: 'M', v: 1 }, { l: 'H', v: 2 }, { l: 'U', v: 3 }]}
                value={em.splatOverrides?.splatFalloff ?? -1}
                onChange={v => updateSplatOverrides({ splatFalloff: v < 0 ? undefined : v })}
                accent="#fbbf24" />
              <Toggle options={[{ l: 'Add', v: 0 }, { l: 'Max', v: 1 }, { l: 'Mix', v: 2 }]}
                value={em.splatOverrides?.blendMode ?? -1}
                onChange={v => updateSplatOverrides({ blendMode: v < 0 ? undefined : v })}
                accent="#fbbf24" />
              <Slider label="Dye" v={em.splatOverrides?.dyeIntensity ?? -1} min={-1} max={20} step={0.5}
                onChange={v => updateSplatOverrides({ dyeIntensity: v < 0 ? undefined : v })} accent="#fbbf24" />
            </div>

            {/* Type-Specific Properties */}
            {em.type === 'line' && <LineProps em={em as LineEmitter} onU={onUpdate} />}
            {em.type === 'circle' && <CircleProps em={em as CircleEmitter} onU={onUpdate} />}
            {em.type === 'curve' && <CurveProps em={em as CurveEmitter} onU={onUpdate} />}
            {em.type === 'text' && <TextProps em={em as TextEmitter} onU={onUpdate} />}
            {em.type === 'svg' && <SVGProps em={em as SVGEmitter} onU={onUpdate} />}
            {em.type === 'brush' && <BrushProps em={em as BrushEmitter} onU={onUpdate} />}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ============================================
// Type-Specific Inline Properties
// ============================================

const LineProps: React.FC<{ em: LineEmitter; onU: (u: Partial<LineEmitter>) => void }> = ({ em, onU }) => (
  <div className="ec-type">
    <div className="ec-row r5">
      <Slider label="Segs" v={em.segments} min={1} max={64} step={1} onChange={v => onU({ segments: v })} accent="#60a5fa" />
      <Num label="X₁" v={em.start[0]} step={0.01} onChange={v => onU({ start: [v, em.start[1]] })} />
      <Num label="Y₁" v={em.start[1]} step={0.01} onChange={v => onU({ start: [em.start[0], v] })} />
      <Num label="X₂" v={em.end[0]} step={0.01} onChange={v => onU({ end: [v, em.end[1]] })} />
      <Num label="Y₂" v={em.end[1]} step={0.01} onChange={v => onU({ end: [em.end[0], v] })} />
    </div>
  </div>
);

const CircleProps: React.FC<{ em: CircleEmitter; onU: (u: Partial<CircleEmitter>) => void }> = ({ em, onU }) => (
  <div className="ec-type">
    <div className="ec-row r4">
      <Slider label="Outer" v={em.outerRadius} min={0.01} max={0.5} step={0.01} onChange={v => onU({ outerRadius: v })} accent="#a78bfa" />
      <Slider label="Inner" v={em.innerRadius} min={0} max={0.5} step={0.01} onChange={v => onU({ innerRadius: v })} accent="#a78bfa" />
      <Slider label="Points" v={em.points} min={3} max={128} step={1} onChange={v => onU({ points: v })} accent="#a78bfa" />
      <Toggle options={[{ l: 'Out', v: false }, { l: 'In', v: true }]}
        value={em.inward} onChange={v => onU({ inward: v })} accent="#a78bfa" />
    </div>
    <div className="ec-row r2">
      <Slider label="Arc Start" v={em.arc[0]} min={0} max={360} step={1} unit="°" onChange={v => onU({ arc: [v, em.arc[1]] })} accent="#a78bfa" />
      <Slider label="Arc End" v={em.arc[1]} min={0} max={360} step={1} unit="°" onChange={v => onU({ arc: [em.arc[0], v] })} accent="#a78bfa" />
    </div>
  </div>
);

const CurveProps: React.FC<{ em: CurveEmitter; onU: (u: Partial<CurveEmitter>) => void }> = ({ em, onU }) => (
  <div className="ec-type">
    <div className="ec-row inline">
      <span className="ec-label">Curve</span>
      <Toggle options={[{ l: 'Quad', v: 'quadratic' }, { l: 'Cubic', v: 'cubic' }, { l: 'Cat', v: 'catmull' }]}
        value={em.curveType} onChange={v => onU({ curveType: v })} accent="#ff6b6b" />
      <span className="ec-info">{em.controlPoints.length} pts</span>
    </div>
    <div className="ec-row r3">
      <Slider label="Samples" v={em.samples} min={4} max={256} step={1} onChange={v => onU({ samples: v })} accent="#ff6b6b" />
      <Slider label="Anim" v={em.animationSpeed} min={0} max={5} step={0.05} onChange={v => onU({ animationSpeed: v })} accent="#ff6b6b" />
    </div>
  </div>
);

const TextProps: React.FC<{ em: TextEmitter; onU: (u: Partial<TextEmitter>) => void }> = ({ em, onU }) => (
  <div className="ec-type">
    <div className="ec-row inline">
      <input className="ctrl-text" type="text" value={em.text} placeholder="Text..."
        onChange={e => onU({ text: e.target.value })} />
    </div>
    <div className="ec-row r4">
      <Slider label="Size" v={em.fontSize} min={12} max={256} step={1} onChange={v => onU({ fontSize: v })} accent="#fbbf24" />
      <Slider label="Samples" v={em.samples} min={8} max={512} step={1} onChange={v => onU({ samples: v })} accent="#fbbf24" />
      <Slider label="Weight" v={em.fontWeight} min={100} max={900} step={100} onChange={v => onU({ fontWeight: v })} accent="#fbbf24" />
      <Slider label="Space" v={em.letterSpacing} min={-20} max={50} step={1} onChange={v => onU({ letterSpacing: v })} accent="#fbbf24" />
    </div>
    <div className="ec-row inline">
      <Chip active={em.outline} onClick={() => onU({ outline: !em.outline })} accent="#fbbf24">Outline</Chip>
    </div>
  </div>
);

const SVGProps: React.FC<{ em: SVGEmitter; onU: (u: Partial<SVGEmitter>) => void }> = ({ em, onU }) => (
  <div className="ec-type">
    <div className="ec-row r3">
      <Slider label="Samples" v={em.samples} min={8} max={512} step={1} onChange={v => onU({ samples: v })} accent="#f472b6" />
      <Chip active={em.normalizeSize} onClick={() => onU({ normalizeSize: !em.normalizeSize })} accent="#f472b6">Normalize</Chip>
      <span className="ec-info">{em.svgPath.length} chars</span>
    </div>
  </div>
);

const BrushProps: React.FC<{ em: BrushEmitter; onU: (u: Partial<BrushEmitter>) => void }> = ({ em, onU }) => (
  <div className="ec-type">
    <div className="ec-row r4">
      <Slider label="Size" v={em.brushSize} min={0.001} max={0.2} step={0.001} onChange={v => onU({ brushSize: v })} accent="#34d399" />
      <Slider label="Hard" v={em.brushHardness} min={0} max={1} step={0.01} onChange={v => onU({ brushHardness: v })} accent="#34d399" />
      <Select value={em.playbackMode} options={[{ l: 'Once', v: 'once' }, { l: 'Loop', v: 'loop' }, { l: 'Ping', v: 'pingpong' }]} onChange={v => onU({ playbackMode: v as any })} />
      <Slider label="Speed" v={em.playbackSpeed} min={0.1} max={5} step={0.1} onChange={v => onU({ playbackSpeed: v })} accent="#34d399" />
    </div>
    <div className="ec-row inline">
      <span className="ec-info">{em.strokes.length} strokes</span>
    </div>
  </div>
);

// ============================================
// Inline Emitter Type Bar - Always Visible
// ============================================

const EmitterTypeBar: React.FC<{
  onAdd: (cfg: Omit<Emitter, 'id'>) => void;
}> = ({ onAdd }) => {
  const [selectedType, setSelectedType] = useState<EmitterType | null>(null);
  const presets = selectedType ? getPresetNames(selectedType) : [];

  const types: { t: EmitterType; icon: string }[] = [
    { t: 'point', icon: '●' }, { t: 'line', icon: '━' }, { t: 'circle', icon: '◯' },
    { t: 'curve', icon: '〰' }, { t: 'text', icon: 'A' }, { t: 'svg', icon: '◇' }, { t: 'brush', icon: '✎' }
  ];

  const handleTypeClick = (type: EmitterType) => {
    if (selectedType === type) {
      // Double click same type = add default preset
      const p = getPreset(type, getPresetNames(type)[0]);
      if (p) onAdd(p);
      setSelectedType(null);
    } else {
      setSelectedType(type);
    }
  };

  const handlePresetClick = (name: string) => {
    if (selectedType) {
      const p = getPreset(selectedType, name);
      if (p) onAdd(p);
      setSelectedType(null);
    }
  };

  return (
    <div className="emitter-bar">
      <div className="eb-label">ADD</div>
      <div className="eb-types">
        {types.map(t => (
          <button key={t.t}
            className={`eb-type ${selectedType === t.t ? 'active' : ''}`}
            style={{ '--etc': emitterTypeColors[t.t]?.primary } as React.CSSProperties}
            onClick={() => handleTypeClick(t.t)}
            title={`Add ${t.t} emitter`}>
            <span className="eb-icon">{t.icon}</span>
          </button>
        ))}
      </div>

      {/* Inline Presets - shows when type selected */}
      <AnimatePresence>
        {selectedType && presets.length > 0 && (
          <motion.div className="eb-presets"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}>
            {presets.map(name => (
              <button key={name} className="eb-preset" onClick={() => handlePresetClick(name)}>
                {name}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ============================================
// Main Panel - Single Continuous View
// ============================================

export const UnifiedPanel: React.FC<UnifiedPanelProps> = ({
  emitters, selectedIds, onAddEmitter, onRemoveEmitter, onSelectEmitter,
  onDeselectAll, onUpdateEmitter, onDuplicateEmitter
}) => {
  const config = useStudioStore(s => s.config);
  const setConfig = useStudioStore(s => s.setConfig);
  const setFluidConfig = useStudioStore(s => s.setFluidConfig);
  const postConfig = useStudioStore(s => s.postConfig);
  const setPostConfig = useStudioStore(s => s.setPostConfig);
  const fps = useStudioStore(s => s.fps);
  const perf = useStudioStore(s => s.perf);
  const isPlaying = useStudioStore(s => s.isPlaying);
  const setIsPlaying = useStudioStore(s => s.setIsPlaying);
  const gizmosEnabled = useStudioStore(s => s.gizmosEnabled);
  const setGizmosEnabled = useStudioStore(s => s.setGizmosEnabled);
  const mouseEnabled = useStudioStore(s => s.mouseEnabled);
  const setMouseEnabled = useStudioStore(s => s.setMouseEnabled);
  const mouseHoverMode = useStudioStore(s => s.mouseHoverMode);
  const setMouseHoverMode = useStudioStore(s => s.setMouseHoverMode);
  const activePanelSection = useStudioStore(s => s.activePanelSection);
  const setActivePanelSection = useStudioStore(s => s.setActivePanelSection);
  const canUndo = useStudioStore(s => s.canUndo);
  const canRedo = useStudioStore(s => s.canRedo);
  const undo = useStudioStore(s => s.undo);
  const redo = useStudioStore(s => s.redo);

  // Track which emitters are expanded (all by default if few, or first one)
  const [expanded, setExpanded] = useState<Set<string>>(() => {
    const set = new Set<string>();
    if (emitters.length <= 3) emitters.forEach(e => set.add(e.id));
    else if (emitters.length > 0) set.add(emitters[0].id);
    return set;
  });

  const [postFxSelected, setPostFxSelected] = useState<PostFxEffectId>('bloom');
  const postFxOrder = useMemo(
    () => sanitizePostFxOrder((postConfig as any).postFxOrder ?? defaultPostFxOrder),
    [postConfig.postFxOrder]
  );

  const gradientMapFileRef = useRef<HTMLInputElement | null>(null);
  const lutFileRef = useRef<HTMLInputElement | null>(null);

  const toggleExpand = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <aside className="unified-panel">
      {/* Header */}
      <header className="up-header">
        <div className="up-brand">
          <span className="up-logo">◈</span>
          <span className="up-title">FLUID</span>
        </div>
        <div className="up-ctrls">
          <Chip active={!isPlaying} onClick={() => setIsPlaying(!isPlaying)}>{isPlaying ? '⏸' : '▶'}</Chip>
          <Chip onClick={undo}>↩</Chip>
          <Chip onClick={redo}>↪</Chip>
        </div>
      </header>

      {/* Tabs */}
      <div className="up-tabs">
        <Toggle
          options={[
            { l: 'Emitters', v: 'emitters' },
            { l: 'Sim', v: 'simulation' },
            { l: 'Render', v: 'rendering' },
          ]}
          value={activePanelSection}
          onChange={setActivePanelSection}
        />
      </div>

      {/* Scrollable Content */}
      <div className="up-content">

        {activePanelSection === 'emitters' && (
          <>
            {/* EMITTERS */}
            <Divider accent="#00e5cc">EMITTERS</Divider>

            {/* Inline Type Bar - Always Visible */}
            <EmitterTypeBar onAdd={onAddEmitter} />

            {emitters.length === 0 ? (
              <div className="empty-msg">Select a type above to add emitter</div>
            ) : (
              <div className="emitter-list">
                {emitters.map(em => (
                  <EmitterCard key={em.id} em={em}
                    expanded={expanded.has(em.id)}
                    onToggleExpand={() => toggleExpand(em.id)}
                    onUpdate={u => onUpdateEmitter(em.id, u)}
                    onRemove={() => onRemoveEmitter(em.id)}
                    onDuplicate={() => onDuplicateEmitter(em.id)} />
                ))}
              </div>
            )}
          </>
        )}

        {activePanelSection === 'simulation' && (
          <>
            <Divider accent="#a78bfa">SIMULATION</Divider>

            <div className="global-group">
              <span className="gg-title">Resolution</span>
              <div className="gg-row inline">
                <span className="gg-label">Grid</span>
                <Select
                  value={String(config.gridSize ?? 256)}
                  options={[64, 96, 128, 160, 192, 256, 320, 384, 512].map(v => ({ l: `${v}`, v: `${v}` }))}
                  onChange={v => setFluidConfig({ gridSize: Math.max(32, Math.round(parseInt(v, 10) || 256)) })}
                />
                <span className="gg-label">Dye</span>
                <Select
                  value={String(config.dyeSize ?? 512)}
                  options={[128, 192, 256, 320, 384, 512, 768, 1024].map(v => ({ l: `${v}`, v: `${v}` }))}
                  onChange={v => setFluidConfig({ dyeSize: Math.max(64, Math.round(parseInt(v, 10) || 512)) })}
                />
              </div>
              <div className="gg-row r2">
                <Slider label="Sim Speed" v={config.simSpeed ?? 1.0} min={0} max={3} step={0.01}
                  onChange={v => setFluidConfig({ simSpeed: v })} accent="#a78bfa" />
                <Slider label="Gravity Y" v={(config.gravity?.[1] ?? 0)} min={-20} max={20} step={0.1}
                  onChange={v => setFluidConfig({ gravity: [config.gravity?.[0] ?? 0, v] })} accent="#a78bfa" />
              </div>
              <div className="gg-row r2">
                <Slider label="Gravity X" v={(config.gravity?.[0] ?? 0)} min={-20} max={20} step={0.1}
                  onChange={v => setFluidConfig({ gravity: [v, config.gravity?.[1] ?? 0] })} accent="#a78bfa" />
                <Toggle
                  options={[{ l: 'No Sym', v: 0 }, { l: 'Mirror X', v: 1 }, { l: 'Mirror Y', v: 2 }, { l: 'Both', v: 3 }]}
                  value={config.symmetry ?? 0}
                  onChange={v => setFluidConfig({ symmetry: v })}
                  accent="#a78bfa"
                />
              </div>
              <div className="gg-row inline">
                <Chip active={config.containFluid ?? false} onClick={() => setFluidConfig({ containFluid: !(config.containFluid ?? false) })} accent="#a78bfa">
                  Contain {config.containFluid ? 'On' : 'Off'}
                </Chip>
                <Chip
                  active={config.autoQualityEnabled ?? false}
                  onClick={() => setFluidConfig({ autoQualityEnabled: !(config.autoQualityEnabled ?? false) })}
                  accent="#22c55e"
                >
                  Auto Q {(config.autoQualityEnabled ?? false) ? 'On' : 'Off'}
                </Chip>
                <Chip onClick={() => {
                  setFluidConfig({ gridSize: 128, dyeSize: 256, pressureIterations: 14, advectionMode: 0 });
                  setPostConfig({ postEnabled: false, bloomIntensity: 0.0 });
                }} accent="#22c55e">
                  Fast
                </Chip>
                <Chip onClick={() => {
                  setFluidConfig({ gridSize: 192, dyeSize: 384, pressureIterations: 22, advectionMode: 0 });
                  setPostConfig({ postEnabled: true, bloomIntensity: 0.2 });
                }} accent="#f59e0b">
                  Balanced
                </Chip>
                <Chip onClick={() => {
                  setFluidConfig({ gridSize: 256, dyeSize: 512, pressureIterations: 30, advectionMode: 1 });
                  setPostConfig({ postEnabled: true, bloomIntensity: 0.3 });
                }} accent="#60a5fa">
                  Quality
                </Chip>
              </div>
              {(config.autoQualityEnabled ?? false) && (
                <>
                  <div className="gg-row r2">
                    <Slider label="Target FPS" v={config.autoQualityTargetFps ?? 60} min={15} max={120} step={1}
                      onChange={v => setFluidConfig({ autoQualityTargetFps: v })} accent="#22c55e" />
                    <Slider label="Cooldown" v={config.autoQualityCooldownSec ?? 1.5} min={0.25} max={5.0} step={0.05}
                      onChange={v => setFluidConfig({ autoQualityCooldownSec: v })} accent="#22c55e" unit="s" />
                  </div>
                  <div className="gg-row inline">
                    <span className="gg-label">Min Grid</span>
                    <Select
                      value={String(config.autoQualityMinGridSize ?? 96)}
                      options={[64, 96, 128, 160, 192, 256].map(v => ({ l: `${v}`, v: `${v}` }))}
                      onChange={v => setFluidConfig({ autoQualityMinGridSize: Math.max(32, Math.round(parseInt(v, 10) || 96)) })}
                    />
                    <span className="gg-label">Max Grid</span>
                    <Select
                      value={String(config.autoQualityMaxGridSize ?? 256)}
                      options={[128, 160, 192, 256, 320, 384, 512].map(v => ({ l: `${v}`, v: `${v}` }))}
                      onChange={v => setFluidConfig({ autoQualityMaxGridSize: Math.max(32, Math.round(parseInt(v, 10) || 256)) })}
                    />
                  </div>
                  <div className="gg-row inline">
                    <span className="gg-label">Min Dye</span>
                    <Select
                      value={String(config.autoQualityMinDyeSize ?? 192)}
                      options={[128, 192, 256, 320, 384].map(v => ({ l: `${v}`, v: `${v}` }))}
                      onChange={v => setFluidConfig({ autoQualityMinDyeSize: Math.max(64, Math.round(parseInt(v, 10) || 192)) })}
                    />
                    <span className="gg-label">Max Dye</span>
                    <Select
                      value={String(config.autoQualityMaxDyeSize ?? 512)}
                      options={[256, 320, 384, 512, 768, 1024].map(v => ({ l: `${v}`, v: `${v}` }))}
                      onChange={v => setFluidConfig({ autoQualityMaxDyeSize: Math.max(64, Math.round(parseInt(v, 10) || 512)) })}
                    />
                  </div>
                </>
              )}
            </div>

            {/* Performance */}
            <div className="global-group">
              <span className="gg-title">Performance</span>
              <div className="gg-row inline">
                <Chip
                  active={config.perfEnabled ?? false}
                  onClick={() => setFluidConfig({ perfEnabled: !(config.perfEnabled ?? false) })}
                  accent="#22c55e"
                >
                  Perf {(config.perfEnabled ?? false) ? 'On' : 'Off'}
                </Chip>
                <span className="gg-label">FPS {Number.isFinite(fps) ? fps.toFixed(0) : '--'}</span>
                <span className="gg-label">Frame {perf ? `${perf.frameMs.toFixed(2)}ms` : '--'}</span>
                <span className="gg-label">Sub {perf ? `${perf.substeps}` : '--'}</span>
              </div>
              <div className="gg-row r2">
                <Slider label="Max Splats" v={config.maxSplatsPerFrame ?? 32} min={0} max={256} step={1}
                  onChange={v => setFluidConfig({ maxSplatsPerFrame: v })} accent="#22c55e" />
                <div />
              </div>
              {(config.perfEnabled ?? false) && (
                <>
                  <div className="gg-row r2">
                    <Slider label="Smoothing" v={config.perfSmoothing ?? 0.12} min={0.02} max={0.5} step={0.01}
                      onChange={v => setFluidConfig({ perfSmoothing: v })} accent="#22c55e" />
                    <div />
                  </div>
                  {perf && (
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr auto',
                        gap: '6px 10px',
                        padding: '8px 10px',
                        borderRadius: 10,
                        background: 'rgba(0,0,0,0.18)',
                        border: '1px solid rgba(255,255,255,0.06)',
                        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, \"Liberation Mono\", \"Courier New\", monospace',
                        fontSize: 12,
                        opacity: 0.9,
                      }}
                    >
                      <span>Splats</span><span>{perf.splatsMs.toFixed(2)}ms</span>
                      <span>Vorticity</span><span>{perf.vorticityMs.toFixed(2)}ms</span>
                      <span>Advect Vel</span><span>{perf.advectVelocityMs.toFixed(2)}ms</span>
                      <span>Viscosity</span><span>{perf.viscosityMs.toFixed(2)}ms</span>
                      <span>Forces</span><span>{perf.forcesMs.toFixed(2)}ms</span>
                      <span>Divergence</span><span>{perf.divergenceMs.toFixed(2)}ms</span>
                      <span>Pressure</span><span>{perf.pressureMs.toFixed(2)}ms</span>
                      <span>Projection</span><span>{perf.projectionMs.toFixed(2)}ms</span>
                      <span>Boundary Vel</span><span>{perf.boundaryVelocityMs.toFixed(2)}ms</span>
                      <span>Advect Dye</span><span>{perf.advectDyeMs.toFixed(2)}ms</span>
                      <span>Boundary Dye</span><span>{perf.boundaryDyeMs.toFixed(2)}ms</span>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Splat */}
            <div className="global-group">
              <span className="gg-title">Splat</span>
              <div className="gg-row inline">
                <Toggle options={[{ l: 'Soft', v: 0 }, { l: 'Med', v: 1 }, { l: 'Sharp', v: 2 }, { l: 'Ultra', v: 3 }]}
                  value={config.splatFalloff ?? 2} onChange={v => setFluidConfig({ splatFalloff: v })} />
                <Toggle options={[{ l: 'Add', v: 0 }, { l: 'Max', v: 1 }, { l: 'Blend', v: 2 }]}
                  value={config.splatBlendMode ?? 0} onChange={v => setFluidConfig({ splatBlendMode: v })} />
              </div>
              <div className="gg-row r3">
                <Slider label="Dye Mult" v={config.dyeSplatRadius ?? 1.0} min={0.25} max={6} step={0.05}
                  onChange={v => setFluidConfig({ dyeSplatRadius: v })} />
                <Slider label="Dye Int" v={config.dyeIntensity ?? 8} min={0} max={30} step={0.25}
                  onChange={v => setFluidConfig({ dyeIntensity: v })} />
                <Slider label="Force Mult" v={config.forceSplatRadius ?? 1.0} min={0.25} max={6} step={0.05}
                  onChange={v => setFluidConfig({ forceSplatRadius: v })} />
              </div>
              <div className="gg-row r3">
                <Slider label="Vel Force" v={config.velocityForce ?? 8.0} min={0} max={30} step={0.25}
                  onChange={v => setFluidConfig({ velocityForce: v })} accent="#ff6b6b" />
                <Slider label="Vel Scale" v={config.splatVelocityScale ?? 1.0} min={0} max={3} step={0.05}
                  onChange={v => setFluidConfig({ splatVelocityScale: v })} accent="#ff6b6b" />
                <Slider label="Dye Radius" v={config.dyeRadius ?? 0.02} min={0.001} max={0.08} step={0.001}
                  onChange={v => setFluidConfig({ dyeRadius: v })} accent="#ff6b6b" />
              </div>
              <div className="gg-row r2">
                <Slider label="Softness" v={config.splatSoftness ?? 0.8} min={0.1} max={2} step={0.1}
                  onChange={v => setFluidConfig({ splatSoftness: v })} />
                <Slider label="Color Boost" v={config.splatColorBoost ?? 1.5} min={0.5} max={3} step={0.1}
                  onChange={v => setFluidConfig({ splatColorBoost: v })} />
              </div>
              <div className="gg-row r2">
                <Slider label="Vel Radius" v={config.velocityRadius ?? (config.dyeRadius ?? 0.02)} min={0.001} max={0.08} step={0.001}
                  onChange={v => setFluidConfig({ velocityRadius: v })} accent="#60a5fa" />
                <Slider label="Dye Dissip" v={config.dyeDissipation ?? 0.985} min={0.9} max={1.0} step={0.0005}
                  onChange={v => setFluidConfig({ dyeDissipation: v })} accent="#60a5fa" />
              </div>
            </div>

            {/* Physics */}
            <div className="global-group">
              <span className="gg-title">Physics</span>
              <div className="gg-row r3">
                <Slider label="Viscosity" v={config.viscosity ?? 0.25} min={0} max={1} step={0.01}
                  onChange={v => setFluidConfig({ viscosity: v })} accent="#60a5fa" />
                <Slider label="Vorticity" v={config.vorticity ?? 15} min={0} max={100} step={1}
                  onChange={v => setFluidConfig({ vorticity: v })} accent="#60a5fa" />
                <Slider label="Pressure It" v={config.pressureIterations ?? 30} min={1} max={80} step={1}
                  onChange={v => setFluidConfig({ pressureIterations: v })} accent="#60a5fa" />
              </div>
              <div className="gg-row inline">
                <Chip
                  active={config.pressureAdaptive ?? true}
                  onClick={() => setFluidConfig({ pressureAdaptive: !(config.pressureAdaptive ?? true) })}
                  accent="#60a5fa"
                >
                  Adaptive It {(config.pressureAdaptive ?? true) ? 'On' : 'Off'}
                </Chip>
              </div>
              {(config.pressureAdaptive ?? true) && (
                <div className="gg-row r2">
                  <Slider label="Min It" v={config.pressureMinIterations ?? 6} min={1} max={40} step={1}
                    onChange={v => setFluidConfig({ pressureMinIterations: v })} accent="#60a5fa" />
                  <Slider label="Max It" v={config.pressureMaxIterations ?? 80} min={10} max={120} step={1}
                    onChange={v => setFluidConfig({ pressureMaxIterations: v })} accent="#60a5fa" />
                </div>
              )}
              <div className="gg-row inline">
                <span className="gg-label">Advection</span>
                <Toggle options={[{ l: 'Linear', v: 0 }, { l: 'MacCormack', v: 1 }]}
                  value={config.advectionMode ?? 1} onChange={v => setFluidConfig({ advectionMode: v })} accent="#60a5fa" />
                <span className="gg-label">Solver</span>
                <Toggle options={[{ l: 'Jacobi', v: 0 }, { l: 'SOR', v: 1 }]}
                  value={config.pressureSolver ?? 0} onChange={v => setFluidConfig({ pressureSolver: v })} accent="#60a5fa" />
              </div>
              <div className="gg-row r2">
                <Slider label="SOR Ω" v={config.sorOmega ?? 1.8} min={1.0} max={1.9} step={0.01}
                  onChange={v => setFluidConfig({ sorOmega: v })} accent="#60a5fa" />
                <Slider label="Vel Dissip" v={(config.velocityDiffusion ?? config.velocityDissipation ?? 0.98)} min={0.9} max={1} step={0.0005}
                  onChange={v => setFluidConfig({ velocityDiffusion: v, velocityDissipation: v })} accent="#60a5fa" />
              </div>
            </div>

            {/* Timestep */}
            <div className="global-group">
              <span className="gg-title">Timestep</span>
              <div className="gg-row inline">
                <Chip
                  active={config.substepsEnabled ?? true}
                  onClick={() => setFluidConfig({ substepsEnabled: !(config.substepsEnabled ?? true) })}
                  accent="#60a5fa"
                >
                  Substeps {(config.substepsEnabled ?? true) ? 'On' : 'Off'}
                </Chip>
              </div>
              {(config.substepsEnabled ?? true) && (
                <div className="gg-row r3">
                  <Slider label="Max Steps" v={config.substepsMax ?? 4} min={1} max={8} step={1}
                    onChange={v => setFluidConfig({ substepsMax: v })} accent="#60a5fa" />
                  <Slider label="Max Δt" v={(config.substepsDtMax ?? (1 / 60)) * 1000} min={4} max={33} step={1} unit="ms"
                    onChange={v => setFluidConfig({ substepsDtMax: v / 1000 })} accent="#60a5fa" />
                  <div />
                </div>
              )}
            </div>

            {/* Turbulence */}
            <div className="global-group">
              <span className="gg-title">Turbulence</span>
              <div className="gg-row inline">
                <Chip active={config.turbulenceEnabled ?? false} onClick={() => setFluidConfig({ turbulenceEnabled: !(config.turbulenceEnabled ?? false) })} accent="#f59e0b">
                  Turbulence {config.turbulenceEnabled ? 'On' : 'Off'}
                </Chip>
              </div>
              {config.turbulenceEnabled && (
                <div className="gg-row r4">
                  <Slider label="Scale" v={config.turbulenceScale ?? 1.0} min={0.1} max={5.0} step={0.1}
                    onChange={v => setFluidConfig({ turbulenceScale: v })} accent="#f59e0b" />
                  <Slider label="Strength" v={config.turbulenceStrength ?? 0.5} min={0} max={2.0} step={0.01}
                    onChange={v => setFluidConfig({ turbulenceStrength: v })} accent="#f59e0b" />
                  <Slider label="Octaves" v={config.turbulenceOctaves ?? 2} min={1} max={4} step={1}
                    onChange={v => setFluidConfig({ turbulenceOctaves: v })} accent="#f59e0b" />
                  <Slider label="Speed" v={config.turbulenceSpeed ?? 1.0} min={0} max={5.0} step={0.05}
                    onChange={v => setFluidConfig({ turbulenceSpeed: v })} accent="#f59e0b" />
                </div>
              )}
            </div>

            {/* Buoyancy */}
            <div className="global-group">
              <span className="gg-title">Buoyancy</span>
              <div className="gg-row inline">
                <Chip active={config.buoyancyEnabled ?? false} onClick={() => setFluidConfig({ buoyancyEnabled: !(config.buoyancyEnabled ?? false) })} accent="#ef4444">
                  Buoyancy {config.buoyancyEnabled ? 'On' : 'Off'}
                </Chip>
              </div>
              {config.buoyancyEnabled && (
                <div className="gg-row r2">
                  <Slider label="Strength" v={config.buoyancyStrength ?? 0.1} min={0} max={1.0} step={0.01}
                    onChange={v => setFluidConfig({ buoyancyStrength: v })} accent="#ef4444" />
                  <Slider label="Ambient T" v={config.ambientTemperature ?? 0.0} min={-1.0} max={1.0} step={0.01}
                    onChange={v => setFluidConfig({ ambientTemperature: v })} accent="#ef4444" />
                </div>
              )}
            </div>

            {/* Temperature Field (Combustion-like effects) */}
            <div className="global-group">
              <span className="gg-title">Temperature Field 🔥</span>
              <div className="gg-row inline">
                <Chip active={config.temperatureEnabled ?? false} onClick={() => setFluidConfig({ temperatureEnabled: !(config.temperatureEnabled ?? false) })} accent="#f97316">
                  Temperature {config.temperatureEnabled ? 'On' : 'Off'}
                </Chip>
                {config.temperatureEnabled && (
                  <Chip active={config.temperatureBuoyancyEnabled ?? false} onClick={() => setFluidConfig({ temperatureBuoyancyEnabled: !(config.temperatureBuoyancyEnabled ?? false) })} accent="#f97316">
                    Temp Buoyancy {config.temperatureBuoyancyEnabled ? 'On' : 'Off'}
                  </Chip>
                )}
              </div>
              {config.temperatureEnabled && (
                <>
                  <div className="gg-row r2">
                    <Slider label="Dissipation" v={config.temperatureDissipation ?? 0.99} min={0.9} max={1.0} step={0.001}
                      onChange={v => setFluidConfig({ temperatureDissipation: v })} accent="#f97316" />
                    <Slider label="Cooling" v={config.temperatureCooling ?? 0.02} min={0} max={0.2} step={0.005}
                      onChange={v => setFluidConfig({ temperatureCooling: v })} accent="#f97316" />
                  </div>
                  {config.temperatureBuoyancyEnabled && (
                    <div className="gg-row r2">
                      <Slider label="Buoy Strength" v={config.temperatureBuoyancyStrength ?? 1.0} min={0} max={5.0} step={0.1}
                        onChange={v => setFluidConfig({ temperatureBuoyancyStrength: v })} accent="#f97316" />
                      <Slider label="Ambient" v={config.temperatureAmbient ?? 0.0} min={-2} max={2} step={0.1}
                        onChange={v => setFluidConfig({ temperatureAmbient: v })} accent="#f97316" />
                    </div>
                  )}
                </>
              )}
            </div>
          </>
        )}

        {activePanelSection === 'rendering' && (
          <>
            <Divider accent="#a78bfa">RENDER</Divider>

            <div className="global-group">
              <span className="gg-title">Output</span>
              <div className="gg-row inline">
                <span className="gg-label">Background</span>
                <Color
                  c={(postConfig.backgroundColor ?? [0.04, 0.06, 0.08]) as any}
                  onChange={(c) => setPostConfig({ backgroundColor: c as any })}
                />
              </div>
            </div>

            {/* Look */}
            <div className="global-group">
              <span className="gg-title">Sim Look</span>
              <div className="gg-row inline">
                <span className="gg-label">Color</span>
                <Toggle options={[
                  { l: 'Natural', v: 0 }, { l: 'Rainbow', v: 1 }, { l: 'Heat', v: 2 },
                  { l: 'Neon', v: 3 }, { l: 'Mono', v: 4 }, { l: 'Palette', v: 5 }, { l: 'Iri', v: 6 }, { l: 'Ramp', v: 7 }
                ]} value={postConfig.colorMode ?? 0} onChange={(v) => {
                  const currentColorize = postConfig.dyeColorizeStrength ?? 0.0;
                  const updates: Partial<RenderOutput2DConfig> = { colorMode: v };
                  if (v !== 0 && currentColorize < 0.05) updates.dyeColorizeStrength = 0.75;
                  if (v === 0 && currentColorize > 0.7) updates.dyeColorizeStrength = 0.0;
                  setPostConfig(updates);
                }} accent="#a78bfa" />
              </div>
              <div className="gg-row inline">
                <span className="gg-label">Material</span>
                <Toggle options={[
                  { l: 'Standard', v: 0 }, { l: 'Glossy', v: 1 }, { l: 'Matte', v: 2 },
                  { l: 'Neon', v: 3 }, { l: 'Ink', v: 4 }
                ]} value={postConfig.materialMode ?? 0} onChange={v => setPostConfig({ materialMode: v })} accent="#a78bfa" />
              </div>
              <div className="gg-row inline">
                <span className="gg-label">Velocity</span>
                <Toggle options={[
                  { l: 'None', v: 0 }, { l: 'Speed', v: 1 }, { l: 'Direction', v: 2 }
                ]} value={postConfig.velocityColorMode ?? 0} onChange={v => setPostConfig({ velocityColorMode: v })} accent="#a78bfa" />
              </div>
              <div className="gg-row r4">
                <Slider label="Glow" v={postConfig.glowIntensity ?? 0.5} min={0} max={3} step={0.1}
                  onChange={v => setPostConfig({ glowIntensity: v })} accent="#a78bfa" />
                <Slider label="Distortion" v={postConfig.distortionStrength ?? 0} min={0} max={0.02} step={0.001}
                  onChange={v => setPostConfig({ distortionStrength: v })} accent="#8b5cf6" />
                <Slider label="Motion Blur" v={postConfig.motionBlurStrength ?? 0} min={0} max={0.01} step={0.0001}
                  onChange={v => setPostConfig({ motionBlurStrength: v })} accent="#8b5cf6" />
                <Slider label="Vel Scale" v={postConfig.velocityColorScale ?? 1.0} min={0.1} max={5.0} step={0.1}
                  onChange={v => setPostConfig({ velocityColorScale: v })} accent="#8b5cf6" />
              </div>
            </div>

            {/* Post FX */}
            <div className="global-group">
              <span className="gg-title">Post FX</span>
              <div className="gg-row inline">
                <Chip active={postConfig.postEnabled ?? false} onClick={() => setPostConfig({ postEnabled: !(postConfig.postEnabled ?? false) })} accent="#a78bfa">
                  Post {(postConfig.postEnabled ?? false) ? 'On' : 'Off'}
                </Chip>
                <Toggle
                  options={[{ l: 'Quad', v: 0 }, { l: 'Three', v: 1 }]}
                  value={postConfig.postBackend ?? 0}
                  onChange={(v) => setPostConfig({ postBackend: v })}
                  accent="#a78bfa"
                />
                <Chip
                  active={(postConfig.postEnabled ?? false) && (postConfig.postFxBypass ?? false)}
                  onClick={() => setPostConfig({ postFxBypass: !(postConfig.postFxBypass ?? false) })}
                  accent="#a78bfa"
                >
                  Bypass {(postConfig.postFxBypass ?? false) ? 'On' : 'Off'}
                </Chip>
                {(postConfig.postBackend ?? 0) === 1 && (
                  <Chip
                    active={(postConfig.postEnabled ?? false) && (postConfig.fxaaEnabled ?? false)}
                    onClick={() => setPostConfig({ fxaaEnabled: !(postConfig.fxaaEnabled ?? false) })}
                    accent="#a78bfa"
                  >
                    FXAA {(postConfig.fxaaEnabled ?? false) ? 'On' : 'Off'}
                  </Chip>
                )}
              </div>

              {(postConfig.postEnabled ?? false) && (
                <>
                  <div className="gg-row r2">
                    <Slider label="Exposure" v={postConfig.exposure ?? 1.0} min={0.1} max={4.0} step={0.01}
                      onChange={v => setPostConfig({ exposure: v })} accent="#a78bfa" />
                    <div className="ctrl-slider">
                      <div className="cs-head">
                        <span className="cs-label">Tone</span>
                        <span className="cs-val">{(postConfig.toneMapping ?? 0) === 1 ? 'Filmic' : 'Off'}</span>
                      </div>
                      <Toggle
                        options={[{ l: 'Off', v: 0 }, { l: 'Filmic', v: 1 }]}
                        value={postConfig.toneMapping ?? 0}
                        onChange={(v) => setPostConfig({ toneMapping: v })}
                        accent="#a78bfa"
                      />
                    </div>
                  </div>

                  <div className="gg-row r4">
                    <Slider label="Brightness" v={postConfig.brightness ?? 1.2} min={0} max={3} step={0.05}
                      onChange={v => setPostConfig({ brightness: v })} accent="#a78bfa" />
                    <Slider label="Saturation" v={postConfig.saturation ?? 1.15} min={0} max={2} step={0.05}
                      onChange={v => setPostConfig({ saturation: v })} accent="#a78bfa" />
                    <Slider label="Contrast" v={postConfig.contrast ?? 1.0} min={0.5} max={2.0} step={0.05}
                      onChange={v => setPostConfig({ contrast: v })} accent="#a78bfa" />
                    <Slider label="Gamma" v={postConfig.gamma ?? 1.0} min={0.5} max={2.0} step={0.05}
                      onChange={v => setPostConfig({ gamma: v })} accent="#a78bfa" />
                  </div>

                  <div className="gg-row r3">
                    <Slider label="Vignette" v={postConfig.vignetteIntensity ?? 0.0} min={0} max={1.0} step={0.01}
                      onChange={v => setPostConfig({ vignetteIntensity: v })} accent="#a78bfa" />
                    <Slider label="V Radius" v={postConfig.vignetteRadius ?? 0.8} min={0.2} max={1.2} step={0.01}
                      onChange={v => setPostConfig({ vignetteRadius: v })} accent="#a78bfa" />
                    <Slider label="V Soft" v={postConfig.vignetteSoftness ?? 0.3} min={0.0} max={1.0} step={0.01}
                      onChange={v => setPostConfig({ vignetteSoftness: v })} accent="#a78bfa" />
                  </div>

                  <div className="gg-row inline">
                    <Chip
                      active={(postConfig.lutEnabled ?? false) && ((postConfig.lutUrl ?? '').length > 0)}
                      onClick={() => {
                        const hasUrl = (postConfig.lutUrl ?? '').length > 0;
                        if (!hasUrl) {
                          lutFileRef.current?.click();
                          return;
                        }
                        setPostConfig({ lutEnabled: !(postConfig.lutEnabled ?? false) });
                      }}
                      accent="#a78bfa"
                    >
                      LUT {((postConfig.lutEnabled ?? false) && ((postConfig.lutUrl ?? '').length > 0)) ? 'On' : 'Off'}
                    </Chip>
                    <Chip active={false} onClick={() => lutFileRef.current?.click()} accent="#a78bfa">
                      Load
                    </Chip>
                    <Chip
                      active={false}
                      onClick={() => setPostConfig({ lutEnabled: false, lutUrl: '' })}
                      accent="#a78bfa"
                    >
                      Clear
                    </Chip>
                    <input
                      ref={lutFileRef}
                      type="file"
                      accept="image/*"
                      style={{ display: 'none' }}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const reader = new FileReader();
                        reader.onload = () => {
                          const url = typeof reader.result === 'string' ? reader.result : '';
                          if (!url) return;
                          setPostConfig({ lutUrl: url, lutEnabled: true });
                        };
                        reader.readAsDataURL(file);
                        e.target.value = '';
                      }}
                    />
                  </div>
                  {((postConfig.lutUrl ?? '').length > 0) && (
                    <div className="gg-row r2">
                      <Slider label="LUT Amt" v={postConfig.lutAmount ?? 1.0} min={0.0} max={1.0} step={0.01}
                        onChange={v => setPostConfig({ lutAmount: v })} accent="#a78bfa" />
                      <div />
                    </div>
                  )}

                  {((postConfig.postBackend ?? 0) === 1) && (
                    <>
                      <div className="gg-row inline">
                        <span className="gg-label">Stack</span>
                        <Chip active={false} onClick={() => setPostConfig({ postFxOrder: [...defaultPostFxOrder] })} accent="#a78bfa">
                          Reset Order
                        </Chip>
                      </div>

                      <div className="pfx-stack">
                        {postFxOrder.map((id) => {
                          const active = postFxIsActive(id, postConfig);
                          const selected = postFxSelected === id;
                          const idx = postFxOrder.indexOf(id);
                          const canUp = idx > 0;
                          const canDown = idx >= 0 && idx < postFxOrder.length - 1;
                          const isCore = id === 'grading' || id === 'vignette';

                          return (
                            <div key={id} className="pfx-row">
                              <Chip active={selected} onClick={() => setPostFxSelected(id)} accent="#a78bfa">
                                {postFxLabel[id]}
                              </Chip>
                              <Chip
                                active={false}
                                onClick={() => {
                                  if (!canUp) return;
                                  setPostConfig({ postFxOrder: movePostFxOrder(postFxOrder, id, -1) });
                                }}
                                accent="#334155"
                              >
                                ↑
                              </Chip>
                              <Chip
                                active={false}
                                onClick={() => {
                                  if (!canDown) return;
                                  setPostConfig({ postFxOrder: movePostFxOrder(postFxOrder, id, 1) });
                                }}
                                accent="#334155"
                              >
                                ↓
                              </Chip>
                              {isCore ? (
                                <span className="pfx-core">Core</span>
                              ) : (
                                <Chip
                                  active={active}
                                  onClick={() => {
                                    if (id === 'bloom') setPostConfig({ bloomIntensity: active ? 0.0 : 0.3 });
                                    if (id === 'sharpen') setPostConfig({ sharpenEnabled: !(postConfig.sharpenEnabled ?? false) });
                                    if (id === 'motionBlur') setPostConfig({ motionBlurEnabled: !(postConfig.motionBlurEnabled ?? false) });
                                    if (id === 'chromatic') setPostConfig({ chromaticAberration: active ? 0.0 : 1.0 });
                                    if (id === 'grain') setPostConfig({ noiseIntensity: active ? 0.0 : 0.15 });
                                    if (id === 'clarity') setPostConfig({ clarity: active ? 0.0 : 0.25 });
                                    if (id === 'rgbShift') setPostConfig({ rgbShiftEnabled: !(postConfig.rgbShiftEnabled ?? false) });
                                    if (id === 'afterImage') setPostConfig({ afterImageEnabled: !(postConfig.afterImageEnabled ?? false) });
                                    if (id === 'trails') setPostConfig({ trailEnabled: !(postConfig.trailEnabled ?? false) });
                                  }}
                                  accent={active ? '#06b6d4' : '#334155'}
                                >
                                  {active ? 'On' : 'Off'}
                                </Chip>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {/* Inspector */}
                      {postFxSelected === 'bloom' && (
                        <div className="gg-row r3">
                          <Slider label="Bloom" v={postConfig.bloomIntensity ?? 0.3} min={0} max={1} step={0.05}
                            onChange={v => setPostConfig({ bloomIntensity: v })} accent="#a78bfa" />
                          <Slider label="Thresh" v={postConfig.bloomThreshold ?? 0.6} min={0} max={1} step={0.01}
                            onChange={v => setPostConfig({ bloomThreshold: v })} accent="#a78bfa" />
                          <Slider label="Radius" v={postConfig.bloomRadius ?? 1.0} min={0.5} max={4.0} step={0.1}
                            onChange={v => setPostConfig({ bloomRadius: v })} accent="#a78bfa" />
                        </div>
                      )}
                      {postFxSelected === 'sharpen' && (
                        <div className="gg-row r2">
                          <Slider label="Amount" v={postConfig.sharpenAmount ?? 0.5} min={0} max={2.0} step={0.05}
                            onChange={v => setPostConfig({ sharpenAmount: v })} accent="#f97316" />
                          <Slider label="Radius" v={postConfig.sharpenRadius ?? 1.0} min={0.5} max={3.0} step={0.1}
                            onChange={v => setPostConfig({ sharpenRadius: v })} accent="#f97316" />
                        </div>
                      )}
                      {postFxSelected === 'motionBlur' && (
                        <div className="gg-row r2">
                          <Slider label="Samples" v={postConfig.motionBlurSamples ?? 8} min={2} max={16} step={1}
                            onChange={v => setPostConfig({ motionBlurSamples: v })} accent="#3b82f6" />
                          <div />
                        </div>
                      )}
                      {postFxSelected === 'chromatic' && (
                        <div className="gg-row r2">
                          <Slider label="Chromatic" v={postConfig.chromaticAberration ?? 0.0} min={0} max={5} step={0.1}
                            onChange={v => setPostConfig({ chromaticAberration: v })} accent="#a78bfa" />
                          <div />
                        </div>
                      )}
                      {postFxSelected === 'grain' && (
                        <div className="gg-row r2">
                          <Slider label="Grain" v={postConfig.noiseIntensity ?? 0.0} min={0} max={1.0} step={0.02}
                            onChange={v => setPostConfig({ noiseIntensity: v })} accent="#a78bfa" />
                          <div />
                        </div>
                      )}
                      {postFxSelected === 'clarity' && (
                        <div className="gg-row r2">
                          <Slider label="Clarity" v={postConfig.clarity ?? 0.0} min={0} max={2.0} step={0.01}
                            onChange={v => setPostConfig({ clarity: v })} accent="#a78bfa" />
                          <div />
                        </div>
                      )}
                      {postFxSelected === 'afterImage' && (
                        <div className="gg-row r2">
                          <Slider label="After Damp" v={postConfig.afterImageDamp ?? 0.96} min={0.5} max={0.999} step={0.001}
                            onChange={v => setPostConfig({ afterImageDamp: v })} accent="#06b6d4" />
                          <div />
                        </div>
                      )}
                      {postFxSelected === 'trails' && (
                        <div className="gg-row r3">
                          <Slider label="Trail Decay" v={postConfig.trailDecay ?? 0.9} min={0.5} max={0.999} step={0.001}
                            onChange={v => setPostConfig({ trailDecay: v })} accent="#06b6d4" />
                          <Toggle options={[{ l: 'Add', v: 0 }, { l: 'Multiply', v: 1 }, { l: 'Screen', v: 2 }]}
                            value={postConfig.trailBlendMode ?? 0} onChange={v => setPostConfig({ trailBlendMode: v })} accent="#06b6d4" />
                          <Slider label="Threshold" v={postConfig.trailThreshold ?? 0.1} min={0} max={1.0} step={0.01}
                            onChange={v => setPostConfig({ trailThreshold: v })} accent="#06b6d4" />
                        </div>
                      )}
                      {postFxSelected === 'rgbShift' && (
                        <div className="gg-row r2">
                          <Slider label="RGB Amount" v={postConfig.rgbShiftAmount ?? 0.0015} min={0} max={0.02} step={0.0001}
                            onChange={v => setPostConfig({ rgbShiftAmount: v })} accent="#06b6d4" />
                          <Slider label="RGB Angle" v={postConfig.rgbShiftAngle ?? 0.0} min={-3.1416} max={3.1416} step={0.01}
                            onChange={v => setPostConfig({ rgbShiftAngle: v })} accent="#06b6d4" />
                        </div>
                      )}
                    </>
                  )}
                </>
              )}
            </div>

            {/* Dye Material */}
            <div className="global-group">
              <span className="gg-title">Dye</span>
              <div className="gg-row inline">
                <span className="gg-label">Blend</span>
                <Toggle
                  options={[{ l: 'Normal', v: 0 }, { l: 'Add', v: 1 }, { l: 'Screen', v: 2 }]}
                  value={postConfig.dyeBlendMode ?? 0}
                  onChange={v => setPostConfig({ dyeBlendMode: v })}
                  accent="#06b6d4"
                />
              </div>
              <div className="gg-row r3">
                <Slider label="Opacity" v={postConfig.dyeOpacity ?? 1.0} min={0} max={1} step={0.01}
                  onChange={v => setPostConfig({ dyeOpacity: v })} accent="#06b6d4" />
                <Slider label="Density→A" v={postConfig.dyeDensityToAlpha ?? 1.0} min={0} max={3} step={0.01}
                  onChange={v => setPostConfig({ dyeDensityToAlpha: v })} accent="#06b6d4" />
                <Slider label="Edges" v={postConfig.dyeEdgeStrength ?? 0.0} min={0} max={2.0} step={0.01}
                  onChange={v => setPostConfig({ dyeEdgeStrength: v })} accent="#06b6d4" />
              </div>

              <div className="gg-row r2">
                <Slider label="Exposure" v={postConfig.dyeDensityExposure ?? 1.0} min={0.1} max={5.0} step={0.01}
                  onChange={v => setPostConfig({ dyeDensityExposure: v })} accent="#06b6d4" />
                <Slider label="Colorize" v={postConfig.dyeColorizeStrength ?? 0.0} min={0.0} max={1.0} step={0.01}
                  onChange={v => setPostConfig({ dyeColorizeStrength: v })} accent="#06b6d4" />
              </div>

              <div className="gg-row r3">
                <Slider label="Hue" v={postConfig.dyeHue ?? 0.0} min={-3.1416} max={3.1416} step={0.01}
                  onChange={v => setPostConfig({ dyeHue: v })} accent="#06b6d4" />
                <Slider label="Hue Spd" v={postConfig.dyeHueSpeed ?? 0.0} min={-10.0} max={10.0} step={0.01}
                  onChange={v => setPostConfig({ dyeHueSpeed: v })} accent="#06b6d4" />
                <Slider label="Hue Vel" v={postConfig.dyeHueFromVelocity ?? 0.0} min={0.0} max={2.0} step={0.01}
                  onChange={v => setPostConfig({ dyeHueFromVelocity: v })} accent="#06b6d4" />
              </div>

              <div className="gg-row r4">
                <Slider label="D Bright" v={postConfig.dyeBrightness ?? 1.0} min={0.0} max={3.0} step={0.01}
                  onChange={v => setPostConfig({ dyeBrightness: v })} accent="#06b6d4" />
                <Slider label="D Sat" v={postConfig.dyeSaturation ?? 1.0} min={0.0} max={3.0} step={0.01}
                  onChange={v => setPostConfig({ dyeSaturation: v })} accent="#06b6d4" />
                <Slider label="D Con" v={postConfig.dyeContrast ?? 1.0} min={0.0} max={3.0} step={0.01}
                  onChange={v => setPostConfig({ dyeContrast: v })} accent="#06b6d4" />
                <Slider label="D Gamma" v={postConfig.dyeGamma ?? 1.0} min={0.2} max={3.0} step={0.01}
                  onChange={v => setPostConfig({ dyeGamma: v })} accent="#06b6d4" />
              </div>

              <div className="gg-row r4">
                <Slider label="Noise" v={postConfig.dyeNoiseStrength ?? 0.0} min={0.0} max={0.2} step={0.001}
                  onChange={v => setPostConfig({ dyeNoiseStrength: v })} accent="#06b6d4" />
                <Slider label="N Scale" v={postConfig.dyeNoiseScale ?? 2.0} min={0.5} max={20.0} step={0.1}
                  onChange={v => setPostConfig({ dyeNoiseScale: v })} accent="#06b6d4" />
                <Slider label="N Speed" v={postConfig.dyeNoiseSpeed ?? 0.25} min={0.0} max={5.0} step={0.01}
                  onChange={v => setPostConfig({ dyeNoiseSpeed: v })} accent="#06b6d4" />
                <Slider label="N Color" v={postConfig.dyeNoiseColor ?? 0.35} min={0.0} max={1.0} step={0.01}
                  onChange={v => setPostConfig({ dyeNoiseColor: v })} accent="#06b6d4" />
              </div>

              <div className="gg-row inline">
                <Chip
                  active={postConfig.dyeShadingEnabled ?? false}
                  onClick={() => setPostConfig({ dyeShadingEnabled: !(postConfig.dyeShadingEnabled ?? false) })}
                  accent="#06b6d4"
                >
                  Shading {(postConfig.dyeShadingEnabled ?? false) ? 'On' : 'Off'}
                </Chip>
              </div>
              {(postConfig.dyeShadingEnabled ?? false) && (
                <div className="gg-row r3">
                  <Slider label="Strength" v={postConfig.dyeShadingStrength ?? 1.0} min={0} max={4.0} step={0.01}
                    onChange={v => setPostConfig({ dyeShadingStrength: v })} accent="#06b6d4" />
                  <Slider label="Spec" v={postConfig.dyeSpecular ?? 0.35} min={0} max={1.0} step={0.01}
                    onChange={v => setPostConfig({ dyeSpecular: v })} accent="#06b6d4" />
                  <Slider label="Power" v={postConfig.dyeSpecPower ?? 24.0} min={2} max={80} step={1}
                    onChange={v => setPostConfig({ dyeSpecPower: v })} accent="#06b6d4" />
                </div>
              )}

              <div className="gg-row inline">
                <Chip
                  active={postConfig.dyeFresnelEnabled ?? false}
                  onClick={() => setPostConfig({ dyeFresnelEnabled: !(postConfig.dyeFresnelEnabled ?? false) })}
                  accent="#06b6d4"
                >
                  Fresnel {(postConfig.dyeFresnelEnabled ?? false) ? 'On' : 'Off'}
                </Chip>
              </div>
              {(postConfig.dyeFresnelEnabled ?? false) && (
                <>
                  <div className="gg-row r2">
                    <Slider label="F Strength" v={postConfig.dyeFresnelStrength ?? 0.35} min={0} max={2.0} step={0.01}
                      onChange={v => setPostConfig({ dyeFresnelStrength: v })} accent="#06b6d4" />
                    <Slider label="F Power" v={postConfig.dyeFresnelPower ?? 3.0} min={0.5} max={10.0} step={0.05}
                      onChange={v => setPostConfig({ dyeFresnelPower: v })} accent="#06b6d4" />
                  </div>
                  <div className="gg-row inline">
                    <span className="gg-label">F Tint</span>
                    <Color
                      c={(postConfig.dyeFresnelTint ?? [1.0, 1.0, 1.0]) as any}
                      onChange={(c) => setPostConfig({ dyeFresnelTint: c as any })}
                    />
                  </div>
                </>
              )}

              <div className="gg-row inline">
                <Chip
                  active={postConfig.dyeFoamEnabled ?? false}
                  onClick={() => setPostConfig({ dyeFoamEnabled: !(postConfig.dyeFoamEnabled ?? false) })}
                  accent="#06b6d4"
                >
                  Foam {(postConfig.dyeFoamEnabled ?? false) ? 'On' : 'Off'}
                </Chip>
              </div>
              {(postConfig.dyeFoamEnabled ?? false) && (
                <>
                  <div className="gg-row inline">
                    <span className="gg-label">Source</span>
                    <Toggle
                      options={[{ l: 'Edge', v: 0 }, { l: 'Speed', v: 1 }, { l: 'Vort', v: 2 }]}
                      value={postConfig.dyeFoamSource ?? 0}
                      onChange={(v) => setPostConfig({ dyeFoamSource: v })}
                      accent="#06b6d4"
                    />
                  </div>
                  <div className="gg-row r3">
                    <Slider label="Strength" v={postConfig.dyeFoamStrength ?? 0.35} min={0} max={2.0} step={0.01}
                      onChange={v => setPostConfig({ dyeFoamStrength: v })} accent="#06b6d4" />
                    <Slider label="Thresh" v={postConfig.dyeFoamThreshold ?? 0.2} min={0} max={1.0} step={0.01}
                      onChange={v => setPostConfig({ dyeFoamThreshold: v })} accent="#06b6d4" />
                    <Slider label="Soft" v={postConfig.dyeFoamSoftness ?? 0.2} min={0.01} max={1.0} step={0.01}
                      onChange={v => setPostConfig({ dyeFoamSoftness: v })} accent="#06b6d4" />
                  </div>
                  <div className="gg-row r2">
                    <Slider label="Spd Scale" v={postConfig.dyeFoamSpeedScale ?? 1.0} min={0.1} max={10.0} step={0.01}
                      onChange={v => setPostConfig({ dyeFoamSpeedScale: v })} accent="#06b6d4" />
                    <Slider label="Vort Scale" v={postConfig.dyeFoamVorticityScale ?? 1.0} min={0.1} max={10.0} step={0.01}
                      onChange={v => setPostConfig({ dyeFoamVorticityScale: v })} accent="#06b6d4" />
                  </div>
                  <div className="gg-row inline">
                    <span className="gg-label">Tint</span>
                    <Color
                      c={(postConfig.dyeFoamTint ?? [1.0, 1.0, 1.0]) as any}
                      onChange={(c) => setPostConfig({ dyeFoamTint: c as any })}
                    />
                  </div>
                </>
              )}

              {(postConfig.colorMode ?? 0) === 7 && (
                <>
                  <div className="gg-row inline">
                    <span className="gg-label">Ramp Src</span>
                    <Toggle
                      options={[{ l: 'Density', v: 0 }, { l: 'Speed', v: 1 }]}
                      value={postConfig.rampSource ?? 0}
                      onChange={(v) => setPostConfig({ rampSource: v })}
                      accent="#06b6d4"
                    />
                  </div>
                  {(postConfig.rampSource ?? 0) === 1 && (
                    <div className="gg-row r2">
                      <Slider label="Speed Scale" v={postConfig.rampSpeedScale ?? 1.0} min={0.1} max={10.0} step={0.01}
                        onChange={v => setPostConfig({ rampSpeedScale: v })} accent="#06b6d4" />
                      <div />
                    </div>
                  )}

                  <div className="gg-row inline">
                    <Chip
                      active={(postConfig.gradientMapEnabled ?? false) && ((postConfig.gradientMapUrl ?? '').length > 0)}
                      onClick={() => {
                        const hasUrl = (postConfig.gradientMapUrl ?? '').length > 0;
                        if (!hasUrl) {
                          gradientMapFileRef.current?.click();
                          return;
                        }
                        setPostConfig({ gradientMapEnabled: !(postConfig.gradientMapEnabled ?? false) });
                      }}
                      accent="#06b6d4"
                    >
                      GradMap {((postConfig.gradientMapEnabled ?? false) && ((postConfig.gradientMapUrl ?? '').length > 0)) ? 'On' : 'Off'}
                    </Chip>
                    <Chip active={false} onClick={() => gradientMapFileRef.current?.click()} accent="#06b6d4">
                      Load
                    </Chip>
                    <Chip
                      active={false}
                      onClick={() => setPostConfig({ gradientMapEnabled: false, gradientMapUrl: '' })}
                      accent="#06b6d4"
                    >
                      Clear
                    </Chip>
                    <input
                      ref={gradientMapFileRef}
                      type="file"
                      accept="image/*"
                      style={{ display: 'none' }}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const reader = new FileReader();
                        reader.onload = () => {
                          const url = typeof reader.result === 'string' ? reader.result : '';
                          if (!url) return;
                          setPostConfig({ gradientMapUrl: url, gradientMapEnabled: true });
                        };
                        reader.readAsDataURL(file);
                        e.target.value = '';
                      }}
                    />
                  </div>
                  {((postConfig.gradientMapUrl ?? '').length > 0) && (
                    <div className="gg-row r2">
                      <Slider label="G Strength" v={postConfig.gradientMapStrength ?? 1.0} min={0.0} max={1.0} step={0.01}
                        onChange={v => setPostConfig({ gradientMapStrength: v })} accent="#06b6d4" />
                      <div />
                    </div>
                  )}
                </>
              )}

              {((postConfig.colorMode ?? 0) === 5 || (postConfig.colorMode ?? 0) === 7) && (
                <>
                  <div className="gg-row inline">
                    <span className="gg-label">Low</span>
                    <Color c={(postConfig.paletteLowColor ?? [0.05, 0.08, 0.12]) as any} onChange={(c) => setPostConfig({ paletteLowColor: c as any })} />
                  </div>
                  <div className="gg-row inline">
                    <span className="gg-label">Mid</span>
                    <Color c={(postConfig.paletteMidColor ?? [0.18, 0.75, 0.95]) as any} onChange={(c) => setPostConfig({ paletteMidColor: c as any })} />
                  </div>
                  <div className="gg-row inline">
                    <span className="gg-label">High</span>
                    <Color c={(postConfig.paletteHighColor ?? [1.0, 0.35, 0.2]) as any} onChange={(c) => setPostConfig({ paletteHighColor: c as any })} />
                  </div>
                  <div className="gg-row r3">
                    <Slider label="Bias" v={postConfig.paletteBias ?? 0.0} min={-1} max={1} step={0.01}
                      onChange={v => setPostConfig({ paletteBias: v })} accent="#06b6d4" />
                    <Slider label="Gamma" v={postConfig.paletteGamma ?? 1.0} min={0.2} max={3.0} step={0.01}
                      onChange={v => setPostConfig({ paletteGamma: v })} accent="#06b6d4" />
                    <Slider label="Contrast" v={postConfig.paletteContrast ?? 1.0} min={0.0} max={2.5} step={0.01}
                      onChange={v => setPostConfig({ paletteContrast: v })} accent="#06b6d4" />
                  </div>
                </>
              )}

              <div className="gg-row inline">
                <Chip
                  active={postConfig.dyeMediumEnabled ?? false}
                  onClick={() => setPostConfig({ dyeMediumEnabled: !(postConfig.dyeMediumEnabled ?? false) })}
                  accent="#06b6d4"
                >
                  Medium {(postConfig.dyeMediumEnabled ?? false) ? 'On' : 'Off'}
                </Chip>
              </div>
              {(postConfig.dyeMediumEnabled ?? false) && (
                <>
                  <div className="gg-row r3">
                    <Slider label="Density" v={postConfig.dyeMediumDensity ?? 1.0} min={0} max={3} step={0.01}
                      onChange={v => setPostConfig({ dyeMediumDensity: v })} accent="#06b6d4" />
                    <Slider label="Absorb" v={postConfig.dyeAbsorptionStrength ?? 0.8} min={0} max={2} step={0.01}
                      onChange={v => setPostConfig({ dyeAbsorptionStrength: v })} accent="#06b6d4" />
                    <Slider label="Scatter" v={postConfig.dyeScatteringStrength ?? 0.35} min={0} max={1.5} step={0.01}
                      onChange={v => setPostConfig({ dyeScatteringStrength: v })} accent="#06b6d4" />
                  </div>
                  <div className="gg-row inline">
                    <span className="gg-label">Absorb Color</span>
                    <Color
                      c={(postConfig.dyeAbsorptionColor ?? [0.7, 0.2, 0.05]) as any}
                      onChange={(c) => setPostConfig({ dyeAbsorptionColor: c as any })}
                    />
                  </div>
                  <div className="gg-row inline">
                    <span className="gg-label">Scatter Color</span>
                    <Color
                      c={(postConfig.dyeScatteringColor ?? [0.95, 0.6, 0.35]) as any}
                      onChange={(c) => setPostConfig({ dyeScatteringColor: c as any })}
                    />
                  </div>
                </>
              )}
            </div>

            {/* Debug Views */}
            <div className="global-group">
              <span className="gg-title">Debug</span>
              <div className="gg-row inline">
                <span className="gg-label">View</span>
                <Toggle
                  options={[
                    { l: 'Off', v: 0 },
                    { l: 'Vel', v: 1 },
                    { l: 'P', v: 2 },
                    { l: 'Div', v: 3 },
                    { l: 'Vort', v: 4 },
                    { l: 'Dye', v: 5 },
                    { l: 'Temp', v: 6 },
                  ]}
                  value={postConfig.debugView ?? 0}
                  onChange={(v) => setPostConfig({ debugView: v })}
                  accent="#f97316"
                />
              </div>
              {(postConfig.debugView ?? 0) !== 0 && (
                <div className="gg-row r2">
                  <Slider label="Scale" v={postConfig.debugScale ?? 10.0} min={0.1} max={100} step={0.1}
                    onChange={v => setPostConfig({ debugScale: v })} accent="#f97316" />
                  <Slider label="Bias" v={postConfig.debugBias ?? 0.0} min={-5} max={5} step={0.01}
                    onChange={v => setPostConfig({ debugBias: v })} accent="#f97316" />
                </div>
              )}
            </div>
          </>
        )}

        {activePanelSection === 'simulation' && (
          <>
            {/* Input */}
            <div className="global-group">
              <span className="gg-title">Input</span>
              <div className="gg-row inline">
                <Chip active={mouseEnabled} onClick={() => setMouseEnabled(!mouseEnabled)} accent="#34d399">
                  Mouse {mouseEnabled ? 'On' : 'Off'}
                </Chip>
                <Chip active={mouseHoverMode} onClick={() => setMouseHoverMode(!mouseHoverMode)} accent="#34d399">
                  Hover {mouseHoverMode ? 'On' : 'Off'}
                </Chip>
                <Chip active={gizmosEnabled} onClick={() => setGizmosEnabled(!gizmosEnabled)} accent="#34d399">
                  Gizmos {gizmosEnabled ? 'On' : 'Off'}
                </Chip>
              </div>
              <div className="gg-row r2">
                <Slider label="Mouse Force" v={config.mouseForce ?? 0.3} min={0} max={1} step={0.01}
                  onChange={v => setFluidConfig({ mouseForce: v })} accent="#34d399" />
                <Slider label="Mouse Radius" v={config.mouseRadius ?? 0.05} min={0.01} max={0.2} step={0.01}
                  onChange={v => setFluidConfig({ mouseRadius: v })} accent="#34d399" />
              </div>
            </div>
          </>
        )}

      </div>

      <style>{`
        /* ============================================
           UNIFIED PANEL v4 - Single Continuous View
           ============================================ */
        
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700&family=Inter:wght@300;400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');
        
        .unified-panel {
          position: fixed;
          top: 12px;
          right: 12px;
          bottom: 12px;
          width: 360px;
          display: flex;
          flex-direction: column;
          background: rgba(10, 12, 16, 0.92);
          backdrop-filter: blur(40px) saturate(150%);
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 16px;
          font-family: 'Inter', -apple-system, sans-serif;
          color: rgba(255, 255, 255, 0.9);
          box-shadow: 
            0 0 0 1px rgba(255, 255, 255, 0.02) inset,
            0 20px 80px rgba(0, 0, 0, 0.6);
          overflow: hidden;
        }
        
        /* Header */
         .up-header {
           display: flex;
           align-items: center;
           justify-content: space-between;
           padding: 14px 16px;
           border-bottom: 1px solid rgba(255, 255, 255, 0.04);
           flex-shrink: 0;
         }

         .up-tabs {
           padding: 10px 12px 12px;
           border-bottom: 1px solid rgba(255, 255, 255, 0.04);
           flex-shrink: 0;
         }

         .up-tabs .ctrl-toggle {
           width: 100%;
         }

         .up-tabs .ctrl-toggle button {
           flex: 1;
         }
        
        .up-brand {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        
        .up-logo {
          font-size: 18px;
          color: #00e5cc;
          text-shadow: 0 0 16px rgba(0, 229, 204, 0.6);
        }
        
        .up-title {
          font-family: 'Syne', sans-serif;
          font-weight: 700;
          font-size: 13px;
          letter-spacing: 0.2em;
        }
        
        .up-ctrls {
          display: flex;
          gap: 4px;
        }
        
        /* Content */
        .up-content {
          flex: 1;
          overflow-y: auto;
          overflow-x: hidden;
          padding: 12px;
        }
        
        .up-content::-webkit-scrollbar { width: 4px; }
        .up-content::-webkit-scrollbar-track { background: transparent; }
        .up-content::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.1); border-radius: 2px; }
        
        /* Divider */
        .divider {
          display: flex;
          align-items: center;
          gap: 10px;
          margin: 16px 0 10px;
        }
        
        .divider:first-child { margin-top: 0; }
        
        .divider span {
          font-family: 'Syne', sans-serif;
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.15em;
          color: var(--da);
        }
        
        .div-line {
          flex: 1;
          height: 1px;
          background: linear-gradient(90deg, var(--da), transparent);
          opacity: 0.3;
        }
        
        /* Emitter Type Bar - Always Visible */
        .emitter-bar {
          display: flex;
          flex-direction: column;
          gap: 6px;
          padding: 8px;
          background: rgba(0, 229, 204, 0.03);
          border: 1px solid rgba(0, 229, 204, 0.1);
          border-radius: 10px;
          margin-bottom: 10px;
        }
        
        .eb-label {
          font-size: 8px;
          font-weight: 600;
          color: rgba(0, 229, 204, 0.5);
          letter-spacing: 0.15em;
          text-align: center;
        }
        
        .eb-types {
          display: flex;
          gap: 4px;
          justify-content: center;
        }
        
        .eb-type {
          width: 38px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 6px;
          color: var(--etc, rgba(255, 255, 255, 0.5));
          font-size: 14px;
          cursor: pointer;
          transition: all 0.12s;
        }
        
        .eb-type:hover {
          background: rgba(255, 255, 255, 0.08);
          border-color: var(--etc);
          transform: translateY(-1px);
        }
        
        .eb-type.active {
          background: rgba(var(--etc-rgb, 0, 229, 204), 0.15);
          border-color: var(--etc);
          box-shadow: 0 0 12px rgba(var(--etc-rgb, 0, 229, 204), 0.3);
        }
        
        .eb-icon { filter: drop-shadow(0 0 4px currentColor); }
        
        .eb-presets {
          display: flex;
          flex-wrap: wrap;
          gap: 4px;
          padding-top: 6px;
          border-top: 1px solid rgba(255, 255, 255, 0.04);
          overflow: hidden;
        }
        
        .eb-preset {
          padding: 5px 10px;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 5px;
          color: rgba(255, 255, 255, 0.65);
          font-size: 10px;
          cursor: pointer;
          transition: all 0.12s;
        }
        
        .eb-preset:hover {
          background: rgba(0, 229, 204, 0.12);
          border-color: rgba(0, 229, 204, 0.3);
          color: #00e5cc;
        }
        
        /* Legacy dropdown styles (kept for compatibility) */
        .ad-type {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 2px;
          padding: 8px 4px;
          background: none;
          border: 1px solid transparent;
          border-radius: 8px;
          color: rgba(255, 255, 255, 0.5);
          font-size: 9px;
          cursor: pointer;
          transition: all 0.15s;
        }
        
        .ad-type span:first-child { font-size: 14px; color: var(--atc); }
        .ad-type:hover { background: rgba(255, 255, 255, 0.05); }
        .ad-type.active { background: rgba(255, 255, 255, 0.08); border-color: var(--atc); }
        
        .ad-presets {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          padding: 10px;
          max-height: 140px;
          overflow-y: auto;
        }
        
        .ad-preset {
          padding: 6px 12px;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 6px;
          color: rgba(255, 255, 255, 0.7);
          font-size: 11px;
          cursor: pointer;
          transition: all 0.15s;
        }
        
        .ad-preset:hover {
          background: rgba(0, 229, 204, 0.1);
          border-color: rgba(0, 229, 204, 0.3);
          color: #00e5cc;
        }
        
        /* Emitter List */
        .emitter-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        
        .empty-msg {
          padding: 20px;
          text-align: center;
          color: rgba(255, 255, 255, 0.3);
          font-size: 12px;
        }
        
        /* Emitter Card */
        .emitter-card {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.04);
          border-radius: 12px;
          overflow: hidden;
          transition: all 0.15s;
        }
        
        .emitter-card.expanded {
          border-color: rgba(var(--ec-rgb, 0, 229, 204), 0.2);
          background: rgba(255, 255, 255, 0.03);
        }
        
        .ec-header {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 12px;
          cursor: pointer;
          transition: background 0.15s;
        }
        
        .ec-header:hover { background: rgba(255, 255, 255, 0.02); }
        
        .ec-icon {
          font-size: 12px;
          color: var(--ec);
          width: 16px;
          text-align: center;
        }
        
        .ec-name {
          flex: 1;
          background: none;
          border: none;
          color: rgba(255, 255, 255, 0.9);
          font-size: 12px;
          font-weight: 500;
          outline: none;
          min-width: 0;
        }
        
        .ec-actions {
          display: flex;
          gap: 4px;
          opacity: 0;
          transition: opacity 0.15s;
        }
        
        .ec-header:hover .ec-actions { opacity: 1; }
        
        .ec-btn {
          width: 22px;
          height: 22px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(255, 255, 255, 0.05);
          border: none;
          border-radius: 4px;
          color: rgba(255, 255, 255, 0.5);
          font-size: 12px;
          cursor: pointer;
          transition: all 0.15s;
        }
        
        .ec-btn:hover { background: rgba(255, 255, 255, 0.1); color: #fff; }
        .ec-btn.danger:hover { background: rgba(255, 107, 107, 0.2); color: #ff6b6b; }
        
        .ec-expand {
          font-size: 10px;
          color: rgba(255, 255, 255, 0.3);
          transition: transform 0.2s;
        }
        
        .ec-expand.open { transform: rotate(180deg); }
        
        /* Emitter Body */
        .ec-body {
          padding: 0 12px 12px;
          overflow: hidden;
        }
        
        .ec-row {
          display: grid;
          gap: 8px;
          margin-top: 8px;
        }
        
        .ec-row.r2 { grid-template-columns: 1fr 1fr; }
        .ec-row.r3 { grid-template-columns: 1fr 1fr 1fr; }
        .ec-row.r4 { grid-template-columns: 1fr 1fr 1fr 1fr; }
        .ec-row.r5 { grid-template-columns: 1fr 1fr 1fr 1fr 1fr; }
        
        .ec-row.inline {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 8px;
        }
        
        .ec-label {
          font-size: 9px;
          color: rgba(255, 255, 255, 0.4);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        
        .ec-info {
          font-size: 10px;
          color: rgba(255, 255, 255, 0.3);
          font-style: italic;
        }
        
        .ec-type {
          margin-top: 8px;
          padding-top: 8px;
          border-top: 1px solid rgba(255, 255, 255, 0.04);
        }
        
        /* Global Groups */
        .global-group {
          margin-bottom: 12px;
          padding: 10px;
          background: rgba(255, 255, 255, 0.015);
          border-radius: 10px;
        }
        
        .gg-title {
          display: block;
          font-size: 9px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.4);
          text-transform: uppercase;
          letter-spacing: 0.1em;
          margin-bottom: 8px;
        }
        
        .gg-label {
          font-size: 9px;
          color: rgba(255, 255, 255, 0.4);
          text-transform: uppercase;
        }
        
        .gg-row {
          display: grid;
          gap: 8px;
          margin-top: 8px;
        }
        
        .gg-row:first-of-type { margin-top: 0; }
        .gg-row.r2 { grid-template-columns: 1fr 1fr; }
        .gg-row.r3 { grid-template-columns: 1fr 1fr 1fr; }
        
	        .gg-row.inline {
	          display: flex;
	          flex-wrap: wrap;
	          align-items: center;
	          gap: 8px;
	        }

	        .pfx-stack {
	          display: flex;
	          flex-direction: column;
	          gap: 6px;
	          margin-top: 8px;
	        }

	        .pfx-row {
	          display: grid;
	          grid-template-columns: 1fr 28px 28px auto;
	          align-items: center;
	          gap: 8px;
	        }

	        .pfx-core {
	          font-size: 9px;
	          color: rgba(255, 255, 255, 0.4);
	          text-transform: uppercase;
	          letter-spacing: 0.08em;
	          padding: 6px 10px;
	          border: 1px solid rgba(255, 255, 255, 0.06);
	          background: rgba(255, 255, 255, 0.02);
	          border-radius: 999px;
	        }
	        
	        /* Controls */
	        .ctrl-slider {
	          display: flex;
	          flex-direction: column;
          gap: 3px;
        }
        
        .cs-head {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
        }
        
        .cs-label {
          font-size: 9px;
          color: rgba(255, 255, 255, 0.45);
          text-transform: uppercase;
          letter-spacing: 0.03em;
        }
        
        .cs-val {
          font-family: 'JetBrains Mono', monospace;
          font-size: 9px;
          color: rgba(255, 255, 255, 0.55);
        }
        
        .cs-track {
          position: relative;
          height: 4px;
          background: rgba(255, 255, 255, 0.08);
          border-radius: 2px;
        }
        
        .cs-fill {
          position: absolute;
          top: 0;
          left: 0;
          height: 100%;
          border-radius: 2px;
        }
        
        .cs-track input[type="range"] {
          position: absolute;
          top: -6px;
          left: 0;
          width: 100%;
          height: 16px;
          -webkit-appearance: none;
          background: transparent;
          cursor: pointer;
        }
        
        .cs-track input[type="range"]::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 10px;
          height: 10px;
          background: #fff;
          border-radius: 50%;
          box-shadow: 0 1px 4px rgba(0, 0, 0, 0.4);
        }
        
        .ctrl-num {
          display: flex;
          flex-direction: column;
          gap: 3px;
        }
        
        .cn-label {
          font-size: 9px;
          color: rgba(255, 255, 255, 0.45);
          text-transform: uppercase;
        }
        
        .ctrl-num input {
          width: 100%;
          height: 24px;
          padding: 0 6px;
          background: rgba(0, 0, 0, 0.25);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 5px;
          color: rgba(255, 255, 255, 0.9);
          font-family: 'JetBrains Mono', monospace;
          font-size: 10px;
          text-align: center;
          outline: none;
        }
        
        .ctrl-num input:focus { border-color: rgba(0, 229, 204, 0.4); }
        .ctrl-num input::-webkit-inner-spin-button { opacity: 0; }
        
        .ctrl-toggle {
          display: flex;
          background: rgba(0, 0, 0, 0.2);
          border-radius: 5px;
          padding: 2px;
        }
        
        .ctrl-toggle button {
          padding: 4px 8px;
          background: none;
          border: none;
          border-radius: 3px;
          color: rgba(255, 255, 255, 0.45);
          font-size: 9px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.12s;
        }
        
        .ctrl-toggle button:hover { color: rgba(255, 255, 255, 0.7); }
        .ctrl-toggle button.active {
          background: rgba(255, 255, 255, 0.1);
          color: var(--ta, #00e5cc);
        }
        
        .ctrl-color {
          display: flex;
          align-items: center;
          gap: 6px;
        }
        
        .ctrl-color input[type="color"] {
          width: 22px;
          height: 22px;
          padding: 0;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          -webkit-appearance: none;
        }
        
        .ctrl-color input::-webkit-color-swatch-wrapper { padding: 0; }
        .ctrl-color input::-webkit-color-swatch { border: none; border-radius: 4px; }
        
        .ctrl-color span {
          font-family: 'JetBrains Mono', monospace;
          font-size: 9px;
          color: rgba(255, 255, 255, 0.5);
        }
        
        .ctrl-select {
          height: 24px;
          padding: 0 8px;
          background: rgba(0, 0, 0, 0.25);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 5px;
          color: rgba(255, 255, 255, 0.9);
          font-size: 10px;
          outline: none;
          cursor: pointer;
        }
        
        .ctrl-text {
          flex: 1;
          height: 26px;
          padding: 0 10px;
          background: rgba(0, 0, 0, 0.25);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 6px;
          color: rgba(255, 255, 255, 0.9);
          font-size: 12px;
          outline: none;
        }
        
        .ctrl-text:focus { border-color: rgba(0, 229, 204, 0.4); }
        
        .ctrl-chip {
          height: 24px;
          padding: 0 10px;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 5px;
          color: rgba(255, 255, 255, 0.55);
          font-size: 10px;
          cursor: pointer;
          transition: all 0.12s;
        }
        
        .ctrl-chip:hover { background: rgba(255, 255, 255, 0.08); }
        .ctrl-chip.active {
          background: rgba(var(--ca-rgb, 0, 229, 204), 0.15);
          border-color: var(--ca);
          color: var(--ca);
        }
      `}</style>
    </aside>
  );
};

export default UnifiedPanel;
