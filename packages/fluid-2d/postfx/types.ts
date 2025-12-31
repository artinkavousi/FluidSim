/**
 * @package fluid-2d/postfx
 * PostFX Types — Effect definition system for metadata-driven post-processing
 */

import type * as THREE from 'three/webgpu';

// NOTE: three/tsl's exported TypeScript types can vary across Three versions/builds.
// These are metadata-only types for authoring; the runtime pipeline uses Node graphs directly.
export type ShaderNodeObject<T = any> = any;
export type UniformNode<T = any> = any;

/**
 * Parameter definition for a post effect
 */
export interface PostEffectParam {
    label: string;
    type: 'float' | 'int' | 'bool' | 'color';
    default: number | boolean | [number, number, number];
    min?: number;
    max?: number;
    step?: number;
    unit?: string;
    /** Conditional visibility based on other params */
    visible?: (config: Record<string, unknown>) => boolean;
}

/**
 * Post effect definition with metadata for UI generation and pipeline building
 */
export interface PostEffectDefinition {
    /** Unique identifier */
    id: PostEffectId;
    /** Display name for UI */
    label: string;
    /** Category for grouping in UI */
    category: 'color' | 'blur' | 'stylize' | 'distort';

    /** Effect parameters with UI metadata */
    params: Record<string, PostEffectParam>;

    // ============================================
    // Performance hints
    // ============================================

    /** Whether this effect allocates render targets */
    allocatesRT?: boolean;
    /** MRT requirements (velocity/depth/normal textures) */
    needsMRT?: 'velocity' | 'depth' | 'normal';
    /** Approximate GPU cost (1-10 scale) */
    gpuCost?: number;

    // ============================================
    // Build function
    // ============================================

    /**
     * Build the TSL node graph for this effect
     * @param input - The input color node
     * @param uniforms - Uniform nodes keyed by param name
     * @param context - Additional context (resolution, velocity texture, etc.)
     * @returns The output color node
     */
    build: (
        input: ShaderNodeObject<any>,
        uniforms: Record<string, UniformNode<any>>,
        context: PostEffectContext
    ) => ShaderNodeObject<any>;
}

/**
 * Context passed to effect build functions
 */
export interface PostEffectContext {
    /** Canvas/texture resolution */
    resolution: { width: number; height: number };
    /** Velocity texture (if MRT enabled) */
    velocityTexture?: THREE.Texture;
    /** Time in seconds */
    time: number;
}

/**
 * All available post effect IDs
 */
export type PostEffectId =
    | 'grading'
    | 'vignette'
    | 'bloom'
    | 'chromatic'
    | 'rgbShift'
    | 'clarity'
    | 'sharpen'
    | 'grain'
    | 'afterImage'
    | 'trails'
    | 'motionBlur'
    | 'dof';

/**
 * Default effect ordering
 */
export const defaultEffectOrder: PostEffectId[] = [
    'grading',
    'vignette',
    'bloom',
    'chromatic',
    'rgbShift',
    'clarity',
    'sharpen',
    'grain',
    'afterImage',
    'trails',
    'motionBlur',
];

/**
 * Effect registry for runtime lookup
 */
export const effectRegistry = new Map<PostEffectId, PostEffectDefinition>();

/**
 * Register an effect definition
 */
export function registerEffect(effect: PostEffectDefinition): void {
    effectRegistry.set(effect.id, effect);
}

/**
 * Get an effect by ID
 */
export function getEffect(id: PostEffectId): PostEffectDefinition | undefined {
    return effectRegistry.get(id);
}

/**
 * Get all registered effects
 */
export function getAllEffects(): PostEffectDefinition[] {
    return Array.from(effectRegistry.values());
}

/**
 * Get effects by category
 */
export function getEffectsByCategory(category: PostEffectDefinition['category']): PostEffectDefinition[] {
    return getAllEffects().filter(e => e.category === category);
}
