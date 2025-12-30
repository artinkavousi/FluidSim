import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three/webgpu';
import { LUTImageLoader } from 'three/addons/loaders/LUTImageLoader.js';
import { configureLut3DTexture } from './Lut3D';

export type Lut3DTextureState = {
  texture3D: THREE.Texture | null;
  size: number;
  loading: boolean;
  error: string | null;
};

export function useLut3DTexture(url: string): Lut3DTextureState {
  const [state, setState] = useState<Lut3DTextureState>({
    texture3D: null,
    size: 2,
    loading: false,
    error: null,
  });

  const textureRef = useRef<THREE.Texture | null>(null);
  useEffect(() => {
    textureRef.current = state.texture3D;
  }, [state.texture3D]);

  useEffect(() => {
    if (!url) {
      setState((prev) => {
        prev.texture3D?.dispose?.();
        return { texture3D: null, size: 2, loading: false, error: null };
      });
      return;
    }

    let canceled = false;
    const loader = new LUTImageLoader();

    setState((prev) => ({ ...prev, loading: true, error: null }));

    loader.load(
      url,
      (lut: any) => {
        if (canceled) {
          lut?.texture3D?.dispose?.();
          return;
        }

        const tex3d = lut?.texture3D as THREE.Texture | undefined;
        if (!tex3d) {
          setState((prev) => ({ ...prev, loading: false, error: 'Invalid LUT texture.' }));
          return;
        }

        configureLut3DTexture(tex3d);

        const size = Math.max(2, (tex3d as any)?.image?.width ?? 2);

        setState((prev) => {
          prev.texture3D?.dispose?.();
          return { texture3D: tex3d, size, loading: false, error: null };
        });
      },
      undefined,
      () => {
        if (canceled) return;
        setState((prev) => {
          prev.texture3D?.dispose?.();
          return { texture3D: null, size: 2, loading: false, error: 'Failed to load LUT.' };
        });
      }
    );

    return () => {
      canceled = true;
    };
  }, [url]);

  useEffect(() => {
    return () => {
      textureRef.current?.dispose?.();
      textureRef.current = null;
    };
  }, []);

  return state;
}
