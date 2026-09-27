(function () {
  const root = document.documentElement;
  const calm = () => root.classList.contains("calm");
  const fine = matchMedia("(pointer: fine)").matches;
  const CELL = 26, EXTRA = 380;
  const DIRS = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
  const MINT = "218, 241, 222", SAGE = "142, 182, 155";

  const cv = document.createElement("canvas");
  cv.className = "circuit"; cv.setAttribute("aria-hidden", "true");
  document.body.prepend(cv);
  const ctx = cv.getContext("2d");

  let W = 0, H = 0, GH = 0, DPR = 1, base, glow, lit, litCtx, traces = [], chips = [], sprite;
  let seed = 11;
  const rnd = () => (seed = seed * 16807 % 2147483647) / 2147483647;
  if (!CanvasRenderingContext2D.prototype.roundRect) CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h) { this.rect(x, y, w, h); };
  const mk = (w, h) => { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; };

  function layout() {
    seed = 11;
    const cols = Math.ceil(W / CELL) + 1, rows = Math.ceil(GH / CELL) + 1;
    const occ = new Uint8Array(cols * rows);
    const free = (i, j) => i >= 0 && j >= 0 && i < cols && j < rows && !occ[j * cols + i];
    const take = (i, j) => { occ[j * cols + i] = 1; };
    chips = []; traces = [];

    const want = Math.max(3, Math.min(12, Math.round(W * GH / 170000)));
    for (let n = 0, tries = 0; n < want && tries < 400; tries++) {
      const w = 3 + Math.floor(rnd() * 4), h = 3 + Math.floor(rnd() * 3);
      const i0 = 2 + Math.floor(rnd() * (cols - w - 4)), j0 = 2 + Math.floor(rnd() * (rows - h - 4));
      let ok = true;
      for (let j = j0 - 3; j <= j0 + h + 3 && ok; j++) for (let i = i0 - 3; i <= i0 + w + 3; i++) if (!free(i, j) && i >= 0 && j >= 0 && i < cols && j < rows) { ok = false; break; }
      if (!ok) continue;
      for (let j = j0; j <= j0 + h; j++) for (let i = i0; i <= i0 + w; i++) take(i, j);
      chips.push({ i0, j0, w, h }); n++;
    }

    function walk(i, j, d, maxLen) {
      const cells = [[i, j]]; take(i, j);
      const d0 = d;
      for (let s = 0; s < maxLen; s++) {
        if (rnd() < 0.2) {
          const turn = d === d0 ? (rnd() < 0.5 ? 1 : 7) : (d0 - d + 8) % 8 === 1 ? 1 : 7;
          d = (d + turn) % 8;
        }
        const [dx, dy] = DIRS[d], ni = i + dx, nj = j + dy;
        if (!free(ni, nj)) break;
        if (dx && dy && !free(i + dx, j) && !free(i, j + dy)) break;
        i = ni; j = nj; take(i, j); cells.push([i, j]);
      }
      if (cells.length < 4) return;
      const pts = [cells[0]];
      for (let k = 1; k < cells.length - 1; k++) {
        const a = cells[k - 1], b = cells[k], c = cells[k + 1];
        if (b[0] - a[0] !== c[0] - b[0] || b[1] - a[1] !== c[1] - b[1]) pts.push(b);
      }
      pts.push(cells[cells.length - 1]);
      const P = pts.map(([x, y]) => [x * CELL, y * CELL]), cum = [0];
      for (let k = 1; k < P.length; k++) cum.push(cum[k - 1] + Math.hypot(P[k][0] - P[k - 1][0], P[k][1] - P[k - 1][1]));
      traces.push({ P, cum, len: cum[cum.length - 1], lit: 0 });
    }
    chips.forEach(c => {
      for (let i = c.i0 + 1; i < c.i0 + c.w; i++) {
        if (rnd() < 0.75) walk(i, c.j0 - 1, 6, 6 + rnd() * 26);
        if (rnd() < 0.75) walk(i, c.j0 + c.h + 1, 2, 6 + rnd() * 26);
      }
      for (let j = c.j0 + 1; j < c.j0 + c.h; j++) {
        if (rnd() < 0.75) walk(c.i0 - 1, j, 4, 6 + rnd() * 26);
        if (rnd() < 0.75) walk(c.i0 + c.w + 1, j, 0, 6 + rnd() * 26);
      }
    });
    const loose = Math.round(cols * rows / 20);
    for (let n = 0; n < loose; n++) {
      const i = Math.floor(rnd() * cols), j = Math.floor(rnd() * rows);
      if (free(i, j)) walk(i, j, Math.floor(rnd() * 8), 4 + rnd() * 18);
    }
  }

  function paint(c, bright) {
    const g = c.getContext("2d");
    g.setTransform(DPR, 0, 0, DPR, 0, 0);
    g.clearRect(0, 0, W, GH);
    g.lineCap = "round"; g.lineJoin = "round";
    chips.forEach(ch => {
      const x = ch.i0 * CELL + 4, y = ch.j0 * CELL + 4, w = ch.w * CELL - 8, h = ch.h * CELL - 8;
      g.fillStyle = bright ? `rgba(${MINT}, .06)` : "rgba(5, 31, 32, .55)";
      g.strokeStyle = bright ? `rgba(${MINT}, .75)` : `rgba(${SAGE}, .2)`;
      g.lineWidth = 1.2;
      g.beginPath(); g.roundRect(x, y, w, h, 5); g.fill(); g.stroke();
      g.strokeStyle = bright ? `rgba(${MINT}, .35)` : `rgba(${SAGE}, .09)`;
      g.beginPath(); g.roundRect(x + w * .28, y + h * .28, w * .44, h * .44, 3); g.stroke();
      g.fillStyle = bright ? `rgba(${MINT}, .7)` : `rgba(${SAGE}, .22)`;
      for (let i = ch.i0 + 1; i < ch.i0 + ch.w; i++) { g.fillRect(i * CELL - 2, y - 5, 4, 5); g.fillRect(i * CELL - 2, y + h, 4, 5); }
      for (let j = ch.j0 + 1; j < ch.j0 + ch.h; j++) { g.fillRect(x - 5, j * CELL - 2, 5, 4); g.fillRect(x + w, j * CELL - 2, 5, 4); }
      g.beginPath(); g.arc(x + 8, y + 8, 2, 0, 7); g.fill();
    });
    g.strokeStyle = bright ? `rgba(${MINT}, .8)` : `rgba(${SAGE}, .15)`;
    g.lineWidth = bright ? 1.8 : 1.5;
    g.beginPath();
    traces.forEach(t => { g.moveTo(t.P[0][0], t.P[0][1]); for (let k = 1; k < t.P.length; k++) g.lineTo(t.P[k][0], t.P[k][1]); });
    g.stroke();
    g.fillStyle = "#051f20";
    traces.forEach(t => {
      const [x, y] = t.P[t.P.length - 1];
      g.beginPath(); g.arc(x, y, 3.4, 0, 7); g.fill(); g.stroke();
    });
  }

  function glowSprite() {
    const s = mk(48, 48), g = s.getContext("2d"), r = g.createRadialGradient(24, 24, 0, 24, 24, 24);
    r.addColorStop(0, `rgba(${MINT}, 1)`); r.addColorStop(.18, `rgba(${MINT}, .75)`);
    r.addColorStop(.45, `rgba(${SAGE}, .22)`); r.addColorStop(1, `rgba(${SAGE}, 0)`);
    g.fillStyle = r; g.fillRect(0, 0, 48, 48);
    return s;
  }

  function build() {
    W = innerWidth; H = innerHeight; GH = H + EXTRA;
    DPR = Math.min(devicePixelRatio || 1, fine ? 1.5 : 1.25);
    cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
    layout();
    base = mk(Math.round(W * DPR), Math.round(GH * DPR)); paint(base, false);
    glow = mk(base.width, base.height); paint(glow, true);
    lit = mk(cv.width, cv.height); litCtx = lit.getContext("2d");
    sprite = sprite || glowSprite();
    pulses.length = 0; flashes.length = 0;
    draw(performance.now(), 0);
  }

  const pulses = [], flashes = [], lights = [];
  const cursor = { x: -999, y: -999, on: false, a: 0 };
  let off = 0, offTarget = 0, boost = 0, lastY = scrollY, spawnAcc = 0;

  function posAt(t, d) {
    d = Math.max(0, Math.min(t.len, d));
    let k = 1;
    while (k < t.cum.length - 1 && t.cum[k] < d) k++;
    const a = t.P[k - 1], b = t.P[k], seg = t.cum[k] - t.cum[k - 1] || 1, f = (d - t.cum[k - 1]) / seg;
    return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
  }
  function spawn(t, rev, at, fast) {
    if (!t) return;
    pulses.push({ t, rev, s: at || 0, v: (fast ? 260 : 90) + rnd() * 140, tail: 46 + rnd() * 50, mint: rnd() < 0.7 });
  }
  function nearTraces(x, y, n) {
    return traces.map(t => {
      let best = 1e9, bi = 0;
      t.P.forEach((p, i) => { const d = Math.hypot(p[0] - x, p[1] - y); if (d < best) { best = d; bi = i; } });
      return { t, best, at: t.cum[bi] };
    }).sort((a, b) => a.best - b.best).slice(0, n);
  }
  function burst(x, y, n, radius) {
    if (calm() || !traces.length) return;
    nearTraces(x, y - off, n).forEach((o, i) => {
      if (o.best > 260) return;
      spawn(o.t, i % 2 === 1, o.at, true);
      const p = pulses[pulses.length - 1]; if (p.rev) p.s = o.t.len - o.at;
    });
    lights.push({ x, y, r0: 0, r1: radius || 520, w: 90, t0: performance.now(), dur: 1300 });
    wake();
  }
  function target() { return Math.min(fine ? 64 : 26, Math.round(W * H / 34000)); }

  let raf = 0, last = 0;
  function wake() { if (!raf && !calm()) { last = performance.now(); raf = requestAnimationFrame(frame); } }
  function frame(now) {
    raf = 0;
    if (calm() || document.hidden) return;
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    off += (offTarget - off) * Math.min(1, dt * 8);
    boost *= Math.pow(0.12, dt);
    spawnAcc += dt;
    while (spawnAcc > 0.07) {
      spawnAcc -= 0.07;
      if (pulses.length >= target() || !traces.length) break;
      let t = traces[Math.floor(rnd() * traces.length)];
      if (cursor.on && rnd() < 0.45) {
        const near = nearTraces(cursor.x, cursor.y - off, 6);
        if (near.length && near[0].best < 240) t = near[Math.floor(rnd() * near.length)].t;
      }
      spawn(t, rnd() < 0.5);
    }
    for (let i = pulses.length - 1; i >= 0; i--) {
      const p = pulses[i];
      p.s += p.v * dt * (1 + boost);
      if (p.s - p.tail > p.t.len) {
        const end = p.rev ? p.t.P[0] : p.t.P[p.t.P.length - 1];
        flashes.push({ x: end[0], y: end[1], t0: now });
        pulses.splice(i, 1);
      }
    }
    for (let i = flashes.length - 1; i >= 0; i--) if (now - flashes[i].t0 > 700) flashes.splice(i, 1);
    for (let i = lights.length - 1; i >= 0; i--) if (now - lights[i].t0 > lights[i].dur) lights.splice(i, 1);
    cursor.a += ((cursor.on ? 1 : 0) - cursor.a) * Math.min(1, dt * 6);
    draw(now, dt);
    raf = requestAnimationFrame(frame);
  }

  function draw(now) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, cv.width, cv.height);
    const sy = Math.round((-off) * DPR);
    ctx.drawImage(base, 0, sy, cv.width, cv.height, 0, 0, cv.width, cv.height);
    if (calm()) return;

    const shapes = [];
    if (cursor.a > 0.02) shapes.push({ x: cursor.x, y: cursor.y, r: 210, a: cursor.a * 0.9 });
    lights.forEach(l => {
      const f = Math.max(0, Math.min(1, (now - l.t0) / l.dur)), e = 1 - Math.pow(1 - f, 3);
      shapes.push({ x: l.x, y: l.y, ring: l.r0 + (l.r1 - l.r0) * e, w: l.w, a: 1 - f });
    });
    if (shapes.length) {
      litCtx.globalCompositeOperation = "source-over";
      litCtx.setTransform(DPR, 0, 0, DPR, 0, 0);
      litCtx.clearRect(0, 0, W, H);
      shapes.forEach(s => {
        let g;
        if (s.ring == null) {
          g = litCtx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.r);
          g.addColorStop(0, `rgba(0,0,0,${s.a})`); g.addColorStop(1, "rgba(0,0,0,0)");
          litCtx.fillStyle = g; litCtx.fillRect(s.x - s.r, s.y - s.r, s.r * 2, s.r * 2);
        } else {
          const r0 = Math.max(0, s.ring - s.w), r1 = s.ring + s.w * .4, R = r1;
          g = litCtx.createRadialGradient(s.x, s.y, r0, s.x, s.y, r1);
          g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(.7, `rgba(0,0,0,${s.a})`); g.addColorStop(1, "rgba(0,0,0,0)");
          litCtx.fillStyle = g; litCtx.fillRect(s.x - R, s.y - R, R * 2, R * 2);
        }
      });
      litCtx.globalCompositeOperation = "source-in";
      litCtx.setTransform(1, 0, 0, 1, 0, 0);
      litCtx.drawImage(glow, 0, sy, cv.width, cv.height, 0, 0, cv.width, cv.height);
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = 0.55;
      ctx.drawImage(lit, 0, 0);
      ctx.globalAlpha = 1;
    } else ctx.globalCompositeOperation = "lighter";

    ctx.setTransform(DPR, 0, 0, DPR, 0, off * DPR);
    ctx.lineCap = "round"; ctx.lineWidth = 2;
    const top = -off - 40, bottom = -off + H + 40;
    pulses.forEach(p => {
      const head = Math.min(p.s, p.t.len), tail = Math.max(0, p.s - p.tail);
      if (head <= tail) return;
      const d = x => (p.rev ? p.t.len - x : x);
      const hp = posAt(p.t, d(head));
      if (hp[1] < top || hp[1] > bottom) return;
      const col = p.mint ? MINT : SAGE, N = 7;
      let prev = posAt(p.t, d(tail));
      for (let k = 1; k <= N; k++) {
        const q = posAt(p.t, d(tail + (head - tail) * k / N));
        ctx.strokeStyle = `rgba(${col}, ${(k / N) * 0.7})`;
        ctx.beginPath(); ctx.moveTo(prev[0], prev[1]); ctx.lineTo(q[0], q[1]); ctx.stroke();
        prev = q;
      }
      if (p.s <= p.t.len) { ctx.globalAlpha = .85; ctx.drawImage(sprite, hp[0] - 10, hp[1] - 10, 20, 20); ctx.globalAlpha = 1; }
    });
    flashes.forEach(f => {
      const k = Math.max(0, Math.min(1, (now - f.t0) / 700));
      ctx.strokeStyle = `rgba(${MINT}, ${0.7 * (1 - k)})`; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(f.x, f.y, 3 + k * 14, 0, 7); ctx.stroke();
      ctx.globalAlpha = 1 - k; ctx.drawImage(sprite, f.x - 14, f.y - 14, 28, 28); ctx.globalAlpha = 1;
    });
    ctx.globalCompositeOperation = "source-over";
  }

  function onScroll() {
    const max = document.documentElement.scrollHeight - innerHeight;
    offTarget = -(max > 0 ? scrollY / max : 0) * EXTRA;
    const dy = Math.abs(scrollY - lastY); lastY = scrollY;
    boost = Math.min(4, boost + dy / 220);
    if (calm()) { off = offTarget; draw(performance.now()); } else wake();
  }
  addEventListener("scroll", onScroll, { passive: true });
  if (fine) {
    addEventListener("pointermove", e => { cursor.x = e.clientX; cursor.y = e.clientY; cursor.on = true; wake(); }, { passive: true });
    document.addEventListener("pointerleave", () => { cursor.on = false; });
  }
  addEventListener("pointerdown", e => { if (e.button === 0 || e.pointerType !== "mouse") burst(e.clientX, e.clientY, 8, 420); }, { passive: true });
  document.addEventListener("internals:burst", e => burst(e.detail.x, e.detail.y, 14, 700));
  document.addEventListener("internals:show", () => {
    if (calm()) return;
    lights.push({ x: W / 2, y: H * .4, r0: 0, r1: Math.hypot(W, H), w: 160, t0: performance.now(), dur: 1700 });
    for (let i = 0; i < 18; i++) spawn(traces[Math.floor(rnd() * traces.length)], rnd() < .5, 0, true);
    wake();
  });
  document.addEventListener("visibilitychange", wake);
  new MutationObserver(() => { if (calm()) { pulses.length = 0; draw(performance.now()); } else wake(); })
    .observe(root, { attributes: true, attributeFilter: ["class"] });

  let rT = 0, lastW = 0, lastH = 0;
  addEventListener("resize", () => {
    clearTimeout(rT);
    rT = setTimeout(() => {
      if (innerWidth === lastW && Math.abs(innerHeight - lastH) < 120) return;
      lastW = innerWidth; lastH = innerHeight; build(); onScroll();
    }, 200);
  });
  lastW = innerWidth; lastH = innerHeight;
  build(); onScroll(); wake();
})();
