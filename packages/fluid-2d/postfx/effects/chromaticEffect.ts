/**
 * @package fluid-2d/postfx/effects
 * Chromatic Aberration Effect Definition
 */

import { PostEffectDefinition, registerEffect } from '../types';

export const chromaticEffect: PostEffectDefinition = {
    id: 'chromatic',
    label: 'Chromatic Aberration',
    category: 'distort',
    gpuCost: 2,
    params: {
        strength: {
            label: 'Strength',
            type: 'float',
            default: 0.0,
            min: 0,
            max: 0.1,
            step: 0.001,
        },
    },
    build: (input, _uniforms, _context) => {
        // Chromatic aberration is handled by chromaticAberration() in PostFXPipeline2D
        // This definition is for UI metadata
        return input;
    },
};

// Auto-register on import
registerEffect(chromaticEffect);
