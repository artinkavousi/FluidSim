/**
 * @package fluid-2d/core
 * PassGraph — Ordered execution of simulation passes with dependency management
 * 
 * This abstraction allows simulation passes to be registered, ordered by dependencies,
 * and executed in sequence with timing information.
 */

import * as THREE from 'three/webgpu';

export type PassGroup = 'sim' | 'post' | 'debug' | 'utility' | 'experiment';

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

    /** Optional: pass grouping for UI/budget control */
    group?: PassGroup;

    /** Optional: pass is safe to skip under budget pressure */
    optional?: boolean;

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

    /**
     * Optional: conditional execution (e.g., based on frame budget or config).
     * Returning false will skip execution for this run.
     */
    shouldRun?: (ctx: PassRunContext) => boolean;
}

export interface PassRunContext {
    renderer: THREE.WebGPURenderer;
    config: Record<string, unknown>;
    dt: number;
    time: number;
    elapsedMs: number;
    frameBudgetMs?: number;
}

export interface PassRunOptions {
    groups?: PassGroup[];
    frameBudgetMs?: number;
}

/**
 * Timing information for a single pass execution
 */
export interface PassTiming {
    id: string;
    label: string;
    ms: number;
    group?: PassGroup;
    gpuMs?: number;
    gpuTimestampUID?: string;
}

export interface PassMetadata {
    id: string;
    label: string;
    enabled: boolean;
    group: PassGroup;
    after?: string[];
    inputs: Array<{ name: string; access: 'read' }>;
    outputs: Array<{ name: string; access: 'write' }>;
}

export type PassGraphChangeType =
    | 'register'
    | 'registerAll'
    | 'unregister'
    | 'replace'
    | 'setEnabled'
    | 'setGroupEnabled'
    | 'clear';

export interface PassGraphChangeEvent {
    type: PassGraphChangeType;
    passId?: string;
    group?: PassGroup;
}

/**
 * PassGraph manages the registration, ordering, and execution of simulation passes
 */
export class PassGraph {
    private passes: Map<string, Pass> = new Map();
    private order: string[] = [];
    private timings: PassTiming[] = [];
    private timingEnabled = false;
    private gpuTimingEnabled = false;
    private changeListeners = new Set<(event: PassGraphChangeEvent) => void>();

    /**
     * Register a pass with the graph
     */
    register(pass: Pass): void {
        this.passes.set(pass.id, pass);
        this.rebuildOrder();
        this.emitChange({ type: 'register', passId: pass.id });
    }

    /**
     * Replace an existing pass (hot-swap). If the pass does not exist, this registers it.
     */
    replace(id: string, newPass: Pass, opts?: { preserveEnabled?: boolean }): void {
        const prev = this.passes.get(id);
        const preserveEnabled = opts?.preserveEnabled ?? true;
        if (prev && preserveEnabled) {
            newPass.enabled = prev.enabled;
        }

        this.passes.set(id, { ...newPass, id });
        this.rebuildOrder();
        this.emitChange({ type: 'replace', passId: id });
    }

    /**
     * Register multiple passes at once
     */
    registerAll(passes: Pass[]): void {
        for (const pass of passes) {
            this.passes.set(pass.id, pass);
        }
        this.rebuildOrder();
        this.emitChange({ type: 'registerAll' });
    }

    /**
     * Unregister a pass from the graph
     */
    unregister(id: string): void {
        this.passes.delete(id);
        this.rebuildOrder();
        this.emitChange({ type: 'unregister', passId: id });
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
            this.emitChange({ type: 'setEnabled', passId: id });
        }
    }

    /**
     * Enable or disable timing collection
     */
    setTimingEnabled(enabled: boolean): void {
        this.timingEnabled = enabled;
    }

    /**
     * Enable/disable GPU timestamp tracking (true GPU timings require `await renderer.resolveTimestampsAsync('compute')`).
     */
    setGpuTimingEnabled(enabled: boolean): void {
        this.gpuTimingEnabled = enabled;
    }

    /**
     * Enable/disable all passes in a group.
     */
    setGroupEnabled(group: PassGroup, enabled: boolean): void {
        for (const pass of this.passes.values()) {
            const passGroup = pass.group ?? 'sim';
            if (passGroup === group) {
                pass.enabled = enabled;
            }
        }
        this.emitChange({ type: 'setGroupEnabled', group });
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
        time: number,
        options?: PassRunOptions
    ): void {
        if (this.timingEnabled || this.gpuTimingEnabled) {
            this.timings = [];
        }

        if (this.gpuTimingEnabled) {
            const backend = (renderer as any).backend;
            if (backend && typeof backend.trackTimestamp === 'boolean') {
                backend.trackTimestamp = true;
            }
        }

        const frameT0 = performance.now();
        const groupFilter = options?.groups ? new Set(options.groups) : null;
        const frameBudgetMs = options?.frameBudgetMs;

        for (const id of this.order) {
            const pass = this.passes.get(id);
            if (!pass || !pass.enabled) continue;

            const group = pass.group ?? 'sim';
            if (groupFilter && !groupFilter.has(group)) continue;

            const elapsedMs = performance.now() - frameT0;
            if (frameBudgetMs !== undefined && elapsedMs >= frameBudgetMs && pass.optional) {
                continue;
            }

            const ctx: PassRunContext = {
                renderer,
                config,
                dt,
                time,
                elapsedMs,
                frameBudgetMs,
            };

            if (pass.shouldRun && pass.shouldRun(ctx) === false) continue;

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

            if (this.timingEnabled || this.gpuTimingEnabled) {
                const backend = (renderer as any).backend;
                const gpuTimestampUID =
                    this.gpuTimingEnabled && backend && !pass.execute && pass.compute
                        ? backend.getTimestampUID(pass.compute)
                        : undefined;

                this.timings.push({
                    id,
                    label: pass.label,
                    ms: this.timingEnabled ? performance.now() - t0 : 0,
                    group,
                    gpuTimestampUID,
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
        time: number,
        options?: PassRunOptions
    ): void {
        if (this.timingEnabled || this.gpuTimingEnabled) {
            this.timings = [];
        }

        if (this.gpuTimingEnabled) {
            const backend = (renderer as any).backend;
            if (backend && typeof backend.trackTimestamp === 'boolean') {
                backend.trackTimestamp = true;
            }
        }

        const frameT0 = performance.now();
        const groupFilter = options?.groups ? new Set(options.groups) : null;
        const frameBudgetMs = options?.frameBudgetMs;

        for (const id of ids) {
            const pass = this.passes.get(id);
            if (!pass || !pass.enabled) continue;

            const group = pass.group ?? 'sim';
            if (groupFilter && !groupFilter.has(group)) continue;

            const elapsedMs = performance.now() - frameT0;
            if (frameBudgetMs !== undefined && elapsedMs >= frameBudgetMs && pass.optional) {
                continue;
            }

            const ctx: PassRunContext = {
                renderer,
                config,
                dt,
                time,
                elapsedMs,
                frameBudgetMs,
            };

            if (pass.shouldRun && pass.shouldRun(ctx) === false) continue;

            const t0 = this.timingEnabled ? performance.now() : 0;

            pass.prepare?.(config, dt, time);
            if (pass.execute) {
                pass.execute(renderer, dt);
            } else {
                renderer.compute(pass.compute);
            }
            pass.afterRun?.();

            if (this.timingEnabled || this.gpuTimingEnabled) {
                const backend = (renderer as any).backend;
                const gpuTimestampUID =
                    this.gpuTimingEnabled && backend && !pass.execute && pass.compute
                        ? backend.getTimestampUID(pass.compute)
                        : undefined;

                this.timings.push({
                    id,
                    label: pass.label,
                    ms: this.timingEnabled ? performance.now() - t0 : 0,
                    group,
                    gpuTimestampUID,
                });
            }
        }
    }

    /**
     * Resolve GPU timings for the last run (requires `renderer.backend.trackTimestamp = true`).
     * This method is async and may stall while reading back query results.
     */
    async resolveGpuTimingsAsync(renderer: THREE.WebGPURenderer): Promise<void> {
        if (!this.gpuTimingEnabled) return;

        const resolve = (renderer as any).resolveTimestampsAsync as ((type?: string) => Promise<number>) | undefined;
        const backend = (renderer as any).backend;
        if (!resolve || !backend) return;

        await resolve('compute');

        for (const timing of this.timings) {
            const uid = timing.gpuTimestampUID;
            if (!uid) continue;
            if (backend.hasTimestamp?.(uid)) {
                timing.gpuMs = backend.getTimestamp(uid);
            }
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
     * Get all passes as serializable metadata (for UI / node editor).
     */
    getPassMetadata(): PassMetadata[] {
        return Array.from(this.passes.values()).map((p) => ({
            id: p.id,
            label: p.label,
            enabled: p.enabled,
            group: p.group ?? 'sim',
            after: p.after ? [...p.after] : undefined,
            inputs: p.inputs.map((io) => ({ name: io.name, access: 'read' as const })),
            outputs: p.outputs.map((io) => ({ name: io.name, access: 'write' as const })),
        }));
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
        this.emitChange({ type: 'clear' });
    }

    /**
     * Subscribe to graph changes (for UI / visual editor).
     */
    subscribe(listener: (event: PassGraphChangeEvent) => void): () => void {
        this.changeListeners.add(listener);
        return () => this.changeListeners.delete(listener);
    }

    private emitChange(event: PassGraphChangeEvent): void {
        for (const listener of this.changeListeners) {
            try {
                listener(event);
            } catch (e) {
                console.warn('[PassGraph] change listener error', e);
            }
        }
    }
}
