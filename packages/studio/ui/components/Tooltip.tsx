/**
 * @package studio/ui/components
 * Tooltip - Premium tooltip component
 */

import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { colors, typography, radius, effects, spacing } from '../theme';

// ============================================
// Types
// ============================================

export interface TooltipProps {
  content: React.ReactNode;
  children: React.ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
  delay?: number;
  disabled?: boolean;
}

// ============================================
// Component
// ============================================

export const Tooltip: React.FC<TooltipProps> = ({
  content,
  children,
  position = 'top',
  delay = 400,
  disabled = false,
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleMouseEnter = () => {
    if (disabled) return;
    timeoutRef.current = setTimeout(() => setIsVisible(true), delay);
  };

  const handleMouseLeave = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setIsVisible(false);
  };

  const positionStyles: Record<string, { main: React.CSSProperties; animation: { y?: number; x?: number } }> = {
    top: {
      main: { bottom: '100%', left: '50%', transform: 'translateX(-50%)', marginBottom: 6 },
      animation: { y: 4 },
    },
    bottom: {
      main: { top: '100%', left: '50%', transform: 'translateX(-50%)', marginTop: 6 },
      animation: { y: -4 },
    },
    left: {
      main: { right: '100%', top: '50%', transform: 'translateY(-50%)', marginRight: 6 },
      animation: { x: 4 },
    },
    right: {
      main: { left: '100%', top: '50%', transform: 'translateY(-50%)', marginLeft: 6 },
      animation: { x: -4 },
    },
  };

  const pos = positionStyles[position];

  return (
    <div 
      className="tooltip-wrapper"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {children}
      
      <AnimatePresence>
        {isVisible && (
          <motion.div
            className="tooltip-content"
            style={pos.main}
            initial={{ opacity: 0, ...pos.animation }}
            animate={{ opacity: 1, y: 0, x: 0 }}
            exit={{ opacity: 0, ...pos.animation }}
            transition={{ duration: 0.15 }}
          >
            {content}
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        .tooltip-wrapper {
          position: relative;
          display: inline-flex;
        }
        
        .tooltip-content {
          position: absolute;
          padding: ${spacing[1.5]} ${spacing[2.5]};
          background: ${colors.bg.elevated};
          border: 1px solid ${colors.border.default};
          border-radius: ${radius.md};
          font-family: ${typography.fontFamily.body};
          font-size: ${typography.fontSize.xs};
          color: ${colors.text.secondary};
          white-space: nowrap;
          pointer-events: none;
          z-index: 1000;
          box-shadow: ${effects.shadow.lg};
        }
      `}</style>
    </div>
  );
};

export default Tooltip;


