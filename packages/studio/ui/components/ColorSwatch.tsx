/**
 * @package studio/ui/components
 * ColorSwatch - Premium color picker with visual feedback
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { colors, typography, radius, effects, spacing } from '../theme';

// ============================================
// Types
// ============================================

export type Color3 = [number, number, number];

export interface ColorSwatchProps {
  color: Color3;
  onChange: (color: Color3) => void;
  label?: string;
  showHex?: boolean;
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  presets?: Color3[];
}

// ============================================
// Helpers
// ============================================

const rgbToHex = (r: number, g: number, b: number): string => {
  return '#' + [r, g, b].map(v => 
    Math.round(v * 255).toString(16).padStart(2, '0')
  ).join('');
};

const hexToRgb = (hex: string): Color3 => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (result) {
    return [
      parseInt(result[1], 16) / 255,
      parseInt(result[2], 16) / 255,
      parseInt(result[3], 16) / 255,
    ];
  }
  return [1, 1, 1];
};

const rgbToHsl = (r: number, g: number, b: number): [number, number, number] => {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return [h, s, l];
};

const defaultPresets: Color3[] = [
  [1, 1, 1],       // White
  [0.8, 0.2, 0.2], // Red
  [0.9, 0.5, 0.2], // Orange  
  [0.9, 0.8, 0.2], // Yellow
  [0.2, 0.8, 0.4], // Green
  [0.2, 0.7, 0.9], // Cyan
  [0.3, 0.5, 0.9], // Blue
  [0.6, 0.3, 0.9], // Purple
  [0.9, 0.3, 0.6], // Pink
  [0.15, 0.15, 0.15], // Dark
];

// ============================================
// Component
// ============================================

export const ColorSwatch: React.FC<ColorSwatchProps> = ({
  color,
  onChange,
  label,
  showHex = true,
  size = 'md',
  disabled = false,
  presets = defaultPresets,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [tempColor, setTempColor] = useState(color);
  const containerRef = useRef<HTMLDivElement>(null);

  const sizes = {
    sm: { swatch: 24, font: typography.fontSize.xs },
    md: { swatch: 32, font: typography.fontSize.sm },
    lg: { swatch: 40, font: typography.fontSize.base },
  };
  
  const s = sizes[size];
  const hex = rgbToHex(color[0], color[1], color[2]);
  const [h, sat, l] = rgbToHsl(color[0], color[1], color[2]);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const handleHexChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (/^#[0-9A-Fa-f]{6}$/.test(value)) {
      onChange(hexToRgb(value));
    }
  }, [onChange]);

  const handleNativeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newColor = hexToRgb(e.target.value);
    onChange(newColor);
  }, [onChange]);

  return (
    <div className="color-swatch-container" ref={containerRef}>
      {label && <span className="swatch-label">{label}</span>}
      
      <div className="swatch-row">
        {/* Main Swatch Button */}
        <button
          className="swatch-button"
          style={{ 
            width: s.swatch, 
            height: s.swatch,
            background: hex,
            opacity: disabled ? 0.5 : 1,
          }}
          onClick={() => !disabled && setIsOpen(!isOpen)}
          disabled={disabled}
        >
          {/* Inner glow effect */}
          <div 
            className="swatch-glow"
            style={{ 
              boxShadow: `0 0 12px ${hex}88, inset 0 0 8px rgba(255,255,255,0.2)`,
            }}
          />
        </button>

        {showHex && (
          <input
            type="text"
            className="hex-input"
            value={hex.toUpperCase()}
            onChange={handleHexChange}
            disabled={disabled}
            style={{ fontSize: s.font }}
          />
        )}

        {/* Native color picker (hidden but accessible) */}
        <input
          type="color"
          value={hex}
          onChange={handleNativeChange}
          className="native-picker"
          disabled={disabled}
        />
      </div>

      {/* Dropdown Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="color-panel"
            initial={{ opacity: 0, y: -8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.95 }}
            transition={{ duration: 0.15 }}
          >
            {/* Preview */}
            <div className="preview-section">
              <div 
                className="color-preview"
                style={{ background: hex }}
              />
              <div className="preview-info">
                <span className="preview-hex">{hex.toUpperCase()}</span>
                <span className="preview-values">
                  RGB({Math.round(color[0]*255)}, {Math.round(color[1]*255)}, {Math.round(color[2]*255)})
                </span>
              </div>
            </div>

            {/* Preset Colors */}
            <div className="presets-section">
              <span className="section-label">Presets</span>
              <div className="presets-grid">
                {presets.map((preset, i) => {
                  const presetHex = rgbToHex(preset[0], preset[1], preset[2]);
                  const isActive = hex === presetHex;
                  return (
                    <button
                      key={i}
                      className={`preset-btn ${isActive ? 'active' : ''}`}
                      style={{ background: presetHex }}
                      onClick={() => {
                        onChange(preset);
                        setIsOpen(false);
                      }}
                    />
                  );
                })}
              </div>
            </div>

            {/* RGB Sliders */}
            <div className="sliders-section">
              {['R', 'G', 'B'].map((channel, i) => (
                <div key={channel} className="channel-row">
                  <span className="channel-label">{channel}</span>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={color[i]}
                    onChange={(e) => {
                      const newColor: Color3 = [...color];
                      newColor[i] = parseFloat(e.target.value);
                      onChange(newColor);
                    }}
                    className={`channel-slider channel-${channel.toLowerCase()}`}
                  />
                  <span className="channel-value">{Math.round(color[i] * 255)}</span>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        .color-swatch-container {
          position: relative;
          display: flex;
          flex-direction: column;
          gap: ${spacing[1.5]};
        }
        
        .swatch-label {
          font-family: ${typography.fontFamily.body};
          font-size: ${typography.fontSize.xs};
          font-weight: ${typography.fontWeight.medium};
          color: ${colors.text.tertiary};
          text-transform: uppercase;
          letter-spacing: ${typography.letterSpacing.wide};
        }
        
        .swatch-row {
          display: flex;
          align-items: center;
          gap: ${spacing[2]};
        }
        
        .swatch-button {
          position: relative;
          border-radius: ${radius.md};
          border: 2px solid ${colors.border.default};
          cursor: pointer;
          transition: all ${effects.transition.fast};
          overflow: hidden;
        }
        
        .swatch-button:hover {
          border-color: ${colors.border.strong};
          transform: scale(1.05);
        }
        
        .swatch-glow {
          position: absolute;
          inset: 0;
          border-radius: inherit;
          pointer-events: none;
        }
        
        .hex-input {
          width: 72px;
          height: 28px;
          padding: 0 ${spacing[2]};
          background: ${colors.bg.surface};
          border: 1px solid ${colors.border.subtle};
          border-radius: ${radius.md};
          font-family: ${typography.fontFamily.mono};
          color: ${colors.text.secondary};
          text-align: center;
          outline: none;
          transition: all ${effects.transition.fast};
        }
        
        .hex-input:focus {
          border-color: ${colors.accent.gold};
          background: ${colors.bg.elevated};
        }
        
        .native-picker {
          width: 28px;
          height: 28px;
          padding: 0;
          border: none;
          background: transparent;
          cursor: pointer;
          opacity: 0.6;
        }
        
        .native-picker::-webkit-color-swatch-wrapper {
          padding: 0;
        }
        
        .native-picker::-webkit-color-swatch {
          border: 1px solid ${colors.border.default};
          border-radius: ${radius.sm};
        }
        
        .color-panel {
          position: absolute;
          top: 100%;
          left: 0;
          margin-top: ${spacing[2]};
          width: 240px;
          padding: ${spacing[3]};
          background: ${colors.bg.elevated};
          border: 1px solid ${colors.border.default};
          border-radius: ${radius.xl};
          box-shadow: ${effects.shadow.xl};
          z-index: 100;
        }
        
        .preview-section {
          display: flex;
          gap: ${spacing[3]};
          margin-bottom: ${spacing[3]};
          padding-bottom: ${spacing[3]};
          border-bottom: 1px solid ${colors.border.subtle};
        }
        
        .color-preview {
          width: 48px;
          height: 48px;
          border-radius: ${radius.lg};
          border: 2px solid ${colors.border.default};
        }
        
        .preview-info {
          display: flex;
          flex-direction: column;
          justify-content: center;
          gap: ${spacing[1]};
        }
        
        .preview-hex {
          font-family: ${typography.fontFamily.mono};
          font-size: ${typography.fontSize.md};
          font-weight: ${typography.fontWeight.semibold};
          color: ${colors.text.primary};
        }
        
        .preview-values {
          font-family: ${typography.fontFamily.mono};
          font-size: ${typography.fontSize.xs};
          color: ${colors.text.muted};
        }
        
        .presets-section {
          margin-bottom: ${spacing[3]};
        }
        
        .section-label {
          display: block;
          font-size: ${typography.fontSize.xs};
          font-weight: ${typography.fontWeight.medium};
          color: ${colors.text.muted};
          text-transform: uppercase;
          letter-spacing: ${typography.letterSpacing.wider};
          margin-bottom: ${spacing[2]};
        }
        
        .presets-grid {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: ${spacing[1.5]};
        }
        
        .preset-btn {
          aspect-ratio: 1;
          border-radius: ${radius.md};
          border: 2px solid transparent;
          cursor: pointer;
          transition: all ${effects.transition.fast};
        }
        
        .preset-btn:hover {
          transform: scale(1.1);
          border-color: rgba(255, 255, 255, 0.3);
        }
        
        .preset-btn.active {
          border-color: ${colors.accent.gold};
          box-shadow: 0 0 8px ${colors.accent.goldGlow};
        }
        
        .sliders-section {
          display: flex;
          flex-direction: column;
          gap: ${spacing[2]};
        }
        
        .channel-row {
          display: flex;
          align-items: center;
          gap: ${spacing[2]};
        }
        
        .channel-label {
          width: 16px;
          font-family: ${typography.fontFamily.mono};
          font-size: ${typography.fontSize.xs};
          font-weight: ${typography.fontWeight.semibold};
          color: ${colors.text.muted};
        }
        
        .channel-slider {
          flex: 1;
          height: 4px;
          appearance: none;
          background: ${colors.bg.surface};
          border-radius: ${radius.full};
          cursor: pointer;
        }
        
        .channel-slider::-webkit-slider-thumb {
          appearance: none;
          width: 12px;
          height: 12px;
          border-radius: ${radius.full};
          background: white;
          border: 2px solid ${colors.bg.primary};
          cursor: grab;
        }
        
        .channel-r::-webkit-slider-thumb { background: #f56e6e; }
        .channel-g::-webkit-slider-thumb { background: #3dd68c; }
        .channel-b::-webkit-slider-thumb { background: #5e9df5; }
        
        .channel-value {
          width: 32px;
          font-family: ${typography.fontFamily.mono};
          font-size: ${typography.fontSize.xs};
          color: ${colors.text.tertiary};
          text-align: right;
        }
      `}</style>
    </div>
  );
};

export default ColorSwatch;


