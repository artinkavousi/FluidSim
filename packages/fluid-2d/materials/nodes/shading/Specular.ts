/**
 * @package fluid-2d/materials/nodes/shading
 * SpecularNode — Physically-based specular highlights for fluid materials
 * 
 * Provides adjustable specular highlights with roughness-based falloff,
 * Blinn-Phong and GGX-inspired models for realistic liquid sheen.
 */

import { Fn, vec3, vec4, float, dot, max, pow, normalize, mix, clamp } from 'three/tsl';
import type { MaterialNodeDefinition, MaterialBuildContext, ShaderNodeObject, UniformNode } from '../../types';
import { registerMaterialNode } from '../../MaterialNodeRegistry';

/**
 * Calculate specular highlight using Blinn-Phong model
 */
const blinnPhongSpecular = Fn(([normal, lightDir, viewDir, power]: [any, any, any, any]) => {
    const halfVec = normalize(lightDir.add(viewDir));
    const nDotH = max(dot(normal, halfVec), float(0.0));
    return pow(nDotH, power);
});

/**
 * Calculate specular with GGX-inspired roughness distribution
 * More physically accurate for glossy surfaces
 */
const ggxSpecular = Fn(([normal, lightDir, viewDir, roughness]: [any, any, any, any]) => {
    const halfVec = normalize(lightDir.add(viewDir));
    const nDotH = max(dot(normal, halfVec), float(0.0));
    const alpha = roughness.mul(roughness);
    const alpha2 = alpha.mul(alpha);
    const denom = nDotH.mul(nDotH).mul(alpha2.sub(1)).add(1);
    return alpha2.div(denom.mul(denom).mul(3.14159));
});

export const specularNodeDef: MaterialNodeDefinition = {
    id: 'specular',
    label: 'Specular Highlight',
    category: 'shading',
    gpuCost: 3,

    inputs: [
        { id: 'color', label: 'Base Color', type: 'color' },
        { id: 'normal', label: 'Normal', type: 'vec3' },
    ],

    outputs: [
        { id: 'color', label: 'Color', type: 'color' },
        { id: 'specular', label: 'Specular', type: 'float' },
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
        roughness: {
            label: 'Roughness',
            type: 'float',
            default: 0.3,
            min: 0.01,
            max: 1,
            step: 0.01,
        },
        specularColor: {
            label: 'Specular Color',
            type: 'color',
            default: [1, 1, 1],
        },
        lightX: {
            label: 'Light X',
            type: 'float',
            default: 0.35,
            min: -1,
            max: 1,
            step: 0.01,
        },
        lightY: {
            label: 'Light Y',
            type: 'float',
            default: 0.55,
            min: -1,
            max: 1,
            step: 0.01,
        },
        lightZ: {
            label: 'Light Z',
            type: 'float',
            default: 1.0,
            min: -1,
            max: 1,
            step: 0.01,
        },
        model: {
            label: 'Model',
            type: 'int',
            default: 0, // 0 = Blinn-Phong, 1 = GGX
            min: 0,
            max: 1,
            step: 1,
        },
    },

    build: (
        inputs: Record<string, ShaderNodeObject>,
        params: Record<string, UniformNode>,
        context: MaterialBuildContext
    ): Record<string, ShaderNodeObject> => {
        const baseColor = inputs.color ?? vec4(0.5, 0.5, 0.5, 1.0);
        const normal = inputs.normal ?? vec3(0, 0, 1);

        // Light and view directions
        const lightDir = normalize(vec3(params.lightX, params.lightY, params.lightZ));
        const viewDir = vec3(0, 0, 1); // Orthographic view for 2D

        // Calculate specular based on model
        const roughness = clamp(params.roughness, float(0.01), float(1.0));
        const power = float(1).div(roughness.mul(roughness).add(0.001)).mul(32); // Roughness to power conversion

        // Use Blinn-Phong (model=0) or GGX-like (model=1)
        const blinnSpec = blinnPhongSpecular(normal, lightDir, viewDir, power);
        const ggxSpec = ggxSpecular(normal, lightDir, viewDir, roughness);

        // Select model (simplified without branch)
        const specValue = mix(blinnSpec, ggxSpec, clamp(float(params.model), float(0), float(1)));
        const specIntensity = specValue.mul(params.intensity);

        // Apply specular color
        const specColorArr = params.specularColor.value as number[] | undefined;
        const specColor = specColorArr
            ? vec3(specColorArr[0] ?? 1, specColorArr[1] ?? 1, specColorArr[2] ?? 1)
            : vec3(1, 1, 1);

        const specContrib = specColor.mul(specIntensity);
        const finalColor = baseColor.xyz.add(specContrib);

        return {
            color: vec4(clamp(finalColor, vec3(0), vec3(10)), float(1.0)),
            specular: specIntensity,
        };
    },

    documentation: `
Adds specular highlights to a base color using gradient-derived normals.
Supports Blinn-Phong (fast) and GGX-inspired (realistic) specular models.

**Inputs:**
- Color: Base color to add specular to
- Normal: Surface normal from NormalFromGradient node

**Outputs:**
- Color: Base + specular highlights
- Specular: Raw specular intensity for further processing
    `,
};

// Register the node
registerMaterialNode(specularNodeDef);

export default specularNodeDef;
