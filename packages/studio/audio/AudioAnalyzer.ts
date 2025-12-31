/**
 * @package studio/audio
 * AudioAnalyzer - Web Audio API based audio analysis for fluid reactivity
 * 
 * Provides real-time frequency analysis with configurable bands,
 * beat detection, and smooth level transitions for fluid effects.
 */

export interface AudioAnalyzerConfig {
  /** FFT size (must be power of 2: 128, 256, 512, 1024, 2048, 4096) */
  fftSize: number;
  /** Smoothing time constant (0-1, higher = smoother) */
  smoothingTime: number;
  /** Number of frequency bands to extract */
  bands: number;
  /** Minimum frequency (Hz) for analysis range */
  minFrequency: number;
  /** Maximum frequency (Hz) for analysis range */
  maxFrequency: number;
}

export interface AudioData {
  /** Per-band levels (0-1 normalized) */
  levels: Float32Array;
  /** Overall level (0-1) */
  overall: number;
  /** Beat detected this frame */
  beat: boolean;
  /** Beat intensity (0-1) */
  beatStrength: number;
  /** Raw frequency data */
  frequencyData: Float32Array;
  /** Timestamp of analysis */
  timestamp: number;
}

const defaultConfig: AudioAnalyzerConfig = {
  fftSize: 1024,
  smoothingTime: 0.7,
  bands: 8,
  minFrequency: 20,
  maxFrequency: 16000,
};

/**
 * Real-time audio analyzer with beat detection
 */
export class AudioAnalyzer {
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private gainNode: GainNode | null = null;
  private source: MediaStreamAudioSourceNode | MediaElementAudioSourceNode | null = null;
  private dataArray: Uint8Array<ArrayBuffer> | null = null;
  private config: AudioAnalyzerConfig;
  
  // Beat detection state
  private beatHistory: number[] = [];
  private beatHistorySize = 40;
  private lastBeatTime = 0;
  private beatCooldown = 150; // ms between beats
  private beatThreshold = 1.3; // multiplier above average for beat
  
  // Smoothed levels for output
  private smoothedLevels: Float32Array;
  private smoothedOverall = 0;
  private lastUpdateTime = 0;
  
  // Connection state
  private isConnected = false;
  private sourceType: 'microphone' | 'file' | 'element' | null = null;
  private mediaElement: HTMLMediaElement | null = null;
  private mediaStream: MediaStream | null = null;

  constructor(config: Partial<AudioAnalyzerConfig> = {}) {
    this.config = { ...defaultConfig, ...config };
    this.smoothedLevels = new Float32Array(this.config.bands);
  }

  /**
   * Initialize audio context (must be called after user interaction)
   */
  private async initAudioContext(): Promise<void> {
    if (this.audioContext) return;

    this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    // Create analyzer node
    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = this.config.fftSize;
    this.analyser.smoothingTimeConstant = this.config.smoothingTime;
    
    // Create gain node for volume control
    this.gainNode = this.audioContext.createGain();
    this.gainNode.connect(this.analyser);
    
    // Create data array for frequency data
    this.dataArray = new Uint8Array(this.analyser.frequencyBinCount) as Uint8Array<ArrayBuffer>;
  }

  /**
   * Connect to microphone input
   */
  async connectMicrophone(): Promise<void> {
    await this.initAudioContext();
    
    // Disconnect existing source
    this.disconnectSource();

    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });

      this.source = this.audioContext!.createMediaStreamSource(this.mediaStream);
      this.source.connect(this.gainNode!);
      this.sourceType = 'microphone';
      this.isConnected = true;
      
      console.log('[AudioAnalyzer] Connected to microphone');
    } catch (err) {
      console.error('[AudioAnalyzer] Failed to connect microphone:', err);
      throw err;
    }
  }

  /**
   * Connect to an audio file
   */
  async connectFile(file: File): Promise<HTMLAudioElement> {
    await this.initAudioContext();
    
    // Disconnect existing source
    this.disconnectSource();

    const url = URL.createObjectURL(file);
    const audio = new Audio(url);
    audio.crossOrigin = 'anonymous';
    
    return new Promise((resolve, reject) => {
      audio.addEventListener('canplay', () => {
        this.connectMediaElement(audio);
        resolve(audio);
      }, { once: true });
      
      audio.addEventListener('error', (e) => {
        URL.revokeObjectURL(url);
        reject(new Error(`Failed to load audio file: ${e}`));
      }, { once: true });
      
      audio.load();
    });
  }

  /**
   * Connect to an existing HTML audio/video element
   */
  async connectMediaElement(element: HTMLMediaElement): Promise<void> {
    await this.initAudioContext();
    
    // Disconnect existing source
    this.disconnectSource();

    try {
      this.mediaElement = element;
      this.source = this.audioContext!.createMediaElementSource(element);
      this.source.connect(this.gainNode!);
      // Also connect to destination so we can hear it
      this.gainNode!.connect(this.audioContext!.destination);
      this.sourceType = 'element';
      this.isConnected = true;
      
      console.log('[AudioAnalyzer] Connected to media element');
    } catch (err) {
      console.error('[AudioAnalyzer] Failed to connect media element:', err);
      throw err;
    }
  }

  /**
   * Disconnect current audio source
   */
  private disconnectSource(): void {
    if (this.source) {
      this.source.disconnect();
      this.source = null;
    }
    
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }
    
    if (this.gainNode) {
      this.gainNode.disconnect();
      if (this.audioContext) {
        this.gainNode.connect(this.analyser!);
      }
    }
    
    this.mediaElement = null;
    this.sourceType = null;
    this.isConnected = false;
  }

  /**
   * Get frequency band ranges for analysis
   */
  private getBandRanges(): { start: number; end: number }[] {
    const { bands, minFrequency, maxFrequency } = this.config;
    const nyquist = this.audioContext!.sampleRate / 2;
    const binCount = this.analyser!.frequencyBinCount;
    const hzPerBin = nyquist / binCount;
    
    // Use logarithmic scale for more musical distribution
    const ranges: { start: number; end: number }[] = [];
    const logMin = Math.log(minFrequency);
    const logMax = Math.log(maxFrequency);
    const logStep = (logMax - logMin) / bands;
    
    for (let i = 0; i < bands; i++) {
      const freqStart = Math.exp(logMin + logStep * i);
      const freqEnd = Math.exp(logMin + logStep * (i + 1));
      
      ranges.push({
        start: Math.floor(freqStart / hzPerBin),
        end: Math.ceil(freqEnd / hzPerBin),
      });
    }
    
    return ranges;
  }

  /**
   * Analyze current audio state
   */
  analyze(): AudioData {
    const now = performance.now();
    const dt = Math.min(0.1, (now - this.lastUpdateTime) / 1000);
    this.lastUpdateTime = now;

    // Default empty result
    const emptyResult: AudioData = {
      levels: this.smoothedLevels,
      overall: 0,
      beat: false,
      beatStrength: 0,
      frequencyData: new Float32Array(0),
      timestamp: now,
    };

    if (!this.isConnected || !this.analyser || !this.dataArray) {
      return emptyResult;
    }

    // Get frequency data
    this.analyser.getByteFrequencyData(this.dataArray);
    
    // Calculate band levels
    const bandRanges = this.getBandRanges();
    const rawLevels = new Float32Array(this.config.bands);
    
    for (let i = 0; i < this.config.bands; i++) {
      const range = bandRanges[i];
      let sum = 0;
      let count = 0;
      
      for (let j = range.start; j < range.end && j < this.dataArray.length; j++) {
        sum += this.dataArray[j];
        count++;
      }
      
      rawLevels[i] = count > 0 ? (sum / count) / 255 : 0;
    }
    
    // Smooth levels with exponential moving average
    const smoothFactor = 1 - Math.pow(this.config.smoothingTime, dt * 10);
    for (let i = 0; i < this.config.bands; i++) {
      this.smoothedLevels[i] += (rawLevels[i] - this.smoothedLevels[i]) * smoothFactor;
    }
    
    // Calculate overall level
    let rawOverall = 0;
    for (let i = 0; i < this.dataArray.length; i++) {
      rawOverall += this.dataArray[i];
    }
    rawOverall = rawOverall / (this.dataArray.length * 255);
    this.smoothedOverall += (rawOverall - this.smoothedOverall) * smoothFactor;
    
    // Beat detection (focus on bass frequencies)
    const bassLevel = (rawLevels[0] + rawLevels[1]) / 2;
    this.beatHistory.push(bassLevel);
    if (this.beatHistory.length > this.beatHistorySize) {
      this.beatHistory.shift();
    }
    
    // Calculate average and detect beat
    const avgBass = this.beatHistory.reduce((a, b) => a + b, 0) / this.beatHistory.length;
    const beatDetected = 
      bassLevel > avgBass * this.beatThreshold &&
      now - this.lastBeatTime > this.beatCooldown;
    
    let beatStrength = 0;
    if (beatDetected) {
      this.lastBeatTime = now;
      beatStrength = Math.min(1, (bassLevel / avgBass - 1) / 2);
    }

    return {
      levels: this.smoothedLevels,
      overall: this.smoothedOverall,
      beat: beatDetected,
      beatStrength,
      frequencyData: Float32Array.from(this.dataArray),
      timestamp: now,
    };
  }

  /**
   * Set master gain/volume
   */
  setGain(gain: number): void {
    if (this.gainNode) {
      this.gainNode.gain.value = Math.max(0, Math.min(2, gain));
    }
  }

  /**
   * Update configuration
   */
  setConfig(config: Partial<AudioAnalyzerConfig>): void {
    this.config = { ...this.config, ...config };
    
    if (this.analyser) {
      if (config.fftSize) {
        this.analyser.fftSize = config.fftSize;
        this.dataArray = new Uint8Array(this.analyser.frequencyBinCount) as Uint8Array<ArrayBuffer>;
      }
      if (config.smoothingTime !== undefined) {
        this.analyser.smoothingTimeConstant = config.smoothingTime;
      }
      if (config.bands !== undefined) {
        this.smoothedLevels = new Float32Array(config.bands);
      }
    }
  }

  /**
   * Check if analyzer is connected and active
   */
  isActive(): boolean {
    return this.isConnected;
  }

  /**
   * Get current source type
   */
  getSourceType(): 'microphone' | 'file' | 'element' | null {
    return this.sourceType;
  }

  /**
   * Resume audio context (required after user interaction)
   */
  async resume(): Promise<void> {
    if (this.audioContext?.state === 'suspended') {
      await this.audioContext.resume();
    }
  }

  /**
   * Suspend audio context
   */
  async suspend(): Promise<void> {
    if (this.audioContext?.state === 'running') {
      await this.audioContext.suspend();
    }
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.disconnectSource();
    
    if (this.analyser) {
      this.analyser.disconnect();
      this.analyser = null;
    }
    
    if (this.gainNode) {
      this.gainNode.disconnect();
      this.gainNode = null;
    }
    
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    
    this.dataArray = null;
    this.beatHistory = [];
  }
}

/**
 * Create a singleton audio analyzer
 */
let globalAnalyzer: AudioAnalyzer | null = null;

export function getAudioAnalyzer(config?: Partial<AudioAnalyzerConfig>): AudioAnalyzer {
  if (!globalAnalyzer) {
    globalAnalyzer = new AudioAnalyzer(config);
  }
  return globalAnalyzer;
}

export function destroyAudioAnalyzer(): void {
  if (globalAnalyzer) {
    globalAnalyzer.destroy();
    globalAnalyzer = null;
  }
}


