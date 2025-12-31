/**
 * @package studio/ui/components
 * IconButton - Premium icon-only button with tooltip
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { colors, typography, radius, effects, spacing } from '../theme';

// ============================================
// Types
// ============================================

export interface IconButtonProps {
  icon: React.ReactNode;
  onClick?: () => void;
  label?: string;
  active?: boolean;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'ghost' | 'subtle' | 'solid';
  accentColor?: string;
  className?: string;
  style?: React.CSSProperties;
}

// ============================================
// Component
// ============================================

export const IconButton: React.FC<IconButtonProps> = ({
  icon,
  onClick,
  label,
  active = false,
  disabled = false,
  size = 'md',
  variant = 'ghost',
  accentColor = colors.accent.gold,
  className = '',
  style,
}) => {
  const [showTooltip, setShowTooltip] = useState(false);

  const sizes = {
    sm: { size: 24, icon: 12, radius: radius.md },
    md: { size: 32, icon: 14, radius: radius.lg },
    lg: { size: 40, icon: 18, radius: radius.xl },
  };

  const s = sizes[size];

  const getVariantStyles = () => {
    switch (variant) {
      case 'solid':
        return {
          bg: active ? accentColor : colors.bg.surface,
          border: active ? accentColor : colors.border.default,
          color: active ? colors.bg.primary : colors.text.secondary,
          hoverBg: active ? accentColor : colors.bg.elevated,
        };
      case 'subtle':
        return {
          bg: active ? `${accentColor}20` : 'transparent',
          border: active ? `${accentColor}40` : 'transparent',
          color: active ? accentColor : colors.text.secondary,
          hoverBg: active ? `${accentColor}30` : 'rgba(255,255,255,0.05)',
        };
      case 'ghost':
      default:
        return {
          bg: 'transparent',
          border: 'transparent',
          color: active ? accentColor : colors.text.tertiary,
          hoverBg: 'rgba(255,255,255,0.05)',
        };
    }
  };

  const v = getVariantStyles();

  return (
    <div className="icon-button-wrapper">
      <motion.button
        className={`icon-button ${className}`}
        onClick={onClick}
        disabled={disabled}
        style={{
          width: s.size,
          height: s.size,
          borderRadius: s.radius,
          background: v.bg,
          borderColor: v.border,
          color: v.color,
          fontSize: s.icon,
          opacity: disabled ? 0.4 : 1,
          cursor: disabled ? 'not-allowed' : 'pointer',
          ...style,
        }}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        whileHover={!disabled ? { scale: 1.05 } : undefined}
        whileTap={!disabled ? { scale: 0.95 } : undefined}
        transition={{ duration: 0.1 }}
      >
        {icon}
      </motion.button>

      {/* Tooltip */}
      <AnimatePresence>
        {label && showTooltip && (
          <motion.div
            className="icon-tooltip"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.15 }}
          >
            {label}
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        .icon-button-wrapper {
          position: relative;
          display: inline-flex;
        }
        
        .icon-button {
          display: flex;
          align-items: center;
          justify-content: center;
          border: 1px solid;
          transition: all ${effects.transition.fast};
        }
        
        .icon-button:hover:not(:disabled) {
          background: ${v.hoverBg} !important;
        }
        
        .icon-button:focus-visible {
          outline: 2px solid ${accentColor};
          outline-offset: 2px;
        }
        
        .icon-tooltip {
          position: absolute;
          top: 100%;
          left: 50%;
          transform: translateX(-50%);
          margin-top: 6px;
          padding: 4px 8px;
          background: ${colors.bg.elevated};
          border: 1px solid ${colors.border.default};
          border-radius: ${radius.md};
          font-family: ${typography.fontFamily.body};
          font-size: ${typography.fontSize.xs};
          color: ${colors.text.secondary};
          white-space: nowrap;
          pointer-events: none;
          z-index: 100;
        }
      `}</style>
    </div>
  );
};

export default IconButton;


