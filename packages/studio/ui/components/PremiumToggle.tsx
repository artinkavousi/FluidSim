/**
 * @package studio/ui/components
 * PremiumToggle - Luxury-grade toggle switch
 */

import React from 'react';
import { motion } from 'framer-motion';
import { colors, typography, radius, effects, spacing } from '../theme';

// ============================================
// Types
// ============================================

export interface PremiumToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  description?: string;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'gold' | 'emerald';
}

// ============================================
// Component
// ============================================

export const PremiumToggle: React.FC<PremiumToggleProps> = ({
  checked,
  onChange,
  label,
  description,
  disabled = false,
  size = 'md',
  variant = 'default',
}) => {
  const sizes = {
    sm: { track: { w: 32, h: 16 }, thumb: 12, gap: 8 },
    md: { track: { w: 40, h: 20 }, thumb: 16, gap: 10 },
    lg: { track: { w: 48, h: 24 }, thumb: 20, gap: 12 },
  };
  
  const variantColors = {
    default: colors.accent.gold,
    gold: colors.accent.gold,
    emerald: colors.accent.emerald,
  };
  
  const s = sizes[size];
  const activeColor = variantColors[variant];
  const thumbOffset = checked ? s.track.w - s.thumb - 2 : 2;

  return (
    <label 
      className="premium-toggle"
      style={{ 
        opacity: disabled ? 0.5 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => !disabled && onChange(e.target.checked)}
        disabled={disabled}
      />
      
      <motion.div 
        className="toggle-track"
        style={{
          width: s.track.w,
          height: s.track.h,
        }}
        animate={{
          background: checked 
            ? `linear-gradient(135deg, ${activeColor}cc 0%, ${activeColor} 100%)`
            : colors.bg.surface,
          boxShadow: checked
            ? `0 0 12px ${activeColor}40, inset 0 1px 1px rgba(255,255,255,0.1)`
            : `inset 0 1px 2px rgba(0,0,0,0.3)`,
        }}
        transition={{ duration: 0.2 }}
      >
        <motion.div 
          className="toggle-thumb"
          style={{
            width: s.thumb,
            height: s.thumb,
          }}
          animate={{
            x: thumbOffset,
            boxShadow: checked
              ? `0 2px 6px rgba(0,0,0,0.3), 0 0 8px ${activeColor}30`
              : '0 2px 4px rgba(0,0,0,0.25)',
          }}
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        />
      </motion.div>
      
      {(label || description) && (
        <div className="toggle-content">
          {label && <span className="toggle-label">{label}</span>}
          {description && <span className="toggle-description">{description}</span>}
        </div>
      )}
      
      <style>{`
        .premium-toggle {
          display: inline-flex;
          align-items: flex-start;
          gap: ${s.gap}px;
          user-select: none;
        }
        
        .premium-toggle input {
          position: absolute;
          opacity: 0;
          width: 0;
          height: 0;
        }
        
        .toggle-track {
          position: relative;
          border-radius: ${radius.full};
          border: 1px solid ${colors.border.subtle};
          flex-shrink: 0;
          transition: border-color ${effects.transition.normal};
        }
        
        .premium-toggle:hover .toggle-track {
          border-color: ${colors.border.default};
        }
        
        .toggle-thumb {
          position: absolute;
          top: 50%;
          transform: translateY(-50%);
          background: linear-gradient(180deg, rgba(255,255,255,0.95) 0%, rgba(240,240,240,0.9) 100%);
          border-radius: ${radius.full};
        }
        
        .toggle-content {
          display: flex;
          flex-direction: column;
          gap: 2px;
          padding-top: ${size === 'sm' ? '0' : '1px'};
        }
        
        .toggle-label {
          font-family: ${typography.fontFamily.body};
          font-size: ${typography.fontSize.sm};
          font-weight: ${typography.fontWeight.medium};
          color: ${colors.text.secondary};
          line-height: 1.3;
        }
        
        .toggle-description {
          font-family: ${typography.fontFamily.body};
          font-size: ${typography.fontSize.xs};
          color: ${colors.text.muted};
          line-height: 1.4;
        }
      `}</style>
    </label>
  );
};

export default PremiumToggle;


