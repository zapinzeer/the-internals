(function () {
  const { t, num, onChange } = Internals.i18n;
  const { C, el, label, rich, loop, quiz, stepper } = Internals.ui;

  (function path() {
    const svg = document.getElementById("psuPath");
    if (!svg) return;
    const N = 6;
    const icons = [
      g => el("path", { d: "M10 25 C18 5, 26 5, 34 25 S50 45, 58 25", fill: "none", stroke: "currentColor", "stroke-width": 2.5 }, g),
      g => { el("path", { d: "M14 25 H26 M42 25 H54 M26 14 L42 25 L26 36 Z M42 14 V36", fill: "none", stroke: "currentColor", "stroke-width": 2.5, "stroke-linejoin": "round" }, g); },
      g => { el("path", { d: "M10 25 H30 M38 25 H58 M30 12 V38 M38 12 V38", fill: "none", stroke: "currentColor", "stroke-width": 2.5 }, g); },
      g => el("path", { d: "M8 36 V14 H18 V36 H28 V14 H38 V36 H48 V14 H58 V36", fill: "none", stroke: "currentColor", "stroke-width": 2.2 }, g),
      g => { el("path", { d: "M22 10 a5 5 0 0 1 0 10 a5 5 0 0 1 0 10 a5 5 0 0 1 0 10 M46 10 a5 5 0 0 0 0 10 a5 5 0 0 0 0 10 a5 5 0 0 0 0 10 M32 8 V42 M36 8 V42", fill: "none", stroke: "currentColor", "stroke-width": 2.2 }, g); },
      g => { el("path", { d: "M10 25 H58", fill: "none", stroke: "currentColor", "stroke-width": 3 }, g); el("path", { d: "M10 33 H58", fill: "none", stroke: "currentColor", "stroke-width": 1.5, "stroke-dasharray": "4 4" }, g); }
    ];
    const blocks = [];
    for (let i = 0; i < N; i++) {
      const x = 16 + i * 84;
      if (i) el("path", { d: `M${x - 14} 45 h10 m-4 -4 l4 4 l-4 4`, fill: "none", stroke: C.line2, "stroke-width": 1.5 }, svg);
      const g = el("g", { transform: `translate(${x},20)`, style: "cursor:pointer" }, svg);
      const r = el("rect", { width: 68, height: 50, rx: 7, fill: C.panel, stroke: C.line2, "stroke-width": 1.5 }, g);
      const ic = el("g", {}, g); icons[i](ic);
      g.addEventListener("click", () => st.go(i, true));
      blocks.push({ r, g });
    }
    const X0 = 56, X1 = 504, YT = 100, YB = 300, YM = (YT + YB) / 2, HALF = (YB - YT) / 2 - 10;
    el("line", { x1: X0, y1: YT, x2: X0, y2: YB, stroke: C.line2 }, svg);
    el("line", { x1: X0, y1: YM, x2: X1, y2: YM, stroke: C.line2, "stroke-dasharray": "3 5" }, svg);
    label(svg, X0, YT - 10, "psu.path.volt", { "font-size": 10 });
    const timeLbl = label(svg, X1, YB + 22, "psu.path.time", { "font-size": 10, "text-anchor": "end" });
    const topTx = el("text", { x: X0 - 6, y: YT + 14, "text-anchor": "end", fill: C.muted, "font-size": 10 }, svg, "");
    el("text", { x: X0 - 6, y: YM + 4, "text-anchor": "end", fill: C.muted, "font-size": 10 }, svg, "0");
    const botTx = el("text", { x: X0 - 6, y: YB - 6, "text-anchor": "end", fill: C.muted, "font-size": 10 }, svg, "");
    const ghost = el("path", { fill: "none", stroke: C.line2, "stroke-width": 1.5, "stroke-dasharray": "4 4" }, svg);
    const wave = el("path", { fill: "none", stroke: C.signal, "stroke-width": 2.5, "stroke-linejoin": "round" }, svg);
    const valTx = el("text", { x: X1, y: YT + 8, "text-anchor": "end", fill: C.ink, "font-size": 15, "font-weight": 600 }, svg, "");
    const hzTx = el("text", { x: X1, y: YT + 26, "text-anchor": "end", fill: C.muted, "font-size": 11 }, svg, "");

    const scale = [400, 400, 400, 400, 30, 30];
    const val = ["±325 V", "325 V", "~400 V", "0 ↔ 400 V", "±24 V", "12 V"];
    const hz = ["50 Hz", "100 Hz", "", "~100 kHz", "~100 kHz", "DC"];
    const cols = [C.gold, C.gold, C.copper, C.copper, C.violet, C.good];
    const f = (s, u) => {
      const sq = ((u * 8) % 1 + 1) % 1 < .5;
      switch (s) {
        case 0: return 325 * Math.sin(u * Math.PI * 2);
        case 1: return 325 * Math.abs(Math.sin(u * Math.PI * 2));
        case 2: return 400 - 7 * (((u * 2) % 1 + 1) % 1);
        case 3: return sq ? 400 : 0;
        case 4: return sq ? 24 : -24;
        default: return 12 + .35 * Math.sin(u * Math.PI * 48);
      }
    };
    const pathFor = (s, sc, shift) => {
      let d = "";
      const n = s === 3 || s === 4 ? 720 : 240;
      for (let k = 0; k <= n; k++) {
        const x = X0 + (X1 - X0) * k / n, u = 3 * k / n + shift;
        const y = YM - f(s, u) / sc * HALF;
        d += (k ? "L" : "M") + x.toFixed(1) + " " + y.toFixed(1);
      }
      return d;
    };
    let cur = 0, shift = 0;
    const titleEl = document.getElementById("psuPathTitle"), textEl = document.getElementById("psuPathText");
    function render(i) {
      cur = i;
      titleEl.textContent = t("psu.path.s" + i, { n: "" }).trim();
      textEl.textContent = t("psu.path.t" + i);
      blocks.forEach((b, k) => {
        b.r.setAttribute("stroke", k === i ? cols[i] : C.line2);
        b.r.setAttribute("fill", k === i ? C.panel2 : C.panel);
        b.g.setAttribute("color", k === i ? cols[i] : k < i ? C.ink2 : C.muted);
      });
      topTx.textContent = "+" + scale[i] + " V"; botTx.textContent = "−" + scale[i] + " V";
      valTx.textContent = val[i]; valTx.setAttribute("fill", cols[i]);
      hzTx.textContent = hz[i];
      wave.setAttribute("stroke", cols[i]);
      draw();
    }
    function draw() {
      wave.setAttribute("d", pathFor(cur, scale[cur], shift));
      const prev = cur - 1;
      ghost.setAttribute("d", prev >= 0 && scale[prev] === scale[cur] ? pathFor(prev, scale[cur], shift) : "");
    }
    const st = stepper(document.getElementById("psuPathChips"), document.getElementById("psuPathPrev"), document.getElementById("psuPathNext"),
      N, k => "psu.path.s" + k, render);
    loop(svg, dt => { shift = (shift + dt * .25) % 1; draw(); });
    void timeLbl;
  })();

  (function budget() {
    const svg = document.getElementById("psuBudget");
    if (!svg) return;
    const cpuW = [65, 125, 250], gpuW = [0, 200, 350, 575], REST = 50;
    const sizes = [450, 550, 650, 750, 850, 1000, 1200, 1600];
    let cpu = 1, gpu = 2;
    const X0 = 20, X1 = 780, MAX = 1600, px = w => X0 + (X1 - X0) * w / MAX;

    const defs = el("defs", {}, svg);
    const pat = el("pattern", { id: "psuHatch", width: 8, height: 8, patternUnits: "userSpaceOnUse", patternTransform: "rotate(45)" }, defs);
    el("rect", { width: 8, height: 8, fill: "rgba(216,178,90,.12)" }, pat);
    el("line", { x1: 0, y1: 0, x2: 0, y2: 8, stroke: C.gold, "stroke-width": 3, opacity: .5 }, pat);
    for (let w = 0; w <= MAX; w += 200) {
      el("line", { x1: px(w), y1: 96, x2: px(w), y2: 104, stroke: C.line2 }, svg);
      el("text", { x: px(w), y: 124, "text-anchor": w === 0 ? "start" : w === MAX ? "end" : "middle", fill: C.muted, "font-size": 13 }, svg, w === MAX ? w + " W" : String(w));
    }
    el("rect", { x: X0, y: 44, width: X1 - X0, height: 44, rx: 6, fill: C.ground }, svg);
    const segs = [
      { key: "psu.budget.cpu", fill: C.copper },
      { key: "psu.budget.gpu", fill: C.signal },
      { key: "psu.budget.rest", fill: C.violet },
      { key: "psu.budget.extra", fill: "url(#psuHatch)" }
    ].map(s => {
      s.r = el("rect", { x: X0, y: 44, width: 0, height: 44, fill: s.fill }, svg);
      s.tx = el("text", { y: 71, fill: "#0b0f14", "font-size": 13, "font-weight": 600 }, svg, "");
      s.x = X0; s.w = 0; s.tx0 = X0; s.tw = 0;
      return s;
    });
    segs[3].tx.setAttribute("fill", C.gold);
    const mk = el("line", { x1: 0, y1: 26, x2: 0, y2: 100, stroke: C.good, "stroke-width": 2.5 }, svg);
    const mkTx = el("text", { y: 20, fill: C.good, "font-size": 14, "font-weight": 600 }, svg, "");
    let mx = px(750), mTarget = mx;

    const connBox = document.getElementById("psuConns");
    const face = (kind) => {
      const s = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      s.setAttribute("viewBox", "0 0 150 44"); s.setAttribute("aria-hidden", "true");
      const grid = (cols, rows, cw, stroke, x0) => {
        const w = cols * cw + 8, h = rows * 14 + 8, ox = x0 != null ? x0 : (150 - w) / 2, oy = 44 - h - 2;
        el("rect", { x: ox, y: oy, width: w, height: h, rx: 3, fill: "#1b1d22", stroke, "stroke-width": 1.5 }, s);
        for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++)
          el("rect", { x: ox + 4 + i * cw + 1.5, y: oy + 4 + j * 14 + 1.5, width: cw - 3, height: 11, rx: (i + j) % 2 ? 2 : 5, fill: C.ground }, s);
        return [ox, oy, w];
      };
      if (kind === "atx") grid(12, 2, 11, C.ink2);
      if (kind === "eps") grid(4, 2, 14, C.copper);
      if (kind === "pcie") grid(4, 2, 14, C.signal);
      if (kind === "hpwr") {
        const [ox, oy, w] = grid(6, 2, 10, C.signal);
        for (let k = 0; k < 4; k++) el("rect", { x: ox + w / 2 - 17 + k * 9, y: oy - 8, width: 6, height: 6, rx: 1, fill: C.ground, stroke: C.signal }, s);
      }
      if (kind === "sata") {
        el("path", { d: "M22 18 H128 V34 H22 Z M22 18 V12 H34 V18", fill: "#1b1d22", stroke: C.violet, "stroke-width": 1.5 }, s);
        for (let k = 0; k < 15; k++) el("rect", { x: 28 + k * 6.6, y: 23, width: 3, height: 7, fill: C.gold, opacity: .8 }, s);
      }
      return s;
    };
    const conns = ["atx", "eps", "pcie", "hpwr", "sata"].map(kind => {
      const d = document.createElement("div"); d.className = "conn";
      d.appendChild(face(kind));
      const b = document.createElement("b"), name = document.createElement("span"), em = document.createElement("em");
      b.appendChild(name); b.appendChild(em); d.appendChild(b);
      const sub = document.createElement("span"); d.appendChild(sub);
      connBox.appendChild(d);
      return { kind, d, name, em, sub };
    });

    const cb = cpuW.map((w, i) => {
      const b = document.createElement("button"); b.type = "button"; b.className = "btn";
      b.addEventListener("click", () => { cpu = i; update(); }); document.getElementById("psuCpu").appendChild(b); return b;
    });
    const gb = gpuW.map((w, i) => {
      const b = document.createElement("button"); b.type = "button"; b.className = "btn";
      b.addEventListener("click", () => { gpu = i; update(); }); document.getElementById("psuGpu").appendChild(b); return b;
    });
    const out = document.getElementById("psuBudgetRead");
    function update() {
      cb.forEach((b, i) => { b.setAttribute("aria-pressed", i === cpu); b.textContent = t("psu.budget.cpu" + i) + " · " + cpuW[i] + " W"; });
      gb.forEach((b, i) => { b.setAttribute("aria-pressed", i === gpu); b.textContent = t("psu.budget.gpu" + i) + " · " + gpuW[i] + " W"; });
      const c = cpuW[cpu], g = gpuW[gpu], total = c + g + REST, head = total * 1.25;
      const psu = sizes.find(s => s >= head) || 1600;
      let x = X0;
      [c, g, REST, head - total].forEach((w, k) => {
        const s = segs[k];
        s.tx0 = px(x) ; s.tw = px(x + w) - px(x); x += w;
        const lbl = k === 3 ? t(s.key) : t(s.key) + " " + w + " W";
        s.tx.textContent = s.tw > lbl.length * 8 + 12 ? lbl : s.tw > 52 && k !== 3 ? w + " W" : "";
      });
      mTarget = px(psu);
      mkTx.textContent = t("psu.budget.psu", { w: psu });
      rich(out, "psu.budget.read", { w: [String(total), "k"], h: [String(Math.round(head)), "k"], psu: [String(psu), "s"] });
      const eps = c >= 250 ? 2 : 1, pcie = g === 200 ? 1 : g === 350 ? 2 : 0, hpwr = g === 575 ? 1 : 0;
      const need = { atx: 1, eps, pcie, hpwr, sata: 1 };
      conns.forEach(o => {
        const n = need[o.kind];
        o.d.classList.toggle("off", !n); o.d.classList.toggle("on", !!n);
        o.name.textContent = t("psu.conn." + o.kind);
        o.em.textContent = n > 1 ? "×" + n : "";
        o.sub.textContent = n ? t("psu.conn." + o.kind + ".t") : t("psu.conn.none");
      });
    }
    update(); onChange(update);
    loop(svg, dt => {
      const k = Math.min(1, dt * 9);
      segs.forEach(s => {
        s.x += (s.tx0 - s.x) * k; s.w += (s.tw - s.w) * k;
        s.r.setAttribute("x", s.x); s.r.setAttribute("width", Math.max(0, s.w));
        s.tx.setAttribute("x", s.x + 8);
      });
      mx += (mTarget - mx) * k;
      mk.setAttribute("x1", mx); mk.setAttribute("x2", mx);
      const nearEnd = mx > X1 - 120;
      mkTx.setAttribute("x", nearEnd ? mx - 6 : mx + 6); mkTx.setAttribute("text-anchor", nearEnd ? "end" : "start");
    });
  })();

  (function eff() {
    const svg = document.getElementById("psuEff");
    if (!svg) return;
    const badges = [["Bronze", 85, "#c88a58"], ["Gold", 90, "#d8b25a"], ["Platinum", 92, "#b9c0c8"], ["Titanium", 94, "#8fa3b8"]];
    const loads = [300, 500, 800];
    let bi = 1, load = 500, dash = 0;
    const S = .2, MID = 190;

    const inBand = el("path", { fill: "none", stroke: C.gold, opacity: .35 }, svg);
    const outBand = el("path", { fill: "none", stroke: C.good, opacity: .35 }, svg);
    const heatBand = el("path", { fill: "none", stroke: C.bad, opacity: .45 }, svg);
    const flows = [inBand, outBand, heatBand].map(b => el("path", { fill: "none", stroke: "#fff", opacity: .18, "stroke-dasharray": "2 16" }, svg));
    const wallBar = el("rect", { x: 40, width: 24, rx: 4, fill: C.gold }, svg);
    const outBar = el("rect", { x: 620, width: 24, rx: 4, fill: C.good }, svg);
    const box = el("rect", { x: 250, y: 84, width: 110, height: 212, rx: 12, fill: C.panel, stroke: C.line2, "stroke-width": 1.5 }, svg);
    el("text", { x: 305, y: 186, "text-anchor": "middle", fill: C.ink, "font-size": 18, "font-weight": 700 }, svg, "PSU");
    const badgeTx = el("text", { x: 305, y: 208, "text-anchor": "middle", "font-size": 11.5, "font-weight": 600 }, svg, "");
    const wallLbl = label(svg, 40, 0, "psu.eff.wall", { "font-size": 10, fill: C.gold });
    const wallVal = el("text", { x: 40, fill: C.ink, "font-size": 17, "font-weight": 600 }, svg, "");
    const outLbl = label(svg, 644, 0, "psu.eff.pc", { "font-size": 10, fill: C.good, "text-anchor": "end" });
    const outVal = el("text", { x: 644, "text-anchor": "end", fill: C.ink, "font-size": 17, "font-weight": 600 }, svg, "");
    label(svg, 424, 30, "psu.eff.heat", { "font-size": 10, fill: C.bad });
    const heatVal = el("text", { x: 424, y: 50, fill: C.ink, "font-size": 17, "font-weight": 600 }, svg, "");
    const wisps = [0, 1, 2].map(k => el("path", { d: `M${388 + k * 12} 34 q6 -8 0 -16 q-6 -8 0 -16`, fill: "none", stroke: C.bad, "stroke-width": 2, "stroke-linecap": "round" }, svg));

    const out = document.getElementById("psuEffRead");
    const bb = badges.map(([name, e], i) => {
      const b = document.createElement("button"); b.type = "button"; b.className = "btn"; b.textContent = name + " " + e + "%";
      b.addEventListener("click", () => { bi = i; update(); }); document.getElementById("psuBadges").appendChild(b); return b;
    });
    const lb = loads.map(w => {
      const b = document.createElement("button"); b.type = "button"; b.className = "btn"; b.textContent = w + " W";
      b.addEventListener("click", () => { load = w; update(); }); document.getElementById("psuLoads").appendChild(b); return [b, w];
    });
    function update() {
      bb.forEach((b, i) => b.setAttribute("aria-pressed", i === bi));
      lb.forEach(([b, w]) => b.setAttribute("aria-pressed", w === load));
      const [name, e, col] = badges[bi];
      const wall = load / (e / 100), heat = wall - load;
      const wH = wall * S, oH = load * S, hH = heat * S;
      const wTop = MID - wH / 2, oTop = MID - oH / 2;
      wallBar.setAttribute("y", wTop); wallBar.setAttribute("height", wH);
      outBar.setAttribute("y", oTop); outBar.setAttribute("height", oH);
      wallLbl.setAttribute("y", wTop - 30); wallVal.setAttribute("y", wTop - 10);
      outLbl.setAttribute("y", oTop - 30); outVal.setAttribute("y", oTop - 10);
      const dIn = `M64 ${MID} C150 ${MID}, 170 ${MID}, 260 ${MID}`;
      const dOut = `M350 ${MID} C460 ${MID}, 520 ${MID}, 620 ${MID}`;
      const dHeat = `M305 90 C305 50, 330 ${26 + hH / 2}, 380 ${26 + hH / 2}`;
      [[inBand, dIn, wH], [outBand, dOut, oH], [heatBand, dHeat, hH]].forEach(([p, d, w], k) => {
        p.setAttribute("d", d); p.setAttribute("stroke-width", w);
        flows[k].setAttribute("d", d); flows[k].setAttribute("stroke-width", w);
      });
      box.setAttribute("stroke", col); badgeTx.setAttribute("fill", col); badgeTx.textContent = "80 Plus " + name;
      wallVal.textContent = Math.round(wall) + " W"; outVal.textContent = load + " W"; heatVal.textContent = Math.round(heat) + " W";
      wisps.forEach((w, k) => w.setAttribute("opacity", Math.min(1, heat / 40) * (k === 1 ? .8 : .45)));
      rich(out, "psu.eff.read", { out: [String(load), "k"], eff: [num(e / 100, 2), "k"], wall: [String(Math.round(wall)), "k"], heat: [String(Math.round(heat)), "s"] });
    }
    update(); onChange(update);
    loop(svg, (dt, now) => {
      dash -= dt * 40;
      flows.forEach(f => f.setAttribute("stroke-dashoffset", dash));
      wisps.forEach((w, k) => w.setAttribute("transform", `translate(0 ${-((now / 40 + k * 7) % 8)})`));
    });
  })();

  const box = document.getElementById("psuQuiz");
  if (box) quiz(box, "psu.quiz", [1, 2, 0]);
})();
