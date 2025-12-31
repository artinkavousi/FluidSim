/**
 * @package fluid-2d/postfx/effects
 * Sharpen Effect Definition — Unsharp mask sharpening
 */

import { Fn, texture, uv, vec2, vec3, vec4, float, clamp, uniform } from 'three/tsl';
import { PostEffectDefinition, registerEffect } from '../types';

export const sharpenEffect: PostEffectDefinition = {
    id: 'sharpen',
    label: 'Sharpen',
    category: 'stylize',
    gpuCost: 3,
    params: {
        amount: {
            label: 'Amount',
            type: 'float',
            default: 0.5,
            min: 0,
            max: 2,
            step: 0.01,
        },
        radius: {
            label: 'Radius',
            type: 'float',
            default: 1.0,
            min: 0.5,
            max: 3,
            step: 0.1,
        },
    },
    build: (input, uniforms, context) => {
        const amount = uniforms.amount ?? uniform(0.5);
        const radius = uniforms.radius ?? uniform(1.0);

        // Unsharp mask: sharpen by subtracting blurred version from original
        return Fn(() => {
            const texelSize = vec2(1.0).div(vec2(
                float(context.resolution.width),
                float(context.resolution.height)
            ));
            const offset = texelSize.mul(radius);

            const center = (input as any).rgb;

            // Sample 4 neighbors
            const left = texture(input as any, uv().sub(vec2(offset.x, float(0)))).rgb;
            const right = texture(input as any, uv().add(vec2(offset.x, float(0)))).rgb;
            const top = texture(input as any, uv().sub(vec2(float(0), offset.y))).rgb;
            const bottom = texture(input as any, uv().add(vec2(float(0), offset.y))).rgb;

            // Average of neighbors (low-pass)
            const neighbors = left.add(right).add(top).add(bottom).div(float(4.0));

            // High-frequency detail = original - blurred
            const highFreq = center.sub(neighbors);

            // Add back scaled high-frequency for sharpening
            const sharpened = center.add(highFreq.mul(amount));

            // Clamp to valid range
            return vec4(clamp(sharpened, vec3(0, 0, 0), vec3(1, 1, 1)), (input as any).a);
        })();
    },
};

// Auto-register on import
registerEffect(sharpenEffect);
