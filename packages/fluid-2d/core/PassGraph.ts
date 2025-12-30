/**
 * @package fluid-2d/core
 * PassGraph — Ordered execution of simulation passes with dependency management
 * 
 * This abstraction allows simulation passes to be registered, ordered by dependencies,
 * and executed in sequence with timing information.
 */

import * as THREE from 'three/webgpu';

/**
 * Uniform collection for a pass
 */
export interface PassUniforms {
    [key: string]: THREE.Uniform<any>;
}

/**
 * Input/output texture specification for a pass
 */
export interface PassIO {
    /** Field name (must match FieldRegistry id) */
    name: string;
    /** The texture resource */
    texture: THREE.StorageTexture;
    /** Access mode */
    access: 'read' | 'write';
}

/**
 * A simulation pass that can be registered with the PassGraph
 */
export interface Pass {
    /** Unique identifier for this pass */
    id: string;
    /** Human-readable label for debug/UI */
    label: string;
    /** Whether this pass is currently enabled */
    enabled: boolean;

    /** Input textures (read) */
    inputs: PassIO[];
    /** Output textures (write) */
    outputs: PassIO[];
    /** Uniform values for this pass */
    uniforms: PassUniforms;

    /** Dependencies: pass IDs that must run before this one */
    after?: string[];

    /** The TSL compute node */
    compute: any;

    /** 
     * Optional: prepare uniforms before execution
     * Called right before renderer.compute()
     */
    prepare?: (config: Record<string, unknown>, dt: number, time: number) => void;

    /**
     * Optional: custom execution logic.
     * If provided, this is called INSTEAD of renderer.compute(pass.compute).
     * Useful for multi-step passes or loops (e.g., pressure solver).
     */
    execute?: (renderer: THREE.WebGPURenderer, dt: number) => void;

    /**
     * Optional: post-execution callback (e.g., for ping-pong swapping)
     */
    afterRun?: () => void;
}

/**
 * Timing information for a single pass execution
 */
export interface PassTiming {
    id: string;
    label: string;
    ms: number;
}

/**
 * PassGraph manages the registration, ordering, and execution of simulation passes
 */
export class PassGraph {
    private passes: Map<string, Pass> = new Map();
    private order: string[] = [];
    private timings: PassTiming[] = [];
    private timingEnabled = false;

    /**
     * Register a pass with the graph
     */
    register(pass: Pass): void {
        this.passes.set(pass.id, pass);
        this.rebuildOrder();
    }

    /**
     * Register multiple passes at once
     */
    registerAll(passes: Pass[]): void {
        for (const pass of passes) {
            this.passes.set(pass.id, pass);
        }
        this.rebuildOrder();
    }

    /**
     * Unregister a pass from the graph
     */
    unregister(id: string): void {
        this.passes.delete(id);
        this.rebuildOrder();
    }

    /**
     * Get a pass by ID
     */
    get(id: string): Pass | undefined {
        return this.passes.get(id);
    }

    /**
     * Check if a pass is registered
     */
    has(id: string): boolean {
        return this.passes.has(id);
    }

    /**
     * Enable or disable a pass
     */
    setEnabled(id: string, enabled: boolean): void {
        const pass = this.passes.get(id);
        if (pass) {
            pass.enabled = enabled;
        }
    }

    /**
     * Enable or disable timing collection
     */
    setTimingEnabled(enabled: boolean): void {
        this.timingEnabled = enabled;
    }

    /**
     * Rebuild the execution order based on dependencies (topological sort)
     */
    private rebuildOrder(): void {
        const visited = new Set<string>();
        const visiting = new Set<string>();
        const order: string[] = [];

        const visit = (id: string): void => {
            if (visited.has(id)) return;
            if (visiting.has(id)) {
                console.warn(`PassGraph: Circular dependency detected at pass "${id}"`);
                return;
            }

            visiting.add(id);

            const pass = this.passes.get(id);
            if (pass?.after) {
                for (const dep of pass.after) {
                    if (this.passes.has(dep)) {
                        visit(dep);
                    }
                }
            }

            visiting.delete(id);
            visited.add(id);
            order.push(id);
        };

        for (const id of this.passes.keys()) {
            visit(id);
        }

        this.order = order;
    }

    /**
     * Execute all enabled passes in order
     */
    run(
        renderer: THREE.WebGPURenderer,
        config: Record<string, unknown>,
        dt: number,
        time: number
    ): void {
        if (this.timingEnabled) {
            this.timings = [];
        }

        for (const id of this.order) {
            const pass = this.passes.get(id);
            if (!pass || !pass.enabled) continue;

            const t0 = this.timingEnabled ? performance.now() : 0;

            // Prepare uniforms
            pass.prepare?.(config, dt, time);

            // Execute compute
            if (pass.execute) {
                pass.execute(renderer, dt);
            } else {
                renderer.compute(pass.compute);
            }

            // Post-execution callback
            pass.afterRun?.();

            if (this.timingEnabled) {
                this.timings.push({
                    id,
                    label: pass.label,
                    ms: performance.now() - t0,
                });
            }
        }
    }

    /**
     * Run a specific subset of passes (for manual control)
     */
    runSubset(
        ids: string[],
        renderer: THREE.WebGPURenderer,
        config: Record<string, unknown>,
        dt: number,
        time: number
    ): void {
        for (const id of ids) {
            const pass = this.passes.get(id);
            if (!pass || !pass.enabled) continue;

            pass.prepare?.(config, dt, time);
            if (pass.execute) {
                pass.execute(renderer, dt);
            } else {
                renderer.compute(pass.compute);
            }
            pass.afterRun?.();
        }
    }

    /**
     * Get timing information from the last run
     */
    getTimings(): PassTiming[] {
        return [...this.timings];
    }

    /**
     * Get total execution time from the last run
     */
    getTotalMs(): number {
        return this.timings.reduce((sum, t) => sum + t.ms, 0);
    }

    /**
     * Get the current execution order (for debugging)
     */
    getOrder(): string[] {
        return [...this.order];
    }

    /**
     * Get all registered pass IDs
     */
    getPassIds(): string[] {
        return Array.from(this.passes.keys());
    }

    /**
     * Get all enabled pass IDs
     */
    getEnabledPassIds(): string[] {
        return Array.from(this.passes.entries())
            .filter(([_, pass]) => pass.enabled)
            .map(([id]) => id);
    }

    /**
     * Clear all passes
     */
    clear(): void {
        this.passes.clear();
        this.order = [];
        this.timings = [];
    }
}
