/**
 * @package studio/ui/components
 * ValueDisplay - Inline label/value display
 */

import React from 'react';
import { colors, typography, radius, spacing } from '../theme';

export interface ValueDisplayProps {
  label: string;
  value: string | number;
  unit?: string;
  variant?: 'default' | 'highlight' | 'gold';
  size?: 'sm' | 'md';
}

export const ValueDisplay: React.FC<ValueDisplayProps> = ({
  label,
  value,
  unit = '',
  variant = 'default',
  size = 'md',
}) => {
  const variantColors = {
    default: colors.text.secondary,
    highlight: colors.accent.emerald,
    gold: colors.accent.gold,
  };

  const sizes = {
    sm: { label: typography.fontSize['2xs'], value: typography.fontSize.xs },
    md: { label: typography.fontSize.xs, value: typography.fontSize.sm },
  };

  const s = sizes[size];

  return (
    <div className="value-display">
      <span className="display-label">{label}</span>
      <span className="display-value" style={{ color: variantColors[variant] }}>
        {value}{unit}
      </span>

      <style>{`
        .value-display {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: ${spacing[1.5]} 0;
        }
        
        .display-label {
          font-family: ${typography.fontFamily.body};
          font-size: ${s.label};
          color: ${colors.text.muted};
        }
        
        .display-value {
          font-family: ${typography.fontFamily.mono};
          font-size: ${s.value};
          font-weight: ${typography.fontWeight.medium};
          padding: 2px 6px;
          background: rgba(255, 255, 255, 0.03);
          border-radius: ${radius.sm};
        }
      `}</style>
    </div>
  );
};

export default ValueDisplay;


