(function () {
  const { t, num, bind, onChange } = Internals.i18n;
  const { C, el, label, loop, canvas2d, quiz, stepper } = Internals.ui;

  (function race() {
    const cpuCv = document.getElementById("raceCpu"), gpuCv = document.getElementById("raceGpu");
    if (!cpuCv) return;
    const GW = 32, GH = 20, TOTAL = GW * GH;
    const hex = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
    const mix = (a, b, k) => a.map((v, i) => Math.round(v + (b[i] - v) * k));
    const top = hex("#1b2440"), horizon = hex("#e38b4f"), sun = hex("#f3cf73"), hill = hex("#2a2f45"), hill2 = hex("#3b3560");
    function colour(x, y) {
      const h1 = 13 + 2.2 * Math.sin(x / 4.2), h2 = 15.5 + 1.6 * Math.sin(x / 3 + 2);
      if (y > h2) return hill;
      if (y > h1) return hill2;
      const d = Math.hypot(x - 22, y - 11.5);
      if (d < 3.6) return sun;
      const sky = mix(top, horizon, Math.pow(y / 13, 1.6));
      return d < 6 ? mix(sky, sun, (6 - d) / 6 * .35) : sky;
    }
    const pixels = [];
    for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) pixels.push(colour(x, y));

    const lanes = [
      { cv: cpuCv, bar: document.getElementById("raceCpuBar"), out: document.getElementById("raceCpuT"), per: 8, step: 30, done: TOTAL, time: 0 },
      { cv: gpuCv, bar: document.getElementById("raceGpuBar"), out: document.getElementById("raceGpuT"), per: 256, step: 60, done: TOTAL, time: 0 }
    ];
    lanes.forEach(L => { L.s = canvas2d(L.cv); L.finish = Math.ceil(TOTAL / L.per) * L.step; L.time = L.finish; });
    function draw(L) {
      const { g, W, H } = L.s; if (!W) return;
      const cw = W / GW, ch = H / GH;
      g.clearRect(0, 0, W, H);
      for (let i = 0; i < L.done; i++) {
        const [r, gg, b] = pixels[i];
        g.fillStyle = `rgb(${r},${gg},${b})`;
        g.fillRect((i % GW) * cw, Math.floor(i / GW) * ch, cw + .5, ch + .5);
      }
      L.bar.style.width = (L.done / TOTAL * 100) + "%";
      L.out.textContent = t("gpu.par.time", { p: Math.round(L.done / TOTAL * 100), s: num(L.time / 1000, 2) });
    }
    new ResizeObserver(() => lanes.forEach(draw)).observe(cpuCv);
    lanes.forEach(draw);
    onChange(() => lanes.forEach(draw));
    let run = null;
    document.getElementById("raceRun").addEventListener("click", () => {
      cancelAnimationFrame(run);
      lanes.forEach(L => { L.done = 0; L.time = 0; draw(L); });
      const t0 = performance.now();
      (function tick(now) {
        const el = now - t0;
        lanes.forEach(L => {
          const steps = Math.floor(el / L.step);
          L.done = Math.min(TOTAL, steps * L.per);
          L.time = Math.min(el, L.finish);
          draw(L);
        });
        if (lanes.some(L => L.done < TOTAL)) run = requestAnimationFrame(tick);
      })(t0);
    });
  })();

  (function pipeline() {
    const svg = document.getElementById("gpuPipe");
    if (!svg) return;
    const CS = 20, GW = 24, GH = 16;
    const grid = el("g", {}, svg);
    for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++)
      el("rect", { x: x * CS + 1, y: y * CS + 1, width: CS - 2, height: CS - 2, rx: 2, fill: C.panel }, grid);
    const V = { top: [12, 1.2], left: [2.5, 6.5], right: [21.5, 6.5], bottom: [12, 15], mid: [10.5, 7.5] };
    const tris = [["top", "left", "mid", "#f2b27e"], ["top", "mid", "right", "#e38b4f"], ["left", "bottom", "mid", "#b8683a"], ["mid", "bottom", "right", "#8f4f2c"]];
    const P = k => [V[k][0] * CS, V[k][1] * CS];
    const sign = (p, a, b) => (p[0] - b[0]) * (a[1] - b[1]) - (a[0] - b[0]) * (p[1] - b[1]);
    const inside = (p, a, b, c) => {
      const d1 = sign(p, a, b), d2 = sign(p, b, c), d3 = sign(p, c, a);
      return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0));
    };
    const cellTri = [];
    for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
      const p = [x + .5, y + .5];
      const ti = tris.findIndex(tr => inside(p, V[tr[0]], V[tr[1]], V[tr[2]]));
      if (ti >= 0) cellTri.push({ x, y, ti });
    }
    const cellLayer = el("g", {}, svg);
    const cells = cellTri.map(c => el("rect", { x: c.x * CS + 1, y: c.y * CS + 1, width: CS - 2, height: CS - 2, rx: 2, fill: C.line2, opacity: 0 }, cellLayer));
    const edgeLayer = el("g", {}, svg);
    const edges = [];
    tris.forEach(tr => {
      const pts = [P(tr[0]), P(tr[1]), P(tr[2])];
      const poly = el("polygon", { points: pts.map(p => p.join(",")).join(" "), fill: "none", stroke: C.signal, "stroke-width": 2, "stroke-linejoin": "round", opacity: 0 }, edgeLayer);
      edges.push(poly);
    });
    const dotLayer = el("g", {}, svg);
    const dots = Object.keys(V).map(k => {
      const [x, y] = P(k);
      return el("circle", { cx: x, cy: y, r: 6, fill: C.ink, stroke: C.ground, "stroke-width": 2 }, dotLayer);
    });

    let anim = null;
    const titleEl = document.getElementById("gpuPipeTitle"), textEl = document.getElementById("gpuPipeText");
    function animate(dur, fn) {
      cancelAnimationFrame(anim);
      if (!dur) { fn(1); return; }
      const t0 = performance.now();
      (function f(now) { const k = Math.min(1, (now - t0) / dur); fn(k); if (k < 1) anim = requestAnimationFrame(f); })(t0);
    }
    function render(i, go) {
      titleEl.textContent = t("gpu.pipe.s" + i, { n: "" }).trim();
      textEl.textContent = t("gpu.pipe.t" + i);
      animate(go ? 700 : 0, k => {
        const e = 1 - Math.pow(1 - k, 3);
        Object.keys(V).forEach((key, j) => {
          const [x, y] = P(key), cx = 240, cy = 160;
          const s = i === 0 ? .25 + .75 * e : 1;
          dots[j].setAttribute("cx", cx + (x - cx) * s); dots[j].setAttribute("cy", cy + (y - cy) * s);
          dots[j].setAttribute("opacity", i >= 3 ? .0 : 1);
        });
        edges.forEach(p => {
          p.setAttribute("opacity", i === 1 ? e : i === 2 ? 1 : i === 3 ? .25 : 0);
          p.setAttribute("fill", "none");
        });
        const n = cells.length;
        cells.forEach((c, j) => {
          const tri = tris[cellTri[j].ti];
          if (i < 2) { c.setAttribute("opacity", 0); return; }
          const order = cellTri[j].y / GH;
          const on = i === 2 ? (k >= order ? 1 : 0) : 1;
          c.setAttribute("opacity", on);
          c.setAttribute("fill", i === 3 ? tri[3] : C.line2);
          if (i === 3) c.setAttribute("opacity", Math.min(1, k * 1.6 + (cellTri[j].x % 3) * .05));
        });
      });
    }
    stepper(document.getElementById("gpuPipeChips"), document.getElementById("gpuPipePrev"), document.getElementById("gpuPipeNext"),
      4, k => "gpu.pipe.s" + k, render);
  })();

  (function fps() {
    const cv = document.getElementById("gpuFps");
    if (!cv) return;
    const s = canvas2d(cv);
    const rates = [30, 60, 144];
    let tt = 0;
    loop(cv, dt => {
      const { g, W, H } = s; if (!W) return;
      tt += dt;
      g.clearRect(0, 0, W, H);
      const x0 = 16, x1 = W - 16, rowH = H / 3;
      g.font = "12px 'JetBrains Mono', monospace";
      rates.forEach((f, r) => {
        const y = r * rowH + rowH * .62;
        g.fillStyle = C.ink2;
        g.fillText(t("gpu.fps.lane", { f, ms: num(1000 / f, 1) }), x0, r * rowH + 16);
        g.strokeStyle = C.line; g.lineWidth = 2; g.beginPath(); g.moveTo(x0, y); g.lineTo(x1, y); g.stroke();
        const pos = time => { const p = (time / 2) % 2; return x0 + 10 + (x1 - x0 - 20) * (p < 1 ? p : 2 - p); };
        const q = Math.floor(tt * f) / f;
        const col = [C.copper, C.signal, C.good][r];
        for (let k = 5; k >= 1; k--) {
          g.fillStyle = col; g.globalAlpha = .07 + .3 * (5 - k) / 5;
          g.beginPath(); g.arc(pos(Math.max(0, q - k / f)), y, 7, 0, 7); g.fill();
        }
        g.globalAlpha = 1; g.fillStyle = col;
        g.beginPath(); g.arc(pos(q), y, 9, 0, 7); g.fill();
      });
    });
  })();

  const box = document.getElementById("gpuQuiz");
  if (box) quiz(box, "gpu.quiz", [0, 1, 1]);
})();
