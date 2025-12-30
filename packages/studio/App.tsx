/**
 * @package studio
 * FluidStudio App - Single Unified Panel Design
 */

import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FluidCanvas2D } from '../fluid-2d/components/FluidCanvas2D';
import { FluidProvider2D, useFluid2D } from '../fluid-2d/components/FluidProvider2D';
import { createEmitterManager } from '../fluid-2d/emitters/EmitterManager';
import { UnifiedPanel } from './panels/UnifiedPanel';
import { useStudioStore } from './store';
import { colors, effects, radius, spacing } from './ui/theme';
import type { Emitter } from '../fluid-2d/emitters/types';
import type { PerfStats2D } from '../fluid-2d/FluidSolver2D';

// ============================================
// Minimal Toolbar
// ============================================

const Toolbar: React.FC<{
  panelVisible: boolean;
  onTogglePanel: () => void;
}> = ({ panelVisible, onTogglePanel }) => {
  const isPlaying = useStudioStore((s) => s.isPlaying);
  const setIsPlaying = useStudioStore((s) => s.setIsPlaying);

  return (
    <motion.div 
      className="toolbar"
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      <button
        className={`tb-btn ${panelVisible ? 'on' : ''}`}
        onClick={onTogglePanel}
        title="Toggle Panel (Tab)"
      >
        ◈
      </button>
      <span className="tb-sep" />
      <button
        className={`tb-btn play ${isPlaying ? 'pause' : ''}`}
        onClick={() => setIsPlaying(!isPlaying)}
        title="Play/Pause (Space)"
      >
        {isPlaying ? '⏸' : '▶'}
      </button>

      <style>{`
        .toolbar {
          position: fixed;
          top: 16px;
          left: 50%;
          transform: translateX(-50%);
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 5px 8px;
          background: ${effects.glassmorphism.backgroundStrong};
          border: 1px solid ${colors.glass.border};
          border-radius: ${radius.lg};
          backdrop-filter: ${effects.blur.lg};
          box-shadow: ${effects.shadow.md};
          z-index: 100;
        }
        
        .tb-btn {
          width: 30px;
          height: 30px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: ${colors.glass.ultraLight};
          border: 1px solid transparent;
          border-radius: ${radius.md};
          color: ${colors.text.muted};
          font-size: 13px;
          cursor: pointer;
          transition: all ${effects.transition.fast};
        }
        
        .tb-btn:hover {
          background: ${colors.glass.medium};
          color: ${colors.text.secondary};
        }
        
        .tb-btn.on {
          background: ${colors.accent.primaryMuted};
          border-color: ${colors.border.accentSubtle};
          color: ${colors.accent.primary};
        }
        
        .tb-btn.play {
          background: ${colors.accent.primaryMuted};
          border-color: ${colors.border.accentSubtle};
          color: ${colors.accent.primary};
        }
        
        .tb-btn.play.pause {
          background: rgba(255, 107, 107, 0.12);
          border-color: rgba(255, 107, 107, 0.25);
          color: ${colors.accent.secondary};
        }
        
        .tb-sep {
          width: 1px;
          height: 18px;
          background: ${colors.glass.borderSubtle};
          margin: 0 2px;
        }
      `}</style>
    </motion.div>
  );
};

// ============================================
// Studio Content
// ============================================

const StudioContent: React.FC = () => {
  const {
    emitters,
    addEmitter: baseAddEmitter,
    removeEmitter: baseRemoveEmitter,
    updateEmitter: baseUpdateEmitter,
    duplicateEmitter: baseDuplicateEmitter,
    selection,
    selectEmitter,
    deselectAll,
    emitterManager,
    config,
    setConfig,
    gizmosEnabled,
    setGizmosEnabled,
    mouseEnabled,
    setMouseEnabled,
    isPlaying,
    play,
    pause,
  } = useFluid2D();

  const [showPanel, setShowPanel] = useState(true);
  
  // History-wrapped emitter operations
  const historyManager = useStudioStore((s) => s.historyManager);
  const refreshHistoryState = useStudioStore((s) => s.refreshHistoryState);
  const storeConfig = useStudioStore((s) => s.config);
  const storePostConfig = useStudioStore((s) => s.postConfig);
  const setStoreConfig = useStudioStore((s) => s.setConfig);
  const setStorePostConfig = useStudioStore((s) => s.setPostConfig);

  // Set up history callbacks
  useEffect(() => {
    historyManager.setCallbacks({
      onApplyEmitter: (emitter) => {
        emitterManager.addEmitterWithId(emitter);
      },
      onRemoveEmitter: (id) => {
        emitterManager.removeEmitter(id);
      },
      onUpdateEmitter: (id, updates) => {
        emitterManager.updateEmitter(id, updates);
      },
      onSetEmitterTransform: (id, transform) => {
        emitterManager.updateEmitter(id, {
          position: transform.position,
          rotation: transform.rotation,
          scale: transform.scale,
        });
      },
      onSetConfig: (config) => {
        setStoreConfig(config);
      },
      onSetPostConfig: (config) => {
        setStorePostConfig(config);
      },
      onClearScene: () => {
        emitterManager.clear();
      },
      onImportScene: (emitters, configData, postConfigData) => {
        emitterManager.clear();
        emitters.forEach(e => emitterManager.addEmitterWithId(e));
        setStoreConfig(configData);
        setStorePostConfig(postConfigData);
      },
    });
  }, [historyManager, emitterManager, setStoreConfig, setStorePostConfig]);
  
  const addEmitter = useCallback((emitterConfig: Omit<Emitter, 'id'>) => {
    const id = baseAddEmitter(emitterConfig);
    const emitter = emitterManager.getEmitter(id);
    if (emitter) {
      historyManager.pushAddEmitter(id, emitter, `Add ${emitter.type}: ${emitter.name}`);
      refreshHistoryState();
    }
    return id;
  }, [baseAddEmitter, emitterManager, historyManager, refreshHistoryState]);

  const removeEmitter = useCallback((id: string) => {
    const emitter = emitterManager.getEmitter(id);
    if (emitter) {
      historyManager.pushRemoveEmitter(id, emitter, `Remove ${emitter.type}: ${emitter.name}`);
      refreshHistoryState();
    }
    baseRemoveEmitter(id);
  }, [baseRemoveEmitter, emitterManager, historyManager, refreshHistoryState]);

  const updateEmitter = useCallback((id: string, updates: Partial<Emitter>) => {
    const emitter = emitterManager.getEmitter(id);
    if (emitter) {
      const changedKeys = Object.keys(updates).join(', ');
      historyManager.pushUpdateEmitter(id, emitter, updates, `Update ${emitter.name}: ${changedKeys}`);
      refreshHistoryState();
    }
    baseUpdateEmitter(id, updates);
  }, [baseUpdateEmitter, emitterManager, historyManager, refreshHistoryState]);

  const duplicateEmitter = useCallback((id: string) => {
    const newId = baseDuplicateEmitter(id);
    if (newId) {
      const emitter = emitterManager.getEmitter(newId);
      if (emitter) {
        historyManager.pushAddEmitter(newId, emitter, `Duplicate ${emitter.type}: ${emitter.name}`);
        refreshHistoryState();
      }
    }
    return newId;
  }, [baseDuplicateEmitter, emitterManager, historyManager, refreshHistoryState]);

  // Store sync
  const setStoreSelection = useStudioStore((s) => s.setSelection);
  const storeIsPlaying = useStudioStore((s) => s.isPlaying);
  const setStoreIsPlaying = useStudioStore((s) => s.setIsPlaying);
  const storeGizmosEnabled = useStudioStore((s) => s.gizmosEnabled);
  const storeMouseEnabled = useStudioStore((s) => s.mouseEnabled);
  const storeMouseHoverMode = useStudioStore((s) => s.mouseHoverMode);
  const audioLevels = useStudioStore((s) => s.audio.levels);

  const autoQualityRef = useRef({
    emaFps: 60,
    lastChangeMs: 0,
  });

  const runtimeRef = useRef({
    fpsEma: 60,
    lastUiMs: 0,
  });

  const handleFrame = useCallback((_time: number, delta: number, fps: number, perf?: PerfStats2D | null) => {
    const state = useStudioStore.getState();
    const cfg = state.config;

    const now = performance.now();
    const safeFps = Number.isFinite(fps) ? fps : (1.0 / Math.max(1e-6, delta));

    // Runtime FPS (for UI only)
    runtimeRef.current.fpsEma = runtimeRef.current.fpsEma * (1 - 0.08) + safeFps * 0.08;

    // Auto quality (dynamic resolution)
    if (cfg.autoQualityEnabled ?? false) {
      const target = Math.max(15, cfg.autoQualityTargetFps ?? 60);
      const cooldownMs = Math.max(0, (cfg.autoQualityCooldownSec ?? 1.5) * 1000);

      // EMA smoothing to avoid thrash.
      const alpha = 0.06;
      autoQualityRef.current.emaFps = autoQualityRef.current.emaFps * (1 - alpha) + safeFps * alpha;

      if (now - autoQualityRef.current.lastChangeMs >= cooldownMs) {
        const low = target * 0.92;
        const high = target * 1.08;
        const ema = autoQualityRef.current.emaFps;

        const gridSizes = [64, 96, 128, 160, 192, 256, 320, 384, 512];
        const dyeSizes = [128, 192, 256, 320, 384, 512, 768, 1024];

        const clampToList = (value: number, list: number[], min: number, max: number) => {
          const clamped = Math.max(min, Math.min(max, value));
          let best = list[0];
          let bestDist = Math.abs(best - clamped);
          for (const v of list) {
            const d = Math.abs(v - clamped);
            if (d < bestDist) {
              best = v;
              bestDist = d;
            }
          }
          return best;
        };

        const nextLower = (value: number, list: number[], min: number) => {
          const sorted = [...list].sort((a, b) => a - b);
          for (let i = sorted.length - 1; i >= 0; i--) {
            if (sorted[i] < value) return Math.max(min, sorted[i]);
          }
          return Math.max(min, sorted[0]);
        };

        const nextHigher = (value: number, list: number[], max: number) => {
          const sorted = [...list].sort((a, b) => a - b);
          for (let i = 0; i < sorted.length; i++) {
            if (sorted[i] > value) return Math.min(max, sorted[i]);
          }
          return Math.min(max, sorted[sorted.length - 1]);
        };

        const minGrid = Math.max(32, cfg.autoQualityMinGridSize ?? 96);
        const maxGrid = Math.max(minGrid, cfg.autoQualityMaxGridSize ?? 256);
        const minDye = Math.max(64, cfg.autoQualityMinDyeSize ?? 192);
        const maxDye = Math.max(minDye, cfg.autoQualityMaxDyeSize ?? 512);

        const currentGrid = cfg.gridSize ?? 192;
        const currentDye = cfg.dyeSize ?? 384;

        let nextGrid = currentGrid;
        if (ema < low) nextGrid = nextLower(currentGrid, gridSizes, minGrid);
        else if (ema > high) nextGrid = nextHigher(currentGrid, gridSizes, maxGrid);

        if (nextGrid !== currentGrid) {
          // Keep dye about 2x grid for visual crispness, within bounds.
          const desiredDye = nextGrid * 2;
          const nextDye = clampToList(desiredDye, dyeSizes, minDye, maxDye);

          state.setFluidConfig({ gridSize: nextGrid, dyeSize: nextDye });
          autoQualityRef.current.lastChangeMs = now;
          autoQualityRef.current.emaFps = target;
        }
      }
    }

    // Push stats to UI at a low rate to avoid excess re-renders.
    const pushEveryMs = 150;
    if (now - runtimeRef.current.lastUiMs >= pushEveryMs) {
      state.setFps(runtimeRef.current.fpsEma);

      const perfOn = cfg.perfEnabled ?? false;
      if (perfOn) state.setPerf(perf ?? null);
      else if (state.perf) state.setPerf(null);

      runtimeRef.current.lastUiMs = now;
    } else {
      // Clear promptly if user disables perf.
      if (!(cfg.perfEnabled ?? false) && state.perf) state.setPerf(null);
    }
  }, []);
  useEffect(() => { setConfig(storeConfig); }, [storeConfig, setConfig]);
  useEffect(() => { setStoreSelection(selection); }, [selection, setStoreSelection]);
  useEffect(() => {
    if (storeIsPlaying !== isPlaying) {
      if (storeIsPlaying) play(); else pause();
    }
  }, [storeIsPlaying, isPlaying, play, pause]);
  useEffect(() => { setGizmosEnabled(storeGizmosEnabled); }, [storeGizmosEnabled, setGizmosEnabled]);
  useEffect(() => { setMouseEnabled(storeMouseEnabled); }, [storeMouseEnabled, setMouseEnabled]);

  // Undo/Redo
  const undo = useStudioStore((s) => s.undo);
  const redo = useStudioStore((s) => s.redo);
  const canUndo = useStudioStore((s) => s.canUndo);
  const canRedo = useStudioStore((s) => s.canRedo);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return;

      switch (e.key) {
        case ' ':
          e.preventDefault();
          setStoreIsPlaying(!storeIsPlaying);
          break;
        case 'Tab':
          e.preventDefault();
          setShowPanel((v) => !v);
          break;
        case 'Delete':
        case 'Backspace':
          if (selection.primary) removeEmitter(selection.primary);
          break;
        case 'Escape':
          deselectAll();
          break;
        case 'd':
          if ((e.metaKey || e.ctrlKey) && selection.primary) {
            e.preventDefault();
            duplicateEmitter(selection.primary);
          }
          break;
        case 'z':
          if (e.metaKey || e.ctrlKey) {
            e.preventDefault();
            if (e.shiftKey) {
              if (canRedo) redo();
            } else {
              if (canUndo) undo();
            }
          }
          break;
        case 'y':
          if (e.metaKey || e.ctrlKey) {
            e.preventDefault();
            if (canRedo) redo();
          }
          break;
        case 'g':
          useStudioStore.getState().setGizmosEnabled(!storeGizmosEnabled);
          break;
        case 'm':
          useStudioStore.getState().setMouseEnabled(!storeMouseEnabled);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selection, removeEmitter, deselectAll, duplicateEmitter, storeIsPlaying, setStoreIsPlaying, storeGizmosEnabled, storeMouseEnabled, undo, redo, canUndo, canRedo]);

  return (
    <div className="studio">
      <Toolbar panelVisible={showPanel} onTogglePanel={() => setShowPanel((v) => !v)} />

      {/* Full-screen Canvas */}
      <div className="canvas-full">
        <FluidCanvas2D
          config={config}
          postConfig={storePostConfig}
          mouseEnabled={mouseEnabled}
          mouseHoverMode={storeMouseHoverMode}
          emitterManager={emitterManager}
          selection={selection}
          gizmosEnabled={gizmosEnabled}
          audioData={audioLevels || undefined}
          onFrame={handleFrame}
        />
      </div>

      <AnimatePresence>
        {showPanel && (
          <motion.div
            className="panel-overlay"
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 12 }}
            transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
          >
            <UnifiedPanel
              emitters={emitters}
              selectedIds={selection.emitterIds}
              onAddEmitter={addEmitter}
              onRemoveEmitter={removeEmitter}
              onSelectEmitter={selectEmitter}
              onDeselectAll={deselectAll}
              onUpdateEmitter={updateEmitter}
              onDuplicateEmitter={duplicateEmitter}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        .studio {
          position: relative;
          width: 100vw;
          height: 100vh;
          background: ${colors.bg.canvas};
          overflow: hidden;
        }
        
        .canvas-full {
          position: absolute;
          top: 0;
          left: 0;
          bottom: 0;
          right: 0;
          z-index: 1;
        }
        
        .panel-overlay {
          position: fixed;
          top: 16px;
          right: 16px;
          bottom: 16px;
          z-index: 50;
        }
      `}</style>
    </div>
  );
};

// ============================================
// Main App
// ============================================

export const StudioApp: React.FC = () => {
  const emitterManager = useMemo(() => createEmitterManager(), []);
  const initialConfig = useStudioStore.getState().config;

  return (
    <FluidProvider2D emitterManager={emitterManager} initialConfig={initialConfig}>
      <StudioContent />
    </FluidProvider2D>
  );
};

export default StudioApp;
