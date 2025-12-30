/**
 * @package fluid-2d/components
 * FluidCanvas2D - React Three Fiber canvas with WebGPU fluid simulation
 * 
 * Uses FluidSolver2D for simulation and texture() to sample the dye StorageTexture.
 * KEY INSIGHT: StorageTexture extends Texture, so it can be sampled with texture() in fragment shaders.
 */

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import * as THREE from 'three/webgpu';
import { Canvas, extend, useFrame, useThree } from '@react-three/fiber';
import {
    Fn,
    uv,
    vec4,
    vec2,
    vec3,
    float,
    texture,  // Use texture() for sampling StorageTexture
    clamp,
    uniform,
    int,
    mix,
    select,
    dot,
    length,
    sin,
    cos,
    smoothstep,
    If,
    abs,
    max,
    property,
    fract,
    exp,
    texture3D,
} from 'three/tsl';
import { FluidSolver2D, defaultConfig2D, type FluidConfig2D, type PerfStats2D } from '../FluidSolver2D';
import { defaultPostConfig, type RenderOutput2DConfig } from '../render/RenderOutput2D';
import { FluidPostProcessing2D } from './FluidPostProcessing2D';
import { applyLut3D } from '../render/Lut3D';
import { createFallbackLut3DTexture } from '../render/Lut3D';
import { useLut3DTexture } from '../render/useLut3DTexture';
import type { Splat, Color3, Vec2 } from '../types';
import type { Emitter, SelectionState } from '../emitters/types';
import { EmitterManager } from '../emitters/EmitterManager';
import { GizmoRenderer } from '../gizmos/GizmoRenderer';
import { useFluid2DOptional } from './FluidProvider2D';

extend(THREE as any);

// ============================================
// Internal: Fluid Simulation Scene
// ============================================

interface FluidSceneProps {
    solver: FluidSolver2D | null;
    config: FluidConfig2D;
    postConfig: RenderOutput2DConfig;
    mouseEnabled: boolean;
    mouseHoverMode: boolean;
    emitterManager?: EmitterManager;
    audioData?: Float32Array;
    onFrame?: (time: number, delta: number, fps: number, perf?: PerfStats2D | null) => void;
    onMouseSplat?: (splat: Splat) => void;
}

function FluidScene({
    solver,
    config,
    postConfig,
    mouseEnabled,
    mouseHoverMode,
    emitterManager,
    audioData,
    onFrame,
    onMouseSplat,
}: FluidSceneProps) {
    const meshRef = useRef<THREE.Mesh>(null);
    const { viewport } = useThree();

    const distortionStrength = useMemo(() => uniform(0.0), []);
    const motionBlurStrength = useMemo(() => uniform(0.0), []);

    const colorMode = useMemo(() => uniform(0), []);
    const rampSource = useMemo(() => uniform(0), []);
    const rampSpeedScale = useMemo(() => uniform(1.0), []);
    const materialMode = useMemo(() => uniform(0), []);
    const glowIntensity = useMemo(() => uniform(0.0), []);
    const velocityColorMode = useMemo(() => uniform(0), []);
    const velocityColorScale = useMemo(() => uniform(1.0), []);
    const needVelocitySample = useMemo(() => uniform(0), []);

    const backgroundColor = useMemo(() => uniform(vec3(0.04, 0.06, 0.08)), []);

    const dyeBlendMode = useMemo(() => uniform(0), []);
    const dyeOpacity = useMemo(() => uniform(1.0), []);
    const dyeDensityToAlpha = useMemo(() => uniform(1.0), []);
    const dyeDensityExposure = useMemo(() => uniform(1.0), []);
    const dyeColorizeStrength = useMemo(() => uniform(0.0), []);
    const dyeEdgeStrength = useMemo(() => uniform(0.0), []);

    const dyeShadingEnabled = useMemo(() => uniform(0), []);
    const dyeShadingStrength = useMemo(() => uniform(1.0), []);
    const dyeSpecular = useMemo(() => uniform(0.35), []);
    const dyeSpecPower = useMemo(() => uniform(24.0), []);

    const dyeFoamEnabled = useMemo(() => uniform(0), []);
    const dyeFoamSource = useMemo(() => uniform(0), []);
    const dyeFoamStrength = useMemo(() => uniform(0.35), []);
    const dyeFoamThreshold = useMemo(() => uniform(0.2), []);
    const dyeFoamSoftness = useMemo(() => uniform(0.2), []);
    const dyeFoamSpeedScale = useMemo(() => uniform(1.0), []);
    const dyeFoamVorticityScale = useMemo(() => uniform(1.0), []);
    const dyeFoamTint = useMemo(() => uniform(vec3(1.0, 1.0, 1.0)), []);

    const paletteLow = useMemo(() => uniform(vec3(0.05, 0.08, 0.12)), []);
    const paletteMid = useMemo(() => uniform(vec3(0.18, 0.75, 0.95)), []);
    const paletteHigh = useMemo(() => uniform(vec3(1.0, 0.35, 0.2)), []);
    const paletteBias = useMemo(() => uniform(0.0), []);
    const paletteGamma = useMemo(() => uniform(1.0), []);
    const paletteContrast = useMemo(() => uniform(1.0), []);

    const dyeBrightness = useMemo(() => uniform(1.0), []);
    const dyeSaturation = useMemo(() => uniform(1.0), []);
    const dyeContrast = useMemo(() => uniform(1.0), []);
    const dyeGamma = useMemo(() => uniform(1.0), []);
    const dyeHue = useMemo(() => uniform(0.0), []);
    const dyeHueSpeed = useMemo(() => uniform(0.0), []);
    const dyeHueFromVelocity = useMemo(() => uniform(0.0), []);

    const dyeNoiseStrength = useMemo(() => uniform(0.0), []);
    const dyeNoiseScale = useMemo(() => uniform(2.0), []);
    const dyeNoiseSpeed = useMemo(() => uniform(0.25), []);
    const dyeNoiseColor = useMemo(() => uniform(0.35), []);

    const dyeMediumEnabled = useMemo(() => uniform(0), []);
    const dyeMediumDensity = useMemo(() => uniform(1.0), []);
    const dyeAbsorptionStrength = useMemo(() => uniform(0.8), []);
    const dyeAbsorptionColor = useMemo(() => uniform(vec3(0.7, 0.2, 0.05)), []);
    const dyeScatteringStrength = useMemo(() => uniform(0.35), []);
    const dyeScatteringColor = useMemo(() => uniform(vec3(0.95, 0.6, 0.35)), []);

    const invDyeRes = useMemo(() => uniform(1.0 / 512.0), []);
    const renderTime = useMemo(() => uniform(0.0), []);

    const debugView = useMemo(() => uniform(0), []);
    const debugScale = useMemo(() => uniform(10.0), []);
    const debugBias = useMemo(() => uniform(0.0), []);

    // Ping-pong state uniforms (avoid full-texture copy passes).
    const velocityIsA = useMemo(() => uniform(1), []);
    const dyeIsA = useMemo(() => uniform(1), []);
    const pressureIsA = useMemo(() => uniform(1), []);

    // Output grading (in-quad unless the Three post stack is active).
    const skipOutputGradingInt = useMemo(() => uniform(0), []);
    const outExposure = useMemo(() => uniform(1.0), []);
    const outToneMapping = useMemo(() => uniform(0), []);
    const outBrightness = useMemo(() => uniform(1.0), []);
    const outSaturation = useMemo(() => uniform(1.0), []);
    const outContrast = useMemo(() => uniform(1.0), []);
    const outGamma = useMemo(() => uniform(1.0), []);
    const outVignetteIntensity = useMemo(() => uniform(0.0), []);
    const outVignetteRadius = useMemo(() => uniform(0.8), []);
    const outVignetteSoftness = useMemo(() => uniform(0.3), []);
    const lutEnabled = useMemo(() => uniform(0), []);
    const lutAmount = useMemo(() => uniform(1.0), []);
    const lutSize = useMemo(() => uniform(2.0), []);

    // Gradient-map texture import (for Ramp mode)
    const gradientMapEnabled = useMemo(() => uniform(0), []);
    const gradientMapStrength = useMemo(() => uniform(1.0), []);

    // Fresnel highlight (liquid look)
    const dyeFresnelEnabled = useMemo(() => uniform(0), []);
    const dyeFresnelStrength = useMemo(() => uniform(0.35), []);
    const dyeFresnelPower = useMemo(() => uniform(3.0), []);
    const dyeFresnelTint = useMemo(() => uniform(vec3(1.0, 1.0, 1.0)), []);

    const mouseState = useRef({
        isDown: false,
        lastPos: null as Vec2 | null,
        lastTime: null as number | null,
        currentColor: generateRandomColor(),
    });

    const materialRef = useRef<THREE.MeshBasicNodeMaterial | null>(null);

    const gradientFallbackTex = useMemo(() => {
        const data = new Uint8Array([255, 255, 255, 255]);
        const tex = new THREE.DataTexture(data, 1, 1);
        tex.needsUpdate = true;
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.wrapS = THREE.ClampToEdgeWrapping;
        tex.wrapT = THREE.ClampToEdgeWrapping;
        tex.minFilter = THREE.LinearFilter;
        tex.magFilter = THREE.LinearFilter;
        tex.generateMipmaps = false;
        return tex;
    }, []);

    const [gradientMapTexture, setGradientMapTexture] = useState<THREE.Texture | null>(null);
    const gradientMapTextureRef = useRef<THREE.Texture | null>(null);
    const lutFallback3D = useMemo(() => createFallbackLut3DTexture(2), []);

    const lutNode = useMemo(() => texture3D(lutFallback3D as any), [lutFallback3D]);
    const lutUrl = postConfig.lutUrl ?? '';
    const lut3d = useLut3DTexture(lutUrl);

    useEffect(() => {
        gradientMapTextureRef.current = gradientMapTexture;
    }, [gradientMapTexture]);

    useEffect(() => {
        return () => {
            gradientMapTextureRef.current?.dispose();
            gradientFallbackTex.dispose();
            lutFallback3D.dispose?.();
        };
    }, [gradientFallbackTex, lutFallback3D]);

    useEffect(() => {
        const url = postConfig.gradientMapUrl ?? '';
        if (!url) {
            setGradientMapTexture((prev) => {
                prev?.dispose();
                return null;
            });
            return;
        }

        let canceled = false;
        const loader = new THREE.TextureLoader();

        loader.load(
            url,
            (tex) => {
                if (canceled) {
                    tex.dispose();
                    return;
                }

                tex.colorSpace = THREE.SRGBColorSpace;
                tex.wrapS = THREE.ClampToEdgeWrapping;
                tex.wrapT = THREE.ClampToEdgeWrapping;
                tex.minFilter = THREE.LinearFilter;
                tex.magFilter = THREE.LinearFilter;
                tex.generateMipmaps = false;
                tex.needsUpdate = true;

                setGradientMapTexture((prev) => {
                    prev?.dispose();
                    return tex;
                });
            },
            undefined,
            () => {
                if (canceled) return;
                setGradientMapTexture((prev) => {
                    prev?.dispose();
                    return null;
                });
            }
        );

        return () => {
            canceled = true;
        };
    }, [postConfig.gradientMapUrl]);

    // Update post-processing uniforms (no shader rebuild)
    useEffect(() => {
        distortionStrength.value = postConfig.distortionStrength ?? 0;
        motionBlurStrength.value = postConfig.motionBlurStrength ?? 0;
        colorMode.value = postConfig.colorMode ?? 0;
        rampSource.value = postConfig.rampSource ?? 0;
        rampSpeedScale.value = postConfig.rampSpeedScale ?? 1.0;
        materialMode.value = postConfig.materialMode ?? 0;
        glowIntensity.value = postConfig.glowIntensity ?? 0;
        velocityColorMode.value = postConfig.velocityColorMode ?? 0;
        velocityColorScale.value = postConfig.velocityColorScale ?? 1.0;
        needVelocitySample.value = (
            (postConfig.distortionStrength ?? 0) > 1e-6 ||
            (postConfig.motionBlurStrength ?? 0) > 1e-6 ||
            (postConfig.velocityColorMode ?? 0) !== 0 ||
            (postConfig.dyeHueFromVelocity ?? 0) > 1e-6 ||
            ((postConfig.dyeFoamEnabled ?? false) && (postConfig.dyeFoamSource ?? 0) !== 0) ||
            (postConfig.debugView ?? 0) === 1
        ) ? 1 : 0;

        const bg = postConfig.backgroundColor ?? [0.04, 0.06, 0.08];
        backgroundColor.value.set(bg[0], bg[1], bg[2]);

        dyeBlendMode.value = postConfig.dyeBlendMode ?? 0;
        dyeOpacity.value = postConfig.dyeOpacity ?? 1.0;
        dyeDensityToAlpha.value = postConfig.dyeDensityToAlpha ?? 1.0;
        dyeDensityExposure.value = postConfig.dyeDensityExposure ?? 1.0;
        dyeColorizeStrength.value = postConfig.dyeColorizeStrength ?? 0.0;
        dyeEdgeStrength.value = postConfig.dyeEdgeStrength ?? 0.0;

        dyeShadingEnabled.value = (postConfig.dyeShadingEnabled ?? false) ? 1 : 0;
        dyeShadingStrength.value = postConfig.dyeShadingStrength ?? 1.0;
        dyeSpecular.value = postConfig.dyeSpecular ?? 0.35;
        dyeSpecPower.value = postConfig.dyeSpecPower ?? 24.0;

        dyeFoamEnabled.value = (postConfig.dyeFoamEnabled ?? false) ? 1 : 0;
        dyeFoamSource.value = postConfig.dyeFoamSource ?? 0;
        dyeFoamStrength.value = postConfig.dyeFoamStrength ?? 0.35;
        dyeFoamThreshold.value = postConfig.dyeFoamThreshold ?? 0.2;
        dyeFoamSoftness.value = postConfig.dyeFoamSoftness ?? 0.2;
        dyeFoamSpeedScale.value = postConfig.dyeFoamSpeedScale ?? 1.0;
        dyeFoamVorticityScale.value = postConfig.dyeFoamVorticityScale ?? 1.0;
        const ft = postConfig.dyeFoamTint ?? [1.0, 1.0, 1.0];
        dyeFoamTint.value.set(ft[0], ft[1], ft[2]);

        const pl = postConfig.paletteLowColor ?? [0.05, 0.08, 0.12];
        const pm = postConfig.paletteMidColor ?? [0.18, 0.75, 0.95];
        const ph = postConfig.paletteHighColor ?? [1.0, 0.35, 0.2];
        paletteLow.value.set(pl[0], pl[1], pl[2]);
        paletteMid.value.set(pm[0], pm[1], pm[2]);
        paletteHigh.value.set(ph[0], ph[1], ph[2]);
        paletteBias.value = postConfig.paletteBias ?? 0.0;
        paletteGamma.value = postConfig.paletteGamma ?? 1.0;
        paletteContrast.value = postConfig.paletteContrast ?? 1.0;

        dyeBrightness.value = postConfig.dyeBrightness ?? 1.0;
        dyeSaturation.value = postConfig.dyeSaturation ?? 1.0;
        dyeContrast.value = postConfig.dyeContrast ?? 1.0;
        dyeGamma.value = postConfig.dyeGamma ?? 1.0;
        dyeHue.value = postConfig.dyeHue ?? 0.0;
        dyeHueSpeed.value = postConfig.dyeHueSpeed ?? 0.0;
        dyeHueFromVelocity.value = postConfig.dyeHueFromVelocity ?? 0.0;

        dyeNoiseStrength.value = postConfig.dyeNoiseStrength ?? 0.0;
        dyeNoiseScale.value = postConfig.dyeNoiseScale ?? 2.0;
        dyeNoiseSpeed.value = postConfig.dyeNoiseSpeed ?? 0.25;
        dyeNoiseColor.value = postConfig.dyeNoiseColor ?? 0.35;

        dyeMediumEnabled.value = (postConfig.dyeMediumEnabled ?? false) ? 1 : 0;
        dyeMediumDensity.value = postConfig.dyeMediumDensity ?? 1.0;
        dyeAbsorptionStrength.value = postConfig.dyeAbsorptionStrength ?? 0.8;
        const ac = postConfig.dyeAbsorptionColor ?? [0.7, 0.2, 0.05];
        dyeAbsorptionColor.value.set(ac[0], ac[1], ac[2]);
        dyeScatteringStrength.value = postConfig.dyeScatteringStrength ?? 0.35;
        const sc = postConfig.dyeScatteringColor ?? [0.95, 0.6, 0.35];
        dyeScatteringColor.value.set(sc[0], sc[1], sc[2]);

        // Output grading is treated as PostFX:
        // - only run in-quad when Post is enabled, backend is "Quad", and bypass is off
        // - when backend is "Three" (1), grading is handled in `FluidPostProcessing2D`
        const postOn = postConfig.postEnabled ?? false;
        const backend = postConfig.postBackend ?? 0;
        const bypass = postConfig.postFxBypass ?? false;
        skipOutputGradingInt.value = (postOn && backend === 0 && !bypass) ? 0 : 1;
        outExposure.value = postConfig.exposure ?? 1.0;
        outToneMapping.value = postConfig.toneMapping ?? 0;
        outBrightness.value = postConfig.brightness ?? 1.0;
        outSaturation.value = postConfig.saturation ?? 1.0;
        outContrast.value = postConfig.contrast ?? 1.0;
        outGamma.value = postConfig.gamma ?? 1.0;
        outVignetteIntensity.value = postConfig.vignetteIntensity ?? 0.0;
        outVignetteRadius.value = postConfig.vignetteRadius ?? 0.8;
        outVignetteSoftness.value = postConfig.vignetteSoftness ?? 0.3;

        const lutOn = (postConfig.lutEnabled ?? false) && lutUrl.length > 0 && (postConfig.lutAmount ?? 0) > 1e-6;
        lutEnabled.value = lutOn ? 1 : 0;
        lutAmount.value = postConfig.lutAmount ?? 1.0;
        const tex3d: any = lut3d.texture3D ?? lutFallback3D;
        lutNode.value = tex3d;
        lutSize.value = Math.max(2, lut3d.size ?? 2);

        const gradUrl = postConfig.gradientMapUrl ?? '';
        gradientMapEnabled.value = (postConfig.gradientMapEnabled ?? false) && gradUrl.length > 0 ? 1 : 0;
        gradientMapStrength.value = postConfig.gradientMapStrength ?? 1.0;

        dyeFresnelEnabled.value = (postConfig.dyeFresnelEnabled ?? false) ? 1 : 0;
        dyeFresnelStrength.value = postConfig.dyeFresnelStrength ?? 0.35;
        dyeFresnelPower.value = postConfig.dyeFresnelPower ?? 3.0;
        const fr = postConfig.dyeFresnelTint ?? [1.0, 1.0, 1.0];
        dyeFresnelTint.value.set(fr[0], fr[1], fr[2]);

        debugView.value = postConfig.debugView ?? 0;
        debugScale.value = postConfig.debugScale ?? 10.0;
        debugBias.value = postConfig.debugBias ?? 0.0;
    }, [
        postConfig,
        distortionStrength,
        motionBlurStrength,
        colorMode,
        rampSource,
        rampSpeedScale,
        materialMode,
        glowIntensity,
        velocityColorMode,
        velocityColorScale,
        needVelocitySample,
        backgroundColor,
        dyeBlendMode,
        dyeOpacity,
        dyeDensityToAlpha,
        dyeDensityExposure,
        dyeColorizeStrength,
        dyeEdgeStrength,
        dyeShadingEnabled,
        dyeShadingStrength,
        dyeSpecular,
        dyeSpecPower,
        dyeFoamEnabled,
        dyeFoamSource,
        dyeFoamStrength,
        dyeFoamThreshold,
        dyeFoamSoftness,
        dyeFoamSpeedScale,
        dyeFoamVorticityScale,
        dyeFoamTint,
        paletteLow,
        paletteMid,
        paletteHigh,
        paletteBias,
        paletteGamma,
        paletteContrast,
        dyeBrightness,
        dyeSaturation,
        dyeContrast,
        dyeGamma,
        dyeHue,
        dyeHueSpeed,
        dyeHueFromVelocity,
        dyeNoiseStrength,
        dyeNoiseScale,
        dyeNoiseSpeed,
        dyeNoiseColor,
        dyeMediumEnabled,
        dyeMediumDensity,
        dyeAbsorptionStrength,
        dyeAbsorptionColor,
        dyeScatteringStrength,
        dyeScatteringColor,
        skipOutputGradingInt,
        outExposure,
        outToneMapping,
        outBrightness,
        outSaturation,
        outContrast,
        outGamma,
        outVignetteIntensity,
        outVignetteRadius,
        outVignetteSoftness,
        lutEnabled,
        lutAmount,
        lutSize,
        lutNode,
        lutFallback3D,
        lut3d.texture3D,
        lut3d.size,
        gradientMapEnabled,
        gradientMapStrength,
        dyeFresnelEnabled,
        dyeFresnelStrength,
        dyeFresnelPower,
        dyeFresnelTint,
        debugView,
        debugScale,
        debugBias,
    ]);

    // Create material using texture() to sample the dye StorageTexture
    useEffect(() => {
        if (!solver) return;

        const pingpong = solver.getPingPongTextures();
        const state = solver.getPingPongState();
        velocityIsA.value = state.velocityIsA ? 1 : 0;
        dyeIsA.value = state.dyeIsA ? 1 : 0;
        pressureIsA.value = state.pressureIsA ? 1 : 0;

        const dyeTexA = pingpong.dyeA;
        const dyeTexB = pingpong.dyeB;
        const velTexA = pingpong.velocityA;
        const velTexB = pingpong.velocityB;
        const pressureTexA = pingpong.pressureA;
        const pressureTexB = pingpong.pressureB;
        const divergenceTex = solver.getDivergenceTexture();
        const vorticityTex = solver.getVorticityTexture();
        const temperatureTex = solver.getTemperatureTexture() ?? vorticityTex;
        invDyeRes.value = 1.0 / Math.max(1, config.dyeSize);

        const gradientTex = gradientMapTexture ?? gradientFallbackTex;

        // Create material - KEY: use texture() which works with StorageTexture
        const mat = new THREE.MeshBasicNodeMaterial();
        const uvCoord = uv();
        // App convention: normalized coordinates are Y-down. Flip sampling UV so on-screen matches emitter/mouse space.
        const simUV = vec2(uvCoord.x, float(1.0).sub(uvCoord.y));

        // Sample velocity from ping-pong without full-texture copies.
        const vel = Fn(() => {
            const v = property('vec2', 'velSample');
            v.assign(vec2(0.0, 0.0));
            If(int(needVelocitySample).equal(int(1)), () => {
                If(int(velocityIsA).equal(int(1)), () => {
                    v.assign(texture(velTexA, simUV).xy);
                }).Else(() => {
                    v.assign(texture(velTexB, simUV).xy);
                });
            });
            return v;
        })();

        // Distortion (velocity-driven UV offset)
        const uvDistorted = simUV.add(vel.mul(distortionStrength));

        // Dye sampling from ping-pong without full-texture copies.
        const sampleDye = (uvNode: any, name: string) =>
            Fn(() => {
                const c = property('vec4', name);
                If(int(dyeIsA).equal(int(1)), () => {
                    c.assign(texture(dyeTexA, uvNode));
                }).Else(() => {
                    c.assign(texture(dyeTexB, uvNode));
                });
                return c;
            })();

        // Motion blur (optional 3 taps along velocity). Avoid extra texture samples when strength ~ 0.
        const base = sampleDye(uvDistorted, 'dyeBase');
        const blurred = Fn(() => {
            const col = property('vec4', 'dyeBlurred');
            col.assign(base);

            const blurOn = motionBlurStrength.greaterThan(float(1e-6));
            If(blurOn, () => {
                const blur = vel.mul(motionBlurStrength);
                col.assign(
                    base
                        .mul(0.5)
                        .add(sampleDye(uvDistorted.add(blur), 'dyeBlurP').mul(0.25))
                        .add(sampleDye(uvDistorted.sub(blur), 'dyeBlurN').mul(0.25))
                );
            });

            return col;
        })();

        const baseColor = blurred.rgb;
        const gray = dot(baseColor, vec3(0.299, 0.587, 0.114));
        const dyeMax = max(baseColor.x, max(baseColor.y, baseColor.z));
        const density = float(1.0).sub(exp(dyeMax.mul(dyeDensityExposure.max(float(1e-3))).negate()));
        const intensity = clamp(density, float(0), float(1));

        const paletteT = clamp(intensity.add(paletteBias), float(0.0), float(1.0));
        const paletteAdj = clamp(
            paletteT.pow(float(1.0).div(paletteGamma.max(float(1e-3)))).mul(paletteContrast).sub(paletteContrast.sub(1.0).mul(0.5)),
            float(0.0),
            float(1.0)
        );
        const lowToMid = smoothstep(float(0.0), float(0.5), paletteAdj);
        const midToHigh = smoothstep(float(0.5), float(1.0), paletteAdj);
        // Avoid mix(vec3, vec3, float) since WGSL doesn't allow implicit scalar->vec promotion.
        const pal = paletteLow.mul(float(1.0).sub(lowToMid)).add(paletteMid.mul(lowToMid));
        const palOut = pal.mul(float(1.0).sub(midToHigh)).add(paletteHigh.mul(midToHigh));

        // Ramp/gradient map (uses the same 3 colors + bias/gamma/contrast as Palette mode)
        // Source: density (intensity) or speed (|vel|).
        const rs = int(rampSource);
        const velScaledForRamp = vel.mul(velocityColorScale);
        const speedForRamp = length(velScaledForRamp).mul(1.2);
        const speed01 = clamp(speedForRamp.mul(rampSpeedScale), float(0.0), float(1.0));
        const rampBaseT = select(rs.equal(int(1)), speed01, intensity);
        const rampT = clamp(rampBaseT.add(paletteBias), float(0.0), float(1.0));
        const rampAdj = clamp(
            rampT.pow(float(1.0).div(paletteGamma.max(float(1e-3)))).mul(paletteContrast).sub(paletteContrast.sub(1.0).mul(0.5)),
            float(0.0),
            float(1.0)
        );
        const rLowToMid = smoothstep(float(0.0), float(0.5), rampAdj);
        const rMidToHigh = smoothstep(float(0.5), float(1.0), rampAdj);
        const rPal = paletteLow.mul(float(1.0).sub(rLowToMid)).add(paletteMid.mul(rLowToMid));
        const rampOut = rPal.mul(float(1.0).sub(rMidToHigh)).add(paletteHigh.mul(rMidToHigh));

        // Optional gradient-map texture for Ramp mode (artist-driven color lookup).
        const rampOutMapped = Fn(() => {
            const out = property('vec3', 'rampOutMapped');
            out.assign(rampOut);

            const gmOn = int(gradientMapEnabled).equal(int(1)).and(gradientMapStrength.greaterThan(float(1e-6)));
            If(gmOn, () => {
                const t = clamp(rampAdj, float(0.0), float(1.0));
                const g = texture(gradientTex as any, vec2(t, float(0.5))).rgb;
                const w = clamp(gradientMapStrength, float(0.0), float(1.0));
                out.assign(out.mul(float(1.0).sub(w)).add(g.mul(w)));
            });

            return out;
        })();

        // Color modes (simple, fast)
        const rainbow = vec3(
            sin(intensity.mul(6.283).add(0.0)).mul(0.5).add(0.5),
            sin(intensity.mul(6.283).add(2.094)).mul(0.5).add(0.5),
            sin(intensity.mul(6.283).add(4.188)).mul(0.5).add(0.5)
        );
        const heatA = vec3(0.1, 0.2, 1.0);
        const heatB = vec3(1.0, 0.2, 0.0);
        const heat = heatA.mul(float(1.0).sub(intensity)).add(heatB.mul(intensity));
        const mono = vec3(gray, gray, gray);
        const neon = baseColor.pow(float(0.75)).mul(float(1.2)).add(vec3(intensity, intensity, intensity).mul(glowIntensity.mul(0.35)));
        const iridescentPhase = intensity.mul(10.0).add(vel.x.mul(1.5)).add(vel.y.mul(1.1));
        const iridescent = vec3(
            sin(iridescentPhase.add(0.0)).mul(0.5).add(0.5),
            sin(iridescentPhase.add(2.094)).mul(0.5).add(0.5),
            sin(iridescentPhase.add(4.188)).mul(0.5).add(0.5)
        );

        const cm = int(colorMode);
        const stylized = select(
            cm.equal(int(7)),
            rampOutMapped,
            select(
                cm.equal(int(6)),
                iridescent,
                select(
                    cm.equal(int(5)),
                    palOut,
                    select(
                        cm.equal(int(4)),
                        mono,
                        select(
                            cm.equal(int(3)),
                            neon,
                            select(cm.equal(int(2)), heat, select(cm.equal(int(1)), rainbow, baseColor))
                        )
                    ))));

        // Mix original dye RGB with stylized result (lets you keep emitter colors but still "style" it)
        const cMix = clamp(dyeColorizeStrength, float(0.0), float(1.0));
        const colored = baseColor.mul(float(1.0).sub(cMix)).add(stylized.mul(cMix));

        // Velocity overlay modes
        const vMode = int(velocityColorMode);
        const velScaled = vel.mul(velocityColorScale);
        const speed = length(velScaled).mul(1.2);

        // Utility: hue rotate in YIQ space (fast)
        const hueAngle = dyeHue.add(renderTime.mul(dyeHueSpeed)).add(speed.mul(dyeHueFromVelocity));
        const hc = cos(hueAngle);
        const hs = sin(hueAngle);
        const yiqY = dot(colored, vec3(0.299, 0.587, 0.114));
        const yiqI = dot(colored, vec3(0.596, -0.274, -0.322));
        const yiqQ = dot(colored, vec3(0.211, -0.523, 0.312));
        const i2 = yiqI.mul(hc).sub(yiqQ.mul(hs));
        const q2 = yiqI.mul(hs).add(yiqQ.mul(hc));
        const hueRot = vec3(
            yiqY.add(i2.mul(0.956)).add(q2.mul(0.621)),
            yiqY.sub(i2.mul(0.272)).sub(q2.mul(0.647)),
            yiqY.sub(i2.mul(1.106)).add(q2.mul(1.703))
        );

        // Saturation/contrast/gamma/brightness (pre-post)
        const gray2 = dot(hueRot, vec3(0.299, 0.587, 0.114));
        const grayV = vec3(gray2, gray2, gray2);
        const sat = grayV.mul(float(1.0).sub(dyeSaturation)).add(hueRot.mul(dyeSaturation));
        const contrasted = sat.sub(vec3(0.5, 0.5, 0.5)).mul(dyeContrast).add(vec3(0.5, 0.5, 0.5));
        const bright = contrasted.mul(dyeBrightness);
        const graded = vec3(
            bright.x.max(0.0).pow(float(1.0).div(dyeGamma.max(float(1e-3)))),
            bright.y.max(0.0).pow(float(1.0).div(dyeGamma.max(float(1e-3)))),
            bright.z.max(0.0).pow(float(1.0).div(dyeGamma.max(float(1e-3))))
        );

        // Noise-based micro texture (animated)
        const nT = renderTime.mul(dyeNoiseSpeed);
        const nUV = simUV.mul(dyeNoiseScale.max(float(0.01))).add(vec2(nT, nT.mul(0.73)));
        const n = fract(sin(dot(nUV, vec2(12.9898, 78.233))).mul(43758.5453)).sub(0.5);
        const noiseAmt = n.mul(dyeNoiseStrength);
        const noisyBright = graded.add(vec3(noiseAmt, noiseAmt, noiseAmt));
        const noisyHue = vec3(
            noisyBright.x.add(noiseAmt.mul(dyeNoiseColor)),
            noisyBright.y.sub(noiseAmt.mul(dyeNoiseColor.mul(0.5))),
            noisyBright.z.add(noiseAmt.mul(dyeNoiseColor.mul(0.25)))
        );
        const dyeFinal = clamp(noisyHue, vec3(0.0), vec3(10.0));
        const velSpeedColor = vec3(clamp(speed, 0.0, 1.0), clamp(speed.mul(0.25), 0.0, 1.0), clamp(float(1.0).sub(speed), 0.0, 1.0));
        const velDirColor = vec3(
            clamp(velScaled.x.mul(0.5).add(0.5), 0.0, 1.0),
            clamp(velScaled.y.mul(0.5).add(0.5), 0.0, 1.0),
            clamp(speed, 0.0, 1.0)
        );
        const velOverlay = select(vMode.equal(int(2)), velDirColor, velSpeedColor);
        const velWeight = select(vMode.equal(int(0)), float(0.0), float(1.0));
        const velAdded = dyeFinal.add(velOverlay.mul(0.5));
        const withVel = dyeFinal.mul(float(1.0).sub(velWeight)).add(velAdded.mul(velWeight));
        const grayWithVel = dot(withVel, vec3(0.299, 0.587, 0.114));

        // Material modes (stylization)
        const mm = int(materialMode);
        const glossy = withVel.add(vec3(speed, speed, speed).mul(0.2));
        const matteT = float(0.55);
        const matteBase = vec3(grayWithVel, grayWithVel, grayWithVel);
        const matte = matteBase.mul(float(1.0).sub(matteT)).add(withVel.mul(matteT));
        const ink = vec3(
            smoothstep(float(0.35), float(0.65), grayWithVel),
            smoothstep(float(0.35), float(0.65), grayWithVel),
            smoothstep(float(0.35), float(0.65), grayWithVel)
        );
        const neonMat = withVel.mul(float(1.0).add(glowIntensity.mul(0.6)));

        const styled = select(
            mm.equal(int(4)),
            ink,
            select(
                mm.equal(int(3)),
                neonMat,
                select(mm.equal(int(2)), matte, select(mm.equal(int(1)), glossy, withVel))
            )
        );

        // Optional: edge enhancement + pseudo shading (avoid extra samples unless enabled).
        // Must run inside `Fn()` to use `If()` + `assign()` safely (Three TSL stack).
        const presented = Fn(() => {
            const col = property('vec3', 'presentedCol');
            const gradLenProp = property('float', 'presentedGradLen');
            col.assign(styled);
            gradLenProp.assign(float(0.0));

            const shadingEnabled = int(dyeShadingEnabled).equal(int(1));
            const fresnelEnabled = int(dyeFresnelEnabled).equal(int(1));
            const foamEnabled = int(dyeFoamEnabled).equal(int(1));
            const foamEdge = int(dyeFoamSource).equal(int(0));
            const needsGrad = dyeEdgeStrength.greaterThan(float(1e-6)).or(shadingEnabled).or(fresnelEnabled).or(foamEnabled.and(foamEdge));

            If(needsGrad, () => {
                const dx = vec2(invDyeRes, float(0.0));
                const dy = vec2(float(0.0), invDyeRes);
                const dR = dot(sampleDye(simUV.add(dx), 'dRcol').rgb, vec3(0.299, 0.587, 0.114));
                const dL = dot(sampleDye(simUV.sub(dx), 'dLcol').rgb, vec3(0.299, 0.587, 0.114));
                const dU = dot(sampleDye(simUV.add(dy), 'dUcol').rgb, vec3(0.299, 0.587, 0.114));
                const dD = dot(sampleDye(simUV.sub(dy), 'dDcol').rgb, vec3(0.299, 0.587, 0.114));
                const grad = vec2(dR.sub(dL), dU.sub(dD));
                const gradLen = length(grad);
                gradLenProp.assign(gradLen);

                const edge = clamp(length(grad).mul(dyeEdgeStrength).mul(6.0), float(0.0), float(1.0));
                const edged = styled.mul(float(1.0).sub(edge.mul(0.65))).add(styled.mul(edge.mul(0.15)));

                const lightDir = vec3(0.35, 0.55, 1.0);
                const normal = vec3(grad.x.mul(dyeShadingStrength), grad.y.mul(dyeShadingStrength), float(1.0));
                const nLen = max(length(normal), float(1e-4));
                const nrm = normal.div(nLen);
                const lambert = clamp(dot(nrm, lightDir).mul(0.5).add(0.5), float(0.0), float(1.0));
                const halfV = vec3(0.0, 0.0, 1.0).add(lightDir);
                const hLen = max(length(halfV), float(1e-4));
                const hv = halfV.div(hLen);
                const spec = max(dot(nrm, hv), float(0.0)).pow(dyeSpecPower).mul(dyeSpecular);
                const shaded = edged.mul(lambert.mul(0.75).add(0.25)).add(vec3(spec, spec, spec));

                col.assign(select(shadingEnabled, shaded, edged));

                // Fresnel highlight for a "liquid" rim sheen.
                If(fresnelEnabled, () => {
                    const ndv = clamp(nrm.z, float(0.0), float(1.0));
                    const fres = float(1.0).sub(ndv).pow(dyeFresnelPower).mul(dyeFresnelStrength);
                    col.assign(col.add(dyeFresnelTint.mul(fres)));
                });
            });

            // Foam/highlight layer
            If(foamEnabled, () => {
                const src = int(dyeFoamSource);
                const edgeMetric = clamp(gradLenProp.mul(6.0), float(0.0), float(1.0));
                const speedMetric = clamp(speed.mul(dyeFoamSpeedScale), float(0.0), float(1.0));
                const vortMetric = clamp(abs(texture(vorticityTex, simUV).x).mul(dyeFoamVorticityScale), float(0.0), float(1.0));

                const metric = select(src.equal(int(2)), vortMetric, select(src.equal(int(1)), speedMetric, edgeMetric));
                const t0 = dyeFoamThreshold;
                const t1 = dyeFoamThreshold.add(dyeFoamSoftness.max(float(1e-6)));
                const mask = smoothstep(t0, t1, metric).mul(dyeFoamStrength);

                col.assign(col.add(dyeFoamTint.mul(mask)));
            });

            return col;
        })();

        const out = presented.add(presented.mul(glowIntensity.mul(0.4)));

        // Medium-style absorption/scattering (cheap "thickness" look)
        const mediumOn = int(dyeMediumEnabled).equal(int(1));
        const thick = clamp(intensity.mul(dyeMediumDensity), float(0.0), float(1.0));
        const trans = clamp(vec3(1.0).sub(dyeAbsorptionColor.mul(thick.mul(dyeAbsorptionStrength))), vec3(0.0), vec3(1.0));
        const absorbed = out.mul(trans);
        const scatT = clamp(thick.mul(dyeScatteringStrength), float(0.0), float(1.0));
        const scattered = absorbed.mul(float(1.0).sub(scatT)).add(dyeScatteringColor.mul(scatT));
        const mediumOut = select(mediumOn, scattered, out);

        // Background blending (gives "ink on paper"/screen/add options)
        const alpha = clamp(intensity.mul(dyeDensityToAlpha), float(0.0), float(1.0)).mul(dyeOpacity);
        const bm = int(dyeBlendMode);
        const normalBlend = backgroundColor.mul(float(1.0).sub(alpha)).add(mediumOut.mul(alpha));
        const addBlend = clamp(backgroundColor.add(mediumOut.mul(alpha)), vec3(0.0), vec3(1.0));
        const screenBlend = vec3(1.0).sub(vec3(1.0).sub(backgroundColor).mul(vec3(1.0).sub(mediumOut.mul(alpha))));
        const blended = select(bm.equal(int(2)), screenBlend, select(bm.equal(int(1)), addBlend, normalBlend));

        // Output grading in the quad unless the Three post stack is active.
        const outputGraded = Fn(() => {
            const col = property('vec3', 'outputGraded');
            col.assign(blended);

            const skip = int(skipOutputGradingInt).equal(int(1));
            If(skip.not(), () => {
                // Exposure + optional tone map (simple Reinhard for WebGPU safety)
                const exposed = col.mul(outExposure.max(float(0.0)));
                const reinhard = exposed.div(exposed.add(vec3(1.0, 1.0, 1.0)));
                const tmT = clamp(float(outToneMapping), float(0.0), float(1.0));
                const tm = exposed.mul(float(1.0).sub(tmT)).add(reinhard.mul(tmT));

                // Basic grading
                const y = dot(tm, vec3(0.299, 0.587, 0.114));
                const outGray = vec3(y, y, y);
                const sat = outGray.mul(float(1.0).sub(outSaturation)).add(tm.mul(outSaturation));
                const ctr = sat.sub(vec3(0.5, 0.5, 0.5)).mul(outContrast).add(vec3(0.5, 0.5, 0.5));
                const brt = ctr.mul(outBrightness);
                const g = outGamma.max(float(1e-3));
                const gam = vec3(
                    brt.x.max(0.0).pow(float(1.0).div(g)),
                    brt.y.max(0.0).pow(float(1.0).div(g)),
                    brt.z.max(0.0).pow(float(1.0).div(g))
                );

                // Vignette (matches post node behavior)
                const center = vec2(0.5, 0.5);
                const dist = length(uvCoord.sub(center)).mul(float(1.414)).div(outVignetteRadius.max(float(1e-3)));
                const vig = smoothstep(float(1.0), float(1.0).sub(outVignetteSoftness), dist);
                const vigMul = mix(float(1.0).sub(outVignetteIntensity), float(1.0), vig);

                const graded = gam.mul(vigMul);

                // Optional creative LUT (image-based 3D LUT)
                const lutOn = int(lutEnabled).equal(int(1)).and(lutAmount.greaterThan(float(1e-6)));
                If(lutOn, () => {
                    const base4 = vec4(
                        clamp(graded.x, float(0.0), float(1.0)),
                        clamp(graded.y, float(0.0), float(1.0)),
                        clamp(graded.z, float(0.0), float(1.0)),
                        float(1.0)
                    );
                    const lutOut = applyLut3D(base4, lutNode as any, lutSize, lutAmount);
                    col.assign(lutOut.rgb);
                }).Else(() => {
                    col.assign(graded);
                });
            });

            return col;
        })();

        // Debug views (core fields). Use control-flow to avoid extra texture samples when debug is off.
        const dbg = int(debugView);
        const dbgVel = vel.mul(debugScale);
        const dbgSpeed = clamp(length(dbgVel).mul(0.25), float(0.0), float(1.0));
        const velDebug = vec3(dbgVel.x.mul(0.5).add(0.5), dbgVel.y.mul(0.5).add(0.5), dbgSpeed);

        const div = texture(divergenceTex, simUV).x.mul(debugScale).add(debugBias);
        const divPos = clamp(div, float(0.0), float(1.0));
        const divNeg = clamp(div.negate(), float(0.0), float(1.0));
        const divergenceDebug = vec3(divPos, float(0.0), divNeg);

        const vort = texture(vorticityTex, simUV).x.mul(debugScale).add(debugBias);
        const vortPos = clamp(vort, float(0.0), float(1.0));
        const vortNeg = clamp(vort.negate(), float(0.0), float(1.0));
        const vorticityDebug = vec3(vortPos, float(0.0), vortNeg);

        const outColor = Fn(() => {
            const col = property('vec3', 'outColor');
            col.assign(outputGraded);

            If(dbg.equal(int(1)), () => {
                col.assign(velDebug);
            });

            If(dbg.equal(int(2)), () => {
                const p = Fn(() => {
                    const s = property('float', 'pressureSample');
                    If(int(pressureIsA).equal(int(1)), () => {
                        s.assign(texture(pressureTexA, simUV).x);
                    }).Else(() => {
                        s.assign(texture(pressureTexB, simUV).x);
                    });
                    return s;
                })()
                    .mul(debugScale)
                    .add(debugBias);
                const p01 = clamp(p.mul(0.5).add(0.5), float(0.0), float(1.0));
                col.assign(vec3(p01, p01, p01));
            });

            If(dbg.equal(int(3)), () => {
                col.assign(divergenceDebug);
            });

            If(dbg.equal(int(4)), () => {
                col.assign(vorticityDebug);
            });

            If(dbg.equal(int(5)), () => {
                col.assign(clamp(sampleDye(simUV, 'dyeRaw').rgb, vec3(0.0, 0.0, 0.0), vec3(1.0, 1.0, 1.0)));
            });

            // Temperature debug view (6) - heat gradient (blue = cold, red = hot)
            If(dbg.equal(int(6)), () => {
                // Sample temperature from solver if available (fallback to vorticity visualization if not)
                const temp = texture(temperatureTex, simUV).x.mul(debugScale).add(debugBias);
                const t = clamp(temp.mul(0.5).add(0.5), float(0.0), float(1.0));
                // Heat gradient: blue -> cyan -> yellow -> red
                const r = smoothstep(float(0.25), float(0.75), t);
                const g = smoothstep(float(0.0), float(0.5), t).mul(smoothstep(float(1.0), float(0.5), t));
                const b = smoothstep(float(0.5), float(0.0), t);
                col.assign(vec3(r, g, b));
            });

            return col;
        })();

        mat.colorNode = vec4(clamp(outColor, vec3(0.0, 0.0, 0.0), vec3(1.0, 1.0, 1.0)), float(1.0));
        mat.side = THREE.DoubleSide;
        materialRef.current = mat;

        if (meshRef.current) {
            meshRef.current.material = mat;
        }

        return () => {
            mat.dispose();
        };
    }, [solver, config.gridSize, config.dyeSize, gradientMapTexture, gradientFallbackTex]);

    // Simulation step
    useFrame((_, delta) => {
        if (!solver) return;
        // Emitters -> splats
        if (emitterManager) {
            const splats = emitterManager.generateSplats(solver.getTime(), delta, audioData);
            if (splats.length) solver.addSplats(splats);
        }

        solver.step(delta);
        renderTime.value = solver.getTime();

        const pp = solver.getPingPongState();
        velocityIsA.value = pp.velocityIsA ? 1 : 0;
        dyeIsA.value = pp.dyeIsA ? 1 : 0;
        pressureIsA.value = pp.pressureIsA ? 1 : 0;

        const fps = 1.0 / Math.max(1e-6, delta);
        const perf = solver.getPerfStats();
        onFrame?.(solver.getTime(), delta, fps, perf);
    });

    // Mouse handlers
    const handlePointerDown = useCallback((e: any) => {
        if (!mouseEnabled || !solver || !e?.uv) return;

        mouseState.current.isDown = true;
        mouseState.current.lastTime = null;
        mouseState.current.currentColor = generateRandomColor();

        const x = e.uv.x as number;
        const y = 1.0 - (e.uv.y as number);
        mouseState.current.lastPos = [x, y];

        const radius = config.mouseRadius ?? defaultConfig2D.mouseRadius;

        solver.addSplat({
            x,
            y,
            dx: 0,
            dy: 0,
            color: mouseState.current.currentColor as Color3,
            radius,
        });
    }, [mouseEnabled, solver, config.mouseRadius]);

    const handlePointerUp = useCallback(() => {
        mouseState.current.isDown = false;
        mouseState.current.lastTime = null;
    }, []);

    const handlePointerLeave = useCallback(() => {
        mouseState.current.isDown = false;
        mouseState.current.lastPos = null;
        mouseState.current.lastTime = null;
    }, []);

    const handlePointerMove = useCallback((e: any) => {
        if (!mouseEnabled || !solver || !e?.uv) return;

        const x = e.uv.x as number;
        const y = 1.0 - (e.uv.y as number);

        const shouldSplat = mouseHoverMode || mouseState.current.isDown;
        if (shouldSplat && mouseState.current.lastPos) {
            const now = performance.now();
            const lastTime = mouseState.current.lastTime ?? now;
            const dt = Math.min(1 / 15, Math.max(1 / 240, (now - lastTime) / 1000));
            mouseState.current.lastTime = now;

            const vx = (x - mouseState.current.lastPos[0]) / dt;
            const vy = (y - mouseState.current.lastPos[1]) / dt;

            const dx = vx * 0.02 * (config.mouseForce ?? defaultConfig2D.mouseForce);
            const dy = vy * 0.02 * (config.mouseForce ?? defaultConfig2D.mouseForce);

            const moveMag = Math.sqrt(dx * dx + dy * dy);
            if (moveMag > 0.001) {
                const radius = config.mouseRadius ?? defaultConfig2D.mouseRadius;
                const splat: Splat = {
                    x,
                    y,
                    dx,
                    dy,
                    color: mouseState.current.currentColor as Color3,
                    radius,
                };
                solver.addSplat(splat);
                onMouseSplat?.(splat);
            }
        }

        mouseState.current.lastPos = [x, y];
    }, [mouseEnabled, mouseHoverMode, solver, config.mouseForce, config.mouseRadius, onMouseSplat]);

    if (!solver) return null;

    return (
        <mesh
            ref={meshRef}
            scale={[viewport.width, viewport.height, 1]}
            onPointerDown={handlePointerDown}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerLeave}
            onPointerMove={handlePointerMove}
        >
            <planeGeometry args={[1, 1]} />
            {materialRef.current && (
                <primitive object={materialRef.current} attach="material" />
            )}
        </mesh>
    );
}

// ============================================
// FluidCanvas2D Component
// ============================================

export interface FluidCanvas2DProps {
    width?: number | string;
    height?: number | string;
    config?: Partial<FluidConfig2D>;
    postConfig?: Partial<RenderOutput2DConfig>;
    mouseEnabled?: boolean;
    mouseHoverMode?: boolean;
    emitterManager?: EmitterManager;
    selection?: SelectionState;
    gizmosEnabled?: boolean;
    onFrame?: (time: number, delta: number, fps: number, perf?: PerfStats2D | null) => void;
    className?: string;
    style?: React.CSSProperties;
    onMouseSplat?: (splat: Splat) => void;
    audioData?: Float32Array;
    autoStart?: boolean;
}

export function FluidCanvas2D({
    width = '100%',
    height = '100%',
    config: configOverrides = {},
    postConfig: postConfigOverrides = {},
    mouseEnabled = true,
    mouseHoverMode = true,
    emitterManager,
    selection,
    gizmosEnabled = true,
    onFrame,
    className,
    style,
    onMouseSplat,
    audioData,
    autoStart = true,
}: FluidCanvas2DProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
    const [textureAspect, setTextureAspect] = useState(1);
    const [webGPUSupported, setWebGPUSupported] = useState<boolean | null>(null);
    const [initError, setInitError] = useState<string | null>(null);
    const [solver, setSolver] = useState<FluidSolver2D | null>(null);
    const solverRef = useRef<FluidSolver2D | null>(null);
    const rendererRef = useRef<THREE.WebGPURenderer | null>(null);

    const fluidContext = useFluid2DOptional();
    const fluidContextRef = useRef(fluidContext);
    useEffect(() => {
        fluidContextRef.current = fluidContext;
    }, [fluidContext]);

    const mergedConfig = useMemo(() => ({
        ...defaultConfig2D,
        ...configOverrides,
    }), [configOverrides]);
    const mergedConfigRef = useRef(mergedConfig);
    useEffect(() => {
        mergedConfigRef.current = mergedConfig;
    }, [mergedConfig]);

    const mergedPostConfig = useMemo(() => ({
        ...defaultPostConfig,
        ...postConfigOverrides,
    }), [postConfigOverrides]);

    const canvasBackground = useMemo(() => {
        const [r, g, b] = mergedPostConfig.backgroundColor ?? defaultPostConfig.backgroundColor;
        const to255 = (v: number) => Math.max(0, Math.min(255, Math.round(v * 255)));
        return `rgb(${to255(r)}, ${to255(g)}, ${to255(b)})`;
    }, [mergedPostConfig.backgroundColor]);

    // WebGPU support
    useEffect(() => {
        setWebGPUSupported(!!navigator.gpu);
    }, []);

    // Container size tracking (for gizmos)
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const updateSize = () => {
            const rect = container.getBoundingClientRect();
            const w = rect.width || 800;
            const h = rect.height || 600;
            setDimensions({ width: w, height: h });
            // Gizmos should map to what we *render*: the quad fills the canvas (no letterboxing).
            setTextureAspect(w / Math.max(1e-6, h));
        };

        updateSize();
        const resizeObserver = new ResizeObserver(updateSize);
        resizeObserver.observe(container);

        return () => resizeObserver.disconnect();
    }, []);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            solverRef.current?.dispose();
            fluidContextRef.current?.setSolver(null);
        };
    }, []);

    const autoStartRef = useRef(autoStart);
    useEffect(() => {
        autoStartRef.current = autoStart;
    }, [autoStart]);

    const handleGl = useCallback(async (props: any) => {
        try {
            const renderer = new THREE.WebGPURenderer({
                ...props,
                antialias: false,
                alpha: false,
            } as any);

            // R3F awaits an async `gl` factory, so it's safe to await WebGPU init here.
            await renderer.init();

            // Keep a handle for fallback init in case `onCreated` isn't called (dev/HMR edge cases).
            rendererRef.current = renderer;

            return renderer;
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            setInitError(message);
            throw err;
        }
    }, []);

    // Create (or re-create) the solver when R3F's renderer is ready.
    // Important for HMR/dev reloads: R3F can reuse an existing `gl` renderer and will not call the `gl` factory again,
    // so we must not rely on `gl={...}` to initialize the solver.
    const handleCreated = useCallback((state: any) => {
        const gl = state?.gl as THREE.WebGPURenderer | undefined;
        if (!gl || !(gl as any).isWebGPURenderer) return;

        rendererRef.current = gl;

        // If we already have a solver bound to this renderer, do nothing.
        if (solverRef.current && rendererRef.current === gl) return;

        // Replace any existing solver (e.g. after hot reload).
        solverRef.current?.dispose();

        const newSolver = new FluidSolver2D(gl, mergedConfigRef.current);

        if (!autoStartRef.current) newSolver.pause();

        // Seed a visible initial splat so a fresh scene isn't completely black.
        newSolver.addSplat({
            x: 0.5,
            y: 0.5,
            dx: 0,
            dy: 0.5,
            color: [1, 0.4, 0.2],
            radius: mergedConfigRef.current.dyeRadius ?? defaultConfig2D.dyeRadius,
        });

        // Apply seed immediately (even if autoStart=false) so the first frame isn't empty.
        const wasRunning = newSolver.isRunning();
        if (!wasRunning) newSolver.resume();
        newSolver.step(0);
        if (!wasRunning) newSolver.pause();

        rendererRef.current = gl;
        solverRef.current = newSolver;
        setSolver(newSolver);
        fluidContextRef.current?.setSolver(newSolver);
        setInitError(null);
    }, []);

    // Fallback: if R3F doesn't call `onCreated` (or it bails), still create a solver once we have a renderer.
    useEffect(() => {
        const tryInit = () => {
            const gl = rendererRef.current;
            if (!gl || solverRef.current) return;
            if (!(gl as any).isWebGPURenderer) return;

            const newSolver = new FluidSolver2D(gl, mergedConfigRef.current);

            if (!autoStartRef.current) newSolver.pause();

            newSolver.addSplat({
                x: 0.5,
                y: 0.5,
                dx: 0,
                dy: 0.5,
                color: [1, 0.4, 0.2],
                radius: mergedConfigRef.current.dyeRadius ?? defaultConfig2D.dyeRadius,
            });

            const wasRunning = newSolver.isRunning();
            if (!wasRunning) newSolver.resume();
            newSolver.step(0);
            if (!wasRunning) newSolver.pause();

            solverRef.current = newSolver;
            setSolver(newSolver);
            fluidContextRef.current?.setSolver(newSolver);
            setInitError(null);
        };

        // Try immediately + a couple of times to survive HMR ordering.
        tryInit();
        const id = window.setInterval(() => {
            if (solverRef.current) {
                window.clearInterval(id);
                return;
            }
            tryInit();
        }, 50);

        return () => window.clearInterval(id);
    }, []);

    // Sync config changes into the solver.
    useEffect(() => {
        if (!solverRef.current) return;
        solverRef.current.setConfig(mergedConfig);
    }, [mergedConfig]);

    // Sync playback state from provider/store if available.
    useEffect(() => {
        if (!solverRef.current || !fluidContext) return;
        if (fluidContext.isPlaying) solverRef.current.resume();
        else solverRef.current.pause();
    }, [fluidContext?.isPlaying]);

    const selectedIds = selection?.emitterIds ?? fluidContext?.selection.emitterIds ?? new Set<string>();
    const manager = emitterManager ?? fluidContext?.emitterManager;
    const emitters = emitterManager ? emitterManager.getAllEmitters() : fluidContext?.emitters ?? [];

    // WebGPU not available
    if (webGPUSupported === false) {
        return (
            <div
                ref={containerRef}
                className={className}
                style={{
                    position: 'relative',
                    width,
                    height,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
                    color: '#ef4444',
                    fontFamily: 'system-ui, sans-serif',
                    ...style,
                }}
            >
                <div style={{ textAlign: 'center', padding: '2rem' }}>
                    <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>WebGPU Required</h2>
                    <p style={{ color: 'rgba(255,255,255,0.7)' }}>
                        This fluid simulation requires WebGPU.
                    </p>
                </div>
            </div>
        );
    }

    if (initError) {
        return (
            <div
                ref={containerRef}
                className={className}
                style={{
                    position: 'relative',
                    width,
                    height,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'linear-gradient(135deg, #111827 0%, #0b1220 100%)',
                    color: '#ef4444',
                    fontFamily: 'system-ui, sans-serif',
                    ...style,
                }}
            >
                <div style={{ maxWidth: 560, padding: '2rem' }}>
                    <h2 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>WebGPU init failed</h2>
                    <pre style={{ whiteSpace: 'pre-wrap', opacity: 0.85 }}>{initError}</pre>
                </div>
            </div>
        );
    }

    return (
        <div
            ref={containerRef}
            className={className}
            style={{ position: 'relative', width, height, ...style }}
        >
            <Canvas
                frameloop="always"
                gl={handleGl}
                onCreated={handleCreated}
                orthographic
                dpr={1}
                camera={{ position: [0, 0, 1], zoom: 1, near: 0, far: 10 }}
                style={{ width: '100%', height: '100%', background: canvasBackground }}
            >
                <FluidScene
                    solver={solver}
                    config={mergedConfig}
                    postConfig={mergedPostConfig}
                    mouseEnabled={mouseEnabled}
                    mouseHoverMode={mouseHoverMode}
                    emitterManager={manager}
                    audioData={audioData}
                    onFrame={onFrame}
                    onMouseSplat={onMouseSplat}
                />
                {(mergedPostConfig.postEnabled ?? false) && (mergedPostConfig.postBackend ?? 0) === 1 && (
                    <FluidPostProcessing2D postConfig={mergedPostConfig} solver={solver} />
                )}
            </Canvas>

            {manager && (
                <GizmoRenderer
                    emitters={emitters}
                    manager={manager}
                    selectedIds={selectedIds}
                    canvasWidth={dimensions.width}
                    canvasHeight={dimensions.height}
                    textureAspect={textureAspect}
                    enabled={gizmosEnabled}
                />
            )}
        </div>
    );
}

// ============================================
// Utility: HSL to RGB
// ============================================

function hslToRgb(h: number, s: number, l: number): Color3 {
    let r: number, g: number, b: number;

    if (s === 0) {
        r = g = b = l;
    } else {
        const hue2rgb = (p: number, q: number, t: number) => {
            if (t < 0) t += 1;
            if (t > 1) t -= 1;
            if (t < 1 / 6) return p + (q - p) * 6 * t;
            if (t < 1 / 2) return q;
            if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
            return p;
        };

        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        r = hue2rgb(p, q, h + 1 / 3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1 / 3);
    }

    return [r, g, b];
}

function generateRandomColor(): Color3 {
    return hslToRgb(Math.random(), 0.9, 0.55);
}

export default FluidCanvas2D;
