/**
 * @package fluid-2d/render
 * RenderOutput2D - Post-processing config types (TSL/WebGPU rebuild)
 *
 * The v1 project implemented a direct WebGPU render pipeline. In this rebuild,
 * rendering is handled via Three.js WebGPU + TSL NodeMaterial. Studio still
 * depends on these config types and defaults, so they live here as shared state.
 */

export interface RenderOutput2DConfig {
  postEnabled: boolean;
  // 0 = in-quad (always supported), 1 = THREE.PostProcessing (WebGPU; can be driver-sensitive)
  postBackend: number;
  // quick A/B for post stack (applies to both backends)
  postFxBypass: boolean;
  fxaaEnabled: boolean;

  // Tonemapping/exposure (post chain)
  exposure: number; // linear exposure
  toneMapping: number; // 0 off, 1 filmic

  // Creative LUT (image-based 3D LUT; e.g. Hald CLUT)
  lutEnabled: boolean;
  lutAmount: number; // 0..1
  lutUrl: string; // data URL

  brightness: number;
  saturation: number;
  contrast: number;
  gamma: number;
  vignetteIntensity: number;
  vignetteRadius: number;
  vignetteSoftness: number;
  chromaticAberration: number;
  bloomIntensity: number;
  bloomThreshold: number;
  bloomRadius: number;
  noiseIntensity: number;
  clarity: number; // post: derivative-based sharpen/clarity

  // Sharpen (unsharp mask)
  sharpenEnabled: boolean;
  sharpenAmount: number; // 0..2
  sharpenRadius: number; // 0.5..3

  // Motion blur (velocity-based)
  motionBlurEnabled: boolean;
  motionBlurSamples: number; // 2..16
  colorMode: number;
  rampSource: number; // for colorMode=7 (0 density, 1 speed)
  rampSpeedScale: number; // scales speed when rampSource=1

  // Optional gradient-map texture for Ramp mode (data URL)
  gradientMapEnabled: boolean;
  gradientMapStrength: number; // 0..1
  gradientMapUrl: string; // data URL
  materialMode: number;
  glowIntensity: number;
  velocityColorMode: number;
  velocityColorScale: number;
  distortionStrength: number;
  motionBlurStrength: number;

  backgroundColor: [number, number, number];

  // Dye / material presentation (render-time only)
  dyeBlendMode: number; // 0 normal, 1 add, 2 screen
  dyeOpacity: number; // 0..1
  dyeDensityToAlpha: number; // scales density->alpha
  dyeDensityExposure: number; // compresses dye range for alpha/palette
  dyeColorizeStrength: number; // mix between dye RGB and stylized color
  dyeEdgeStrength: number; // edge darkening/boost

  dyeShadingEnabled: boolean;
  dyeShadingStrength: number;
  dyeSpecular: number;
  dyeSpecPower: number;

  // Fresnel highlight (liquid rim sheen)
  dyeFresnelEnabled: boolean;
  dyeFresnelStrength: number;
  dyeFresnelPower: number;
  dyeFresnelTint: [number, number, number];

  // Foam/highlights (render-time only)
  dyeFoamEnabled: boolean;
  dyeFoamSource: number; // 0 edge, 1 speed, 2 vorticity
  dyeFoamStrength: number;
  dyeFoamThreshold: number;
  dyeFoamSoftness: number;
  dyeFoamSpeedScale: number;
  dyeFoamVorticityScale: number;
  dyeFoamTint: [number, number, number];

  // Dye grading (pre post-processing)
  dyeBrightness: number;
  dyeSaturation: number;
  dyeContrast: number;
  dyeGamma: number;
  dyeHue: number; // radians
  dyeHueSpeed: number; // radians/sec
  dyeHueFromVelocity: number; // 0..1

  // Dye texture/noise
  dyeNoiseStrength: number;
  dyeNoiseScale: number;
  dyeNoiseSpeed: number;
  dyeNoiseColor: number; // 0..1 (0=brightness only, 1=also hue)

  paletteLowColor: [number, number, number];
  paletteMidColor: [number, number, number];
  paletteHighColor: [number, number, number];
  paletteBias: number;
  paletteGamma: number;
  paletteContrast: number;

  dyeMediumEnabled: boolean;
  dyeMediumDensity: number;
  dyeAbsorptionStrength: number;
  dyeAbsorptionColor: [number, number, number];
  dyeScatteringStrength: number;
  dyeScatteringColor: [number, number, number];

  trailEnabled: boolean;
  trailDecay: number;
  trailBlendMode: number;
  trailThreshold: number;

  afterImageEnabled: boolean;
  afterImageDamp: number;

  rgbShiftEnabled: boolean;
  rgbShiftAmount: number;
  rgbShiftAngle: number;

  // Debug visualization (render-time only)
  debugView: number; // 0 off, 1 velocity, 2 pressure, 3 divergence, 4 vorticity, 5 dye raw
  debugScale: number; // scales scalar/velocity for visibility
  debugBias: number; // adds to scalar before mapping

  // PostFX ordering (WebGPU PostProcessing backend)
  postFxOrder: PostFxEffectId[];
}

export type PostFxEffectId =
  | 'grading'
  | 'vignette'
  | 'bloom'
  | 'chromatic'
  | 'rgbShift'
  | 'clarity'
  | 'sharpen'
  | 'grain'
  | 'afterImage'
  | 'trails'
  | 'motionBlur';

export const defaultPostFxOrder: PostFxEffectId[] = [
  'grading',
  'vignette',
  'bloom',
  'chromatic',
  'rgbShift',
  'clarity',
  'sharpen',
  'grain',
  'afterImage',
  'trails',
  'motionBlur',
];

export function sanitizePostFxOrder(order: unknown): PostFxEffectId[] {
  const allowed = new Set<PostFxEffectId>(defaultPostFxOrder);
  const out: PostFxEffectId[] = [];

  if (Array.isArray(order)) {
    for (const v of order) {
      if (allowed.has(v as any) && !out.includes(v as any)) out.push(v as any);
    }
  }

  for (const id of defaultPostFxOrder) {
    if (!out.includes(id)) out.push(id);
  }

  return out;
}

export const defaultPostConfig: RenderOutput2DConfig = {
  postEnabled: false,
  postBackend: 0,
  postFxBypass: false,
  fxaaEnabled: false,

  exposure: 1.0,
  toneMapping: 0,

  lutEnabled: false,
  lutAmount: 1.0,
  lutUrl: '',

  brightness: 1.2,
  saturation: 1.15,
  contrast: 1.0,
  gamma: 1.0,
  vignetteIntensity: 0.0,
  vignetteRadius: 0.8,
  vignetteSoftness: 0.3,
  chromaticAberration: 0.0,
  bloomIntensity: 0.3,
  bloomThreshold: 0.6,
  bloomRadius: 1.0,
  noiseIntensity: 0.0,
  clarity: 0.0,

  // Sharpen defaults
  sharpenEnabled: false,
  sharpenAmount: 0.5,
  sharpenRadius: 1.0,

  // Motion blur defaults
  motionBlurEnabled: false,
  motionBlurSamples: 8,

  colorMode: 0,
  rampSource: 0,
  rampSpeedScale: 1.0,
  gradientMapEnabled: false,
  gradientMapStrength: 1.0,
  gradientMapUrl: '',
  materialMode: 0,
  glowIntensity: 0.5,
  velocityColorMode: 0,
  velocityColorScale: 1.0,
  distortionStrength: 0.0,
  motionBlurStrength: 0.0,
  backgroundColor: [0.04, 0.06, 0.08],

  dyeBlendMode: 0,
  dyeOpacity: 1.0,
  dyeDensityToAlpha: 1.0,
  dyeDensityExposure: 1.35,
  dyeColorizeStrength: 0.0,
  dyeEdgeStrength: 0.0,
  dyeShadingEnabled: false,
  dyeShadingStrength: 1.0,
  dyeSpecular: 0.35,
  dyeSpecPower: 24.0,
  dyeFresnelEnabled: false,
  dyeFresnelStrength: 0.35,
  dyeFresnelPower: 3.0,
  dyeFresnelTint: [1.0, 1.0, 1.0],

  dyeFoamEnabled: false,
  dyeFoamSource: 0,
  dyeFoamStrength: 0.35,
  dyeFoamThreshold: 0.2,
  dyeFoamSoftness: 0.2,
  dyeFoamSpeedScale: 1.0,
  dyeFoamVorticityScale: 1.0,
  dyeFoamTint: [1.0, 1.0, 1.0],

  dyeBrightness: 1.0,
  dyeSaturation: 1.0,
  dyeContrast: 1.0,
  dyeGamma: 1.0,
  dyeHue: 0.0,
  dyeHueSpeed: 0.0,
  dyeHueFromVelocity: 0.0,

  dyeNoiseStrength: 0.0,
  dyeNoiseScale: 2.0,
  dyeNoiseSpeed: 0.25,
  dyeNoiseColor: 0.35,
  paletteLowColor: [0.05, 0.08, 0.12],
  paletteMidColor: [0.18, 0.75, 0.95],
  paletteHighColor: [1.0, 0.35, 0.2],
  paletteBias: 0.0,
  paletteGamma: 1.0,
  paletteContrast: 1.0,

  dyeMediumEnabled: false,
  dyeMediumDensity: 1.0,
  dyeAbsorptionStrength: 0.8,
  dyeAbsorptionColor: [0.7, 0.2, 0.05],
  dyeScatteringStrength: 0.35,
  dyeScatteringColor: [0.95, 0.6, 0.35],

  trailEnabled: false,
  trailDecay: 0.9,
  trailBlendMode: 0,
  trailThreshold: 0.1,
  afterImageEnabled: false,
  afterImageDamp: 0.96,
  rgbShiftEnabled: false,
  rgbShiftAmount: 0.0015,
  rgbShiftAngle: 0.0,

  debugView: 0,
  debugScale: 10.0,
  debugBias: 0.0,

  postFxOrder: [...defaultPostFxOrder],
};
