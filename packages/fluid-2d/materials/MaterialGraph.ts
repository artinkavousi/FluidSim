/**
 * @package fluid-2d/materials
 * MaterialGraph — Graph evaluator that compiles material node graphs to TSL
 * 
 * Takes a MaterialGraphData structure and produces a single TSL shader node
 * by topologically sorting nodes and composing their build functions.
 */

import { uniform } from 'three/tsl';
import type {
    MaterialGraphData,
    MaterialGraphNode,
    MaterialGraphEdge,
    MaterialBuildContext,
    MaterialNodeDefinition,
    MaterialNodeMetadata,
    ShaderNodeObject,
    UniformNode,
} from './types';
import { MaterialNodeRegistry, materialNodeRegistry } from './MaterialNodeRegistry';

// ============================================
// Types
// ============================================

export interface MaterialGraphOptions {
    registry?: MaterialNodeRegistry;
}

export interface CompiledMaterialGraph {
    /** The final output color node */
    colorNode: ShaderNodeObject;
    /** All uniform nodes for hot updates */
    uniforms: Map<string, UniformNode>;
    /** Dispose function to clean up resources */
    dispose: () => void;
}

// ============================================
// MaterialGraph Class
// ============================================

export class MaterialGraph {
    private registry: MaterialNodeRegistry;
    private data: MaterialGraphData;
    private compiled: CompiledMaterialGraph | null = null;
    private uniforms: Map<string, UniformNode> = new Map();

    constructor(data: MaterialGraphData, options: MaterialGraphOptions = {}) {
        this.registry = options.registry ?? materialNodeRegistry;
        this.data = data;
    }

    /**
     * Compile the graph to a TSL shader node
     */
    compile(context: MaterialBuildContext): CompiledMaterialGraph {
        // Topologically sort nodes
        const sorted = this.topologicalSort();

        // Build each node and cache outputs
        const nodeOutputs = new Map<string, Record<string, ShaderNodeObject>>();
        this.uniforms.clear();

        for (const graphNode of sorted) {
            const def = this.registry.get(graphNode.type);
            if (!def) {
                console.warn(`[MaterialGraph] Unknown node type: ${graphNode.type}`);
                continue;
            }

            // Collect inputs from connected nodes
            const inputs: Record<string, ShaderNodeObject> = {};
            for (const edge of this.data.edges) {
                if (edge.to.node === graphNode.id) {
                    const fromOutputs = nodeOutputs.get(edge.from.node);
                    if (fromOutputs && fromOutputs[edge.from.port] !== undefined) {
                        inputs[edge.to.port] = fromOutputs[edge.from.port];
                    }
                }
            }

            // Create uniforms for parameters
            const paramUniforms: Record<string, UniformNode> = {};
            for (const [paramId, paramDef] of Object.entries(def.params)) {
                const value = graphNode.params[paramId] ?? paramDef.default;
                const uniformNode = uniform(value);
                const uniformKey = `${graphNode.id}.${paramId}`;
                paramUniforms[paramId] = uniformNode;
                this.uniforms.set(uniformKey, uniformNode);
            }

            // Build the node
            const outputs = def.build(inputs, paramUniforms, context);
            nodeOutputs.set(graphNode.id, outputs);
        }

        // Get the final output
        const outputNodeData = nodeOutputs.get(this.data.outputNode);
        const colorNode = outputNodeData?.color ?? outputNodeData?.output ?? null;

        if (!colorNode) {
            console.error('[MaterialGraph] No output color node found');
        }

        this.compiled = {
            colorNode,
            uniforms: this.uniforms,
            dispose: () => {
                this.uniforms.clear();
                this.compiled = null;
            },
        };

        return this.compiled;
    }

    /**
     * Update a parameter value without recompiling
     * @param nodeId - Graph node ID
     * @param paramId - Parameter ID
     * @param value - New value
     */
    updateParam(nodeId: string, paramId: string, value: unknown): boolean {
        const uniformKey = `${nodeId}.${paramId}`;
        const uniformNode = this.uniforms.get(uniformKey);
        if (uniformNode) {
            uniformNode.value = value;
            return true;
        }
        return false;
    }

    /**
     * Update multiple parameters at once
     */
    updateParams(nodeId: string, params: Record<string, unknown>): void {
        for (const [paramId, value] of Object.entries(params)) {
            this.updateParam(nodeId, paramId, value);
        }
    }

    /**
     * Get the compiled graph (null if not compiled)
     */
    getCompiled(): CompiledMaterialGraph | null {
        return this.compiled;
    }

    /**
     * Topological sort of graph nodes based on edges
     */
    private topologicalSort(): MaterialGraphNode[] {
        const visited = new Set<string>();
        const result: MaterialGraphNode[] = [];
        const nodeMap = new Map(this.data.nodes.map(n => [n.id, n]));

        // Build adjacency list (reverse edges for proper ordering)
        const dependencies = new Map<string, Set<string>>();
        for (const edge of this.data.edges) {
            if (!dependencies.has(edge.to.node)) {
                dependencies.set(edge.to.node, new Set());
            }
            dependencies.get(edge.to.node)!.add(edge.from.node);
        }

        const visit = (nodeId: string) => {
            if (visited.has(nodeId)) return;
            visited.add(nodeId);

            // Visit all dependencies first
            const deps = dependencies.get(nodeId);
            if (deps) {
                for (const depId of deps) {
                    visit(depId);
                }
            }

            const node = nodeMap.get(nodeId);
            if (node) {
                result.push(node);
            }
        };

        // Visit all nodes starting from output
        visit(this.data.outputNode);

        // Also visit any disconnected nodes (shouldn't happen in valid graphs)
        for (const node of this.data.nodes) {
            if (!visited.has(node.id)) {
                visit(node.id);
            }
        }

        return result;
    }

    /**
     * Serialize graph to JSON
     */
    toJSON(): MaterialGraphData {
        return JSON.parse(JSON.stringify(this.data));
    }

    /**
     * Update graph data (requires recompile)
     */
    fromJSON(data: MaterialGraphData): void {
        this.data = data;
        if (this.compiled) {
            this.compiled.dispose();
            this.compiled = null;
        }
    }

    /**
     * Get metadata for all nodes in the graph
     */
    getNodeMetadata(): MaterialNodeMetadata[] {
        return this.data.nodes.map(node => {
            const def = this.registry.get(node.type);
            return {
                id: node.id,
                type: node.type,
                label: def?.label ?? node.type,
                category: def?.category ?? 'input',
                inputs: def?.inputs ?? [],
                outputs: def?.outputs ?? [],
                params: def?.params ?? {},
                position: node.position,
                gpuCost: def?.gpuCost,
            };
        });
    }

    /**
     * Add a node to the graph
     */
    addNode(node: MaterialGraphNode): void {
        this.data.nodes.push(node);
    }

    /**
     * Remove a node and its edges
     */
    removeNode(nodeId: string): void {
        this.data.nodes = this.data.nodes.filter(n => n.id !== nodeId);
        this.data.edges = this.data.edges.filter(
            e => e.from.node !== nodeId && e.to.node !== nodeId
        );
    }

    /**
     * Add an edge between nodes
     */
    addEdge(edge: MaterialGraphEdge): void {
        this.data.edges.push(edge);
    }

    /**
     * Remove an edge
     */
    removeEdge(from: { node: string; port: string }, to: { node: string; port: string }): void {
        this.data.edges = this.data.edges.filter(
            e => !(e.from.node === from.node && e.from.port === from.port &&
                e.to.node === to.node && e.to.port === to.port)
        );
    }

    /**
     * Dispose of compiled resources
     */
    dispose(): void {
        this.compiled?.dispose();
        this.compiled = null;
    }
}

// ============================================
// Factory Functions
// ============================================

/**
 * Create a material graph from preset data
 */
export function createMaterialGraph(
    data: MaterialGraphData,
    registry?: MaterialNodeRegistry
): MaterialGraph {
    return new MaterialGraph(data, { registry });
}

/**
 * Create a simple passthrough graph for testing
 */
export function createPassthroughGraph(): MaterialGraphData {
    return {
        nodes: [
            { id: 'dye', type: 'dyeSampler', params: {} },
            { id: 'output', type: 'output', params: {} },
        ],
        edges: [
            { from: { node: 'dye', port: 'color' }, to: { node: 'output', port: 'color' } },
        ],
        outputNode: 'output',
    };
}
