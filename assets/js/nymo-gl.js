/* ==========================================================================
   Nymo website — WebGL pieces. No libraries.
   1. Globe: a sphere of points (people, everywhere). Connections draw across
      it as dotted arcs, with messages travelling both ways.
   2. Mark:  the Nymo mark in 3D, raymarched. A porcelain sphere (you) and a
      polished chrome ring (the stranger) that glide together until they touch.
   ========================================================================== */
(() => {
  "use strict";
  const N = (window.Nymo = window.Nymo || {});

  /* ---------------------------------------------------------------- helpers */
  function context(canvas) {
    const attrs = { alpha: true, antialias: false, depth: false, stencil: false, premultipliedAlpha: true, powerPreference: "high-performance" };
    return canvas.getContext("webgl2", attrs) || canvas.getContext("webgl", attrs) || canvas.getContext("experimental-webgl", attrs);
  }
  function compile(gl, type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(s);
      gl.deleteShader(s);
      throw new Error("Shader: " + log);
    }
    return s;
  }
  function program(gl, vs, fs) {
    const p = gl.createProgram();
    gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, vs));
    gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error("Program: " + gl.getProgramInfoLog(p));
    const u = {};
    const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) {
      const info = gl.getActiveUniform(p, i);
      u[info.name.replace(/\[0\]$/, "")] = gl.getUniformLocation(p, info.name);
    }
    return { p, u };
  }
  function buffer(gl, data) {
    const b = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, b);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    return b;
  }
  function attrib(gl, prog, name, buf, size) {
    const loc = gl.getAttribLocation(prog.p, name);
    if (loc < 0) return;
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0);
  }
  // Column-major 3×3 rotation: pitch (x) after yaw (y)
  function rotation(yaw, pitch, roll) {
    const cy = Math.cos(yaw), sy = Math.sin(yaw);
    const cx = Math.cos(pitch), sx = Math.sin(pitch);
    const cz = Math.cos(roll || 0), sz = Math.sin(roll || 0);
    // R = Rz * Rx * Ry
    const ry = [cy, 0, -sy, 0, 1, 0, sy, 0, cy];
    const rx = [1, 0, 0, 0, cx, sx, 0, -sx, cx];
    const rz = [cz, sz, 0, -sz, cz, 0, 0, 0, 1];
    return mul3(rz, mul3(rx, ry));
  }
  function mul3(a, b) {
    const o = new Array(9);
    for (let c = 0; c < 3; c++) for (let r = 0; r < 3; r++) {
      o[c * 3 + r] = a[r] * b[c * 3] + a[3 + r] * b[c * 3 + 1] + a[6 + r] * b[c * 3 + 2];
    }
    return o;
  }
  function apply3(m, v) {
    return [m[0] * v[0] + m[3] * v[1] + m[6] * v[2], m[1] * v[0] + m[4] * v[1] + m[7] * v[2], m[2] * v[0] + m[5] * v[1] + m[8] * v[2]];
  }
  function transpose3(m) { return [m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8]]; }
  function normalize(v) { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; }
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);

  N.webglAvailable = function () {
    try {
      const c = document.createElement("canvas");
      return !!context(c);
    } catch (e) { return false; }
  };

  /* ==================================================================== */
  /* Globe                                                                 */
  /* ==================================================================== */
  const GLOBE_VS_DOTS = `
    attribute vec3 aPos;
    attribute float aSeed;
    uniform mat3 uRot;
    uniform vec2 uCenter;
    uniform float uRadius;
    uniform vec2 uRes;
    uniform float uTime;
    uniform float uDpr;
    uniform float uSize;
    uniform float uAlpha;
    uniform float uFadeBottom;
    varying float vA;
    void main() {
      vec3 p = uRot * aPos;
      vec2 px = uCenter + p.xy * uRadius;
      gl_Position = vec4(px / uRes * 2.0 - 1.0, 0.0, 1.0);
      float front = clamp(p.z * 0.5 + 0.5, 0.0, 1.0);
      float spark = step(0.965, aSeed);
      float tw = 0.72 + 0.28 * sin(uTime * (0.4 + aSeed * 1.6) + aSeed * 61.0);
      float sparkTw = 0.35 + 0.65 * pow(0.5 + 0.5 * sin(uTime * (0.8 + aSeed) + aSeed * 97.0), 3.0);
      float a = (0.045 + 0.7 * pow(front, 1.7)) * mix(tw, sparkTw * 1.6, spark);
      a *= smoothstep(0.0, uFadeBottom, px.y);
      vA = a * uAlpha;
      gl_PointSize = uSize * uDpr * (0.6 + 0.6 * front) * (0.85 + 0.3 * fract(aSeed * 13.0)) * (1.0 + spark * 0.5);
    }`;
  const GLOBE_FS_DOTS = `
    precision mediump float;
    varying float vA;
    void main() {
      float d = length(gl_PointCoord - 0.5) * 2.0;
      float a = (1.0 - smoothstep(0.45, 1.0, d)) * vA;
      gl_FragColor = vec4(vec3(a), a);
    }`;

  const GLOBE_VS_ARC = `
    attribute float aT;
    uniform mat3 uRot;
    uniform vec3 uA;
    uniform vec3 uB;
    uniform float uLift;
    uniform vec2 uCenter;
    uniform float uRadius;
    uniform vec2 uRes;
    uniform float uDpr;
    uniform float uHead;
    uniform float uTail;
    uniform float uP1;
    uniform float uP2;
    uniform float uAlpha;
    uniform float uFadeBottom;
    varying float vA;
    vec3 slerp(vec3 a, vec3 b, float t) {
      float o = acos(clamp(dot(a, b), -0.9999, 0.9999));
      float so = sin(o);
      return (sin((1.0 - t) * o) * a + sin(t * o) * b) / so;
    }
    float bump(float x, float c, float w) { float d = (x - c) * w; return exp(-d * d); }
    void main() {
      vec3 p = slerp(uA, uB, aT) * (1.0 + uLift * sin(3.14159265 * aT));
      p = uRot * p;
      vec2 px = uCenter + p.xy * uRadius;
      gl_Position = vec4(px / uRes * 2.0 - 1.0, 0.0, 1.0);
      float shown = step(aT, uHead) * step(uTail, aT);
      float hidden = (p.z < 0.0 && length(p.xy) < 1.0) ? 0.1 : 1.0;
      float head = bump(aT, uHead, 44.0) * step(aT, uHead) * step(uHead, 0.999);
      float pulse = (uP1 >= 0.0 ? bump(aT, uP1, 34.0) : 0.0) + (uP2 >= 0.0 ? bump(aT, uP2, 34.0) : 0.0);
      float a = shown * hidden * (0.34 + 0.9 * pulse + 0.8 * head);
      a *= smoothstep(0.0, uFadeBottom, px.y);
      vA = a * uAlpha;
      gl_PointSize = uDpr * (1.6 + 2.2 * pulse + 1.6 * head);
    }`;
  const GLOBE_FS_ARC = GLOBE_FS_DOTS;

  // Endpoints: 0 = filled dot (you), 1 = ring (stranger, black inside), 2 = soft halo
  const GLOBE_VS_SPRITE = `
    attribute float aDummy;
    uniform mat3 uRot;
    uniform vec3 uP;
    uniform vec2 uCenter;
    uniform float uRadius;
    uniform vec2 uRes;
    uniform float uDpr;
    uniform float uSize;
    uniform float uAlpha;
    uniform float uFadeBottom;
    varying float vA;
    void main() {
      vec3 p = uRot * uP;
      vec2 px = uCenter + p.xy * uRadius;
      gl_Position = vec4(px / uRes * 2.0 - 1.0, 0.0, 1.0 + aDummy * 0.0);
      float facing = smoothstep(-0.05, 0.25, p.z);
      vA = uAlpha * facing * smoothstep(0.0, uFadeBottom, px.y);
      gl_PointSize = uSize * uDpr;
    }`;
  const GLOBE_FS_SPRITE = `
    precision mediump float;
    uniform float uKind;
    varying float vA;
    void main() {
      float d = length(gl_PointCoord - 0.5) * 2.0;
      if (uKind < 0.5) {
        float a = (1.0 - smoothstep(0.82, 1.0, d)) * vA;
        gl_FragColor = vec4(vec3(a), a);
      } else if (uKind < 1.5) {
        float ring = smoothstep(0.64, 0.76, d) * (1.0 - smoothstep(0.86, 1.0, d));
        float body = 1.0 - smoothstep(0.86, 1.0, d);
        gl_FragColor = vec4(vec3(ring), body) * vA;
      } else {
        float a = pow(max(0.0, 1.0 - d), 2.4) * 0.55 * vA;
        gl_FragColor = vec4(vec3(a), a);
      }
    }`;

  // Soft atmosphere around the sphere's edge
  const GLOBE_VS_RIM = `
    attribute vec2 aQuad;
    uniform vec2 uCenter;
    uniform float uRadius;
    uniform vec2 uRes;
    varying vec2 vQ;
    varying float vY;
    void main() {
      vQ = aQuad * 1.5;
      vec2 px = uCenter + vQ * uRadius;
      vY = px.y;
      gl_Position = vec4(px / uRes * 2.0 - 1.0, 0.0, 1.0);
    }`;
  const GLOBE_FS_RIM = `
    precision mediump float;
    uniform float uAlpha;
    uniform float uFade;
    varying vec2 vQ;
    varying float vY;
    void main() {
      float d = length(vQ);
      float inner = smoothstep(0.7, 1.0, d) * (1.0 - smoothstep(0.995, 1.01, d));
      float outer = exp(-max(d - 1.0, 0.0) * 11.0) * step(1.0, d);
      float a = (inner * 0.06 + outer * 0.05) * uAlpha;
      a *= smoothstep(0.0, uFade, vY);
      gl_FragColor = vec4(vec3(a), a);
    }`;

  class Globe {
    constructor(canvas, options) {
      const opts = options || {};
      this.canvas = canvas;
      const gl = context(canvas);
      if (!gl) throw new Error("WebGL unavailable");
      this.gl = gl;
      this.quality = opts.quality || "high";
      this.count = opts.count || (this.quality === "low" ? 2800 : 5200);
      this.maxDpr = this.quality === "low" ? 1.5 : 2;
      this.time = 0;
      this.yaw = 0.9;
      this.pitch = -0.38;
      this.vyaw = 0;
      this.vpitch = 0;
      this.tiltX = 0;
      this.tiltY = 0;
      this.target = { tiltX: 0, tiltY: 0 };
      this.layout = { cx: 0.5, cy: 0.5, r: 200, fadeBottom: 120, lift: 0 };
      this.state = { alpha: 0, scale: 1, spin: 1, extraYaw: 0, settleYaw: 0 };
      this.arcs = [];
      this.nextSpawn = 0.6;
      this.spawned = 0;
      this.onLabels = opts.onLabels || null;

      this.dots = program(gl, GLOBE_VS_DOTS, GLOBE_FS_DOTS);
      this.arc = program(gl, GLOBE_VS_ARC, GLOBE_FS_ARC);
      this.sprite = program(gl, GLOBE_VS_SPRITE, GLOBE_FS_SPRITE);
      this.rim = program(gl, GLOBE_VS_RIM, GLOBE_FS_RIM);

      // Fibonacci sphere
      const n = this.count;
      const pos = new Float32Array(n * 3);
      const seed = new Float32Array(n);
      const golden = Math.PI * (3 - Math.sqrt(5));
      for (let i = 0; i < n; i++) {
        const y = 1 - (2 * (i + 0.5)) / n;
        const r = Math.sqrt(1 - y * y);
        const phi = i * golden;
        // tiny jitter so the lattice doesn't moiré
        const j = 0.004;
        pos[i * 3] = Math.cos(phi) * r + (Math.random() - 0.5) * j;
        pos[i * 3 + 1] = y + (Math.random() - 0.5) * j;
        pos[i * 3 + 2] = Math.sin(phi) * r + (Math.random() - 0.5) * j;
        seed[i] = Math.random();
      }
      this.bPos = buffer(gl, pos);
      this.bSeed = buffer(gl, seed);
      const steps = 220;
      const t = new Float32Array(steps);
      for (let i = 0; i < steps; i++) t[i] = i / (steps - 1);
      this.arcSteps = steps;
      this.bArc = buffer(gl, t);
      this.bOne = buffer(gl, new Float32Array([0]));
      this.bQuad = buffer(gl, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]));

      const range = gl.getParameter(gl.ALIASED_POINT_SIZE_RANGE);
      this.maxPoint = range ? range[1] : 64;

      this.lost = false;
      canvas.addEventListener("webglcontextlost", (e) => { e.preventDefault(); this.lost = true; if (opts.onLost) opts.onLost(); });
      this.resize();
    }

    setLayout(l) { Object.assign(this.layout, l); }

    resize() {
      const r = this.canvas.getBoundingClientRect();
      this.w = Math.max(1, Math.round(r.width));
      this.h = Math.max(1, Math.round(r.height));
      this.dpr = Math.min(window.devicePixelRatio || 1, this.maxDpr);
      this.canvas.width = Math.round(this.w * this.dpr);
      this.canvas.height = Math.round(this.h * this.dpr);
    }

    // world point → layout pixels (CSS, y down)
    project(local) {
      const p = apply3(this.rot, local);
      const L = this.layout;
      const r = L.r * this.state.scale;
      return { x: L.cx + p[0] * r, y: L.cy - L.lift - p[1] * r, z: p[2] };
    }

    spawn(labelled) {
      // Choose both ends on the visible side, in world space, then carry them into the globe's own space.
      // state.settleYaw is the part of the turn that is about to unwind (the intro spin):
      // ends are placed where they will face the viewer once it has.
      const s = this.state;
      const settled = s.settleYaw ? rotation(this.yaw + s.extraYaw - s.settleYaw + this.tiltX, this.pitch + this.tiltY, -0.12) : this.rot;
      const inv = transpose3(settled);
      const pick = (minZ) => {
        for (let k = 0; k < 40; k++) {
          const v = normalize([Math.random() * 2 - 1, Math.random() * 1.1 - 0.35, Math.random()]);
          if (v[2] > minZ) return v;
        }
        return normalize([0.2, 0.1, 1]);
      };
      let a;
      let b;
      if (labelled) {
        a = normalize([-0.42, -0.26, 0.87]);
        b = normalize([0.38, 0.4, 0.83]);
      } else {
        a = pick(0.55);
        for (let k = 0; k < 80; k++) {
          b = pick(0.5);
          const ang = Math.acos(clamp(a[0] * b[0] + a[1] * b[1] + a[2] * b[2], -1, 1));
          const mid = normalize([a[0] + b[0], a[1] + b[1], a[2] + b[2]]);
          if (ang > 0.5 && ang < 1.25 && mid[2] > 0.72) break;
        }
      }
      const ang = Math.acos(clamp(a[0] * b[0] + a[1] * b[1] + a[2] * b[2], -1, 1));
      this.arcs.push({
        a: apply3(inv, a),
        b: apply3(inv, b),
        lift: 0.08 + ang * 0.13,
        born: this.time,
        draw: labelled ? 1.5 : 1.15,
        hold: labelled ? 9 : 3.4,
        fade: 1.1,
        labelled: !!labelled,
      });
      this.spawned += 1;
    }

    update(dt) {
      this.time += dt;
      const s = this.state;
      // inertia + idle spin
      this.vyaw *= Math.pow(0.04, dt);
      this.vpitch *= Math.pow(0.04, dt);
      this.yaw += (0.045 * s.spin + this.vyaw) * dt;
      this.pitch = clamp(this.pitch + this.vpitch * dt, -1.05, 0.55);
      const k = 1 - Math.pow(0.002, dt);
      this.tiltX += (this.target.tiltX - this.tiltX) * k;
      this.tiltY += (this.target.tiltY - this.tiltY) * k;
      this.rot = rotation(this.yaw + s.extraYaw + this.tiltX, this.pitch + this.tiltY, -0.12);

      // connections
      if (this.time > this.nextSpawn && this.arcs.length < 3 && s.alpha > 0.05) {
        this.spawn(this.spawned === 0);
        this.nextSpawn = this.time + (this.spawned === 1 ? 2.6 : 2.2 + Math.random() * 1.2);
      }
      this.arcs = this.arcs.filter((a) => this.time - a.born < a.draw + a.hold + a.fade);

      if (this.onLabels) {
        const first = this.arcs.find((a) => a.labelled);
        if (first) {
          const age = this.time - first.born;
          const vis = smooth(0.2, 0.8, age) * (1 - smooth(first.draw + first.hold, first.draw + first.hold + first.fade * 0.6, age));
          const pa = this.project(first.a);
          const pb = this.project(first.b);
          const showB = smooth(first.draw * 0.8, first.draw + 0.4, age);
          this.onLabels({ a: pa, b: pb, alpha: vis * s.alpha * smooth(0.0, 0.3, pa.z), alphaB: vis * showB * s.alpha * smooth(0.0, 0.3, pb.z) });
        } else {
          this.onLabels(null);
        }
      }
    }

    render() {
      const gl = this.gl;
      if (this.lost) return;
      const s = this.state;
      const L = this.layout;
      gl.viewport(0, 0, this.canvas.width, this.canvas.height);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      if (s.alpha <= 0.001) return;
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE);

      const center = [L.cx, this.h - (L.cy - L.lift)];
      const radius = L.r * s.scale;
      const res = [this.w, this.h];

      // atmosphere
      let P = this.rim;
      gl.useProgram(P.p);
      attrib(gl, P, "aQuad", this.bQuad, 2);
      gl.uniform2fv(P.u.uCenter, center);
      gl.uniform1f(P.u.uRadius, radius);
      gl.uniform2fv(P.u.uRes, res);
      gl.uniform1f(P.u.uAlpha, s.alpha);
      gl.uniform1f(P.u.uFade, L.fadeBottom);
      gl.drawArrays(gl.TRIANGLES, 0, 6);

      // points
      P = this.dots;
      gl.useProgram(P.p);
      attrib(gl, P, "aPos", this.bPos, 3);
      attrib(gl, P, "aSeed", this.bSeed, 1);
      gl.uniformMatrix3fv(P.u.uRot, false, this.rot);
      gl.uniform2fv(P.u.uCenter, center);
      gl.uniform1f(P.u.uRadius, radius);
      gl.uniform2fv(P.u.uRes, res);
      gl.uniform1f(P.u.uTime, this.time);
      gl.uniform1f(P.u.uDpr, this.dpr);
      gl.uniform1f(P.u.uSize, this.quality === "low" ? 2.3 : 2.5);
      gl.uniform1f(P.u.uAlpha, s.alpha);
      gl.uniform1f(P.u.uFadeBottom, L.fadeBottom);
      gl.drawArrays(gl.POINTS, 0, this.count);

      // arcs
      P = this.arc;
      gl.useProgram(P.p);
      attrib(gl, P, "aT", this.bArc, 1);
      gl.uniformMatrix3fv(P.u.uRot, false, this.rot);
      gl.uniform2fv(P.u.uCenter, center);
      gl.uniform1f(P.u.uRadius, radius);
      gl.uniform2fv(P.u.uRes, res);
      gl.uniform1f(P.u.uDpr, this.dpr);
      gl.uniform1f(P.u.uFadeBottom, L.fadeBottom);
      const ends = [];
      for (const a of this.arcs) {
        const age = this.time - a.born;
        const head = easeInOut(clamp(age / a.draw, 0, 1));
        const out = clamp((age - a.draw - a.hold) / a.fade, 0, 1);
        const tail = easeInOut(out);
        const hold = age - a.draw;
        const cyc = 2.4;
        const p1 = hold > 0 && out === 0 ? (hold % cyc) / cyc : -1;
        const p2 = hold > cyc * 0.5 && out === 0 ? 1 - ((hold - cyc * 0.5) % cyc) / cyc : -1;
        gl.uniform3fv(P.u.uA, a.a);
        gl.uniform3fv(P.u.uB, a.b);
        gl.uniform1f(P.u.uLift, a.lift);
        gl.uniform1f(P.u.uHead, head);
        gl.uniform1f(P.u.uTail, tail);
        gl.uniform1f(P.u.uP1, p1);
        gl.uniform1f(P.u.uP2, p2);
        gl.uniform1f(P.u.uAlpha, s.alpha * (1 - out * 0.6));
        gl.drawArrays(gl.POINTS, 0, this.arcSteps);
        const popA = easeOut(clamp(age / 0.5, 0, 1)) * (1 - out);
        const popB = easeOut(clamp((age - a.draw * 0.92) / 0.5, 0, 1)) * (1 - out);
        ends.push({ p: a.a, kind: 0, pop: popA, labelled: a.labelled }, { p: a.b, kind: 1, pop: popB, labelled: a.labelled });
      }

      // endpoints: halos (additive), then the dot and the ring (over)
      P = this.sprite;
      gl.useProgram(P.p);
      attrib(gl, P, "aDummy", this.bOne, 1);
      gl.uniformMatrix3fv(P.u.uRot, false, this.rot);
      gl.uniform2fv(P.u.uCenter, center);
      gl.uniform1f(P.u.uRadius, radius);
      gl.uniform2fv(P.u.uRes, res);
      gl.uniform1f(P.u.uDpr, this.dpr);
      gl.uniform1f(P.u.uFadeBottom, L.fadeBottom);
      const maxCss = this.maxPoint / this.dpr;
      for (const e of ends) {
        if (e.pop <= 0) continue;
        gl.uniform3fv(P.u.uP, e.p);
        gl.uniform1f(P.u.uKind, 2);
        gl.uniform1f(P.u.uSize, Math.min(maxCss, (e.labelled ? 120 : 84) * e.pop));
        gl.uniform1f(P.u.uAlpha, s.alpha * e.pop);
        gl.drawArrays(gl.POINTS, 0, 1);
      }
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      for (const e of ends) {
        if (e.pop <= 0) continue;
        gl.uniform3fv(P.u.uP, e.p);
        gl.uniform1f(P.u.uKind, e.kind);
        const base = e.labelled ? (e.kind === 0 ? 15 : 15.5) : (e.kind === 0 ? 9 : 10);
        gl.uniform1f(P.u.uSize, Math.min(maxCss, base * (0.4 + 0.6 * e.pop)));
        gl.uniform1f(P.u.uAlpha, s.alpha * e.pop);
        gl.drawArrays(gl.POINTS, 0, 1);
      }
    }

    // pointer drag (called by the page)
    drag(dx, dy) {
      this.yaw += dx * 0.0055;
      this.pitch = clamp(this.pitch + dy * 0.0045, -1.05, 0.55);
      this.vyaw = dx * 0.35;
      this.vpitch = dy * 0.25;
    }
    hit(x, y) {
      const L = this.layout;
      const dx = x - L.cx;
      const dy = y - (L.cy - L.lift);
      return Math.hypot(dx, dy) < L.r * this.state.scale * 1.05;
    }
  }
  N.Globe = Globe;

  /* ==================================================================== */
  /* Mark — raymarched porcelain sphere + chrome ring                      */
  /* ==================================================================== */
  const MARK_VS = `
    attribute vec2 aQuad;
    void main() { gl_Position = vec4(aQuad, 0.0, 1.0); }`;

  const MARK_FS = `
    precision highp float;
    uniform vec2 uRes;
    uniform float uTime;
    uniform vec3 uSphere;
    uniform vec3 uRing;
    uniform mat3 uRingRot;
    uniform mat3 uSceneRot;
    uniform float uEnvTurn;
    uniform float uZoom;

    float sdTorus(vec3 p, vec2 t) { vec2 q = vec2(length(p.xy) - t.x, p.z); return length(q) - t.y; }

    vec2 map(vec3 p) {
      p = uSceneRot * p;
      float ds = length(p - uSphere) - 1.0;
      float dt = sdTorus(uRingRot * (p - uRing), vec2(0.918, 0.082));
      return ds < dt ? vec2(ds, 1.0) : vec2(dt, 2.0);
    }

    vec3 calcNormal(vec3 p) {
      const vec2 e = vec2(0.0008, -0.0008);
      return normalize(e.xyy * map(p + e.xyy).x + e.yyx * map(p + e.yyx).x + e.yxy * map(p + e.yxy).x + e.xxx * map(p + e.xxx).x);
    }

    // A black studio with softboxes: what the chrome reflects
    vec3 env(vec3 d) {
      float c = cos(uEnvTurn), s = sin(uEnvTurn);
      d = vec3(c * d.x + s * d.z, d.y, -s * d.x + c * d.z);
      vec3 col = vec3(0.0);
      float top = smoothstep(0.42, 0.78, d.y) * (1.0 - smoothstep(0.5, 0.85, abs(d.x))) * (1.0 - smoothstep(0.55, 0.9, abs(d.z)));
      col += vec3(1.5) * top;
      float left = smoothstep(-0.45, -0.82, d.x) * (1.0 - smoothstep(0.12, 0.42, abs(d.y - 0.05)));
      col += vec3(1.15) * left;
      float right = smoothstep(0.55, 0.88, d.x) * (1.0 - smoothstep(0.05, 0.22, abs(d.y + 0.12)));
      col += vec3(0.8) * right;
      float back = smoothstep(0.6, 0.95, d.z) * (1.0 - smoothstep(0.25, 0.6, abs(d.y - 0.25)));
      col += vec3(0.18) * back;
      col += vec3(0.035) * smoothstep(0.1, -0.7, d.y);
      col += vec3(0.012);
      return col;
    }

    float ao(vec3 p, vec3 n) {
      float o = 0.0, w = 1.0;
      for (int i = 1; i <= 4; i++) {
        float h = 0.04 * float(i);
        o += (h - map(p + n * h).x) * w;
        w *= 0.6;
      }
      return clamp(1.0 - 3.2 * o, 0.0, 1.0);
    }

    vec3 porcelain(vec3 p, vec3 n, vec3 rd, vec3 reflCol) {
      vec3 L = normalize(vec3(-0.45, 0.78, 0.52));
      float wrap = max((dot(n, L) + 0.4) / 1.4, 0.0);
      vec3 base = vec3(0.94);
      vec3 col = base * (0.26 + 0.78 * wrap * wrap);
      col += base * 0.12 * max(dot(n, normalize(vec3(0.7, 0.1, 0.7))), 0.0);
      col += base * 0.08 * max(-n.y, 0.0);
      col += base * 0.05 * max(-n.x, 0.0);
      float fres = pow(1.0 - max(dot(n, -rd), 0.0), 5.0);
      col = mix(col, reflCol, 0.03 + 0.55 * fres);
      vec3 H = normalize(L - rd);
      col += vec3(0.55) * pow(max(dot(n, H), 0.0), 120.0);
      return col;
    }

    vec3 chrome(vec3 n, vec3 rd, vec3 reflCol) {
      float fres = pow(1.0 - max(dot(n, -rd), 0.0), 3.0);
      vec3 L = normalize(vec3(-0.45, 0.78, 0.52));
      float lit = 0.5 + 0.5 * dot(n, L);
      return reflCol * (0.75 + 0.25 * fres) + vec3(0.07) * lit;
    }

    // March from ro along rd; returns (t, id), id = 0 when nothing was hit.
    // minD/tMin: the closest approach (as an angle), for soft silhouettes.
    vec2 march(vec3 ro, vec3 rd, float tmin, float tmax, out float minD, out float tMin) {
      float t = tmin;
      minD = 1e5;
      tMin = tmin;
      for (int i = 0; i < 90; i++) {
        vec3 p = ro + rd * t;
        vec2 h = map(p);
        float ang = h.x / max(t, 1e-3);
        if (ang < minD) { minD = ang; tMin = t; }
        if (h.x < 0.0006 * t) return vec2(t, h.y);
        t += h.x * 0.92;
        if (t > tmax) break;
      }
      return vec2(t, 0.0);
    }

    bool bounds(vec3 ro, vec3 rd, float r, out float t0, out float t1) {
      float b = dot(ro, rd);
      float c = dot(ro, ro) - r * r;
      float h = b * b - c;
      if (h < 0.0) return false;
      h = sqrt(h);
      t0 = max(-b - h, 0.0);
      t1 = -b + h;
      return t1 > 0.0;
    }

    vec3 simpleShade(vec3 p, vec3 rd, float id) {
      vec3 n = calcNormal(p);
      vec3 r = reflect(rd, n);
      if (id < 1.5) return porcelain(p, n, rd, env(r));
      return chrome(n, rd, env(r)) * 0.9;
    }

    void main() {
      vec2 uv = (gl_FragCoord.xy - 0.5 * uRes) / (0.5 * uRes.x);
      vec3 ro = vec3(0.0, 0.0, 9.0);
      vec3 rd = normalize(vec3(uv * 0.36 * uZoom, -1.0));
      float pix = 0.72 / uRes.x * uZoom;

      float t0, t1;
      vec4 outCol = vec4(0.0);
      if (bounds(ro, rd, 4.6, t0, t1)) {
        float minD, tMin;
        vec2 hit = march(ro, rd, t0, t1, minD, tMin);
        if (hit.y > 0.5) {
          vec3 p = ro + rd * hit.x;
          vec3 n = calcNormal(p);
          vec3 r = reflect(rd, n);
          // one bounce: does the reflection see the other object?
          float md2, tm2;
          vec2 h2 = march(p + n * 0.004, r, 0.0, 9.0, md2, tm2);
          vec3 reflCol = h2.y > 0.5 ? simpleShade(p + n * 0.004 + r * h2.x, r, h2.y) : env(r);
          vec3 col = hit.y < 1.5 ? porcelain(p, n, rd, reflCol) : chrome(n, rd, reflCol);
          col *= mix(0.55, 1.0, ao(p, n));
          col = 1.0 - exp(-col * 2.1);
          col = pow(col, vec3(0.9));
          outCol = vec4(col, 1.0);
        } else {
          // soft silhouette: shade the closest point and cover the pixel partly
          float cover = 1.0 - smoothstep(0.0, pix * 1.4, minD);
          if (cover > 0.01) {
            vec3 p = ro + rd * tMin;
            vec2 h = map(p);
            vec3 col = simpleShade(p, rd, h.y);
            col = 1.0 - exp(-col * 2.1);
            col = pow(col, vec3(0.9));
            outCol = vec4(col * cover, cover);
          }
        }
      }
      gl_FragColor = outCol;
    }`;

  class Mark {
    constructor(canvas, options) {
      const opts = options || {};
      this.canvas = canvas;
      const gl = context(canvas);
      if (!gl) throw new Error("WebGL unavailable");
      this.gl = gl;
      this.quality = opts.quality || "high";
      this.maxDpr = this.quality === "low" ? 1.5 : 1.75;
      this.prog = program(gl, MARK_VS, MARK_FS);
      this.bQuad = buffer(gl, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]));
      this.time = 0;
      this.state = { assemble: 0, pointerX: 0, pointerY: 0 };
      this.px = 0;
      this.py = 0;
      this.perf = { acc: 0, n: 0, skip: 20 };
      this.lost = false;
      canvas.addEventListener("webglcontextlost", (e) => { e.preventDefault(); this.lost = true; if (opts.onLost) opts.onLost(); });
      this.resize();
    }

    resize() {
      const r = this.canvas.getBoundingClientRect();
      this.w = Math.max(1, Math.round(r.width));
      this.h = Math.max(1, Math.round(r.height));
      this.dpr = Math.min(window.devicePixelRatio || 1, this.maxDpr);
      this.canvas.width = Math.round(this.w * this.dpr);
      this.canvas.height = Math.round(this.h * this.dpr);
    }

    update(dt) {
      this.time += dt;
      const k = 1 - Math.pow(0.003, dt);
      this.px += (this.state.pointerX - this.px) * k;
      this.py += (this.state.pointerY - this.py) * k;
    }

    render() {
      const gl = this.gl;
      if (this.lost) return;
      const P = this.prog;
      const a = easeInOut(clamp(this.state.assemble, 0, 1));
      const t = this.time;
      const apart = 1 - a;
      const float = Math.sin(t * 0.9) * 0.05;

      const sphere = [-1 - apart * 1.55, 0.16 * apart + float, -0.4 * apart];
      const ring = [1 + apart * 1.55, -0.16 * apart + float * 0.6, -0.4 * apart];
      this.zoom = 1 + apart * 0.45;
      // ring: edge-on while apart, facing the camera when it touches; then it breathes a little
      const idle = Math.sin(t * 0.55) * 0.2 * a;
      const ringRot = rotation(apart * 1.35 + idle + this.px * 0.25, apart * 0.4 + Math.sin(t * 0.4) * 0.06 * a, 0);
      const sceneRot = rotation(this.px * 0.32, -this.py * 0.18, 0);

      gl.viewport(0, 0, this.canvas.width, this.canvas.height);
      gl.disable(gl.BLEND);
      gl.useProgram(P.p);
      attrib(gl, P, "aQuad", this.bQuad, 2);
      gl.uniform2f(P.u.uRes, this.canvas.width, this.canvas.height);
      gl.uniform1f(P.u.uTime, t);
      gl.uniform3fv(P.u.uSphere, sphere);
      gl.uniform3fv(P.u.uRing, ring);
      gl.uniformMatrix3fv(P.u.uRingRot, false, ringRot);
      gl.uniformMatrix3fv(P.u.uSceneRot, false, sceneRot);
      gl.uniform1f(P.u.uEnvTurn, t * 0.12 + this.px * 0.9);
      gl.uniform1f(P.u.uZoom, this.zoom || 1);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    }

    // Lower the resolution if frames take too long
    adapt(dt) {
      const p = this.perf;
      if (p.skip > 0) { p.skip--; return; }
      p.acc += dt;
      p.n++;
      if (p.n < 60) return;
      const avg = p.acc / p.n;
      p.acc = 0;
      p.n = 0;
      if (avg > 1 / 40 && this.maxDpr > 0.75) {
        this.maxDpr = Math.max(0.75, this.maxDpr - 0.25);
        this.resize();
        p.skip = 20;
      }
    }
  }
  N.Mark = Mark;
})();
