/**
 * @package fluid-2d/hooks
 * useEmitters2D - Hook for managing 2D emitters
 */

import { useCallback, useEffect, useState, useMemo } from 'react';
import { EmitterManager, createEmitterManager } from '../emitters/EmitterManager';
import type { Emitter, SelectionState, EmitterType } from '../emitters/types';
import type { Splat } from '../types';
import { getPreset, getDefaultPreset, getAllPresetNames } from '../emitters/presets';

export interface UseEmitters2DOptions {
  manager?: EmitterManager;
  audioData?: Float32Array;
}

export interface UseEmitters2DReturn {
  // Manager
  manager: EmitterManager;
  
  // Emitters
  emitters: Emitter[];
  activeEmitters: Emitter[];
  
  // CRUD
  addEmitter: (config: Omit<Emitter, 'id'>) => string;
  addFromPreset: (type: EmitterType, presetName: string) => string | null;
  removeEmitter: (id: string) => void;
  updateEmitter: (id: string, updates: Partial<Emitter>) => void;
  duplicateEmitter: (id: string) => string | null;
  clearEmitters: () => void;
  
  // Selection
  selection: SelectionState;
  selectedEmitter: Emitter | null;
  select: (id: string, additive?: boolean) => void;
  deselect: () => void;
  toggleSelect: (id: string) => void;
  
  // Position/Transform
  setPosition: (id: string, x: number, y: number) => void;
  setRotation: (id: string, degrees: number) => void;
  setScale: (id: string, sx: number, sy: number) => void;
  
  // Splat generation
  generateSplats: (time: number, dt: number) => Splat[];
  
  // Presets
  presetNames: Record<EmitterType, string[]>;
}

export function useEmitters2D(options: UseEmitters2DOptions = {}): UseEmitters2DReturn {
  const {
    manager: externalManager,
    audioData,
  } = options;
  
  // Create or use external manager
  const manager = useMemo(
    () => externalManager ?? createEmitterManager(),
    [externalManager]
  );
  
  // State
  const [emitters, setEmitters] = useState<Emitter[]>([]);
  const [selection, setSelection] = useState<SelectionState>({
    primary: null,
    emitterIds: new Set(),
  });

  // Sync emitters from manager
  useEffect(() => {
    const unsubscribe = manager.onChange(setEmitters);
    setEmitters(manager.getAllEmitters());
    return unsubscribe;
  }, [manager]);

  // Sync selection from manager
  useEffect(() => {
    const unsubscribe = manager.onSelectionChange(setSelection);
    return unsubscribe;
  }, [manager]);

  // Derived state
  const activeEmitters = useMemo(
    () => emitters.filter(e => e.active),
    [emitters]
  );
  
  const selectedEmitter = useMemo(
    () => selection.primary ? manager.getEmitter(selection.primary) ?? null : null,
    [selection.primary, manager, emitters]
  );

  // CRUD operations
  const addEmitter = useCallback((config: Omit<Emitter, 'id'>) => {
    return manager.addEmitter(config);
  }, [manager]);

  const addFromPreset = useCallback((type: EmitterType, presetName: string) => {
    const preset = getPreset(type, presetName);
    if (!preset) return null;
    return manager.addEmitter(preset);
  }, [manager]);

  const removeEmitter = useCallback((id: string) => {
    manager.removeEmitter(id);
  }, [manager]);

  const updateEmitter = useCallback((id: string, updates: Partial<Emitter>) => {
    manager.updateEmitter(id, updates);
  }, [manager]);

  const duplicateEmitter = useCallback((id: string) => {
    return manager.duplicate(id);
  }, [manager]);

  const clearEmitters = useCallback(() => {
    manager.clear();
  }, [manager]);

  // Selection operations
  const select = useCallback((id: string, additive = false) => {
    manager.select(id, additive);
  }, [manager]);

  const deselect = useCallback(() => {
    manager.deselect();
  }, [manager]);

  const toggleSelect = useCallback((id: string) => {
    manager.toggleSelection(id);
  }, [manager]);

  // Transform operations
  const setPosition = useCallback((id: string, x: number, y: number) => {
    manager.setEmitterPosition(id, x, y);
  }, [manager]);

  const setRotation = useCallback((id: string, degrees: number) => {
    manager.setEmitterRotation(id, degrees);
  }, [manager]);

  const setScale = useCallback((id: string, sx: number, sy: number) => {
    manager.setEmitterScale(id, sx, sy);
  }, [manager]);

  // Splat generation
  const generateSplats = useCallback((time: number, dt: number) => {
    return manager.generateSplats(time, dt, audioData);
  }, [manager, audioData]);

  // Presets
  const presetNames = useMemo(() => getAllPresetNames(), []);

  return {
    manager,
    emitters,
    activeEmitters,
    addEmitter,
    addFromPreset,
    removeEmitter,
    updateEmitter,
    duplicateEmitter,
    clearEmitters,
    selection,
    selectedEmitter,
    select,
    deselect,
    toggleSelect,
    setPosition,
    setRotation,
    setScale,
    generateSplats,
    presetNames,
  };
}


