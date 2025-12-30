/**
 * @package fluid-2d/gizmos
 * GizmoManager - Manages gizmo rendering and interaction
 */

import type { GizmoManagerConfig, GizmoManagerAPI, GizmoHandle, GizmoTheme, defaultGizmoTheme } from './types';
import type { EmitterManagerAPI } from '../emitters/types';

export class GizmoManager implements GizmoManagerAPI {
  private config: GizmoManagerConfig;
  private emitterManager: EmitterManagerAPI | null = null;
  
  constructor(config: Partial<GizmoManagerConfig> = {}) {
    this.config = {
      enabled: config.enabled ?? true,
      showOnHover: config.showOnHover ?? true,
      theme: config.theme ?? {},
      snap: {
        position: config.snap?.position ?? false,
        angle: config.snap?.angle ?? false,
        gridSize: config.snap?.gridSize ?? 0.05,
        angleStep: config.snap?.angleStep ?? 15,
      },
    };
  }

  setEmitterManager(manager: EmitterManagerAPI): void {
    this.emitterManager = manager;
  }

  setEnabled(enabled: boolean): void {
    this.config.enabled = enabled;
  }

  isEnabled(): boolean {
    return this.config.enabled;
  }

  getConfig(): GizmoManagerConfig {
    return { ...this.config };
  }

  setConfig(config: Partial<GizmoManagerConfig>): void {
    if (config.enabled !== undefined) this.config.enabled = config.enabled;
    if (config.showOnHover !== undefined) this.config.showOnHover = config.showOnHover;
    if (config.theme) this.config.theme = { ...this.config.theme, ...config.theme };
    if (config.snap) this.config.snap = { ...this.config.snap, ...config.snap };
  }

  getHandles(emitterId: string): GizmoHandle[] {
    // Override in specific gizmo components
    return [];
  }

  getTheme(): GizmoTheme {
    return {
      accentPrimary: 'rgba(0, 212, 170, 0.92)',
      accentSecondary: 'rgba(100, 181, 246, 0.92)',
      accentTertiary: 'rgba(168, 85, 247, 0.92)',
      handleFill: 'rgba(255, 255, 255, 0.9)',
      handleStroke: 'rgba(255, 255, 255, 0.3)',
      arcFill: 'transparent',
      arcStroke: 'rgba(255, 255, 255, 0.15)',
      textColor: 'rgba(255, 255, 255, 0.4)',
      hubRadius: 13,
      handleRadius: 6,
      arcRadius: 78,
      strokeWidth: 1.5,
      glowIntensity: 0.5,
      glowColor: 'rgba(0, 212, 170, 0.4)',
      ...this.config.theme,
    };
  }
}

// Singleton instance
let defaultManager: GizmoManager | null = null;

export function getGizmoManager(): GizmoManager {
  if (!defaultManager) {
    defaultManager = new GizmoManager();
  }
  return defaultManager;
}

export function createGizmoManager(config?: Partial<GizmoManagerConfig>): GizmoManager {
  return new GizmoManager(config);
}


