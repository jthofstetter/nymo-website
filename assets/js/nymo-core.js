/* ==========================================================================
   Nymo website — motion core. No libraries.
   One animation clock, smooth scrolling, scroll scenes, text splitting,
   the two-dot cursor and magnetic buttons.
   ========================================================================== */
(() => {
  "use strict";
  const N = (window.Nymo = window.Nymo || {});
  const doc = document;
  const root = doc.documentElement;
  const mq = (q) => window.matchMedia(q);

  N.reduce = mq("(prefers-reduced-motion: reduce)").matches;
  N.fine = mq("(hover: hover) and (pointer: fine)").matches;
  N.small = () => mq("(max-width: 899px)").matches;
  N.$ = (sel, ctx = doc) => ctx.querySelector(sel);
  N.$$ = (sel, ctx = doc) => Array.from(ctx.querySelectorAll(sel));

  const clamp = (N.clamp = (v, a, b) => Math.min(b, Math.max(a, v)));
  N.lerp = (a, b, t) => a + (b - a) * t;
  N.range = (p, a, b) => clamp((p - a) / (b - a), 0, 1);           // progress of p inside [a, b]
  N.ease = {
    outCubic: (t) => 1 - Math.pow(1 - t, 3),
    inOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
    outExpo: (t) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t)),
    inOutExpo: (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t < 0.5 ? Math.pow(2, 20 * t - 10) / 2 : (2 - Math.pow(2, -20 * t + 10)) / 2),
  };
  N.wait = (ms) => new Promise((r) => setTimeout(r, ms));
  N.safe = (name, fn) => {
    try { return fn(); } catch (err) { console.error(`[Nymo] ${name}:`, err); return null; }
  };

  /* ------------------------------------------------------------------ clock */
  // One requestAnimationFrame for everything. A callback that returns false is removed.
  const subs = new Set();
  let ticking = false;
  let last = 0;
  function frame(now) {
    const dt = Math.min(0.05, Math.max(0.001, (now - last) / 1000));
    last = now;
    subs.forEach((fn) => { if (fn(dt, now) === false) subs.delete(fn); });
    if (subs.size) requestAnimationFrame(frame);
    else ticking = false;
  }
  N.tick = (fn) => {
    subs.add(fn);
    if (!ticking) {
      ticking = true;
      last = performance.now();
      requestAnimationFrame(frame);
    }
    return () => subs.delete(fn);
  };

  /* --------------------------------------------------------------- springs */
  N.spring = (stiffness = 170, damping = 16) => ({
    x: 0, v: 0, target: 0,
    step(dt) {
      const a = -stiffness * (this.x - this.target) - damping * this.v;
      this.v += a * dt;
      this.x += this.v * dt;
      return this.x;
    },
    get resting() { return Math.abs(this.x - this.target) < 0.01 && Math.abs(this.v) < 0.01; },
  });

  /* -------------------------------------------------------- smooth scrolling */
  // Wheel input glides; touch, keyboard and the scrollbar stay native.
  N.smooth = (() => {
    if (N.reduce || !N.fine) return null;
    root.classList.add("has-smooth");
    let target = window.scrollY;
    let current = window.scrollY;
    let active = false;
    let stopped = false;
    let tween = null;
    const max = () => Math.max(0, root.scrollHeight - window.innerHeight);

    function scrollable(el, dy) {
      while (el && el !== doc.body && el !== root) {
        if (el.nodeType === 1) {
          const cs = getComputedStyle(el);
          if (/(auto|scroll)/.test(cs.overflowY) && el.scrollHeight > el.clientHeight + 1) {
            if (dy > 0 && el.scrollTop + el.clientHeight < el.scrollHeight - 1) return true;
            if (dy < 0 && el.scrollTop > 0) return true;
          }
        }
        el = el.parentElement;
      }
      return false;
    }

    function step(dt) {
      if (tween) {
        tween.t = Math.min(1, tween.t + dt / tween.dur);
        current = tween.from + (tween.to - tween.from) * N.ease.inOutExpo(tween.t);
        if (tween.t >= 1) { current = tween.to; tween = null; }
        target = current;
      } else {
        current += (target - current) * (1 - Math.exp(-dt * 9.5));
        if (Math.abs(target - current) < 0.35) current = target;
      }
      window.scrollTo(0, current);
      if (!tween && current === target) { active = false; return false; }
      return true;
    }
    function run() {
      if (active) return;
      active = true;
      N.tick(step);
    }

    window.addEventListener("wheel", (e) => {
      if (stopped || e.ctrlKey || e.defaultPrevented) return;
      if (doc.querySelector("dialog[open]")) return;
      let dy = e.deltaY;
      if (e.deltaMode === 1) dy *= 16;
      else if (e.deltaMode === 2) dy *= window.innerHeight;
      if (Math.abs(e.deltaX) > Math.abs(dy)) return;
      if (scrollable(e.target, dy)) return;
      e.preventDefault();
      tween = null;
      if (!active) { current = window.scrollY; target = current; }
      target = clamp(target + dy, 0, max());
      run();
    }, { passive: false });

    window.addEventListener("scroll", () => {
      if (!active) { current = window.scrollY; target = current; }
    }, { passive: true });

    return {
      to(y, dur) {
        const to = clamp(y, 0, max());
        const dist = Math.abs(to - window.scrollY);
        current = window.scrollY;
        tween = { from: current, to, t: 0, dur: dur || clamp(0.7 + dist / 3800, 0.8, 1.7) };
        run();
      },
      stop() { stopped = true; tween = null; target = current = window.scrollY; },
      start() { stopped = false; target = current = window.scrollY; },
      get active() { return active; },
    };
  })();

  // In-page links glide too (and keep focus where the reader landed).
  N.goTo = (hash) => {
    const el = hash && hash.length > 1 ? doc.getElementById(hash.slice(1)) : null;
    const y = el ? el.getBoundingClientRect().top + window.scrollY - (parseFloat(getComputedStyle(root).scrollPaddingTop) || 0) : 0;
    if (N.smooth) N.smooth.to(y);
    else window.scrollTo({ top: y, behavior: N.reduce ? "auto" : "smooth" });
    if (el) {
      if (!el.hasAttribute("tabindex")) el.setAttribute("tabindex", "-1");
      setTimeout(() => el.focus({ preventScroll: true }), N.reduce ? 0 : 400);
    }
    try { history.replaceState(null, "", hash); } catch (e) { /* not allowed here */ }
  };
  doc.addEventListener("click", (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return;
    const a = e.target.closest && e.target.closest('a[href^="#"]');
    if (!a) return;
    const hash = a.getAttribute("href");
    if (hash === "#" || (hash.length > 1 && !doc.getElementById(hash.slice(1)))) return;
    e.preventDefault();
    N.goTo(hash);
  });

  /* ---------------------------------------------------------- scroll scenes */
  // progress 0 → 1 between two moments:  [element edge, viewport edge]
  // e.g. from [0, 1] = element top meets viewport bottom, to [1, 0] = element bottom meets viewport top.
  const scenes = [];
  // Layout positions, so transforms on the way (a rising sheet, a tilted phone) don't skew them
  function measure(s) {
    let top = 0;
    for (let n = s.el; n; n = n.offsetParent) top += n.offsetTop;
    const h = s.el.offsetHeight;
    const vh = window.innerHeight;
    s.s0 = top + s.from[0] * h - s.from[1] * vh;
    s.s1 = top + s.to[0] * h - s.to[1] * vh;
    if (s.s1 - s.s0 < 1) s.s1 = s.s0 + 1;
  }
  function runScenes(force) {
    const y = window.scrollY;
    for (const s of scenes) {
      const p = clamp((y - s.s0) / (s.s1 - s.s0), 0, 1);
      if (force || p !== s.p) {
        s.p = p;
        s.update(p, s);
      }
    }
  }
  N.scene = (el, opts) => {
    if (!el) return null;
    const s = { el, from: opts.from || [0, 1], to: opts.to || [1, 0], update: opts.update, p: -1 };
    measure(s);
    scenes.push(s);
    runScenes(false);
    return s;
  };
  N.refresh = () => {
    scenes.forEach(measure);
    runScenes(true);
  };
  let sceneQueued = false;
  window.addEventListener("scroll", () => {
    if (sceneQueued) return;
    sceneQueued = true;
    requestAnimationFrame(() => { sceneQueued = false; runScenes(false); });
  }, { passive: true });
  let refreshTimer = 0;
  const queueRefresh = () => { clearTimeout(refreshTimer); refreshTimer = setTimeout(N.refresh, 120); };
  window.addEventListener("resize", queueRefresh);
  window.addEventListener("load", () => N.refresh());
  if ("ResizeObserver" in window) new ResizeObserver(queueRefresh).observe(doc.body);

  // Scroll speed in px/s, for things that react to it
  N.velocity = 0;
  (() => {
    let lastY = window.scrollY;
    let lastT = performance.now();
    window.addEventListener("scroll", () => {
      const now = performance.now();
      const dt = Math.max(1, now - lastT);
      const v = ((window.scrollY - lastY) / dt) * 1000;
      N.velocity = N.velocity * 0.6 + v * 0.4;
      lastY = window.scrollY;
      lastT = now;
    }, { passive: true });
  })();

  /* ------------------------------------------------------------ split text */
  // Wraps words (and optionally characters) in spans for animation.
  // Screen readers get the original text from a hidden copy.
  N.split = (el, mode) => {
    if (!el || el.dataset.split) return el && el._split;
    // line breaks count as spaces for the reader ("Three steps.<br>No strings.")
    const flat = (node) => Array.from(node.childNodes).map((c) => (c.nodeType === 3 ? c.textContent : c.nodeName === "BR" ? " " : flat(c))).join("");
    const original = flat(el).replace(/\s+/g, " ").trim();
    const visual = doc.createElement("span");
    visual.className = "split";
    visual.setAttribute("aria-hidden", "true");
    const words = [];
    const chars = [];

    const walk = (node, into) => {
      node.childNodes.forEach((child) => {
        if (child.nodeType === 3) {
          const parts = child.textContent.split(/(\s+)/);
          parts.forEach((part) => {
            if (!part) return;
            if (/^\s+$/.test(part)) { into.appendChild(doc.createTextNode(" ")); return; }
            const w = doc.createElement("span");
            w.className = "w";
            const inner = doc.createElement("span");
            inner.className = "w__i";
            if (mode === "chars") {
              Array.from(part).forEach((ch) => {
                const c = doc.createElement("span");
                c.className = "c";
                c.textContent = ch;
                inner.appendChild(c);
                chars.push(c);
              });
            } else {
              inner.textContent = part;
            }
            w.appendChild(inner);
            into.appendChild(w);
            words.push(w);
          });
        } else if (child.nodeType === 1) {
          if (child.classList.contains("sr")) return;
          const copy = child.cloneNode(false);
          copy.removeAttribute("id");
          into.appendChild(copy);
          walk(child, copy);
        }
      });
    };
    walk(el, visual);
    const sr = doc.createElement("span");
    sr.className = "sr";
    sr.textContent = original;
    el.textContent = "";
    el.append(sr, visual);
    words.forEach((w, i) => w.style.setProperty("--wi", i));
    chars.forEach((c, i) => c.style.setProperty("--ci", i));
    el.dataset.split = mode || "words";
    el._split = { words, chars, visual };
    return el._split;
  };

  /* -------------------------------------------------- reveal when in view */
  N.reveal = (els, opts) => {
    const list = Array.isArray(els) ? els : [els];
    if (!("IntersectionObserver" in window) || N.reduce) {
      list.forEach((el) => el && el.classList.add("is-in"));
      return;
    }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        e.target.classList.add("is-in");
        if (opts && opts.onIn) opts.onIn(e.target);
        io.unobserve(e.target);
      });
    }, { rootMargin: (opts && opts.margin) || "0px 0px -12% 0px", threshold: 0 });
    list.forEach((el) => el && io.observe(el));
  };

  /* ---------------------------------------------------------------- cursor */
  // The dot is you; the ring follows a beat behind. Press, and they touch.
  N.cursor = () => {
    const el = N.$("[data-cursor]");
    if (!el || !N.fine || N.reduce) { if (el) el.remove(); return; }
    const dot = N.$("[data-cursor-dot]", el);
    const ring = N.$("[data-cursor-ring]", el);
    root.classList.add("has-cursor");
    const p = { x: -100, y: -100 };
    const d = { x: -100, y: -100 };
    const rx = N.spring(150, 19);
    const ry = N.spring(150, 19);
    let seen = false;
    let pressed = false;
    let ringR = 18;

    window.addEventListener("pointermove", (e) => {
      if (e.pointerType !== "mouse") return;
      p.x = e.clientX;
      p.y = e.clientY;
      if (!seen) {
        seen = true;
        d.x = p.x; d.y = p.y;
        rx.x = p.x; ry.x = p.y;
        el.classList.remove("is-hidden");
      }
    }, { passive: true });
    const interactive = "a, button, summary, label, [data-cursor-link]";
    doc.addEventListener("pointerover", (e) => {
      const t = e.target;
      const text = !!t.closest("input, textarea, [contenteditable]");
      const link = !text && !!t.closest(interactive);
      const drag = !text && !link && !!t.closest("[data-cursor-drag]");
      el.classList.toggle("is-text", text);
      el.classList.toggle("is-link", link);
      el.classList.toggle("is-drag", drag);
      ringR = link ? 30 : drag ? 34 : 18;
    });
    doc.addEventListener("pointerdown", (e) => { if (e.pointerType === "mouse") { pressed = true; el.classList.add("is-press"); } });
    window.addEventListener("pointerup", () => { pressed = false; el.classList.remove("is-press"); });
    doc.documentElement.addEventListener("pointerleave", () => el.classList.add("is-hidden"));
    doc.documentElement.addEventListener("pointerenter", () => { if (seen) el.classList.remove("is-hidden"); });
    window.addEventListener("blur", () => el.classList.add("is-hidden"));

    N.tick((dt) => {
      d.x += (p.x - d.x) * (1 - Math.exp(-dt * 40));
      d.y += (p.y - d.y) * (1 - Math.exp(-dt * 40));
      // pressed: the ring sits right next to the dot, like the logo
      rx.target = pressed ? d.x + 4 + 9 : p.x;
      ry.target = pressed ? d.y : p.y;
      rx.step(dt);
      ry.step(dt);
      dot.style.transform = `translate3d(${d.x}px, ${d.y}px, 0)`;
      ring.style.transform = `translate3d(${rx.x}px, ${ry.x}px, 0)`;
      void ringR;
    });
  };

  /* ------------------------------------------------------- magnetic buttons */
  N.magnetic = () => {
    if (!N.fine || N.reduce) return;
    N.$$("[data-magnetic]").forEach((el) => {
      const sx = N.spring(190, 13);
      const sy = N.spring(190, 13);
      let live = false;
      const loop = (dt) => {
        sx.step(dt);
        sy.step(dt);
        el.style.translate = `${sx.x.toFixed(2)}px ${sy.x.toFixed(2)}px`;
        if (sx.resting && sy.resting && sx.target === 0 && sy.target === 0) { el.style.translate = ""; live = false; return false; }
        return true;
      };
      const wake = () => { if (!live) { live = true; N.tick(loop); } };
      el.addEventListener("pointermove", (e) => {
        const r = el.getBoundingClientRect();
        sx.target = (e.clientX - (r.left + r.width / 2)) * 0.3;
        sy.target = (e.clientY - (r.top + r.height / 2)) * 0.4;
        wake();
      });
      el.addEventListener("pointerleave", () => { sx.target = 0; sy.target = 0; wake(); });
    });
  };
})();
