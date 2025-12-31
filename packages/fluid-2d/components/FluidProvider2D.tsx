/**
 * @package fluid-2d/components
 * FluidProvider2D - React context for 2D fluid simulation state
 */

import React, { createContext, useContext, useRef, useState, useCallback, useEffect, useMemo, ReactNode } from 'react';
import { FluidSolver2D, FluidConfig2D, defaultConfig2D } from '../FluidSolver2D';
import { EmitterManager, createEmitterManager } from '../emitters/EmitterManager';
import type { Emitter, SelectionState } from '../emitters/types';
import type { Splat } from '../types';

// ============================================
// Context Types
// ============================================

export interface FluidContext2D {
  // Solver
  solver: FluidSolver2D | null;
  setSolver: (solver: FluidSolver2D | null) => void;
  
  // Config
  config: FluidConfig2D;
  setConfig: (config: Partial<FluidConfig2D>) => void;
  
  // Emitter Manager
  emitterManager: EmitterManager;
  
  // Emitters
  emitters: Emitter[];
  addEmitter: (config: Omit<Emitter, 'id'>) => string;
  removeEmitter: (id: string) => void;
  updateEmitter: (id: string, updates: Partial<Emitter>) => void;
  duplicateEmitter: (id: string) => string | null;
  clearEmitters: () => void;
  
  // Selection
  selection: SelectionState;
  selectEmitter: (id: string, additive?: boolean) => void;
  deselectAll: () => void;
  toggleSelection: (id: string) => void;
  
  // Playback
  isPlaying: boolean;
  play: () => void;
  pause: () => void;
  reset: () => void;
  time: number;
  
  // Splats
  addSplat: (splat: Splat) => void;
  addSplats: (splats: Splat[]) => void;
  
  // Gizmos
  gizmosEnabled: boolean;
  setGizmosEnabled: (enabled: boolean) => void;
  
  // Mouse
  mouseEnabled: boolean;
  setMouseEnabled: (enabled: boolean) => void;
}

// ============================================
// Context
// ============================================

export const FluidContext = createContext<FluidContext2D | null>(null);

// ============================================
// Hook
// ============================================

export function useFluid2D(): FluidContext2D {
  const context = useContext(FluidContext);
  if (!context) {
    throw new Error('useFluid2D must be used within a FluidProvider2D');
  }
  return context;
}

export function useFluid2DOptional(): FluidContext2D | null {
  return useContext(FluidContext);
}

// ============================================
// Provider Props
// ============================================

export interface FluidProvider2DProps {
  children: ReactNode;
  initialConfig?: Partial<FluidConfig2D>;
  emitterManager?: EmitterManager;
}

// ============================================
// Provider Component
// ============================================

export const FluidProvider2D: React.FC<FluidProvider2DProps> = ({
  children,
  initialConfig = {},
  emitterManager: externalManager,
}) => {
  // Solver
  const [solver, setSolver] = useState<FluidSolver2D | null>(null);
  
  // Config
  const [config, setConfigState] = useState<FluidConfig2D>({
    ...defaultConfig2D,
    ...initialConfig,
  });
  
  // Emitter Manager
  const emitterManager = useMemo(
    () => externalManager || createEmitterManager(),
    [externalManager]
  );
  
  // Emitters state (synced from manager)
  const [emitters, setEmitters] = useState<Emitter[]>([]);
  
  // Selection
  const [selection, setSelection] = useState<SelectionState>({
    primary: null,
    emitterIds: new Set(),
  });
  
  // Playback
  const [isPlaying, setIsPlaying] = useState(true);
  const [time, setTime] = useState(0);
  
  // UI state
  const [gizmosEnabled, setGizmosEnabled] = useState(true);
  const [mouseEnabled, setMouseEnabled] = useState(true);

  // Sync emitters from manager
  useEffect(() => {
    const unsubscribe = emitterManager.onChange((newEmitters) => {
      setEmitters(newEmitters);
    });
    setEmitters(emitterManager.getAllEmitters());
    return unsubscribe;
  }, [emitterManager]);

  // Sync selection from manager
  useEffect(() => {
    const unsubscribe = emitterManager.onSelectionChange((newSelection) => {
      setSelection(newSelection);
    });
    return unsubscribe;
  }, [emitterManager]);

  // Sync time from solver
  useEffect(() => {
    if (!solver) return;
    
    const interval = setInterval(() => {
      setTime(solver.getTime());
    }, 100);
    
    return () => clearInterval(interval);
  }, [solver]);

  // Config setter
  const setConfig = useCallback((updates: Partial<FluidConfig2D>) => {
    setConfigState(prev => {
      const newConfig = { ...prev, ...updates };
      solver?.setConfig(newConfig);
      return newConfig;
    });
  }, [solver]);

  // Emitter operations
  const addEmitter = useCallback((emitterConfig: Omit<Emitter, 'id'>) => {
    return emitterManager.addEmitter(emitterConfig);
  }, [emitterManager]);

  const removeEmitter = useCallback((id: string) => {
    emitterManager.removeEmitter(id);
  }, [emitterManager]);

  const updateEmitter = useCallback((id: string, updates: Partial<Emitter>) => {
    emitterManager.updateEmitter(id, updates);
  }, [emitterManager]);

  const duplicateEmitter = useCallback((id: string) => {
    return emitterManager.duplicate(id);
  }, [emitterManager]);

  const clearEmitters = useCallback(() => {
    emitterManager.clear();
  }, [emitterManager]);

  // Selection operations
  const selectEmitter = useCallback((id: string, additive = false) => {
    emitterManager.select(id, additive);
  }, [emitterManager]);

  const deselectAll = useCallback(() => {
    emitterManager.deselect();
  }, [emitterManager]);

  const toggleSelection = useCallback((id: string) => {
    emitterManager.toggleSelection(id);
  }, [emitterManager]);

  // Playback operations
  const play = useCallback(() => {
    solver?.resume();
    setIsPlaying(true);
  }, [solver]);

  const pause = useCallback(() => {
    solver?.pause();
    setIsPlaying(false);
  }, [solver]);

  const reset = useCallback(() => {
    solver?.reset();
    setTime(0);
  }, [solver]);

  // Splat operations
  const addSplat = useCallback((splat: Splat) => {
    solver?.addSplat(splat);
  }, [solver]);

  const addSplats = useCallback((splats: Splat[]) => {
    solver?.addSplats(splats);
  }, [solver]);

  // Context value
  const value: FluidContext2D = useMemo(() => ({
    solver,
    setSolver,
    config,
    setConfig,
    emitterManager,
    emitters,
    addEmitter,
    removeEmitter,
    updateEmitter,
    duplicateEmitter,
    clearEmitters,
    selection,
    selectEmitter,
    deselectAll,
    toggleSelection,
    isPlaying,
    play,
    pause,
    reset,
    time,
    addSplat,
    addSplats,
    gizmosEnabled,
    setGizmosEnabled,
    mouseEnabled,
    setMouseEnabled,
  }), [
    solver,
    config,
    setConfig,
    emitterManager,
    emitters,
    addEmitter,
    removeEmitter,
    updateEmitter,
    duplicateEmitter,
    clearEmitters,
    selection,
    selectEmitter,
    deselectAll,
    toggleSelection,
    isPlaying,
    play,
    pause,
    reset,
    time,
    addSplat,
    addSplats,
    gizmosEnabled,
    mouseEnabled,
  ]);

  return (
    <FluidContext.Provider value={value}>
      {children}
    </FluidContext.Provider>
  );
};

export default FluidProvider2D;


