/**
 * @package studio/panels
 * ControlSidebar - Editorial Glassmorphism Design
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { colors, typography, radius, effects, spacing, zIndex } from '../ui';
import { useStudioStore } from '../store';
import { useAudioAnalyzer } from '../hooks';
import type { FluidConfig2D } from '../../fluid-2d/FluidSolver2D';
import type { Color3 } from '../../fluid-2d/types';

const c3hex = (c: Color3): string =>
  `#${[c[0], c[1], c[2]]
    .map((v) => Math.round(Math.min(1, Math.max(0, v)) * 255).toString(16).padStart(2, '0'))
    .join('')}`;

const hex2c3 = (h: string): Color3 => {
  const x = h.replace('#', '');
  return [
    parseInt(x.slice(0, 2), 16) / 255,
    parseInt(x.slice(2, 4), 16) / 255,
    parseInt(x.slice(4, 6), 16) / 255,
  ];
};

// ============================================
// Types
// ============================================

type TabId = 'physics' | 'visuals' | 'audio' | 'export';

// ============================================
// Compact Slider Component
// ============================================

interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  precision?: number;
  onChange: (v: number) => void;
  accent?: string;
}

const Slider: React.FC<SliderProps> = ({ 
  label, value, min, max, step = 0.01, unit = '', precision = 2, onChange, accent 
}) => (
  <div className="slider-row">
    <span className="slider-label">{label}</span>
    <input
      type="range"
      className="slider-input"
      value={value}
      min={min}
      max={max}
      step={step}
      onChange={(e) => onChange(Number(e.target.value))}
      style={{ '--accent': accent || colors.accent.primary } as React.CSSProperties}
    />
    <span className="slider-value">{value.toFixed(precision)}{unit}</span>
    <style>{`
      .slider-row {
        display: grid;
        grid-template-columns: 100px 1fr 60px;
        align-items: center;
        gap: ${spacing[2]};
        padding: ${spacing[1.5]} 0;
      }
      .slider-label {
        font-size: ${typography.fontSize.xs};
        color: ${colors.text.tertiary};
        text-transform: uppercase;
        letter-spacing: ${typography.letterSpacing.wide};
      }
      .slider-input {
        -webkit-appearance: none;
        width: 100%;
        height: 3px;
        background: ${colors.glass.medium};
        border-radius: 2px;
        cursor: pointer;
      }
      .slider-input::-webkit-slider-thumb {
        -webkit-appearance: none;
        width: 12px;
        height: 12px;
        background: var(--accent);
        border-radius: 50%;
        box-shadow: 0 0 8px var(--accent);
        cursor: pointer;
        transition: transform 0.1s;
      }
      .slider-input::-webkit-slider-thumb:hover {
        transform: scale(1.2);
      }
      .slider-value {
        font-family: ${typography.fontFamily.mono};
        font-size: ${typography.fontSize.xs};
        color: ${colors.text.secondary};
        text-align: right;
      }
    `}</style>
  </div>
);

// ============================================
// Section Component
// ============================================

interface SectionProps {
  title: string;
  icon?: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

const Section: React.FC<SectionProps> = ({ title, icon, children, defaultOpen = true }) => {
  const [open, setOpen] = useState(defaultOpen);
  
  return (
    <div className="section">
      <button className="section-header" onClick={() => setOpen(!open)}>
        {icon && <span className="section-icon">{icon}</span>}
        <span className="section-title">{title}</span>
        <span className={`section-chevron ${open ? 'open' : ''}`}>›</span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            className="section-content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
      <style>{`
        .section {
          margin-bottom: ${spacing[1]};
        }
        .section-header {
          display: flex;
          align-items: center;
          gap: ${spacing[2]};
          width: 100%;
          padding: ${spacing[2.5]} ${spacing[3]};
          background: ${colors.glass.light};
          border: none;
          border-radius: ${radius.md};
          color: ${colors.text.secondary};
          cursor: pointer;
          transition: all ${effects.transition.fast};
        }
        .section-header:hover {
          background: ${colors.glass.medium};
          color: ${colors.text.primary};
        }
        .section-icon {
          font-size: ${typography.fontSize.md};
        }
        .section-title {
          flex: 1;
          font-family: ${typography.fontFamily.body};
          font-size: ${typography.fontSize.xs};
          font-weight: ${typography.fontWeight.semibold};
          text-transform: uppercase;
          letter-spacing: ${typography.letterSpacing.wider};
          text-align: left;
        }
        .section-chevron {
          font-size: ${typography.fontSize.lg};
          transition: transform ${effects.transition.fast};
        }
        .section-chevron.open {
          transform: rotate(90deg);
        }
        .section-content {
          overflow: hidden;
          padding: ${spacing[2]} ${spacing[3]};
        }
      `}</style>
    </div>
  );
};

// ============================================
// Physics Tab
// ============================================

const PhysicsTab: React.FC = () => {
  const config = useStudioStore((s) => s.config);
  const setConfig = useStudioStore((s) => s.setConfig);
  const set = <K extends keyof FluidConfig2D>(k: K, v: FluidConfig2D[K]) => setConfig({ [k]: v });

  return (
    <div className="tab-content">
      <Section title="Dynamics" icon="⚡">
        <Slider label="Sim Speed" value={config.simSpeed} min={0} max={3} step={0.1} onChange={(v) => set('simSpeed', v)} />
        <Slider label="Viscosity" value={config.viscosity} min={0} max={1} onChange={(v) => set('viscosity', v)} accent={colors.accent.blue} />
        <Slider label="Vorticity" value={config.vorticity} min={0} max={50} step={1} precision={0} onChange={(v) => set('vorticity', v)} accent={colors.accent.tertiary} />
      </Section>
      <Section title="Solver" icon="⚙" defaultOpen={false}>
        <Slider label="Iterations" value={config.pressureIterations} min={5} max={60} step={1} precision={0} onChange={(v) => set('pressureIterations', v)} />
      </Section>
      <Section title="Forces" icon="💨">
        <Slider label="Velocity" value={config.velocityForce} min={0} max={2} onChange={(v) => set('velocityForce', v)} />
        <Slider label="V. Radius" value={config.velocityRadius * 1000} min={0.1} max={5} step={0.1} unit="px" onChange={(v) => set('velocityRadius', v / 1000)} />
        <Slider label="Dye" value={config.dyeIntensity} min={0} max={15} step={0.5} onChange={(v) => set('dyeIntensity', v)} accent={colors.accent.secondary} />
        <Slider label="D. Radius" value={config.dyeRadius * 1000} min={0.1} max={10} step={0.1} unit="px" onChange={(v) => set('dyeRadius', v / 1000)} />
      </Section>
      <Section title="Diffusion" icon="🌊" defaultOpen={false}>
        <Slider label="Velocity" value={config.velocityDiffusion} min={0.9} max={1} step={0.001} precision={3} onChange={(v) => set('velocityDiffusion', v)} />
        <Slider label="Dye" value={config.dyeDissipation} min={0.9} max={1} step={0.001} precision={3} onChange={(v) => set('dyeDissipation', v)} />
      </Section>
    </div>
  );
};

// ============================================
// Visuals Tab
// ============================================

const VisualsTab: React.FC = () => {
  const postConfig = useStudioStore((s) => s.postConfig);
  const setPostConfig = useStudioStore((s) => s.setPostConfig);

  return (
    <div className="tab-content">
      <Section title="Base" icon="🎨">
        <Slider label="Brightness" value={postConfig.brightness} min={0} max={3} onChange={(v) => setPostConfig({ brightness: v })} accent={colors.accent.amber} />
        <Slider label="Saturation" value={postConfig.saturation} min={0} max={2} onChange={(v) => setPostConfig({ saturation: v })} accent={colors.accent.secondary} />
        <div className="color-row">
          <span className="color-label">Background</span>
          <input type="color" className="color-picker" value={c3hex(postConfig.backgroundColor)} onChange={(e) => setPostConfig({ backgroundColor: hex2c3(e.target.value) })} />
          <span className="color-hex">{c3hex(postConfig.backgroundColor).toUpperCase()}</span>
        </div>
      </Section>
      <Section title="Tone" icon="📊">
        <Slider label="Contrast" value={postConfig.contrast} min={0.5} max={2} onChange={(v) => setPostConfig({ contrast: v })} />
        <Slider label="Gamma" value={postConfig.gamma} min={0.5} max={2} onChange={(v) => setPostConfig({ gamma: v })} />
      </Section>
      <Section title="Vignette" icon="◐" defaultOpen={false}>
        <Slider label="Intensity" value={postConfig.vignetteIntensity} min={0} max={1} onChange={(v) => setPostConfig({ vignetteIntensity: v })} />
        <Slider label="Radius" value={postConfig.vignetteRadius} min={0.2} max={1.5} onChange={(v) => setPostConfig({ vignetteRadius: v })} />
        <Slider label="Softness" value={postConfig.vignetteSoftness} min={0.1} max={0.8} onChange={(v) => setPostConfig({ vignetteSoftness: v })} />
      </Section>
      <Section title="Effects" icon="✨" defaultOpen={false}>
        <Slider label="Bloom" value={postConfig.bloomIntensity} min={0} max={2} step={0.05} onChange={(v) => setPostConfig({ bloomIntensity: v })} accent={colors.accent.primary} />
        <Slider label="Chromatic" value={postConfig.chromaticAberration} min={0} max={5} step={0.1} onChange={(v) => setPostConfig({ chromaticAberration: v })} accent={colors.accent.tertiary} />
        <Slider label="Grain" value={postConfig.noiseIntensity} min={0} max={1} onChange={(v) => setPostConfig({ noiseIntensity: v })} />
      </Section>
      <style>{`
        .color-row {
          display: grid;
          grid-template-columns: 100px 32px 1fr;
          align-items: center;
          gap: ${spacing[2]};
          padding: ${spacing[1.5]} 0;
        }
        .color-label {
          font-size: ${typography.fontSize.xs};
          color: ${colors.text.tertiary};
          text-transform: uppercase;
          letter-spacing: ${typography.letterSpacing.wide};
        }
        .color-picker {
          width: 28px;
          height: 28px;
          border: none;
          border-radius: ${radius.sm};
          cursor: pointer;
          padding: 0;
        }
        .color-picker::-webkit-color-swatch-wrapper { padding: 0; }
        .color-picker::-webkit-color-swatch {
          border: 1px solid ${colors.glass.border};
          border-radius: ${radius.sm};
        }
        .color-hex {
          font-family: ${typography.fontFamily.mono};
          font-size: ${typography.fontSize.xs};
          color: ${colors.text.muted};
        }
      `}</style>
    </div>
  );
};

// ============================================
// Audio Tab
// ============================================

const AudioTab: React.FC = () => {
  const { isActive, audioData, frequencyData, error, connectMicrophone, disconnect, setGain } = useAudioAnalyzer();
  const setAudio = useStudioStore((s) => s.setAudio);
  const [gain, setLocalGain] = useState(1.0);

  React.useEffect(() => {
    if (audioData && isActive) {
      setAudio({ frequencyData, levels: audioData.levels, beat: audioData.beat, beatStrength: audioData.beatStrength, overall: audioData.overall });
    }
  }, [audioData, frequencyData, isActive, setAudio]);

  const handleConnect = async () => {
    try {
      await connectMicrophone();
      setAudio({ enabled: true, source: 'microphone', isAnalyzing: true });
    } catch (e) { console.error(e); }
  };

  const handleDisconnect = () => {
    disconnect();
    setAudio({ enabled: false, source: null, isAnalyzing: false, frequencyData: null, levels: null, beat: false, beatStrength: 0, overall: 0 });
  };

  const levels = audioData?.levels || new Float32Array(8);

  return (
    <div className="tab-content">
      <Section title="Audio Input" icon="🎤">
        {!isActive ? (
          <button className="connect-btn" onClick={handleConnect}>
            <span>◉</span> Connect Microphone
          </button>
        ) : (
          <button className="disconnect-btn" onClick={handleDisconnect}>
            <span>✕</span> Disconnect
          </button>
        )}
        {error && <div className="error-msg">{error}</div>}
      </Section>
      
      {isActive && (
        <>
          <Section title="Sensitivity" icon="🎚">
            <Slider label="Gain" value={gain} min={0.1} max={3} step={0.1} onChange={(v) => { setLocalGain(v); setGain(v); }} />
          </Section>
          <Section title="Spectrum" icon="📊">
            <div className="spectrum">
              {Array.from(levels).map((l, i) => (
                <div key={i} className="spectrum-bar" style={{ height: `${Math.max(4, l * 100)}%`, background: `hsl(${170 + i * 20}, 70%, ${50 + l * 30}%)` }} />
              ))}
            </div>
            <div className="spectrum-labels">
              {['SUB', 'BASS', 'LOW', 'MID', 'HIGH', 'PRES', 'BRIL', 'AIR'].map((l) => <span key={l}>{l}</span>)}
            </div>
          </Section>
          <Section title="Beat" icon="💓">
            <div className={`beat-indicator ${audioData?.beat ? 'active' : ''}`}>BEAT</div>
            <div className="beat-stats">
              <span>Strength: {(audioData?.beatStrength || 0).toFixed(2)}</span>
              <span>Overall: {(audioData?.overall || 0).toFixed(2)}</span>
            </div>
          </Section>
        </>
      )}
      
      {!isActive && (
        <div className="audio-placeholder">
          <span className="placeholder-icon">🎵</span>
          <p>Connect audio to enable reactive effects</p>
        </div>
      )}
      
      <style>{`
        .connect-btn, .disconnect-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: ${spacing[2]};
          width: 100%;
          padding: ${spacing[3]};
          border: none;
          border-radius: ${radius.md};
          font-family: ${typography.fontFamily.body};
          font-size: ${typography.fontSize.sm};
          font-weight: ${typography.fontWeight.semibold};
          cursor: pointer;
          transition: all ${effects.transition.fast};
        }
        .connect-btn {
          background: ${colors.accent.primaryMuted};
          color: ${colors.accent.primary};
        }
        .connect-btn:hover {
          background: ${colors.accent.primary};
          color: ${colors.text.inverse};
        }
        .disconnect-btn {
          background: rgba(255, 107, 107, 0.15);
          color: ${colors.accent.secondary};
        }
        .disconnect-btn:hover {
          background: ${colors.accent.secondary};
          color: ${colors.text.inverse};
        }
        .error-msg {
          margin-top: ${spacing[2]};
          padding: ${spacing[2]};
          background: rgba(255, 107, 107, 0.1);
          border-radius: ${radius.sm};
          color: ${colors.accent.secondary};
          font-size: ${typography.fontSize.xs};
        }
        .spectrum {
          display: flex;
          align-items: flex-end;
          height: 60px;
          gap: 4px;
          padding: ${spacing[2]};
          background: ${colors.bg.canvas};
          border-radius: ${radius.md};
        }
        .spectrum-bar {
          flex: 1;
          min-height: 4px;
          border-radius: 2px;
          transition: height 0.05s ease;
        }
        .spectrum-labels {
          display: flex;
          justify-content: space-between;
          margin-top: ${spacing[1]};
          font-family: ${typography.fontFamily.mono};
          font-size: 6px;
          color: ${colors.text.muted};
        }
        .beat-indicator {
          display: flex;
          align-items: center;
          justify-content: center;
          height: 40px;
          background: ${colors.glass.light};
          border: 1px solid ${colors.glass.borderSubtle};
          border-radius: ${radius.md};
          color: ${colors.text.muted};
          font-family: ${typography.fontFamily.display};
          font-size: ${typography.fontSize.sm};
          font-weight: ${typography.fontWeight.bold};
          letter-spacing: ${typography.letterSpacing.wider};
          transition: all 0.1s;
        }
        .beat-indicator.active {
          background: rgba(255, 107, 107, 0.2);
          border-color: ${colors.accent.secondary};
          color: ${colors.accent.secondary};
          box-shadow: 0 0 16px ${colors.accent.secondaryGlow};
        }
        .beat-stats {
          display: flex;
          justify-content: space-between;
          margin-top: ${spacing[2]};
          font-family: ${typography.fontFamily.mono};
          font-size: ${typography.fontSize.xs};
          color: ${colors.text.tertiary};
        }
        .audio-placeholder {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: ${spacing[8]} ${spacing[4]};
          text-align: center;
        }
        .placeholder-icon {
          font-size: 40px;
          opacity: 0.25;
          margin-bottom: ${spacing[3]};
        }
        .audio-placeholder p {
          margin: 0;
          font-size: ${typography.fontSize.sm};
          color: ${colors.text.muted};
        }
      `}</style>
    </div>
  );
};

// ============================================
// Export Tab
// ============================================

const ExportTab: React.FC = () => {
  const exportConfig = useStudioStore((s) => s.export);
  const setExport = useStudioStore((s) => s.setExport);

  return (
    <div className="tab-content">
      <Section title="Format" icon="📁">
        <div className="format-grid">
          {['gif', 'mp4', 'webm', 'png-sequence'].map((f) => (
            <button
              key={f}
              className={`format-btn ${exportConfig.format === f ? 'active' : ''}`}
              onClick={() => setExport({ format: f as any })}
            >
              {f.toUpperCase()}
            </button>
          ))}
        </div>
      </Section>
      <Section title="Quality" icon="⚙">
        <Slider label="Width" value={exportConfig.width} min={640} max={3840} step={64} precision={0} unit="px" onChange={(v) => setExport({ width: v })} />
        <Slider label="Height" value={exportConfig.height} min={360} max={2160} step={64} precision={0} unit="px" onChange={(v) => setExport({ height: v })} />
        <Slider label="FPS" value={exportConfig.fps} min={15} max={60} step={1} precision={0} onChange={(v) => setExport({ fps: v })} accent={colors.accent.blue} />
        <Slider label="Quality" value={exportConfig.quality} min={0.5} max={1} step={0.05} onChange={(v) => setExport({ quality: v })} accent={colors.accent.amber} />
      </Section>
      <Section title="Duration" icon="⏱">
        <Slider label="Length" value={exportConfig.duration} min={1} max={30} step={0.5} unit="s" onChange={(v) => setExport({ duration: v })} accent={colors.accent.primary} />
      </Section>
      <div className="export-action">
        <button className="export-btn">
          <span>📤</span> Export
        </button>
      </div>
      <style>{`
        .format-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: ${spacing[1.5]};
        }
        .format-btn {
          padding: ${spacing[2.5]} ${spacing[2]};
          background: ${colors.glass.light};
          border: 1px solid ${colors.glass.borderSubtle};
          border-radius: ${radius.md};
          color: ${colors.text.secondary};
          font-family: ${typography.fontFamily.mono};
          font-size: ${typography.fontSize.xs};
          cursor: pointer;
          transition: all ${effects.transition.fast};
        }
        .format-btn:hover {
          background: ${colors.glass.medium};
          border-color: ${colors.glass.border};
        }
        .format-btn.active {
          background: ${colors.accent.primaryMuted};
          border-color: ${colors.border.accentSubtle};
          color: ${colors.accent.primary};
        }
        .export-action {
          padding: ${spacing[3]} 0;
        }
        .export-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: ${spacing[2]};
          width: 100%;
          padding: ${spacing[3.5]};
          background: ${colors.accent.primary};
          border: none;
          border-radius: ${radius.md};
          color: ${colors.text.inverse};
          font-family: ${typography.fontFamily.body};
          font-size: ${typography.fontSize.sm};
          font-weight: ${typography.fontWeight.bold};
          cursor: pointer;
          transition: all ${effects.transition.fast};
          box-shadow: ${effects.shadow.glow};
        }
        .export-btn:hover {
          transform: translateY(-1px);
          box-shadow: ${effects.shadow.glowStrong};
        }
      `}</style>
    </div>
  );
};

// ============================================
// Main ControlSidebar
// ============================================

export const ControlSidebar: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabId>('physics');
  const isPlaying = useStudioStore((s) => s.isPlaying);
  const setIsPlaying = useStudioStore((s) => s.setIsPlaying);
  const gizmosEnabled = useStudioStore((s) => s.gizmosEnabled);
  const setGizmosEnabled = useStudioStore((s) => s.setGizmosEnabled);
  const mouseEnabled = useStudioStore((s) => s.mouseEnabled);
  const setMouseEnabled = useStudioStore((s) => s.setMouseEnabled);

  const tabs: { id: TabId; label: string; icon: string }[] = [
    { id: 'physics', label: 'Physics', icon: '⚡' },
    { id: 'visuals', label: 'Visuals', icon: '🎨' },
    { id: 'audio', label: 'Audio', icon: '🎵' },
    { id: 'export', label: 'Export', icon: '📤' },
  ];

  const renderTab = () => {
    switch (activeTab) {
      case 'physics': return <PhysicsTab />;
      case 'visuals': return <VisualsTab />;
      case 'audio': return <AudioTab />;
      case 'export': return <ExportTab />;
    }
  };

  return (
    <aside className="control-sidebar">
      {/* Header */}
      <header className="sidebar-header">
        <div className="brand">
          <span className="brand-mark">◈</span>
          <span className="brand-name">Fluid</span>
          <span className="brand-accent">Studio</span>
        </div>
        <div className="header-controls">
          <button className={`ctrl-btn ${mouseEnabled ? 'active' : ''}`} onClick={() => setMouseEnabled(!mouseEnabled)} title="Mouse Input">
            🖱
          </button>
          <button className={`ctrl-btn ${gizmosEnabled ? 'active' : ''}`} onClick={() => setGizmosEnabled(!gizmosEnabled)} title="Gizmos">
            ◎
          </button>
          <button className={`ctrl-btn play ${isPlaying ? 'playing' : ''}`} onClick={() => setIsPlaying(!isPlaying)}>
            {isPlaying ? '⏸' : '▶'}
          </button>
        </div>
      </header>

      {/* Tabs */}
      <nav className="tab-nav">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <span className="tab-icon">{tab.icon}</span>
            <span className="tab-label">{tab.label}</span>
            {activeTab === tab.id && (
              <motion.div className="tab-indicator" layoutId="indicator" transition={{ type: 'spring', stiffness: 500, damping: 35 }} />
            )}
          </button>
        ))}
      </nav>

      {/* Content */}
      <div className="sidebar-content">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -8 }}
            transition={{ duration: 0.12 }}
          >
            {renderTab()}
          </motion.div>
        </AnimatePresence>
      </div>

      <style>{`
        .control-sidebar {
          display: flex;
          flex-direction: column;
          height: 100%;
          width: 320px;
          background: ${effects.glassmorphism.backgroundStrong};
          backdrop-filter: ${effects.glassmorphism.blur};
          border: 1px solid ${colors.glass.border};
          border-radius: ${radius['2xl']};
        }
        
        .sidebar-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: ${spacing[3]} ${spacing[4]};
          border-bottom: 1px solid ${colors.glass.borderSubtle};
          background: ${colors.gradient.glassVertical};
        }
        
        .brand {
          display: flex;
          align-items: center;
          gap: ${spacing[1.5]};
        }
        
        .brand-mark {
          font-size: ${typography.fontSize['2xl']};
          color: ${colors.accent.primary};
        }
        
        .brand-name {
          font-family: ${typography.fontFamily.display};
          font-size: ${typography.fontSize.lg};
          font-weight: ${typography.fontWeight.bold};
          color: ${colors.text.headline};
          letter-spacing: ${typography.letterSpacing.tight};
        }
        
        .brand-accent {
          font-family: ${typography.fontFamily.display};
          font-size: ${typography.fontSize.lg};
          font-weight: ${typography.fontWeight.light};
          color: ${colors.text.secondary};
          letter-spacing: ${typography.letterSpacing.tight};
        }
        
        .header-controls {
          display: flex;
          gap: ${spacing[1]};
        }
        
        .ctrl-btn {
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: ${colors.glass.light};
          border: 1px solid ${colors.glass.borderSubtle};
          border-radius: ${radius.md};
          color: ${colors.text.muted};
          font-size: 13px;
          cursor: pointer;
          transition: all ${effects.transition.fast};
        }
        
        .ctrl-btn:hover {
          background: ${colors.glass.medium};
          color: ${colors.text.secondary};
        }
        
        .ctrl-btn.active {
          background: ${colors.accent.primaryMuted};
          border-color: ${colors.border.accentSubtle};
          color: ${colors.accent.primary};
        }
        
        .ctrl-btn.play {
          background: ${colors.accent.primaryMuted};
          border-color: ${colors.border.accentSubtle};
          color: ${colors.accent.primary};
        }
        
        .ctrl-btn.play.playing {
          background: rgba(255, 107, 107, 0.15);
          border-color: rgba(255, 107, 107, 0.3);
          color: ${colors.accent.secondary};
        }
        
        .tab-nav {
          display: flex;
          padding: ${spacing[2]} ${spacing[3]};
          gap: ${spacing[1]};
          background: ${colors.bg.canvas};
          border-bottom: 1px solid ${colors.glass.borderSubtle};
        }
        
        .tab-btn {
          position: relative;
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: ${spacing[0.5]};
          padding: ${spacing[2]} ${spacing[1]};
          background: transparent;
          border: none;
          border-radius: ${radius.md};
          color: ${colors.text.muted};
          cursor: pointer;
          transition: all ${effects.transition.fast};
        }
        
        .tab-btn:hover {
          background: ${colors.glass.light};
          color: ${colors.text.secondary};
        }
        
        .tab-btn.active {
          color: ${colors.accent.primary};
        }
        
        .tab-icon {
          font-size: ${typography.fontSize.md};
        }
        
        .tab-label {
          font-family: ${typography.fontFamily.body};
          font-size: 9px;
          font-weight: ${typography.fontWeight.semibold};
          text-transform: uppercase;
          letter-spacing: ${typography.letterSpacing.wider};
        }
        
        .tab-indicator {
          position: absolute;
          bottom: 0;
          left: 50%;
          transform: translateX(-50%);
          width: 20px;
          height: 2px;
          background: ${colors.accent.primary};
          border-radius: ${radius.full};
        }
        
        .sidebar-content {
          flex: 1;
          overflow-y: auto;
        }
        
        .tab-content {
          padding: ${spacing[3]};
        }
      `}</style>
    </aside>
  );
};

export default ControlSidebar;
