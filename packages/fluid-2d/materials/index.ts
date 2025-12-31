/**
 * @package fluid-2d/materials
 * Material Node System — Entry point
 * 
 * A node-graph-driven material system for fluid rendering using Three.js TSL.
 * Importing this module auto-registers all built-in nodes.
 */

// Core types
export * from './types';

// Registry
export * from './MaterialNodeRegistry';

// Graph evaluator
export * from './MaterialGraph';

// Auto-register all built-in nodes
import './nodes';

// Auto-register Three.js TSL bridge nodes
import './three-tsl-bridge';

// Re-export nodes for direct access
export * from './nodes';

// Bridge nodes
export * from './three-tsl-bridge';

// React hooks
export * from './useMaterialGraph';

// Presets
export * from './presets';
