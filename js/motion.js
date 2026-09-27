(function () {
  const root = document.documentElement;
  const { t, onChange } = Internals.i18n;
  const fine = matchMedia("(pointer: fine)").matches;
  const calm = () => root.classList.contains("calm");
  root.classList.add("mjs");

  const toggle = document.querySelector(".motion-toggle");
  function syncToggle() { if (toggle) toggle.setAttribute("aria-pressed", String(!calm())); }
  if (toggle) toggle.addEventListener("click", () => {
    const off = !calm();
    root.classList.toggle("calm", off);
    try { localStorage.setItem("internals-motion", off ? "off" : "on"); } catch (e) { }
    syncToggle();
    if (off) { glow.classList.remove("on"); resetPointerFx(); }
  });
  syncToggle();

  function splitText(el) {
    const text = el.textContent;
    if (!text.trim()) return;
    el.textContent = "";
    const sr = document.createElement("span"); sr.className = "sr-only"; sr.textContent = text;
    const vis = document.createElement("span"); vis.setAttribute("aria-hidden", "true");
    let i = 0;
    text.split(/(\s+)/).forEach(part => {
      if (!part) return;
      if (/^\s+$/.test(part)) { vis.appendChild(document.createTextNode(" ")); return; }
      const w = document.createElement("span"); w.className = "split-w";
      for (const ch of part) {
        const c = document.createElement("span"); c.className = "split-c"; c.textContent = ch;
        c.style.setProperty("--i", i++); w.appendChild(c);
      }
      vis.appendChild(w);
    });
    el.append(sr, vis);
  }
  const splits = [];
  document.querySelectorAll("section h1").forEach(h => {
    const node = [...h.childNodes].find(n => n.nodeType === 3 && n.textContent.trim());
    let target = h.querySelector(":scope > span:not(.sub)");
    if (node) { target = document.createElement("span"); h.insertBefore(target, node); target.appendChild(node); }
    if (target) splits.push({ head: h, target });
  });
  document.querySelectorAll(".chapter-head h2").forEach(h => splits.push({ head: h, target: h }));
  splits.forEach(s => { s.head.classList.add("splitting"); splitText(s.target); });
  onChange(() => splits.forEach(s => {
    if (s.target.querySelector(".split-w")) return;
    splitText(s.target);
    if (!calm() && s.head.classList.contains("in")) replay(s.head, "in");
  }));

  const RV = [".hero-text > :not(h1)", ".hero-grid > div:last-child", ".chapter-head > :not(h2)",
    ".chapter .wrap > :not(.chapter-head):not(.quiz)", ".quiz > .q", ".foot .wrap > :not(.next-grid)", ".next-grid > *"];
  const revealEls = document.querySelectorAll(RV.join(","));
  revealEls.forEach(e => e.classList.add("rv"));
  const io = new IntersectionObserver(entries => {
    entries.filter(e => e.isIntersecting && !e.target.classList.contains("in"))
      .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top || a.boundingClientRect.left - b.boundingClientRect.left)
      .forEach((e, i) => {
        const d = Math.min(i, 8) * 0.075;
        e.target.style.setProperty("--d", d + "s");
        e.target.classList.add("in");
        if (e.target.classList.contains("specs")) e.target.querySelectorAll("dd").forEach((dd, j) => setTimeout(() => decode(dd), (d + j * 0.08) * 1000));
      });
  }, { rootMargin: "0px 0px -6% 0px" });
  revealEls.forEach(e => io.observe(e));
  splits.forEach(s => io.observe(s.head));

  function replay(el, cls) { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); }

  function decode(el) {
    if (calm()) return;
    cancelAnimationFrame(el._decode);
    const key = el.dataset.i18n, fixed = el.textContent, t0 = performance.now(), dur = 750;
    const final = () => (key ? t(key) : fixed);
    (function frame(now) {
      const f = (now - t0) / dur, target = final();
      if (f >= 1 || calm()) { el.textContent = target; return; }
      const n = Math.floor(target.length * Math.max(0, f));
      el.textContent = target.slice(0, n) + target.slice(n).replace(/\d/g, () => (Math.random() * 10) | 0);
      el._decode = requestAnimationFrame(frame);
    })(t0);
  }

  const sweep = document.createElement("div"); sweep.className = "sweep"; sweep.setAttribute("aria-hidden", "true");
  document.body.appendChild(sweep);
  document.addEventListener("internals:show", e => {
    document.querySelectorAll("section[data-part]").forEach(s => {
      if (s.dataset.part === e.detail) return;
      s.querySelectorAll(".in").forEach(el => el.classList.remove("in"));
    });
    movePill();
    if (!calm()) replay(sweep, "go");
  });

  const nav = document.querySelector(".partnav");
  const pill = document.createElement("i"); pill.className = "nav-pill"; pill.setAttribute("aria-hidden", "true");
  nav.prepend(pill); nav.classList.add("has-pill");
  function pillTo(a) {
    const x = a.offsetLeft + "px";
    if (pill.dataset.x && pill.dataset.x !== x && !calm()) replay(pill, "squish");
    pill.dataset.x = x;
    pill.style.width = a.offsetWidth + "px";
    pill.style.transform = `translateX(${x})`;
  }
  function movePill() {
    const a = nav.querySelector('[aria-current="page"]');
    if (!a) { pill.style.width = "0"; return; }
    pill.classList.remove("peek");
    pillTo(a);
    const left = a.offsetLeft - (nav.clientWidth - a.offsetWidth) / 2;
    nav.scrollTo({ left, behavior: calm() ? "auto" : "smooth" });
  }
  if (fine) {
    nav.addEventListener("pointerover", e => {
      const a = e.target instanceof Element && e.target.closest("a[data-nav]");
      if (!a || calm()) return;
      pill.classList.toggle("peek", a.getAttribute("aria-current") !== "page");
      pillTo(a);
    });
    nav.addEventListener("pointerleave", movePill);
  }
  movePill();
  onChange(movePill);
  addEventListener("resize", movePill);
  if (document.fonts) document.fonts.ready.then(movePill);

  const bar = document.querySelector(".progress"), aurora = document.querySelector(".aurora");
  let scrollQueued = false;
  function onScroll() {
    scrollQueued = false;
    const max = document.documentElement.scrollHeight - innerHeight;
    const p = max > 0 ? Math.min(1, scrollY / max) : 0;
    if (bar) bar.style.setProperty("--p", p.toFixed(4));
    if (aurora) aurora.style.setProperty("--par", calm() ? "0px" : (-p * 22).toFixed(2) + "vh");
  }
  addEventListener("scroll", () => { if (!scrollQueued) { scrollQueued = true; requestAnimationFrame(onScroll); } }, { passive: true });
  onScroll();

  const glow = document.querySelector(".cursor-glow");
  const SPOT = ".stage, .labtest, .q, .partcard, .next-part, .part-card, .specs div";
  const TILT = ".q, .part-card, .next-part, .specs div";
  const MAGNET = ".btn.primary, .next-part i";
  document.querySelectorAll(SPOT).forEach(e => e.classList.add("spot"));
  document.querySelectorAll(".stage, .labtest, .q, .partcard, .next-part").forEach(e => e.classList.add("sheen"));
  const LIQUID = ".btn:not(.primary), .langswitch, .motion-toggle, .nav-pill, .lt-score, .lt-item";
  const liquify = () => document.querySelectorAll(LIQUID).forEach(e => e.classList.add("liquid"));
  liquify();
  const lq = new MutationObserver(liquify);
  document.querySelectorAll(".labtest").forEach(b => lq.observe(b, { childList: true, subtree: true }));

  const chromium = !!(navigator.userAgentData && navigator.userAgentData.brands.some(b => /Chromium/.test(b.brand)));
  const lensMap = document.getElementById("lensMap");
  if (chromium && lensMap) {
    const N = 96, cv = document.createElement("canvas"); cv.width = cv.height = N;
    const g = cv.getContext("2d"), img = g.createImageData(N, N);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const nx = (x + .5) / N * 2 - 1, ny = (y + .5) / N * 2 - 1;
      const d = Math.pow(Math.pow(Math.abs(nx), 4) + Math.pow(Math.abs(ny), 4), 1 / 4);
      const k = Math.min(1, Math.max(0, (d - .5) / .5)), s2 = k * k * (3 - 2 * k);
      const i = (y * N + x) * 4;
      img.data[i] = 128 - nx * s2 * 127; img.data[i + 1] = 128 - ny * s2 * 127; img.data[i + 2] = 128; img.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    lensMap.setAttribute("href", cv.toDataURL());
    root.classList.add("lens");
  }

  const ring = document.createElement("div"); ring.className = "cursor-ring"; ring.setAttribute("aria-hidden", "true");
  if (fine) document.body.appendChild(ring);
  const HOT = "a, button, input, select, .tag, canvas, [role=button]";
  const cur = { x: -100, y: -100, tx: -100, ty: -100, s: 1, ts: 1 };
  let ringRaf = 0;
  function stepRing() {
    cur.x += (cur.tx - cur.x) * .22; cur.y += (cur.ty - cur.y) * .22; cur.s += (cur.ts - cur.s) * .2;
    ring.style.transform = `translate3d(${cur.x.toFixed(1)}px, ${cur.y.toFixed(1)}px, 0) scale(${cur.s.toFixed(3)})`;
    ringRaf = Math.abs(cur.tx - cur.x) + Math.abs(cur.ty - cur.y) + Math.abs(cur.ts - cur.s) > .05 ? requestAnimationFrame(stepRing) : 0;
  }
  function aimRing(x, y, s) {
    cur.tx = x; cur.ty = y; if (s != null) cur.ts = s;
    if (cur.x < -50) { cur.x = x; cur.y = y; }
    if (!ringRaf) ringRaf = requestAnimationFrame(stepRing);
  }
  if (fine) {
    document.addEventListener("pointermove", e => {
      if (calm() || e.pointerType !== "mouse") return;
      const hot = e.target instanceof Element && e.target.closest(HOT);
      ring.classList.add("on"); ring.classList.toggle("hot", !!hot);
      aimRing(e.clientX, e.clientY, hot ? 1.6 : 1);
    }, { passive: true });
    document.addEventListener("pointerdown", () => { if (!calm()) { cur.ts *= .7; aimRing(cur.tx, cur.ty); } }, { passive: true });
    document.addEventListener("pointerup", e => { if (!calm()) aimRing(e.clientX, e.clientY, ring.classList.contains("hot") ? 1.6 : 1); }, { passive: true });
    document.addEventListener("pointerleave", () => ring.classList.remove("on"));
  }

  const springs = new Map();
  let springRaf = 0;
  function aim(el, kind, x, y) {
    let s = springs.get(el);
    if (!s) { s = { kind, x: 0, y: 0, tx: 0, ty: 0 }; springs.set(el, s); }
    s.tx = x; s.ty = y;
    if (!springRaf) springRaf = requestAnimationFrame(stepSprings);
  }
  function stepSprings() {
    springRaf = 0;
    springs.forEach((s, el) => {
      s.x += (s.tx - s.x) * 0.16; s.y += (s.ty - s.y) * 0.16;
      const done = Math.abs(s.tx - s.x) < 0.01 && Math.abs(s.ty - s.y) < 0.01 && s.tx === 0 && s.ty === 0;
      if (done) { el.style.transform = ""; springs.delete(el); return; }
      el.style.transform = s.kind === "tilt"
        ? `perspective(900px) rotateX(${s.y.toFixed(2)}deg) rotateY(${s.x.toFixed(2)}deg)`
        : `translate(${s.x.toFixed(2)}px, ${s.y.toFixed(2)}px)`;
    });
    if (springs.size) springRaf = requestAnimationFrame(stepSprings);
  }
  function resetPointerFx() { springs.forEach(s => { s.tx = 0; s.ty = 0; }); if (springs.size && !springRaf) springRaf = requestAnimationFrame(stepSprings); }

  let hoverTilt = null, hoverMag = null, glowQueued = false, gx = 0, gy = 0;
  if (fine) {
    document.addEventListener("pointermove", e => {
      if (calm()) return;
      gx = e.clientX; gy = e.clientY;
      if (!glowQueued) {
        glowQueued = true;
        requestAnimationFrame(() => { glowQueued = false; glow.style.transform = `translate3d(${gx}px, ${gy}px, 0)`; glow.classList.add("on"); });
      }
      const el = e.target instanceof Element ? e.target : null;
      const spot = el && el.closest(".spot");
      if (spot) {
        const r = spot.getBoundingClientRect();
        spot.style.setProperty("--mx", (e.clientX - r.left) + "px");
        spot.style.setProperty("--my", (e.clientY - r.top) + "px");
      }
      const tl = el && el.closest(TILT);
      if (hoverTilt && hoverTilt !== tl) aim(hoverTilt, "tilt", 0, 0);
      hoverTilt = tl;
      if (tl) {
        const r = tl.getBoundingClientRect();
        const nx = (e.clientX - r.left) / r.width - 0.5, ny = (e.clientY - r.top) / r.height - 0.5;
        const k = Math.max(2, 7 - r.width / 120);
        aim(tl, "tilt", nx * k, -ny * k);
      }
      const mg = el && el.closest(MAGNET);
      if (hoverMag && hoverMag !== mg) aim(hoverMag, "mag", 0, 0);
      hoverMag = mg;
      if (mg && !mg.disabled) {
        const r = mg.getBoundingClientRect();
        aim(mg, "mag", (e.clientX - r.left - r.width / 2) * 0.28, (e.clientY - r.top - r.height / 2) * 0.35);
      }
    }, { passive: true });
    document.addEventListener("pointerleave", () => { glow.classList.remove("on"); resetPointerFx(); hoverTilt = hoverMag = null; });
  }

  const RIPPLE = ".btn, .chip, .lt-item, .q .opts button, .die-legend button, .langswitch button";
  document.addEventListener("pointerdown", e => {
    if (calm() || !(e.target instanceof Element)) return;
    const b = e.target.closest(RIPPLE);
    if (!b || b.disabled) return;
    const r = b.getBoundingClientRect();
    const dot = document.createElement("span"); dot.className = "ripple"; dot.setAttribute("aria-hidden", "true");
    dot.style.left = (e.clientX - r.left) + "px"; dot.style.top = (e.clientY - r.top) + "px";
    dot.style.setProperty("--r", (Math.hypot(r.width, r.height) / 5).toFixed(1));
    b.appendChild(dot);
    dot.addEventListener("animationend", () => dot.remove());
    setTimeout(() => dot.remove(), 900);
  }, { passive: true });

  document.querySelectorAll(".partcard h3").forEach(h => {
    const card = h.parentElement;
    new MutationObserver(() => { if (!calm()) replay(card, "swap"); }).observe(h, { childList: true, characterData: true, subtree: true });
  });
})();
