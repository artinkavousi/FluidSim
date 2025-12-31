/**
 * @package fluid-2d/core
 * ComputeNodeRegistry - A lightweight plugin registry for compute node factories
 *
 * This is scaffolding for a future visual editor / community node ecosystem.
 */

import type { FieldRegistry } from './FieldRegistry';

export type ComputeNodeCategory = 'simulation' | 'post' | 'utility' | 'experiment';

export interface NodePort {
    id: string;
    label: string;
    field?: string;
}

export interface NodeParam {
    id: string;
    label: string;
    type: 'float' | 'int' | 'bool' | 'vec2' | 'vec3' | 'vec4' | 'color' | 'enum';
    defaultValue: unknown;
    options?: Array<{ label: string; value: string | number }>;
    min?: number;
    max?: number;
    step?: number;
}

export interface ComputeNodeDefinition<TConfig = unknown, TNode = unknown> {
    id: string;
    label: string;
    category: ComputeNodeCategory;

    inputs: NodePort[];
    outputs: NodePort[];
    params: NodeParam[];

    create: (registry: FieldRegistry, config: TConfig) => TNode;

    icon?: string;
    documentation?: string;
}

export type ComputeNodeModule =
    | ComputeNodeDefinition
    | { default?: ComputeNodeDefinition; definition?: ComputeNodeDefinition; definitions?: ComputeNodeDefinition[] }
    | { computeNodes?: ComputeNodeDefinition[] };

export type ComputeNodeDiscoveryResult = {
    registered: string[];
    failed: Array<{ path: string; error: unknown }>;
};

export class ComputeNodeRegistry {
    private defs = new Map<string, ComputeNodeDefinition>();

    register(def: ComputeNodeDefinition): void {
        if (this.defs.has(def.id)) {
            console.warn(`[ComputeNodeRegistry] Node "${def.id}" already registered, replacing`);
        }
        this.defs.set(def.id, def);
    }

    registerAll(defs: ComputeNodeDefinition[]): void {
        for (const def of defs) this.register(def);
    }

    get(id: string): ComputeNodeDefinition | undefined {
        return this.defs.get(id);
    }

    has(id: string): boolean {
        return this.defs.has(id);
    }

    list(): ComputeNodeDefinition[] {
        return Array.from(this.defs.values());
    }

    /**
     * Register compute node definitions from a set of dynamic importers.
     *
     * Useful patterns:
     * - Vite: `import.meta.glob('./nodes/**\\/*.ts')`
     * - Custom plugin loader: `{ 'my-node': () => import('...') }`
     */
    async registerFromImporters(importers: Record<string, () => Promise<unknown>>): Promise<ComputeNodeDiscoveryResult> {
        const registered: string[] = [];
        const failed: Array<{ path: string; error: unknown }> = [];

        for (const [path, load] of Object.entries(importers)) {
            try {
                const mod = (await load()) as ComputeNodeModule;
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

    private extractDefinitions(mod: ComputeNodeModule): ComputeNodeDefinition[] {
        if (!mod) return [];
        if ((mod as any).create && (mod as any).id) return [mod as ComputeNodeDefinition];
        if (Array.isArray((mod as any).definitions)) return (mod as any).definitions as ComputeNodeDefinition[];
        if (Array.isArray((mod as any).computeNodes)) return (mod as any).computeNodes as ComputeNodeDefinition[];
        if ((mod as any).definition) return [(mod as any).definition as ComputeNodeDefinition];
        if ((mod as any).default) return [(mod as any).default as ComputeNodeDefinition];
        return [];
    }

    clear(): void {
        this.defs.clear();
    }
}
