/**
 * @package fluid-2d/materials
 * MaterialNodeRegistry — Plugin registry for material node factories
 * 
 * Mirrors the pattern established in ComputeNodeRegistry and PostFX effectRegistry.
 */

import type { MaterialNodeDefinition, MaterialNodeMetadata } from './types';

// ============================================
// Module Discovery Types
// ============================================

export type MaterialNodeModule =
    | MaterialNodeDefinition
    | { default?: MaterialNodeDefinition; definition?: MaterialNodeDefinition; definitions?: MaterialNodeDefinition[] }
    | { materialNodes?: MaterialNodeDefinition[] };

export interface MaterialNodeDiscoveryResult {
    registered: string[];
    failed: Array<{ path: string; error: unknown }>;
}

// ============================================
// Registry Class
// ============================================

export class MaterialNodeRegistry {
    private defs = new Map<string, MaterialNodeDefinition>();

    /**
     * Register a material node definition
     */
    register(def: MaterialNodeDefinition): void {
        if (this.defs.has(def.id)) {
            console.warn(`[MaterialNodeRegistry] Node "${def.id}" already registered, replacing`);
        }
        this.defs.set(def.id, def);
    }

    /**
     * Register multiple definitions at once
     */
    registerAll(defs: MaterialNodeDefinition[]): void {
        for (const def of defs) this.register(def);
    }

    /**
     * Get a node definition by ID
     */
    get(id: string): MaterialNodeDefinition | undefined {
        return this.defs.get(id);
    }

    /**
     * Check if a node is registered
     */
    has(id: string): boolean {
        return this.defs.has(id);
    }

    /**
     * List all registered node definitions
     */
    list(): MaterialNodeDefinition[] {
        return Array.from(this.defs.values());
    }

    /**
     * List nodes by category
     */
    listByCategory(category: MaterialNodeDefinition['category']): MaterialNodeDefinition[] {
        return this.list().filter(def => def.category === category);
    }

    /**
     * Get metadata for all nodes (for UI/editor)
     */
    getMetadata(): MaterialNodeMetadata[] {
        return this.list().map(def => ({
            id: def.id,
            type: def.id,
            label: def.label,
            category: def.category,
            inputs: def.inputs,
            outputs: def.outputs,
            params: def.params,
            gpuCost: def.gpuCost,
        }));
    }

    /**
     * Register nodes from dynamic importers.
     * 
     * Useful patterns:
     * - Vite: `import.meta.glob('./nodes/**\/*.ts')`
     * - Custom plugin loader: `{ 'my-node': () => import('...') }`
     */
    async registerFromImporters(
        importers: Record<string, () => Promise<unknown>>
    ): Promise<MaterialNodeDiscoveryResult> {
        const registered: string[] = [];
        const failed: Array<{ path: string; error: unknown }> = [];

        for (const [path, load] of Object.entries(importers)) {
            try {
                const mod = (await load()) as MaterialNodeModule;
                const defs = this.extractDefinitions(mod);
                for (const def of defs) {
                    this.register(def);
                    registered.push(def.id);
                }
            } catch (error) {
                failed.push({ path, error });
            }
        }

        return { registered, failed };
    }

    /**
     * Extract definitions from various module export patterns
     */
    private extractDefinitions(mod: MaterialNodeModule): MaterialNodeDefinition[] {
        if (!mod) return [];
        // Direct export of definition
        if ((mod as any).build && (mod as any).id) return [mod as MaterialNodeDefinition];
        // Array exports
        if (Array.isArray((mod as any).definitions)) return (mod as any).definitions;
        if (Array.isArray((mod as any).materialNodes)) return (mod as any).materialNodes;
        // Named exports
        if ((mod as any).definition) return [(mod as any).definition];
        if ((mod as any).default) return [(mod as any).default];
        return [];
    }

    /**
     * Clear all registered nodes
     */
    clear(): void {
        this.defs.clear();
    }
}

// ============================================
// Default Registry Instance
// ============================================

export const materialNodeRegistry = new MaterialNodeRegistry();

// ============================================
// Convenience Functions
// ============================================

export function registerMaterialNode(def: MaterialNodeDefinition): void {
    materialNodeRegistry.register(def);
}

export function getMaterialNode(id: string): MaterialNodeDefinition | undefined {
    return materialNodeRegistry.get(id);
}

export function listMaterialNodes(): MaterialNodeDefinition[] {
    return materialNodeRegistry.list();
}
