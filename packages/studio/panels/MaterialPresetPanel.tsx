/**
 * @package studio/panels
 * MaterialPresetPanel — Control panel for MaterialGraph presets
 * 
 * Provides UI for selecting material presets and adjusting live parameters.
 */

import React, { useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';

// Inline preset definitions for studio package
// These mirror the presets in fluid-2d/materials/presets
const MATERIAL_PRESETS = [
    { id: 'water', name: 'Water', category: 'liquid' },
    { id: 'fire', name: 'Fire', category: 'fire' },
    { id: 'milk', name: 'Milk', category: 'liquid' },
    { id: 'lava', name: 'Lava', category: 'fire' },
    { id: 'smoke', name: 'Smoke', category: 'smoke' },
    { id: 'neon', name: 'Neon', category: 'stylized' },
] as const;

// ============================================
// Types
// ============================================

export interface MaterialPresetPanelProps {
    /** Currently active preset ID */
    activePresetId: string | null;
    /** Callback when preset changes */
    onPresetChange: (presetId: string | null) => void;
    /** Whether material graph mode is enabled */
    enabled: boolean;
    /** Toggle material graph mode on/off */
    onEnabledChange: (enabled: boolean) => void;
    /** Live parameter overrides */
    params?: Record<string, number>;
    /** Callback when parameter changes */
    onParamChange?: (paramId: string, value: number) => void;
    /** Collapsed state */
    collapsed?: boolean;
}

// ============================================
// Styles
// ============================================

const styles = {
    panel: {
        background: 'linear-gradient(135deg, rgba(20, 25, 35, 0.95), rgba(15, 18, 25, 0.98))',
        borderRadius: '12px',
        padding: '16px',
        marginBottom: '12px',
        border: '1px solid rgba(100, 120, 255, 0.15)',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
    },
    header: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '12px',
    },
    title: {
        color: '#E8EAED',
        fontSize: '14px',
        fontWeight: 600,
        margin: 0,
    },
    toggle: {
        padding: '6px 12px',
        borderRadius: '6px',
        border: 'none',
        cursor: 'pointer',
        fontSize: '12px',
        fontWeight: 500,
        transition: 'all 0.2s ease',
    },
    toggleOn: {
        background: 'linear-gradient(135deg, #4CAF50, #45A049)',
        color: '#fff',
    },
    toggleOff: {
        background: 'rgba(100, 100, 100, 0.3)',
        color: '#888',
    },
    presetGrid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '8px',
        marginBottom: '16px',
    },
    presetCard: {
        padding: '12px 8px',
        borderRadius: '8px',
        cursor: 'pointer',
        textAlign: 'center' as const,
        transition: 'all 0.2s ease',
        border: '2px solid transparent',
    },
    presetCardActive: {
        borderColor: '#4A9EFF',
        background: 'rgba(74, 158, 255, 0.15)',
    },
    presetCardInactive: {
        background: 'rgba(50, 55, 70, 0.6)',
    },
    presetLabel: {
        color: '#D0D3D8',
        fontSize: '11px',
        fontWeight: 500,
    },
    presetIcon: {
        fontSize: '20px',
        marginBottom: '4px',
    },
    paramSection: {
        borderTop: '1px solid rgba(100, 120, 255, 0.1)',
        paddingTop: '12px',
    },
    paramLabel: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '6px',
    },
    paramName: {
        color: '#B0B3B8',
        fontSize: '11px',
    },
    paramValue: {
        color: '#7CB3FF',
        fontSize: '11px',
        fontFamily: 'monospace',
    },
    slider: {
        width: '100%',
        height: '4px',
        borderRadius: '2px',
        appearance: 'none' as const,
        background: 'linear-gradient(90deg, rgba(74, 158, 255, 0.3), rgba(74, 158, 255, 0.8))',
        outline: 'none',
        marginBottom: '12px',
    },
} as const;

// ============================================
// Preset Icons
// ============================================

const PRESET_ICONS: Record<string, string> = {
    water: '💧',
    fire: '🔥',
    milk: '🥛',
    lava: '🌋',
    smoke: '💨',
    neon: '✨',
};

// ============================================
// Quick Parameters (adjustable without recompile)
// ============================================

interface QuickParam {
    id: string;
    label: string;
    min: number;
    max: number;
    step: number;
    default: number;
}

const QUICK_PARAMS: QuickParam[] = [
    { id: 'intensity', label: 'Intensity', min: 0, max: 2, step: 0.01, default: 1.0 },
    { id: 'brightness', label: 'Brightness', min: 0.5, max: 1.5, step: 0.01, default: 1.0 },
    { id: 'saturation', label: 'Saturation', min: 0, max: 2, step: 0.01, default: 1.0 },
    { id: 'fresnelPower', label: 'Fresnel Power', min: 1, max: 5, step: 0.1, default: 2.5 },
];

// ============================================
// Component
// ============================================

export function MaterialPresetPanel({
    activePresetId,
    onPresetChange,
    enabled,
    onEnabledChange,
    params = {},
    onParamChange,
    collapsed = false,
}: MaterialPresetPanelProps) {
    const presets = MATERIAL_PRESETS;

    const handlePresetClick = useCallback((id: string) => {
        if (activePresetId === id) {
            onPresetChange(null);
        } else {
            onPresetChange(id);
            if (!enabled) onEnabledChange(true);
        }
    }, [activePresetId, onPresetChange, enabled, onEnabledChange]);

    const handleParamSlider = useCallback((paramId: string, value: number) => {
        onParamChange?.(paramId, value);
    }, [onParamChange]);

    if (collapsed) return null;

    return (
        <div style={styles.panel}>
            {/* Header */}
            <div style={styles.header}>
                <h4 style={styles.title}>🎨 Material Presets</h4>
                <button
                    style={{
                        ...styles.toggle,
                        ...(enabled ? styles.toggleOn : styles.toggleOff),
                    }}
                    onClick={() => onEnabledChange(!enabled)}
                >
                    {enabled ? 'ON' : 'OFF'}
                </button>
            </div>

            {/* Preset Grid */}
            <div style={styles.presetGrid}>
                {presets.map((preset) => (
                    <motion.div
                        key={preset.id}
                        style={{
                            ...styles.presetCard,
                            ...(activePresetId === preset.id
                                ? styles.presetCardActive
                                : styles.presetCardInactive),
                            opacity: enabled ? 1 : 0.5,
                        }}
                        onClick={() => handlePresetClick(preset.id)}
                        whileHover={{ scale: enabled ? 1.05 : 1 }}
                        whileTap={{ scale: enabled ? 0.95 : 1 }}
                    >
                        <div style={styles.presetIcon}>
                            {PRESET_ICONS[preset.id] || '🎨'}
                        </div>
                        <div style={styles.presetLabel}>{preset.name}</div>
                    </motion.div>
                ))}
            </div>

            {/* Quick Parameters */}
            {enabled && activePresetId && (
                <div style={styles.paramSection}>
                    {QUICK_PARAMS.map((param) => {
                        const value = params[param.id] ?? param.default;
                        return (
                            <div key={param.id}>
                                <div style={styles.paramLabel}>
                                    <span style={styles.paramName}>{param.label}</span>
                                    <span style={styles.paramValue}>{value.toFixed(2)}</span>
                                </div>
                                <input
                                    type="range"
                                    style={styles.slider}
                                    min={param.min}
                                    max={param.max}
                                    step={param.step}
                                    value={value}
                                    onChange={(e) => handleParamSlider(param.id, parseFloat(e.target.value))}
                                />
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

export default MaterialPresetPanel;
