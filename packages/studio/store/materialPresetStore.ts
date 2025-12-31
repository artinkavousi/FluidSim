/**
 * @package studio/store
 * Material Preset Store — State management for MaterialGraph presets
 */

import { create } from 'zustand';

export interface MaterialPresetState {
    /** Whether material graph mode is enabled */
    enabled: boolean;
    /** Currently active preset ID */
    activePresetId: string | null;
    /** Quick parameter overrides (hot-updatable) */
    params: Record<string, number>;

    // Actions
    setEnabled: (enabled: boolean) => void;
    setActivePreset: (presetId: string | null) => void;
    setParam: (paramId: string, value: number) => void;
    resetParams: () => void;
}

const DEFAULT_PARAMS: Record<string, number> = {
    intensity: 1.0,
    brightness: 1.0,
    saturation: 1.0,
    fresnelPower: 2.5,
};

export const useMaterialPresetStore = create<MaterialPresetState>((set) => ({
    enabled: false,
    activePresetId: null,
    params: { ...DEFAULT_PARAMS },

    setEnabled: (enabled) => set({ enabled }),

    setActivePreset: (presetId) => set({
        activePresetId: presetId,
        enabled: presetId !== null, // Auto-enable when preset selected
    }),

    setParam: (paramId, value) => set((state) => ({
        params: { ...state.params, [paramId]: value },
    })),

    resetParams: () => set({ params: { ...DEFAULT_PARAMS } }),
}));

export default useMaterialPresetStore;
