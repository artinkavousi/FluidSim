/**
 * @package fluid-2d/hooks
 * useFluidSolver2D - Hook for managing 2D fluid solver
 */

import { useRef, useEffect, useCallback, useState } from 'react';
import * as THREE from 'three/webgpu';
import { FluidSolver2D, FluidConfig2D, defaultConfig2D } from '../FluidSolver2D';
import type { Splat } from '../types';

export interface UseFluidSolver2DOptions {
  config?: Partial<FluidConfig2D>;
  autoStart?: boolean;
  onFrame?: (time: number) => void;
}

export interface UseFluidSolver2DReturn {
  solver: FluidSolver2D | null;
  isRunning: boolean;
  time: number;
  config: FluidConfig2D;
  
  // Controls
  init: (renderer: THREE.WebGPURenderer) => void;
  play: () => void;
  pause: () => void;
  reset: () => void;
  step: (dt?: number) => void;
  
  // Config
  setConfig: (config: Partial<FluidConfig2D>) => void;
  
  // Splats
  addSplat: (splat: Splat) => void;
  addSplats: (splats: Splat[]) => void;
  
  // Cleanup
  dispose: () => void;
}

export function useFluidSolver2D(options: UseFluidSolver2DOptions = {}): UseFluidSolver2DReturn {
  const {
    config: initialConfig = {},
    autoStart = true,
    onFrame,
  } = options;
  
  const [solver, setSolver] = useState<FluidSolver2D | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [time, setTime] = useState(0);
  const [config, setConfigState] = useState<FluidConfig2D>({
    ...defaultConfig2D,
    ...initialConfig,
  });
  
  const onFrameRef = useRef(onFrame);
  onFrameRef.current = onFrame;

  // Initialize solver
  const init = useCallback((renderer: THREE.WebGPURenderer) => {
    const newSolver = new FluidSolver2D(renderer, config);
    setSolver(newSolver);
    
    if (autoStart) {
      newSolver.resume();
      setIsRunning(true);
    }
  }, [config, autoStart]);

  // Playback controls
  const play = useCallback(() => {
    solver?.resume();
    setIsRunning(true);
  }, [solver]);

  const pause = useCallback(() => {
    solver?.pause();
    setIsRunning(false);
  }, [solver]);

  const reset = useCallback(() => {
    solver?.clear();
    setTime(0);
  }, [solver]);

  const step = useCallback((dt?: number) => {
    solver?.step(dt);
    setTime(solver?.getTime() ?? 0);
  }, [solver]);

  // Config
  const setConfig = useCallback((updates: Partial<FluidConfig2D>) => {
    setConfigState(prev => {
      const newConfig = { ...prev, ...updates };
      solver?.setConfig(newConfig);
      return newConfig;
    });
  }, [solver]);

  // Splats
  const addSplat = useCallback((splat: Splat) => {
    solver?.addSplat(splat);
  }, [solver]);

  const addSplats = useCallback((splats: Splat[]) => {
    solver?.addSplats(splats);
  }, [solver]);

  // Cleanup
  const dispose = useCallback(() => {
    solver?.destroy();
    setSolver(null);
    setIsRunning(false);
  }, [solver]);

  // Sync time
  useEffect(() => {
    if (!solver || !isRunning) return;
    
    const interval = setInterval(() => {
      const t = solver.getTime();
      setTime(t);
      onFrameRef.current?.(t);
    }, 1000 / 60);
    
    return () => clearInterval(interval);
  }, [solver, isRunning]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      solver?.dispose();
    };
  }, [solver]);

  return {
    solver,
    isRunning,
    time,
    config,
    init,
    play,
    pause,
    reset,
    step,
    setConfig,
    addSplat,
    addSplats,
    dispose,
  };
}


