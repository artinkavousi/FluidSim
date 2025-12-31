/**
 * @package fluid-2d/core
 * FieldRegistry — Centralized management of simulation fields (textures)
 * 
 * This system manages the lifecycle and access patterns for all simulation fields,
 * including ping-pong buffers, resize behavior, and debug visualization settings.
 */

import * as THREE from 'three/webgpu';
import { PingPongTexture, SingleTexture } from './PingPongBuffer';

export type FieldFormat = 'rgba16float' | 'rgba32float' | 'r16float' | 'rg16float';
export type FieldMemoryPriority = 'low' | 'medium' | 'high';

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
    format: FieldFormat;

    /** Whether this field uses ping-pong (double buffering) */
    pingPong: boolean;

    /** Optional debug visualization settings */
    debug?: FieldDebugSettings;

    /** Description of what this field stores */
    description?: string;

    /** Optional: resolution scale relative to sizeSource (e.g. 0.5 = half-res) */
    resolutionScale?: number;

    /** Optional: lazy allocation (create textures on first access) */
    lazyAllocation?: boolean;

    /** Optional: memory budgeting hints (not enforced yet) */
    memoryPriority?: FieldMemoryPriority;

    /** Optional: fallback format if primary format is unsupported */
    fallbackFormat?: FieldFormat;

    /** Optional: alias this field to another field's underlying texture(s) */
    aliasOf?: string;
}

export interface FieldRegistryOptions {
    /**
     * Optional format support check.
     * If provided, `fallbackFormat` will be used when `format` is not supported.
     */
    isFormatSupported?: (format: FieldFormat) => boolean;

    /** Optional VRAM budget (rough estimate) */
    memoryBudgetBytes?: number;

    /** Log a warning when the estimated budget is exceeded */
    warnOnBudgetExceeded?: boolean;
}

export interface FieldMemoryStats {
    allocatedBytes: number;
    estimatedBytes: number;
    memoryBudgetBytes?: number;
    overBudgetBytes?: number;
}

/**
 * FieldRegistry manages simulation field textures
 */
export class FieldRegistry {
    private fields: Map<string, FieldDefinition> = new Map();
    private textures: Map<string, PingPongTexture | SingleTexture> = new Map();
    private pingPongStates: Map<string, boolean> = new Map();
    private aliases: Map<string, string> = new Map();

    private gridSize: number;
    private dyeSize: number;
    private isFormatSupported?: (format: FieldFormat) => boolean;
    private memoryBudgetBytes?: number;
    private warnOnBudgetExceeded: boolean;

    constructor(gridSize: number, dyeSize: number, options?: FieldRegistryOptions) {
        this.gridSize = gridSize;
        this.dyeSize = dyeSize;
        this.isFormatSupported = options?.isFormatSupported;
        this.memoryBudgetBytes = options?.memoryBudgetBytes;
        this.warnOnBudgetExceeded = options?.warnOnBudgetExceeded ?? true;
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

        if (def.aliasOf) {
            this.aliases.set(def.id, def.aliasOf);
            return;
        }

        if (!def.lazyAllocation) {
            this.createTexture(def);
        }

        if (def.pingPong) {
            this.pingPongStates.set(def.id, true); // A is initial read
        }

        this.checkMemoryBudget();
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
        const resolvedFormat = this.resolveFormat(def);

        if (def.pingPong) {
            const tex = new PingPongTexture(size.width, size.height);
            this.applyTextureFormat(tex.a, resolvedFormat);
            this.applyTextureFormat(tex.b, resolvedFormat);
            this.textures.set(def.id, tex);
        } else {
            const tex = new SingleTexture(size.width, size.height);
            this.applyTextureFormat(tex.texture, resolvedFormat);
            this.textures.set(def.id, tex);
        }
    }

    private ensureTexture(def: FieldDefinition): void {
        if (this.textures.has(def.id)) return;
        this.createTexture(def);
    }

    private resolveId(id: string): string {
        let current = id;
        const seen = new Set<string>();
        while (this.aliases.has(current)) {
            if (seen.has(current)) {
                throw new Error(`FieldRegistry: Alias cycle detected at "${current}"`);
            }
            seen.add(current);
            current = this.aliases.get(current)!;
        }
        return current;
    }

    private resolveFormat(def: FieldDefinition): FieldFormat {
        const desired = def.format;
        if (!this.isFormatSupported) return desired;
        if (this.isFormatSupported(desired)) return desired;
        if (def.fallbackFormat && this.isFormatSupported(def.fallbackFormat)) {
            return def.fallbackFormat;
        }
        return desired;
    }

    private applyTextureFormat(texture: THREE.Texture, format: FieldFormat): void {
        switch (format) {
            case 'rgba16float':
                texture.format = THREE.RGBAFormat;
                texture.type = THREE.HalfFloatType;
                return;
            case 'rgba32float':
                texture.format = THREE.RGBAFormat;
                texture.type = THREE.FloatType;
                return;
            case 'r16float':
                texture.format = THREE.RedFormat;
                texture.type = THREE.HalfFloatType;
                return;
            case 'rg16float':
                texture.format = THREE.RGFormat;
                texture.type = THREE.HalfFloatType;
                return;
        }
    }

    /**
     * Get the size for a field based on its sizeSource
     */
    private getSize(def: FieldDefinition): { width: number; height: number } {
        const scale = def.resolutionScale ?? 1;
        const scaled = (size: { width: number; height: number }) => {
            const width = Math.max(1, Math.round(size.width * scale));
            const height = Math.max(1, Math.round(size.height * scale));
            return { width, height };
        };

        switch (def.sizeSource) {
            case 'grid':
                return scaled({ width: this.gridSize, height: this.gridSize });
            case 'dye':
                return scaled({ width: this.dyeSize, height: this.dyeSize });
            case 'custom':
                if (!def.customSize) {
                    throw new Error(`Field "${def.id}" has sizeSource 'custom' but no customSize`);
                }
                return scaled(def.customSize);
            default:
                throw new Error(`Unknown sizeSource: ${def.sizeSource}`);
        }
    }

    /**
     * Get the current read texture for a field
     */
    getRead(id: string): THREE.StorageTexture {
        const resolvedId = this.resolveId(id);
        const def = this.fields.get(resolvedId);
        if (!def) {
            throw new Error(`FieldRegistry: Field "${id}" not found`);
        }
        this.ensureTexture(def);

        const tex = this.textures.get(resolvedId);
        if (!tex) {
            throw new Error(`FieldRegistry: Field "${id}" not found`);
        }

        if (tex instanceof PingPongTexture) {
            const isA = this.pingPongStates.get(resolvedId) ?? true;
            return isA ? tex.a : tex.b;
        }

        return tex.texture;
    }

    /**
     * Get the current write texture for a field (only valid for ping-pong fields)
     */
    getWrite(id: string): THREE.StorageTexture {
        const resolvedId = this.resolveId(id);
        const def = this.fields.get(resolvedId);
        if (!def) {
            throw new Error(`FieldRegistry: Field "${id}" not found`);
        }
        this.ensureTexture(def);

        const tex = this.textures.get(resolvedId);
        if (!tex) {
            throw new Error(`FieldRegistry: Field "${id}" not found`);
        }

        if (tex instanceof PingPongTexture) {
            const isA = this.pingPongStates.get(resolvedId) ?? true;
            return isA ? tex.b : tex.a;
        }

        // For non-ping-pong, read and write are the same
        return tex.texture;
    }

    /**
     * Get both textures for a ping-pong field
     */
    getBoth(id: string): { a: THREE.StorageTexture; b: THREE.StorageTexture } {
        const resolvedId = this.resolveId(id);
        const def = this.fields.get(resolvedId);
        if (!def) {
            throw new Error(`FieldRegistry: Field "${id}" not found`);
        }
        this.ensureTexture(def);

        const tex = this.textures.get(resolvedId);
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
        const resolvedId = this.resolveId(id);
        const current = this.pingPongStates.get(resolvedId);
        if (current !== undefined) {
            this.pingPongStates.set(resolvedId, !current);
        }
    }

    /**
     * Get the current ping-pong state (true = A is read, false = B is read)
     */
    getState(id: string): boolean {
        const resolvedId = this.resolveId(id);
        return this.pingPongStates.get(resolvedId) ?? true;
    }

    /**
     * Returns true if the underlying texture(s) for this field have been allocated.
     */
    isAllocated(id: string): boolean {
        const resolvedId = this.resolveId(id);
        return this.textures.has(resolvedId);
    }

    /**
     * Get the dimensions of a field (does not allocate textures).
     */
    getFieldSize(id: string): { width: number; height: number } {
        const resolvedId = this.resolveId(id);
        const def = this.fields.get(resolvedId);
        if (!def) throw new Error(`FieldRegistry: Field "${id}" not found`);
        return this.getSize(def);
    }

    /**
     * Alias a field id to another field's underlying texture(s).
     */
    alias(aliasId: string, targetId: string, opts?: { label?: string; description?: string }): void {
        const targetDef = this.fields.get(targetId);
        if (!targetDef) {
            throw new Error(`FieldRegistry: Cannot alias "${aliasId}" to missing field "${targetId}"`);
        }

        const def: FieldDefinition = {
            id: aliasId,
            label: opts?.label ?? `${targetDef.label} (alias)`,
            description: opts?.description ?? targetDef.description,
            sizeSource: targetDef.sizeSource,
            customSize: targetDef.customSize,
            format: targetDef.format,
            pingPong: targetDef.pingPong,
            resolutionScale: targetDef.resolutionScale,
            lazyAllocation: true,
            aliasOf: targetId,
        };

        this.register(def);
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

    private bytesPerPixel(format: FieldFormat): number {
        switch (format) {
            case 'r16float':
                return 2;
            case 'rg16float':
                return 4;
            case 'rgba16float':
                return 8;
            case 'rgba32float':
                return 16;
        }
    }

    private estimateFieldBytes(def: FieldDefinition): number {
        const size = this.getSize(def);
        const layers = def.pingPong ? 2 : 1;
        return size.width * size.height * this.bytesPerPixel(this.resolveFormat(def)) * layers;
    }

    /**
     * Rough VRAM estimate for allocated vs total (includes lazy-unallocated estimates).
     */
    getMemoryStats(): FieldMemoryStats {
        let allocatedBytes = 0;
        let estimatedBytes = 0;

        const bases = new Set<string>();
        for (const def of this.fields.values()) {
            const baseId = this.resolveId(def.id);
            if (bases.has(baseId)) continue;
            bases.add(baseId);

            const baseDef = this.fields.get(baseId);
            if (!baseDef) continue;

            const estimate = this.estimateFieldBytes(baseDef);
            estimatedBytes += estimate;
            if (this.textures.has(baseId)) allocatedBytes += estimate;
        }

        const memoryBudgetBytes = this.memoryBudgetBytes;
        const overBudgetBytes =
            memoryBudgetBytes !== undefined ? Math.max(0, estimatedBytes - memoryBudgetBytes) : undefined;

        return { allocatedBytes, estimatedBytes, memoryBudgetBytes, overBudgetBytes };
    }

    setMemoryBudgetBytes(bytes?: number): void {
        this.memoryBudgetBytes = bytes;
        this.checkMemoryBudget();
    }

    private checkMemoryBudget(): void {
        if (!this.warnOnBudgetExceeded) return;
        if (this.memoryBudgetBytes === undefined) return;

        const { estimatedBytes, overBudgetBytes } = this.getMemoryStats();
        if (!overBudgetBytes || overBudgetBytes <= 0) return;

        console.warn(
            `[FieldRegistry] Estimated VRAM ${Math.round(estimatedBytes / (1024 * 1024))}MB exceeds budget ` +
                `${Math.round(this.memoryBudgetBytes / (1024 * 1024))}MB by ${Math.round(overBudgetBytes / (1024 * 1024))}MB`
        );
    }

    /**
     * Resize all fields (recreates textures)
     */
    resize(gridSize: number, dyeSize: number): void {
        this.gridSize = gridSize;
        this.dyeSize = dyeSize;

        for (const [id, def] of this.fields) {
            if (def.aliasOf) continue;
            // Dispose old texture
            const oldTex = this.textures.get(id);
            if (oldTex instanceof PingPongTexture) {
                oldTex.a.dispose();
                oldTex.b.dispose();
            } else if (oldTex) {
                oldTex.texture.dispose();
            }

            // Create new texture (skip if lazy and never allocated)
            if (oldTex || !def.lazyAllocation) {
                this.createTexture(def);
            } else {
                this.textures.delete(id);
            }

            // Reset ping-pong state
            if (def.pingPong) {
                this.pingPongStates.set(id, true);
            }
        }

        this.checkMemoryBudget();
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
        this.aliases.clear();
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
    {
        id: 'obstacles',
        label: 'Obstacles',
        sizeSource: 'grid',
        format: 'rgba16float',
        pingPong: false,
        debug: { colorMap: 'magnitude', scale: 1, bias: 0 },
        description: 'Obstacle mask field (scalar)',
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
