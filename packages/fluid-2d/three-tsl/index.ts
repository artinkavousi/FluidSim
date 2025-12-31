/**
 * @package fluid-2d/three-tsl
 * Three.js TSL Local Extensions — Main Entry Point
 * 
 * This module provides local copies and extensions of Three.js TSL nodes
 * for independent, offline-capable operation. Organized by category:
 * 
 * - display/  : Post-processing effects (Bloom, FXAA, etc.)
 * - color/    : Color processing functions (sepia, bleach, grading)
 * - utils/    : Animation utilities (oscillators, noise, easing)
 */

// Color processing (local TypeScript)
export * from './color';

// Animation utilities (local TypeScript)
export * from './utils';

// Display nodes are in .js and imported directly where needed:
// import { bloom } from './three-tsl/display/BloomNode';
// import { fxaa } from './three-tsl/display/FXAANode';
// etc.
