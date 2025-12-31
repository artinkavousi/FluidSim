/**
 * @package studio/panels/components
 * MaterialPresetPicker — UI for selecting and applying material presets
 */

import React, { useState } from 'react';
import {
    getMaterialPresets,
    getMaterialPresetCategories,
    getMaterialPresetsByCategory,
    type MaterialPreset,
} from '../../../fluid-2d/render/MaterialPresets';
import type { RenderOutput2DConfig } from '../../../fluid-2d/render/RenderOutput2D';

// ============================================
// Types
// ============================================

export interface MaterialPresetPickerProps {
    currentConfig: RenderOutput2DConfig;
    onApplyPreset: (config: Partial<RenderOutput2DConfig>) => void;
}

// ============================================
// Category Labels
// ============================================

const categoryLabels: Record<MaterialPreset['category'], string> = {
    liquid: '💧 Liquid',
    fire: '🔥 Fire',
    smoke: '💨 Smoke',
    abstract: '🎨 Abstract',
    stylized: '✨ Stylized',
    cinematic: '🎬 Cinematic',
};

const categoryColors: Record<MaterialPreset['category'], string> = {
    liquid: '#38bdf8',
    fire: '#f97316',
    smoke: '#94a3b8',
    abstract: '#a78bfa',
    stylized: '#f472b6',
    cinematic: '#fbbf24',
};

// ============================================
// MaterialPresetPicker Component
// ============================================

export const MaterialPresetPicker: React.FC<MaterialPresetPickerProps> = ({
    currentConfig,
    onApplyPreset,
}) => {
    const [selectedCategory, setSelectedCategory] = useState<MaterialPreset['category'] | 'all'>('all');
    const [hoveredPreset, setHoveredPreset] = useState<string | null>(null);

    const categories = getMaterialPresetCategories();
    const allPresets = getMaterialPresets();
    const displayedPresets = selectedCategory === 'all'
        ? allPresets
        : getMaterialPresetsByCategory(selectedCategory);

    return (
        <div className="material-preset-picker">
            {/* Category Tabs */}
            <div className="mpp-categories">
                <button
                    className={`mpp-cat-btn ${selectedCategory === 'all' ? 'active' : ''}`}
                    onClick={() => setSelectedCategory('all')}
                    style={{ '--cat-c': '#00e5cc' } as React.CSSProperties}
                >
                    All
                </button>
                {categories.map(cat => (
                    <button
                        key={cat}
                        className={`mpp-cat-btn ${selectedCategory === cat ? 'active' : ''}`}
                        onClick={() => setSelectedCategory(cat)}
                        style={{ '--cat-c': categoryColors[cat] } as React.CSSProperties}
                    >
                        {categoryLabels[cat]}
                    </button>
                ))}
            </div>

            {/* Preset Grid */}
            <div className="mpp-grid">
                {displayedPresets.map(preset => (
                    <button
                        key={preset.id}
                        className={`mpp-preset ${hoveredPreset === preset.id ? 'hovered' : ''}`}
                        onClick={() => onApplyPreset(preset.config)}
                        onMouseEnter={() => setHoveredPreset(preset.id)}
                        onMouseLeave={() => setHoveredPreset(null)}
                        style={{ '--preset-c': categoryColors[preset.category] } as React.CSSProperties}
                    >
                        <span className="mpp-name">{preset.name}</span>
                        <span className="mpp-cat-tag">{preset.category}</span>
                    </button>
                ))}
            </div>

            {/* Preset Description */}
            {hoveredPreset && (
                <div className="mpp-description">
                    {getMaterialPresets().find(p => p.id === hoveredPreset)?.description}
                </div>
            )}
        </div>
    );
};

// ============================================
// CSS Styles (inject via style tag or separate CSS)
// ============================================

export const materialPresetPickerStyles = `
.material-preset-picker {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 8px 0;
}

.mpp-categories {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.mpp-cat-btn {
  padding: 4px 10px;
  border: none;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.06);
  color: #ccc;
  font-size: 11px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.mpp-cat-btn:hover {
  background: rgba(255, 255, 255, 0.12);
  color: #fff;
}

.mpp-cat-btn.active {
  background: var(--cat-c, #00e5cc);
  color: #000;
}

.mpp-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
}

.mpp-preset {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 10px 6px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.04);
  cursor: pointer;
  transition: all 0.15s ease;
}

.mpp-preset:hover,
.mpp-preset.hovered {
  border-color: var(--preset-c, #00e5cc);
  background: rgba(255, 255, 255, 0.08);
  transform: translateY(-1px);
}

.mpp-name {
  font-size: 11px;
  color: #fff;
  font-weight: 500;
  text-align: center;
}

.mpp-cat-tag {
  font-size: 9px;
  color: var(--preset-c, #888);
  text-transform: uppercase;
  margin-top: 2px;
}

.mpp-description {
  font-size: 11px;
  color: #888;
  padding: 6px;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 6px;
  text-align: center;
}
`;
