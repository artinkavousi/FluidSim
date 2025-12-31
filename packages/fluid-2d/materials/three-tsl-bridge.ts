/**
 * @package fluid-2d/materials
 * Three.js TSL Bridge — Wrap native Three.js TSL functions as MaterialNodeDefinitions
 * 
 * This module bridges Three.js's native TSL color/utility functions
 * with FluidStudio's MaterialNodeDefinition system for visual editor compatibility.
 */

import {
    vec3,
    vec4,
    float,
    mix,
    dot,
    abs,
    max,
    Fn,
} from 'three/tsl';
import type { MaterialNodeDefinition, ShaderNodeObject } from './types';
import { registerMaterialNode } from './MaterialNodeRegistry';

// ============================================
// Color Adjustment Nodes (from Three.js ColorAdjustment.js)
// ============================================

/**
 * Luminance calculation using standard Rec. 709 coefficients
 */
const luminanceCoeffs = vec3(0.2126, 0.7152, 0.0722);

const luminanceTSL = (color: ShaderNodeObject) => dot(color, luminanceCoeffs);

export const luminanceNode: MaterialNodeDefinition = {
    id: 'luminance',
    label: 'Luminance',
    category: 'color',
    gpuCost: 1,

    inputs: [
        { id: 'color', label: 'Color', type: 'color' },
    ],
    outputs: [
        { id: 'value', label: 'Value', type: 'float' },
    ],
    params: {},

    build: (inputs, _params, _context) => {
        const color = inputs.color ?? vec3(0, 0, 0);
        return { value: luminanceTSL(color.xyz) };
    },

    documentation: 'Computes luminance (perceived brightness) from an RGB color using Rec. 709 coefficients.',
};

export const saturationNode: MaterialNodeDefinition = {
    id: 'saturation',
    label: 'Saturation',
    category: 'color',
    gpuCost: 1,

    inputs: [
        { id: 'color', label: 'Color', type: 'color' },
    ],
    outputs: [
        { id: 'color', label: 'Color', type: 'color' },
    ],
    params: {
        amount: {
            label: 'Amount',
            type: 'float',
            default: 1.0,
            min: 0,
            max: 3,
            step: 0.01,
        },
    },

    build: (inputs, params, _context) => {
        const color = inputs.color ?? vec3(1, 1, 1);
        const rgb = color.xyz ?? color;
        const lum = luminanceTSL(rgb);
        // mix(grayscale, color, amount) where amount=1 is original, amount=0 is grayscale
        const result = mix(vec3(lum, lum, lum), rgb, params.amount);
        return { color: vec4(result, float(1.0)) };
    },

    documentation: 'Adjusts color saturation. Amount > 1 super-saturates, < 1 desaturates, = 0 is grayscale.',
};

export const vibranceNode: MaterialNodeDefinition = {
    id: 'vibrance',
    label: 'Vibrance',
    category: 'color',
    gpuCost: 2,

    inputs: [
        { id: 'color', label: 'Color', type: 'color' },
    ],
    outputs: [
        { id: 'color', label: 'Color', type: 'color' },
    ],
    params: {
        amount: {
            label: 'Amount',
            type: 'float',
            default: 1.0,
            min: 0,
            max: 2,
            step: 0.01,
        },
    },

    build: (inputs, params, _context) => {
        const color = inputs.color ?? vec3(1, 1, 1);
        const rgb = color.xyz ?? color;

        // Vibrance: boost less-saturated colors more than already-saturated ones
        const avg = rgb.x.add(rgb.y).add(rgb.z).div(3.0);
        const mx = max(rgb.x, max(rgb.y, rgb.z));
        const amt = mx.sub(avg).mul(params.amount).mul(-3.0);
        const result = mix(rgb, vec3(mx, mx, mx), amt);

        return { color: vec4(result, float(1.0)) };
    },

    documentation: 'Selectively enhances less-saturated colors for a more natural look than uniform saturation.',
};

export const grayscaleNode: MaterialNodeDefinition = {
    id: 'grayscale',
    label: 'Grayscale',
    category: 'color',
    gpuCost: 1,

    inputs: [
        { id: 'color', label: 'Color', type: 'color' },
    ],
    outputs: [
        { id: 'color', label: 'Color', type: 'color' },
    ],
    params: {
        mix: {
            label: 'Mix',
            type: 'float',
            default: 1.0,
            min: 0,
            max: 1,
            step: 0.01,
        },
    },

    build: (inputs, params, _context) => {
        const color = inputs.color ?? vec3(1, 1, 1);
        const rgb = color.xyz ?? color;
        const lum = luminanceTSL(rgb);
        const gray = vec3(lum, lum, lum);
        const result = mix(rgb, gray, params.mix);
        return { color: vec4(result, float(1.0)) };
    },

    documentation: 'Converts color to grayscale with adjustable mix amount.',
};

// ============================================
// Utility Nodes
// ============================================

export const remapNode: MaterialNodeDefinition = {
    id: 'remap',
    label: 'Remap',
    category: 'transform',
    gpuCost: 1,

    inputs: [
        { id: 'value', label: 'Value', type: 'float' },
    ],
    outputs: [
        { id: 'value', label: 'Value', type: 'float' },
    ],
    params: {
        inMin: { label: 'In Min', type: 'float', default: 0, min: -10, max: 10 },
        inMax: { label: 'In Max', type: 'float', default: 1, min: -10, max: 10 },
        outMin: { label: 'Out Min', type: 'float', default: 0, min: -10, max: 10 },
        outMax: { label: 'Out Max', type: 'float', default: 1, min: -10, max: 10 },
    },

    build: (inputs, params, _context) => {
        const value = inputs.value ?? float(0);
        // Remap: (value - inMin) / (inMax - inMin) * (outMax - outMin) + outMin
        const inRange = params.inMax.sub(params.inMin);
        const outRange = params.outMax.sub(params.outMin);
        const normalized = value.sub(params.inMin).div(inRange.add(0.0001));
        const result = normalized.mul(outRange).add(params.outMin);
        return { value: result };
    },

    documentation: 'Remaps a value from one range to another.',
};

export const contrastNode: MaterialNodeDefinition = {
    id: 'contrast',
    label: 'Contrast',
    category: 'color',
    gpuCost: 1,

    inputs: [
        { id: 'color', label: 'Color', type: 'color' },
    ],
    outputs: [
        { id: 'color', label: 'Color', type: 'color' },
    ],
    params: {
        amount: {
            label: 'Amount',
            type: 'float',
            default: 1.0,
            min: 0,
            max: 3,
            step: 0.01,
        },
    },

    build: (inputs, params, _context) => {
        const color = inputs.color ?? vec3(0.5, 0.5, 0.5);
        const rgb = color.xyz ?? color;
        // Contrast: (color - 0.5) * amount + 0.5
        const mid = vec3(0.5, 0.5, 0.5);
        const result = rgb.sub(mid).mul(params.amount).add(mid).clamp(0, 1);
        return { color: vec4(result, float(1.0)) };
    },

    documentation: 'Adjusts contrast around the midpoint (0.5). Values > 1 increase contrast.',
};

export const brightnessNode: MaterialNodeDefinition = {
    id: 'brightness',
    label: 'Brightness',
    category: 'color',
    gpuCost: 1,

    inputs: [
        { id: 'color', label: 'Color', type: 'color' },
    ],
    outputs: [
        { id: 'color', label: 'Color', type: 'color' },
    ],
    params: {
        amount: {
            label: 'Amount',
            type: 'float',
            default: 1.0,
            min: 0,
            max: 3,
            step: 0.01,
        },
    },

    build: (inputs, params, _context) => {
        const color = inputs.color ?? vec3(0.5, 0.5, 0.5);
        const rgb = color.xyz ?? color;
        const result = rgb.mul(params.amount).clamp(0, 1);
        return { color: vec4(result, float(1.0)) };
    },

    documentation: 'Multiplies color values for brightness adjustment.',
};

// ============================================
// Oscillator Nodes (from Three.js Oscillators.js)
// ============================================

export const oscSineNode: MaterialNodeDefinition = {
    id: 'oscSine',
    label: 'Oscillator (Sine)',
    category: 'transform',
    gpuCost: 1,

    inputs: [
        { id: 'time', label: 'Time', type: 'float' },
    ],
    outputs: [
        { id: 'value', label: 'Value', type: 'float' },
    ],
    params: {
        frequency: { label: 'Frequency', type: 'float', default: 1, min: 0.01, max: 100 },
        amplitude: { label: 'Amplitude', type: 'float', default: 0.5, min: 0, max: 10 },
        offset: { label: 'Offset', type: 'float', default: 0.5, min: -10, max: 10 },
    },

    build: (inputs, params, context) => {
        const t = inputs.time ?? float(context.time);
        // sin(t * freq * 2π) * amp + offset
        const result = t.mul(params.frequency).mul(6.28318).sin().mul(params.amplitude).add(params.offset);
        return { value: result };
    },

    documentation: 'Generates a sine wave oscillation. Output ranges from (offset - amplitude) to (offset + amplitude).',
};

export const oscTriangleNode: MaterialNodeDefinition = {
    id: 'oscTriangle',
    label: 'Oscillator (Triangle)',
    category: 'transform',
    gpuCost: 1,

    inputs: [
        { id: 'time', label: 'Time', type: 'float' },
    ],
    outputs: [
        { id: 'value', label: 'Value', type: 'float' },
    ],
    params: {
        frequency: { label: 'Frequency', type: 'float', default: 1, min: 0.01, max: 100 },
        amplitude: { label: 'Amplitude', type: 'float', default: 0.5, min: 0, max: 10 },
        offset: { label: 'Offset', type: 'float', default: 0.5, min: -10, max: 10 },
    },

    build: (inputs, params, context) => {
        const t = inputs.time ?? float(context.time);
        // Triangle wave: 2 * abs(2 * fract(t * freq) - 1) - 1
        const phase = t.mul(params.frequency).fract();
        const triangle = abs(phase.mul(2).sub(1)).mul(2).sub(1);
        const result = triangle.mul(params.amplitude).add(params.offset);
        return { value: result };
    },

    documentation: 'Generates a triangle wave oscillation.',
};

// ============================================
// Auto-register all bridge nodes
// ============================================

const bridgeNodes: MaterialNodeDefinition[] = [
    luminanceNode,
    saturationNode,
    vibranceNode,
    grayscaleNode,
    remapNode,
    contrastNode,
    brightnessNode,
    oscSineNode,
    oscTriangleNode,
];

bridgeNodes.forEach(registerMaterialNode);

// Export for direct access
export const threeTslBridgeNodes = bridgeNodes;
