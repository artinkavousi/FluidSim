/**
 * @package fluid-2d/materials
 * useMaterialGraph — React hook for MaterialGraph integration with FluidCanvas2D
 * 
 * This hook provides an easy way to use node-graph-based materials in FluidCanvas2D.
 * It compiles a MaterialGraph preset and provides the TSL color node for the material.
 */

import { useMemo, useEffect, useRef, useCallback } from 'react';
import { MaterialGraph, type CompiledMaterialGraph } from './MaterialGraph';
import { getPreset } from './presets';
import type { MaterialGraphData, MaterialBuildContext } from './types';

export interface UseMaterialGraphOptions {
    /** Preset ID to use (e.g., 'water', 'fire') or custom graph data */
    preset?: string | MaterialGraphData;
    /** Whether MaterialGraph mode is enabled (false = use inline shader) */
    enabled?: boolean;
    /** Additional parameters to override preset defaults */
    params?: Record<string, unknown>;
}

export interface UseMaterialGraphResult {
    /** The compiled material graph (null if disabled or invalid) */
    compiled: CompiledMaterialGraph | null;
    /** The MaterialGraph instance for parameter updates */
    graph: MaterialGraph | null;
    /** Update a parameter value without recompiling */
    updateParam: (nodeId: string, paramId: string, value: unknown) => boolean;
    /** Recompile the graph (e.g., after structural changes) */
    recompile: (context: MaterialBuildContext) => CompiledMaterialGraph | null;
    /** Check if a valid graph is active */
    isActive: boolean;
}

/**
 * React hook for integrating MaterialGraph with FluidCanvas2D
 * 
 * @example
 * ```tsx
 * function FluidMaterial({ dyeTexture, velocityTexture, resolution }) {
 *   const { compiled, updateParam, isActive } = useMaterialGraph({
 *     preset: 'water',
 *     enabled: true,
 *     params: { 'fresnel.intensity': 0.5 }
 *   });
 * 
 *   const context = useMemo(() => ({
 *     dyeTexture, velocityTexture, resolution, time: 0
 *   }), [dyeTexture, velocityTexture, resolution]);
 * 
 *   useEffect(() => {
 *     if (isActive && dyeTexture) {
 *       // Use compiled.colorNode in material
 *     }
 *   }, [compiled, isActive, dyeTexture]);
 * 
 *   // Hot update without recompile
 *   useEffect(() => {
 *     updateParam('fresnel', 'intensity', 0.8);
 *   }, []);
 * 
 *   return null;
 * }
 * ```
 */
export function useMaterialGraph(options: UseMaterialGraphOptions): UseMaterialGraphResult {
    const { preset, enabled = false, params } = options;

    // Memoize graph creation
    const graphRef = useRef<MaterialGraph | null>(null);
    const compiledRef = useRef<CompiledMaterialGraph | null>(null);

    // Create or update the MaterialGraph
    const graph = useMemo(() => {
        if (!enabled || !preset) {
            graphRef.current = null;
            return null;
        }

        let graphData: MaterialGraphData | null = null;

        if (typeof preset === 'string') {
            // Load from preset registry
            const presetData = getPreset(preset);
            if (presetData) {
                graphData = presetData.graph;
            } else {
                console.warn(`[useMaterialGraph] Preset "${preset}" not found`);
                return null;
            }
        } else {
            // Direct graph data
            graphData = preset;
        }

        const newGraph = new MaterialGraph(graphData);
        graphRef.current = newGraph;

        return newGraph;
    }, [enabled, preset]);

    // Apply parameter overrides
    useEffect(() => {
        if (!graph || !params) return;

        for (const [key, value] of Object.entries(params)) {
            const [nodeId, paramId] = key.split('.');
            if (nodeId && paramId) {
                graph.updateParam(nodeId, paramId, value);
            }
        }
    }, [graph, params]);

    // Update parameter function
    const updateParam = useCallback((nodeId: string, paramId: string, value: unknown): boolean => {
        if (!graphRef.current) return false;
        return graphRef.current.updateParam(nodeId, paramId, value);
    }, []);

    // Recompile function
    const recompile = useCallback((context: MaterialBuildContext): CompiledMaterialGraph | null => {
        if (!graphRef.current) return null;

        try {
            const compiled = graphRef.current.compile(context);
            compiledRef.current = compiled;
            return compiled;
        } catch (err) {
            console.error('[useMaterialGraph] Compilation error:', err);
            return null;
        }
    }, []);

    return {
        compiled: compiledRef.current,
        graph: graphRef.current,
        updateParam,
        recompile,
        isActive: enabled && graph !== null,
    };
}

/**
 * Compile a material graph from preset or custom data
 * Non-hook version for use outside React components
 */
export function compileMaterialGraph(
    preset: string | MaterialGraphData,
    context: MaterialBuildContext
): CompiledMaterialGraph | null {
    let graphData: MaterialGraphData | null = null;

    if (typeof preset === 'string') {
        const presetData = getPreset(preset);
        if (!presetData) {
            console.warn(`[compileMaterialGraph] Preset "${preset}" not found`);
            return null;
        }
        graphData = presetData.graph;
    } else {
        graphData = preset;
    }

    try {
        const graph = new MaterialGraph(graphData);
        return graph.compile(context);
    } catch (err) {
        console.error('[compileMaterialGraph] Error:', err);
        return null;
    }
}
