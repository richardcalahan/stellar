import { NoToneMapping, Scene, SRGBColorSpace, Vector2, WebGLRenderer } from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { PlaneCamera } from './camera';
import { readViewport, type Resizable, type Viewport } from './viewport';

/** Pixels brighter than this (in linear light) glow. Stars and coronas are above it, everything else below. */
export const BLOOM_THRESHOLD = 0.8;
export const BLOOM_STRENGTH = 0.6;
export const BLOOM_RADIUS = 0.3;

/**
 * Owns the WebGL canvas, the scene, the fitted camera, and the post-processing
 * chain (render, bloom, output). On resize it refits the camera, resizes the
 * renderer and the composer, and tells every registered Resizable (the HUD
 * canvas, the starfield) about the new viewport, so nothing drifts or blurs.
 */
export class WorldRenderer {
  readonly scene = new Scene();
  readonly camera: PlaneCamera;
  readonly gl: WebGLRenderer;
  viewport: Viewport;

  private readonly composer: EffectComposer;
  private readonly bloom: UnrealBloomPass;
  private readonly resizables: Resizable[] = [];

  constructor(canvas: HTMLCanvasElement) {
    this.viewport = readViewport();

    this.gl = new WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    });
    // Colours stay linear through the whole chain; OutputPass converts to sRGB at the very end.
    this.gl.toneMapping = NoToneMapping;
    this.gl.outputColorSpace = SRGBColorSpace;
    this.gl.setClearColor(0x000000, 1);

    this.camera = new PlaneCamera(this.viewport.width, this.viewport.height);

    this.composer = new EffectComposer(this.gl);
    this.composer.addPass(new RenderPass(this.scene, this.camera.three));
    this.bloom = new UnrealBloomPass(
      new Vector2(this.viewport.width, this.viewport.height),
      BLOOM_STRENGTH,
      BLOOM_RADIUS,
      BLOOM_THRESHOLD,
    );
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());

    this.applyViewport(this.viewport);
  }

  /** Register something that must follow the viewport. It is sized immediately. */
  addResizable(target: Resizable): void {
    this.resizables.push(target);
    target.resize(this.viewport);
  }

  /** Re-read the window size and pixel ratio and push them through everything. */
  resize(): void {
    this.viewport = readViewport();
    this.applyViewport(this.viewport);
  }

  render(): void {
    this.composer.render();
  }

  private applyViewport(viewport: Viewport): void {
    this.camera.resize(viewport.width, viewport.height);
    this.gl.setPixelRatio(viewport.pixelRatio);
    this.gl.setSize(viewport.width, viewport.height, false);
    this.composer.setPixelRatio(viewport.pixelRatio);
    this.composer.setSize(viewport.width, viewport.height);
    // The composer just sized the bloom blur chain in device pixels, which would make the
    // halo half as wide and twice as hot on a Retina display. Size it in CSS pixels instead,
    // so the glow looks the same on every screen. The blur textures are sampled, not copied,
    // so they need not match the frame's resolution.
    this.bloom.setSize(viewport.width, viewport.height);
    for (const target of this.resizables) target.resize(viewport);
  }
}
