/**
 * @package fluid-2d/three-tsl/utils
 * Animation utilities — oscillators, timers, and noise
 */

import {
    Fn,
    float,
    vec2,
    vec3,
    sin,
    cos,
    abs,
    fract,
    floor,
    dot,
    mix,
    mod,
} from 'three/tsl';

// TSL nodes use generic types - use any for flexibility
type TSLNode = any;

// ============================================
// Oscillators (from Three.js Oscillators.js pattern)
// ============================================

/**
 * Sine wave oscillator (0 to 1 range)
 * @param t - Time or phase input
 */
export const oscSine = Fn(([t]: [TSLNode]) => {
    return sin(t.mul(6.28318)).mul(0.5).add(0.5);
});

/**
 * Cosine wave oscillator (0 to 1 range)
 */
export const oscCosine = Fn(([t]: [TSLNode]) => {
    return cos(t.mul(6.28318)).mul(0.5).add(0.5);
});

/**
 * Triangle wave oscillator (0 to 1 range)
 */
export const oscTriangle = Fn(([t]: [TSLNode]) => {
    const phase = fract(t);
    return abs(phase.mul(2).sub(1));
});

/**
 * Sawtooth wave oscillator (0 to 1 range)
 */
export const oscSawtooth = Fn(([t]: [TSLNode]) => {
    return fract(t);
});

/**
 * Square wave oscillator (0 or 1)
 */
export const oscSquare = Fn(([t]: [TSLNode]) => {
    return floor(fract(t).mul(2));
});

/**
 * Pulse wave with adjustable duty cycle
 * @param t - Time input
 * @param duty - Duty cycle (0-1, default 0.5)
 */
export const oscPulse = Fn(([t, duty = float(0.5)]: [TSLNode, TSLNode?]) => {
    const phase = fract(t);
    return phase.lessThan(duty).toFloat();
});

// ============================================
// Noise Functions
// ============================================

/**
 * Simple 2D hash-based pseudo-noise
 */
export const hash21 = Fn(([p]: [TSLNode]) => {
    const h = dot(p, vec2(127.1, 311.7));
    return fract(sin(h).mul(43758.5453));
});

/**
 * 2D value noise
 */
export const noise2D = Fn(([p]: [TSLNode]) => {
    const i = floor(p);
    const f = fract(p);

    // Smooth interpolation
    const u = f.mul(f).mul(float(3).sub(f.mul(2)));

    // Hash corners
    const a = hash21([i]);
    const b = hash21([i.add(vec2(1, 0))]);
    const c = hash21([i.add(vec2(0, 1))]);
    const d = hash21([i.add(vec2(1, 1))]);

    // Bilinear interpolation
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
});

/**
 * FBM (Fractal Brownian Motion) noise with adjustable octaves
 * Note: This is a simplified 2-octave version for performance
 */
export const fbm2 = Fn(([p]: [TSLNode]) => {
    const n1 = noise2D([p]);
    const n2 = noise2D([p.mul(2)]).mul(0.5);
    return n1.add(n2).div(1.5);
});

/**
 * Simplex-based gradient for animations
 */
export const animGradient = Fn(([uv, time]: [TSLNode, TSLNode]) => {
    const p = uv.add(vec2(time.mul(0.1), time.mul(0.07)));
    return noise2D([p]);
});

// ============================================
// Timing Utilities
// ============================================

/**
 * Create a ping-pong animation (0 → 1 → 0)
 */
export const pingPong = Fn(([t]: [TSLNode]) => {
    const phase = fract(t);
    return abs(phase.mul(2).sub(1));
});

/**
 * Ease-in-out (smoothstep-based)
 */
export const easeInOut = Fn(([t]: [TSLNode]) => {
    return t.mul(t).mul(float(3).sub(t.mul(2)));
});

/**
 * Ease-in (quadratic)
 */
export const easeIn = Fn(([t]: [TSLNode]) => {
    return t.mul(t);
});

/**
 * Ease-out (inverse quadratic)
 */
export const easeOut = Fn(([t]: [TSLNode]) => {
    return float(1).sub(float(1).sub(t).mul(float(1).sub(t)));
});

// ============================================
// Export all
// ============================================

export const AnimUtils = {
    oscSine,
    oscCosine,
    oscTriangle,
    oscSawtooth,
    oscSquare,
    oscPulse,
    hash21,
    noise2D,
    fbm2,
    animGradient,
    pingPong,
    easeInOut,
    easeIn,
    easeOut,
};
