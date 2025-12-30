/**
 * @package fluid-2d/core
 * FieldRegistry — Centralized management of simulation fields (textures)
 * 
 * This system manages the lifecycle and access patterns for all simulation fields,
 * including ping-pong buffers, resize behavior, and debug visualization settings.
 */

import * as THREE from 'three/webgpu';
import { PingPongTexture, SingleTexture } from './PingPongBuffer';

/**
 * Debug visualization settings for a field
 */
export interface FieldDebugSettings {
    /** How to map the field values to colors */
    colorMap: 'magnitude' | 'signed' | 'heatmap' | 'rgb';
    /** Scale factor for visualization */
    scale: number;
    /** Bias added before visualization */
    bias: number;
}

/**
 * Definition for a simulation field
 */
export interface FieldDefinition {
    /** Unique identifier */
    id: string;
    /** Human-readable label for UI */
    label: string;

    /** Size source determines how dimensions are calculated */
    sizeSource: 'grid' | 'dye' | 'custom';
    /** Custom size (only used if sizeSource === 'custom') */
    customSize?: { width: number; height: number };

    /** Texture format */
    format: 'rgba16float' | 'rgba32float' | 'r16float' | 'rg16float';

    /** Whether this field uses ping-pong (double buffering) */
    pingPong: boolean;

    /** Optional debug visualization settings */
    debug?: FieldDebugSettings;

    /** Description of what this field stores */
    description?: string;
}

/**
 * FieldRegistry manages simulation field textures
 */
export class FieldRegistry {
    private fields: Map<string, FieldDefinition> = new Map();
    private textures: Map<string, PingPongTexture | SingleTexture> = new Map();
    private pingPongStates: Map<string, boolean> = new Map();

    private gridSize: number;
    private dyeSize: number;

    constructor(gridSize: number, dyeSize: number) {
        this.gridSize = gridSize;
        this.dyeSize = dyeSize;
    }

    /**
     * Register a field definition and create its texture(s)
     */
    register(def: FieldDefinition): void {
        if (this.fields.has(def.id)) {
            console.warn(`FieldRegistry: Field "${def.id}" already registered, skipping`);
            return;
        }

        this.fields.set(def.id, def);
        this.createTexture(def);

        if (def.pingPong) {
            this.pingPongStates.set(def.id, true); // A is initial read
        }
    }

    /**
     * Register multiple fields at once
     */
    registerAll(defs: FieldDefinition[]): void {
        for (const def of defs) {
            this.register(def);
        }
    }

    /**
     * Create the texture(s) for a field definition
     */
    private createTexture(def: FieldDefinition): void {
        const size = this.getSize(def);

        if (def.pingPong) {
            const tex = new PingPongTexture(size.width, size.height);
            this.textures.set(def.id, tex);
        } else {
            const tex = new SingleTexture(size.width, size.height);
            this.textures.set(def.id, tex);
        }
    }

    /**
     * Get the size for a field based on its sizeSource
     */
    private getSize(def: FieldDefinition): { width: number; height: number } {
        switch (def.sizeSource) {
            case 'grid':
                return { width: this.gridSize, height: this.gridSize };
            case 'dye':
                return { width: this.dyeSize, height: this.dyeSize };
            case 'custom':
                if (!def.customSize) {
                    throw new Error(`Field "${def.id}" has sizeSource 'custom' but no customSize`);
                }
                return def.customSize;
            default:
                throw new Error(`Unknown sizeSource: ${def.sizeSource}`);
        }
    }

    /**
     * Get the current read texture for a field
     */
    getRead(id: string): THREE.StorageTexture {
        const tex = this.textures.get(id);
        if (!tex) {
            throw new Error(`FieldRegistry: Field "${id}" not found`);
        }

        if (tex instanceof PingPongTexture) {
            const isA = this.pingPongStates.get(id) ?? true;
            return isA ? tex.a : tex.b;
        }

        return tex.texture;
    }

    /**
     * Get the current write texture for a field (only valid for ping-pong fields)
     */
    getWrite(id: string): THREE.StorageTexture {
        const tex = this.textures.get(id);
        if (!tex) {
            throw new Error(`FieldRegistry: Field "${id}" not found`);
        }

        if (tex instanceof PingPongTexture) {
            const isA = this.pingPongStates.get(id) ?? true;
            return isA ? tex.b : tex.a;
        }

        // For non-ping-pong, read and write are the same
        return tex.texture;
    }

    /**
     * Get both textures for a ping-pong field
     */
    getBoth(id: string): { a: THREE.StorageTexture; b: THREE.StorageTexture } {
        const tex = this.textures.get(id);
        if (!tex) {
            throw new Error(`FieldRegistry: Field "${id}" not found`);
        }

        if (tex instanceof PingPongTexture) {
            return { a: tex.a, b: tex.b };
        }

        throw new Error(`Field "${id}" is not a ping-pong field`);
    }

    /**
     * Swap the ping-pong state for a field (call after write)
     */
    swap(id: string): void {
        const current = this.pingPongStates.get(id);
        if (current !== undefined) {
            this.pingPongStates.set(id, !current);
        }
    }

    /**
     * Get the current ping-pong state (true = A is read, false = B is read)
     */
    getState(id: string): boolean {
        return this.pingPongStates.get(id) ?? true;
    }

    /**
     * Check if a field is registered
     */
    has(id: string): boolean {
        return this.fields.has(id);
    }

    /**
     * Get a field definition
     */
    getDefinition(id: string): FieldDefinition | undefined {
        return this.fields.get(id);
    }

    /**
     * Get all field definitions
     */
    getAllDefinitions(): FieldDefinition[] {
        return Array.from(this.fields.values());
    }

    /**
     * Get all field IDs
     */
    getFieldIds(): string[] {
        return Array.from(this.fields.keys());
    }

    /**
     * Get current grid size
     */
    getGridSize(): number {
        return this.gridSize;
    }

    /**
     * Get current dye size
     */
    getDyeSize(): number {
        return this.dyeSize;
    }

    /**
     * Resize all fields (recreates textures)
     */
    resize(gridSize: number, dyeSize: number): void {
        this.gridSize = gridSize;
        this.dyeSize = dyeSize;

        for (const [id, def] of this.fields) {
            // Dispose old texture
            const oldTex = this.textures.get(id);
            if (oldTex instanceof PingPongTexture) {
                oldTex.a.dispose();
                oldTex.b.dispose();
            } else if (oldTex) {
                oldTex.texture.dispose();
            }

            // Create new texture
            this.createTexture(def);

            // Reset ping-pong state
            if (def.pingPong) {
                this.pingPongStates.set(id, true);
            }
        }
    }

    /**
     * Dispose all textures
     */
    dispose(): void {
        for (const tex of this.textures.values()) {
            if (tex instanceof PingPongTexture) {
                tex.a.dispose();
                tex.b.dispose();
            } else {
                tex.texture.dispose();
            }
        }
        this.textures.clear();
        this.fields.clear();
        this.pingPongStates.clear();
    }
}

// ============================================
// Standard Field Definitions
// ============================================

/**
 * Standard fluid simulation fields
 */
export const standardFields: FieldDefinition[] = [
    {
        id: 'velocity',
        label: 'Velocity',
        sizeSource: 'grid',
        format: 'rgba16float',
        pingPong: true,
        debug: { colorMap: 'signed', scale: 10, bias: 0.5 },
        description: 'Velocity field (XY in RG channels)',
    },
    {
        id: 'dye',
        label: 'Dye',
        sizeSource: 'dye',
        format: 'rgba16float',
        pingPong: true,
        debug: { colorMap: 'rgb', scale: 1, bias: 0 },
        description: 'Dye/color field (RGBA)',
    },
    {
        id: 'pressure',
        label: 'Pressure',
        sizeSource: 'grid',
        format: 'rgba16float',
        pingPong: true,
        debug: { colorMap: 'signed', scale: 5, bias: 0.5 },
        description: 'Pressure field (scalar in R channel)',
    },
    {
        id: 'divergence',
        label: 'Divergence',
        sizeSource: 'grid',
        format: 'rgba16float',
        pingPong: false,
        debug: { colorMap: 'signed', scale: 20, bias: 0.5 },
        description: 'Divergence of velocity field',
    },
    {
        id: 'vorticity',
        label: 'Vorticity',
        sizeSource: 'grid',
        format: 'rgba16float',
        pingPong: false,
        debug: { colorMap: 'signed', scale: 10, bias: 0.5 },
        description: 'Curl of velocity field',
    },
    {
        id: 'velocityTemp',
        label: 'Velocity Temp',
        sizeSource: 'grid',
        format: 'rgba16float',
        pingPong: false,
        description: 'Temporary velocity buffer for MacCormack',
    },
    {
        id: 'dyeTemp',
        label: 'Dye Temp',
        sizeSource: 'dye',
        format: 'rgba16float',
        pingPong: false,
        description: 'Temporary dye buffer for MacCormack',
    },
];

/**
 * Create a field registry with standard fluid simulation fields
 */
export function createStandardFieldRegistry(
    gridSize: number,
    dyeSize: number
): FieldRegistry {
    const registry = new FieldRegistry(gridSize, dyeSize);
    registry.registerAll(standardFields);
    return registry;
}
