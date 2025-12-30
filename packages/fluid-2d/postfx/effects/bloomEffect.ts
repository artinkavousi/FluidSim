/**
 * @package fluid-2d/postfx/effects
 * Bloom Effect Definition
 */

import { PostEffectDefinition, registerEffect } from '../types';

export const bloomEffect: PostEffectDefinition = {
    id: 'bloom',
    label: 'Bloom',
    category: 'stylize',
    allocatesRT: true,
    gpuCost: 6,
    params: {
        intensity: {
            label: 'Intensity',
            type: 'float',
            default: 0.3,
            min: 0,
            max: 3,
            step: 0.01,
        },
        threshold: {
            label: 'Threshold',
            type: 'float',
            default: 0.6,
            min: 0,
            max: 1,
            step: 0.01,
        },
        radius: {
            label: 'Radius',
            type: 'float',
            default: 1.0,
            min: 0.5,
            max: 4,
            step: 0.1,
        },
    },
    build: (input, uniforms, _context) => {
        // Bloom is handled specially in PostFXPipeline2D due to BloomNode requirements
        // This definition is used for UI metadata and effect ordering
        return input;
    },
};

// Auto-register on import
registerEffect(bloomEffect);
