/**
 * @package studio/components
 * ControlPanel - Main control panel for simulation parameters
 */

import React, { useState, useCallback } from 'react';
import { useStudioStore } from '../store';
import type { FluidConfig2D } from '../../fluid-2d/FluidSolver2D';
import type { RenderOutput2DConfig } from '../../fluid-2d/render/RenderOutput2D';
import { useAudioAnalyzer } from '../hooks';

// ============================================
// Types
// ============================================

interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  unit?: string;
}

interface SectionProps {
  title: string;
  icon?: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

// ============================================
// Sub-components
// ============================================

const Slider: React.FC<SliderProps> = ({
  label,
  value,
  min,
  max,
  step = 0.01,
  onChange,
  unit = '',
}) => (
  <div className="slider-control">
    <div className="slider-header">
      <span className="slider-label">{label}</span>
      <span className="slider-value">{value.toFixed(2)}{unit}</span>
    </div>
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(parseFloat(e.target.value))}
      className="slider-input"
    />
  </div>
);

const Section: React.FC<SectionProps> = ({
  title,
  icon,
  defaultOpen = true,
  children,
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  
  return (
    <div className="panel-section">
      <button
        className="section-header"
        onClick={() => setIsOpen(!isOpen)}
      >
        {icon && <span className="section-icon">{icon}</span>}
        <span className="section-title">{title}</span>
        <span className={`section-chevron ${isOpen ? 'open' : ''}`}>
          ▼
        </span>
      </button>
      {isOpen && (
        <div className="section-content">
          {children}
        </div>
      )}
    </div>
  );
};

// ============================================
// Audio Section Component
// ============================================

const AudioSection: React.FC = () => {
  const {
    isActive,
    isAnalyzing,
    sourceType,
    audioData,
    frequencyData,
    error,
    connectMicrophone,
    disconnect,
    setGain,
  } = useAudioAnalyzer();
  
  const audioState = useStudioStore((s) => s.audio);
  const setAudio = useStudioStore((s) => s.setAudio);
  
  const [gain, setLocalGain] = useState(1.0);

  // Push audio data to store for use by FluidCanvas
  React.useEffect(() => {
    if (audioData && isActive) {
      setAudio({
        frequencyData: frequencyData,
        levels: audioData.levels,
        beat: audioData.beat,
        beatStrength: audioData.beatStrength,
        overall: audioData.overall,
      });
    }
  }, [audioData, frequencyData, isActive, setAudio]);

  const handleConnectMic = useCallback(async () => {
    try {
      await connectMicrophone();
      setAudio({ enabled: true, source: 'microphone', isAnalyzing: true });
    } catch (err) {
      console.error('Failed to connect microphone:', err);
    }
  }, [connectMicrophone, setAudio]);

  const handleDisconnect = useCallback(() => {
    disconnect();
    setAudio({ 
      enabled: false, 
      source: null, 
      isAnalyzing: false,
      frequencyData: null,
      levels: null,
      beat: false,
      beatStrength: 0,
      overall: 0,
    });
  }, [disconnect, setAudio]);

  const handleGainChange = useCallback((value: number) => {
    setLocalGain(value);
    setGain(value);
    setAudio({ sensitivity: value });
  }, [setGain, setAudio]);

  // Create visualization bars
  const levels = audioData?.levels || new Float32Array(8);
  
  return (
    <div className="panel-section">
      <button
        className="section-header"
        onClick={() => {}} // Toggle handled differently
      >
        <span className="section-icon">🎵</span>
        <span className="section-title">Audio Reactivity</span>
        <span className={`audio-indicator ${isActive ? 'active' : ''}`}>
          {isActive ? '●' : '○'}
        </span>
      </button>
      
      <div className="section-content">
        {/* Connection Controls */}
        <div className="audio-controls">
          {!isActive ? (
            <button className="audio-btn connect" onClick={handleConnectMic}>
              🎤 Connect Microphone
            </button>
          ) : (
            <button className="audio-btn disconnect" onClick={handleDisconnect}>
              ✕ Disconnect
            </button>
          )}
        </div>
        
        {error && (
          <div className="audio-error">
            {error}
          </div>
        )}
        
        {/* Status */}
        {isActive && (
          <>
            <div className="audio-status">
              <span className="status-label">Source:</span>
              <span className="status-value">{sourceType || 'None'}</span>
            </div>
            
            {/* Gain Control */}
            <div className="slider-control">
              <div className="slider-header">
                <span className="slider-label">Sensitivity</span>
                <span className="slider-value">{gain.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min={0.1}
                max={3}
                step={0.1}
                value={gain}
                onChange={(e) => handleGainChange(parseFloat(e.target.value))}
                className="slider-input"
              />
            </div>
            
            {/* Frequency Visualization */}
            <div className="audio-visualizer">
              <span className="sub-label">Frequency Bands</span>
              <div className="frequency-bars">
                {Array.from(levels).map((level, i) => (
                  <div
                    key={i}
                    className="freq-bar"
                    style={{
                      height: `${Math.max(4, level * 100)}%`,
                      backgroundColor: `hsl(${170 + i * 20}, 80%, ${50 + level * 30}%)`,
                    }}
                  />
                ))}
              </div>
              <div className="freq-labels">
                <span>Bass</span>
                <span>Mid</span>
                <span>High</span>
              </div>
            </div>
            
            {/* Beat Indicator */}
            <div className="beat-indicator">
              <span className="sub-label">Beat Detection</span>
              <div className={`beat-dot ${audioData?.beat ? 'beat' : ''}`} />
              <span className="beat-level">
                {audioData?.beatStrength?.toFixed(2) || '0.00'}
              </span>
            </div>
            
            {/* Overall Level */}
            <div className="overall-level">
              <span className="sub-label">Overall Level</span>
              <div className="level-bar-container">
                <div
                  className="level-bar"
                  style={{ width: `${(audioData?.overall || 0) * 100}%` }}
                />
              </div>
            </div>
          </>
        )}
        
        {/* Instructions */}
        {!isActive && (
          <div className="audio-instructions">
            <p>Connect audio to enable reactive emitters.</p>
            <p className="hint">Audio-reactive emitters will pulse with the music!</p>
          </div>
        )}
      </div>
    </div>
  );
};

// ============================================
// Main Component
// ============================================

export const ControlPanel: React.FC = () => {
  const config = useStudioStore((s) => s.config);
  const setConfig = useStudioStore((s) => s.setConfig);
  const postConfig = useStudioStore((s) => s.postConfig);
  const setPostConfig = useStudioStore((s) => s.setPostConfig);
  const isPlaying = useStudioStore((s) => s.isPlaying);
  const setIsPlaying = useStudioStore((s) => s.setIsPlaying);
  const gizmosEnabled = useStudioStore((s) => s.gizmosEnabled);
  const setGizmosEnabled = useStudioStore((s) => s.setGizmosEnabled);
  const mouseEnabled = useStudioStore((s) => s.mouseEnabled);
  const setMouseEnabled = useStudioStore((s) => s.setMouseEnabled);
  
  const handleConfigChange = <K extends keyof FluidConfig2D>(
    key: K,
    value: FluidConfig2D[K]
  ) => {
    setConfig({ [key]: value });
  };
  
  const handlePostConfigChange = <K extends keyof RenderOutput2DConfig>(
    key: K,
    value: RenderOutput2DConfig[K]
  ) => {
    setPostConfig({ [key]: value });
  };

  return (
    <div className="control-panel">
      <div className="panel-header">
        <h2 className="panel-title">Controls</h2>
        <button
          className={`play-button ${isPlaying ? 'playing' : ''}`}
          onClick={() => setIsPlaying(!isPlaying)}
        >
          {isPlaying ? '⏸' : '▶'}
        </button>
      </div>
      
      <div className="panel-content">
        {/* Quick Toggles */}
        <div className="quick-toggles">
          <label className="toggle-item">
            <input
              type="checkbox"
              checked={mouseEnabled}
              onChange={(e) => setMouseEnabled(e.target.checked)}
            />
            <span>Mouse Input</span>
          </label>
          <label className="toggle-item">
            <input
              type="checkbox"
              checked={gizmosEnabled}
              onChange={(e) => setGizmosEnabled(e.target.checked)}
            />
            <span>Gizmos</span>
          </label>
        </div>
        
        {/* Simulation Section */}
        <Section title="Simulation" defaultOpen={true}>
          <Slider
            label="Speed"
            value={config.simSpeed}
            min={0}
            max={3}
            step={0.1}
            onChange={(v) => handleConfigChange('simSpeed', v)}
          />
          <Slider
            label="Viscosity"
            value={config.viscosity}
            min={0}
            max={1}
            onChange={(v) => handleConfigChange('viscosity', v)}
          />
          <Slider
            label="Vorticity"
            value={config.vorticity}
            min={0}
            max={50}
            step={1}
            onChange={(v) => handleConfigChange('vorticity', v)}
          />
          <Slider
            label="Pressure Iterations"
            value={config.pressureIterations}
            min={5}
            max={60}
            step={1}
            onChange={(v) => handleConfigChange('pressureIterations', v)}
          />
        </Section>
        
        {/* Forces Section */}
        <Section title="Forces" defaultOpen={true}>
          <Slider
            label="Velocity Force"
            value={config.velocityForce}
            min={0}
            max={2}
            onChange={(v) => handleConfigChange('velocityForce', v)}
          />
          <Slider
            label="Velocity Radius"
            value={config.velocityRadius * 1000}
            min={0.1}
            max={5}
            step={0.1}
            onChange={(v) => handleConfigChange('velocityRadius', v / 1000)}
          />
          <Slider
            label="Dye Intensity"
            value={config.dyeIntensity}
            min={0}
            max={15}
            step={0.5}
            onChange={(v) => handleConfigChange('dyeIntensity', v)}
          />
          <Slider
            label="Dye Radius"
            value={config.dyeRadius * 1000}
            min={0.1}
            max={10}
            step={0.1}
            onChange={(v) => handleConfigChange('dyeRadius', v / 1000)}
          />
        </Section>
        
        {/* Diffusion Section */}
        <Section title="Diffusion" defaultOpen={false}>
          <Slider
            label="Velocity Diffusion"
            value={config.velocityDiffusion}
            min={0.9}
            max={1}
            step={0.001}
            onChange={(v) => handleConfigChange('velocityDiffusion', v)}
          />
          <Slider
            label="Dye Diffusion"
            value={config.dyeDissipation}
            min={0.9}
            max={1}
            step={0.001}
            onChange={(v) => handleConfigChange('dyeDissipation', v)}
          />
        </Section>
        
        {/* Rendering Section */}
        <Section title="Rendering" defaultOpen={false}>
          <Slider
            label="Brightness"
            value={postConfig.brightness}
            min={0}
            max={3}
            onChange={(v) => handlePostConfigChange('brightness', v)}
          />
          <Slider
            label="Saturation"
            value={postConfig.saturation}
            min={0}
            max={2}
            onChange={(v) => handlePostConfigChange('saturation', v)}
          />
          
          <div className="color-control">
            <span className="color-label">Background</span>
            <input
              type="color"
              value={`#${postConfig.backgroundColor.map(c => 
                Math.round(c * 255).toString(16).padStart(2, '0')
              ).join('')}`}
              onChange={(e) => {
                const hex = e.target.value;
                const r = parseInt(hex.slice(1, 3), 16) / 255;
                const g = parseInt(hex.slice(3, 5), 16) / 255;
                const b = parseInt(hex.slice(5, 7), 16) / 255;
                handlePostConfigChange('backgroundColor', [r, g, b]);
              }}
              className="color-input"
            />
          </div>
        </Section>
        
        {/* Post-processing Section */}
        <Section title="Post-processing" defaultOpen={false}>
          {/* Basic Adjustments */}
          <Slider
            label="Contrast"
            value={postConfig.contrast}
            min={0.5}
            max={2}
            onChange={(v) => handlePostConfigChange('contrast', v)}
          />
          <Slider
            label="Gamma"
            value={postConfig.gamma}
            min={0.5}
            max={2}
            onChange={(v) => handlePostConfigChange('gamma', v)}
          />
          
          {/* Vignette */}
          <div className="sub-section">
            <span className="sub-label">Vignette</span>
            <Slider
              label="Intensity"
              value={postConfig.vignetteIntensity}
              min={0}
              max={1}
              onChange={(v) => handlePostConfigChange('vignetteIntensity', v)}
            />
            {postConfig.vignetteIntensity > 0 && (
              <>
                <Slider
                  label="Radius"
                  value={postConfig.vignetteRadius}
                  min={0.2}
                  max={1.5}
                  onChange={(v) => handlePostConfigChange('vignetteRadius', v)}
                />
                <Slider
                  label="Softness"
                  value={postConfig.vignetteSoftness}
                  min={0.1}
                  max={0.8}
                  onChange={(v) => handlePostConfigChange('vignetteSoftness', v)}
                />
              </>
            )}
          </div>
          
          {/* Chromatic Aberration */}
          <div className="sub-section">
            <span className="sub-label">Chromatic Aberration</span>
            <Slider
              label="Intensity"
              value={postConfig.chromaticAberration}
              min={0}
              max={5}
              step={0.1}
              onChange={(v) => handlePostConfigChange('chromaticAberration', v)}
            />
          </div>
          
          {/* Bloom */}
          <div className="sub-section">
            <span className="sub-label">Bloom</span>
            <Slider
              label="Intensity"
              value={postConfig.bloomIntensity}
              min={0}
              max={2}
              step={0.1}
              onChange={(v) => handlePostConfigChange('bloomIntensity', v)}
            />
            {postConfig.bloomIntensity > 0 && (
              <Slider
                label="Threshold"
                value={postConfig.bloomThreshold}
                min={0}
                max={1}
                onChange={(v) => handlePostConfigChange('bloomThreshold', v)}
              />
            )}
          </div>
          
          {/* Noise */}
          <div className="sub-section">
            <span className="sub-label">Film Grain</span>
            <Slider
              label="Intensity"
              value={postConfig.noiseIntensity}
              min={0}
              max={1}
              onChange={(v) => handlePostConfigChange('noiseIntensity', v)}
            />
          </div>
        </Section>
        
        {/* Audio Section */}
        <AudioSection />
      </div>
      
      <style>{`
        .control-panel {
          display: flex;
          flex-direction: column;
          height: 100%;
          background: rgba(12, 18, 26, 0.95);
          border-left: 1px solid rgba(255, 255, 255, 0.08);
          backdrop-filter: blur(12px);
          font-family: 'Inter', -apple-system, system-ui, sans-serif;
          font-size: 12px;
          color: rgba(255, 255, 255, 0.85);
        }
        
        .panel-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 20px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        }
        
        .panel-title {
          font-size: 14px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.95);
          margin: 0;
          letter-spacing: 0.02em;
        }
        
        .play-button {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          border: none;
          background: rgba(0, 212, 170, 0.15);
          color: rgba(0, 212, 170, 0.95);
          font-size: 14px;
          cursor: pointer;
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        
        .play-button:hover {
          background: rgba(0, 212, 170, 0.25);
          transform: scale(1.05);
        }
        
        .play-button.playing {
          background: rgba(255, 100, 100, 0.15);
          color: rgba(255, 100, 100, 0.95);
        }
        
        .panel-content {
          flex: 1;
          overflow-y: auto;
          padding: 12px 0;
        }
        
        .quick-toggles {
          display: flex;
          gap: 16px;
          padding: 8px 20px 16px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
          margin-bottom: 8px;
        }
        
        .toggle-item {
          display: flex;
          align-items: center;
          gap: 8px;
          cursor: pointer;
          color: rgba(255, 255, 255, 0.7);
          font-size: 11px;
        }
        
        .toggle-item input[type="checkbox"] {
          appearance: none;
          width: 14px;
          height: 14px;
          border: 1px solid rgba(255, 255, 255, 0.25);
          border-radius: 3px;
          background: rgba(255, 255, 255, 0.05);
          cursor: pointer;
          position: relative;
        }
        
        .toggle-item input[type="checkbox"]:checked {
          background: rgba(0, 212, 170, 0.8);
          border-color: rgba(0, 212, 170, 0.9);
        }
        
        .toggle-item input[type="checkbox"]:checked::after {
          content: '✓';
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          font-size: 10px;
          color: white;
        }
        
        .panel-section {
          margin-bottom: 4px;
        }
        
        .section-header {
          display: flex;
          align-items: center;
          gap: 8px;
          width: 100%;
          padding: 10px 20px;
          background: transparent;
          border: none;
          color: rgba(255, 255, 255, 0.75);
          font-size: 11px;
          font-weight: 500;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          cursor: pointer;
          transition: background 0.2s ease;
        }
        
        .section-header:hover {
          background: rgba(255, 255, 255, 0.03);
        }
        
        .section-title {
          flex: 1;
          text-align: left;
        }
        
        .section-chevron {
          font-size: 8px;
          transition: transform 0.2s ease;
          opacity: 0.5;
        }
        
        .section-chevron.open {
          transform: rotate(180deg);
        }
        
        .section-content {
          padding: 8px 20px 16px;
        }
        
        .slider-control {
          margin-bottom: 12px;
        }
        
        .slider-header {
          display: flex;
          justify-content: space-between;
          margin-bottom: 6px;
        }
        
        .slider-label {
          color: rgba(255, 255, 255, 0.6);
          font-size: 11px;
        }
        
        .slider-value {
          color: rgba(0, 212, 170, 0.9);
          font-size: 11px;
          font-family: 'JetBrains Mono', monospace;
        }
        
        .slider-input {
          width: 100%;
          height: 4px;
          appearance: none;
          background: rgba(255, 255, 255, 0.1);
          border-radius: 2px;
          outline: none;
          cursor: pointer;
        }
        
        .slider-input::-webkit-slider-thumb {
          appearance: none;
          width: 14px;
          height: 14px;
          border-radius: 50%;
          background: rgba(0, 212, 170, 0.9);
          border: 2px solid rgba(12, 18, 26, 0.8);
          cursor: grab;
          transition: transform 0.1s ease;
        }
        
        .slider-input::-webkit-slider-thumb:hover {
          transform: scale(1.1);
        }
        
        .slider-input::-webkit-slider-thumb:active {
          cursor: grabbing;
        }
        
        .color-control {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-top: 8px;
        }
        
        .color-label {
          color: rgba(255, 255, 255, 0.6);
          font-size: 11px;
        }
        
        .color-input {
          width: 32px;
          height: 24px;
          border: 1px solid rgba(255, 255, 255, 0.15);
          border-radius: 4px;
          cursor: pointer;
          background: transparent;
          padding: 0;
        }
        
        .color-input::-webkit-color-swatch-wrapper {
          padding: 2px;
        }
        
        .color-input::-webkit-color-swatch {
          border: none;
          border-radius: 2px;
        }
        
        .sub-section {
          margin-top: 12px;
          padding-top: 10px;
          border-top: 1px solid rgba(255, 255, 255, 0.05);
        }
        
        .sub-label {
          display: block;
          font-size: 10px;
          font-weight: 500;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: rgba(255, 255, 255, 0.4);
          margin-bottom: 8px;
        }
        
        /* Audio Section Styles */
        .audio-indicator {
          font-size: 10px;
          color: rgba(255, 255, 255, 0.3);
        }
        
        .audio-indicator.active {
          color: rgba(0, 212, 170, 0.9);
          animation: pulse 1.5s ease infinite;
        }
        
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        
        .audio-controls {
          margin-bottom: 12px;
        }
        
        .audio-btn {
          width: 100%;
          padding: 10px 16px;
          border-radius: 6px;
          border: 1px solid rgba(255, 255, 255, 0.15);
          background: rgba(255, 255, 255, 0.05);
          color: rgba(255, 255, 255, 0.8);
          font-size: 12px;
          cursor: pointer;
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
        }
        
        .audio-btn:hover {
          background: rgba(255, 255, 255, 0.1);
          border-color: rgba(255, 255, 255, 0.25);
        }
        
        .audio-btn.connect:hover {
          background: rgba(0, 212, 170, 0.15);
          border-color: rgba(0, 212, 170, 0.4);
          color: rgba(0, 212, 170, 0.95);
        }
        
        .audio-btn.disconnect {
          background: rgba(255, 80, 80, 0.1);
          border-color: rgba(255, 80, 80, 0.3);
          color: rgba(255, 120, 120, 0.9);
        }
        
        .audio-btn.disconnect:hover {
          background: rgba(255, 80, 80, 0.2);
        }
        
        .audio-error {
          padding: 8px 12px;
          background: rgba(255, 80, 80, 0.1);
          border: 1px solid rgba(255, 80, 80, 0.3);
          border-radius: 4px;
          color: rgba(255, 120, 120, 0.9);
          font-size: 11px;
          margin-bottom: 12px;
        }
        
        .audio-status {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
          font-size: 11px;
        }
        
        .status-label {
          color: rgba(255, 255, 255, 0.5);
        }
        
        .status-value {
          color: rgba(0, 212, 170, 0.9);
          text-transform: capitalize;
        }
        
        .audio-visualizer {
          margin-top: 12px;
          padding-top: 10px;
          border-top: 1px solid rgba(255, 255, 255, 0.05);
        }
        
        .frequency-bars {
          display: flex;
          align-items: flex-end;
          gap: 4px;
          height: 60px;
          padding: 4px;
          background: rgba(0, 0, 0, 0.2);
          border-radius: 4px;
        }
        
        .freq-bar {
          flex: 1;
          min-height: 4px;
          border-radius: 2px;
          transition: height 0.05s ease-out;
        }
        
        .freq-labels {
          display: flex;
          justify-content: space-between;
          margin-top: 4px;
          font-size: 9px;
          color: rgba(255, 255, 255, 0.3);
        }
        
        .beat-indicator {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-top: 12px;
          padding-top: 10px;
          border-top: 1px solid rgba(255, 255, 255, 0.05);
        }
        
        .beat-dot {
          width: 12px;
          height: 12px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.2);
          transition: all 0.1s ease;
        }
        
        .beat-dot.beat {
          background: rgba(255, 100, 150, 0.9);
          box-shadow: 0 0 12px rgba(255, 100, 150, 0.6);
          transform: scale(1.2);
        }
        
        .beat-level {
          font-family: 'JetBrains Mono', monospace;
          font-size: 10px;
          color: rgba(255, 255, 255, 0.5);
        }
        
        .overall-level {
          margin-top: 12px;
        }
        
        .level-bar-container {
          height: 6px;
          background: rgba(0, 0, 0, 0.3);
          border-radius: 3px;
          overflow: hidden;
        }
        
        .level-bar {
          height: 100%;
          background: linear-gradient(90deg, rgba(0, 212, 170, 0.8), rgba(0, 230, 180, 0.9));
          border-radius: 3px;
          transition: width 0.05s ease-out;
        }
        
        .audio-instructions {
          font-size: 11px;
          color: rgba(255, 255, 255, 0.5);
          text-align: center;
          padding: 8px;
        }
        
        .audio-instructions .hint {
          font-size: 10px;
          color: rgba(0, 212, 170, 0.6);
          margin-top: 4px;
        }
      `}</style>
    </div>
  );
};

export default ControlPanel;
