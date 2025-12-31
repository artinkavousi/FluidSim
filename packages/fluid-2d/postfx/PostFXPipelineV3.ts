import * as THREE from 'three/webgpu';
import type { RenderOutput2DConfig } from '../render/RenderOutput2D';
import type { PostEffectDefinition } from './types';
import { getAllEffects } from './effects';
import { PostFXPipeline2D, type PostFXPipeline2DResources } from './PostFXPipeline2D';

export type PostFXPipelineV3Resources = PostFXPipeline2DResources;

function effectIsActive(id: string, postConfig: RenderOutput2DConfig): boolean {
  if (id === 'grading') return true;
  if (id === 'vignette') return true;
  if (id === 'bloom') return (postConfig.bloomIntensity ?? 0) > 1e-3;
  if (id === 'sharpen') return postConfig.sharpenEnabled ?? false;
  if (id === 'motionBlur') return (postConfig.motionBlurEnabled ?? false) && (postConfig.motionBlurStrength ?? 0) > 1e-6;
  if (id === 'chromatic') return (postConfig.chromaticAberration ?? 0) > 1e-6;
  if (id === 'rgbShift') return postConfig.rgbShiftEnabled ?? false;
  if (id === 'clarity') return (postConfig.clarity ?? 0) > 1e-6;
  if (id === 'grain') return (postConfig.noiseIntensity ?? 0) > 1e-6;
  if (id === 'afterImage') return postConfig.afterImageEnabled ?? false;
  if (id === 'trails') return postConfig.trailEnabled ?? false;
  return false;
}

/**
 * PostFXPipelineV3
 *
 * v3 is a compatibility wrapper around the proven v2 node chain that adds:
 * - effect registry access (metadata-driven UI)
 * - rough GPU cost estimation
 *
 * The actual render graph remains PostFXPipeline2D to keep behavior stable.
 */
export class PostFXPipelineV3 {
  private impl: PostFXPipeline2D;

  constructor(scene: THREE.Scene, camera: THREE.Camera, lutFallback3D: THREE.Texture) {
    this.impl = new PostFXPipeline2D(scene, camera, lutFallback3D);
  }

  update(postConfig: RenderOutput2DConfig, resources: PostFXPipelineV3Resources): { outputNode: any; rebuilt: boolean } {
    return this.impl.update(postConfig, resources);
  }

  renderTick(resources: PostFXPipelineV3Resources): void {
    this.impl.renderTick(resources);
  }

  dispose(): void {
    this.impl.dispose();
  }

  static getEffects(): PostEffectDefinition[] {
    return getAllEffects();
  }

  static estimateGpuCost(postConfig: RenderOutput2DConfig): number {
    const effects = getAllEffects();
    let total = 0;
    for (const e of effects) {
      if (!effectIsActive(e.id, postConfig)) continue;
      total += e.gpuCost ?? 0;
    }
    return total;
  }
}
