/**
 * @package fluid-2d/postfx/effects
 * Grading Effect Definition — Brightness, contrast, saturation
 */

import { PostEffectDefinition, registerEffect } from '../types';

export const gradingEffect: PostEffectDefinition = {
    id: 'grading',
    label: 'Color Grading',
    category: 'color',
    gpuCost: 1,
    params: {
        brightness: {
            label: 'Brightness',
            type: 'float',
            default: 1.0,
            min: 0,
            max: 3,
            step: 0.01,
        },
        contrast: {
            label: 'Contrast',
            type: 'float',
            default: 1.0,
            min: 0,
            max: 3,
            step: 0.01,
        },
        saturation: {
            label: 'Saturation',
            type: 'float',
            default: 1.0,
            min: 0,
            max: 3,
            step: 0.01,
        },
    },
    build: (input, _uniforms, _context) => {
        // Grading is handled by createColorGradingNode in PostFXPipeline2D
        // This definition is for UI metadata
        return input;
    },
};

// Auto-register on import
registerEffect(gradingEffect);
