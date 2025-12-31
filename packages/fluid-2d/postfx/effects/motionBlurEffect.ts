/**
 * @package fluid-2d/postfx/effects
 * Motion Blur Effect Definition — Velocity-based per-pixel blur
 */

import { Fn, texture, uv, vec4, float, Loop, int, uniform } from 'three/tsl';
import { PostEffectDefinition, registerEffect } from '../types';

export const motionBlurEffect: PostEffectDefinition = {
    id: 'motionBlur',
    label: 'Motion Blur',
    category: 'blur',
    needsMRT: 'velocity',
    allocatesRT: false,
    gpuCost: 5,
    params: {
        strength: {
            label: 'Strength',
            type: 'float',
            default: 0.5,
            min: 0,
            max: 2,
            step: 0.01,
        },
        samples: {
            label: 'Samples',
            type: 'int',
            default: 8,
            min: 2,
            max: 16,
            step: 1,
        },
    },
    build: (input, uniforms, context) => {
        const strength = uniforms.strength ?? uniform(0.5);
        const samples = uniforms.samples ?? uniform(8);

        // If no velocity texture available, return input unchanged
        if (!context.velocityTexture) {
            return input;
        }

        const velocityTex = context.velocityTexture;

        return Fn(() => {
            // Sample velocity at current UV
            const vel = texture(velocityTex as any, uv()).rg.mul(strength);

            // Accumulate samples along velocity direction
            const result = vec4(0, 0, 0, 0).toVar();
            const sampleCount = int(samples).toVar();

            Loop({ start: int(0), end: sampleCount, type: 'int', condition: '<' }, ({ i }) => {
                // t goes from -0.5 to 0.5
                const t = float(i).div(float(sampleCount)).sub(float(0.5));
                const offset = vel.mul(t);
                const sampleUv = uv().add(offset);

                result.addAssign(texture(input as any, sampleUv));
            });

            return result.div(float(samples));
        })();
    },
};

// Auto-register on import
registerEffect(motionBlurEffect);
