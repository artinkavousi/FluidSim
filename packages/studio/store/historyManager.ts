/**
 * @package studio/store
 * HistoryManager - Undo/Redo system for FluidStudio
 */

import type { FluidConfig2D } from '../../fluid-2d/FluidSolver2D';
import type { Emitter } from '../../fluid-2d/emitters/types';
import type { RenderOutput2DConfig } from '../../fluid-2d/render/RenderOutput2D';

// ============================================
// Types
// ============================================

export type HistoryActionType =
  | 'emitter_add'
  | 'emitter_remove'
  | 'emitter_update'
  | 'emitter_transform'
  | 'emitter_batch'
  | 'config_update'
  | 'post_config_update'
  | 'scene_clear'
  | 'scene_import';

export interface HistoryAction {
  type: HistoryActionType;
  timestamp: number;
  description: string;
}

// Emitter actions
export interface EmitterAddAction extends HistoryAction {
  type: 'emitter_add';
  emitterId: string;
  emitter: Emitter;
}

export interface EmitterRemoveAction extends HistoryAction {
  type: 'emitter_remove';
  emitterId: string;
  emitter: Emitter;
}

export interface EmitterUpdateAction extends HistoryAction {
  type: 'emitter_update';
  emitterId: string;
  before: Partial<Emitter>;
  after: Partial<Emitter>;
}

export interface EmitterTransformAction extends HistoryAction {
  type: 'emitter_transform';
  emitterId: string;
  before: { position: [number, number]; rotation: number; scale: [number, number] };
  after: { position: [number, number]; rotation: number; scale: [number, number] };
}

export interface EmitterBatchAction extends HistoryAction {
  type: 'emitter_batch';
  actions: HistoryEntry[];
}

// Config actions
export interface ConfigUpdateAction extends HistoryAction {
  type: 'config_update';
  before: Partial<FluidConfig2D>;
  after: Partial<FluidConfig2D>;
}

export interface PostConfigUpdateAction extends HistoryAction {
  type: 'post_config_update';
  before: Partial<RenderOutput2DConfig>;
  after: Partial<RenderOutput2DConfig>;
}

// Scene actions
export interface SceneClearAction extends HistoryAction {
  type: 'scene_clear';
  emitters: Emitter[];
  config: FluidConfig2D;
  postConfig: RenderOutput2DConfig;
}

export interface SceneImportAction extends HistoryAction {
  type: 'scene_import';
  beforeEmitters: Emitter[];
  afterEmitters: Emitter[];
  beforeConfig: FluidConfig2D;
  afterConfig: FluidConfig2D;
  beforePostConfig: RenderOutput2DConfig;
  afterPostConfig: RenderOutput2DConfig;
}

export type HistoryEntry =
  | EmitterAddAction
  | EmitterRemoveAction
  | EmitterUpdateAction
  | EmitterTransformAction
  | EmitterBatchAction
  | ConfigUpdateAction
  | PostConfigUpdateAction
  | SceneClearAction
  | SceneImportAction;

export interface HistoryCallbacks {
  onApplyEmitter: (emitter: Emitter) => void;
  onRemoveEmitter: (id: string) => void;
  onUpdateEmitter: (id: string, updates: Partial<Emitter>) => void;
  onSetEmitterTransform: (id: string, transform: { position: [number, number]; rotation: number; scale: [number, number] }) => void;
  onSetConfig: (config: Partial<FluidConfig2D>) => void;
  onSetPostConfig: (config: Partial<RenderOutput2DConfig>) => void;
  onClearScene: () => void;
  onImportScene: (emitters: Emitter[], config: FluidConfig2D, postConfig: RenderOutput2DConfig) => void;
}

// ============================================
// History Manager
// ============================================

export class HistoryManager {
  private undoStack: HistoryEntry[] = [];
  private redoStack: HistoryEntry[] = [];
  private maxSize: number;
  private callbacks: HistoryCallbacks | null = null;
  private batchMode = false;
  private batchActions: HistoryEntry[] = [];
  private changeListeners: Set<() => void> = new Set();

  constructor(maxSize = 50) {
    this.maxSize = maxSize;
  }

  // ============================================
  // Callbacks
  // ============================================

  setCallbacks(callbacks: HistoryCallbacks): void {
    this.callbacks = callbacks;
  }

  // ============================================
  // Push Actions
  // ============================================

  pushAddEmitter(emitterId: string, emitter: Emitter, description = 'Add emitter'): void {
    this.push({
      type: 'emitter_add',
      timestamp: Date.now(),
      description,
      emitterId,
      emitter: JSON.parse(JSON.stringify(emitter)),
    });
  }

  pushRemoveEmitter(emitterId: string, emitter: Emitter, description = 'Remove emitter'): void {
    this.push({
      type: 'emitter_remove',
      timestamp: Date.now(),
      description,
      emitterId,
      emitter: JSON.parse(JSON.stringify(emitter)),
    });
  }

  pushUpdateEmitter(emitterId: string, before: Partial<Emitter>, after: Partial<Emitter>, description = 'Update emitter'): void {
    this.push({
      type: 'emitter_update',
      timestamp: Date.now(),
      description,
      emitterId,
      before: JSON.parse(JSON.stringify(before)),
      after: JSON.parse(JSON.stringify(after)),
    });
  }

  pushTransformEmitter(
    emitterId: string,
    before: { position: [number, number]; rotation: number; scale: [number, number] },
    after: { position: [number, number]; rotation: number; scale: [number, number] },
    description = 'Transform emitter'
  ): void {
    this.push({
      type: 'emitter_transform',
      timestamp: Date.now(),
      description,
      emitterId,
      before: JSON.parse(JSON.stringify(before)),
      after: JSON.parse(JSON.stringify(after)),
    });
  }

  pushConfigUpdate(before: Partial<FluidConfig2D>, after: Partial<FluidConfig2D>, description = 'Update config'): void {
    this.push({
      type: 'config_update',
      timestamp: Date.now(),
      description,
      before: JSON.parse(JSON.stringify(before)),
      after: JSON.parse(JSON.stringify(after)),
    });
  }

  pushPostConfigUpdate(before: Partial<RenderOutput2DConfig>, after: Partial<RenderOutput2DConfig>, description = 'Update visuals'): void {
    this.push({
      type: 'post_config_update',
      timestamp: Date.now(),
      description,
      before: JSON.parse(JSON.stringify(before)),
      after: JSON.parse(JSON.stringify(after)),
    });
  }

  pushSceneClear(emitters: Emitter[], config: FluidConfig2D, postConfig: RenderOutput2DConfig, description = 'Clear scene'): void {
    this.push({
      type: 'scene_clear',
      timestamp: Date.now(),
      description,
      emitters: JSON.parse(JSON.stringify(emitters)),
      config: JSON.parse(JSON.stringify(config)),
      postConfig: JSON.parse(JSON.stringify(postConfig)),
    });
  }

  pushSceneImport(
    beforeEmitters: Emitter[],
    afterEmitters: Emitter[],
    beforeConfig: FluidConfig2D,
    afterConfig: FluidConfig2D,
    beforePostConfig: RenderOutput2DConfig,
    afterPostConfig: RenderOutput2DConfig,
    description = 'Import scene'
  ): void {
    this.push({
      type: 'scene_import',
      timestamp: Date.now(),
      description,
      beforeEmitters: JSON.parse(JSON.stringify(beforeEmitters)),
      afterEmitters: JSON.parse(JSON.stringify(afterEmitters)),
      beforeConfig: JSON.parse(JSON.stringify(beforeConfig)),
      afterConfig: JSON.parse(JSON.stringify(afterConfig)),
      beforePostConfig: JSON.parse(JSON.stringify(beforePostConfig)),
      afterPostConfig: JSON.parse(JSON.stringify(afterPostConfig)),
    });
  }

  // ============================================
  // Batch Mode
  // ============================================

  startBatch(): void {
    this.batchMode = true;
    this.batchActions = [];
  }

  endBatch(description = 'Batch changes'): void {
    if (this.batchActions.length > 0) {
      const batchAction: EmitterBatchAction = {
        type: 'emitter_batch',
        timestamp: Date.now(),
        description,
        actions: this.batchActions,
      };
      this.batchMode = false;
      this.push(batchAction);
    }
    this.batchMode = false;
    this.batchActions = [];
  }

  cancelBatch(): void {
    this.batchMode = false;
    this.batchActions = [];
  }

  // ============================================
  // Core Operations
  // ============================================

  private push(action: HistoryEntry): void {
    if (this.batchMode) {
      this.batchActions.push(action);
      return;
    }

    this.undoStack.push(action);
    this.redoStack = []; // Clear redo on new action

    // Limit stack size
    while (this.undoStack.length > this.maxSize) {
      this.undoStack.shift();
    }

    this.notifyChange();
  }

  undo(): boolean {
    if (!this.canUndo() || !this.callbacks) return false;

    const action = this.undoStack.pop()!;
    this.redoStack.push(action);
    this.applyUndo(action);
    this.notifyChange();
    return true;
  }

  redo(): boolean {
    if (!this.canRedo() || !this.callbacks) return false;

    const action = this.redoStack.pop()!;
    this.undoStack.push(action);
    this.applyRedo(action);
    this.notifyChange();
    return true;
  }

  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  getUndoDescription(): string | null {
    if (this.undoStack.length === 0) return null;
    return this.undoStack[this.undoStack.length - 1].description;
  }

  getRedoDescription(): string | null {
    if (this.redoStack.length === 0) return null;
    return this.redoStack[this.redoStack.length - 1].description;
  }

  clear(): void {
    this.undoStack = [];
    this.redoStack = [];
    this.notifyChange();
  }

  // ============================================
  // Apply Actions
  // ============================================

  private applyUndo(action: HistoryEntry): void {
    if (!this.callbacks) return;

    switch (action.type) {
      case 'emitter_add':
        this.callbacks.onRemoveEmitter(action.emitterId);
        break;

      case 'emitter_remove':
        this.callbacks.onApplyEmitter(action.emitter);
        break;

      case 'emitter_update':
        this.callbacks.onUpdateEmitter(action.emitterId, action.before);
        break;

      case 'emitter_transform':
        this.callbacks.onSetEmitterTransform(action.emitterId, action.before);
        break;

      case 'emitter_batch':
        // Apply in reverse order
        for (let i = action.actions.length - 1; i >= 0; i--) {
          this.applyUndo(action.actions[i]);
        }
        break;

      case 'config_update':
        this.callbacks.onSetConfig(action.before);
        break;

      case 'post_config_update':
        this.callbacks.onSetPostConfig(action.before);
        break;

      case 'scene_clear':
        this.callbacks.onImportScene(action.emitters, action.config, action.postConfig);
        break;

      case 'scene_import':
        this.callbacks.onImportScene(action.beforeEmitters, action.beforeConfig, action.beforePostConfig);
        break;
    }
  }

  private applyRedo(action: HistoryEntry): void {
    if (!this.callbacks) return;

    switch (action.type) {
      case 'emitter_add':
        this.callbacks.onApplyEmitter(action.emitter);
        break;

      case 'emitter_remove':
        this.callbacks.onRemoveEmitter(action.emitterId);
        break;

      case 'emitter_update':
        this.callbacks.onUpdateEmitter(action.emitterId, action.after);
        break;

      case 'emitter_transform':
        this.callbacks.onSetEmitterTransform(action.emitterId, action.after);
        break;

      case 'emitter_batch':
        // Apply in forward order
        for (const subAction of action.actions) {
          this.applyRedo(subAction);
        }
        break;

      case 'config_update':
        this.callbacks.onSetConfig(action.after);
        break;

      case 'post_config_update':
        this.callbacks.onSetPostConfig(action.after);
        break;

      case 'scene_clear':
        this.callbacks.onClearScene();
        break;

      case 'scene_import':
        this.callbacks.onImportScene(action.afterEmitters, action.afterConfig, action.afterPostConfig);
        break;
    }
  }

  // ============================================
  // Events
  // ============================================

  onChange(callback: () => void): () => void {
    this.changeListeners.add(callback);
    return () => this.changeListeners.delete(callback);
  }

  private notifyChange(): void {
    this.changeListeners.forEach(cb => cb());
  }

  // ============================================
  // Debug
  // ============================================

  getState(): { undoCount: number; redoCount: number; undoStack: string[]; redoStack: string[] } {
    return {
      undoCount: this.undoStack.length,
      redoCount: this.redoStack.length,
      undoStack: this.undoStack.map(a => a.description),
      redoStack: this.redoStack.map(a => a.description),
    };
  }
}

// Singleton
let instance: HistoryManager | null = null;

export function getHistoryManager(): HistoryManager {
  if (!instance) {
    instance = new HistoryManager();
  }
  return instance;
}

export default HistoryManager;


