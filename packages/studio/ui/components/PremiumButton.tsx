/**
 * @package studio/ui/components
 * PremiumButton - Luxury-grade button variants
 */

import React from 'react';
import { motion } from 'framer-motion';
import { colors, typography, radius, effects, spacing } from '../theme';

// ============================================
// Types
// ============================================

export interface PremiumButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'gold' | 'danger' | 'success';
  size?: 'sm' | 'md' | 'lg';
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  className?: string;
  style?: React.CSSProperties;
  type?: 'button' | 'submit' | 'reset';
}

// ============================================
// Component
// ============================================

export const PremiumButton: React.FC<PremiumButtonProps> = ({
  children,
  onClick,
  variant = 'primary',
  size = 'md',
  icon,
  iconPosition = 'left',
  disabled = false,
  loading = false,
  fullWidth = false,
  className = '',
  style,
  type = 'button',
}) => {
  const sizes = {
    sm: { height: 28, padding: '0 12px', fontSize: typography.fontSize.xs, gap: 6, iconSize: 12 },
    md: { height: 34, padding: '0 16px', fontSize: typography.fontSize.sm, gap: 8, iconSize: 14 },
    lg: { height: 42, padding: '0 20px', fontSize: typography.fontSize.base, gap: 10, iconSize: 16 },
  };

  const variants = {
    primary: {
      bg: `linear-gradient(135deg, ${colors.accent.gold} 0%, ${colors.accent.goldLight} 100%)`,
      color: colors.bg.primary,
      border: 'transparent',
      hoverBg: colors.accent.goldLight,
      shadow: `0 2px 8px ${colors.accent.goldGlow}`,
    },
    secondary: {
      bg: colors.bg.surface,
      color: colors.text.secondary,
      border: colors.border.default,
      hoverBg: colors.bg.elevated,
      shadow: 'none',
    },
    ghost: {
      bg: 'transparent',
      color: colors.text.secondary,
      border: 'transparent',
      hoverBg: 'rgba(255, 255, 255, 0.05)',
      shadow: 'none',
    },
    gold: {
      bg: 'rgba(201, 169, 98, 0.12)',
      color: colors.accent.gold,
      border: colors.border.goldSubtle,
      hoverBg: 'rgba(201, 169, 98, 0.2)',
      shadow: 'none',
    },
    danger: {
      bg: 'rgba(245, 110, 110, 0.12)',
      color: colors.accent.ruby,
      border: 'rgba(245, 110, 110, 0.3)',
      hoverBg: 'rgba(245, 110, 110, 0.2)',
      shadow: 'none',
    },
    success: {
      bg: 'rgba(61, 214, 140, 0.12)',
      color: colors.accent.emerald,
      border: 'rgba(61, 214, 140, 0.3)',
      hoverBg: 'rgba(61, 214, 140, 0.2)',
      shadow: 'none',
    },
  };

  const s = sizes[size];
  const v = variants[variant];
  const isDisabled = disabled || loading;

  return (
    <motion.button
      type={type}
      className={`premium-button ${className}`}
      onClick={onClick}
      disabled={isDisabled}
      style={{
        height: s.height,
        padding: s.padding,
        fontSize: s.fontSize,
        gap: s.gap,
        background: v.bg,
        color: v.color,
        borderColor: v.border,
        boxShadow: v.shadow,
        width: fullWidth ? '100%' : 'auto',
        opacity: isDisabled ? 0.5 : 1,
        cursor: isDisabled ? 'not-allowed' : 'pointer',
        ...style,
      }}
      whileHover={!isDisabled ? { scale: 1.02 } : undefined}
      whileTap={!isDisabled ? { scale: 0.98 } : undefined}
      transition={{ duration: 0.15 }}
    >
      {loading && (
        <span className="spinner">
          <svg viewBox="0 0 24 24" width={s.iconSize} height={s.iconSize}>
            <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="32" strokeLinecap="round">
              <animateTransform attributeName="transform" type="rotate" dur="0.8s" repeatCount="indefinite" from="0 12 12" to="360 12 12"/>
            </circle>
          </svg>
        </span>
      )}
      {!loading && icon && iconPosition === 'left' && (
        <span className="icon" style={{ fontSize: s.iconSize }}>{icon}</span>
      )}
      <span className="label">{children}</span>
      {!loading && icon && iconPosition === 'right' && (
        <span className="icon" style={{ fontSize: s.iconSize }}>{icon}</span>
      )}

      <style>{`
        .premium-button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border: 1px solid;
          border-radius: ${radius.lg};
          font-family: ${typography.fontFamily.body};
          font-weight: ${typography.fontWeight.medium};
          letter-spacing: ${typography.letterSpacing.wide};
          white-space: nowrap;
          transition: all ${effects.transition.fast};
        }
        
        .premium-button:hover:not(:disabled) {
          background: ${v.hoverBg} !important;
        }
        
        .premium-button:focus-visible {
          outline: 2px solid ${colors.accent.gold};
          outline-offset: 2px;
        }
        
        .icon, .spinner {
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        
        .label {
          flex: 1;
          text-align: center;
        }
      `}</style>
    </motion.button>
  );
};

export default PremiumButton;


