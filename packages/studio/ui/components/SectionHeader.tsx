/**
 * @package studio/ui/components
 * SectionHeader - Premium section divider with title
 */

import React from 'react';
import { colors, typography, spacing } from '../theme';

export interface SectionHeaderProps {
  title: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  variant?: 'default' | 'subtle' | 'gold';
}

export const SectionHeader: React.FC<SectionHeaderProps> = ({
  title,
  icon,
  action,
  variant = 'default',
}) => {
  const variantColors = {
    default: colors.text.tertiary,
    subtle: colors.text.muted,
    gold: colors.accent.gold,
  };

  return (
    <div className="section-header">
      <div className="section-left">
        {icon && <span className="section-icon">{icon}</span>}
        <span className="section-title" style={{ color: variantColors[variant] }}>
          {title}
        </span>
      </div>
      {action && <div className="section-action">{action}</div>}

      <style>{`
        .section-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: ${spacing[2]} 0;
          margin-bottom: ${spacing[2]};
          border-bottom: 1px solid ${colors.border.subtle};
        }
        
        .section-left {
          display: flex;
          align-items: center;
          gap: ${spacing[1.5]};
        }
        
        .section-icon {
          font-size: ${typography.fontSize.sm};
          opacity: 0.6;
        }
        
        .section-title {
          font-family: ${typography.fontFamily.body};
          font-size: ${typography.fontSize['2xs']};
          font-weight: ${typography.fontWeight.semibold};
          text-transform: uppercase;
          letter-spacing: ${typography.letterSpacing.widest};
        }
        
        .section-action {
          display: flex;
          align-items: center;
        }
      `}</style>
    </div>
  );
};

export default SectionHeader;


