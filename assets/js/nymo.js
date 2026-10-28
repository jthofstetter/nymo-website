/* ==========================================================================
   Nymo website — page behaviour.
   Needs nymo-core.js (motion) and nymo-gl.js (3D). No other dependencies.
   ========================================================================== */
(() => {
  "use strict";

  /** The Google Play listing. Change it here once the app is published. */
  const STORE_URL = "https://play.google.com/store/apps/details?id=app.nymo";
  /**
   * Tags each store link with where it sits (data-store="hero" …). Google Play reads the tag and the
   * Play Console shows the installs under "Tracked channels (UTM)". Nothing is stored on this page.
   */
  const storeLink = (place) =>
    `${STORE_URL}&referrer=${encodeURIComponent(`utm_source=nymo-website&utm_medium=${place || "link"}&utm_campaign=website`)}`;

  const N = window.Nymo;
  if (!N) return;
  const doc = document;
  const root = doc.documentElement;
  const { $, $$, clamp, lerp, range, ease } = N;

  function el(tag, className, text) {
    const node = doc.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }
  const lowPower = () => N.small() || (navigator.hardwareConcurrency || 8) <= 4 || (navigator.deviceMemory || 8) <= 4;

  /* ------------------------------------------------------------------------
     Small things
     ------------------------------------------------------------------------ */
  $$("[data-store]").forEach((a) => { a.href = storeLink(a.dataset.store); });
  $$("[data-year]").forEach((node) => { node.textContent = String(new Date().getFullYear()); });
  // Hidden "before" states in the CSS only apply once this script runs.
  if (!N.reduce) root.classList.add("has-motion");

  /* ------------------------------------------------------------------------
     Intro: the app's search, then the match. The pair flies into the logo.
     ------------------------------------------------------------------------ */
  let readyResolve;
  const ready = new Promise((r) => { readyResolve = r; });
  function markReady() {
    if (root.classList.contains("is-ready")) return;
    root.classList.add("is-ready");
    root.classList.remove("is-loading");
    if (N.smooth) N.smooth.start();
    readyResolve();
  }

  function swapLabel(node, text) {
    if (!node.animate) { node.textContent = text; return; }
    const out = node.animate([{ transform: "none", opacity: 1 }, { transform: "translateY(-110%)", opacity: 0 }], { duration: 280, easing: "cubic-bezier(.5,0,.75,0)", fill: "forwards" });
    out.onfinish = () => {
      node.textContent = text;
      node.animate([{ transform: "translateY(110%)", opacity: 0 }, { transform: "none", opacity: 1 }], { duration: 640, easing: "cubic-bezier(.16,1,.3,1)", fill: "forwards" });
    };
  }

  function initIntro() {
    const loader = $("[data-loader]");
    const pair = $("[data-loader-pair]");
    const label = $("[data-loader-label]");
    // The head script decides: first visit this session, no #link, motion allowed.
    const play = root.classList.contains("intro") && !N.reduce && loader && pair && label;
    const cleanup = () => {
      if (loader) loader.remove();
      if (pair) pair.remove();
      root.classList.remove("intro", "is-intro");
    };

    if (!play) {
      cleanup();
      markReady();
      return;
    }
    try { sessionStorage.setItem("nymo-intro", "1"); } catch (e) { /* storage blocked */ }
    root.classList.add("is-loading", "is-intro");
    if (N.smooth) N.smooth.stop();
    window.scrollTo(0, 0);
    const failsafe = setTimeout(() => { cleanup(); markReady(); }, 6500);
    const t0 = performance.now();

    Promise.race([doc.fonts ? doc.fonts.ready : Promise.resolve(), N.wait(2400)])
      .then(() => N.wait(Math.max(0, 1050 - (performance.now() - t0))))
      .then(async () => {
        loader.classList.add("is-connected");
        pair.classList.add("is-connected");
        swapLabel(label, "You’re connected.");
        await N.wait(1000);

        // Fly the pair into the logo in the navigation
        const mark = $(".nav .brand__mark");
        if (mark) {
          const pr = pair.getBoundingClientRect();
          const mr = mark.getBoundingClientRect();
          pair.style.setProperty("--fx", `${(mr.left + mr.width / 2) - (pr.left + pr.width / 2)}px`);
          pair.style.setProperty("--fy", `${(mr.top + mr.height / 2) - (pr.top + pr.height / 2)}px`);
          pair.style.setProperty("--fs", String(mr.width / pr.width));
        }
        pair.classList.add("is-flying");
        loader.classList.add("is-leaving");
        await N.wait(420);
        markReady();
        await N.wait(680);
        // landed: hand over to the real logo
        pair.classList.add("is-gone");
        root.classList.remove("is-intro");
        await N.wait(600);
        clearTimeout(failsafe);
        cleanup();
      })
      .catch(() => { clearTimeout(failsafe); cleanup(); markReady(); });
  }

  /* ------------------------------------------------------------------------
     Navigation: glass appears once the page scrolls
     ------------------------------------------------------------------------ */
  function initNav() {
    const nav = $("#nav");
    if (!nav) return;
    const sheet = $("[data-sheet]");
    let queued = false;
    const update = () => {
      queued = false;
      nav.classList.toggle("is-scrolled", window.scrollY > 8);
      // over the white sheet, the bar turns light
      if (sheet) {
        const r = sheet.getBoundingClientRect();
        nav.classList.toggle("is-light", r.top <= 0 && r.bottom > nav.offsetHeight * 0.5);
      }
    };
    window.addEventListener("scroll", () => {
      if (!queued) { queued = true; requestAnimationFrame(update); }
    }, { passive: true });
    window.addEventListener("resize", update);
    update();
  }

  /* ------------------------------------------------------------------------
     Menu sheet on small screens (native <dialog>)
     ------------------------------------------------------------------------ */
  function initMenu() {
    const dialog = $("#menu");
    const open = $("[data-menu-open]");
    if (!dialog || !open) return;
    if (typeof dialog.showModal !== "function") { open.hidden = true; return; }
    open.setAttribute("aria-expanded", "false");
    open.addEventListener("click", () => {
      dialog.showModal();
      open.setAttribute("aria-expanded", "true");
    });
    dialog.addEventListener("close", () => open.setAttribute("aria-expanded", "false"));
    $$("[data-menu-close]", dialog).forEach((node) => node.addEventListener("click", () => dialog.close()));
    $$("a", dialog).forEach((a) => a.addEventListener("click", (e) => {
      const hash = a.getAttribute("href");
      if (hash && hash.startsWith("#")) {
        e.preventDefault();
        e.stopPropagation();
        dialog.close();
        requestAnimationFrame(() => N.goTo(hash));
      } else {
        dialog.close();
      }
    }));
    dialog.addEventListener("click", (event) => {
      if (event.target !== dialog) return;
      const r = dialog.getBoundingClientRect();
      const inside = event.clientX >= r.left && event.clientX <= r.right && event.clientY >= r.top && event.clientY <= r.bottom;
      if (!inside) dialog.close();
    });
    window.matchMedia("(min-width: 900px)").addEventListener("change", (mq) => { if (mq.matches && dialog.open) dialog.close(); });
  }

  /* ------------------------------------------------------------------------
     Hero: the title rises letter by letter; the globe turns behind it.
     ------------------------------------------------------------------------ */
  function initHeroTitle() {
    const lines = $$(".hero__title .line > span");
    if (!lines.length) return;
    if (N.reduce) return;
    let all = [];
    lines.forEach((line, li) => {
      const split = N.split(line, "chars");
      const n = split.chars.length;
      split.chars.forEach((c, i) => {
        const fromCenter = Math.abs(i - (n - 1) / 2);
        c.style.setProperty("--d", `${Math.round(li * 110 + fromCenter * 26)}ms`);
      });
      all = all.concat(split.chars);
    });
    root.classList.add("has-split-title");
  }

  function initHero() {
    const hero = $(".hero");
    const canvas = $("[data-globe]");
    const hint = $(".hero__hint");
    const labelYou = $(".pair-label--you");
    const labelThem = $(".pair-label--them");
    if (!hero) return;

    let globe = null;
    if (canvas && N.webglAvailable && N.webglAvailable()) {
      try {
        globe = new N.Globe(canvas, {
          quality: lowPower() ? "low" : "high",
          onLabels: placeLabels,
          onLost: () => { root.classList.remove("has-globe"); initSky2D(); },
        });
      } catch (err) {
        console.warn("[Nymo] Globe unavailable:", err);
        globe = null;
      }
    }
    if (!globe) {
      if (canvas) canvas.remove();
      if (hint) hint.remove();
      initSky2D();
      return;
    }
    root.classList.add("has-globe");
    if (hint) hint.lastChild.textContent = N.fine ? "Drag the globe" : "Swipe to turn the globe";

    const space = $(".hero__space");
    let scrollLift = 0;
    let wy = 0;
    let wt = 0;
    function layout() {
      globe.resize();
      const W = globe.w;
      const H = globe.h;
      if (N.small() && space) {
        // small screens: the globe sits in the space above the headline
        const hr = hero.getBoundingClientRect();
        const sr = space.getBoundingClientRect();
        const top = sr.top - hr.top;
        const h = sr.height;
        const r = Math.min(W * 0.42, h * 0.46);
        globe.setLayout({ cx: W / 2, cy: top + h * 0.5, r, fadeBottom: 30, lift: -scrollLift });
      } else {
        const r = clamp(Math.min(W * 0.33, H * 0.62), 250, 560);
        globe.setLayout({ cx: W * 0.735, cy: H * 0.58, r, fadeBottom: Math.min(260, H * 0.3), lift: -scrollLift });
      }
      if (labelYou) wy = labelYou.offsetWidth;
      if (labelThem) wt = labelThem.offsetWidth;
      if (hint) {
        const L = globe.layout;
        const y = Math.min(H - 48, L.cy + L.r * 0.86);
        hint.style.transform = `translate(${(L.cx - hint.offsetWidth / 2).toFixed(1)}px, ${y.toFixed(1)}px)`;
      }
    }

    function placeLabels(info) {
      if (!labelYou || !labelThem) return;
      if (!info) { labelYou.style.opacity = "0"; labelThem.style.opacity = "0"; return; }
      const W = globe.w;
      labelYou.style.transform = `translate(${(info.a.x - wy / 2).toFixed(1)}px, ${(info.a.y + 22).toFixed(1)}px)`;
      labelThem.style.transform = `translate(${clamp(info.b.x - wt / 2, 12, W - wt - 12).toFixed(1)}px, ${(info.b.y - 38).toFixed(1)}px)`;
      labelYou.style.opacity = info.alpha.toFixed(3);
      labelThem.style.opacity = info.alphaB.toFixed(3);
    }

    // intro + scroll
    const st = globe.state;
    let intro = 0;
    let introStart = -1;
    let scrollP = 0;
    ready.then(() => { introStart = performance.now(); });
    if (N.reduce) { intro = 1; introStart = 0; }

    N.scene(hero, {
      from: [0, 0],
      to: [1, 0],
      update: (p) => {
        scrollP = p;
        scrollLift = p * globe.h * 0.32;
        globe.layout.lift = -scrollLift;
      },
    });

    // pointer: hover tilt and drag
    let dragging = false;
    let lastX = 0;
    let lastY = 0;
    let moved = 0;
    let dragged = false;
    const local = (e) => {
      const r = hero.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    const onText = (t) => !!t.closest("a, button, .hero__title, .hero__lede, .hero__note, .hero__actions");
    hero.addEventListener("pointerdown", (e) => {
      if (onText(e.target)) return;
      const p = local(e);
      if (!globe.hit(p.x, p.y)) return;
      dragging = true;
      moved = 0;
      lastX = e.clientX;
      lastY = e.clientY;
      if (e.pointerType === "mouse") hero.setPointerCapture(e.pointerId);
      root.classList.add("is-dragging");
    });
    hero.addEventListener("pointermove", (e) => {
      const p = local(e);
      if (dragging) {
        const dx = e.clientX - lastX;
        const dy = e.clientY - lastY;
        lastX = e.clientX;
        lastY = e.clientY;
        moved += Math.abs(dx) + Math.abs(dy);
        globe.drag(dx, e.pointerType === "mouse" ? dy : 0);
        if (N.reduce) { globe.update(0); globe.render(); }
        if (moved > 6 && !dragged) {
          dragged = true;
          if (hint) hint.classList.add("is-done");
        }
        return;
      }
      if (N.fine) {
        globe.target.tiltX = ((p.x / globe.w) - 0.7) * 0.28;
        globe.target.tiltY = ((p.y / globe.h) - 0.5) * 0.18;
        hero.toggleAttribute("data-cursor-drag", globe.hit(p.x, p.y) && !onText(e.target));
        const cur = $("[data-cursor]");
        if (cur) cur.classList.toggle("is-drag", hero.hasAttribute("data-cursor-drag"));
      }
    });
    const end = () => { dragging = false; root.classList.remove("is-dragging"); };
    hero.addEventListener("pointerup", end);
    hero.addEventListener("pointercancel", end);
    hero.addEventListener("pointerleave", () => {
      globe.target.tiltX = 0;
      globe.target.tiltY = 0;
      const cur = $("[data-cursor]");
      if (cur) cur.classList.remove("is-drag");
    });

    // render loop, only while visible
    let inView = true;
    let running = false;
    const loop = (dt) => {
      if (!inView || doc.hidden) { running = false; return false; }
      if (introStart >= 0 && intro < 1) intro = clamp((performance.now() - introStart) / 2200, 0, 1);
      const e = ease.outExpo(intro);
      st.alpha = e * (1 - 0.88 * scrollP);
      st.scale = (0.86 + 0.14 * e) * (1 - 0.16 * scrollP);
      st.settleYaw = -1.3 * (1 - e);
      st.extraYaw = st.settleYaw + scrollP * 1.5;
      st.spin = 1 + scrollP * 2;
      globe.update(N.reduce ? 0 : dt);
      globe.render();
      return true;
    };
    const run = () => { if (!running && inView && !doc.hidden) { running = true; N.tick(loop); } };
    new IntersectionObserver((entries) => { inView = entries[0].isIntersecting; run(); }).observe(hero);
    doc.addEventListener("visibilitychange", run);
    new ResizeObserver(() => { layout(); if (!running) { globe.update(0); globe.render(); } }).observe(hero);
    layout();
    if (doc.fonts && doc.fonts.ready) doc.fonts.ready.then(layout);
    if (N.reduce) {
      st.alpha = 1;
      st.scale = 1;
      for (let i = 0; i < 160; i++) globe.update(1 / 60);
      globe.update(0);
      globe.render();
      return;
    }
    run();
    ready.then(() => { if (hint) setTimeout(() => hint.classList.add("is-on"), 1800); });
  }

  /* ------------------------------------------------------------------------
     Fallback when WebGL is missing: the flat dot field with the two dots
     ------------------------------------------------------------------------ */
  function initSky2D() {
    const hero = $(".hero");
    const sky = $(".hero__sky");
    const canvas = $(".hero__field");
    const svg = $(".hero__pair");
    if (!hero || !sky || !canvas || !svg) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    root.classList.add("has-sky2d");

    const line = $(".pair__line", svg);
    const you = $(".pair__you", svg);
    const them = $(".pair__them", svg);
    const fades = $$(".pair__orbit", svg);
    const labelYou = $(".pair-label--you", sky);
    const labelThem = $(".pair-label--them", sky);
    const titleLines = $$(".hero__title .line", hero);
    const foot = $(".hero__foot", hero);
    const space = $(".hero__space", hero);
    const wide = window.matchMedia("(min-width: 900px)");

    let W = 0;
    let H = 0;
    let dpr = 1;
    let spacing = 26;
    let A = { x: 0, y: 0 };
    let B = { x: 0, y: 0 };
    let field = { x: 0, y: 0, r: 1 };
    let mergeEnd = 1;
    let progress = 0;
    const pointer = { x: -1e4, y: -1e4, tx: -1e4, ty: -1e4 };
    let inView = true;
    let raf = 0;
    let lastFrame = 0;
    const start = performance.now();

    function measure() {
      const hr = hero.getBoundingClientRect();
      W = Math.round(hr.width);
      H = Math.round(hr.height);
      dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      spacing = W < 700 ? 22 : 26;
      svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
      let placed = false;
      if (wide.matches && titleLines.length === 3 && foot) {
        const rightOf = (node) => (node.firstElementChild || node).getBoundingClientRect().right - hr.left;
        const left = Math.max(rightOf(titleLines[1]), rightOf(titleLines[2]), foot.getBoundingClientRect().right - hr.left) + Math.max(56, W * 0.05);
        const right = W - Math.max(48, W * 0.07);
        const top = titleLines[0].getBoundingClientRect().bottom - hr.top + 28;
        const bottom = H - Math.max(64, H * 0.12);
        if (right - left > 240 && bottom - top > 200) {
          A = { x: left + (right - left) * 0.14, y: top + (bottom - top) * 0.8 };
          B = { x: left + (right - left) * 0.9, y: top + (bottom - top) * 0.1 };
          placed = true;
        }
      }
      if (!placed) {
        const sr = space && space.offsetHeight ? space.getBoundingClientRect() : null;
        const top = sr ? sr.top - hr.top : H * 0.12;
        const h = sr ? sr.height : H * 0.3;
        A = { x: W * 0.24, y: top + h * 0.74 };
        B = { x: W * 0.8, y: top + h * 0.26 };
      }
      const mid = { x: (A.x + B.x) / 2, y: (A.y + B.y) / 2 };
      field = { x: mid.x, y: mid.y, r: Math.max(W, H) * (wide.matches ? 0.6 : 0.85) };
      const navH = parseFloat(getComputedStyle(root).getPropertyValue("--nav-h")) || 72;
      mergeEnd = clamp(Math.min(H * 0.32, mid.y - navH - 80), 60, 420);
      place();
    }

    function place() {
      const p = ease.inOutCubic(clamp(progress, 0, 1));
      const k = 1 + (wide.matches ? 1.5 : 1.2) * p;
      const mid = { x: (A.x + B.x) / 2, y: (A.y + B.y) / 2 };
      const r = 8 * k;
      const a = { x: lerp(A.x, mid.x - r, p), y: lerp(A.y, mid.y, p) };
      const b = { x: lerp(B.x, mid.x + r, p), y: lerp(B.y, mid.y, p) };
      you.setAttribute("transform", `translate(${a.x.toFixed(1)} ${a.y.toFixed(1)}) scale(${k.toFixed(3)})`);
      them.setAttribute("transform", `translate(${b.x.toFixed(1)} ${b.y.toFixed(1)}) scale(${k.toFixed(3)})`);
      line.setAttribute("x1", a.x.toFixed(1));
      line.setAttribute("y1", a.y.toFixed(1));
      line.setAttribute("x2", b.x.toFixed(1));
      line.setAttribute("y2", b.y.toFixed(1));
      fades.forEach((node) => { node.style.opacity = String(1 - p); });
      const labelAlpha = String(clamp(1 - p * 3, 0, 1));
      if (labelYou) {
        const w = labelYou.offsetWidth;
        labelYou.style.transform = `translate(${(a.x - w / 2).toFixed(1)}px, ${(a.y + 30).toFixed(1)}px)`;
        labelYou.style.opacity = labelAlpha;
      }
      if (labelThem) {
        const w = labelThem.offsetWidth;
        const x = clamp(b.x - w / 2, 16, W - w - 16);
        labelThem.style.transform = `translate(${x.toFixed(1)}px, ${(b.y - 44).toFixed(1)}px)`;
        labelThem.style.opacity = labelAlpha;
      }
    }

    function draw(now) {
      const still = N.reduce;
      const t = still ? 0 : (now - start) / 1000;
      const S = spacing;
      const tile = 3 * S;
      const drift = still ? 0 : ((t * tile) / 144) % tile;
      pointer.x += (pointer.tx - pointer.x) * 0.14;
      pointer.y += (pointer.ty - pointer.y) * 0.14;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      const tw = (2 * Math.PI) / 7;
      const sparkA = 0.2 + 0.55 * (0.5 - 0.5 * Math.cos(tw * t));
      const sparkB = 0.2 + 0.55 * (0.5 - 0.5 * Math.cos(tw * t + Math.PI));
      const buckets = new Map();
      const cols = Math.ceil(W / S) + 6;
      const rows = Math.ceil(H / S) + 6;
      const reach = 180;
      for (let j = 0; j < rows; j++) {
        const y = (j - 3) * S + S / 2 - drift;
        if (y < -4 || y > H + 4) continue;
        for (let i = 0; i < cols; i++) {
          const x = (i - 3) * S + S / 2 - drift;
          if (x < -4 || x > W + 4) continue;
          const dx = x - field.x;
          const dy = y - field.y;
          let m = 1 - Math.sqrt(dx * dx + dy * dy) / field.r;
          if (m < 0) m = 0;
          m = m * m * (3 - 2 * m);
          const edge = (H - y) / 160;
          if (edge < 1) m *= edge < 0 ? 0 : edge * edge;
          const ci = ((i % 3) + 3) % 3;
          const cj = ((j % 3) + 3) % 3;
          let alpha;
          let radius = 1.2;
          if (ci === 0 && cj === 0) { alpha = 0.6 * sparkA * m; radius = 1.35; }
          else if (ci === 2 && cj === 1) { alpha = 0.6 * sparkB * m; radius = 1.35; }
          else alpha = 0.24 * m;
          const px = x - pointer.x;
          const py = y - pointer.y;
          const d2 = px * px + py * py;
          if (d2 < reach * reach) {
            const g = 1 - Math.sqrt(d2) / reach;
            alpha += 0.5 * g * g * Math.max(m, 0.4);
            radius += 0.5 * g * g;
          }
          if (alpha < 0.02) continue;
          const key = Math.min(48, Math.round(alpha * 48)) * 10 + Math.round(radius * 4);
          let bucket = buckets.get(key);
          if (!bucket) { bucket = []; buckets.set(key, bucket); }
          bucket.push(x, y);
        }
      }
      buckets.forEach((pts, key) => {
        const a = Math.floor(key / 10) / 48;
        const r = (key % 10) / 4;
        ctx.fillStyle = `rgba(255,255,255,${a.toFixed(3)})`;
        ctx.beginPath();
        for (let n = 0; n < pts.length; n += 2) {
          ctx.moveTo(pts[n] + r, pts[n + 1]);
          ctx.arc(pts[n], pts[n + 1], r, 0, Math.PI * 2);
        }
        ctx.fill();
      });
    }

    function frame(now) {
      raf = 0;
      if (!inView || doc.hidden) return;
      if (now - lastFrame >= 30) { lastFrame = now; draw(now); }
      if (!N.reduce) raf = requestAnimationFrame(frame);
    }
    function run() { if (!raf && inView && !doc.hidden && !N.reduce) raf = requestAnimationFrame(frame); }
    function onScroll() {
      const y = window.scrollY;
      const next = y >= H ? 1 : y / mergeEnd;
      if (Math.abs(next - progress) > 0.001) { progress = next; place(); }
    }
    let scrollQueued = false;
    window.addEventListener("scroll", () => {
      if (scrollQueued) return;
      scrollQueued = true;
      requestAnimationFrame(() => { scrollQueued = false; onScroll(); });
    }, { passive: true });
    hero.addEventListener("pointermove", (event) => {
      if (!N.fine) return;
      const r = hero.getBoundingClientRect();
      pointer.tx = event.clientX - r.left;
      pointer.ty = event.clientY - r.top;
      if (pointer.x < -1e3) { pointer.x = pointer.tx; pointer.y = pointer.ty; }
    });
    hero.addEventListener("pointerleave", () => { pointer.tx = -1e4; pointer.ty = -1e4; });
    new IntersectionObserver((entries) => { inView = entries[0].isIntersecting; run(); }).observe(hero);
    doc.addEventListener("visibilitychange", run);
    let resizeQueued = 0;
    new ResizeObserver(() => {
      cancelAnimationFrame(resizeQueued);
      resizeQueued = requestAnimationFrame(() => { measure(); onScroll(); draw(performance.now()); });
    }).observe(hero);
    [labelYou, labelThem].forEach((node) => {
      if (node) node.addEventListener("animationend", () => { node.style.animation = "none"; }, { once: true });
    });
    measure();
    onScroll();
    draw(performance.now());
    ready.then(() => { sky.classList.add("sky-ready"); run(); });
    if (doc.fonts && doc.fonts.ready) doc.fonts.ready.then(() => { measure(); onScroll(); });
  }

  /* ------------------------------------------------------------------------
     Manifesto: words light up as the reader reaches them
     ------------------------------------------------------------------------ */
  function initManifest() {
    const text = $("[data-manifest]");
    if (!text) return;
    N.reveal($(".manifest__mark"));
    if (N.reduce) return;
    const { words } = N.split(text, "words");
    text.classList.add("is-split");
    const n = words.length;
    N.scene(text, {
      from: [0, 0.86],
      to: [1, 0.42],
      update: (p) => {
        const front = p * (n + 3) - 1.5;
        words.forEach((w, i) => {
          const a = clamp(front - i, 0, 1);
          const g = clamp(1 - Math.abs(front - i - 0.4) / 1.8, 0, 1);
          w.style.setProperty("--a", a.toFixed(3));
          w.style.setProperty("--g", g.toFixed(3));
        });
      },
    });
  }

  /* ------------------------------------------------------------------------
     How it works: the steps drive the phone (large screens);
     on small screens the phones sit in a row to swipe through.
     ------------------------------------------------------------------------ */
  function initHow() {
    const screens = $("[data-screens]");
    if (!screens) return;
    const wraps = $$(".screen-wrap", screens);
    const order = wraps.map((w) => w.dataset.screen);
    const triggers = $$("[data-trigger]");
    const steps = $$(".step");
    const dots = $$(".device-dots span");
    const large = window.matchMedia("(min-width: 960px)");
    let observer = null;
    let timer = 0;
    let active = null;

    function replay(w) {
      w.classList.remove("is-playing");
      if (N.reduce) return;
      void w.offsetWidth;
      w.classList.add("is-playing");
    }
    function show(name) {
      const idx = order.indexOf(name);
      wraps.forEach((w, i) => {
        const on = i === idx;
        const was = w.classList.contains("is-active");
        w.classList.toggle("is-active", on);
        w.classList.toggle("is-before", i < idx);
        if (on && !was) replay(w);
      });
    }
    function select(name) {
      if (name === active) return;
      active = name;
      triggers.forEach((t) => t.classList.toggle("is-active", t.dataset.trigger === name));
      steps.forEach((s) => s.classList.toggle("is-active", !!s.querySelector(`[data-trigger="${name}"]`)));
      clearTimeout(timer);
      if (name === "match") {
        if (N.reduce) { show("connected"); return; }
        show("search");
        timer = setTimeout(() => show("connected"), 1900);
      } else {
        show(name);
      }
    }
    function reset() {
      if (observer) observer.disconnect();
      observer = null;
      clearTimeout(timer);
      active = null;
      wraps.forEach((w) => w.classList.remove("is-playing", "is-live", "is-before"));
    }
    function setupLarge() {
      reset();
      select("home");
      observer = new IntersectionObserver((entries) => {
        entries.forEach((e) => { if (e.isIntersecting) select(e.target.dataset.trigger); });
      }, { rootMargin: "-49% 0px -50% 0px", threshold: 0 });
      triggers.forEach((t) => observer.observe(t));
    }
    function setupSmall() {
      reset();
      triggers.forEach((t) => t.classList.remove("is-active"));
      wraps.forEach((w) => w.classList.add("is-active"));
      const ratios = new Map();
      observer = new IntersectionObserver((entries) => {
        entries.forEach((e) => {
          ratios.set(e.target, e.intersectionRatio);
          const live = e.intersectionRatio >= 0.6;
          const was = e.target.classList.contains("is-live");
          e.target.classList.toggle("is-live", live);
          if (live && !was) replay(e.target);
        });
        let best = 0;
        let bestRatio = -1;
        wraps.forEach((w, i) => {
          const r = ratios.get(w) || 0;
          if (r > bestRatio) { bestRatio = r; best = i; }
        });
        dots.forEach((d, i) => d.classList.toggle("is-on", i === best));
      }, { root: screens, threshold: [0, 0.3, 0.6, 0.9] });
      wraps.forEach((w) => observer.observe(w));
    }
    const setup = () => (large.matches ? setupLarge() : setupSmall());
    large.addEventListener("change", setup);
    setup();
  }

  /* The phone in 3D: it turns towards you as the section arrives,
     follows the pointer a little, and light slides across the glass. */
  function initPhone3D() {
    const how = $(".how");
    const device = $(".device");
    if (!how || !device || N.reduce) return;
    const large = window.matchMedia("(min-width: 960px)");
    let enter = 0;
    const sx = N.spring(110, 16);
    const sy = N.spring(110, 16);
    let live = false;

    function apply() {
      if (!large.matches) {
        device.style.transform = "";
        return;
      }
      const e = ease.outCubic(enter);
      const ry = -28 * (1 - e) + sx.x;
      const rx = 16 * (1 - e) + sy.x;
      const rz = -6 * (1 - e);
      const ty = 90 * (1 - e);
      device.style.transform = `translate3d(0, ${ty.toFixed(1)}px, 0) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg) rotateZ(${rz.toFixed(2)}deg)`;
      device.style.setProperty("--glare-x", `${(50 - ry * 2.4).toFixed(1)}%`);
      device.style.setProperty("--glare-y", `${(30 + rx * 2.2).toFixed(1)}%`);
      device.style.setProperty("--glare-o", (0.08 + Math.min(0.22, Math.abs(ry) / 90 + Math.abs(rx) / 120)).toFixed(3));
    }
    const loop = (dt) => {
      sx.step(dt);
      sy.step(dt);
      apply();
      if (sx.resting && sy.resting) { live = false; return false; }
      return true;
    };
    const wake = () => { if (!live) { live = true; N.tick(loop); } };
    N.scene(how, { from: [0, 1], to: [0, 0.12], update: (p) => { enter = p; apply(); } });
    if (N.fine) {
      how.addEventListener("pointermove", (e) => {
        if (!large.matches) return;
        const r = device.getBoundingClientRect();
        sx.target = clamp((e.clientX - (r.left + r.width / 2)) / window.innerWidth, -0.5, 0.5) * 18;
        sy.target = -clamp((e.clientY - (r.top + r.height / 2)) / window.innerHeight, -0.5, 0.5) * 14;
        wake();
      });
      how.addEventListener("pointerleave", () => { sx.target = 0; sy.target = 0; wake(); });
    }
    large.addEventListener("change", apply);
  }

  /* ------------------------------------------------------------------------
     Topics
     ------------------------------------------------------------------------ */
  function initTopics() {
    const buttons = $$(".topic");
    const lineEl = $(".match-line");
    const text = $(".match-line__text");
    if (!buttons.length || !lineEl || !text) return;
    buttons.forEach((btn) => {
      btn.addEventListener("click", () => {
        buttons.forEach((b) => b.setAttribute("aria-pressed", String(b === btn)));
        const topic = btn.dataset.topic;
        text.replaceChildren();
        if (topic) text.append("Someone, somewhere in the world, chose ", el("strong", null, topic), " too.");
        else text.append("No topic. ", el("strong", null, "See where it goes."));
        lineEl.classList.remove("is-new");
        void lineEl.offsetWidth;
        lineEl.classList.add("is-new");
      });
    });
  }

  /* ------------------------------------------------------------------------
     Ribbon: runs on its own, faster and tilted while you scroll
     ------------------------------------------------------------------------ */
  function initRibbon() {
    const ribbon = $("[data-ribbon]");
    const track = $("[data-ribbon-track]");
    if (!ribbon || !track || N.reduce) return;
    let x = 0;
    let skew = 0;
    let dir = 1;
    let half = track.scrollWidth / 2;
    let inView = false;
    const loop = (dt) => {
      if (!inView) return false;
      const v = N.velocity;
      if (Math.abs(v) > 30) dir = v > 0 ? 1 : -1;
      const speed = 70 + Math.min(Math.abs(v) * 0.4, 1100);
      x -= speed * dt * dir;
      if (x <= -half) x += half;
      if (x > 0) x -= half;
      skew += (clamp(-v / 280, -9, 9) - skew) * (1 - Math.exp(-dt * 7));
      track.style.transform = `translate3d(${x.toFixed(1)}px, 0, 0) skewX(${skew.toFixed(2)}deg)`;
      N.velocity *= Math.pow(0.05, dt);
      return true;
    };
    new IntersectionObserver((entries) => {
      inView = entries[0].isIntersecting;
      if (inView) N.tick(loop);
    }).observe(ribbon);
    new ResizeObserver(() => { half = track.scrollWidth / 2; }).observe(track);
  }

  /* ------------------------------------------------------------------------
     Dust: a tiny particle layer for things that dissolve
     ------------------------------------------------------------------------ */
  function dustLayer(host, color) {
    const canvas = el("canvas", "dust");
    canvas.setAttribute("aria-hidden", "true");
    host.appendChild(canvas);
    const ctx = canvas.getContext("2d");
    let parts = [];
    let running = false;
    let dpr = 1;
    let w = 0;
    let h = 0;
    const size = () => {
      const r = host.getBoundingClientRect();
      dpr = Math.min(2, window.devicePixelRatio || 1);
      w = r.width;
      h = r.height;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    };
    size();
    if ("ResizeObserver" in window) new ResizeObserver(size).observe(host);
    const step = (dt) => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      parts = parts.filter((p) => (p.life += dt) < p.max);
      ctx.fillStyle = color;
      for (const p of parts) {
        p.vy -= 26 * dt;
        p.vx *= 0.985;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        ctx.globalAlpha = Math.max(0, 1 - p.life / p.max);
        ctx.fillRect(p.x, p.y, p.s, p.s);
      }
      ctx.globalAlpha = 1;
      if (!parts.length) { running = false; ctx.clearRect(0, 0, w, h); return false; }
      return true;
    };
    return {
      burst(rect) {
        if (N.reduce) return;
        const hr = host.getBoundingClientRect();
        const x0 = rect.left - hr.left;
        const y0 = rect.top - hr.top;
        const count = Math.round(clamp((rect.width * rect.height) / 9, 24, 320));
        for (let i = 0; i < count; i++) {
          parts.push({
            x: x0 + Math.random() * rect.width,
            y: y0 + Math.random() * rect.height,
            vx: 20 + Math.random() * 110,
            vy: -10 - Math.random() * 60,
            s: 0.8 + Math.random() * 1.6,
            life: 0,
            max: 0.5 + Math.random() * 0.8,
          });
        }
        if (!running) { running = true; N.tick(step); }
      },
    };
  }

  /* ------------------------------------------------------------------------
     Privacy filter — the same rules, in the same order, as the app
     (PrivacyFilter.kt) and the server (functions/src/privacyFilter.ts).
     ------------------------------------------------------------------------ */
  function createPrivacyFilter() {
    const ci = (phrase) => phrase.replace(/[a-z]/g, (l) => `[${l}${l.toUpperCase()}]`);
    const triggers = (list) => `(?:${list.map((p) => `\\b${ci(p)}`).join("|")})`;
    const NAME_TRIGGERS = ["my name is", "my name's", "i'm called", "i am called", "call me"];
    const PLACE_TRIGGERS = ["i live in", "i'm from", "i am from", "lives in", "live in", "living in", "based in", "moved to", "grew up in"];
    // Built from strings, so an older browser without these regex features
    // throws here (and the demo stays static) instead of breaking the page.
    const RULES = [
      { kind: "email", re: new RegExp("[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}", "dg"), group: 0 },
      { kind: "link", re: new RegExp("\\b(?:https?:\\/\\/|www\\.)\\S+", "dgi"), group: 0 },
      { kind: "link", re: new RegExp("\\b[a-z0-9-]+\\.(?:com|net|org|io|app|me|de|co|ly|gg|tv|info)\\b(?:\\/\\S*)?", "dgi"), group: 0 },
      { kind: "handle", re: new RegExp("(?<![\\w@])@[A-Za-z0-9_.]{2,30}", "dg"), group: 0 },
      { kind: "phone", re: new RegExp("(?<![\\w+])\\+?\\d[\\d ().\\/-]{6,}\\d", "dg"), group: 0 },
      { kind: "name", re: new RegExp(`${triggers(NAME_TRIGGERS)}\\s+(\\p{L}[\\p{L}'-]*)`, "dgu"), group: 1 },
      { kind: "place", re: new RegExp(`${triggers(PLACE_TRIGGERS)}\\s+(\\p{Lu}[\\p{L}'-]*(?:[ -]\\p{Lu}[\\p{L}'-]*)?)`, "dgu"), group: 1 },
    ];
    const NOT_NAMES = new Set([
      "a", "the", "not", "just", "so", "very", "really", "kind", "at", "on", "maybe", "later",
      "back", "anytime", "whenever", "crazy", "anonymous", "nobody", "whatever", "if", "when",
    ]);
    const MIN_PHONE_DIGITS = 7;
    const digits = (s) => (s.match(/[0-9]/g) || []).length;

    return function mask(text) {
      const hits = [];
      for (const rule of RULES) {
        rule.re.lastIndex = 0;
        for (const match of text.matchAll(rule.re)) {
          const range = match.indices && match.indices[rule.group];
          const value = match[rule.group];
          if (!range || value === undefined) continue;
          const [s, e] = range;
          if (rule.kind === "phone" && digits(match[0]) < MIN_PHONE_DIGITS) continue;
          if (rule.kind === "name" && NOT_NAMES.has(value.toLowerCase())) continue;
          if (hits.some((h) => h.start < e && s < h.end)) continue;
          hits.push({ start: s, end: e, kind: rule.kind });
        }
      }
      if (!hits.length) return [{ type: "text", text }];
      const parts = [];
      let cursor = 0;
      hits.sort((x, y) => x.start - y.start).forEach((h) => {
        if (h.start > cursor) parts.push({ type: "text", text: text.substring(cursor, h.start) });
        parts.push({ type: "hidden", kind: h.kind, length: h.end - h.start, raw: text.substring(h.start, h.end) });
        cursor = h.end;
      });
      if (cursor < text.length) parts.push({ type: "text", text: text.substring(cursor) });
      return parts;
    };
  }

  const KIND = {
    name: ["a name", "names", "name"],
    place: ["a place name", "place names", "place"],
    phone: ["a phone number", "phone numbers", "phone number"],
    email: ["an email address", "email addresses", "email address"],
    link: ["a link", "links", "link"],
    handle: ["a handle", "handles", "handle"],
  };
  const COUNT = ["", "", "two", "three", "four", "five", "six", "seven", "eight", "nine"];

  function describe(kinds) {
    const counts = new Map();
    kinds.forEach((k) => counts.set(k, (counts.get(k) || 0) + 1));
    const phrases = [];
    counts.forEach((n, k) => phrases.push(n === 1 ? KIND[k][0] : `${COUNT[n] || n} ${KIND[k][1]}`));
    if (phrases.length === 1) return phrases[0];
    return `${phrases.slice(0, -1).join(", ")} and ${phrases[phrases.length - 1]}`;
  }

  const SHIELD = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l7.5 3v5.5c0 4.5-3.2 8.2-7.5 9.5-4.3-1.3-7.5-5-7.5-9.5V6L12 3z"/></svg>';

  function hiddenBar(part) {
    const bar = el("span", "hid");
    bar.style.setProperty("--n", String(Math.max(2, part.length)));
    bar.append(el("span", "sr", `(${KIND[part.kind][2]} hidden)`));
    return bar;
  }

  // Animated: the personal parts show for a moment, then turn to dust and bars.
  function renderMessage(parts, animate, dust) {
    const msg = el("div", animate ? "msg is-new" : "msg");
    const bubble = el("p", "bubble glass");
    const kinds = [];
    const secrets = [];
    parts.forEach((part) => {
      if (part.type === "text") { bubble.append(part.text); return; }
      kinds.push(part.kind);
      if (animate && !N.reduce) {
        const s = el("span", "secret");
        s.setAttribute("aria-hidden", "true");
        s.textContent = part.raw;
        secrets.push({ node: s, part });
        bubble.append(s);
      } else {
        bubble.append(hiddenBar(part));
      }
    });
    const note = el("p", "msg__note");
    note.innerHTML = SHIELD;
    note.append(kinds.length ? `Nymo hid ${describe(kinds)}` : "Nothing needed hiding");
    msg.append(bubble, note);
    if (secrets.length) {
      note.classList.add("is-waiting");
      setTimeout(() => {
        secrets.forEach(({ node, part }, i) => {
          setTimeout(() => {
            if (dust) dust.burst(node.getBoundingClientRect());
            const bar = hiddenBar(part);
            bar.classList.add("is-new");
            node.replaceWith(bar);
          }, i * 140);
        });
        setTimeout(() => note.classList.remove("is-waiting"), secrets.length * 140 + 200);
      }, 520);
    }
    return msg;
  }

  function initFilterDemo() {
    const form = $("#demo-form");
    const input = $("#demo-input");
    const thread = $("#demo-thread");
    if (!form || !input || !thread) return;
    const send = $(".send", form);
    const examples = $$("[data-example]", form);
    const demo = $(".demo");
    const dust = demo ? dustLayer(demo, "#ffffff") : null;

    let mask;
    try {
      mask = createPrivacyFilter();
      mask("my name is Test");
    } catch (error) {
      form.hidden = true;
      return;
    }
    const SAMPLE = "hey, my name is Mia. i live in Vienna, text me +43 660 1234567 or @mia.writes";
    thread.replaceChildren(renderMessage(mask(SAMPLE), false));

    const sync = () => { send.disabled = input.value.trim().length === 0; };
    input.addEventListener("input", sync);
    function post(text) {
      thread.append(renderMessage(mask(text), true, dust));
      while (thread.children.length > 4) thread.firstElementChild.remove();
    }
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const text = input.value.trim();
      if (!text) return;
      post(text);
      input.value = "";
      sync();
    });
    let typing = 0;
    examples.forEach((btn) => {
      btn.addEventListener("click", () => {
        const text = btn.dataset.example || "";
        clearInterval(typing);
        if (N.reduce) { post(text); input.value = ""; sync(); return; }
        examples.forEach((b) => { b.disabled = true; });
        input.value = "";
        let i = 0;
        const step = Math.max(14, Math.min(34, 900 / text.length));
        typing = setInterval(() => {
          i += 1;
          input.value = text.slice(0, i);
          sync();
          if (i >= text.length) {
            clearInterval(typing);
            setTimeout(() => {
              post(text);
              input.value = "";
              sync();
              examples.forEach((b) => { b.disabled = false; });
            }, 320);
          }
        }, step);
      });
    });
    sync();
  }

  /* The heading tells the story too: the name and the town appear,
     scramble, and close into gray bars. */
  const GLYPHS = "#%&*@?/<>=+$§";
  const glyph = () => GLYPHS[Math.floor(Math.random() * GLYPHS.length)];

  function initScramble() {
    const title = $("[data-scramble]");
    if (!title || N.reduce) return;
    const bars = $$("[data-secret]", title);
    if (!bars.length) return;
    bars.forEach((b) => {
      const t = el("span", "bar__txt", b.dataset.secret);
      t.setAttribute("aria-hidden", "true");
      b.appendChild(t);
      b.classList.add("is-secret");
    });
    // while secret, each bar is as wide as its word
    const fit = () => bars.forEach((b) => {
      const t = $(".bar__txt", b);
      if (t && b.classList.contains("is-secret")) b.style.width = `${t.offsetWidth}px`;
    });
    fit();
    if (doc.fonts && doc.fonts.ready) doc.fonts.ready.then(fit);
    window.addEventListener("resize", fit);
    let done = false;
    const run = async () => {
      await N.wait(700);
      for (const b of bars) {
        await close(b);
        await N.wait(160);
      }
    };
    // The word scrambles on top of its bar, then the bar closes to its own width and turns gray.
    const close = (b) => new Promise((resolve) => {
      const txt = $(".bar__txt", b);
      const word = b.dataset.secret;
      const start = performance.now();
      let last = 0;
      N.tick((dt, now) => {
        const k = Math.min(1, (now - start) / 620);
        if (now - last > 45 || k >= 1) {
          last = now;
          txt.textContent = Array.from(word).map((ch, i) => (k * (word.length + 1) > i + 1 ? glyph() : Math.random() < 0.2 ? glyph() : ch)).join("");
        }
        if (k < 1) return true;
        b.classList.add("is-closing");
        b.classList.remove("is-secret");
        b.style.width = "";
        setTimeout(() => {
          txt.remove();
          b.classList.remove("is-closing");
          resolve();
        }, 760);
        return false;
      });
    });
    N.reveal(title, { margin: "0px 0px -30% 0px", onIn: () => { if (!done) { done = true; run(); } } });
  }

  /* ------------------------------------------------------------------------
     The life of one message (pinned while you scroll)
     ------------------------------------------------------------------------ */
  function initStory() {
    const story = $("[data-story]");
    if (!story) return;
    const steps = $$("[data-stop]", story);
    const rail = $("[data-story-rail]", story);
    const bubble = $("[data-story-bubble]", story);
    const secrets = $$(".story__secret", story);
    const note = $("[data-story-note]", story);
    const sys = $("[data-story-sys]", story);
    const label = $("[data-story-label]", story);
    const time = $("[data-story-time]", story);
    const canvas = $("[data-story-dust]", story);
    const stage = $(".story__stage", story);
    const pin = $(".story__pin", story);
    const railBox = rail.parentElement;

    // Layout offsets (not screen rects): the sheet around this may still be rising
    function nodeOffsets() {
      const track = railBox.parentElement;
      return steps.map((s) => {
        const n = $(".story__node", s);
        let y = n.offsetHeight / 2;
        for (let e = n; e && e !== track; e = e.offsetParent) y += e.offsetTop;
        return y;
      });
    }
    let offsets = [0, 0, 0, 0];
    const placeRail = () => {
      offsets = nodeOffsets();
      railBox.style.setProperty("--r0", `${offsets[0].toFixed(1)}px`);
      railBox.style.setProperty("--r1", `${offsets[3].toFixed(1)}px`);
      rail.style.top = `${offsets[0].toFixed(1)}px`;
    };

    if (N.reduce) {
      // Everything at once: filtered message, the full line, the rule
      story.classList.add("is-static");
      secrets.forEach((s) => {
        const fs = parseFloat(getComputedStyle(s).fontSize) || 18;
        s.style.width = `${(Math.max(1.6, s.textContent.length * 0.52) * fs).toFixed(1)}px`;
        s.textContent = "";
        s.classList.add("is-hidden");
      });
      steps.forEach((s) => s.classList.add("is-active"));
      label.textContent = "Deleted after the chat ends";
      time.textContent = "60:00";
      const full = () => { placeRail(); rail.style.height = `${(offsets[3] - offsets[0]).toFixed(1)}px`; };
      full();
      if ("ResizeObserver" in window) new ResizeObserver(full).observe(story);
      return;
    }
    story.classList.add("is-pinned");

    // This runs on every scroll frame: only touch the page when a value really changes.
    const memo = new WeakMap();
    const put = (node, key, value, apply) => {
      let m = memo.get(node);
      if (!m) { m = {}; memo.set(node, m); }
      if (m[key] === value) return;
      m[key] = value;
      apply(value);
    };
    const text = (node, v) => put(node, "#text", v, (x) => { node.textContent = x; });
    const css = (node, prop, v) => put(node, prop, v, (x) => node.style.setProperty(prop, x));
    const flag = (node, cls, on) => put(node, `.${cls}`, on, (x) => node.classList.toggle(cls, x));

    // secrets: measure text width, then interpolate to a bar
    const words = secrets.map((s) => ({ node: s, word: s.textContent, w: 0, bar: 0 }));
    const measureWords = () => {
      words.forEach((o) => {
        memo.delete(o.node);
        o.node.style.width = "";
        o.node.textContent = o.word;
        o.w = o.node.offsetWidth;
        const fs = parseFloat(getComputedStyle(o.node).fontSize) || 18;
        o.bar = Math.max(1.6, o.word.length * 0.52) * fs;
      });
    };

    // dust: particles from the bubble, scrubbed by the scroll position
    const ctx = canvas.getContext("2d");
    let dpr = 1;
    let cw = 0;
    let ch = 0;
    let parts = null;
    let box = null;
    const sizeCanvas = () => {
      dpr = Math.min(2, window.devicePixelRatio || 1);
      cw = stage.offsetWidth;
      ch = stage.offsetHeight;
      canvas.width = Math.round(cw * dpr);
      canvas.height = Math.round(ch * dpr);
      parts = null;
    };
    // sampled when the bubble starts to go, so it matches the filtered message
    const sample = () => {
      box = { x: bubble.offsetLeft, y: bubble.offsetTop, w: bubble.offsetWidth, h: bubble.offsetHeight };
      const gap = N.small() ? 4 : 3;
      const list = [];
      const rad = Math.min(22, box.h / 2);
      for (let y = 0; y < box.h; y += gap) {
        for (let x = 0; x < box.w; x += gap) {
          // inside the rounded rectangle
          const dx = Math.max(rad - x, 0, x - (box.w - rad));
          const dy = Math.max(rad - y, 0, y - (box.h - rad));
          if (dx * dx + dy * dy > rad * rad) continue;
          const r1 = Math.random();
          const r2 = Math.random();
          list.push({ x: box.x + x, y: box.y + y, delay: (x / box.w) * 0.55 + r1 * 0.12, r1, r2, light: Math.random() < 0.12 });
        }
      }
      parts = list;
    };

    let lastP = -1;
    const fmt = (sec) => {
      const m = Math.floor(sec / 60);
      const s = Math.floor(sec % 60);
      return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
    };

    let dusty = false;
    function render(p) {
      lastP = p;
      const stop = p < 0.22 ? 0 : p < 0.44 ? 1 : p < 0.86 ? 2 : 3;
      steps.forEach((s, i) => {
        flag(s, "is-active", i === stop);
        flag(s, "is-done", i < stop);
      });
      // the line travels from stop to stop
      const o = offsets;
      const fill = p < 0.22 ? lerp(o[0], o[1], p / 0.22)
        : p < 0.44 ? lerp(o[1], o[2], range(p, 0.22, 0.44))
          : p < 0.86 ? lerp(o[2], o[3], range(p, 0.44, 0.86))
            : o[3];
      css(rail, "height", `${Math.max(0, fill - o[0]).toFixed(1)}px`);

      // 1 → 2: the name and the town turn into bars
      words.forEach((w, i) => {
        const k = ease.inOutCubic(range(p, 0.24 + i * 0.07, 0.31 + i * 0.07));
        if (k <= 0) {
          text(w.node, w.word);
          css(w.node, "width", "");
          flag(w.node, "is-hidden", false);
          flag(w.node, "is-mid", false);
        } else if (k >= 1) {
          text(w.node, "");
          css(w.node, "width", `${w.bar.toFixed(1)}px`);
          flag(w.node, "is-hidden", true);
          flag(w.node, "is-mid", false);
        } else {
          const n = Math.floor(k * (w.word.length + 1));
          text(w.node, Array.from(w.word).map((c, j) => (j < n ? GLYPHS[(j * 7 + Math.floor(k * 23)) % GLYPHS.length] : c)).join(""));
          css(w.node, "width", `${lerp(w.w, w.bar, k).toFixed(1)}px`);
          flag(w.node, "is-mid", true);
          flag(w.node, "is-hidden", false);
        }
      });
      css(note, "opacity", (range(p, 0.38, 0.44) * (1 - range(p, 0.86, 0.93))).toFixed(3));

      // 3: the chat ends
      const ended = range(p, 0.46, 0.54);
      css(sys, "opacity", (ended * (1 - range(p, 0.86, 0.93))).toFixed(3));
      css(stage, "--dim", (ended * 0.32).toFixed(3));

      // countdown, then gone
      const c = range(p, 0.56, 0.86);
      const gone = range(p, 0.86, 0.97);
      if (p < 0.44) { text(label, p < 0.22 ? "Sent" : "Filtered"); text(time, "60:00"); }
      else if (p < 0.56) { text(label, "Chat closed. Deleted in"); text(time, "60:00"); }
      else if (gone <= 0) { text(label, "Deleted in"); text(time, fmt(3600 * (1 - c))); }
      else { text(label, "Deleted"); text(time, "00:00"); }
      css(stage, "--clock", p < 0.44 ? "0.35" : "1");
      flag(stage, "is-counting", p >= 0.56 && gone <= 0);
      flag(stage, "is-gone", gone >= 1);

      // dissolve
      css(bubble, "--m", Math.min(1, gone / 0.55).toFixed(4));
      const drawing = gone > 0 && gone < 1;
      if (!drawing && !dusty) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, cw, ch);
      dusty = drawing;
      if (drawing && !parts) sample();
      if (drawing && parts) {
        for (const q of parts) {
          const lt = clamp((gone - q.delay) / 0.33, 0, 1);
          if (lt <= 0 || lt >= 1) continue;
          const e = lt * lt;
          const x = q.x + e * (70 + q.r2 * 230);
          const y = q.y - e * (24 + q.r1 * 120) + Math.sin(q.r2 * 6.283 + lt * 3) * 10 * lt;
          ctx.globalAlpha = 1 - lt;
          ctx.fillStyle = q.light ? "#9a9a9a" : "#111111";
          ctx.fillRect(x, y, 2, 2);
        }
        ctx.globalAlpha = 1;
      }
    }

    // Pinned: the story plays while it stands still. Too short a screen to pin
    // (see the CSS): it plays while it scrolls past.
    const scene = N.scene(story, { from: [0, 0], to: [1, 1], update: render });
    let pinned = true;
    const relayout = () => {
      measureWords();
      sizeCanvas();
      placeRail();
      const nowPinned = getComputedStyle(pin).position === "sticky";
      if (nowPinned !== pinned) {
        pinned = nowPinned;
        scene.from = pinned ? [0, 0] : [0, 0.85];
        scene.to = pinned ? [1, 1] : [1, 0.35];
        N.refresh();
      }
      render(Math.max(0, lastP));
    };
    relayout();
    if ("ResizeObserver" in window) new ResizeObserver(() => relayout()).observe(stage);
    if (doc.fonts && doc.fonts.ready) doc.fonts.ready.then(relayout);
  }

  /* The white sheet rises like the app's bottom sheet */
  function initSheet() {
    const sheet = $("[data-sheet]");
    if (!sheet || N.reduce) return;
    N.scene(sheet, {
      from: [0, 1],
      to: [0, 0.3],
      update: (p) => {
        const r = 1 - ease.outCubic(p);
        sheet.style.transform = r > 0.0005 ? `translate3d(0, ${(r * 12).toFixed(3)}vh, 0) scale(${(1 - r * 0.045).toFixed(4)})` : "";
      },
    });
  }

  /* ------------------------------------------------------------------------
     FAQ: answers open and close smoothly
     ------------------------------------------------------------------------ */
  function initFaq() {
    if (N.reduce) return;
    $$(".qa").forEach((d) => {
      const summary = $("summary", d);
      const body = $(".qa__a", d);
      if (!summary || !body || !body.animate) return;
      let anim = null;
      summary.addEventListener("click", (e) => {
        e.preventDefault();
        if (anim) anim.cancel();
        if (d.open && !d.classList.contains("is-closing")) {
          const h = body.offsetHeight;
          const pb = getComputedStyle(body).paddingBottom;
          d.classList.add("is-closing");
          anim = body.animate([{ height: `${h}px`, paddingBottom: pb, opacity: 1 }, { height: "0px", paddingBottom: "0px", opacity: 0 }], { duration: 380, easing: "cubic-bezier(.4,0,.2,1)" });
          anim.onfinish = () => { d.open = false; d.classList.remove("is-closing"); anim = null; N.refresh(); };
        } else {
          d.classList.remove("is-closing");
          d.open = true;
          const h = body.offsetHeight;
          const pb = getComputedStyle(body).paddingBottom;
          anim = body.animate([{ height: "0px", paddingBottom: "0px", opacity: 0 }, { height: `${h}px`, paddingBottom: pb, opacity: 1 }], { duration: 520, easing: "cubic-bezier(.2,.8,.2,1)" });
          anim.onfinish = () => { anim = null; N.refresh(); };
        }
      });
    });
  }

  /* ------------------------------------------------------------------------
     The mark in 3D: sphere and ring glide together as you arrive
     ------------------------------------------------------------------------ */
  function initMark() {
    const canvas = $("[data-mark]");
    const stage = $("[data-mark-stage]");
    const closing = $(".closing");
    if (!canvas || !stage || !closing) return;
    let mark = null;
    if (N.webglAvailable && N.webglAvailable()) {
      try {
        mark = new N.Mark(canvas, { quality: lowPower() ? "low" : "high", onLost: () => stage.classList.remove("has-gl") });
      } catch (err) {
        console.warn("[Nymo] 3D mark unavailable:", err);
        mark = null;
      }
    }
    if (!mark) { canvas.remove(); return; }
    stage.classList.add("has-gl");

    if (N.reduce) {
      mark.state.assemble = 1;
      mark.update(0.5);
      mark.render();
      new ResizeObserver(() => { mark.resize(); mark.render(); }).observe(stage);
      return;
    }
    N.scene(closing, { from: [0, 1], to: [0, 0.28], update: (p) => { mark.state.assemble = p; } });
    closing.addEventListener("pointermove", (e) => {
      const r = stage.getBoundingClientRect();
      mark.state.pointerX = clamp((e.clientX - (r.left + r.width / 2)) / (r.width * 0.8), -1, 1);
      mark.state.pointerY = clamp((e.clientY - (r.top + r.height / 2)) / (r.height * 1.2), -1, 1);
    });
    closing.addEventListener("pointerleave", () => { mark.state.pointerX = 0; mark.state.pointerY = 0; });
    let inView = false;
    let running = false;
    const loop = (dt) => {
      if (!inView || doc.hidden) { running = false; return false; }
      mark.update(dt);
      mark.render();
      mark.adapt(dt);
      return true;
    };
    const run = () => { if (!running && inView && !doc.hidden) { running = true; N.tick(loop); } };
    new IntersectionObserver((entries) => { inView = entries[0].isIntersecting; run(); }, { rootMargin: "100px 0px" }).observe(stage);
    doc.addEventListener("visibilitychange", run);
    new ResizeObserver(() => { mark.resize(); if (!running) mark.render(); }).observe(stage);
  }

  /* ------------------------------------------------------------------------
     Footer: the word rises out of the floor
     ------------------------------------------------------------------------ */
  function initFooterWord() {
    const word = $("[data-footword]");
    const footer = $(".footer");
    if (!word || !footer || N.reduce) return;
    N.scene(footer, {
      from: [0, 1],
      to: [1, 1],
      update: (p) => word.style.setProperty("--rise", (1 - ease.outCubic(p)).toFixed(4)),
    });
    // light passes over it once it is up
    N.reveal(word, { margin: "0px 0px -2% 0px" });
  }

  /* Section headings rise word by word */
  function initReveals() {
    const heads = $$("[data-reveal]");
    if (!N.reduce) heads.forEach((h) => N.split(h, "words"));
    N.reveal(heads, { margin: "0px 0px -10% 0px" });
    N.reveal($$(".rule, .protect__item, .support, .qa, .ledger tbody tr, .plan, .campus"), { margin: "0px 0px -8% 0px" });
  }

  /* ------------------------------------------------------------------------ */
  const run = (name, fn) => N.safe(name, fn);
  run("Intro", initIntro);
  run("Nav", initNav);
  run("Menu", initMenu);
  run("Hero title", initHeroTitle);
  run("Hero", initHero);
  run("Manifest", initManifest);
  run("How", initHow);
  run("Phone", initPhone3D);
  run("Topics", initTopics);
  run("Ribbon", initRibbon);
  run("Filter demo", initFilterDemo);
  run("Scramble", initScramble);
  run("Sheet", initSheet);
  run("Story", initStory);
  run("FAQ", initFaq);
  run("Mark", initMark);
  run("Footer", initFooterWord);
  run("Reveals", initReveals);
  run("Cursor", N.cursor);
  run("Magnetic", N.magnetic);
  if (doc.fonts && doc.fonts.ready) doc.fonts.ready.then(() => N.refresh());
  N.refresh();
})();
