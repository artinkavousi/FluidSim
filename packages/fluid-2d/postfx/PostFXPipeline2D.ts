import * as THREE from 'three/webgpu';
import {
  clamp,
  float,
  int,
  pass,
  renderOutput,
  select,
  texture,
  texture3D,
  uniform,
  uv,
  vec2,
  vec3,
  vec4,
  Fn,
  Loop,
} from 'three/tsl';
import type { RenderOutput2DConfig } from '../render/RenderOutput2D';
import { applyLut3D } from '../render/Lut3D';
import { sanitizePostFxOrder, type PostFxEffectId } from '../render/RenderOutput2D';
import { createColorGradingNode, createVignetteNode } from '../nodes/postProcessingNode';
import { film } from '@fluid-2d/three-tsl/display/FilmNode.js';
import { chromaticAberration } from '@fluid-2d/three-tsl/display/ChromaticAberrationNode.js';
import BloomNode from '@fluid-2d/three-tsl/display/BloomNode.js';
import { fxaa } from '@fluid-2d/three-tsl/display/FXAANode.js';
import { trail as trailFn } from '@fluid-2d/three-tsl/display/TrailNode';
import { afterImage } from '@fluid-2d/three-tsl/display/AfterImageNode.js';
import { rgbShift } from '@fluid-2d/three-tsl/display/RGBShiftNode.js';

type PostFXActiveFlags = {
  bypass: boolean;
  bloom: boolean;
  chromatic: boolean;
  rgbShift: boolean;
  clarity: boolean;
  sharpen: boolean;
  grain: boolean;
  afterImage: boolean;
  trails: boolean;
  motionBlur: boolean;
  fxaa: boolean;
};

export type PostFXPipeline2DResources = {
  lutFallback3D: THREE.Texture;
  lutTexture3D: THREE.Texture | null;
  lutSize: number;
  velocityTexture: THREE.Texture | null;
  width: number;
  height: number;
};

export class PostFXPipeline2D {
  private scene: THREE.Scene;
  private camera: THREE.Camera;

  private colorGrading = createColorGradingNode();
  private vignette = createVignetteNode();

  private chromaticStrength = uniform(0.0);
  private grainIntensity = uniform(0.0);
  private clarity = uniform(0.0);
  private gamma = uniform(1.0);
  private exposure = uniform(1.0);
  private toneMapping = uniform(0);
  private lutEnabled = uniform(0);
  private lutAmount = uniform(1.0);
  private lutSize = uniform(2.0);
  private lutNode: any;

  private trailDamp = uniform(0.96);
  private trailBlendMode = uniform(0);
  private trailThreshold = uniform(0.1);

  private afterImageDamp = uniform(0.96);
  private rgbShiftAmount = uniform(0.0015);
  private rgbShiftAngle = uniform(0.0);

  private bloomStrength = uniform(0.0);
  private bloomThreshold = uniform(0.6);
  private bloomRadius01 = uniform(0.0);

  // Sharpen uniforms
  private sharpenAmount = uniform(0.5);
  private sharpenRadius = uniform(1.0);
  private resolution = uniform(new THREE.Vector2(1920, 1080));

  private motionBlurSamples = uniform(8);
  private motionBlurStrength = uniform(0.0);
  private velocityTexture: THREE.Texture | null = null;

  private flags: PostFXActiveFlags | null = null;
  private orderKey: string | null = null;
  private outputNode: any = null;

  private bloomNode: any = null;
  private afterImageNode: any = null;
  private trailNode: any = null;
  private velocityNode: any = null;

  constructor(scene: THREE.Scene, camera: THREE.Camera, lutFallback3D: THREE.Texture) {
    this.scene = scene;
    this.camera = camera;
    this.lutNode = texture3D(lutFallback3D as any);
  }

  private computeFlags(postConfig: RenderOutput2DConfig): PostFXActiveFlags {
    return {
      bypass: postConfig.postFxBypass ?? false,
      bloom: (postConfig.bloomIntensity ?? 0) > 0.001,
      chromatic: (postConfig.chromaticAberration ?? 0) > 1e-6,
      rgbShift: postConfig.rgbShiftEnabled ?? false,
      clarity: (postConfig.clarity ?? 0) > 1e-6,
      sharpen: postConfig.sharpenEnabled ?? false,
      grain: (postConfig.noiseIntensity ?? 0) > 1e-6,
      afterImage: postConfig.afterImageEnabled ?? false,
      trails: postConfig.trailEnabled ?? false,
      motionBlur: (postConfig.motionBlurEnabled ?? false) && (postConfig.motionBlurStrength ?? 0) > 1e-6,
      fxaa: postConfig.fxaaEnabled ?? false,
    };
  }

  private disposeOptionalNodes() {
    this.bloomNode?.dispose?.();
    this.bloomNode = null;

    this.afterImageNode?.dispose?.();
    this.afterImageNode = null;

    this.trailNode?.dispose?.();
    this.trailNode = null;
  }

  private rebuild(order: PostFxEffectId[], flags: PostFXActiveFlags) {
    this.disposeOptionalNodes();

    const scenePass = pass(this.scene, this.camera);
    scenePass.setXY(this.resolution);

    if (flags.bypass) {
      let out = renderOutput(scenePass);
      if (flags.fxaa) out = fxaa(out);
      this.outputNode = out;
      return;
    }

    let node: any = scenePass;

    for (const id of order) {
      if (id === 'grading') {
        node = this.colorGrading.apply(node);
        continue;
      }

      if (id === 'vignette') {
        node = this.vignette.apply(node);
        continue;
      }

      if (id === 'bloom') {
        if (!flags.bloom) continue;
        this.bloomNode = new (BloomNode as any)(node, 0.0, 0.0, 0.0);
        node = node.add(this.bloomNode);
        continue;
      }

      if (id === 'chromatic') {
        if (!flags.chromatic) continue;
        node = chromaticAberration(node, this.chromaticStrength);
        continue;
      }

      if (id === 'rgbShift') {
        if (!flags.rgbShift) continue;
        node = rgbShift(node, this.rgbShiftAmount, this.rgbShiftAngle);
        continue;
      }

      if (id === 'clarity') {
        if (!flags.clarity) continue;
        const rgb: any = node.rgb;
        const c = clamp(this.clarity, float(0.0), float(2.0));
        const contrastRgb = rgb
          .sub(vec3(0.5, 0.5, 0.5))
          .mul(float(1.0).add(c.mul(0.75)))
          .add(vec3(0.5, 0.5, 0.5));
        const t = clamp(c.mul(0.5), float(0.0), float(1.0));
        const clarified = rgb.mul(float(1.0).sub(t)).add(contrastRgb.mul(t));
        node = vec4(clamp(clarified, vec3(0.0), vec3(10.0)), node.a);
        continue;
      }

      if (id === 'sharpen') {
        if (!flags.sharpen) continue;
        // Unsharp mask sharpening
        // CRITICAL: We must sample from 'scenePass' (the source texture) for the neighbor samples.
        // We cannot sample 'inputNode' at arbitrary UVs if it has become a math expression (e.g. after grading).
        const sharpenFn = Fn(([inputNode]: [any]) => {
          const texelSize = vec2(1.0).div(this.resolution);
          const offset = texelSize.mul(this.sharpenRadius);

          // Calculate high-frequency detail from the ORIGINAL scene texture
          const center = texture(scenePass as any, uv()).rgb;
          const left = texture(scenePass as any, uv().sub(vec2(offset.x, float(0)))).rgb;
          const right = texture(scenePass as any, uv().add(vec2(offset.x, float(0)))).rgb;
          const top = texture(scenePass as any, uv().sub(vec2(float(0), offset.y))).rgb;
          const bottom = texture(scenePass as any, uv().add(vec2(float(0), offset.y))).rgb;

          const neighbors = left.add(right).add(top).add(bottom).div(float(4.0));
          const highFreq = center.sub(neighbors);

          // Add that detail to the CURRENT pipeline state
          const sharpened = inputNode.rgb.add(highFreq.mul(this.sharpenAmount));

          return vec4(clamp(sharpened, vec3(0, 0, 0), vec3(1, 1, 1)), inputNode.a);
        });
        node = sharpenFn(node);
        continue;
      }

      if (id === 'grain') {
        if (!flags.grain) continue;
        node = film(node, this.grainIntensity);
        continue;
      }

      if (id === 'afterImage') {
        if (!flags.afterImage) continue;
        this.afterImageNode = afterImage(node, this.afterImageDamp);
        node = this.afterImageNode;
        continue;
      }

      if (id === 'trails') {
        if (!flags.trails) continue;
        this.trailNode = trailFn(node, this.trailDamp, int(this.trailBlendMode), this.trailThreshold);
        node = this.trailNode;
        continue;
      }

      if (id === 'motionBlur') {
        if (!flags.motionBlur) continue;
        // Velocity-based motion blur
        const velTex = this.velocityTexture;
        const blurFn = Fn(() => {
          // Capture the node reference so we can update its texture value per-frame
          const velNode = texture(velTex as any, uv());
          this.velocityNode = velNode;

          const vel = velNode.xy;
          const v = vel.mul(this.motionBlurStrength);

          const count = int(this.motionBlurSamples);
          const result = vec3(0).toVar();

          Loop({ start: int(0), end: count, type: 'int', condition: '<' }, ({ i }) => {
            const t = float(i).div(float(count).sub(1)).sub(0.5);
            const offset = v.mul(t);
            const sample = texture(scenePass as any, uv().add(offset)).rgb;
            result.addAssign(sample);
          });

          return vec4(result.div(float(count)), float(1.0));
        });

        node = blurFn();
        continue;
      }
    }

    const nodeIn: any = node;
    const exposed = nodeIn.rgb.mul(this.exposure);
    const filmic = exposed.div(exposed.add(vec3(1.0, 1.0, 1.0)));
    const doTonemap = int(this.toneMapping).equal(int(1));
    const tm = select(doTonemap, filmic, exposed);

    const invGamma = float(1.0).div(this.gamma.max(float(1e-3)));
    const correctedRgb = vec3(tm.r.pow(invGamma), tm.g.pow(invGamma), tm.b.pow(invGamma));
    const lutOn = int(this.lutEnabled).equal(int(1)).and(this.lutAmount.greaterThan(float(1e-6)));
    const lutApplied = applyLut3D(vec4(correctedRgb, nodeIn.a), this.lutNode as any, this.lutSize, this.lutAmount);
    const corrected = select(lutOn, lutApplied, vec4(correctedRgb, nodeIn.a));

    let out = renderOutput(corrected);
    if (flags.fxaa) out = fxaa(out);

    this.outputNode = out;
  }

  update(postConfig: RenderOutput2DConfig, resources: PostFXPipeline2DResources): { outputNode: any; rebuilt: boolean } {
    this.velocityTexture = resources.velocityTexture;
    this.motionBlurSamples.value = postConfig.motionBlurSamples ?? 8;
    this.motionBlurStrength.value = postConfig.motionBlurStrength ?? 0.0;

    const scale = Math.max(0.25, Math.min(1.0, postConfig.postResolutionScale ?? 1.0));
    const w = Math.max(1, Math.floor((resources.width ?? 1) * scale));
    const h = Math.max(1, Math.floor((resources.height ?? 1) * scale));
    this.resolution.value.set(w, h);

    const baseFlags = this.computeFlags(postConfig);
    const soloEnabled = (postConfig.postFxSoloEnabled ?? false) && !(postConfig.postFxBypass ?? false);
    const soloId = (postConfig.postFxSoloId as any) ?? 'bloom';

    const flags: PostFXActiveFlags = soloEnabled
      ? {
        ...baseFlags,
        bloom: soloId === 'bloom' ? baseFlags.bloom : false,
        chromatic: soloId === 'chromatic' ? baseFlags.chromatic : false,
        rgbShift: soloId === 'rgbShift' ? baseFlags.rgbShift : false,
        clarity: soloId === 'clarity' ? baseFlags.clarity : false,
        sharpen: soloId === 'sharpen' ? baseFlags.sharpen : false,
        grain: soloId === 'grain' ? baseFlags.grain : false,
        afterImage: soloId === 'afterImage' ? baseFlags.afterImage : false,
        trails: soloId === 'trails' ? baseFlags.trails : false,
        motionBlur: soloId === 'motionBlur' ? baseFlags.motionBlur : false,
      }
      : baseFlags;

    const rawOrder = sanitizePostFxOrder(postConfig.postFxOrder);
    const order = soloEnabled
      ? (['grading', 'vignette', soloId] as PostFxEffectId[]).filter((v, i, a) => a.indexOf(v) === i)
      : rawOrder;

    const orderKey = `${soloEnabled ? `solo:${soloId}` : 'full'}|${order.join('|')}`;

    const shouldRebuild =
      this.flags == null ||
      this.orderKey == null ||
      this.orderKey !== orderKey ||
      Object.keys(flags).some((k) => (flags as any)[k] !== (this.flags as any)[k]);

    // Sync uniforms (no rebuild)
    this.colorGrading.uniforms.brightness.value = postConfig.brightness;
    this.colorGrading.uniforms.contrast.value = postConfig.contrast;
    this.colorGrading.uniforms.saturation.value = postConfig.saturation;

    this.vignette.uniforms.intensity.value = postConfig.vignetteIntensity;
    this.vignette.uniforms.radius.value = postConfig.vignetteRadius;
    this.vignette.uniforms.smoothness.value = postConfig.vignetteSoftness;

    this.chromaticStrength.value = Math.max(0, postConfig.chromaticAberration ?? 0);
    this.grainIntensity.value = postConfig.noiseIntensity ?? 0;
    this.clarity.value = postConfig.clarity ?? 0.0;
    this.gamma.value = postConfig.gamma ?? 1.0;
    this.exposure.value = postConfig.exposure ?? 1.0;
    this.toneMapping.value = postConfig.toneMapping ?? 0;

    const lutUrl = postConfig.lutUrl ?? '';
    const lutActive =
      (postConfig.lutEnabled ?? false) &&
      lutUrl.length > 0 &&
      (postConfig.lutAmount ?? 0) > 1e-6;
    this.lutEnabled.value = lutActive ? 1 : 0;
    this.lutAmount.value = postConfig.lutAmount ?? 1.0;
    this.lutSize.value = Math.max(2, resources.lutSize ?? 2);
    this.lutNode.value = (resources.lutTexture3D ?? resources.lutFallback3D) as any;

    this.trailDamp.value = Math.max(0, Math.min(0.999, postConfig.trailDecay ?? 0.96));
    this.trailBlendMode.value = postConfig.trailBlendMode ?? 0;
    this.trailThreshold.value = postConfig.trailThreshold ?? 0.1;

    this.bloomStrength.value = postConfig.bloomIntensity ?? 0.0;
    this.bloomThreshold.value = postConfig.bloomThreshold ?? 0.6;
    const radius = postConfig.bloomRadius ?? 1.0;
    this.bloomRadius01.value = Math.max(0, Math.min(1, (radius - 0.5) / 3.5));

    this.afterImageDamp.value = Math.max(0, Math.min(0.999, postConfig.afterImageDamp ?? 0.96));
    this.rgbShiftAmount.value = Math.max(0, postConfig.rgbShiftAmount ?? 0.0015);
    this.rgbShiftAngle.value = postConfig.rgbShiftAngle ?? 0.0;

    // Sharpen uniforms
    this.sharpenAmount.value = postConfig.sharpenAmount ?? 0.5;
    this.sharpenRadius.value = postConfig.sharpenRadius ?? 1.0;

    if (shouldRebuild) {
      this.flags = flags;
      this.orderKey = orderKey;
      this.rebuild(order, flags);
    }

    // Sync BloomNode internals (if present)
    if (this.bloomNode) {
      this.bloomNode.strength.value = this.bloomStrength.value;
      this.bloomNode.threshold.value = this.bloomThreshold.value;
      this.bloomNode.radius.value = this.bloomRadius01.value;
    }

    return { outputNode: this.outputNode, rebuilt: shouldRebuild };
  }

  renderTick(resources: PostFXPipeline2DResources) {
    if (resources.velocityTexture && this.velocityNode) {
      this.velocityNode.value = resources.velocityTexture;
    }
  }

  dispose() {
    this.disposeOptionalNodes();
  }
}
