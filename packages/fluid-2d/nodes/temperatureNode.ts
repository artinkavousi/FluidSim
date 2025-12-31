/**
 * @package fluid-2d/nodes
 * Temperature Node — Advection and manipulation of a temperature scalar field
 * 
 * Temperature can be used for:
 * - Combustion-like effects (hot areas rise)
 * - Temperature-driven buoyancy (replaces dye-density buoyancy)
 * - Heat dissipation/cooling effects
 */

import * as THREE from 'three/webgpu';
import {
    Fn,
    uniform,
    instanceIndex,
    ivec2,
    vec2,
    vec4,
    float,
    int,
    floor,
    fract,
    mix,
    clamp,
    textureLoad,
    textureStore,
} from 'three/tsl';

// ============================================
// Temperature Advection
// ============================================

export interface TemperatureAdvectCompute {
    compute: any;
    uniforms: { dt: any; dissipation: any; cooling: any };
}

/**
 * Create a compute node that advects temperature along the velocity field
 */
export function createTemperatureAdvectNode(
    velocityTex: THREE.StorageTexture,
    temperatureRead: THREE.StorageTexture,
    temperatureWrite: THREE.StorageTexture,
    velWidth: number,
    velHeight: number,
    tempWidth: number,
    tempHeight: number
): TemperatureAdvectCompute {
    const dt = uniform(1 / 60);
    const dissipation = uniform(0.99);
    const cooling = uniform(0.01);

    const advect = Fn(() => {
        const idx = instanceIndex;
        const x = idx.mod(tempWidth);
        const y = idx.div(tempWidth);
        const pos = ivec2(x, y);

        // Map temperature coordinates to velocity coordinates
        const velScaleX = float(velWidth).div(float(tempWidth));
        const velScaleY = float(velHeight).div(float(tempHeight));
        const velX = float(x).mul(velScaleX);
        const velY = float(y).mul(velScaleY);

        // Sample velocity at this position (bilinear)
        const velPosFloor = ivec2(int(floor(velX)), int(floor(velY)));
        const velPosFract = vec2(fract(velX), fract(velY));

        const v00 = textureLoad(velocityTex, velPosFloor).rg;
        const v10 = textureLoad(velocityTex, velPosFloor.add(ivec2(1, 0))).rg;
        const v01 = textureLoad(velocityTex, velPosFloor.add(ivec2(0, 1))).rg;
        const v11 = textureLoad(velocityTex, velPosFloor.add(ivec2(1, 1))).rg;

        const vel = mix(
            mix(v00, v10, velPosFract.x),
            mix(v01, v11, velPosFract.x),
            velPosFract.y
        );

        // Backtrace using RK2 / midpoint
        const halfDt = dt.mul(0.5);
        const midX = float(x).sub(vel.x.mul(halfDt).mul(float(tempWidth)));
        const midY = float(y).sub(vel.y.mul(halfDt).mul(float(tempHeight)));

        // Sample velocity at midpoint
        const midVelX = midX.mul(velScaleX);
        const midVelY = midY.mul(velScaleY);
        const midVelPos = ivec2(int(clamp(midVelX, float(0), float(velWidth - 1))), int(clamp(midVelY, float(0), float(velHeight - 1))));
        const midVel = textureLoad(velocityTex, midVelPos).rg;

        // Final backtrace position
        const backX = float(x).sub(midVel.x.mul(dt).mul(float(tempWidth)));
        const backY = float(y).sub(midVel.y.mul(dt).mul(float(tempHeight)));

        // Bilinear sample temperature at backtrace position
        const backFloor = ivec2(
            int(clamp(floor(backX), float(0), float(tempWidth - 1))),
            int(clamp(floor(backY), float(0), float(tempHeight - 1)))
        );
        const backFract = vec2(fract(backX), fract(backY));

        const t00 = textureLoad(temperatureRead, backFloor).x;
        const t10 = textureLoad(temperatureRead, backFloor.add(ivec2(1, 0))).x;
        const t01 = textureLoad(temperatureRead, backFloor.add(ivec2(0, 1))).x;
        const t11 = textureLoad(temperatureRead, backFloor.add(ivec2(1, 1))).x;

        const temp = mix(
            mix(t00, t10, backFract.x),
            mix(t01, t11, backFract.x),
            backFract.y
        );

        // Apply dissipation and cooling
        const newTemp = temp.mul(dissipation).sub(cooling.mul(dt));
        const clampedTemp = clamp(newTemp, float(0), float(10));

        textureStore(temperatureWrite, pos, vec4(clampedTemp, 0, 0, 1)).toWriteOnly();
    })().compute(tempWidth * tempHeight);

    return {
        compute: advect,
        uniforms: { dt, dissipation, cooling },
    };
}

// ============================================
// Temperature Splat
// ============================================

export interface TemperatureSplatCompute {
    compute: any;
    uniforms: { splatPos: any; temperature: any; radius: any; softness: any; falloff: any; blendMode: any };
}

/**
 * Create a compute node that injects temperature at a point
 */
export function createTemperatureSplatNode(
    temperatureRead: THREE.StorageTexture,
    temperatureWrite: THREE.StorageTexture,
    width: number,
    height: number
): TemperatureSplatCompute {
    const splatPos = uniform(new THREE.Vector2(0.5, 0.5));
    const temperature = uniform(1.0);
    const radius = uniform(0.02);
    const softness = uniform(0.8);
    const falloff = uniform(2.0);
    const blendMode = uniform(0); // 0 = add, 1 = replace, 2 = max

    const splat = Fn(() => {
        const idx = instanceIndex;
        const x = idx.mod(width);
        const y = idx.div(width);
        const pos = ivec2(x, y);

        // Normalized coordinates
        const uv = vec2(float(x).div(float(width)), float(y).div(float(height)));

        // Distance from splat center
        const aspect = float(width).div(float(height));
        const diff = vec2(
            uv.x.sub(splatPos.x).mul(aspect),
            uv.y.sub(splatPos.y)
        );
        const dist = diff.length();

        // Gaussian-like falloff
        const t = clamp(dist.div(radius), float(0), float(1));
        const edge = float(1).sub(softness);
        const falloffValue = clamp(float(1).sub(t.sub(edge).div(float(1).sub(edge))), float(0), float(1));
        const weight = falloffValue.pow(falloff);

        // Read existing temperature
        const existing = textureLoad(temperatureRead, pos).x;

        // Blend based on mode
        const splatTemp = temperature.mul(weight);
        const mode = int(blendMode);

        // Mode 0: Add
        const resultAdd = existing.add(splatTemp);
        // Mode 1: Replace (blend)
        const resultReplace = mix(existing, temperature, weight);
        // Mode 2: Max
        const resultMax = existing.max(splatTemp);

        // Select result based on mode (simplified: just use add for now)
        const result = resultAdd;

        textureStore(temperatureWrite, pos, vec4(clamp(result, float(0), float(10)), 0, 0, 1)).toWriteOnly();
    })().compute(width * height);

    return {
        compute: splat,
        uniforms: { splatPos, temperature, radius, softness, falloff, blendMode },
    };
}

// ============================================
// Temperature-Based Buoyancy
// ============================================

export interface TemperatureBuoyancyCompute {
    compute: any;
    uniforms: { dt: any; strength: any; ambient: any };
}

/**
 * Create a compute node that applies buoyancy force based on temperature
 * Hot regions (temperature > ambient) rise, cold regions sink
 */
export function createTemperatureBuoyancyNode(
    velocityRead: THREE.StorageTexture,
    temperatureTex: THREE.StorageTexture,
    velocityWrite: THREE.StorageTexture,
    velWidth: number,
    velHeight: number,
    tempWidth: number,
    tempHeight: number
): TemperatureBuoyancyCompute {
    const dt = uniform(1 / 60);
    const strength = uniform(1.0);
    const ambient = uniform(0.0);

    const buoyancy = Fn(() => {
        const idx = instanceIndex;
        const x = idx.mod(velWidth);
        const y = idx.div(velWidth);
        const pos = ivec2(x, y);

        // Map velocity coordinates to temperature coordinates
        const tempX = int(float(x).mul(float(tempWidth)).div(float(velWidth)));
        const tempY = int(float(y).mul(float(tempHeight)).div(float(velHeight)));
        const tempPos = ivec2(tempX, tempY);

        // Read temperature
        const temp = textureLoad(temperatureTex, tempPos).x;

        // Read velocity
        const vel = textureLoad(velocityRead, pos).rg;

        // Buoyancy force: upward when temp > ambient
        const tempDiff = temp.sub(ambient);
        const buoyancyForce = tempDiff.mul(strength).mul(dt);

        // Apply force (upward = positive Y)
        const newVel = vec2(vel.x, vel.y.add(buoyancyForce));

        textureStore(velocityWrite, pos, vec4(newVel.x, newVel.y, 0, 1)).toWriteOnly();
    })().compute(velWidth * velHeight);

    return {
        compute: buoyancy,
        uniforms: { dt, strength, ambient },
    };
}

// ============================================
// Temperature Clear
// ============================================

export interface TemperatureClearCompute {
    compute: any;
    uniforms: { value: any };
}

/**
 * Create a compute node that clears the temperature field to a constant value
 */
export function createTemperatureClearNode(
    temperatureTex: THREE.StorageTexture,
    width: number,
    height: number
): TemperatureClearCompute {
    const value = uniform(0.0);

    const clear = Fn(() => {
        const idx = instanceIndex;
        const x = idx.mod(width);
        const y = idx.div(width);
        const pos = ivec2(x, y);

        textureStore(temperatureTex, pos, vec4(value, 0, 0, 1)).toWriteOnly();
    })().compute(width * height);

    return {
        compute: clear,
        uniforms: { value },
    };
}
