/**
 * @package studio/store
 * PresetManager - Handle preset persistence via localStorage
 */

import type { FluidConfig2D } from '../../fluid-2d/FluidSolver2D';
import type { Emitter } from '../../fluid-2d/emitters/types';
import type { RenderOutput2DConfig } from '../../fluid-2d/render/RenderOutput2D';
import { defaultPostConfig } from '../../fluid-2d/render/RenderOutput2D';

// ============================================
// Types
// ============================================

export interface StudioPreset {
  id: string;
  name: string;
  description?: string;
  createdAt: number;
  updatedAt: number;
  config: FluidConfig2D;
  postConfig: RenderOutput2DConfig;
  emitters: Omit<Emitter, 'id'>[];
  thumbnail?: string;
  tags?: string[];
}

export interface PresetStorage {
  version: number;
  presets: StudioPreset[];
  activePresetId: string | null;
  lastSaved: number;
}

const STORAGE_KEY = 'fluidstudio_presets';
const STORAGE_VERSION = 1;

// ============================================
// Preset Manager
// ============================================

class PresetManager {
  private storage: PresetStorage;

  constructor() {
    this.storage = this.loadFromStorage();
  }

  // ============================================
  // Storage I/O
  // ============================================

  private loadFromStorage(): PresetStorage {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as PresetStorage;
        if (parsed.version === STORAGE_VERSION) {
          return {
            ...parsed,
            presets: (parsed.presets ?? []).map((p) => ({
              ...p,
              postConfig: { ...defaultPostConfig, ...(p as any).postConfig },
            })),
          };
        }
      }
    } catch (e) {
      console.warn('[PresetManager] Failed to load presets from localStorage:', e);
    }
    return this.getDefaultStorage();
  }

  private saveToStorage(): void {
    try {
      this.storage.lastSaved = Date.now();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.storage));
    } catch (e) {
      console.error('[PresetManager] Failed to save presets:', e);
    }
  }

  private getDefaultStorage(): PresetStorage {
    return {
      version: STORAGE_VERSION,
      presets: [],
      activePresetId: null,
      lastSaved: 0,
    };
  }

  private generateId(): string {
    return `preset_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // ============================================
  // CRUD Operations
  // ============================================

  getAllPresets(): StudioPreset[] {
    return [...this.storage.presets];
  }

  getPreset(id: string): StudioPreset | undefined {
    return this.storage.presets.find(p => p.id === id);
  }

  createPreset(
    name: string,
    config: FluidConfig2D,
    postConfig: RenderOutput2DConfig,
    emitters: Emitter[],
    options?: { description?: string; tags?: string[]; thumbnail?: string }
  ): StudioPreset {
    const now = Date.now();
    const preset: StudioPreset = {
      id: this.generateId(),
      name,
      description: options?.description,
      createdAt: now,
      updatedAt: now,
      config: { ...config },
      postConfig: { ...postConfig },
      emitters: emitters.map(e => {
        const { id, ...rest } = e as Emitter & { id: string };
        return rest;
      }),
      thumbnail: options?.thumbnail,
      tags: options?.tags,
    };
    
    this.storage.presets.push(preset);
    this.saveToStorage();
    return preset;
  }

  updatePreset(
    id: string,
    updates: Partial<Pick<StudioPreset, 'name' | 'description' | 'config' | 'postConfig' | 'emitters' | 'thumbnail' | 'tags'>>
  ): StudioPreset | null {
    const idx = this.storage.presets.findIndex(p => p.id === id);
    if (idx === -1) return null;
    
    const preset = this.storage.presets[idx];
    const updated = {
      ...preset,
      ...updates,
      updatedAt: Date.now(),
    };
    
    this.storage.presets[idx] = updated;
    this.saveToStorage();
    return updated;
  }

  deletePreset(id: string): boolean {
    const idx = this.storage.presets.findIndex(p => p.id === id);
    if (idx === -1) return false;
    
    this.storage.presets.splice(idx, 1);
    if (this.storage.activePresetId === id) {
      this.storage.activePresetId = null;
    }
    this.saveToStorage();
    return true;
  }

  // ============================================
  // Active Preset
  // ============================================

  getActivePresetId(): string | null {
    return this.storage.activePresetId;
  }

  setActivePreset(id: string | null): void {
    this.storage.activePresetId = id;
    this.saveToStorage();
  }

  // ============================================
  // Import/Export
  // ============================================

  exportPreset(id: string): string | null {
    const preset = this.getPreset(id);
    if (!preset) return null;
    return JSON.stringify(preset, null, 2);
  }

  exportAllPresets(): string {
    return JSON.stringify(this.storage.presets, null, 2);
  }

  importPreset(json: string): StudioPreset | null {
    try {
      const preset = JSON.parse(json) as StudioPreset;
      // Regenerate ID to avoid conflicts
      preset.id = this.generateId();
      preset.createdAt = Date.now();
      preset.updatedAt = Date.now();
      preset.name = `${preset.name} (imported)`;
      
      preset.postConfig = { ...defaultPostConfig, ...(preset as any).postConfig };

      this.storage.presets.push(preset);
      this.saveToStorage();
      return preset;
    } catch (e) {
      console.error('[PresetManager] Failed to import preset:', e);
      return null;
    }
  }

  importPresets(json: string): number {
    try {
      const presets = JSON.parse(json) as StudioPreset[];
      let count = 0;
      for (const preset of presets) {
        preset.id = this.generateId();
        preset.createdAt = Date.now();
        preset.updatedAt = Date.now();
        preset.postConfig = { ...defaultPostConfig, ...(preset as any).postConfig };
        this.storage.presets.push(preset);
        count++;
      }
      this.saveToStorage();
      return count;
    } catch (e) {
      console.error('[PresetManager] Failed to import presets:', e);
      return 0;
    }
  }

  // ============================================
  // Quick Save/Load (Auto-save current session)
  // ============================================

  saveQuickState(
    config: FluidConfig2D,
    postConfig: RenderOutput2DConfig,
    emitters: Emitter[]
  ): void {
    try {
      const quickState = {
        config,
        postConfig,
        emitters: emitters.map(e => {
          const { id, ...rest } = e as Emitter & { id: string };
          return rest;
        }),
        timestamp: Date.now(),
      };
      localStorage.setItem('fluidstudio_quicksave', JSON.stringify(quickState));
    } catch (e) {
      console.warn('[PresetManager] Failed to quick save:', e);
    }
  }

  loadQuickState(): {
    config: FluidConfig2D;
    postConfig: RenderOutput2DConfig;
    emitters: Omit<Emitter, 'id'>[];
  } | null {
    try {
      const raw = localStorage.getItem('fluidstudio_quicksave');
      if (raw) {
        const parsed = JSON.parse(raw);
        return {
          config: parsed.config,
          postConfig: { ...defaultPostConfig, ...(parsed as any).postConfig },
          emitters: parsed.emitters,
        };
      }
    } catch (e) {
      console.warn('[PresetManager] Failed to load quick save:', e);
    }
    return null;
  }

  clearQuickState(): void {
    localStorage.removeItem('fluidstudio_quicksave');
  }

  // ============================================
  // Utility
  // ============================================

  clearAllPresets(): void {
    this.storage = this.getDefaultStorage();
    this.saveToStorage();
  }
}

// Singleton
let instance: PresetManager | null = null;

export function getPresetManager(): PresetManager {
  if (!instance) {
    instance = new PresetManager();
  }
  return instance;
}

export default PresetManager;


