/**
 * @package studio/ui/components
 * GlassPanel - Premium glassmorphism panel container
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { colors, typography, radius, effects, spacing } from '../theme';

// ============================================
// Types
// ============================================

export interface GlassPanelProps {
  title?: string;
  icon?: React.ReactNode;
  badge?: string | number;
  collapsible?: boolean;
  defaultOpen?: boolean;
  variant?: 'default' | 'elevated' | 'accent' | 'gold';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  children: React.ReactNode;
  headerActions?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  onToggle?: (isOpen: boolean) => void;
}

// ============================================
// Component
// ============================================

export const GlassPanel: React.FC<GlassPanelProps> = ({
  title,
  icon,
  badge,
  collapsible = false,
  defaultOpen = true,
  variant = 'default',
  padding = 'md',
  children,
  headerActions,
  className = '',
  style,
  onToggle,
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const paddingMap = {
    none: 0,
    sm: spacing[2],
    md: spacing[4],
    lg: spacing[5],
  };

  const variantStyles = {
    default: {
      bg: colors.bg.secondary,
      border: colors.border.subtle,
      headerBg: 'transparent',
    },
    elevated: {
      bg: colors.bg.tertiary,
      border: colors.border.default,
      headerBg: 'rgba(255, 255, 255, 0.02)',
    },
    accent: {
      bg: `linear-gradient(135deg, ${colors.bg.secondary} 0%, rgba(201, 169, 98, 0.05) 100%)`,
      border: colors.border.goldSubtle,
      headerBg: 'rgba(201, 169, 98, 0.05)',
    },
    gold: {
      bg: colors.bg.secondary,
      border: colors.accent.goldDark,
      headerBg: 'linear-gradient(135deg, rgba(201, 169, 98, 0.12) 0%, rgba(201, 169, 98, 0.05) 100%)',
    },
  };

  const vs = variantStyles[variant];

  const handleToggle = () => {
    const newState = !isOpen;
    setIsOpen(newState);
    onToggle?.(newState);
  };

  return (
    <div 
      className={`glass-panel ${className}`}
      style={{
        background: vs.bg,
        borderColor: vs.border,
        ...style,
      }}
    >
      {/* Header */}
      {title && (
        <button
          className="panel-header"
          style={{ background: vs.headerBg }}
          onClick={collapsible ? handleToggle : undefined}
          disabled={!collapsible}
        >
          <div className="header-left">
            {icon && <span className="header-icon">{icon}</span>}
            <span className="header-title">{title}</span>
            {badge !== undefined && (
              <span className="header-badge">{badge}</span>
            )}
          </div>
          
          <div className="header-right">
            {headerActions}
            {collapsible && (
              <motion.span 
                className="chevron"
                animate={{ rotate: isOpen ? 0 : -90 }}
                transition={{ duration: 0.2 }}
              >
                ▾
              </motion.span>
            )}
          </div>
        </button>
      )}
      
      {/* Content */}
      <AnimatePresence initial={false}>
        {(!collapsible || isOpen) && (
          <motion.div
            className="panel-content"
            style={{ padding: paddingMap[padding] }}
            initial={collapsible ? { height: 0, opacity: 0 } : false}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        .glass-panel {
          border-radius: ${radius.xl};
          border: 1px solid;
          overflow: hidden;
          backdrop-filter: blur(12px);
        }
        
        .panel-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          width: 100%;
          padding: ${spacing[3]} ${spacing[4]};
          border: none;
          color: ${colors.text.primary};
          font-family: ${typography.fontFamily.body};
          text-align: left;
          transition: background ${effects.transition.fast};
        }
        
        .panel-header:not(:disabled) {
          cursor: pointer;
        }
        
        .panel-header:not(:disabled):hover {
          background: rgba(255, 255, 255, 0.03) !important;
        }
        
        .header-left {
          display: flex;
          align-items: center;
          gap: ${spacing[2]};
        }
        
        .header-icon {
          font-size: ${typography.fontSize.md};
          opacity: 0.8;
        }
        
        .header-title {
          font-size: ${typography.fontSize.xs};
          font-weight: ${typography.fontWeight.semibold};
          text-transform: uppercase;
          letter-spacing: ${typography.letterSpacing.wider};
          color: ${colors.text.secondary};
        }
        
        .header-badge {
          padding: 2px 6px;
          background: ${colors.accent.gold}20;
          border-radius: ${radius.sm};
          font-family: ${typography.fontFamily.mono};
          font-size: ${typography.fontSize['2xs']};
          font-weight: ${typography.fontWeight.medium};
          color: ${colors.accent.gold};
        }
        
        .header-right {
          display: flex;
          align-items: center;
          gap: ${spacing[2]};
        }
        
        .chevron {
          font-size: ${typography.fontSize.xs};
          color: ${colors.text.muted};
        }
        
        .panel-content {
          overflow: hidden;
        }
      `}</style>
    </div>
  );
};

export default GlassPanel;


