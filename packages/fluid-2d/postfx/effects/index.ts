/**
 * @package fluid-2d/postfx/effects
 * Effect Definitions Index — Auto-registers all effects
 */

// Import all effect definitions (auto-registers on import)
export { bloomEffect } from './bloomEffect';
export { chromaticEffect } from './chromaticEffect';
export { gradingEffect } from './gradingEffect';
export { grainEffect } from './grainEffect';
export { motionBlurEffect } from './motionBlurEffect';
export { sharpenEffect } from './sharpenEffect';
export { vignetteEffect } from './vignetteEffect';

// Re-export registry functions
export {
    effectRegistry,
    registerEffect,
    getEffect,
    getAllEffects,
    getEffectsByCategory
} from '../types';
