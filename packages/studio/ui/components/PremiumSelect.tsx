/**
 * @package studio/ui/components
 * PremiumSelect - Luxury-grade dropdown select
 */

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { colors, typography, radius, effects, spacing } from '../theme';

// ============================================
// Types
// ============================================

export interface SelectOption {
  value: string;
  label: string;
  icon?: React.ReactNode;
  description?: string;
}

export interface PremiumSelectProps {
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

// ============================================
// Component
// ============================================

export const PremiumSelect: React.FC<PremiumSelectProps> = ({
  value,
  options,
  onChange,
  label,
  placeholder = 'Select...',
  disabled = false,
  size = 'md',
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const sizes = {
    sm: { height: 28, fontSize: typography.fontSize.xs, optionPadding: '6px 10px' },
    md: { height: 34, fontSize: typography.fontSize.sm, optionPadding: '8px 12px' },
    lg: { height: 40, fontSize: typography.fontSize.base, optionPadding: '10px 14px' },
  };

  const s = sizes[size];
  const selectedOption = options.find(opt => opt.value === value);

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

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setIsOpen(!isOpen);
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    } else if (e.key === 'ArrowDown' && isOpen) {
      e.preventDefault();
      const currentIndex = options.findIndex(opt => opt.value === value);
      const nextIndex = Math.min(currentIndex + 1, options.length - 1);
      onChange(options[nextIndex].value);
    } else if (e.key === 'ArrowUp' && isOpen) {
      e.preventDefault();
      const currentIndex = options.findIndex(opt => opt.value === value);
      const prevIndex = Math.max(currentIndex - 1, 0);
      onChange(options[prevIndex].value);
    }
  };

  return (
    <div className={`premium-select-wrapper ${className}`} ref={containerRef}>
      {label && <label className="select-label">{label}</label>}
      
      <button
        className={`select-trigger ${isOpen ? 'open' : ''}`}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        style={{
          height: s.height,
          fontSize: s.fontSize,
          opacity: disabled ? 0.5 : 1,
        }}
      >
        <span className="trigger-content">
          {selectedOption?.icon && (
            <span className="trigger-icon">{selectedOption.icon}</span>
          )}
          <span className={`trigger-text ${!selectedOption ? 'placeholder' : ''}`}>
            {selectedOption?.label || placeholder}
          </span>
        </span>
        
        <motion.span 
          className="trigger-chevron"
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          ▾
        </motion.span>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="select-dropdown"
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.15 }}
          >
            {options.map((option) => (
              <button
                key={option.value}
                className={`select-option ${option.value === value ? 'selected' : ''}`}
                style={{ padding: s.optionPadding, fontSize: s.fontSize }}
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
              >
                {option.icon && (
                  <span className="option-icon">{option.icon}</span>
                )}
                <div className="option-content">
                  <span className="option-label">{option.label}</span>
                  {option.description && (
                    <span className="option-description">{option.description}</span>
                  )}
                </div>
                {option.value === value && (
                  <span className="option-check">✓</span>
                )}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        .premium-select-wrapper {
          position: relative;
          display: flex;
          flex-direction: column;
          gap: ${spacing[1.5]};
        }
        
        .select-label {
          font-family: ${typography.fontFamily.body};
          font-size: ${typography.fontSize.xs};
          font-weight: ${typography.fontWeight.medium};
          color: ${colors.text.tertiary};
          text-transform: uppercase;
          letter-spacing: ${typography.letterSpacing.wide};
        }
        
        .select-trigger {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 ${spacing[3]};
          background: ${colors.bg.surface};
          border: 1px solid ${colors.border.subtle};
          border-radius: ${radius.lg};
          color: ${colors.text.primary};
          font-family: ${typography.fontFamily.body};
          text-align: left;
          cursor: pointer;
          transition: all ${effects.transition.fast};
        }
        
        .select-trigger:hover:not(:disabled) {
          border-color: ${colors.border.default};
        }
        
        .select-trigger.open {
          border-color: ${colors.accent.gold};
          box-shadow: 0 0 0 2px ${colors.accent.goldGlow};
        }
        
        .trigger-content {
          display: flex;
          align-items: center;
          gap: ${spacing[2]};
          min-width: 0;
        }
        
        .trigger-icon {
          flex-shrink: 0;
          font-size: 1em;
          opacity: 0.7;
        }
        
        .trigger-text {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        
        .trigger-text.placeholder {
          color: ${colors.text.muted};
        }
        
        .trigger-chevron {
          flex-shrink: 0;
          font-size: ${typography.fontSize.xs};
          color: ${colors.text.muted};
          margin-left: ${spacing[2]};
        }
        
        .select-dropdown {
          position: absolute;
          top: 100%;
          left: 0;
          right: 0;
          margin-top: ${spacing[1]};
          background: ${colors.bg.elevated};
          border: 1px solid ${colors.border.default};
          border-radius: ${radius.lg};
          box-shadow: ${effects.shadow.xl};
          overflow: hidden;
          z-index: 100;
          max-height: 200px;
          overflow-y: auto;
        }
        
        .select-option {
          display: flex;
          align-items: center;
          gap: ${spacing[2]};
          width: 100%;
          background: transparent;
          border: none;
          color: ${colors.text.secondary};
          font-family: ${typography.fontFamily.body};
          text-align: left;
          cursor: pointer;
          transition: all ${effects.transition.fast};
        }
        
        .select-option:hover {
          background: rgba(255, 255, 255, 0.05);
          color: ${colors.text.primary};
        }
        
        .select-option.selected {
          background: ${colors.accent.gold}15;
          color: ${colors.accent.gold};
        }
        
        .option-icon {
          flex-shrink: 0;
          font-size: 1em;
          opacity: 0.7;
        }
        
        .option-content {
          flex: 1;
          min-width: 0;
          display: flex;
          flex-direction: column;
        }
        
        .option-label {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        
        .option-description {
          font-size: ${typography.fontSize['2xs']};
          color: ${colors.text.muted};
          margin-top: 2px;
        }
        
        .option-check {
          flex-shrink: 0;
          font-size: ${typography.fontSize.xs};
          color: ${colors.accent.gold};
        }
      `}</style>
    </div>
  );
};

export default PremiumSelect;


