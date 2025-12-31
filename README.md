# FluidStudio TSL

Advanced WebGPU Fluid Simulation Engine built with **Three.js r182 WebGPU + TSL + React Three Fiber**.

## Overview

FluidStudio TSL is a professional-grade 2D/3D fluid simulation system leveraging WebGPU compute shaders and Three.js Shading Language (TSL) for maximum performance and visual quality.

- Architecture documentation: `DOCS/ARCHITECTURE.md`
- Development notes: `DOCS/KNOWLEDGE.md`
- Upgrade proposals: `DOCS/UPGRADE_PROPOSAL_V2.md`

## Quick Start

```bash
npm install
npm run dev
```

## Features

- **WebGPU-Powered**: Hardware-accelerated fluid dynamics using compute shaders
- **TSL Integration**: Native Three.js Shading Language for modular shader composition
- **2D & 3D**: Unified architecture supporting both 2D and 3D fluid simulations
- **Advanced Post-Processing**: Bloom, chromatic aberration, color grading, and more
- **Interactive Emitters**: Multiple emitter types (point, line, circle, brush, SVG, text, curve)
- **Real-time Control**: Comprehensive UI for tweaking simulation parameters
- **Audio Reactivity**: Audio-driven fluid dynamics

## Requirements

- WebGPU-compatible browser (Chrome 113+, Edge 113+, or similar)
- Modern GPU with WebGPU support

## Project Structure

```
Fluidstudio_tsl/
├── packages/
│   ├── fluid-2d/          # 2D fluid simulation core
│   │   ├── FluidSolver2D.ts
│   │   ├── nodes/         # TSL compute nodes
│   │   ├── emitters/      # Fluid source emitters
│   │   ├── gizmos/        # Visual editing tools
│   │   └── postfx/        # Post-processing effects
│   └── studio/            # UI and studio components
│       ├── App.tsx
│       ├── panels/        # Control panels
│       └── store/         # State management
├── DOCS/                  # Documentation
└── src/                   # Entry points
```

## Technology Stack

- **Three.js r182** - WebGPU renderer and TSL
- **React** - UI framework
- **React Three Fiber** - React renderer for Three.js
- **Zustand** - State management
- **Vite** - Build tool

## License

MIT
