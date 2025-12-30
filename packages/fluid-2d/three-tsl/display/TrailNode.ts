import { RenderTarget, Vector2, QuadMesh, NodeMaterial, RendererUtils, TempNode, NodeUpdateType } from 'three/webgpu';
import { nodeObject, Fn, float, uv, texture, passTexture, max, vec4, int, convertToTexture, select } from 'three/tsl';

const _size = /*@__PURE__*/ new Vector2();
const _quadMesh = /*@__PURE__*/ new QuadMesh();

let _rendererState: any;

/**
 * Trail/after-image node based on Three.js example AfterImageNode, extended with blend modes.
 *
 * Blend modes:
 * 0 = Add
 * 1 = Multiply
 * 2 = Screen
 */
class TrailNode extends TempNode {

  static get type() {
    return 'TrailNode';
  }

  textureNode: any;
  damp: any;
  blendMode: any;
  threshold: any;

  private _compRT: any;
  private _oldRT: any;
  private _textureNode: any;
  private _textureNodeOld: any;
  private _materialComposed: any;

  constructor(textureNode: any, damp: any = float(0.96), blendMode: any = int(0), threshold: any = float(0.1)) {
    super('vec4');

    this.textureNode = textureNode;
    this.damp = damp;
    this.blendMode = blendMode;
    this.threshold = threshold;

    this._compRT = new RenderTarget(1, 1, { depthBuffer: false });
    this._compRT.texture.name = 'TrailNode.comp';

    this._oldRT = new RenderTarget(1, 1, { depthBuffer: false });
    this._oldRT.texture.name = 'TrailNode.old';

    this._textureNode = passTexture(this as any, this._compRT.texture);
    this._textureNodeOld = texture(this._oldRT.texture);

    this.updateBeforeType = NodeUpdateType.FRAME;
  }

  getTextureNode() {
    return this._textureNode;
  }

  setSize(width: number, height: number) {
    this._compRT.setSize(width, height);
    this._oldRT.setSize(width, height);
  }

  updateBefore(frame: any) {
    const { renderer } = frame;

    _rendererState = RendererUtils.resetRendererState(renderer, _rendererState);

    const textureNode = this.textureNode;
    const map = textureNode.value;

    const textureType = map.type;

    this._compRT.texture.type = textureType;
    this._oldRT.texture.type = textureType;

    renderer.getDrawingBufferSize(_size);
    this.setSize(_size.x, _size.y);

    this._textureNode.value = this._compRT.texture;
    this._textureNodeOld.value = this._oldRT.texture;

    _quadMesh.material = this._materialComposed;
    _quadMesh.name = 'Trail';

    renderer.setRenderTarget(this._compRT);
    _quadMesh.render(renderer);

    const temp = this._oldRT;
    this._oldRT = this._compRT;
    this._compRT = temp;

    RendererUtils.restoreRendererState(renderer, _rendererState);
  }

  setup(builder: any) {
    const textureNode = this.textureNode;
    const textureNodeOld = this._textureNodeOld;

    textureNodeOld.uvNode = textureNode.uvNode || uv();

    const trailFn = Fn(() => {
      const texelOld = textureNodeOld.sample().toVar();
      const texelNew = textureNode.sample().toVar();

      const thr = this.threshold.toVar();

      const oldLum = max(texelOld.r, max(texelOld.g, texelOld.b));
      const mask = oldLum.greaterThan(thr);

      // fade previous frame (only keep if "bright enough")
      texelOld.mulAssign(select(mask, this.damp, float(0.0)));

      // blend
      const addBlend = texelNew.add(texelOld);
      const mulBlend = texelNew.mul(texelOld);
      const one = vec4(float(1.0));
      const screenBlend = one.sub(one.sub(texelNew).mul(one.sub(texelOld)));

      const blended = select(
        this.blendMode.equal(int(2)),
        screenBlend,
        select(this.blendMode.equal(int(1)), mulBlend, addBlend)
      );

      return vec4(blended.rgb, texelNew.a);
    });

    const materialComposed = this._materialComposed || (this._materialComposed = new NodeMaterial());
    materialComposed.name = 'Trail';
    materialComposed.fragmentNode = trailFn();

    const properties = builder.getNodeProperties(this);
    properties.textureNode = textureNode;

    return this._textureNode;
  }

  dispose() {
    this._compRT.dispose();
    this._oldRT.dispose();
  }
}

export default TrailNode;

export const trail = (node: any, damp: any = 0.96, blendMode: any = 0, threshold: any = 0.1) =>
  nodeObject(new TrailNode(convertToTexture(node), nodeObject(damp), nodeObject(blendMode), nodeObject(threshold)));
