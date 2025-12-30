declare module '@fluid-2d/three-tsl/display/FilmNode.js' {
  export const film: any;
  const FilmNode: any;
  export default FilmNode;
}

declare module '@fluid-2d/three-tsl/display/ChromaticAberrationNode.js' {
  export const chromaticAberration: any;
  const ChromaticAberrationNode: any;
  export default ChromaticAberrationNode;
}

declare module '@fluid-2d/three-tsl/display/BloomNode.js' {
  export const bloom: any;
  const BloomNode: any;
  export default BloomNode;
}

declare module '@fluid-2d/three-tsl/display/FXAANode.js' {
  export const fxaa: any;
  const FXAANode: any;
  export default FXAANode;
}

declare module '@fluid-2d/three-tsl/display/AfterImageNode.js' {
  export const afterImage: any;
  const AfterImageNode: any;
  export default AfterImageNode;
}

declare module '@fluid-2d/three-tsl/display/RGBShiftNode.js' {
  export const rgbShift: any;
  const RGBShiftNode: any;
  export default RGBShiftNode;
}

declare module 'three/addons/loaders/LUTImageLoader.js' {
  export class LUTImageLoader {
    load(
      url: string,
      onLoad?: (result: any) => void,
      onProgress?: (event: any) => void,
      onError?: (event: any) => void
    ): any;
    loadAsync(url: string): Promise<any>;
  }
}
