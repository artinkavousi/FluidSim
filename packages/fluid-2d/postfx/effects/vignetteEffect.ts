/**
 * @package fluid-2d/postfx/effects
 * Vignette Effect Definition
 */

import { PostEffectDefinition, registerEffect } from '../types';

export const vignetteEffect: PostEffectDefinition = {
    id: 'vignette',
    label: 'Vignette',
    category: 'stylize',
    gpuCost: 1,
    params: {
        intensity: {
            label: 'Intensity',
            type: 'float',
            default: 0.0,
            min: 0,
            max: 2,
            step: 0.01,
        },
        radius: {
            label: 'Radius',
            type: 'float',
            default: 0.8,
            min: 0,
            max: 1,
            step: 0.01,
        },
        softness: {
            label: 'Softness',
            type: 'float',
            default: 0.3,
            min: 0,
            max: 1,
            step: 0.01,
        },
    },
    build: (input, _uniforms, _context) => {
        // Vignette is handled by createVignetteNode in PostFXPipeline2D
        // This definition is for UI metadata
        return input;
    },
};

// Auto-register on import
registerEffect(vignetteEffect);
