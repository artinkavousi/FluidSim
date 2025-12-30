import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three/webgpu';
import { useFrame, useThree } from '@react-three/fiber';
import type { RenderOutput2DConfig } from '../render/RenderOutput2D';
import { createFallbackLut3DTexture } from '../render/Lut3D';
import { useLut3DTexture } from '../render/useLut3DTexture';
import { PostFXPipeline2D } from '../postfx/PostFXPipeline2D';

import { FluidSolver2D } from '../FluidSolver2D';

export interface FluidPostProcessing2DProps {
  postConfig: RenderOutput2DConfig;
  solver: FluidSolver2D | null;
}

export function FluidPostProcessing2D({ postConfig, solver }: FluidPostProcessing2DProps) {
  const { gl, scene, camera } = useThree();

  const postRef = useRef<THREE.PostProcessing | null>(null);
  const pipelineRef = useRef<PostFXPipeline2D | null>(null);
  const [outputNode, setOutputNode] = useState<any>(null);

  const lutFallback3D = useMemo(() => createFallbackLut3DTexture(2), []);

  const postEnabled = postConfig.postEnabled ?? false;

  const lutUrl = postConfig.lutUrl ?? '';
  const lut3d = useLut3DTexture(lutUrl);

  useEffect(() => {
    return () => {
      lutFallback3D.dispose?.();
    };
  }, [lutFallback3D]);

  useEffect(() => {
    pipelineRef.current?.dispose();
    pipelineRef.current = new PostFXPipeline2D(scene as any, camera as any, lutFallback3D);
    setOutputNode(null);

    return () => {
      pipelineRef.current?.dispose();
      pipelineRef.current = null;
    };
  }, [scene, camera, lutFallback3D]);

  useEffect(() => {
    if (!pipelineRef.current) return;

    const { outputNode: out } = pipelineRef.current.update(postConfig, {
      lutFallback3D,
      lutTexture3D: lut3d.texture3D,
      lutSize: lut3d.size,
      velocityTexture: solver?.getVelocityTexture() ?? null,
    });

    setOutputNode((prev: any) => (prev === out ? prev : out));
  }, [postConfig, lutFallback3D, lut3d.texture3D, lut3d.size]);

  useEffect(() => {
    if (!postEnabled) return;
    if (!outputNode) return;
    if (!(gl as any)?.isWebGPURenderer) return;

    const pp = new THREE.PostProcessing(gl as any);
    pp.outputColorTransform = false;
    pp.outputNode = outputNode;
    pp.needsUpdate = true;
    postRef.current = pp;

    return () => {
      postRef.current?.dispose();
      postRef.current = null;
    };
  }, [gl, outputNode, postEnabled]);

  // Update node graph pointer when rebuilt
  useEffect(() => {
    if (!postEnabled) return;
    if (!postRef.current) return;
    if (!outputNode) return;
    postRef.current.outputNode = outputNode;
    postRef.current.needsUpdate = true;
  }, [outputNode, postEnabled]);

  // Render post stack (priority=1 disables R3F's default renderer.render(scene,camera))
  useFrame(() => {
    if (postEnabled && pipelineRef.current && solver) {
      pipelineRef.current.renderTick({
        lutFallback3D,
        lutTexture3D: lut3d.texture3D,
        lutSize: lut3d.size,
        velocityTexture: solver.getVelocityTexture()
      });
    }

    if (postEnabled && postRef.current) {
      try {
        postRef.current.render();
      } catch {
        // If the WebGPU pipeline fails to compile on this device/driver, gracefully fall back.
        postRef.current?.dispose();
        postRef.current = null;
        (gl as any).render(scene as any, camera as any);
      }
    } else {
      (gl as any).render(scene as any, camera as any);
    }
  }, 1);

  return null;
}
