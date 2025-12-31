/**
 * @package fluid-2d/materials/nodes/shading
 * SubsurfaceNode — Subsurface scattering approximation for translucent fluids
 * 
 * Creates the soft, glowing appearance of light passing through translucent
 * materials like milk, wax, or colored liquids.
 */

import { Fn, vec3, vec4, float, dot, max, pow, clamp, mix, exp } from 'three/tsl';
import type { MaterialNodeDefinition, MaterialBuildContext, ShaderNodeObject, UniformNode } from '../../types';
import { registerMaterialNode } from '../../MaterialNodeRegistry';

/**
 * Cheap subsurface approximation based on view-dependent thickness
 */
const subsurfaceApprox = Fn(([thickness, scatterColor, distortion, power]: [any, any, any, any]) => {
    // Simulate light scattering through material
    const scatter = exp(thickness.negate().mul(distortion));
    return scatterColor.mul(pow(scatter, power));
});

export const subsurfaceNodeDef: MaterialNodeDefinition = {
    id: 'subsurface',
    label: 'Subsurface Scatter',
    category: 'shading',
    gpuCost: 4,

    inputs: [
        { id: 'color', label: 'Base Color', type: 'color' },
        { id: 'density', label: 'Density', type: 'float' },
        { id: 'normal', label: 'Normal', type: 'vec3' },
    ],

    outputs: [
        { id: 'color', label: 'Color', type: 'color' },
        { id: 'scatter', label: 'Scatter', type: 'float' },
    ],

    params: {
        intensity: {
            label: 'Intensity',
            type: 'float',
            default: 0.5,
            min: 0,
            max: 2,
            step: 0.01,
        },
        thickness: {
            label: 'Thickness',
            type: 'float',
            default: 0.5,
            min: 0,
            max: 2,
            step: 0.01,
        },
        scatterColorR: {
            label: 'Scatter R',
            type: 'float',
            default: 1.0,
            min: 0,
            max: 1,
            step: 0.01,
        },
        scatterColorG: {
            label: 'Scatter G',
            type: 'float',
            default: 0.8,
            min: 0,
            max: 1,
            step: 0.01,
        },
        scatterColorB: {
            label: 'Scatter B',
            type: 'float',
            default: 0.5,
            min: 0,
            max: 1,
            step: 0.01,
        },
        distortion: {
            label: 'Distortion',
            type: 'float',
            default: 0.5,
            min: 0,
            max: 2,
            step: 0.01,
        },
        power: {
            label: 'Power',
            type: 'float',
            default: 2.0,
            min: 0.5,
            max: 8,
            step: 0.1,
        },
        ambient: {
            label: 'Ambient',
            type: 'float',
            default: 0.1,
            min: 0,
            max: 1,
            step: 0.01,
        },
    },

    build: (
        inputs: Record<string, ShaderNodeObject>,
        params: Record<string, UniformNode>,
        context: MaterialBuildContext
    ): Record<string, ShaderNodeObject> => {
        const baseColor = inputs.color ?? vec4(0.5, 0.5, 0.5, 1.0);
        const density = inputs.density ?? float(0.5);
        const normal = inputs.normal ?? vec3(0, 0, 1);

        // Scatter color from params
        const scatterColor = vec3(
            params.scatterColorR,
            params.scatterColorG,
            params.scatterColorB
        );

        // Thickness derived from density and thickness param
        const effectiveThickness = density.mul(params.thickness);

        // Light direction (back-lit for subsurface effect)
        const lightDir = vec3(0, 0, -1);

        // View-dependent scatter (wrap lighting approximation)
        const nDotL = dot(normal, lightDir);
        const wrap = nDotL.add(1).mul(0.5); // Wrap lighting [0,1]

        // Subsurface contribution
        const scatterAmount = subsurfaceApprox(
            effectiveThickness,
            scatterColor,
            params.distortion,
            params.power
        );

        // Combine with wrap lighting
        const sss = scatterAmount.mul(wrap).mul(params.intensity);

        // Add ambient scatter
        const ambientScatter = scatterColor.mul(params.ambient).mul(density);

        // Final color = base + subsurface + ambient
        const finalColor = baseColor.xyz.add(sss).add(ambientScatter);

        // Calculate scalar scatter value for masking
        const scatterIntensity = dot(sss, vec3(0.299, 0.587, 0.114));

        return {
            color: vec4(clamp(finalColor, vec3(0), vec3(10)), float(1.0)),
            scatter: scatterIntensity,
        };
    },

    documentation: `
Approximates subsurface scattering for translucent fluid materials.
Creates the soft, glowing appearance of light passing through liquids.

**Inputs:**
- Color: Base surface color
- Density: Fluid density (thicker = more scatter)
- Normal: Surface normal for wrap lighting

**Outputs:**
- Color: Final color with subsurface effects
- Scatter: Scatter intensity for further effects

**Use cases:**
- Milk, cream effects
- Colored translucent liquids
- Wax/candle looks
- Glowing volumetric fluids
    `,
};

// Register the node
registerMaterialNode(subsurfaceNodeDef);

export default subsurfaceNodeDef;
