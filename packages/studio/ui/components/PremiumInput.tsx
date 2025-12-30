/**
 * @package studio/ui/components
 * PremiumInput - Luxury-grade text/number input
 */

import React, { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { colors, typography, radius, effects, spacing } from '../theme';

// ============================================
// Types
// ============================================

export interface PremiumInputProps {
  value: string | number;
  onChange: (value: string | number) => void;
  type?: 'text' | 'number';
  label?: string;
  placeholder?: string;
  unit?: string;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'ghost';
  icon?: React.ReactNode;
  className?: string;
}

// ============================================
// Component
// ============================================

export const PremiumInput: React.FC<PremiumInputProps> = ({
  value,
  onChange,
  type = 'text',
  label,
  placeholder,
  unit,
  min,
  max,
  step = 1,
  disabled = false,
  size = 'md',
  variant = 'default',
  icon,
  className = '',
}) => {
  const [isFocused, setIsFocused] = useState(false);

  const sizes = {
    sm: { height: 28, padding: '0 10px', fontSize: typography.fontSize.xs },
    md: { height: 34, padding: '0 12px', fontSize: typography.fontSize.sm },
    lg: { height: 40, padding: '0 14px', fontSize: typography.fontSize.base },
  };

  const s = sizes[size];

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (type === 'number') {
      const num = parseFloat(e.target.value);
      if (!isNaN(num)) {
        const clamped = Math.max(min ?? -Infinity, Math.min(max ?? Infinity, num));
        onChange(clamped);
      } else if (e.target.value === '') {
        onChange('');
      }
    } else {
      onChange(e.target.value);
    }
  }, [onChange, type, min, max]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (type === 'number' && isFocused) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -step : step;
      const current = typeof value === 'number' ? value : parseFloat(value as string) || 0;
      const newValue = current + delta;
      const clamped = Math.max(min ?? -Infinity, Math.min(max ?? Infinity, newValue));
      onChange(clamped);
    }
  }, [type, isFocused, value, step, min, max, onChange]);

  return (
    <div className={`premium-input-wrapper ${className}`}>
      {label && <label className="input-label">{label}</label>}
      
      <div 
        className={`input-container ${variant} ${isFocused ? 'focused' : ''}`}
        style={{ 
          height: s.height,
          opacity: disabled ? 0.5 : 1,
        }}
      >
        {icon && <span className="input-icon">{icon}</span>}
        
        <input
          type={type === 'number' ? 'text' : type}
          inputMode={type === 'number' ? 'decimal' : undefined}
          value={value}
          onChange={handleChange}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          onWheel={handleWheel}
          placeholder={placeholder}
          disabled={disabled}
          style={{
            padding: s.padding,
            fontSize: s.fontSize,
          }}
        />
        
        {unit && <span className="input-unit">{unit}</span>}
      </div>

      <style>{`
        .premium-input-wrapper {
          display: flex;
          flex-direction: column;
          gap: ${spacing[1.5]};
        }
        
        .input-label {
          font-family: ${typography.fontFamily.body};
          font-size: ${typography.fontSize.xs};
          font-weight: ${typography.fontWeight.medium};
          color: ${colors.text.tertiary};
          text-transform: uppercase;
          letter-spacing: ${typography.letterSpacing.wide};
        }
        
        .input-container {
          display: flex;
          align-items: center;
          border-radius: ${radius.lg};
          transition: all ${effects.transition.fast};
          overflow: hidden;
        }
        
        .input-container.default {
          background: ${colors.bg.surface};
          border: 1px solid ${colors.border.subtle};
        }
        
        .input-container.ghost {
          background: transparent;
          border: 1px solid transparent;
        }
        
        .input-container.focused {
          border-color: ${colors.accent.gold};
          box-shadow: 0 0 0 2px ${colors.accent.goldGlow};
        }
        
        .input-container:hover:not(.focused) {
          border-color: ${colors.border.default};
        }
        
        .input-icon {
          padding-left: ${spacing[3]};
          font-size: ${s.fontSize};
          color: ${colors.text.muted};
        }
        
        .input-container input {
          flex: 1;
          min-width: 0;
          height: 100%;
          background: transparent;
          border: none;
          outline: none;
          font-family: ${type === 'number' ? typography.fontFamily.mono : typography.fontFamily.body};
          color: ${colors.text.primary};
        }
        
        .input-container input::placeholder {
          color: ${colors.text.muted};
        }
        
        .input-unit {
          padding-right: ${spacing[3]};
          font-family: ${typography.fontFamily.mono};
          font-size: ${typography.fontSize.xs};
          color: ${colors.text.muted};
        }
      `}</style>
    </div>
  );
};

export default PremiumInput;


