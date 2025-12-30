/**
 * @package studio/ui/components
 * PremiumSlider - Luxury-grade slider with visual feedback
 */

import React, { useCallback, useRef, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { colors, typography, radius, effects, spacing } from '../theme';

// ============================================
// Types
// ============================================

export interface PremiumSliderProps {
  value: number;
  min: number;
  max: number;
  step?: number;
  label?: string;
  unit?: string;
  precision?: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  showValue?: boolean;
  accentColor?: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'gold' | 'emerald' | 'sapphire';
  showScale?: boolean;
  scaleSteps?: number;
}

// ============================================
// Helper Functions
// ============================================

const clamp = (value: number, min: number, max: number) => 
  Math.max(min, Math.min(max, value));

const formatValue = (value: number, precision: number) => {
  if (precision === 0) return Math.round(value).toString();
  return value.toFixed(precision);
};

// ============================================
// Component
// ============================================

export const PremiumSlider: React.FC<PremiumSliderProps> = ({
  value,
  min,
  max,
  step = 0.01,
  label,
  unit = '',
  precision = 2,
  onChange,
  disabled = false,
  showValue = true,
  accentColor,
  size = 'md',
  variant = 'default',
  showScale = false,
  scaleSteps = 5,
}) => {
  const trackRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);

  // Variant colors
  const variantColors = {
    default: colors.accent.gold,
    gold: colors.accent.gold,
    emerald: colors.accent.emerald,
    sapphire: colors.accent.sapphire,
  };
  
  const activeColor = accentColor || variantColors[variant];
  const glowColor = variant === 'gold' ? colors.accent.goldGlow 
    : variant === 'emerald' ? colors.accent.emeraldGlow 
    : variant === 'sapphire' ? colors.accent.sapphireGlow 
    : colors.accent.goldGlow;

  // Size variants
  const sizes = {
    sm: { trackHeight: 3, thumbSize: 12, fontSize: typography.fontSize.xs },
    md: { trackHeight: 4, thumbSize: 14, fontSize: typography.fontSize.sm },
    lg: { trackHeight: 5, thumbSize: 16, fontSize: typography.fontSize.base },
  };
  const sizeConfig = sizes[size];

  // Calculate percentage
  const percentage = clamp(((value - min) / (max - min)) * 100, 0, 100);

  // Handle interaction
  const updateValue = useCallback((clientX: number) => {
    if (!trackRef.current || disabled) return;
    
    const rect = trackRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const percent = clamp(x / rect.width, 0, 1);
    const rawValue = min + percent * (max - min);
    const steppedValue = Math.round(rawValue / step) * step;
    const clampedValue = clamp(steppedValue, min, max);
    
    onChange(clampedValue);
  }, [min, max, step, onChange, disabled]);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (disabled) return;
    e.preventDefault();
    setIsDragging(true);
    setShowTooltip(true);
    updateValue(e.clientX);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [updateValue, disabled]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging) return;
    updateValue(e.clientX);
  }, [isDragging, updateValue]);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    setIsDragging(false);
    setTimeout(() => setShowTooltip(false), 300);
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
  }, []);

  // Generate scale marks
  const scaleMarks = showScale ? Array.from({ length: scaleSteps + 1 }, (_, i) => {
    const markValue = min + (max - min) * (i / scaleSteps);
    return { value: markValue, percent: (i / scaleSteps) * 100 };
  }) : [];

  return (
    <div 
      className="premium-slider"
      style={{
        opacity: disabled ? 0.5 : 1,
        pointerEvents: disabled ? 'none' : 'auto',
      }}
    >
      {/* Header */}
      {(label || showValue) && (
        <div className="slider-header">
          {label && <span className="slider-label">{label}</span>}
          {showValue && (
            <span className="slider-value">
              {formatValue(value, precision)}{unit}
            </span>
          )}
        </div>
      )}

      {/* Track Container */}
      <div 
        ref={trackRef}
        className="slider-track-container"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerEnter={() => setIsHovered(true)}
        onPointerLeave={() => { setIsHovered(false); if (!isDragging) setShowTooltip(false); }}
      >
        {/* Track Background */}
        <div 
          className="slider-track"
          style={{ height: sizeConfig.trackHeight }}
        />
        
        {/* Track Fill */}
        <motion.div 
          className="slider-fill"
          style={{ 
            height: sizeConfig.trackHeight,
            background: `linear-gradient(90deg, ${activeColor}dd 0%, ${activeColor} 100%)`,
          }}
          animate={{ 
            width: `${percentage}%`,
            boxShadow: isDragging ? `0 0 12px ${glowColor}` : 'none',
          }}
          transition={{ duration: 0.05 }}
        />
        
        {/* Thumb */}
        <motion.div 
          className="slider-thumb"
          style={{
            width: sizeConfig.thumbSize,
            height: sizeConfig.thumbSize,
            left: `calc(${percentage}% - ${sizeConfig.thumbSize / 2}px)`,
            background: activeColor,
          }}
          animate={{
            scale: isDragging ? 1.15 : isHovered ? 1.05 : 1,
            boxShadow: isDragging || isHovered 
              ? `0 0 16px ${glowColor}, inset 0 1px 2px rgba(255,255,255,0.3)` 
              : `0 2px 4px rgba(0,0,0,0.3), inset 0 1px 2px rgba(255,255,255,0.2)`,
          }}
          transition={{ duration: 0.15 }}
        />

        {/* Tooltip */}
        <AnimatePresence>
          {showTooltip && (
            <motion.div
              className="slider-tooltip"
              style={{ left: `${percentage}%` }}
              initial={{ opacity: 0, y: -4, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.9 }}
              transition={{ duration: 0.15 }}
            >
              {formatValue(value, precision)}{unit}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Scale Marks */}
        {showScale && (
          <div className="slider-scale">
            {scaleMarks.map((mark, i) => (
              <div 
                key={i}
                className="scale-mark"
                style={{ left: `${mark.percent}%` }}
              >
                <div className="scale-tick" />
                <span className="scale-label">{formatValue(mark.value, 0)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <style>{`
        .premium-slider {
          width: 100%;
          margin-bottom: ${spacing[3]};
        }
        
        .slider-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: ${spacing[2]};
        }
        
        .slider-label {
          font-family: ${typography.fontFamily.body};
          font-size: ${sizeConfig.fontSize};
          font-weight: ${typography.fontWeight.medium};
          color: ${colors.text.secondary};
          letter-spacing: ${typography.letterSpacing.wide};
        }
        
        .slider-value {
          font-family: ${typography.fontFamily.mono};
          font-size: ${typography.fontSize.xs};
          color: ${activeColor};
          padding: 2px 6px;
          background: rgba(201, 169, 98, 0.1);
          border-radius: ${radius.sm};
          letter-spacing: 0;
        }
        
        .slider-track-container {
          position: relative;
          height: 24px;
          display: flex;
          align-items: center;
          cursor: pointer;
          touch-action: none;
        }
        
        .slider-track {
          position: absolute;
          left: 0;
          right: 0;
          background: ${colors.bg.surface};
          border-radius: ${radius.full};
          overflow: hidden;
        }
        
        .slider-fill {
          position: absolute;
          left: 0;
          border-radius: ${radius.full};
          transition: box-shadow ${effects.transition.normal};
        }
        
        .slider-thumb {
          position: absolute;
          top: 50%;
          transform: translateY(-50%);
          border-radius: ${radius.full};
          cursor: grab;
          z-index: 2;
          border: 2px solid ${colors.bg.primary};
        }
        
        .slider-thumb:active {
          cursor: grabbing;
        }
        
        .slider-tooltip {
          position: absolute;
          bottom: 100%;
          transform: translateX(-50%);
          margin-bottom: 8px;
          padding: 4px 8px;
          background: ${colors.bg.elevated};
          border: 1px solid ${colors.border.default};
          border-radius: ${radius.md};
          font-family: ${typography.fontFamily.mono};
          font-size: ${typography.fontSize.xs};
          color: ${colors.text.primary};
          white-space: nowrap;
          pointer-events: none;
          z-index: 10;
        }
        
        .slider-scale {
          position: absolute;
          left: 0;
          right: 0;
          top: 100%;
          margin-top: 4px;
          height: 16px;
        }
        
        .scale-mark {
          position: absolute;
          transform: translateX(-50%);
          display: flex;
          flex-direction: column;
          align-items: center;
        }
        
        .scale-tick {
          width: 1px;
          height: 4px;
          background: ${colors.border.default};
        }
        
        .scale-label {
          font-family: ${typography.fontFamily.mono};
          font-size: ${typography.fontSize['2xs']};
          color: ${colors.text.muted};
          margin-top: 2px;
        }
      `}</style>
    </div>
  );
};

export default PremiumSlider;


