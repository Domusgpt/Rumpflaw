/**
 * tide-field.js — "nautical chart" bathymetry shader for the hero.
 * Domain-warped fbm height field rendered as anti-aliased depth contours (every 5th
 * contour is an index line), tinted from tide-blue to brass, with a dawn glow at the
 * horizon and fine film grain. WebGL2 → WebGL1(+OES_standard_derivatives) → CSS fallback.
 *
 * Budget: 4-octave fbm ×3 per pixel, ≤1.5 device-pixel ratio (≤1.0 on small/coarse
 * screens), 30fps idle cap, paused off-screen / in background tabs, single static frame
 * under prefers-reduced-motion.
 */
const COMMON = /* glsl */ `
uniform vec2 uRes;
uniform float uTime;
uniform float uZoom;
uniform float uShift;
uniform float uFade;

const vec3 INK_TOP = vec3(0.035, 0.075, 0.110);
const vec3 INK_MID = vec3(0.055, 0.110, 0.157);
const vec3 INK_LOW = vec3(0.090, 0.176, 0.240);
const vec3 BRASS   = vec3(0.773, 0.647, 0.455);
const vec3 TIDE    = vec3(0.616, 0.714, 0.757);

float hash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
  for (int i = 0; i < 4; i++) { v += a * noise(p); p = m * p; a *= 0.5; }
  return v;
}
vec4 shade(vec2 fc) {
  vec2 uv = fc / uRes;
  vec2 p = (fc - 0.5 * uRes) / uRes.y;
  float t = uTime * 0.035;
  vec2 q = p * (1.45 / uZoom) + vec2(0.22 * uShift, -0.18 * uShift);
  vec2 w = vec2(fbm(q * 1.05 + vec2(0.0, t)), fbm(q * 1.05 + vec2(4.7, 1.9) - t));
  float h = fbm(q * 1.55 + 1.65 * w + vec2(t * 0.6, -t * 0.3));

  vec3 col = mix(INK_LOW, INK_TOP, smoothstep(0.0, 1.0, uv.y));
  col = mix(col, INK_MID, 0.3) + (h - 0.5) * 0.07;

  float f = h * 24.0;
  float d = abs(fract(f - 0.5) - 0.5);
  float fw = max(fwidth(f), 1e-4);
  float minor = 1.0 - smoothstep(0.0, fw * 1.15, d);
  float major = 1.0 - smoothstep(0.0, fw * 1.9, d);
  float isMajor = step(mod(floor(f + 0.5), 5.0), 0.5);
  float lineA = mix(minor * 0.15, major * 0.40, isMajor);
  float focus = smoothstep(1.25, 0.2, length((uv - vec2(0.68, 0.42)) * vec2(1.15, 1.0)));
  lineA *= mix(0.42, 1.0, focus) * uFade;
  vec3 lineCol = mix(TIDE, BRASS, smoothstep(0.3, 0.95, uv.x * 0.55 + (1.0 - uv.y) * 0.55));
  col = mix(col, lineCol, lineA);

  float glow = exp(-pow((uv.y - 0.06) * 3.6, 2.0));
  col += BRASS * glow * 0.11;
  col += (hash(fc + fract(uTime * 0.37) * 91.0) - 0.5) * 0.016;
  return vec4(col, 1.0);
}`;

const VERT2 = `#version 300 es
in vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }`;
const FRAG2 = `#version 300 es
precision highp float;
${COMMON}
out vec4 outColor;
void main() { outColor = shade(gl_FragCoord.xy); }`;
const VERT1 = `attribute vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }`;
const FRAG1 = `#extension GL_OES_standard_derivatives : enable
precision highp float;
${COMMON}
void main() { gl_FragColor = shade(gl_FragCoord.xy); }`;

export class TideField {
  /** @returns {TideField|null} */
  static mount(canvas, opts = {}) {
    try {
      const tf = new TideField(canvas, opts);
      return tf.ok ? tf : null;
    } catch (err) {
      console.warn('[tide] disabled:', err?.message || err);
      return null;
    }
  }

  constructor(canvas, { reduced = false, fps = 30 } = {}) {
    this.canvas = canvas;
    this.reduced = reduced;
    this.frameMs = 1000 / fps;
    this.state = { zoom: 1, shift: 0, fade: 1 };
    this.visible = true;
    this.running = false;
    this.dirty = true;
    this.t0 = performance.now();
    this.last = 0;
    this.raf = 0;
    this.ok = this.#init();
    if (!this.ok) return;

    this.ro = new ResizeObserver(() => { this.#resize(); this.dirty = true; if (this.reduced) this.#draw(this.t0 + 8000); });
    this.ro.observe(canvas);
    this.io = new IntersectionObserver(([e]) => { this.visible = e.isIntersecting; this.visible ? this.start() : this.stop(); }, { rootMargin: '120px' });
    this.io.observe(canvas);
    this.onVis = () => (document.hidden ? this.stop() : this.visible && this.start());
    document.addEventListener('visibilitychange', this.onVis);
    canvas.addEventListener('webglcontextlost', this.onLost = (e) => { e.preventDefault(); this.stop(); this.lost = true; });
    canvas.addEventListener('webglcontextrestored', this.onRestored = () => { this.lost = false; this.ok = this.#init(); this.#resize(); this.start(); });

    this.#resize();
    if (this.reduced) this.#draw(this.t0 + 8000); // one static, calm frame
    else this.start();
  }

  #init() {
    const attrs = { antialias: false, alpha: false, depth: false, stencil: false, premultipliedAlpha: false, preserveDrawingBuffer: false, powerPreference: 'low-power' };
    let gl = this.canvas.getContext('webgl2', attrs);
    let v2 = !!gl;
    if (!gl) {
      gl = this.canvas.getContext('webgl', attrs) || this.canvas.getContext('experimental-webgl', attrs);
      if (!gl || !gl.getExtension('OES_standard_derivatives')) return false;
    }
    this.gl = gl;
    const prog = this.#program(v2 ? VERT2 : VERT1, v2 ? FRAG2 : FRAG1);
    if (!prog) return false;
    this.prog = prog;
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'aPos');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    this.u = Object.fromEntries(['uRes', 'uTime', 'uZoom', 'uShift', 'uFade'].map((n) => [n, gl.getUniformLocation(prog, n)]));
    return true;
  }

  #program(vs, fs) {
    const gl = this.gl;
    const sh = (type, src) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { console.warn('[tide] shader:', gl.getShaderInfoLog(s)); return null; }
      return s;
    };
    const v = sh(gl.VERTEX_SHADER, vs);
    const f = sh(gl.FRAGMENT_SHADER, fs);
    if (!v || !f) return null;
    const p = gl.createProgram();
    gl.attachShader(p, v);
    gl.attachShader(p, f);
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) { console.warn('[tide] link:', gl.getProgramInfoLog(p)); return null; }
    gl.useProgram(p);
    return p;
  }

  #resize() {
    const small = Math.min(window.innerWidth, window.innerHeight) < 700 || matchMedia('(pointer: coarse)').matches;
    const dpr = Math.min(window.devicePixelRatio || 1, small ? 1 : 1.5);
    const w = Math.max(1, Math.round(this.canvas.clientWidth * dpr));
    const h = Math.max(1, Math.round(this.canvas.clientHeight * dpr));
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
      this.gl?.viewport(0, 0, w, h);
    }
  }

  #draw(now) {
    const gl = this.gl;
    if (!gl || this.lost) return;
    gl.uniform2f(this.u.uRes, this.canvas.width, this.canvas.height);
    gl.uniform1f(this.u.uTime, (now - this.t0) / 1000);
    gl.uniform1f(this.u.uZoom, this.state.zoom);
    gl.uniform1f(this.u.uShift, this.state.shift);
    gl.uniform1f(this.u.uFade, this.state.fade);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    this.dirty = false;
  }

  #loop = (now) => {
    if (!this.running) return;
    this.raf = requestAnimationFrame(this.#loop);
    if (!this.dirty && now - this.last < this.frameMs) return;
    this.last = now;
    this.#draw(now);
  };

  start() {
    if (this.running || this.reduced || !this.ok || document.hidden) return;
    this.running = true;
    this.raf = requestAnimationFrame(this.#loop);
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  /** Update scroll-driven uniforms (zoom, shift, fade). */
  set(partial) {
    Object.assign(this.state, partial);
    this.dirty = true;
    if (this.reduced) this.#draw(this.t0 + 8000);
  }

  destroy() {
    this.stop();
    this.ro?.disconnect();
    this.io?.disconnect();
    document.removeEventListener('visibilitychange', this.onVis);
    this.canvas.removeEventListener('webglcontextlost', this.onLost);
    this.canvas.removeEventListener('webglcontextrestored', this.onRestored);
    this.gl?.getExtension('WEBGL_lose_context')?.loseContext();
  }
}
