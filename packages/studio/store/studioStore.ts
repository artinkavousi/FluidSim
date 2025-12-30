/**
 * @package studio/store
 * Zustand store for FluidStudio state management
 */

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type { FluidConfig2D, PerfStats2D } from '../../fluid-2d/FluidSolver2D';
import { defaultConfig2D } from '../../fluid-2d/FluidSolver2D';
import type { Emitter, EmitterType, SelectionState } from '../../fluid-2d/emitters/types';
import type { RenderOutput2DConfig } from '../../fluid-2d/render/RenderOutput2D';
import { defaultPostConfig } from '../../fluid-2d/render/RenderOutput2D';
import { getHistoryManager, type HistoryManager } from './historyManager';
import { getPresetManager, type StudioPreset } from './presetManager';

// ============================================
// Types
// ============================================

export type PanelSection = 
  | 'simulation'
  | 'emitters'
  | 'rendering'
  | 'audio'
  | 'export';

export type EditorMode = 
  | 'select'
  | 'draw'
  | 'add-emitter'
  | 'pan';

export type EmitterAddMode = EmitterType | null;

export interface ViewportSettings {
  zoom: number;
  panX: number;
  panY: number;
  showGrid: boolean;
  gridSize: number;
  snapToGrid: boolean;
  snapAngle: number;
}

export interface UISettings {
  showControlPanel: boolean;
  showEmitterList: boolean;
  showProperties: boolean;
  showTimeline: boolean;
  theme: 'dark' | 'light';
  panelWidth: number;
}

export interface AudioState {
  enabled: boolean;
  source: 'microphone' | 'file' | 'system' | null;
  sensitivity: number;
  smoothing: number;
  frequencyData: Float32Array | null;
  levels: Float32Array | null;
  isAnalyzing: boolean;
  beat: boolean;
  beatStrength: number;
  overall: number;
}

export interface ExportSettings {
  format: 'gif' | 'mp4' | 'webm' | 'png-sequence';
  fps: number;
  duration: number;
  width: number;
  height: number;
  quality: number;
}

// ============================================
// Store State
// ============================================

export interface StudioState {
  // Simulation Config
  config: FluidConfig2D;
  setConfig: (config: Partial<FluidConfig2D>) => void;
  resetConfig: () => void;
  
  // Playback
  isPlaying: boolean;
  time: number;
  setIsPlaying: (playing: boolean) => void;
  setTime: (time: number) => void;
  
  // Editor Mode
  editorMode: EditorMode;
  setEditorMode: (mode: EditorMode) => void;
  emitterAddMode: EmitterAddMode;
  setEmitterAddMode: (mode: EmitterAddMode) => void;
  
  // Selection (synced with EmitterManager)
  selection: SelectionState;
  setSelection: (selection: SelectionState) => void;
  
  // Viewport
  viewport: ViewportSettings;
  setViewport: (settings: Partial<ViewportSettings>) => void;
  
  // UI
  ui: UISettings;
  setUI: (settings: Partial<UISettings>) => void;
  activePanelSection: PanelSection;
  setActivePanelSection: (section: PanelSection) => void;
  
  // Audio
  audio: AudioState;
  setAudio: (state: Partial<AudioState>) => void;
  
  // Export
  export: ExportSettings;
  setExport: (settings: Partial<ExportSettings>) => void;
  
  // History (Undo/Redo)
  historyManager: HistoryManager;
  canUndo: boolean;
  canRedo: boolean;
  undoDescription: string | null;
  redoDescription: string | null;
  undo: () => void;
  redo: () => void;
  refreshHistoryState: () => void;
  
  // Presets
  presets: StudioPreset[];
  activePresetId: string | null;
  loadPresets: () => void;
  savePreset: (name: string, emitters: Emitter[], description?: string) => StudioPreset;
  loadPreset: (id: string) => StudioPreset | null;
  deletePreset: (id: string) => boolean;
  updatePresetName: (id: string, name: string) => boolean;
  exportPreset: (id: string) => string | null;
  importPreset: (json: string) => StudioPreset | null;
  
  // Gizmos
  gizmosEnabled: boolean;
  setGizmosEnabled: (enabled: boolean) => void;
  
  // Mouse interaction
  mouseEnabled: boolean;
  setMouseEnabled: (enabled: boolean) => void;
  mouseHoverMode: boolean;
  setMouseHoverMode: (enabled: boolean) => void;
  
  // Post-processing
  postConfig: RenderOutput2DConfig;
  setPostConfig: (config: Partial<RenderOutput2DConfig>) => void;
  resetPostConfig: () => void;

  // Runtime stats (UI readout)
  fps: number;
  setFps: (fps: number) => void;
  perf: PerfStats2D | null;
  setPerf: (perf: PerfStats2D | null) => void;

  // Advanced fluid config
  setFluidConfig: (config: Partial<FluidConfig2D>) => void;
}

// ============================================
// Store Implementation
// ============================================

export const useStudioStore = create<StudioState>()(
  subscribeWithSelector((set, get) => ({
    // ============================================
    // Simulation Config
    // ============================================
    config: { ...defaultConfig2D },
    setConfig: (updates) => set((state) => ({
      config: { ...state.config, ...updates },
    })),
    resetConfig: () => set({ config: { ...defaultConfig2D } }),
    
    // ============================================
    // Playback
    // ============================================
    isPlaying: true,
    time: 0,
    setIsPlaying: (playing) => set({ isPlaying: playing }),
    setTime: (time) => set({ time }),
    
    // ============================================
    // Editor Mode
    // ============================================
    editorMode: 'select',
    setEditorMode: (mode) => set({ editorMode: mode }),
    emitterAddMode: null,
    setEmitterAddMode: (mode) => set({ emitterAddMode: mode }),
    
    // ============================================
    // Selection
    // ============================================
    selection: { primary: null, emitterIds: new Set() },
    setSelection: (selection) => set({ selection }),
    
    // ============================================
    // Viewport
    // ============================================
    viewport: {
      zoom: 1,
      panX: 0,
      panY: 0,
      showGrid: false,
      gridSize: 0.05,
      snapToGrid: false,
      snapAngle: 15,
    },
    setViewport: (settings) => set((state) => ({
      viewport: { ...state.viewport, ...settings },
    })),
    
    // ============================================
    // UI
    // ============================================
    ui: {
      showControlPanel: true,
      showEmitterList: true,
      showProperties: true,
      showTimeline: false,
      theme: 'dark',
      panelWidth: 320,
    },
    setUI: (settings) => set((state) => ({
      ui: { ...state.ui, ...settings },
    })),
    activePanelSection: 'emitters',
    setActivePanelSection: (section) => set({ activePanelSection: section }),
    
    // ============================================
    // Audio
    // ============================================
    audio: {
      enabled: false,
      source: null,
      sensitivity: 1.0,
      smoothing: 0.8,
      frequencyData: null,
      levels: null,
      isAnalyzing: false,
      beat: false,
      beatStrength: 0,
      overall: 0,
    },
    setAudio: (updates) => set((state) => ({
      audio: { ...state.audio, ...updates },
    })),
    
    // ============================================
    // Export
    // ============================================
    export: {
      format: 'gif',
      fps: 30,
      duration: 5,
      width: 1920,
      height: 1080,
      quality: 0.9,
    },
    setExport: (settings) => set((state) => ({
      export: { ...state.export, ...settings },
    })),
    
    // ============================================
    // History
    // ============================================
    historyManager: getHistoryManager(),
    canUndo: false,
    canRedo: false,
    undoDescription: null,
    redoDescription: null,
    
    undo: () => {
      const { historyManager } = get();
      if (historyManager.undo()) {
        get().refreshHistoryState();
      }
    },
    
    redo: () => {
      const { historyManager } = get();
      if (historyManager.redo()) {
        get().refreshHistoryState();
      }
    },
    
    refreshHistoryState: () => {
      const { historyManager } = get();
      set({
        canUndo: historyManager.canUndo(),
        canRedo: historyManager.canRedo(),
        undoDescription: historyManager.getUndoDescription(),
        redoDescription: historyManager.getRedoDescription(),
      });
    },
    
    // ============================================
    // Presets
    // ============================================
    presets: [],
    activePresetId: null,
    
    loadPresets: () => {
      const pm = getPresetManager();
      set({
        presets: pm.getAllPresets(),
        activePresetId: pm.getActivePresetId(),
      });
    },
    
    savePreset: (name, emitters, description) => {
      const { config, postConfig } = get();
      const pm = getPresetManager();
      const preset = pm.createPreset(name, config, postConfig, emitters, { description });
      set({ presets: pm.getAllPresets() });
      return preset;
    },
    
    loadPreset: (id) => {
      const pm = getPresetManager();
      const preset = pm.getPreset(id);
      if (preset) {
        pm.setActivePreset(id);
        set({
          config: { ...preset.config },
          postConfig: { ...defaultPostConfig, ...preset.postConfig },
          activePresetId: id,
        });
        return preset;
      }
      return null;
    },
    
    deletePreset: (id) => {
      const pm = getPresetManager();
      const success = pm.deletePreset(id);
      if (success) {
        set({
          presets: pm.getAllPresets(),
          activePresetId: pm.getActivePresetId(),
        });
      }
      return success;
    },
    
    updatePresetName: (id, name) => {
      const pm = getPresetManager();
      const updated = pm.updatePreset(id, { name });
      if (updated) {
        set({ presets: pm.getAllPresets() });
        return true;
      }
      return false;
    },
    
    exportPreset: (id) => {
      const pm = getPresetManager();
      return pm.exportPreset(id);
    },
    
    importPreset: (json) => {
      const pm = getPresetManager();
      const preset = pm.importPreset(json);
      if (preset) {
        set({ presets: pm.getAllPresets() });
      }
      return preset;
    },
    
    // ============================================
    // Gizmos
    // ============================================
    gizmosEnabled: true,
    setGizmosEnabled: (enabled) => set({ gizmosEnabled: enabled }),
    
    // ============================================
    // Mouse
    // ============================================
    mouseEnabled: true,
    setMouseEnabled: (enabled) => set({ mouseEnabled: enabled }),
    mouseHoverMode: true, // Default to hover mode (no click needed)
    setMouseHoverMode: (enabled) => set({ mouseHoverMode: enabled }),
    
    // ============================================
    // Post-processing
    // ============================================
    postConfig: { ...defaultPostConfig },
    setPostConfig: (updates) => set((state) => ({
      postConfig: { ...state.postConfig, ...updates },
    })),
    resetPostConfig: () => set({ postConfig: { ...defaultPostConfig } }),

    // ============================================
    // Runtime stats
    // ============================================
    fps: 0,
    setFps: (fps) => set({ fps }),
    perf: null,
    setPerf: (perf) => set({ perf }),

    // Advanced fluid config
    setFluidConfig: (updates) => set((state) => ({
      config: { ...state.config, ...updates },
    })),
  }))
);

// ============================================
// Selectors
// ============================================

export const selectConfig = (state: StudioState) => state.config;
export const selectIsPlaying = (state: StudioState) => state.isPlaying;
export const selectTime = (state: StudioState) => state.time;
export const selectEditorMode = (state: StudioState) => state.editorMode;
export const selectSelection = (state: StudioState) => state.selection;
export const selectViewport = (state: StudioState) => state.viewport;
export const selectUI = (state: StudioState) => state.ui;
export const selectAudio = (state: StudioState) => state.audio;
export const selectExport = (state: StudioState) => state.export;
export const selectGizmosEnabled = (state: StudioState) => state.gizmosEnabled;
export const selectMouseEnabled = (state: StudioState) => state.mouseEnabled;
export const selectMouseHoverMode = (state: StudioState) => state.mouseHoverMode;
export const selectPostConfig = (state: StudioState) => state.postConfig;

// History selectors
export const selectCanUndo = (state: StudioState) => state.canUndo;
export const selectCanRedo = (state: StudioState) => state.canRedo;
export const selectUndoDescription = (state: StudioState) => state.undoDescription;
export const selectRedoDescription = (state: StudioState) => state.redoDescription;

// Preset selectors
export const selectPresets = (state: StudioState) => state.presets;
export const selectActivePresetId = (state: StudioState) => state.activePresetId;
