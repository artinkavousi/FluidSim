/**
 * @package fluid-2d/three-tsl/color
 * ColorEffects — Local TSL color effect functions adapted from Three.js
 * 
 * These are lightweight, standalone color processing functions
 * that work with Three.js TSL and can be used in material nodes.
 */

import {
    Fn,
    vec3,
    vec4,
    float,
    dot,
    min,
    max,
    mix,
    abs,
    pow,
    clamp,
} from 'three/tsl';
// TSL nodes use generic types - use any for flexibility
type TSLNode = any;

// ============================================
// Luminance Coefficients
// ============================================

/** Rec. 709 luminance coefficients */
export const REC709 = vec3(0.2126, 0.7152, 0.0722);

/** Rec. 601 luminance coefficients (NTSC) */
export const REC601 = vec3(0.299, 0.587, 0.114);

// ============================================
// Core Color Functions
// ============================================

/**
 * Calculate luminance from RGB using Rec. 709 coefficients
 */
export const luminance = Fn(([color]: [TSLNode]) => {
    return dot(color.xyz ?? color, REC709);
});

/**
 * Calculate luminance from RGB using Rec. 601 coefficients
 */
export const luminance601 = Fn(([color]: [TSLNode]) => {
    return dot(color.xyz ?? color, REC601);
});

/**
 * Adjust saturation (0 = grayscale, 1 = original, >1 = super-saturated)
 */
export const saturation = Fn(([color, amount = float(1)]: [TSLNode, TSLNode?]) => {
    const rgb = color.xyz ?? color;
    const lum = dot(rgb, REC709);
    const gray = vec3(lum, lum, lum);
    return vec4(mix(gray, rgb, amount), float(1.0));
});

/**
 * Vibrance — selective saturation boost for less-saturated colors
 */
export const vibrance = Fn(([color, amount = float(1)]: [TSLNode, TSLNode?]) => {
    const rgb = color.xyz ?? color;
    const avg = rgb.x.add(rgb.y).add(rgb.z).div(3.0);
    const mx = max(rgb.x, max(rgb.y, rgb.z));
    const amt = mx.sub(avg).mul(amount).mul(-3.0);
    return vec4(mix(rgb, vec3(mx, mx, mx), amt), float(1.0));
});

/**
 * Hue rotation in YIQ color space (fast)
 */
export const hueRotate = Fn(([color, angle]: [TSLNode, TSLNode]) => {
    const rgb = color.xyz ?? color;
    const hc = angle.cos();
    const hs = angle.sin();
    const yiqY = dot(rgb, vec3(0.299, 0.587, 0.114));
    const yiqI = dot(rgb, vec3(0.596, -0.274, -0.322));
    const yiqQ = dot(rgb, vec3(0.211, -0.523, 0.312));
    const i2 = yiqI.mul(hc).sub(yiqQ.mul(hs));
    const q2 = yiqI.mul(hs).add(yiqQ.mul(hc));
    return vec4(
        yiqY.add(i2.mul(0.956)).add(q2.mul(0.621)),
        yiqY.sub(i2.mul(0.272)).sub(q2.mul(0.647)),
        yiqY.sub(i2.mul(1.106)).add(q2.mul(1.703)),
        float(1.0)
    );
});

/**
 * Convert RGB to grayscale
 */
export const grayscale = Fn(([color]: [TSLNode]) => {
    const lum = luminance([color]);
    return vec4(lum, lum, lum, float(1.0));
});

// ============================================
// Stylization Effects (from Three.js examples)
// ============================================

/**
 * Sepia tone effect
 * Source: Three.js examples/jsm/tsl/display/Sepia.js
 */
export const sepia = Fn(([color]: [TSLNode]) => {
    const c = color.xyz ?? color;
    return vec4(
        dot(c, vec3(0.393, 0.769, 0.189)),
        dot(c, vec3(0.349, 0.686, 0.168)),
        dot(c, vec3(0.272, 0.534, 0.131)),
        float(1.0)
    );
});

/**
 * Bleach bypass effect — high contrast, desaturated film look
 * Source: Three.js examples/jsm/tsl/display/BleachBypass.js
 */
export const bleach = Fn(([color, opacity = float(1)]: [TSLNode, TSLNode?]) => {
    const base = color;
    const rgb = base.xyz ?? base;
    const lum = dot(rgb, REC709);
    const blend = vec3(lum, lum, lum);

    const L = min(float(1.0), max(float(0.0), float(10.0).mul(lum.sub(0.45))));

    const result1 = blend.mul(rgb).mul(2.0);
    const one = float(1.0);
    const result2 = one.sub(float(2.0).mul(one.sub(blend)).mul(one.sub(rgb)));

    const newColor = mix(result1, result2, L);
    const A2 = opacity;
    const mixRGB = A2.mul(newColor).add(rgb.mul(one.sub(A2)));

    return vec4(mixRGB, float(1.0));
});

// ============================================
// Grading Functions
// ============================================

/**
 * Contrast adjustment (pivot at 0.5)
 */
export const contrast = Fn(([color, amount = float(1)]: [TSLNode, TSLNode?]) => {
    const rgb = color.xyz ?? color;
    const mid = vec3(0.5, 0.5, 0.5);
    const result = rgb.sub(mid).mul(amount).add(mid);
    return vec4(clamp(result, vec3(0), vec3(1)), float(1.0));
});

/**
 * Brightness adjustment (multiply)
 */
export const brightness = Fn(([color, amount = float(1)]: [TSLNode, TSLNode?]) => {
    const rgb = color.xyz ?? color;
    return vec4(clamp(rgb.mul(amount), vec3(0), vec3(1)), float(1.0));
});

/**
 * Gamma correction
 */
export const gamma = Fn(([color, g = float(1)]: [TSLNode, TSLNode?]) => {
    const rgb = color.xyz ?? color;
    const invGamma = float(1).div(g.max(float(0.001)));
    const result = vec3(
        pow(max(rgb.x, float(0)), invGamma),
        pow(max(rgb.y, float(0)), invGamma),
        pow(max(rgb.z, float(0)), invGamma)
    );
    return vec4(result, float(1.0));
});

/**
 * Exposure adjustment (EV stops)
 */
export const exposure = Fn(([color, ev = float(0)]: [TSLNode, TSLNode?]) => {
    const rgb = color.xyz ?? color;
    const mult = pow(float(2), ev);
    return vec4(rgb.mul(mult), float(1.0));
});

/**
 * Posterize — reduce color levels
 */
export const posterize = Fn(([color, levels = float(8)]: [TSLNode, TSLNode?]) => {
    const rgb = color.xyz ?? color;
    const result = rgb.mul(levels).floor().div(levels);
    return vec4(result, float(1.0));
});

/**
 * Invert colors
 */
export const invert = Fn(([color]: [TSLNode]) => {
    const rgb = color.xyz ?? color;
    return vec4(float(1).sub(rgb.x), float(1).sub(rgb.y), float(1).sub(rgb.z), float(1.0));
});

// ============================================
// Blend Modes
// ============================================

/**
 * Normal blend (alpha-based)
 */
export const blendNormal = Fn(([base, blend, opacity = float(1)]: [TSLNode, TSLNode, TSLNode?]) => {
    return vec4(mix(base.xyz, blend.xyz, opacity), float(1.0));
});

/**
 * Additive blend
 */
export const blendAdd = Fn(([base, blend, opacity = float(1)]: [TSLNode, TSLNode, TSLNode?]) => {
    const result = base.xyz.add(blend.xyz.mul(opacity));
    return vec4(clamp(result, vec3(0), vec3(1)), float(1.0));
});

/**
 * Multiply blend
 */
export const blendMultiply = Fn(([base, blend, opacity = float(1)]: [TSLNode, TSLNode, TSLNode?]) => {
    const multiplied = base.xyz.mul(blend.xyz);
    const result = mix(base.xyz, multiplied, opacity);
    return vec4(result, float(1.0));
});

/**
 * Screen blend
 */
export const blendScreen = Fn(([base, blend, opacity = float(1)]: [TSLNode, TSLNode, TSLNode?]) => {
    const one = vec3(1, 1, 1);
    const screened = one.sub(one.sub(base.xyz).mul(one.sub(blend.xyz)));
    const result = mix(base.xyz, screened, opacity);
    return vec4(result, float(1.0));
});

/**
 * Overlay blend
 */
export const blendOverlay = Fn(([base, blend, opacity = float(1)]: [TSLNode, TSLNode, TSLNode?]) => {
    const lum = dot(base.xyz, REC709);
    const dark = base.xyz.mul(blend.xyz).mul(2);
    const light = float(1).sub(float(2).mul(float(1).sub(base.xyz)).mul(float(1).sub(blend.xyz)));
    // Mix based on luminance < 0.5
    const overlayed = mix(light, dark, lum.lessThan(0.5).toFloat());
    const result = mix(base.xyz, overlayed, opacity);
    return vec4(result, float(1.0));
});

// ============================================
// Export all
// ============================================

export const ColorEffects = {
    luminance,
    luminance601,
    saturation,
    vibrance,
    hueRotate,
    grayscale,
    sepia,
    bleach,
    contrast,
    brightness,
    gamma,
    exposure,
    posterize,
    invert,
    blendNormal,
    blendAdd,
    blendMultiply,
    blendScreen,
    blendOverlay,
};
