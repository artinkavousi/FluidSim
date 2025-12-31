/**
 * @package fluid-2d/postfx/effects
 * Film Grain Effect Definition
 */

import { PostEffectDefinition, registerEffect } from '../types';

export const grainEffect: PostEffectDefinition = {
    id: 'grain',
    label: 'Film Grain',
    category: 'stylize',
    gpuCost: 1,
    params: {
        intensity: {
            label: 'Intensity',
            type: 'float',
            default: 0.0,
            min: 0,
            max: 1,
            step: 0.01,
        },
    },
    build: (input, _uniforms, _context) => {
        // Film grain is handled by film() in PostFXPipeline2D
        // This definition is for UI metadata
        return input;
    },
};

// Auto-register on import
registerEffect(grainEffect);
