import * as THREE from 'three/webgpu';
import { Fn, clamp, float, vec3, vec4 } from 'three/tsl';

export function configureLut3DTexture(tex3d: THREE.Texture) {
  (tex3d as any).wrapS = THREE.ClampToEdgeWrapping;
  (tex3d as any).wrapT = THREE.ClampToEdgeWrapping;
  (tex3d as any).wrapR = THREE.ClampToEdgeWrapping;
  (tex3d as any).minFilter = THREE.LinearFilter;
  (tex3d as any).magFilter = THREE.LinearFilter;
  (tex3d as any).generateMipmaps = false;
  (tex3d as any).needsUpdate = true;
}

export function createFallbackLut3DTexture(size = 2): THREE.Texture {
  const data = new Uint8Array(size * size * size * 4);
  let i = 0;
  for (let z = 0; z < size; z++) {
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        data[i++] = Math.round((x / (size - 1)) * 255);
        data[i++] = Math.round((y / (size - 1)) * 255);
        data[i++] = Math.round((z / (size - 1)) * 255);
        data[i++] = 255;
      }
    }
  }

  const tex = new (THREE as any).Data3DTexture(data, size, size, size) as THREE.Texture;
  configureLut3DTexture(tex);
  return tex;
}

/**
 * Apply a 3D LUT (Data3DTexture) to an input color.
 *
 * - `lutTextureNode` should be created with `texture3D(texture)` and kept stable.
 * - `lutSize` should match `texture3D.image.width` (Hald/3D LUT size).
 */
export const applyLut3D = Fn(([inputColor, lutTextureNode, lutSize, amount]: [any, any, any, any]) => {
  const rgb = clamp(inputColor.rgb, vec3(0.0, 0.0, 0.0), vec3(1.0, 1.0, 1.0));

  const size = lutSize.max(float(2.0));
  const uvw = rgb.mul(size.sub(float(1.0))).add(vec3(0.5, 0.5, 0.5)).div(size);
  const lutRgb = lutTextureNode.sample(uvw).rgb;

  const w = clamp(amount, float(0.0), float(1.0));
  const mixed = rgb.mul(float(1.0).sub(w)).add(lutRgb.mul(w));
  return vec4(mixed, inputColor.a);
});

