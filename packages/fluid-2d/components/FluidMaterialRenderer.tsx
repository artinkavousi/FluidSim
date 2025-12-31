/**
 * @package fluid-2d/components
 * FluidMaterialRenderer — Component that renders fluid using MaterialGraph presets
 * 
 * This component provides an alternative rendering path using the node-graph
 * material system. It can be used alongside or instead of the inline TSL in FluidCanvas2D.
 */

import React, { useRef, useEffect, useMemo } from 'react';
import * as THREE from 'three/webgpu';
import { useFrame, useThree } from '@react-three/fiber';
import { vec4, float, clamp, vec3 } from 'three/tsl';
import { FluidSolver2D, type FluidConfig2D } from '../FluidSolver2D';
import { MaterialGraph } from '../materials/MaterialGraph';
import { getPreset, listMaterialPresetsV2 } from '../materials/presets';
import type { MaterialBuildContext } from '../materials/types';

export interface FluidMaterialRendererProps {
    /** The fluid solver instance */
    solver: FluidSolver2D | null;
    /** Fluid config to get resolution info */
    config: FluidConfig2D;
    /** Material preset ID (e.g., 'water', 'fire', 'milk', 'lava', 'smoke', 'neon') */
    presetId: string;
    /** Callback when material compiles */
    onCompiled?: () => void;
}

/**
 * Fluid Material Renderer using MaterialGraph presets
 * 
 * @example
 * ```tsx
 * <FluidMaterialRenderer
 *   solver={solver}
 *   config={config}
 *   presetId="water"
 * />
 * ```
 */
export function FluidMaterialRenderer({
    solver,
    config,
    presetId,
    onCompiled,
}: FluidMaterialRendererProps) {
    const meshRef = useRef<THREE.Mesh>(null);
    const materialRef = useRef<THREE.MeshBasicNodeMaterial | null>(null);
    const graphRef = useRef<MaterialGraph | null>(null);
    const { viewport } = useThree();

    // Get preset and create graph
    const preset = useMemo(() => getPreset(presetId), [presetId]);

    // Compile MaterialGraph when solver and preset are ready
    useEffect(() => {
        if (!solver || !preset) {
            console.warn(`[FluidMaterialRenderer] Invalid preset: ${presetId}`);
            return;
        }

        const pingpong = solver.getPingPongTextures();
        const state = solver.getPingPongState();

        // Get current textures based on ping-pong state
        const dyeTexture = state.dyeIsA ? pingpong.dyeA : pingpong.dyeB;
        const velocityTexture = state.velocityIsA ? pingpong.velocityA : pingpong.velocityB;
        const vorticityTexture = solver.getVorticityTexture();

        // Build context for MaterialGraph
        const context: MaterialBuildContext = {
            dyeTexture,
            velocityTexture,
            vorticityTexture,
            resolution: { width: config.gridSize, height: config.gridSize },
            dyeResolution: { width: config.dyeSize, height: config.dyeSize },
            velocityResolution: { width: config.gridSize, height: config.gridSize },
            time: solver.getTime(),
            uvNode: null as any, // Will be set during build
        };

        try {
            // Create and compile material graph
            const graph = new MaterialGraph(preset.graph);
            const compiled = graph.compile(context);
            graphRef.current = graph;

            // Create material with compiled graph output
            const mat = new THREE.MeshBasicNodeMaterial();

            if (compiled.colorNode) {
                // Use the compiled graph's colorNode
                mat.colorNode = vec4(
                    clamp(compiled.colorNode.xyz ?? compiled.colorNode, vec3(0, 0, 0), vec3(1, 1, 1)),
                    float(1.0)
                );
            } else {
                // Fallback to magenta error color
                mat.colorNode = vec4(1, 0, 1, 1);
                console.error('[FluidMaterialRenderer] Graph compilation produced no colorNode');
            }

            mat.side = THREE.DoubleSide;
            materialRef.current = mat;

            if (meshRef.current) {
                meshRef.current.material = mat;
            }

            onCompiled?.();

            return () => {
                mat.dispose();
                compiled.dispose();
            };
        } catch (err) {
            console.error('[FluidMaterialRenderer] Compilation error:', err);
        }
    }, [solver, preset, presetId, onCompiled]);

    // Update uniforms on each frame
    useFrame(() => {
        if (!solver || !graphRef.current) return;

        // Update time uniform if graph supports it
        graphRef.current.updateParam('time', 'value', solver.getTime());
    });

    return (
        <mesh
            ref={meshRef}
            position={[0, 0, 0]}
        >
            <planeGeometry args={[viewport.width, viewport.height, 1, 1]} />
            {materialRef.current && (
                <primitive object={materialRef.current} attach="material" />
            )}
        </mesh>
    );
}

/**
 * Get list of available material presets
 */
export function getAvailablePresets() {
    return listMaterialPresetsV2().map(p => ({
        id: p.id,
        name: p.name,
        category: p.category,
        description: p.description,
    }));
}

export default FluidMaterialRenderer;
