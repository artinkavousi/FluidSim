/**
 * @package fluid-2d/materials
 * Material Node System — Type definitions for composable TSL material nodes
 * 
 * This module defines the core interfaces for a node-graph-driven material system
 * that integrates with Three.js TSL for real-time shader composition.
 */

import type * as THREE from 'three/webgpu';

// ============================================
// TSL Type Aliases (runtime uses `any` for flexibility)
// ============================================

export type ShaderNodeObject<T = any> = any;
export type UniformNode<T = any> = any;

// ============================================
// Node Categories
// ============================================

export type MaterialNodeCategory =
    | 'input'      // Field samplers (dye, velocity, pressure, temp)
    | 'transform'  // UV transforms, distortion
    | 'color'      // Color operations (ramp, palette, grading)
    | 'shading'    // Normals, fresnel, lighting
    | 'composite'  // Blend modes, masking
    | 'output';    // Final output

// ============================================
// Port Definitions
// ============================================

export type PortType = 'color' | 'float' | 'vec2' | 'vec3' | 'vec4' | 'texture';

export interface MaterialNodePort {
    /** Unique identifier within the node */
    id: string;
    /** Display label for UI */
    label: string;
    /** Data type */
    type: PortType;
    /** Default value if not connected */
    default?: unknown;
}

// ============================================
// Parameter Definitions
// ============================================

export type ParamType = 'float' | 'int' | 'bool' | 'vec2' | 'vec3' | 'color' | 'enum' | 'colorStops' | 'texture';

export interface MaterialNodeParam {
    /** Display label for UI */
    label: string;
    /** Parameter type */
    type: ParamType;
    /** Default value */
    default: unknown;
    /** Enum options (for type='enum') */
    options?: Array<{ label: string; value: string | number }>;
    /** Min value (for numeric types) */
    min?: number;
    /** Max value (for numeric types) */
    max?: number;
    /** Step increment (for numeric types) */
    step?: number;
    /** Unit label (e.g., 'px', '%') */
    unit?: string;
    /** Conditional visibility */
    visible?: (params: Record<string, unknown>) => boolean;
}

// ============================================
// Build Context
// ============================================

export interface MaterialBuildContext {
    /** Dye texture (current read state) */
    dyeTexture: THREE.StorageTexture;
    /** Velocity texture (current read state) */
    velocityTexture: THREE.StorageTexture;
    /** Pressure texture (if available) */
    pressureTexture?: THREE.StorageTexture;
    /** Vorticity texture (if available) */
    vorticityTexture?: THREE.StorageTexture;
    /** Temperature texture (if available) */
    temperatureTexture?: THREE.StorageTexture;
    /** Canvas/texture resolution */
    resolution: { width: number; height: number };
    /** Dye field resolution (may differ from canvas) */
    dyeResolution: { width: number; height: number };
    /** Velocity field resolution */
    velocityResolution: { width: number; height: number };
    /** Current time in seconds */
    time: number;
    /** UV coordinate node (typically from screen position) */
    uvNode: ShaderNodeObject;
}

// ============================================
// Node Definition
// ============================================

export interface MaterialNodeDefinition<TParams extends Record<string, unknown> = Record<string, unknown>> {
    /** Unique identifier (e.g., 'dyeSampler', 'colorRamp') */
    id: string;
    /** Display name for UI */
    label: string;
    /** Category for grouping */
    category: MaterialNodeCategory;

    /** Input ports */
    inputs: MaterialNodePort[];
    /** Output ports */
    outputs: MaterialNodePort[];
    /** Adjustable parameters */
    params: Record<string, MaterialNodeParam>;

    /**
     * Build the TSL node graph for this material node.
     * @param inputs - Connected input values (keyed by port id)
     * @param params - Uniform nodes for parameters (keyed by param id)
     * @param context - Material build context with textures and resolution
     * @returns Output values keyed by output port id
     */
    build: (
        inputs: Record<string, ShaderNodeObject>,
        params: Record<string, UniformNode>,
        context: MaterialBuildContext
    ) => Record<string, ShaderNodeObject>;

    /** Optional icon for visual editor */
    icon?: string;
    /** Approximate GPU cost (1-10) */
    gpuCost?: number;
    /** Documentation string */
    documentation?: string;
}

// ============================================
// Graph Data Structures
// ============================================

export interface MaterialGraphNode {
    /** Unique instance ID */
    id: string;
    /** Node type (MaterialNodeDefinition.id) */
    type: string;
    /** Parameter values */
    params: Record<string, unknown>;
    /** Position in visual editor (optional) */
    position?: { x: number; y: number };
}

export interface MaterialGraphEdge {
    /** Source node and port */
    from: { node: string; port: string };
    /** Target node and port */
    to: { node: string; port: string };
}

export interface MaterialGraphData {
    /** All nodes in the graph */
    nodes: MaterialGraphNode[];
    /** All connections between nodes */
    edges: MaterialGraphEdge[];
    /** ID of the output node (final result) */
    outputNode: string;
}

// ============================================
// Node Metadata (for UI/editor)
// ============================================

export interface MaterialNodeMetadata {
    id: string;
    type: string;
    label: string;
    category: MaterialNodeCategory;
    inputs: MaterialNodePort[];
    outputs: MaterialNodePort[];
    params: Record<string, MaterialNodeParam>;
    position?: { x: number; y: number };
    gpuCost?: number;
}

// ============================================
// Preset V2 Structure
// ============================================

export interface MaterialPresetV2 {
    /** Unique identifier */
    id: string;
    /** Display name */
    name: string;
    /** Description */
    description: string;
    /** Category for browsing */
    category: 'liquid' | 'fire' | 'smoke' | 'abstract' | 'stylized' | 'cinematic';
    /** Thumbnail image path (optional) */
    thumbnail?: string;
    /** The node graph data */
    graph: MaterialGraphData;
    /** Legacy config for backwards compatibility */
    legacyConfig?: Record<string, unknown>;
}
