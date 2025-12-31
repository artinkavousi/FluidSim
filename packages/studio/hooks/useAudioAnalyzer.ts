/**
 * @package studio/hooks
 * useAudioAnalyzer - React hook for audio analysis
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { AudioAnalyzer, getAudioAnalyzer, type AudioData, type AudioAnalyzerConfig } from '../audio';

export type AudioSourceType = 'microphone' | 'file' | 'element' | null;

export interface UseAudioAnalyzerOptions {
  /** Auto-start analysis loop when connected */
  autoStart?: boolean;
  /** Analysis frame rate (default 60) */
  frameRate?: number;
  /** Analyzer configuration */
  config?: Partial<AudioAnalyzerConfig>;
}

export interface UseAudioAnalyzerReturn {
  /** Current audio data */
  audioData: AudioData | null;
  /** Raw frequency data as Float32Array (for passing to emitters) */
  frequencyData: Float32Array | null;
  /** Whether analyzer is connected and active */
  isActive: boolean;
  /** Current source type */
  sourceType: AudioSourceType;
  /** Whether analysis loop is running */
  isAnalyzing: boolean;
  /** Connect to microphone */
  connectMicrophone: () => Promise<void>;
  /** Connect to audio file */
  connectFile: (file: File) => Promise<HTMLAudioElement>;
  /** Connect to media element */
  connectMediaElement: (element: HTMLMediaElement) => Promise<void>;
  /** Disconnect current source */
  disconnect: () => void;
  /** Start analysis loop */
  startAnalysis: () => void;
  /** Stop analysis loop */
  stopAnalysis: () => void;
  /** Set gain/volume (0-2) */
  setGain: (gain: number) => void;
  /** Error message if any */
  error: string | null;
}

export function useAudioAnalyzer(options: UseAudioAnalyzerOptions = {}): UseAudioAnalyzerReturn {
  const { autoStart = true, frameRate = 60, config } = options;
  
  const analyzerRef = useRef<AudioAnalyzer | null>(null);
  const animationRef = useRef<number>(0);
  
  const [audioData, setAudioData] = useState<AudioData | null>(null);
  const [frequencyData, setFrequencyData] = useState<Float32Array | null>(null);
  const [isActive, setIsActive] = useState(false);
  const [sourceType, setSourceType] = useState<AudioSourceType>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize analyzer
  useEffect(() => {
    analyzerRef.current = getAudioAnalyzer(config);
    
    return () => {
      cancelAnimationFrame(animationRef.current);
    };
  }, []);

  // Analysis loop
  const startAnalysis = useCallback(() => {
    if (isAnalyzing || !analyzerRef.current) return;
    
    setIsAnalyzing(true);
    let lastTime = performance.now();
    const interval = 1000 / frameRate;
    
    const analyze = () => {
      const now = performance.now();
      
      if (now - lastTime >= interval) {
        lastTime = now;
        
        if (analyzerRef.current) {
          const data = analyzerRef.current.analyze();
          setAudioData(data);
          setFrequencyData(data.frequencyData);
        }
      }
      
      animationRef.current = requestAnimationFrame(analyze);
    };
    
    analyze();
  }, [frameRate, isAnalyzing]);

  const stopAnalysis = useCallback(() => {
    cancelAnimationFrame(animationRef.current);
    setIsAnalyzing(false);
  }, []);

  const connectMicrophone = useCallback(async () => {
    if (!analyzerRef.current) return;
    
    setError(null);
    try {
      await analyzerRef.current.connectMicrophone();
      setIsActive(true);
      setSourceType('microphone');
      
      if (autoStart) {
        startAnalysis();
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to connect microphone';
      setError(message);
      throw err;
    }
  }, [autoStart, startAnalysis]);

  const connectFile = useCallback(async (file: File): Promise<HTMLAudioElement> => {
    if (!analyzerRef.current) throw new Error('Analyzer not initialized');
    
    setError(null);
    try {
      const audio = await analyzerRef.current.connectFile(file);
      setIsActive(true);
      setSourceType('file');
      
      if (autoStart) {
        startAnalysis();
      }
      
      return audio;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load audio file';
      setError(message);
      throw err;
    }
  }, [autoStart, startAnalysis]);

  const connectMediaElement = useCallback(async (element: HTMLMediaElement) => {
    if (!analyzerRef.current) return;
    
    setError(null);
    try {
      await analyzerRef.current.connectMediaElement(element);
      setIsActive(true);
      setSourceType('element');
      
      if (autoStart) {
        startAnalysis();
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to connect media element';
      setError(message);
      throw err;
    }
  }, [autoStart, startAnalysis]);

  const disconnect = useCallback(() => {
    stopAnalysis();
    analyzerRef.current?.destroy();
    analyzerRef.current = getAudioAnalyzer(config);
    setIsActive(false);
    setSourceType(null);
    setAudioData(null);
    setFrequencyData(null);
    setError(null);
  }, [config, stopAnalysis]);

  const setGain = useCallback((gain: number) => {
    analyzerRef.current?.setGain(gain);
  }, []);

  return {
    audioData,
    frequencyData,
    isActive,
    sourceType,
    isAnalyzing,
    connectMicrophone,
    connectFile,
    connectMediaElement,
    disconnect,
    startAnalysis,
    stopAnalysis,
    setGain,
    error,
  };
}


