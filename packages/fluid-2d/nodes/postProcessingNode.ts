/**
 * @package fluid-2d/nodes
 * Post-processing TSL nodes - Vignette, Chromatic Aberration, Bloom
 */

import {
    Fn,
    uniform,
    float,
    vec2,
    vec3,
    vec4,
    length,
    clamp,
    mix,
    smoothstep,
    texture,
    uv,
} from 'three/tsl';
// Note: ShaderNodeObject and UniformNode types are not exported from three/tsl in r182
// Using 'any' for uniforms interface as workaround

// ============================================
// Vignette Effect
// ============================================

export interface VignetteUniforms {
    intensity: any;
    radius: any;
    smoothness: any;
}

/**
 * Create vignette effect node
 * Darkens edges of the screen with a smooth falloff
 */
export function createVignetteNode() {
    const intensity = uniform(0.5);
    const radius = uniform(0.8);
    const smoothness = uniform(0.5);

    const vignetteFn = Fn(([inputColor]: [any]) => {
        const uvCoord = uv();

        // Calculate distance from center
        const center = vec2(0.5, 0.5);
        const dist = length(uvCoord.sub(center)).mul(float(1.414)).div(radius.max(float(1e-3))); // Normalize + user radius

        // Smooth vignette falloff
        const vignette = smoothstep(float(1.0), float(1.0).sub(smoothness), dist);

        // Apply vignette
        const vignetted = inputColor.rgb.mul(mix(float(1.0).sub(intensity), float(1.0), vignette));

        return vec4(vignetted, inputColor.a);
    });

    return {
        apply: vignetteFn,
        uniforms: { intensity, radius, smoothness } as any
    };
}

// ============================================
// Chromatic Aberration Effect
// ============================================

export interface ChromaticAberrationUniforms {
    intensity: any;
}

/**
 * Create chromatic aberration effect node
 * Separates RGB channels based on distance from center
 */
export function createChromaticAberrationNode() {
    const intensity = uniform(0.005);

    const chromaticFn = Fn(([inputTexture]: [any]) => {
        const uvCoord = uv();

        // Direction from center
        const center = vec2(0.5, 0.5);
        const dir = uvCoord.sub(center);

        // Offset for each channel
        const rOffset = uvCoord.add(dir.mul(intensity));
        const gOffset = uvCoord;
        const bOffset = uvCoord.sub(dir.mul(intensity));

        // Sample each channel with offset
        const r = texture(inputTexture, rOffset).r;
        const g = texture(inputTexture, gOffset).g;
        const b = texture(inputTexture, bOffset).b;

        return vec4(r, g, b, float(1.0));
    });

    return {
        apply: chromaticFn,
        uniforms: { intensity } as any
    };
}

// ============================================
// Simple Bloom Effect
// ============================================

export interface BloomUniforms {
    threshold: any;
    intensity: any;
}

/**
 * Create simple bloom effect (single-pass approximation)
 * For full bloom, use Three.js PostProcessing with bloom pass
 */
export function createBloomNode() {
    const threshold = uniform(0.8);
    const intensity = uniform(0.5);

    const bloomFn = Fn(([inputColor]: [any]) => {
        // Extract bright areas
        const luminance = inputColor.r.mul(0.299)
            .add(inputColor.g.mul(0.587))
            .add(inputColor.b.mul(0.114));

        // Soft threshold
        const brightness = smoothstep(threshold.sub(float(0.1)), threshold, luminance);

        // Add bloom contribution
        const bloom = inputColor.rgb.mul(brightness).mul(intensity);
        const result = inputColor.rgb.add(bloom);

        return vec4(result, inputColor.a);
    });

    return {
        apply: bloomFn,
        uniforms: { threshold, intensity } as any
    };
}

// ============================================
// Color Grading
// ============================================

export interface ColorGradingUniforms {
    brightness: any;
    contrast: any;
    saturation: any;
}

/**
 * Create color grading node
 * Adjusts brightness, contrast, and saturation
 */
export function createColorGradingNode() {
    const brightness = uniform(1.0);
    const contrast = uniform(1.0);
    const saturation = uniform(1.0);

    const gradingFn = Fn(([inputColor]: [any]) => {
        let color = inputColor.rgb;

        // Brightness
        color = color.mul(brightness);

        // Contrast (around 0.5 midpoint)
        color = color.sub(0.5).mul(contrast).add(0.5);

        // Saturation
        const gray = color.r.mul(0.299).add(color.g.mul(0.587)).add(color.b.mul(0.114));
        // Avoid mix(vec3, vec3, float) since WGSL doesn't allow implicit scalar->vec promotion.
        const g = vec3(gray, gray, gray);
        color = g.mul(float(1.0).sub(saturation)).add(color.mul(saturation));

        // Clamp to valid range
        color = clamp(color, vec3(0, 0, 0), vec3(1, 1, 1));

        return vec4(color, inputColor.a);
    });

    return {
        apply: gradingFn,
        uniforms: { brightness, contrast, saturation } as any
    };
}
