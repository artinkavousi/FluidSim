/**
 * @package fluid-2d
 * FluidSolver2D - Core 2D Fluid Simulation Solver using TSL
 * 
 * Uses StorageTexture for compute (textureStore/textureLoad) and rendering (texture()).
 * StorageTexture extends Texture, so it can be sampled directly in fragment shaders.
 */

import * as THREE from 'three/webgpu';
import {
    PingPongTexture, SingleTexture,
    PassGraph, type Pass,
    type PassGroup,
    type PassMetadata,
    type PassTiming,
    type FieldMemoryStats,
    FieldRegistry, createStandardFieldRegistry
} from './core';
import {
    createAdvectionNode,
    createDyeAdvectionNode,
    createDivergenceNode,
    createPressureSolveNode,
    createGradientSubtractNode,
    createVorticityNode,
    createVorticityForceNode,
    createVelocitySplatNode,
    createDyeSplatNode,
    createVelocitySplatInPlaceTileNode,
    createDyeSplatInPlaceTileNode,
    createBatchedVelocitySplatNode,
    createBatchedDyeSplatNode,
    type SplatBatchCompute,
    type PackedSplat,
    createClearNode,
    createViscosityNode,
    createTurbulenceNode,
    createBuoyancyNode,
    createVelocityBoundaryNode,
    createDyeBoundaryNode,
    createGravityNode,
    createVelocityMacCormackCorrectNode,
    createDyeMacCormackCorrectNode,
    createTemperatureAdvectNode,
    createTemperatureSplatNode,
    createTemperatureBuoyancyNode,
    createTemperatureClearNode,
    createPressureResidualNode,
    createRestrict2xNode,
    createProlongateAddNode,
    createMacDivergenceNode,
    createMacGradientSubtractNode,
    createMacVelocityBoundaryNode,
    createFuelAdvectNode,
    createFuelSplatNode,
    createCombustionNode,
    createFireDyeNode,
    createDyeChannelDissipationNode,
    createObstacleSplatInPlaceTileNode,
    createObstacleEnforceVelocityNode,
    createObstacleEnforceDyeNode,
    createObstacleEnforceScalarNode,
    type AdvectionCompute,
    type DivergenceCompute,
    type PressureCompute,
    type GradientSubtractCompute,
    type VorticityCompute,
    type VorticityForceCompute,
    type SplatCompute,
    type ViscosityCompute,
    type TurbulenceCompute,
    type BuoyancyCompute,
    type GravityCompute,
    type MacCormackCompute,
    type BoundaryCompute,
    type TemperatureAdvectCompute,
    type TemperatureSplatCompute,
    type TemperatureBuoyancyCompute,
    type TemperatureClearCompute,
} from './nodes';
import type { Splat } from './types';

type WebGPURenderer = THREE.WebGPURenderer;

// ============================================
// Configuration Types (ported from v1)
// ============================================

export interface FluidConfig2D {
    // Grid dimensions
    gridSize: number;
    dyeSize: number;

    // Simulation parameters
    simSpeed: number;
    containFluid: boolean;
    useMacCormack: boolean;

    // Velocity parameters
    velocityForce: number;
    velocityRadius: number;
    velocityDissipation: number;

    // Dye parameters
    dyeIntensity: number;
    dyeRadius: number;
    dyeDissipation: number;

    // Advanced parameters
    viscosity: number;
    vorticity: number;
    // P2: Advanced vorticity options
    vorticityEdgeAwareEnabled: boolean;
    vorticityEdgeAwareStrength: number; // 0..2 typical
    vorticityScaleMix: number; // 0..1 blend between small and large scale confinement

    // P2: Staggered-style projection (MAC) option
    macGridEnabled: boolean;
    pressureIterations: number;
    pressureAdaptive: boolean;
    pressureMinIterations: number;
    pressureMaxIterations: number;

    // Forces
    gravity: [number, number];
    buoyancy: number;

    // Turbulence
    turbulence: number;
    turbulenceOctaves: number;
    turbulenceSpeed: number;

    // Splat quality
    splatQuality: number;
    // Cap splat passes to avoid frame spikes (expanded symmetry splats count).
    maxSplatsPerFrame: number;
    // Use tiled in-place splats to avoid full-texture dispatch per splat.
    splatTiledEnabled: boolean;
    // Use GPU buffer-based batch splats for maximum throughput (single dispatch).
    splatBatchEnabled: boolean;
    // Maximum splats per batch dispatch (only used when splatBatchEnabled)
    splatBatchMaxCount: number;

    // Symmetry
    symmetry: number;

    // Studio UI / Advanced Controls
    splatFalloff: number;
    splatBlendMode: number;
    dyeSplatRadius: number;
    forceSplatRadius: number;
    splatSoftness: number;
    splatColorBoost: number;
    splatVelocityScale: number;

    mouseForce: number;
    mouseRadius: number;

    advectionMode: number;
    pressureSolver: number;
    sorOmega: number;
    velocityDiffusion: number;
    // P2: Multi-resolution pressure solver (2-level V-cycle correction)
    pressureMultigridEnabled: boolean;
    pressureMultigridPreSmooth: number;
    pressureMultigridPostSmooth: number;
    pressureMultigridCoarseIterations: number;

    turbulenceEnabled: boolean;
    turbulenceScale: number;
    turbulenceStrength: number;

    buoyancyEnabled: boolean;
    buoyancyStrength: number;
    ambientTemperature: number;

    // P3: Multiphase (RGB dye phases)
    multiphaseEnabled: boolean;
    multiphaseDyeDissipationRGB: [number, number, number];
    multiphaseBuoyancyWeightsRGB: [number, number, number];

    // Timestep control
    substepsEnabled: boolean;
    substepsMax: number;
    substepsDtMax: number; // seconds

    // Temperature field (combustion-like effects)
    temperatureEnabled: boolean;
    temperatureDissipation: number; // 0..1, how fast temp decays
    temperatureCooling: number; // constant cooling rate per second
    temperatureBuoyancyEnabled: boolean; // use temp-based buoyancy instead of dye
    temperatureBuoyancyStrength: number;
    temperatureAmbient: number;

    // Fuel + combustion system
    fuelEnabled: boolean;
    fuelDissipation: number;
    combustionEnabled: boolean;
    combustionRate: number;
    combustionIgniteTemp: number;
    combustionHeatPerFuel: number;
    combustionTempDamp: number;
    fireDyeEnabled: boolean;
    fireDyeIntensity: number;
    fireDyeTempScale: number;

    // Obstacles (solid mask field)
    obstaclesEnabled: boolean;
    obstacleThreshold: number; // 0..1

    // Adaptive quality (driven by app/store; solver supports resize via setConfig())
    autoQualityEnabled: boolean;
    autoQualityTargetFps: number;
    autoQualityMinGridSize: number;
    autoQualityMaxGridSize: number;
    autoQualityMinDyeSize: number;
    autoQualityMaxDyeSize: number;
    autoQualityCooldownSec: number;

    // Debug/perf (CPU-side timings; approximate)
    perfEnabled: boolean;
    perfSmoothing: number; // EMA alpha (0..1)
}

export interface PerfStats2D {
    frameMs: number;
    splatsMs: number;
    vorticityMs: number;
    advectVelocityMs: number;
    viscosityMs: number;
    forcesMs: number; // gravity + turbulence + buoyancy
    divergenceMs: number;
    pressureMs: number;
    projectionMs: number;
    boundaryVelocityMs: number;
    advectDyeMs: number;
    boundaryDyeMs: number;
    substeps: number;
}

export const defaultConfig2D: FluidConfig2D = {
    // Balanced defaults (Quality can be selected from the UI)
    gridSize: 192,
    dyeSize: 384,
    simSpeed: 1.0,
    containFluid: false,
    useMacCormack: false,
    velocityForce: 8.0,
    velocityRadius: 0.015,
    velocityDissipation: 0.98,
    dyeIntensity: 8.0,
    dyeRadius: 0.02,
    dyeDissipation: 0.985,
    viscosity: 0.2,
    vorticity: 12.0,
    vorticityEdgeAwareEnabled: false,
    vorticityEdgeAwareStrength: 1.0,
    vorticityScaleMix: 0.0,
    macGridEnabled: false,
    pressureIterations: 22,
    pressureAdaptive: true,
    pressureMinIterations: 6,
    pressureMaxIterations: 80,
    gravity: [0, 0],
    buoyancy: 0.0,
    turbulence: 0.0,
    turbulenceOctaves: 3,
    turbulenceSpeed: 1.0,
    splatQuality: 2.0,
    maxSplatsPerFrame: 32,
    splatTiledEnabled: true,
    splatBatchEnabled: false,
    splatBatchMaxCount: 256,
    symmetry: 0,

    splatFalloff: 2,
    splatBlendMode: 0,
    dyeSplatRadius: 1.0,
    forceSplatRadius: 1.0,
    splatSoftness: 0.8,
    splatColorBoost: 1.5,
    splatVelocityScale: 1.0,
    mouseForce: 0.3,
    mouseRadius: 0.03,
    advectionMode: 0,
    pressureSolver: 0,
    sorOmega: 1.8,
    velocityDiffusion: 0.997,
    pressureMultigridEnabled: false,
    pressureMultigridPreSmooth: 6,
    pressureMultigridPostSmooth: 6,
    pressureMultigridCoarseIterations: 24,
    turbulenceEnabled: false,
    turbulenceScale: 1.0,
    turbulenceStrength: 0.5,
    buoyancyEnabled: false,
    buoyancyStrength: 0.0,
    ambientTemperature: 0.0,

    multiphaseEnabled: false,
    multiphaseDyeDissipationRGB: [1.0, 1.0, 1.0],
    multiphaseBuoyancyWeightsRGB: [0.3333333, 0.3333333, 0.3333333],

    // Avoid "death spiral" on slower machines (clamp dt rather than substepping).
    substepsEnabled: false,
    substepsMax: 2,
    substepsDtMax: 1.0 / 60.0,

    // Temperature defaults
    temperatureEnabled: false,
    temperatureDissipation: 0.99,
    temperatureCooling: 0.02,
    temperatureBuoyancyEnabled: false,
    temperatureBuoyancyStrength: 1.0,
    temperatureAmbient: 0.0,

    fuelEnabled: false,
    fuelDissipation: 0.99,
    combustionEnabled: false,
    combustionRate: 1.0,
    combustionIgniteTemp: 0.25,
    combustionHeatPerFuel: 2.0,
    combustionTempDamp: 0.995,
    fireDyeEnabled: true,
    fireDyeIntensity: 0.25,
    fireDyeTempScale: 1.0,

    // Obstacles defaults
    obstaclesEnabled: false,
    obstacleThreshold: 0.5,

    autoQualityEnabled: false,
    autoQualityTargetFps: 60,
    autoQualityMinGridSize: 96,
    autoQualityMaxGridSize: 256,
    autoQualityMinDyeSize: 192,
    autoQualityMaxDyeSize: 512,
    autoQualityCooldownSec: 1.5,

    perfEnabled: false,
    perfSmoothing: 0.12,
};

export class FluidSolver2D {
    public graph: PassGraph;
    private renderer: WebGPURenderer;
    private config: FluidConfig2D;
    private running = true;

    // Field Registry (manages all textures and states)
    public fields: FieldRegistry;

    // Compute nodes
    private velocityAdvect!: { aToB: AdvectionCompute; bToA: AdvectionCompute };
    private velocityAdvectTemp!: { fromA: AdvectionCompute; fromB: AdvectionCompute };
    private velocityMacCormack!: { fromA: MacCormackCompute; fromB: MacCormackCompute };
    private dyeAdvect!: {
        velA_dyeA_toB: AdvectionCompute;
        velB_dyeA_toB: AdvectionCompute;
        velA_dyeB_toA: AdvectionCompute;
        velB_dyeB_toA: AdvectionCompute;
    };
    private dyeAdvectTemp!: {
        velA_dyeA_toTemp: AdvectionCompute;
        velB_dyeA_toTemp: AdvectionCompute;
        velA_dyeB_toTemp: AdvectionCompute;
        velB_dyeB_toTemp: AdvectionCompute;
    };
    private dyeMacCormack!: {
        velA_dyeA_toB: MacCormackCompute;
        velB_dyeA_toB: MacCormackCompute;
        velA_dyeB_toA: MacCormackCompute;
        velB_dyeB_toA: MacCormackCompute;
    };
    private divergenceCompute!: { fromA: DivergenceCompute; fromB: DivergenceCompute };
    private divergenceComputeMac!: { fromA: any; fromB: any };
    private pressureSolve!: { aToB: PressureCompute; bToA: PressureCompute };
    private gradientSubtract!: {
        velA_pA_toB: GradientSubtractCompute;
        velA_pB_toB: GradientSubtractCompute;
        velB_pA_toA: GradientSubtractCompute;
        velB_pB_toA: GradientSubtractCompute;
    };
    private gradientSubtractMac!: { velA_pA_toB: any; velA_pB_toB: any; velB_pA_toA: any; velB_pB_toA: any };
    private vorticityCompute!: { fromA: VorticityCompute; fromB: VorticityCompute };
    private vorticityForce!: { aToB: VorticityForceCompute; bToA: VorticityForceCompute };
    private velocitySplat!: { aToB: SplatCompute; bToA: SplatCompute };
    private dyeSplat!: { aToB: SplatCompute; bToA: SplatCompute };
    private velocitySplatTile!: { fromA: SplatCompute; fromB: SplatCompute; tileSize: number };
    private dyeSplatTile!: { fromA: SplatCompute; fromB: SplatCompute; tileSize: number };
    private velocitySplatBatch: { aToB: SplatBatchCompute; bToA: SplatBatchCompute } | null = null;
    private dyeSplatBatch: { aToB: SplatBatchCompute; bToA: SplatBatchCompute } | null = null;
    private obstacleSplatTile!: { compute: any; uniforms: any; tileSize: number };
    private obstacleEnforceVelocity!: { aToB: any; bToA: any };
    private obstacleEnforceDye!: { aToB: any; bToA: any };
    private obstacleEnforceTemperature: { aToB: any; bToA: any } | null = null;
    private obstaclesClearCompute: any | null = null;
    private viscosity!: { aToB: ViscosityCompute; bToA: ViscosityCompute };
    private turbulence!: { aToB: TurbulenceCompute; bToA: TurbulenceCompute };
    private buoyancy!: {
        velA_dyeA_toB: BuoyancyCompute;
        velA_dyeB_toB: BuoyancyCompute;
        velB_dyeA_toA: BuoyancyCompute;
        velB_dyeB_toA: BuoyancyCompute;
    };
    private dyeChannelDissipation: { aToB: any; bToA: any } | null = null;
    private velocityBoundary!: { aToB: BoundaryCompute; bToA: BoundaryCompute };
    private velocityBoundaryMac!: { aToB: any; bToA: any };
    private dyeBoundary!: { aToB: BoundaryCompute; bToA: BoundaryCompute };
    private gravity!: { aToB: GravityCompute; bToA: GravityCompute };

    // Multi-resolution pressure helpers (optional)
    private pressureResidual!: { fromA: any; fromB: any };
    private residualRestrict!: any;
    private coarsePressureSolve!: { aToB: PressureCompute; bToA: PressureCompute };
    private coarseProlongateAdd!: { fineA_coarseA_toB: any; fineA_coarseB_toB: any; fineB_coarseA_toA: any; fineB_coarseB_toA: any };
    private coarsePressureClear!: { a: any; b: any };

    // Temperature compute nodes (optional)
    private tempAdvect: { aToB: TemperatureAdvectCompute; bToA: TemperatureAdvectCompute } | null = null;
    private tempSplat: { aToB: TemperatureSplatCompute; bToA: TemperatureSplatCompute } | null = null;
    private tempBuoyancy: {
        velA_tempA_toB: TemperatureBuoyancyCompute;
        velA_tempB_toB: TemperatureBuoyancyCompute;
        velB_tempA_toA: TemperatureBuoyancyCompute;
        velB_tempB_toA: TemperatureBuoyancyCompute;
    } | null = null;
    private tempClear: TemperatureClearCompute | null = null;

    private fuelAdvect: { aToB: any; bToA: any } | null = null;
    private fuelSplat: { aToB: any; bToA: any } | null = null;
    private combustion: { aToB: any; bToA: any } | null = null;
    private fireDye: { aToB: any; bToA: any } | null = null;

    // Clear nodes (cached)
    private clearComputes: any[] = [];

    // Splat queues (raw -> expanded), capped per-frame for stability/perf.
    private splatQueueRaw: Splat[] = [];
    private splatQueueExpanded: Splat[] = [];
    private splatQueueExpandedStart = 0;
    private time = 0;
    private lastFrame = performance.now();

    private perfStats: PerfStats2D | null = null;

    constructor(renderer: WebGPURenderer, config: Partial<FluidConfig2D> = {}) {
        this.renderer = renderer;
        this.config = { ...defaultConfig2D, ...config };

        const { gridSize, dyeSize } = this.config;

        // Initialize Field Registry
        this.fields = createStandardFieldRegistry(gridSize, dyeSize);

        // Multigrid pressure fields (allocated lazily; used when pressureMultigridEnabled).
        // Note: these are registered unconditionally so toggling the option doesn't require a full solver rebuild.
        this.fields.registerAll([
            {
                id: 'pressureResidual',
                label: 'Pressure Residual',
                sizeSource: 'grid',
                format: 'rgba16float',
                pingPong: false,
                lazyAllocation: true,
                description: 'Fine residual (b - A p) for multigrid',
            },
            {
                id: 'pressureResidualCoarse',
                label: 'Pressure Residual (Coarse)',
                sizeSource: 'grid',
                format: 'rgba16float',
                pingPong: false,
                resolutionScale: 0.5,
                lazyAllocation: true,
                description: 'Coarse residual for multigrid',
            },
            {
                id: 'pressureCoarse',
                label: 'Pressure (Coarse)',
                sizeSource: 'grid',
                format: 'rgba16float',
                pingPong: true,
                resolutionScale: 0.5,
                lazyAllocation: true,
                description: 'Coarse pressure/error buffer for multigrid',
            },
        ]);

        // Temperature field (registered lazily so it can be enabled later without recreating the solver).
        this.fields.register({
            id: 'temperature',
            label: 'Temperature',
            sizeSource: 'grid',
            format: 'rgba16float',
            pingPong: true,
            lazyAllocation: true,
            debug: { colorMap: 'heatmap', scale: 0.1, bias: 0 },
            description: 'Temperature field (Heat)',
        });

        // Fuel field (registered lazily so it can be enabled later without recreating the solver).
        this.fields.register({
            id: 'fuel',
            label: 'Fuel',
            sizeSource: 'grid',
            format: 'rgba16float',
            pingPong: true,
            lazyAllocation: true,
            debug: { colorMap: 'heatmap', scale: 0.1, bias: 0 },
            description: 'Fuel scalar field for combustion/reaction',
        });

        // Initialize compute nodes
        this.initializeComputeNodes();

        // Initialize PassGraph
        this.graph = new PassGraph();
        this.initPasses();

        // Initialize all textures to zero.
        this.clear();
    }

    private initializeComputeNodes(): void {
        const { gridSize, dyeSize } = this.config;

        // Get textures from registry
        const vel = this.fields.getBoth('velocity');
        const dye = this.fields.getBoth('dye');
        const press = this.fields.getBoth('pressure');
        const div = this.fields.getRead('divergence');
        const vort = this.fields.getRead('vorticity');
        const velTemp = this.fields.getRead('velocityTemp');
        const dyeTemp = this.fields.getRead('dyeTemp');

        // Multigrid pressure textures (coarse scale is fixed at 0.5 in field defs; config controls whether passes run).
        const pressureResidual = this.fields.getRead('pressureResidual');
        const pressureResidualCoarse = this.fields.getRead('pressureResidualCoarse');
        const coarsePress = this.fields.getBoth('pressureCoarse');
        const coarseSize = this.fields.getFieldSize('pressureCoarse');

        // Velocity advection
        this.velocityAdvect = {
            aToB: createAdvectionNode(vel.a, vel.b, gridSize, gridSize),
            bToA: createAdvectionNode(vel.b, vel.a, gridSize, gridSize),
        };
        this.velocityAdvectTemp = {
            fromA: createAdvectionNode(vel.a, velTemp, gridSize, gridSize),
            fromB: createAdvectionNode(vel.b, velTemp, gridSize, gridSize),
        };
        this.velocityMacCormack = {
            fromA: createVelocityMacCormackCorrectNode(vel.a, velTemp, vel.b, gridSize, gridSize),
            fromB: createVelocityMacCormackCorrectNode(vel.b, velTemp, vel.a, gridSize, gridSize),
        };

        // Dye advection
        this.dyeAdvect = {
            velA_dyeA_toB: createDyeAdvectionNode(vel.a, dye.a, dye.b, gridSize, gridSize, dyeSize, dyeSize),
            velB_dyeA_toB: createDyeAdvectionNode(vel.b, dye.a, dye.b, gridSize, gridSize, dyeSize, dyeSize),
            velA_dyeB_toA: createDyeAdvectionNode(vel.a, dye.b, dye.a, gridSize, gridSize, dyeSize, dyeSize),
            velB_dyeB_toA: createDyeAdvectionNode(vel.b, dye.b, dye.a, gridSize, gridSize, dyeSize, dyeSize),
        };
        this.dyeAdvectTemp = {
            velA_dyeA_toTemp: createDyeAdvectionNode(vel.a, dye.a, dyeTemp, gridSize, gridSize, dyeSize, dyeSize),
            velB_dyeA_toTemp: createDyeAdvectionNode(vel.b, dye.a, dyeTemp, gridSize, gridSize, dyeSize, dyeSize),
            velA_dyeB_toTemp: createDyeAdvectionNode(vel.a, dye.b, dyeTemp, gridSize, gridSize, dyeSize, dyeSize),
            velB_dyeB_toTemp: createDyeAdvectionNode(vel.b, dye.b, dyeTemp, gridSize, gridSize, dyeSize, dyeSize),
        };
        this.dyeMacCormack = {
            velA_dyeA_toB: createDyeMacCormackCorrectNode(vel.a, dye.a, dyeTemp, dye.b, gridSize, gridSize, dyeSize, dyeSize),
            velB_dyeA_toB: createDyeMacCormackCorrectNode(vel.b, dye.a, dyeTemp, dye.b, gridSize, gridSize, dyeSize, dyeSize),
            velA_dyeB_toA: createDyeMacCormackCorrectNode(vel.a, dye.b, dyeTemp, dye.a, gridSize, gridSize, dyeSize, dyeSize),
            velB_dyeB_toA: createDyeMacCormackCorrectNode(vel.b, dye.b, dyeTemp, dye.a, gridSize, gridSize, dyeSize, dyeSize),
        };

        // Divergence
        this.divergenceCompute = {
            fromA: createDivergenceNode(vel.a, div, gridSize, gridSize),
            fromB: createDivergenceNode(vel.b, div, gridSize, gridSize),
        };
        this.divergenceComputeMac = {
            fromA: createMacDivergenceNode(vel.a, div, gridSize, gridSize),
            fromB: createMacDivergenceNode(vel.b, div, gridSize, gridSize),
        };

        // Pressure solve
        this.pressureSolve = {
            aToB: createPressureSolveNode(press.a, div, press.b, gridSize, gridSize),
            bToA: createPressureSolveNode(press.b, div, press.a, gridSize, gridSize),
        };

        // Multigrid helpers
        this.pressureResidual = {
            fromA: createPressureResidualNode(press.a, div, pressureResidual, gridSize, gridSize),
            fromB: createPressureResidualNode(press.b, div, pressureResidual, gridSize, gridSize),
        };
        this.residualRestrict = createRestrict2xNode(
            pressureResidual,
            pressureResidualCoarse,
            gridSize,
            gridSize,
            coarseSize.width,
            coarseSize.height
        );
        this.coarsePressureSolve = {
            aToB: createPressureSolveNode(coarsePress.a, pressureResidualCoarse, coarsePress.b, coarseSize.width, coarseSize.height),
            bToA: createPressureSolveNode(coarsePress.b, pressureResidualCoarse, coarsePress.a, coarseSize.width, coarseSize.height),
        };
        this.coarseProlongateAdd = {
            fineA_coarseA_toB: createProlongateAddNode(press.a, coarsePress.a, press.b, gridSize, gridSize, coarseSize.width, coarseSize.height),
            fineA_coarseB_toB: createProlongateAddNode(press.a, coarsePress.b, press.b, gridSize, gridSize, coarseSize.width, coarseSize.height),
            fineB_coarseA_toA: createProlongateAddNode(press.b, coarsePress.a, press.a, gridSize, gridSize, coarseSize.width, coarseSize.height),
            fineB_coarseB_toA: createProlongateAddNode(press.b, coarsePress.b, press.a, gridSize, gridSize, coarseSize.width, coarseSize.height),
        };
        this.coarsePressureClear = {
            a: createClearNode(coarsePress.a, coarseSize.width, coarseSize.height).compute,
            b: createClearNode(coarsePress.b, coarseSize.width, coarseSize.height).compute,
        };

        // Gradient subtraction
        this.gradientSubtract = {
            velA_pA_toB: createGradientSubtractNode(vel.a, press.a, vel.b, gridSize, gridSize),
            velA_pB_toB: createGradientSubtractNode(vel.a, press.b, vel.b, gridSize, gridSize),
            velB_pA_toA: createGradientSubtractNode(vel.b, press.a, vel.a, gridSize, gridSize),
            velB_pB_toA: createGradientSubtractNode(vel.b, press.b, vel.a, gridSize, gridSize),
        };
        this.gradientSubtractMac = {
            velA_pA_toB: createMacGradientSubtractNode(vel.a, press.a, vel.b, gridSize, gridSize),
            velA_pB_toB: createMacGradientSubtractNode(vel.a, press.b, vel.b, gridSize, gridSize),
            velB_pA_toA: createMacGradientSubtractNode(vel.b, press.a, vel.a, gridSize, gridSize),
            velB_pB_toA: createMacGradientSubtractNode(vel.b, press.b, vel.a, gridSize, gridSize),
        };

        const obstaclesTex = this.fields.getRead('obstacles');

        // Vorticity
        this.vorticityCompute = {
            fromA: createVorticityNode(vel.a, vort, gridSize, gridSize),
            fromB: createVorticityNode(vel.b, vort, gridSize, gridSize),
        };

        // Vorticity force
        this.vorticityForce = {
            aToB: createVorticityForceNode(vel.a, vort, vel.b, gridSize, gridSize, obstaclesTex),
            bToA: createVorticityForceNode(vel.b, vort, vel.a, gridSize, gridSize, obstaclesTex),
        };

        // Splats
        this.velocitySplat = {
            aToB: createVelocitySplatNode(vel.a, vel.b, gridSize, gridSize),
            bToA: createVelocitySplatNode(vel.b, vel.a, gridSize, gridSize),
        };

        this.dyeSplat = {
            aToB: createDyeSplatNode(dye.a, dye.b, dyeSize, dyeSize),
            bToA: createDyeSplatNode(dye.b, dye.a, dyeSize, dyeSize),
        };

        // Tiled splats (updates only tiles covering the splat bounds; avoids full-texture dispatch per splat).
        const tileSize = 32;
        this.velocitySplatTile = {
            fromA: createVelocitySplatInPlaceTileNode(vel.a, gridSize, gridSize, tileSize),
            fromB: createVelocitySplatInPlaceTileNode(vel.b, gridSize, gridSize, tileSize),
            tileSize,
        };
        this.dyeSplatTile = {
            fromA: createDyeSplatInPlaceTileNode(dye.a, dyeSize, dyeSize, tileSize),
            fromB: createDyeSplatInPlaceTileNode(dye.b, dyeSize, dyeSize, tileSize),
            tileSize,
        };

        // Obstacles (single, non-pingpong field)
        this.obstacleSplatTile = {
            ...createObstacleSplatInPlaceTileNode(obstaclesTex, gridSize, gridSize, tileSize),
            tileSize,
        };
        this.obstacleEnforceVelocity = {
            aToB: createObstacleEnforceVelocityNode(vel.a, obstaclesTex, vel.b, gridSize, gridSize),
            bToA: createObstacleEnforceVelocityNode(vel.b, obstaclesTex, vel.a, gridSize, gridSize),
        };
        this.obstacleEnforceDye = {
            aToB: createObstacleEnforceDyeNode(dye.a, obstaclesTex, dye.b, dyeSize, dyeSize, gridSize, gridSize),
            bToA: createObstacleEnforceDyeNode(dye.b, obstaclesTex, dye.a, dyeSize, dyeSize, gridSize, gridSize),
        };
        if (this.config.temperatureEnabled && this.fields.isAllocated('temperature')) {
            const temp = this.fields.getBoth('temperature');
            this.obstacleEnforceTemperature = {
                aToB: createObstacleEnforceScalarNode(temp.a, obstaclesTex, temp.b, gridSize, gridSize, gridSize, gridSize),
                bToA: createObstacleEnforceScalarNode(temp.b, obstaclesTex, temp.a, gridSize, gridSize, gridSize, gridSize),
            };
        } else {
            this.obstacleEnforceTemperature = null;
        }

        this.obstaclesClearCompute = createClearNode(obstaclesTex, gridSize, gridSize).compute;

        // GPU buffer-based batch splats (single dispatch for all splats)
        if (this.config.splatBatchEnabled) {
            this.velocitySplatBatch = {
                aToB: createBatchedVelocitySplatNode(vel.a, vel.b, gridSize, gridSize, this.config.splatBatchMaxCount),
                bToA: createBatchedVelocitySplatNode(vel.b, vel.a, gridSize, gridSize, this.config.splatBatchMaxCount),
            };
            this.dyeSplatBatch = {
                aToB: createBatchedDyeSplatNode(dye.a, dye.b, dyeSize, dyeSize, this.config.splatBatchMaxCount),
                bToA: createBatchedDyeSplatNode(dye.b, dye.a, dyeSize, dyeSize, this.config.splatBatchMaxCount),
            };
        } else {
            this.velocitySplatBatch = null;
            this.dyeSplatBatch = null;
        }

        // Viscosity (diffusion)
        this.viscosity = {
            aToB: createViscosityNode(vel.a, vel.b, gridSize, gridSize),
            bToA: createViscosityNode(vel.b, vel.a, gridSize, gridSize),
        };

        // Turbulence force
        this.turbulence = {
            aToB: createTurbulenceNode(vel.a, vel.b, gridSize, gridSize),
            bToA: createTurbulenceNode(vel.b, vel.a, gridSize, gridSize),
        };

        // Buoyancy force (velocity + dye)
        this.buoyancy = {
            velA_dyeA_toB: createBuoyancyNode(vel.a, dye.a, vel.b, gridSize, gridSize, dyeSize, dyeSize),
            velA_dyeB_toB: createBuoyancyNode(vel.a, dye.b, vel.b, gridSize, gridSize, dyeSize, dyeSize),
            velB_dyeA_toA: createBuoyancyNode(vel.b, dye.a, vel.a, gridSize, gridSize, dyeSize, dyeSize),
            velB_dyeB_toA: createBuoyancyNode(vel.b, dye.b, vel.a, gridSize, gridSize, dyeSize, dyeSize),
        };

        this.dyeChannelDissipation = {
            aToB: createDyeChannelDissipationNode(dye.a, dye.b, dyeSize, dyeSize),
            bToA: createDyeChannelDissipationNode(dye.b, dye.a, dyeSize, dyeSize),
        };

        // Boundary conditions (contain)
        this.velocityBoundary = {
            aToB: createVelocityBoundaryNode(vel.a, vel.b, gridSize, gridSize),
            bToA: createVelocityBoundaryNode(vel.b, vel.a, gridSize, gridSize),
        };
        this.velocityBoundaryMac = {
            aToB: createMacVelocityBoundaryNode(vel.a, vel.b, gridSize, gridSize),
            bToA: createMacVelocityBoundaryNode(vel.b, vel.a, gridSize, gridSize),
        };
        this.dyeBoundary = {
            aToB: createDyeBoundaryNode(dye.a, dye.b, dyeSize, dyeSize),
            bToA: createDyeBoundaryNode(dye.b, dye.a, dyeSize, dyeSize),
        };

        // Gravity (constant acceleration)
        this.gravity = {
            aToB: createGravityNode(vel.a, vel.b, gridSize, gridSize),
            bToA: createGravityNode(vel.b, vel.a, gridSize, gridSize),
        };

        // Temperature field (optional - for combustion-like effects)
        if (this.config.temperatureEnabled) {
            this.initializeTemperature();
        } else {
            this.tempAdvect = null;
            this.tempSplat = null;
            this.tempBuoyancy = null;
            this.tempClear = null;
        }

        // Fuel/combustion nodes (can be enabled later via setConfig; initialize now if enabled at startup).
        if (this.config.fuelEnabled) {
            this.initializeFuel();
        }

        // Cache clear nodes for all textures (recreated whenever textures are recreated).
        this.clearComputes = [
            createClearNode(vel.a, gridSize, gridSize).compute,
            createClearNode(vel.b, gridSize, gridSize).compute,
            createClearNode(press.a, gridSize, gridSize).compute,
            createClearNode(press.b, gridSize, gridSize).compute,
            createClearNode(dye.a, dyeSize, dyeSize).compute,
            createClearNode(dye.b, dyeSize, dyeSize).compute,
            createClearNode(velTemp, gridSize, gridSize).compute,
            createClearNode(dyeTemp, dyeSize, dyeSize).compute,
            createClearNode(div, gridSize, gridSize).compute,
            createClearNode(vort, gridSize, gridSize).compute,
            createClearNode(obstaclesTex, gridSize, gridSize).compute,
            createClearNode(pressureResidual, gridSize, gridSize).compute,
            createClearNode(pressureResidualCoarse, coarseSize.width, coarseSize.height).compute,
            createClearNode(coarsePress.a, coarseSize.width, coarseSize.height).compute,
            createClearNode(coarsePress.b, coarseSize.width, coarseSize.height).compute,
        ];

        // Add temperature clear if enabled
        if (this.fields.isAllocated('temperature')) {
            const temp = this.fields.getBoth('temperature');
            this.clearComputes.push(
                createClearNode(temp.a, gridSize, gridSize).compute,
                createClearNode(temp.b, gridSize, gridSize).compute
            );
        }

        // Fuel clear if allocated
        if (this.fields.isAllocated('fuel')) {
            const fuel = this.fields.getBoth('fuel');
            this.clearComputes.push(
                createClearNode(fuel.a, gridSize, gridSize).compute,
                createClearNode(fuel.b, gridSize, gridSize).compute
            );
        }
    }

    /**
     * Initialize temperature field and compute nodes
     */
    private initializeTemperature(): void {
        const { gridSize } = this.config;

        // Ensure field exists (it should, registered in constructor if enabled)
        if (!this.fields.has('temperature')) return;
        if (!this.fields.isAllocated('temperature')) {
            this.fields.getBoth('temperature');
        }

        const vel = this.fields.getBoth('velocity');
        const temp = this.fields.getBoth('temperature');

        // Temperature advection (follows velocity)
        this.tempAdvect = {
            aToB: createTemperatureAdvectNode(
                vel.a, temp.a, temp.b,
                gridSize, gridSize, gridSize, gridSize
            ),
            bToA: createTemperatureAdvectNode(
                vel.b, temp.b, temp.a,
                gridSize, gridSize, gridSize, gridSize
            ),
        };

        // Temperature splat (inject heat at point)
        this.tempSplat = {
            aToB: createTemperatureSplatNode(temp.a, temp.b, gridSize, gridSize),
            bToA: createTemperatureSplatNode(temp.b, temp.a, gridSize, gridSize),
        };

        // Temperature-based buoyancy (hot rises)
        this.tempBuoyancy = {
            velA_tempA_toB: createTemperatureBuoyancyNode(
                vel.a, temp.a, vel.b,
                gridSize, gridSize, gridSize, gridSize
            ),
            velA_tempB_toB: createTemperatureBuoyancyNode(
                vel.a, temp.b, vel.b,
                gridSize, gridSize, gridSize, gridSize
            ),
            velB_tempA_toA: createTemperatureBuoyancyNode(
                vel.b, temp.a, vel.a,
                gridSize, gridSize, gridSize, gridSize
            ),
            velB_tempB_toA: createTemperatureBuoyancyNode(
                vel.b, temp.b, vel.a,
                gridSize, gridSize, gridSize, gridSize
            ),
        };

        // Temperature clear
        this.tempClear = createTemperatureClearNode(temp.a, gridSize, gridSize);
    }

    private initializeFuel(): void {
        const { gridSize, dyeSize } = this.config;
        if (!this.fields.has('fuel')) return;
        if (!this.fields.isAllocated('fuel')) {
            // Allocate by accessing.
            this.fields.getBoth('fuel');
        }

        const vel = this.fields.getBoth('velocity');
        const fuel = this.fields.getBoth('fuel');

        this.fuelAdvect = {
            aToB: createFuelAdvectNode(vel.a, fuel.a, fuel.b, gridSize, gridSize, gridSize, gridSize),
            bToA: createFuelAdvectNode(vel.b, fuel.b, fuel.a, gridSize, gridSize, gridSize, gridSize),
        };

        this.fuelSplat = {
            aToB: createFuelSplatNode(fuel.a, fuel.b, gridSize, gridSize),
            bToA: createFuelSplatNode(fuel.b, fuel.a, gridSize, gridSize),
        };

        // Combustion requires temperature.
        if (this.fields.has('temperature')) {
            const temp = this.fields.getBoth('temperature');
            this.combustion = {
                aToB: createCombustionNode(fuel.a, temp.a, fuel.b, temp.b, gridSize, gridSize),
                bToA: createCombustionNode(fuel.b, temp.b, fuel.a, temp.a, gridSize, gridSize),
            };
        } else {
            this.combustion = null;
        }

        // Fire dye uses temperature to inject color.
        if (this.fields.has('temperature')) {
            const temp = this.fields.getBoth('temperature');
            const dye = this.fields.getBoth('dye');
            this.fireDye = {
                aToB: createFireDyeNode(dye.a, temp.a, dye.b, dyeSize, dyeSize, gridSize, gridSize),
                bToA: createFireDyeNode(dye.b, temp.b, dye.a, dyeSize, dyeSize, gridSize, gridSize),
            };
        } else {
            this.fireDye = null;
        }
    }

    private initPasses(): void {
        const passes: Pass[] = [
            // 2. Vorticity Confinement
            {
                id: 'vorticity',
                label: 'Vorticity',
                enabled: true,
                inputs: [], outputs: [], uniforms: {}, compute: null,
                execute: (renderer, dt) => {
                    const solid = (this.config.containFluid ?? false) ? 1 : 0;
                    if (this.config.vorticity > 0) {
                        // Update dt 
                        this.vorticityForce.aToB.uniforms.dt.value = dt;
                        this.vorticityForce.bToA.uniforms.dt.value = dt;

                        // Compute Vorticity
                        this.vorticityCompute.fromA.uniforms.solid.value = solid;
                        this.vorticityCompute.fromB.uniforms.solid.value = solid;
                        const vComp = this.fields.getState('velocity') ? this.vorticityCompute.fromA : this.vorticityCompute.fromB;
                        renderer.compute(vComp.compute);

                        // Compute Force
                        this.vorticityForce.aToB.uniforms.solid.value = solid;
                        this.vorticityForce.bToA.uniforms.solid.value = solid;
                        const vForce = this.fields.getState('velocity') ? this.vorticityForce.aToB : this.vorticityForce.bToA;
                        vForce.uniforms.vorticityStrength.value = this.config.vorticity;
                        vForce.uniforms.edgeAwareEnabled.value = (this.config.vorticityEdgeAwareEnabled ?? false) ? 1 : 0;
                        vForce.uniforms.edgeAwareStrength.value = this.config.vorticityEdgeAwareStrength ?? 1.0;
                        vForce.uniforms.scaleMix.value = this.config.vorticityScaleMix ?? 0.0;
                        renderer.compute(vForce.compute);
                        this.fields.swap('velocity');
                    }
                }
            },

            // 3. Advect Velocity
            {
                id: 'advectVelocity',
                label: 'Advect Velocity',
                enabled: true,
                inputs: [], outputs: [], uniforms: {}, compute: null,
                execute: (renderer, dt) => {
                    const advMode = this.config.advectionMode ?? (this.config.useMacCormack ? 1 : 0);
                    const useMacCormack = advMode === 1;
                    const velocityDissipation = this.config.velocityDiffusion ?? this.config.velocityDissipation;

                    // Update uniforms
                    this.velocityAdvect.aToB.uniforms.dt.value = dt;
                    this.velocityAdvect.bToA.uniforms.dt.value = dt;
                    this.velocityAdvect.aToB.uniforms.dissipation.value = velocityDissipation;
                    this.velocityAdvect.bToA.uniforms.dissipation.value = velocityDissipation;

                    if (useMacCormack) {
                        this.velocityAdvectTemp.fromA.uniforms.dt.value = dt;
                        this.velocityAdvectTemp.fromB.uniforms.dt.value = dt;
                        this.velocityAdvectTemp.fromA.uniforms.dissipation.value = velocityDissipation;
                        this.velocityAdvectTemp.fromB.uniforms.dissipation.value = velocityDissipation;
                        this.velocityMacCormack.fromA.uniforms.dt.value = dt;
                        this.velocityMacCormack.fromB.uniforms.dt.value = dt;

                        const forward = this.fields.getState('velocity') ? this.velocityAdvectTemp.fromA : this.velocityAdvectTemp.fromB;
                        renderer.compute(forward.compute);

                        const correct = this.fields.getState('velocity') ? this.velocityMacCormack.fromA : this.velocityMacCormack.fromB;
                        renderer.compute(correct.compute);
                        this.fields.swap('velocity');
                    } else {
                        const velocityAdvect = this.fields.getState('velocity') ? this.velocityAdvect.aToB : this.velocityAdvect.bToA;
                        renderer.compute(velocityAdvect.compute);
                        this.fields.swap('velocity');
                    }
                }
            },

            // 3.5 Viscosity
            {
                id: 'viscosity',
                label: 'Viscosity',
                enabled: true,
                inputs: [], outputs: [], uniforms: {}, compute: null,
                execute: (renderer, dt) => {
                    const visc = this.config.viscosity ?? 0;
                    if (visc > 0) {
                        const diffusion = visc * dt * 0.5;
                        this.viscosity.aToB.uniforms.diffusion.value = diffusion;
                        this.viscosity.bToA.uniforms.diffusion.value = diffusion;

                        const iterations = Math.max(1, Math.round(visc * 6));
                        for (let i = 0; i < iterations; i++) {
                            const v = this.fields.getState('velocity') ? this.viscosity.aToB : this.viscosity.bToA;
                            renderer.compute(v.compute);
                            this.fields.swap('velocity');
                        }
                    }
                }
            },

            // 3.6 Turbulence
            {
                id: 'turbulence',
                label: 'Turbulence',
                enabled: true,
                inputs: [], outputs: [], uniforms: {}, compute: null,
                execute: (renderer, dt) => {
                    const legacyTurbulence = this.config.turbulence ?? 0;
                    const turbulenceEnabled = (this.config.turbulenceEnabled ?? false) || legacyTurbulence > 0;

                    if (turbulenceEnabled) {
                        const strength = (this.config.turbulenceStrength ?? legacyTurbulence) ?? 0;
                        const scale = this.config.turbulenceScale ?? 1.0;
                        const speed = this.config.turbulenceSpeed ?? 1.0;
                        const octaves = this.config.turbulenceOctaves ?? 3;

                        // Update uniforms on both ping-pong nodes to be safe
                        for (const n of [this.turbulence.aToB, this.turbulence.bToA]) {
                            n.uniforms.strength.value = strength;
                            n.uniforms.scale.value = scale;
                            n.uniforms.speed.value = speed;
                            n.uniforms.octaves.value = Math.max(1, Math.min(4, Math.round(octaves)));
                            n.uniforms.time.value = this.time;
                            n.uniforms.dt.value = dt;
                        }

                        const node = this.fields.getState('velocity') ? this.turbulence.aToB : this.turbulence.bToA;
                        renderer.compute(node.compute);
                        this.fields.swap('velocity');
                    }
                }
            },

            // 4. Forces (Buoyancy + Gravity)
            {
                id: 'forces',
                label: 'Apply Forces',
                enabled: true,
                inputs: [],
                outputs: [],
                uniforms: {},
                compute: null,
                execute: (renderer, dt) => {
                    // Check buoyancy
                    const checkTemp = this.config.temperatureEnabled && this.config.temperatureBuoyancyEnabled;
                    const buoyancyEnabled = this.config.buoyancyEnabled || checkTemp;

                    if (buoyancyEnabled) {
                        this.buoyancy.velA_dyeA_toB.uniforms.dt.value = dt;
                        this.buoyancy.velA_dyeB_toB.uniforms.dt.value = dt;
                        this.buoyancy.velB_dyeA_toA.uniforms.dt.value = dt;
                        this.buoyancy.velB_dyeB_toA.uniforms.dt.value = dt;
                        const w = this.config.multiphaseBuoyancyWeightsRGB ?? [0.3333333, 0.3333333, 0.3333333];
                        for (const n of [this.buoyancy.velA_dyeA_toB, this.buoyancy.velA_dyeB_toB, this.buoyancy.velB_dyeA_toA, this.buoyancy.velB_dyeB_toA]) {
                            n.uniforms.weights.value.set(w[0], w[1], w[2]);
                        }
                        if (this.tempBuoyancy) {
                            this.tempBuoyancy.velA_tempA_toB.uniforms.dt.value = dt;
                            this.tempBuoyancy.velA_tempB_toB.uniforms.dt.value = dt;
                            this.tempBuoyancy.velB_tempA_toA.uniforms.dt.value = dt;
                            this.tempBuoyancy.velB_tempB_toA.uniforms.dt.value = dt;
                        }

                        let computeNode: any;
                        if (checkTemp && this.tempBuoyancy && this.fields.has('temperature')) {
                            const str = this.config.temperatureBuoyancyStrength ?? 1.0;
                            const amb = this.config.temperatureAmbient ?? 0.0;

                            const isTempA = this.fields.getState('temperature');

                            computeNode = this.fields.getState('velocity')
                                ? (isTempA ? this.tempBuoyancy.velA_tempA_toB : this.tempBuoyancy.velA_tempB_toB)
                                : (isTempA ? this.tempBuoyancy.velB_tempA_toA : this.tempBuoyancy.velB_tempB_toA);

                            computeNode.uniforms.strength.value = str;
                            computeNode.uniforms.ambient.value = amb;
                        } else {
                            const isDyeA = this.fields.getState('dye');
                            computeNode = this.fields.getState('velocity')
                                ? (isDyeA ? this.buoyancy.velA_dyeA_toB : this.buoyancy.velA_dyeB_toB)
                                : (isDyeA ? this.buoyancy.velB_dyeA_toA : this.buoyancy.velB_dyeB_toA);

                            computeNode.uniforms.strength.value = this.config.buoyancyStrength;
                        }

                        renderer.compute(computeNode.compute);
                        this.fields.swap('velocity');
                    }

                    // Check Gravity
                    if ((this.config.gravity?.[0] ?? 0) !== 0 || (this.config.gravity?.[1] ?? 0) !== 0) {
                        const g = this.config.gravity ?? [0, 0];
                        this.gravity.aToB.uniforms.dt.value = dt;
                        this.gravity.bToA.uniforms.dt.value = dt;
                        this.gravity.aToB.uniforms.gravity.value.set(g[0], g[1]);
                        this.gravity.bToA.uniforms.gravity.value.set(g[0], g[1]);

                        const gravity = this.fields.getState('velocity') ? this.gravity.aToB : this.gravity.bToA;
                        renderer.compute(gravity.compute);
                        this.fields.swap('velocity');
                    }
                }
            },

            // 4.5 Obstacles (pre-projection velocity enforcement)
            {
                id: 'obstaclesVelocityPre',
                label: 'Obstacles: Velocity',
                enabled: true,
                inputs: [], outputs: [], uniforms: {}, compute: null,
                execute: (renderer) => {
                    if (!(this.config.obstaclesEnabled ?? false)) return;
                    const thr = this.config.obstacleThreshold ?? 0.5;
                    this.obstacleEnforceVelocity.aToB.uniforms.threshold.value = thr;
                    this.obstacleEnforceVelocity.bToA.uniforms.threshold.value = thr;

                    const node = this.fields.getState('velocity') ? this.obstacleEnforceVelocity.aToB : this.obstacleEnforceVelocity.bToA;
                    renderer.compute(node.compute);
                    this.fields.swap('velocity');
                }
            },

            // 5. Divergence
            {
                id: 'divergence',
                label: 'Divergence',
                enabled: true,
                inputs: [], outputs: [], uniforms: {},
                compute: null,
                execute: (renderer) => {
                    const solid = (this.config.containFluid ?? false) ? 1 : 0;
                    const useMac = this.config.macGridEnabled ?? false;
                    const divNode = useMac ? this.divergenceComputeMac : this.divergenceCompute;
                    divNode.fromA.uniforms.solid.value = solid;
                    divNode.fromB.uniforms.solid.value = solid;

                    const compute = this.fields.getState('velocity') ? divNode.fromA : divNode.fromB;
                    renderer.compute(compute.compute);
                }
            },

            // 6. Pressure Solve
            {
                id: 'pressure',
                label: 'Pressure Solve',
                enabled: true,
                inputs: [], outputs: [], uniforms: {},
                compute: null,
                execute: (renderer, dt) => {
                    const solid = (this.config.containFluid ?? false) ? 1 : 0;
                    const omega = (this.config.pressureSolver ?? 0) === 1 ? (this.config.sorOmega ?? 1.8) : 1.0;
                    this.pressureSolve.aToB.uniforms.omega.value = omega;
                    this.pressureSolve.bToA.uniforms.omega.value = omega;
                    this.pressureSolve.aToB.uniforms.solid.value = solid;
                    this.pressureSolve.bToA.uniforms.solid.value = solid;

                    const baseIterations = Math.max(1, Math.round(this.config.pressureIterations ?? 30));
                    const adaptive = this.config.pressureAdaptive ?? true;
                    const minIt = Math.max(1, Math.round(this.config.pressureMinIterations ?? 6));
                    const maxIt = Math.max(minIt, Math.round(this.config.pressureMaxIterations ?? 80));
                    const dtRef = 1.0 / 60.0;
                    const it = adaptive
                        ? Math.max(minIt, Math.min(maxIt, Math.round(baseIterations * (dt / dtRef))))
                        : baseIterations;

                    const multigridOn = this.config.pressureMultigridEnabled ?? false;
                    if (!multigridOn) {
                        for (let i = 0; i < it; i++) {
                            const pressureSolve = this.fields.getState('pressure') ? this.pressureSolve.aToB : this.pressureSolve.bToA;
                            renderer.compute(pressureSolve.compute);
                            this.fields.swap('pressure');
                        }
                        return;
                    }

                    // 2-level V-cycle correction (fine residual -> coarse solve -> prolongate correction).
                    const pre = Math.max(0, Math.round(this.config.pressureMultigridPreSmooth ?? 6));
                    const post = Math.max(0, Math.round(this.config.pressureMultigridPostSmooth ?? 6));
                    const coarseIt = Math.max(1, Math.round(this.config.pressureMultigridCoarseIterations ?? 24));

                    // Pre-smoothing on fine grid.
                    for (let i = 0; i < pre; i++) {
                        const p = this.fields.getState('pressure') ? this.pressureSolve.aToB : this.pressureSolve.bToA;
                        renderer.compute(p.compute);
                        this.fields.swap('pressure');
                    }

                    // Residual on fine grid (b - A p), then restrict to coarse grid.
                    const r = this.fields.getState('pressure') ? this.pressureResidual.fromA : this.pressureResidual.fromB;
                    r.uniforms.solid.value = solid;
                    renderer.compute(r.compute);
                    renderer.compute(this.residualRestrict.compute);

                    // Coarse solve (error equation) on `pressureCoarse` field.
                    renderer.compute(this.coarsePressureClear.a);
                    renderer.compute(this.coarsePressureClear.b);
                    this.coarsePressureSolve.aToB.uniforms.omega.value = omega;
                    this.coarsePressureSolve.bToA.uniforms.omega.value = omega;
                    this.coarsePressureSolve.aToB.uniforms.solid.value = solid;
                    this.coarsePressureSolve.bToA.uniforms.solid.value = solid;
                    for (let i = 0; i < coarseIt; i++) {
                        const e = this.fields.getState('pressureCoarse') ? this.coarsePressureSolve.aToB : this.coarsePressureSolve.bToA;
                        renderer.compute(e.compute);
                        this.fields.swap('pressureCoarse');
                    }

                    // Prolongate + add correction into fine pressure (writes to the opposite ping-pong buffer).
                    const isFineA = this.fields.getState('pressure');
                    const isCoarseA = this.fields.getState('pressureCoarse');
                    const add =
                        isFineA
                            ? (isCoarseA ? this.coarseProlongateAdd.fineA_coarseA_toB : this.coarseProlongateAdd.fineA_coarseB_toB)
                            : (isCoarseA ? this.coarseProlongateAdd.fineB_coarseA_toA : this.coarseProlongateAdd.fineB_coarseB_toA);
                    add.uniforms.scale.value = 1.0;
                    renderer.compute(add.compute);
                    this.fields.swap('pressure');

                    // Post-smoothing on fine grid.
                    for (let i = 0; i < post; i++) {
                        const p = this.fields.getState('pressure') ? this.pressureSolve.aToB : this.pressureSolve.bToA;
                        renderer.compute(p.compute);
                        this.fields.swap('pressure');
                    }
                }
            },

            // 7. Gradient Subtract
            {
                id: 'gradientSubtract',
                label: 'Gradient Subtract',
                enabled: true,
                inputs: [], outputs: [], uniforms: {},
                compute: null,
                execute: (renderer) => {
                    const solid = (this.config.containFluid ?? false) ? 1 : 0;
                    const useMac = this.config.macGridEnabled ?? false;
                    const grad = useMac ? this.gradientSubtractMac : this.gradientSubtract;
                    grad.velA_pA_toB.uniforms.solid.value = solid;
                    grad.velA_pB_toB.uniforms.solid.value = solid;
                    grad.velB_pA_toA.uniforms.solid.value = solid;
                    grad.velB_pB_toA.uniforms.solid.value = solid;

                    const isVelA = this.fields.getState('velocity');
                    const isPressA = this.fields.getState('pressure');

                    const compute =
                        isVelA
                            ? (isPressA ? grad.velA_pA_toB : grad.velA_pB_toB)
                            : (isPressA ? grad.velB_pA_toA : grad.velB_pB_toA);
                    renderer.compute(compute.compute);
                    this.fields.swap('velocity');
                }
            },

            // 8. Velocity Boundary
            {
                id: 'velocityBoundary',
                label: 'Velocity Boundary',
                enabled: true,
                inputs: [], outputs: [], uniforms: {},
                compute: null,
                execute: (renderer) => {
                    if (this.config.containFluid) {
                        const useMac = this.config.macGridEnabled ?? false;
                        const bc = useMac ? this.velocityBoundaryMac : this.velocityBoundary;
                        const boundary = this.fields.getState('velocity') ? bc.aToB : bc.bToA;
                        renderer.compute(boundary.compute);
                        this.fields.swap('velocity');
                    }
                }
            },

            // 8.5 Obstacles (post-projection velocity enforcement)
            {
                id: 'obstaclesVelocityPost',
                label: 'Obstacles: Velocity (post)',
                enabled: true,
                inputs: [], outputs: [], uniforms: {}, compute: null,
                execute: (renderer) => {
                    if (!(this.config.obstaclesEnabled ?? false)) return;
                    const thr = this.config.obstacleThreshold ?? 0.5;
                    this.obstacleEnforceVelocity.aToB.uniforms.threshold.value = thr;
                    this.obstacleEnforceVelocity.bToA.uniforms.threshold.value = thr;

                    const node = this.fields.getState('velocity') ? this.obstacleEnforceVelocity.aToB : this.obstacleEnforceVelocity.bToA;
                    renderer.compute(node.compute);
                    this.fields.swap('velocity');
                }
            },

            // 9. Advect Dye
            {
                id: 'advectDye',
                label: 'Advect Dye',
                enabled: true,
                inputs: [], outputs: [], uniforms: {},
                compute: null,
                execute: (renderer, dt) => {
                    const dissipation = this.config.dyeDissipation ?? 0.985;
                    this.dyeAdvect.velA_dyeA_toB.uniforms.dissipation.value = dissipation;
                    this.dyeAdvect.velB_dyeA_toB.uniforms.dissipation.value = dissipation;
                    this.dyeAdvect.velA_dyeB_toA.uniforms.dissipation.value = dissipation;
                    this.dyeAdvect.velB_dyeB_toA.uniforms.dissipation.value = dissipation;
                    this.dyeAdvectTemp.velA_dyeA_toTemp.uniforms.dissipation.value = dissipation;
                    this.dyeAdvectTemp.velB_dyeA_toTemp.uniforms.dissipation.value = dissipation;
                    this.dyeAdvectTemp.velA_dyeB_toTemp.uniforms.dissipation.value = dissipation;
                    this.dyeAdvectTemp.velB_dyeB_toTemp.uniforms.dissipation.value = dissipation;

                    const isDyeA = this.fields.getState('dye');
                    const isVelA = this.fields.getState('velocity');

                    if (this.config.useMacCormack) {
                        const forward =
                            isDyeA
                                ? (isVelA ? this.dyeAdvectTemp.velA_dyeA_toTemp : this.dyeAdvectTemp.velB_dyeA_toTemp)
                                : (isVelA ? this.dyeAdvectTemp.velA_dyeB_toTemp : this.dyeAdvectTemp.velB_dyeB_toTemp);
                        renderer.compute(forward.compute); // -> dyeTemp

                        const correct =
                            isDyeA
                                ? (isVelA ? this.dyeMacCormack.velA_dyeA_toB : this.dyeMacCormack.velB_dyeA_toB)
                                : (isVelA ? this.dyeMacCormack.velA_dyeB_toA : this.dyeMacCormack.velB_dyeB_toA);
                        renderer.compute(correct.compute);
                        this.fields.swap('dye');
                    } else {
                        const dyeAdvect =
                            isDyeA
                                ? (isVelA ? this.dyeAdvect.velA_dyeA_toB : this.dyeAdvect.velB_dyeA_toB)
                                : (isVelA ? this.dyeAdvect.velA_dyeB_toA : this.dyeAdvect.velB_dyeB_toA);
                        renderer.compute(dyeAdvect.compute);
                        this.fields.swap('dye');
                    }
                }
            },

            // 10. Dye Boundary
            {
                id: 'dyeBoundary',
                label: 'Dye Boundary',
                enabled: true,
                inputs: [], outputs: [], uniforms: {}, compute: null,
                execute: (renderer) => {
                    if (this.config.containFluid) {
                        const boundary = this.fields.getState('dye') ? this.dyeBoundary.aToB : this.dyeBoundary.bToA;
                        renderer.compute(boundary.compute);
                        this.fields.swap('dye');
                    }
                }
            },

            // 10.5 Obstacles (dye enforcement)
            {
                id: 'obstaclesDye',
                label: 'Obstacles: Dye',
                enabled: true,
                inputs: [], outputs: [], uniforms: {}, compute: null,
                execute: (renderer) => {
                    if (!(this.config.obstaclesEnabled ?? false)) return;
                    const thr = this.config.obstacleThreshold ?? 0.5;
                    this.obstacleEnforceDye.aToB.uniforms.threshold.value = thr;
                    this.obstacleEnforceDye.bToA.uniforms.threshold.value = thr;

                    const node = this.fields.getState('dye') ? this.obstacleEnforceDye.aToB : this.obstacleEnforceDye.bToA;
                    renderer.compute(node.compute);
                    this.fields.swap('dye');
                }
            },

            // 10.6 Multiphase dissipation (per-channel)
            {
                id: 'multiphaseDye',
                label: 'Multiphase Dye',
                enabled: true,
                inputs: [], outputs: [], uniforms: {}, compute: null,
                execute: (renderer) => {
                    if (!(this.config.multiphaseEnabled ?? false)) return;
                    if (!this.dyeChannelDissipation) return;
                    const d = this.config.multiphaseDyeDissipationRGB ?? [1.0, 1.0, 1.0];
                    this.dyeChannelDissipation.aToB.uniforms.dissipationRGB.value.set(d[0], d[1], d[2]);
                    this.dyeChannelDissipation.bToA.uniforms.dissipationRGB.value.set(d[0], d[1], d[2]);

                    const node = this.fields.getState('dye') ? this.dyeChannelDissipation.aToB : this.dyeChannelDissipation.bToA;
                    renderer.compute(node.compute);
                    this.fields.swap('dye');
                }
            },

            // 11. Advect Temperature
            {
                id: 'advectTemperature',
                label: 'Advect Temperature',
                enabled: true,
                inputs: [], outputs: [], uniforms: {}, compute: null,
                execute: (renderer, dt) => {
                    if (this.config.temperatureEnabled && this.fields.has('temperature') && this.tempAdvect) {
                        const dissipation = this.config.temperatureDissipation ?? 0.99;
                        const cooling = this.config.temperatureCooling ?? 0.02;

                        this.tempAdvect.aToB.uniforms.dt.value = dt;
                        this.tempAdvect.bToA.uniforms.dt.value = dt;
                        this.tempAdvect.aToB.uniforms.dissipation.value = dissipation;
                        this.tempAdvect.bToA.uniforms.dissipation.value = dissipation;
                        this.tempAdvect.aToB.uniforms.cooling.value = cooling;
                        this.tempAdvect.bToA.uniforms.cooling.value = cooling;

                        const tempAdvect = this.fields.getState('temperature') ? this.tempAdvect.aToB : this.tempAdvect.bToA;
                        renderer.compute(tempAdvect.compute);
                        this.fields.swap('temperature');
                    }
                }
            },

            // 11.5 Obstacles (temperature enforcement)
            {
                id: 'obstaclesTemperature',
                label: 'Obstacles: Temperature',
                enabled: true,
                inputs: [], outputs: [], uniforms: {}, compute: null,
                execute: (renderer) => {
                    if (!(this.config.obstaclesEnabled ?? false)) return;
                    if (!this.obstacleEnforceTemperature || !this.fields.has('temperature')) return;

                    const thr = this.config.obstacleThreshold ?? 0.5;
                    this.obstacleEnforceTemperature.aToB.uniforms.threshold.value = thr;
                    this.obstacleEnforceTemperature.bToA.uniforms.threshold.value = thr;

                    const node = this.fields.getState('temperature') ? this.obstacleEnforceTemperature.aToB : this.obstacleEnforceTemperature.bToA;
                    renderer.compute(node.compute);
                    this.fields.swap('temperature');
                }
            }
            ,

            // 12. Advect Fuel
            {
                id: 'advectFuel',
                label: 'Advect Fuel',
                enabled: true,
                inputs: [], outputs: [], uniforms: {}, compute: null,
                execute: (renderer, dt) => {
                    if (!(this.config.fuelEnabled ?? false)) return;
                    if (!this.fuelAdvect) this.initializeFuel();
                    if (!this.fuelAdvect || !this.fields.has('fuel')) return;

                    const dissipation = this.config.fuelDissipation ?? 0.99;
                    this.fuelAdvect.aToB.uniforms.dt.value = dt;
                    this.fuelAdvect.bToA.uniforms.dt.value = dt;
                    this.fuelAdvect.aToB.uniforms.dissipation.value = dissipation;
                    this.fuelAdvect.bToA.uniforms.dissipation.value = dissipation;

                    const adv = this.fields.getState('fuel') ? this.fuelAdvect.aToB : this.fuelAdvect.bToA;
                    renderer.compute(adv.compute);
                    this.fields.swap('fuel');
                }
            },

            // 13. Combustion (fuel -> temperature)
            {
                id: 'combustion',
                label: 'Combustion',
                enabled: true,
                inputs: [], outputs: [], uniforms: {}, compute: null,
                execute: (renderer, dt) => {
                    if (!(this.config.combustionEnabled ?? false)) return;
                    if (!(this.config.fuelEnabled ?? false)) return;
                    if (!this.fields.has('temperature')) return;
                    if (!this.combustion) this.initializeFuel();
                    if (!this.combustion || !this.fields.has('fuel')) return;

                    const rate = this.config.combustionRate ?? 1.0;
                    const ignite = this.config.combustionIgniteTemp ?? 0.25;
                    const heat = this.config.combustionHeatPerFuel ?? 2.0;
                    const damp = this.config.combustionTempDamp ?? 0.995;

                    this.combustion.aToB.uniforms.dt.value = dt;
                    this.combustion.bToA.uniforms.dt.value = dt;
                    this.combustion.aToB.uniforms.rate.value = rate;
                    this.combustion.bToA.uniforms.rate.value = rate;
                    this.combustion.aToB.uniforms.igniteTemp.value = ignite;
                    this.combustion.bToA.uniforms.igniteTemp.value = ignite;
                    this.combustion.aToB.uniforms.heatPerFuel.value = heat;
                    this.combustion.bToA.uniforms.heatPerFuel.value = heat;
                    this.combustion.aToB.uniforms.tempDamp.value = damp;
                    this.combustion.bToA.uniforms.tempDamp.value = damp;

                    const isFuelA = this.fields.getState('fuel');
                    const isTempA = this.fields.getState('temperature');
                    // Combustion node expects fuel/temp to be in matching pingpong state.
                    // If they are desynced, do a one-time align swap of fuel to match temperature.
                    if (isFuelA !== isTempA) this.fields.swap('fuel');

                    const node = this.fields.getState('fuel') ? this.combustion.aToB : this.combustion.bToA;
                    renderer.compute(node.compute);
                    this.fields.swap('fuel');
                    this.fields.swap('temperature');
                }
            },

            // 14. Fire dye injection (temperature -> dye)
            {
                id: 'fireDye',
                label: 'Fire Dye',
                enabled: true,
                inputs: [], outputs: [], uniforms: {}, compute: null,
                execute: (renderer) => {
                    if (!(this.config.fireDyeEnabled ?? true)) return;
                    if (!(this.config.combustionEnabled ?? false)) return;
                    if (!this.fields.has('temperature')) return;
                    if (!this.fireDye) this.initializeFuel();
                    if (!this.fireDye) return;

                    const intensity = this.config.fireDyeIntensity ?? 0.25;
                    const tscale = this.config.fireDyeTempScale ?? 1.0;
                    this.fireDye.aToB.uniforms.intensity.value = intensity;
                    this.fireDye.bToA.uniforms.intensity.value = intensity;
                    this.fireDye.aToB.uniforms.temperatureScale.value = tscale;
                    this.fireDye.bToA.uniforms.temperatureScale.value = tscale;

                    const node = this.fields.getState('dye') ? this.fireDye.aToB : this.fireDye.bToA;
                    renderer.compute(node.compute);
                    this.fields.swap('dye');
                }
            }
        ];

        this.graph.registerAll(passes);
    }

    addSplat(splat: Splat): void {
        this.splatQueueRaw.push(splat);
    }

    addSplats(splats: Splat[]): void {
        this.splatQueueRaw.push(...splats);
    }

    private processSplats(): void {
        if (this.splatQueueRaw.length) {
            for (const raw of this.splatQueueRaw) {
                this.splatQueueExpanded.push(...this.expandSymmetry(raw));
            }
            this.splatQueueRaw = [];
        }

        const rawCap = this.config.maxSplatsPerFrame;
        const capSplatsPerFrame = Number.isFinite(rawCap) ? Math.max(0, Math.round(rawCap)) : 0;
        const maxBacklog = capSplatsPerFrame > 0 ? Math.max(256, capSplatsPerFrame * 12) : 8192;

        let backlog = this.splatQueueExpanded.length - this.splatQueueExpandedStart;
        if (backlog <= 0) {
            this.splatQueueExpanded = [];
            this.splatQueueExpandedStart = 0;
            return;
        }

        // If producers outpace consumption, drop oldest splats to keep latency/memory bounded.
        if (backlog > maxBacklog) {
            this.splatQueueExpandedStart += backlog - maxBacklog;
            backlog = maxBacklog;
        }

        const toProcess = capSplatsPerFrame > 0 ? Math.min(capSplatsPerFrame, backlog) : backlog;

        const falloffK = (falloff: number): number => {
            const v = Math.max(0, Math.min(3, Math.round(falloff)));
            if (v === 3) return 4.0;
            if (v === 2) return 2.0;
            if (v === 1) return 1.0;
            return 0.5;
        };

        const cutoffDistSqFromRadius = (radius: number, softness: number, falloff: number): number => {
            const k = falloffK(falloff);
            const r = radius * Math.max(softness, 0.05);
            const eps = 1e-4;
            const distSq = (-r / Math.max(1e-6, k)) * Math.log(eps);
            return Math.max(0, distSq);
        };

        // ============================================
        // GPU Batch Mode - Single dispatch for all splats
        // ============================================
        if (this.config.splatBatchEnabled && this.velocitySplatBatch && this.dyeSplatBatch) {
            const batchSplats: PackedSplat[] = [];

            for (let i = 0; i < toProcess; i++) {
                const splat = this.splatQueueExpanded[this.splatQueueExpandedStart + i];
                const dy = (splat.flipDy ?? false) ? -splat.dy : splat.dy;

                const baseRadius = splat.radius ?? this.config.dyeRadius;
                const radiusScale = splat.radiusScale ?? 1.0;
                const velBaseRadius = splat.radius ?? (this.config.velocityRadius ?? this.config.dyeRadius);
                const velRadius = velBaseRadius * radiusScale * this.config.forceSplatRadius;
                const dyeRadius = baseRadius * radiusScale * this.config.dyeSplatRadius;

                const velScale = this.config.velocityForce * this.config.splatVelocityScale * (splat.velocityScale ?? 1.0);
                const dyeScale = this.config.dyeIntensity * (splat.dyeScale ?? 1.0);
                const colorBoost = this.config.splatColorBoost * (splat.colorBoost ?? 1.0) * (splat.opacity ?? 1);

                const softness = splat.splatSoftness ?? this.config.splatSoftness ?? 1.0;
                const falloff = splat.splatFalloff ?? this.config.splatFalloff ?? this.config.splatQuality ?? 2;
                const blendMode = splat.splatBlendMode ?? this.config.splatBlendMode ?? 0;

                batchSplats.push({
                    x: splat.x,
                    y: splat.y,
                    dx: splat.dx * velScale,
                    dy: dy * velScale,
                    r: splat.color[0] * colorBoost,
                    g: splat.color[1] * colorBoost,
                    b: splat.color[2] * colorBoost,
                    a: 1.0,
                    radius: dyeRadius,
                    softness,
                    falloff,
                    blendMode,
                });
            }

            const velBatch = (this.fields.getState('velocity') ? this.velocitySplatBatch.aToB : this.velocitySplatBatch.bToA);
            const dyeBatch = (this.fields.getState('dye') ? this.dyeSplatBatch.aToB : this.dyeSplatBatch.bToA);

            // Upload and dispatch velocity batch (read->write), then swap once.
            velBatch.uploadSplats(batchSplats);
            this.renderer.compute(velBatch.compute);
            this.fields.swap('velocity');

            // Upload and dispatch dye batch (read->write), then swap once.
            dyeBatch.uploadSplats(batchSplats);
            this.renderer.compute(dyeBatch.compute);
            this.fields.swap('dye');

            // Apply per-splat fields that aren't included in the packed batch format.
            for (let i = 0; i < toProcess; i++) {
                const splat = this.splatQueueExpanded[this.splatQueueExpandedStart + i];

                const x = splat.x;
                const y = splat.y;

                const baseRadius = splat.radius ?? this.config.dyeRadius;
                const radiusScale = splat.radiusScale ?? 1.0;
                const dyeRadius = baseRadius * radiusScale * this.config.dyeSplatRadius;

                const softness = splat.splatSoftness ?? this.config.splatSoftness ?? 1.0;
                const falloff = splat.splatFalloff ?? this.config.splatFalloff ?? this.config.splatQuality ?? 2;
                const blendMode = splat.splatBlendMode ?? this.config.splatBlendMode ?? 0;

                // Obstacle splat (tiled in-place)
                if (splat.obstacle !== undefined && this.obstacleSplatTile) {
                    const obstacleMode = Math.max(0, Math.min(1, Math.round(splat.obstacleMode ?? 0)));
                    const obstacleBlendMode = Math.max(0, Math.min(2, Math.round(splat.obstacleBlendMode ?? 1)));
                    const obstacleValue = Math.max(0, Math.min(1, splat.obstacle));

                    const tileSize = this.obstacleSplatTile.tileSize as number;
                    const radius = baseRadius * radiusScale;
                    const cutoffDistSq = cutoffDistSqFromRadius(radius, softness, falloff);

                    this.obstacleSplatTile.uniforms.splatPos.value.set(x, y);
                    this.obstacleSplatTile.uniforms.obstacleValue.value = obstacleValue;
                    this.obstacleSplatTile.uniforms.radius.value = radius;
                    this.obstacleSplatTile.uniforms.softness.value = softness;
                    this.obstacleSplatTile.uniforms.falloff.value = falloff;
                    this.obstacleSplatTile.uniforms.mode.value = obstacleMode;
                    this.obstacleSplatTile.uniforms.blendMode.value = obstacleBlendMode;
                    this.obstacleSplatTile.uniforms.cutoffDistSq.value = cutoffDistSq;

                    const cx = Math.floor(x * this.config.gridSize);
                    const cy = Math.floor(y * this.config.gridSize);
                    const radPx = Math.ceil(Math.sqrt(cutoffDistSq) * this.config.gridSize);
                    const xMin = Math.max(0, cx - radPx);
                    const xMax = Math.min(this.config.gridSize - 1, cx + radPx);
                    const yMin = Math.max(0, cy - radPx);
                    const yMax = Math.min(this.config.gridSize - 1, cy + radPx);
                    const x0 = Math.floor(xMin / tileSize) * tileSize;
                    const x1 = Math.floor(xMax / tileSize) * tileSize;
                    const y0 = Math.floor(yMin / tileSize) * tileSize;
                    const y1 = Math.floor(yMax / tileSize) * tileSize;

                    for (let ty = y0; ty <= y1; ty += tileSize) {
                        for (let tx = x0; tx <= x1; tx += tileSize) {
                            this.obstacleSplatTile.uniforms.tileOrigin.value.set(tx, ty);
                            this.renderer.compute(this.obstacleSplatTile.compute);
                        }
                    }
                }

                // Temperature splat (if enabled and temperature specified)
                if (this.config.temperatureEnabled && this.fields.has('temperature') && this.tempSplat && splat.temperature !== undefined && splat.temperature > 0) {
                    const isTempA = this.fields.getState('temperature');
                    const tempSplat = isTempA ? this.tempSplat.aToB : this.tempSplat.bToA;
                    tempSplat.uniforms.splatPos.value.set(x, y);
                    tempSplat.uniforms.temperature.value = splat.temperature;
                    tempSplat.uniforms.radius.value = dyeRadius ?? this.config.dyeRadius;
                    tempSplat.uniforms.softness.value = softness;
                    tempSplat.uniforms.falloff.value = falloff;
                    tempSplat.uniforms.blendMode.value = blendMode;
                    this.renderer.compute(tempSplat.compute);
                    this.fields.swap('temperature');
                }

            }

            // Update queue state and return
            this.splatQueueExpandedStart += toProcess;
            if (this.splatQueueExpandedStart >= this.splatQueueExpanded.length) {
                this.splatQueueExpanded = [];
                this.splatQueueExpandedStart = 0;
            }
            return;
        }

        // ============================================
        // Per-Splat Mode (Tiled or Ping-Pong)
        // ============================================
        for (let i = 0; i < toProcess; i++) {
            const splat = this.splatQueueExpanded[this.splatQueueExpandedStart + i];

            // `flipDy` is an escape hatch for sources that still produce Y-up velocities.
            const dy = (splat.flipDy ?? false) ? -splat.dy : splat.dy;

            const x = splat.x;
            const y = splat.y;

            const baseRadius = splat.radius ?? this.config.dyeRadius;
            const radiusScale = splat.radiusScale ?? 1.0;
            const velBaseRadius = splat.radius ?? (this.config.velocityRadius ?? this.config.dyeRadius);
            const velRadius = velBaseRadius * radiusScale * this.config.forceSplatRadius;
            const dyeRadius = baseRadius * radiusScale * this.config.dyeSplatRadius;

            const velScale = this.config.velocityForce * this.config.splatVelocityScale * (splat.velocityScale ?? 1.0);
            const dyeScale = this.config.dyeIntensity * (splat.dyeScale ?? 1.0);
            const colorBoost = this.config.splatColorBoost * (splat.colorBoost ?? 1.0) * (splat.opacity ?? 1);

            const softness = splat.splatSoftness ?? this.config.splatSoftness ?? 1.0;
            const falloff = splat.splatFalloff ?? this.config.splatFalloff ?? this.config.splatQuality ?? 2;
            const blendMode = splat.splatBlendMode ?? this.config.splatBlendMode ?? 0;

            if (this.config.splatTiledEnabled) {
                // Velocity splat (tiled, in-place)
                {
                    const isVelA = this.fields.getState('velocity');
                    const velocitySplat = isVelA ? this.velocitySplatTile.fromA : this.velocitySplatTile.fromB;
                    const tileSize = this.velocitySplatTile.tileSize;
                    const radius = velRadius ?? this.config.velocityRadius;
                    const cutoffDistSq = cutoffDistSqFromRadius(radius, softness, falloff);

                    velocitySplat.uniforms.splatPos.value.set(x, y);
                    velocitySplat.uniforms.splatVel.value.set(splat.dx * velScale, dy * velScale);
                    velocitySplat.uniforms.radius.value = radius;
                    velocitySplat.uniforms.softness.value = softness;
                    velocitySplat.uniforms.falloff.value = falloff;
                    velocitySplat.uniforms.blendMode.value = blendMode;
                    velocitySplat.uniforms.cutoffDistSq!.value = cutoffDistSq;

                    const cx = Math.floor(x * this.config.gridSize);
                    const cy = Math.floor(y * this.config.gridSize);
                    const radPx = Math.ceil(Math.sqrt(cutoffDistSq) * this.config.gridSize);
                    const xMin = Math.max(0, cx - radPx);
                    const xMax = Math.min(this.config.gridSize - 1, cx + radPx);
                    const yMin = Math.max(0, cy - radPx);
                    const yMax = Math.min(this.config.gridSize - 1, cy + radPx);
                    const x0 = Math.floor(xMin / tileSize) * tileSize;
                    const x1 = Math.floor(xMax / tileSize) * tileSize;
                    const y0 = Math.floor(yMin / tileSize) * tileSize;
                    const y1 = Math.floor(yMax / tileSize) * tileSize;

                    for (let ty = y0; ty <= y1; ty += tileSize) {
                        for (let tx = x0; tx <= x1; tx += tileSize) {
                            velocitySplat.uniforms.tileOrigin!.value.set(tx, ty);
                            this.renderer.compute(velocitySplat.compute);
                        }
                    }
                }

                // Dye splat (tiled, in-place)
                {
                    const isDyeA = this.fields.getState('dye');
                    const dyeSplat = isDyeA ? this.dyeSplatTile.fromA : this.dyeSplatTile.fromB;
                    const tileSize = this.dyeSplatTile.tileSize;
                    const radius = dyeRadius ?? this.config.dyeRadius;
                    const cutoffDistSq = cutoffDistSqFromRadius(radius, softness, falloff);

                    dyeSplat.uniforms.splatPos.value.set(x, y);
                    dyeSplat.uniforms.splatVel.value.set(splat.dx * dyeScale, dy * dyeScale);
                    dyeSplat.uniforms.splatColor.value.set(
                        splat.color[0] * colorBoost,
                        splat.color[1] * colorBoost,
                        splat.color[2] * colorBoost,
                        1.0
                    );
                    dyeSplat.uniforms.radius.value = radius;
                    dyeSplat.uniforms.softness.value = softness;
                    dyeSplat.uniforms.falloff.value = falloff;
                    dyeSplat.uniforms.blendMode.value = blendMode;
                    dyeSplat.uniforms.cutoffDistSq!.value = cutoffDistSq;

                    const cx = Math.floor(x * this.config.dyeSize);
                    const cy = Math.floor(y * this.config.dyeSize);
                    const radPx = Math.ceil(Math.sqrt(cutoffDistSq) * this.config.dyeSize);
                    const xMin = Math.max(0, cx - radPx);
                    const xMax = Math.min(this.config.dyeSize - 1, cx + radPx);
                    const yMin = Math.max(0, cy - radPx);
                    const yMax = Math.min(this.config.dyeSize - 1, cy + radPx);
                    const x0 = Math.floor(xMin / tileSize) * tileSize;
                    const x1 = Math.floor(xMax / tileSize) * tileSize;
                    const y0 = Math.floor(yMin / tileSize) * tileSize;
                    const y1 = Math.floor(yMax / tileSize) * tileSize;

                    for (let ty = y0; ty <= y1; ty += tileSize) {
                        for (let tx = x0; tx <= x1; tx += tileSize) {
                            dyeSplat.uniforms.tileOrigin!.value.set(tx, ty);
                            this.renderer.compute(dyeSplat.compute);
                        }
                    }
                }
            } else {
                // Velocity splat (ping-pong)
                const isVelA = this.fields.getState('velocity');
                const velocitySplat = isVelA ? this.velocitySplat.aToB : this.velocitySplat.bToA;
                velocitySplat.uniforms.splatPos.value.set(x, y);
                velocitySplat.uniforms.splatVel.value.set(splat.dx * velScale, dy * velScale);
                velocitySplat.uniforms.radius.value = velRadius ?? this.config.velocityRadius;
                velocitySplat.uniforms.softness.value = softness;
                velocitySplat.uniforms.falloff.value = falloff;
                velocitySplat.uniforms.blendMode.value = blendMode;
                this.renderer.compute(velocitySplat.compute);
                this.fields.swap('velocity');

                // Dye splat (ping-pong)
                const isDyeA = this.fields.getState('dye');
                const dyeSplat = isDyeA ? this.dyeSplat.aToB : this.dyeSplat.bToA;
                dyeSplat.uniforms.splatPos.value.set(x, y);
                dyeSplat.uniforms.splatVel.value.set(splat.dx * dyeScale, dy * dyeScale);
                dyeSplat.uniforms.splatColor.value.set(
                    splat.color[0] * colorBoost,
                    splat.color[1] * colorBoost,
                    splat.color[2] * colorBoost,
                    1.0
                );
                dyeSplat.uniforms.radius.value = dyeRadius ?? this.config.dyeRadius;
                dyeSplat.uniforms.softness.value = softness;
                dyeSplat.uniforms.falloff.value = falloff;
                dyeSplat.uniforms.blendMode.value = blendMode;
                this.renderer.compute(dyeSplat.compute);
                this.fields.swap('dye');
            }

            // Obstacle splat (always uses tiled in-place updates)
            if (splat.obstacle !== undefined && this.obstacleSplatTile) {
                const obstacleMode = Math.max(0, Math.min(1, Math.round(splat.obstacleMode ?? 0)));
                const obstacleBlendMode = Math.max(0, Math.min(2, Math.round(splat.obstacleBlendMode ?? 1)));
                const obstacleValue = Math.max(0, Math.min(1, splat.obstacle));

                const tileSize = this.obstacleSplatTile.tileSize as number;
                const radius = (splat.radius ?? this.config.dyeRadius) * (splat.radiusScale ?? 1.0);
                const cutoffDistSq = cutoffDistSqFromRadius(radius, softness, falloff);

                this.obstacleSplatTile.uniforms.splatPos.value.set(x, y);
                this.obstacleSplatTile.uniforms.obstacleValue.value = obstacleValue;
                this.obstacleSplatTile.uniforms.radius.value = radius;
                this.obstacleSplatTile.uniforms.softness.value = softness;
                this.obstacleSplatTile.uniforms.falloff.value = falloff;
                this.obstacleSplatTile.uniforms.mode.value = obstacleMode;
                this.obstacleSplatTile.uniforms.blendMode.value = obstacleBlendMode;
                this.obstacleSplatTile.uniforms.cutoffDistSq.value = cutoffDistSq;

                const cx = Math.floor(x * this.config.gridSize);
                const cy = Math.floor(y * this.config.gridSize);
                const radPx = Math.ceil(Math.sqrt(cutoffDistSq) * this.config.gridSize);
                const xMin = Math.max(0, cx - radPx);
                const xMax = Math.min(this.config.gridSize - 1, cx + radPx);
                const yMin = Math.max(0, cy - radPx);
                const yMax = Math.min(this.config.gridSize - 1, cy + radPx);
                const x0 = Math.floor(xMin / tileSize) * tileSize;
                const x1 = Math.floor(xMax / tileSize) * tileSize;
                const y0 = Math.floor(yMin / tileSize) * tileSize;
                const y1 = Math.floor(yMax / tileSize) * tileSize;

                for (let ty = y0; ty <= y1; ty += tileSize) {
                    for (let tx = x0; tx <= x1; tx += tileSize) {
                        this.obstacleSplatTile.uniforms.tileOrigin.value.set(tx, ty);
                        this.renderer.compute(this.obstacleSplatTile.compute);
                    }
                }
            }

            // Temperature splat (if enabled and temperature specified)
            if (this.config.temperatureEnabled && this.fields.has('temperature') && this.tempSplat && splat.temperature !== undefined && splat.temperature > 0) {
                const isTempA = this.fields.getState('temperature');
                const tempSplat = isTempA ? this.tempSplat.aToB : this.tempSplat.bToA;
                tempSplat.uniforms.splatPos.value.set(x, y);
                tempSplat.uniforms.temperature.value = splat.temperature;
                tempSplat.uniforms.radius.value = dyeRadius ?? this.config.dyeRadius;
                tempSplat.uniforms.softness.value = softness;
                tempSplat.uniforms.falloff.value = falloff;
                tempSplat.uniforms.blendMode.value = blendMode;
                this.renderer.compute(tempSplat.compute);
                this.fields.swap('temperature');
            }

            // Fuel splat (if enabled and fuel specified)
            if ((this.config.fuelEnabled ?? false) && this.fields.has('fuel') && this.fuelSplat && splat.fuel !== undefined && splat.fuel > 0) {
                const fuel = this.fields.getState('fuel') ? this.fuelSplat.aToB : this.fuelSplat.bToA;
                fuel.uniforms.splatPos.value.set(x, y);
                fuel.uniforms.fuel.value = splat.fuel;
                fuel.uniforms.radius.value = dyeRadius ?? this.config.dyeRadius;
                fuel.uniforms.softness.value = softness;
                fuel.uniforms.falloff.value = falloff;
                fuel.uniforms.blendMode.value = blendMode;
                this.renderer.compute(fuel.compute);
                this.fields.swap('fuel');
            }
        }

        this.splatQueueExpandedStart += toProcess;
        if (this.splatQueueExpandedStart >= this.splatQueueExpanded.length) {
            this.splatQueueExpanded = [];
            this.splatQueueExpandedStart = 0;
        } else if (this.splatQueueExpandedStart > 2048 && this.splatQueueExpandedStart > (this.splatQueueExpanded.length >> 1)) {
            this.splatQueueExpanded = this.splatQueueExpanded.slice(this.splatQueueExpandedStart);
            this.splatQueueExpandedStart = 0;
        }
    }

    private expandSymmetry(splat: Splat): Splat[] {
        const mode = this.config.symmetry ?? 0;
        if (mode === 0) return [splat];

        const out: Splat[] = [splat];

        const mirrorX = (s: Splat): Splat => ({ ...s, x: 1 - s.x, dx: -s.dx });
        const mirrorY = (s: Splat): Splat => ({ ...s, y: 1 - s.y, dy: -s.dy });

        if (mode === 1 || mode === 3) out.push(mirrorX(splat));
        if (mode === 2 || mode === 3) out.push(mirrorY(splat));
        if (mode === 3) out.push(mirrorY(mirrorX(splat)));

        return out;
    }

    private simulateSubstep(stepDt: number, perf?: Omit<PerfStats2D, 'substeps'>): void {
        this.time += stepDt;

        if (perf) {
            this.graph.setTimingEnabled(true);
        } else {
            this.graph.setTimingEnabled(false);
        }

        // Execute the full graph
        this.graph.run(this.renderer, this.config as any, stepDt, this.time);

        if (perf) {
            const timings = this.graph.getTimings();
            for (const t of timings) {
                if (t.id === 'vorticity') perf.vorticityMs = t.ms;
                if (t.id === 'advectVelocity') perf.advectVelocityMs = t.ms;
                if (t.id === 'viscosity') perf.viscosityMs = t.ms;
                if (t.id === 'turbulence') perf.forcesMs += t.ms;
                if (t.id === 'forces') perf.forcesMs += t.ms;
                if (t.id === 'divergence') perf.divergenceMs = t.ms;
                if (t.id === 'pressure') perf.pressureMs = t.ms;
                if (t.id === 'gradientSubtract') perf.projectionMs = t.ms;
                if (t.id === 'velocityBoundary') perf.boundaryVelocityMs = t.ms;
                if (t.id === 'advectDye') perf.advectDyeMs = t.ms;
                if (t.id === 'dyeBoundary') perf.boundaryDyeMs = t.ms;
            }
        }
    }

    step(dt?: number): void {
        const now = performance.now();
        const perfEnabled = this.config.perfEnabled ?? false;
        const frameStartMs = perfEnabled ? now : 0;
        const elapsed = (now - this.lastFrame) / 1000;
        this.lastFrame = now;

        const requestedDt = dt ?? elapsed;
        if (!this.running) {
            this.perfStats = null;
            return;
        }

        // 1. Process splats
        const perfAcc: PerfStats2D | null = perfEnabled
            ? {
                frameMs: 0,
                splatsMs: 0,
                vorticityMs: 0,
                advectVelocityMs: 0,
                viscosityMs: 0,
                forcesMs: 0,
                divergenceMs: 0,
                pressureMs: 0,
                projectionMs: 0,
                boundaryVelocityMs: 0,
                advectDyeMs: 0,
                boundaryDyeMs: 0,
                substeps: 0,
            }
            : null;

        if (perfAcc) {
            const tSplats0 = performance.now();
            this.processSplats();
            perfAcc.splatsMs += performance.now() - tSplats0;
        } else {
            this.processSplats();
        }

        const totalDt = Math.max(0, requestedDt) * (this.config.simSpeed ?? 1.0);
        if (totalDt <= 0) {
            this.perfStats = null;
            return;
        }

        const dtMax = Math.max(1e-6, this.config.substepsDtMax ?? (1.0 / 60.0));
        const maxSteps = Math.max(1, Math.round(this.config.substepsMax ?? 4));
        const enabled = this.config.substepsEnabled ?? true;

        // Clamp to avoid spiraling (never exceed dtMax even when FPS collapses).
        const clampedTotalDt = enabled ? Math.min(totalDt, dtMax * maxSteps) : Math.min(dtMax, totalDt);
        const steps = enabled ? Math.max(1, Math.ceil(clampedTotalDt / dtMax)) : 1;
        const stepDt = enabled ? (clampedTotalDt / steps) : clampedTotalDt;

        for (let i = 0; i < steps; i++) {
            this.simulateSubstep(stepDt, perfAcc ?? undefined);
        }

        if (perfAcc) {
            perfAcc.substeps = steps;
            perfAcc.frameMs = performance.now() - frameStartMs;

            const alpha = Math.max(0, Math.min(1, this.config.perfSmoothing ?? 0.12));
            if (!this.perfStats || alpha >= 1) {
                this.perfStats = { ...perfAcc };
            } else if (alpha <= 0) {
                // Keep existing
            } else {
                const prev = this.perfStats;
                const lerp = (a: number, b: number) => a * (1 - alpha) + b * alpha;
                this.perfStats = {
                    frameMs: lerp(prev.frameMs, perfAcc.frameMs),
                    splatsMs: lerp(prev.splatsMs, perfAcc.splatsMs),
                    vorticityMs: lerp(prev.vorticityMs, perfAcc.vorticityMs),
                    advectVelocityMs: lerp(prev.advectVelocityMs, perfAcc.advectVelocityMs),
                    viscosityMs: lerp(prev.viscosityMs, perfAcc.viscosityMs),
                    forcesMs: lerp(prev.forcesMs, perfAcc.forcesMs),
                    divergenceMs: lerp(prev.divergenceMs, perfAcc.divergenceMs),
                    pressureMs: lerp(prev.pressureMs, perfAcc.pressureMs),
                    projectionMs: lerp(prev.projectionMs, perfAcc.projectionMs),
                    boundaryVelocityMs: lerp(prev.boundaryVelocityMs, perfAcc.boundaryVelocityMs),
                    advectDyeMs: lerp(prev.advectDyeMs, perfAcc.advectDyeMs),
                    boundaryDyeMs: lerp(prev.boundaryDyeMs, perfAcc.boundaryDyeMs),
                    substeps: steps,
                };
            }
        } else {
            this.perfStats = null;
        }

        // Ping-pong state is left as-is; rendering selects the correct texture at draw time.
    }

    /**
     * Get the dye StorageTexture for rendering.
     * Can be used directly with texture() in fragment shader.
     */
    getDyeTexture(): THREE.StorageTexture {
        return this.fields.getRead('dye');
    }

    /**
     * Get the velocity StorageTexture (xy in RG) for rendering/debug/post effects.
     */
    getVelocityTexture(): THREE.StorageTexture {
        return this.fields.getRead('velocity');
    }

    /** Get the pressure StorageTexture (scalar in X) for debug/visualization. */
    getPressureTexture(): THREE.StorageTexture {
        return this.fields.getRead('pressure');
    }

    /** Ping-pong state for render-time selection. */
    getPingPongState(): { velocityIsA: boolean; dyeIsA: boolean; pressureIsA: boolean } {
        return {
            velocityIsA: this.fields.getState('velocity'),
            dyeIsA: this.fields.getState('dye'),
            pressureIsA: this.fields.getState('pressure')
        };
    }

    /** Direct access to both ping-pong textures (for node-graph `select()` patterns). */
    getPingPongTextures(): {
        velocityA: THREE.StorageTexture;
        velocityB: THREE.StorageTexture;
        dyeA: THREE.StorageTexture;
        dyeB: THREE.StorageTexture;
        pressureA: THREE.StorageTexture;
        pressureB: THREE.StorageTexture;
    } {
        const v = this.fields.getBoth('velocity');
        const d = this.fields.getBoth('dye');
        const p = this.fields.getBoth('pressure');
        return {
            velocityA: v.a, velocityB: v.b,
            dyeA: d.a, dyeB: d.b,
            pressureA: p.a, pressureB: p.b,
        };
    }

    /** Single (non-pingpong) intermediate fields for debug. */
    getDivergenceTexture(): THREE.StorageTexture {
        return this.fields.getRead('divergence');
    }

    getVorticityTexture(): THREE.StorageTexture {
        return this.fields.getRead('vorticity');
    }

    /** Obstacle mask field (0=fluid, 1=solid). */
    getObstaclesTexture(): THREE.StorageTexture {
        return this.fields.getRead('obstacles');
    }

    /** Clears obstacles (sets the obstacle field to 0 everywhere). */
    clearObstacles(): void {
        if (!this.obstaclesClearCompute) return;
        this.renderer.compute(this.obstaclesClearCompute);
    }

    /** Temperature field (if enabled). Returns null if temperature is disabled. */
    getTemperatureTexture(): THREE.StorageTexture | null {
        if (!(this.config.temperatureEnabled ?? false)) return null;
        if (!this.fields.isAllocated('temperature')) return null;
        return this.fields.getRead('temperature');
    }

    /** Check if temperature field is enabled. */
    isTemperatureEnabled(): boolean {
        return this.config.temperatureEnabled && this.fields.has('temperature');
    }

    getConfig(): FluidConfig2D {
        return { ...this.config };
    }

    setConfig(config: Partial<FluidConfig2D>): void {
        const prev = this.config;
        const next = { ...prev, ...config };
        const needsResize =
            next.gridSize !== prev.gridSize ||
            next.dyeSize !== prev.dyeSize;

        this.config = next;

        if (needsResize) {
            this.rebuildTextures();
            return;
        }

        // Splat batch compute depends on max count and enable state.
        const needsSplatBatchRebuild =
            (next.splatBatchEnabled ?? false) !== (prev.splatBatchEnabled ?? false) ||
            (next.splatBatchMaxCount ?? 256) !== (prev.splatBatchMaxCount ?? 256);

        if (needsSplatBatchRebuild) {
            const gridSize = this.config.gridSize;
            const dyeSize = this.config.dyeSize;
            const vel = this.fields.getBoth('velocity');
            const dye = this.fields.getBoth('dye');

            if (this.config.splatBatchEnabled) {
                this.velocitySplatBatch = {
                    aToB: createBatchedVelocitySplatNode(vel.a, vel.b, gridSize, gridSize, this.config.splatBatchMaxCount),
                    bToA: createBatchedVelocitySplatNode(vel.b, vel.a, gridSize, gridSize, this.config.splatBatchMaxCount),
                };
                this.dyeSplatBatch = {
                    aToB: createBatchedDyeSplatNode(dye.a, dye.b, dyeSize, dyeSize, this.config.splatBatchMaxCount),
                    bToA: createBatchedDyeSplatNode(dye.b, dye.a, dyeSize, dyeSize, this.config.splatBatchMaxCount),
                };
            } else {
                this.velocitySplatBatch = null;
                this.dyeSplatBatch = null;
            }
        }

        // Fuel system: initialize nodes when enabled (temperature must exist for combustion).
        const fuelOn = next.fuelEnabled ?? false;
        const fuelWasOn = prev.fuelEnabled ?? false;
        if (fuelOn && !fuelWasOn) {
            if (!this.fuelAdvect || !this.fuelSplat) this.initializeFuel();
        }

        const tempOn = next.temperatureEnabled ?? false;
        const tempWasOn = prev.temperatureEnabled ?? false;
        if (tempOn && !tempWasOn) {
            this.initializeTemperature();
            // Rebuild temperature-dependent obstacle enforcement and fuel/combustion nodes.
            this.initializeComputeNodes();
        }
    }

    reset(): void {
        this.time = 0;
        this.lastFrame = performance.now();
        this.splatQueueRaw = [];
        this.splatQueueExpanded = [];
        this.splatQueueExpandedStart = 0;
        this.clear();
    }

    getTime(): number {
        return this.time;
    }

    getPerfStats(): PerfStats2D | null {
        return this.perfStats;
    }

    getFieldMemoryStats(): FieldMemoryStats {
        return this.fields.getMemoryStats();
    }

    getPassGraphMetadata(): PassMetadata[] {
        return this.graph.getPassMetadata();
    }

    getPassTimings(): PassTiming[] {
        return this.graph.getTimings();
    }

    getFieldCount(): number {
        return this.fields.getFieldIds().length;
    }

    setPassEnabled(id: string, enabled: boolean): void {
        this.graph.setEnabled(id, enabled);
    }

    setPassGroupEnabled(group: PassGroup, enabled: boolean): void {
        this.graph.setGroupEnabled(group, enabled);
    }

    isRunning(): boolean {
        return this.running;
    }

    pause(): void {
        this.running = false;
    }

    resume(): void {
        this.running = true;
        this.lastFrame = performance.now();
    }

    render(): void {
        // Rendering is handled externally (R3F/Three). Kept for API parity.
    }

    clear(): void {
        // Clear all fields using cached clearNodes
        // Note: FieldRegistry doesn't track "reset state" (always assumes A is start if newly created),
        // but we don't recreate textures here, just clear content.
        // We SHOULD reset the ping-pong state logic to A?
        // FieldRegistry doesn't support manual state set.
        // But our passes use Fields state.
        // For safe "Reset", we might want to ensure we start at A.
        // Use swap() to align? 
        // Actually, for clear(), we simply clear both buffers and don't care about state, 
        // OR we want to reset simulation time/state.
        // If we want reset state to A, we'd need FieldRegistry.resetStates().
        // For now, just clear content.
        for (const compute of this.clearComputes) {
            this.renderer.compute(compute);
        }
    }

    destroy(): void {
        this.dispose();
    }

    private rebuildTextures(): void {
        const { gridSize, dyeSize } = this.config;

        // Resize fields (recreates textures and resets states)
        this.fields.resize(gridSize, dyeSize);

        // Recreate compute nodes bound to these textures
        this.initializeComputeNodes();

        // Rebuild PassGraph (closures capture new texture refs)
        this.graph.clear();
        this.initPasses();

        // Clear to a clean state
        this.clear();

        console.log(`[FluidSolver2D] Resized to Grid:${gridSize} Dye:${dyeSize}`);
    }

    /**
     * Resize the simulation grid dynamically.
     * This will recreate all textures and compute nodes.
     * @param gridSize - New simulation grid resolution
     * @param dyeSize - New dye/color field resolution
     */
    resize(gridSize: number, dyeSize: number): void {
        // Skip if no change
        if (gridSize === this.config.gridSize && dyeSize === this.config.dyeSize) {
            return;
        }

        this.config.gridSize = gridSize;
        this.config.dyeSize = dyeSize;
        this.rebuildTextures();
    }

    dispose(): void {
        this.fields.dispose();
    }
}
