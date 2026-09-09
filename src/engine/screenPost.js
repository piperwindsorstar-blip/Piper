// ============================================================================
//  SCREEN POST — the GPU replacement for Screen.applyPost()'s CPU passes.
//
//  Screen.ctx/buf (the 480x270 canvas every scene still draws into with
//  ordinary Canvas2D calls — rect/text/panel/sprites, all untouched) is
//  uploaded here as one texture and run through the same four effects the
//  old pixel-pushing version did, in the same order, just as real WebGL
//  filters instead of getImageData loops and canvas-to-canvas blits:
//  HD-2D dither -> bloom -> colour grade -> vignette. The bloom pass in
//  particular keeps the original's own trick (threshold by cubing, then
//  blur by repeatedly *resizing* — a bilinear downsample+upsample is a
//  cheap box blur) rather than reaching for a real gaussian filter, so its
//  look doesn't shift at all, just its cost moves from the CPU to the GPU.
// ============================================================================

import * as PIXI from '../vendor/pixi.module.js';

const DITHER_FRAG = `
  precision highp float;
  in vec2 vTextureCoord;
  uniform sampler2D uTexture;
  uniform vec4 uInputSize;
  out vec4 finalColor;

  // A literal lookup, not a dynamically-indexed array/matrix — some GL
  // drivers restrict dynamic indexing in fragment shaders, and this table
  // is only 16 entries, so the branches cost nothing measurable at 480x270.
  float bayer4x4(float ix, float iy) {
    float idx = iy * 4.0 + ix;
    if (idx < 0.5) return 0.0;  if (idx < 1.5) return 8.0;
    if (idx < 2.5) return 2.0;  if (idx < 3.5) return 10.0;
    if (idx < 4.5) return 12.0; if (idx < 5.5) return 4.0;
    if (idx < 6.5) return 14.0; if (idx < 7.5) return 6.0;
    if (idx < 8.5) return 3.0;  if (idx < 9.5) return 11.0;
    if (idx < 10.5) return 1.0; if (idx < 11.5) return 9.0;
    if (idx < 12.5) return 15.0; if (idx < 13.5) return 7.0;
    if (idx < 14.5) return 13.0; return 5.0;
  }

  float quant(float v, float step) {
    return clamp(floor(v / step + 0.5) * step, 0.0, 1.0);
  }

  void main(void) {
    vec4 c = texture(uTexture, vTextureCoord);
    float lum = dot(c.rgb, vec3(0.3, 0.59, 0.11));
    if (lum < 14.0 / 255.0) { finalColor = c; return; }
    vec2 px = vTextureCoord * uInputSize.xy;
    float ix = mod(floor(px.x), 4.0);
    float iy = mod(floor(px.y), 4.0);
    float bias = (bayer4x4(ix, iy) / 16.0 - 0.47) * 2.2 / 255.0;
    float step = 4.0 / 255.0;
    finalColor = vec4(quant(c.r + bias, step), quant(c.g + bias, step), quant(c.b + bias, step), c.a);
  }
`;

const THRESHOLD_FRAG = `
  precision highp float;
  in vec2 vTextureCoord;
  uniform sampler2D uTexture;
  out vec4 finalColor;
  void main(void) {
    vec4 c = texture(uTexture, vTextureCoord);
    // Cubing (not squaring) collapses the midtones and keeps only what was
    // already near-white — a flat multiply glows the whole image instead.
    // Un-premultiply first so a translucent bright pixel cubes by its true
    // colour, not by colour-already-scaled-by-alpha.
    vec3 straight = c.a > 0.0001 ? c.rgb / c.a : c.rgb;
    vec3 bright = straight * straight * straight;
    finalColor = vec4(bright * c.a, c.a);
  }
`;

const GRADE_FRAG = `
  precision highp float;
  in vec2 vTextureCoord;
  uniform sampler2D uTexture;
  uniform vec3 uGradeColor;
  uniform float uGradeAmount;
  out vec4 finalColor;
  float overlayCh(float b, float s) {
    return b <= 0.5 ? 2.0 * b * s : 1.0 - 2.0 * (1.0 - b) * (1.0 - s);
  }
  void main(void) {
    vec4 c = texture(uTexture, vTextureCoord);
    vec3 blended = vec3(overlayCh(c.r, uGradeColor.r), overlayCh(c.g, uGradeColor.g), overlayCh(c.b, uGradeColor.b));
    finalColor = vec4(mix(c.rgb, blended, uGradeAmount), c.a);
  }
`;

// W/H/the gradient's own radii never change (this game's logical buffer is
// always exactly 480x270 — see screen.js), so only the amount is a uniform.
const VIGNETTE_FRAG = `
  precision highp float;
  in vec2 vTextureCoord;
  uniform sampler2D uTexture;
  uniform vec4 uInputSize;
  uniform float uVignetteAmount;
  out vec4 finalColor;
  void main(void) {
    vec4 c = texture(uTexture, vTextureCoord);
    vec2 px = vTextureCoord * uInputSize.xy;
    float dist = distance(px, uInputSize.xy * 0.5);
    float t = clamp((dist - uInputSize.y * 0.34) / (uInputSize.y * 0.61), 0.0, 1.0);
    finalColor = vec4(c.rgb * (1.0 - t * uVignetteAmount), c.a);
  }
`;

// The standard Pixi v8 filter vertex shader — every filter here just samples
// its input at the fragment's own position, so they all share this unchanged.
const FILTER_VERTEX = `
  in vec2 aPosition;
  out vec2 vTextureCoord;
  uniform vec4 uInputSize;
  uniform vec4 uOutputFrame;
  uniform vec4 uOutputTexture;
  vec4 filterVertexPosition(void) {
    vec2 position = aPosition * uOutputFrame.zw + uOutputFrame.xy;
    position.x = position.x * (2.0 / uOutputTexture.x) - 1.0;
    position.y = position.y * (2.0 * uOutputTexture.z / uOutputTexture.y) - uOutputTexture.z;
    return vec4(position, 0.0, 1.0);
  }
  vec2 filterTextureCoord(void) {
    return aPosition * (uOutputFrame.zw * uInputSize.zw);
  }
  void main(void) {
    gl_Position = filterVertexPosition();
    vTextureCoord = filterTextureCoord();
  }
`;

function hexToRgb01(hex) {
  if (typeof hex !== 'string' || hex[0] !== '#') return [1, 1, 1];
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

export class ScreenPost {
  constructor(canvas, w, h) {
    this.canvas = canvas;
    this.w = w;
    this.h = h;
    this.ready = false;
    // Screen.resize() runs synchronously right after this constructor and
    // calls resizeOutput() with the real computed size well before this
    // async init ever settles — but PIXI.Application.init() re-applies
    // *its own* width/height to the canvas element once it finishes
    // setting up the renderer, clobbering whatever resize() had already
    // set. So the desired output size is tracked here independently rather
    // than trusted from canvas.width/height, which Pixi treats as its own
    // property to manage, and applied once init actually completes.
    this.pendingSize = { width: canvas.width, height: canvas.height };
    this.app = new PIXI.Application();
    this.app.init({
      canvas, width: canvas.width, height: canvas.height,
      antialias: false, resolution: 1, autoDensity: false,
      backgroundAlpha: 1, background: '#000000', powerPreference: 'low-power',
      // render() below drives every pass explicitly (dither -> bloom ->
      // grade/vignette), so Pixi's own autoStart ticker must not also be
      // rendering app.stage (which is never used and stays empty) on its
      // own loop — left running, it stomps every manual render() call an
      // instant after this file makes it, right before the browser ever
      // gets to paint that frame.
      autoStart: false,
    }).then(() => this.setup());
  }

  setup() {
    const { w, h } = this;
    this.app.ticker.stop();
    this.app.renderer.resize(this.pendingSize.width, this.pendingSize.height);

    this.ditherFilter = new PIXI.Filter({
      glProgram: new PIXI.GlProgram({ vertex: FILTER_VERTEX, fragment: DITHER_FRAG, name: 'dither' }),
      resources: {},
    });
    this.thresholdFilter = new PIXI.Filter({
      glProgram: new PIXI.GlProgram({ vertex: FILTER_VERTEX, fragment: THRESHOLD_FRAG, name: 'threshold' }),
      resources: {},
    });
    this.gradeColor = new Float32Array([1, 1, 1]);
    this.gradeFilter = new PIXI.Filter({
      glProgram: new PIXI.GlProgram({ vertex: FILTER_VERTEX, fragment: GRADE_FRAG, name: 'grade' }),
      resources: { gradeUniforms: {
        uGradeColor: { value: this.gradeColor, type: 'vec3<f32>' },
        uGradeAmount: { value: 0, type: 'f32' },
      } },
    });
    this.vignetteFilter = new PIXI.Filter({
      glProgram: new PIXI.GlProgram({ vertex: FILTER_VERTEX, fragment: VIGNETTE_FRAG, name: 'vignette' }),
      resources: { vignetteUniforms: { uVignetteAmount: { value: 0.5, type: 'f32' } } },
    });

    this.ditheredRT = PIXI.RenderTexture.create({ width: w, height: h });
    this.bloomA = PIXI.RenderTexture.create({ width: w >> 1, height: h >> 1 });
    this.bloomB = PIXI.RenderTexture.create({ width: w >> 2, height: h >> 2 });
    this.bloomedRT = PIXI.RenderTexture.create({ width: w, height: h });

    this.ditheredSprite = new PIXI.Sprite(this.ditheredRT);

    this.bloomSourceSprite = new PIXI.Sprite(this.ditheredRT);
    this.bloomSourceSprite.width = this.bloomA.width;
    this.bloomSourceSprite.height = this.bloomA.height;
    this.bloomSourceSprite.filters = [this.thresholdFilter];

    this.bloomMidSprite = new PIXI.Sprite(this.bloomA);
    this.bloomMidSprite.width = this.bloomB.width;
    this.bloomMidSprite.height = this.bloomB.height;

    this.bloomFinalSprite = new PIXI.Sprite(this.bloomB);
    this.bloomFinalSprite.width = w;
    this.bloomFinalSprite.height = h;
    this.bloomFinalSprite.blendMode = 'add';

    this.bloomStack = new PIXI.Container();
    this.bloomStack.addChild(new PIXI.Sprite(this.ditheredRT), this.bloomFinalSprite);

    this.finalSprite = new PIXI.Sprite(this.bloomedRT);
    this.finalSprite.filters = [this.gradeFilter, this.vignetteFilter];
    this.bloomedRT.source.scaleMode = this.pendingScaleMode ?? 'linear';

    this.ready = true;
  }

  /** The final upscale from 480x270 to the real output size: 'linear' for a
   *  smoothed look (this Screen's own default) or 'nearest' for crisp pixel
   *  scaling (what the shipped play.html's own resize override wants —
   *  see its own comment for why). Safe to call before ScreenPost is ready;
   *  the choice is applied once setup() actually creates bloomedRT. */
  setFinalScaleMode(mode) {
    this.pendingScaleMode = mode;
    if (this.ready) this.bloomedRT.source.scaleMode = mode;
  }

  resizeOutput(cw, ch) {
    this.pendingSize = { width: cw, height: ch };
    if (!this.ready) return;
    this.app.renderer.resize(cw, ch);
  }

  /** Uploads `buf` (Screen's 480x270 2D canvas) and runs the full dither ->
   *  bloom -> grade -> vignette pipeline, presenting the result scaled to
   *  the current canvas size with `shakeX/shakeY` applied as a pixel
   *  offset (screen shake), matching Screen.present()'s old CPU version. */
  render(buf, { grade, bloom, vignette, shakeX = 0, shakeY = 0, scale = 1 }) {
    if (!this.ready) return;
    if (!this.mainSprite) {
      this.mainTex = PIXI.Texture.from(buf);
      this.mainTex.source.scaleMode = 'linear';
      this.mainSprite = new PIXI.Sprite(this.mainTex);
      this.mainSprite.filters = [this.ditherFilter];
    } else {
      this.mainTex.source.update();
    }

    const r = this.app.renderer;

    // 1. HD-2D dither, straight into ditheredRT.
    r.render({ container: this.mainSprite, target: this.ditheredRT });

    // 2. Bloom: downsample-with-threshold, downsample again, then additive-
    //    blend the upscaled result back over the dithered image.
    if (bloom > 0) {
      r.render({ container: this.bloomSourceSprite, target: this.bloomA });
      r.render({ container: this.bloomMidSprite, target: this.bloomB });
      this.bloomFinalSprite.alpha = bloom;
      r.render({ container: this.bloomStack, target: this.bloomedRT });
    } else {
      r.render({ container: this.ditheredSprite, target: this.bloomedRT });
    }

    // 3+4. Grade and vignette, then present at the real output size.
    this.gradeFilter.resources.gradeUniforms.uniforms.uGradeAmount = grade ? grade.amount : 0;
    if (grade) this.gradeColor.set(hexToRgb01(grade.color));
    this.vignetteFilter.resources.vignetteUniforms.uniforms.uVignetteAmount = vignette;

    this.finalSprite.position.set(Math.round(shakeX * scale), Math.round(shakeY * scale));
    this.finalSprite.width = Math.round(this.w * scale);
    this.finalSprite.height = Math.round(this.h * scale);
    r.render(this.finalSprite);
  }
}
