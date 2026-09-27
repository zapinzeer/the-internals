(function () {
  const NS = "http://www.w3.org/2000/svg";
  const { t, num, plural, bind, onChange } = Internals.i18n;
  const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  const C = {
    ink: css("--ink"), ink2: css("--ink-2"), muted: css("--muted"), line: css("--line"), line2: css("--line-strong"),
    panel: css("--panel"), panel2: css("--panel-2"), ground: css("--ground"),
    copper: css("--copper"), signal: css("--signal"), violet: css("--violet"), good: css("--good"), gold: css("--gold")
  };
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  function el(tag, attrs, parent, text) {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (text !== undefined) e.textContent = text;
    if (parent) parent.appendChild(e);
    return e;
  }
  function label(svg, x, y, key, opts) {
    const e = el("text", Object.assign({ x, y, fill: C.muted, "font-size": 11, "letter-spacing": ".06em" }, opts || {}), svg);
    if (typeof key === "string") bind(e, key); else e.textContent = key.raw;
    return e;
  }

  (function switches() {
    const m = document.getElementById("mosfet");
    const a = document.getElementById("andgate");
    if (!m || !a) return;

    el("rect", { x: 30, y: 140, width: 360, height: 96, rx: 4, fill: "#241f33" }, m);
    label(m, 42, 226, "cpu.sw.base");
    el("rect", { x: 50, y: 140, width: 90, height: 42, fill: "#2e4a68" }, m);
    el("rect", { x: 280, y: 140, width: 90, height: 42, fill: "#2e4a68" }, m);
    label(m, 95, 166, "cpu.sw.source", { fill: C.ink2, "text-anchor": "middle" });
    label(m, 325, 166, "cpu.sw.drain", { fill: C.ink2, "text-anchor": "middle" });
    const channel = el("rect", { x: 140, y: 141, width: 140, height: 12, fill: C.signal, opacity: 0 }, m);
    el("rect", { x: 138, y: 128, width: 144, height: 12, fill: "#8593a5" }, m);
    label(m, 210, 137.5, "cpu.sw.insulator", { "font-size": 8.5, fill: C.ground, "text-anchor": "middle" });
    const gate = el("rect", { x: 138, y: 90, width: 144, height: 38, rx: 3, fill: "#5b6778" }, m);
    label(m, 210, 114, "cpu.sw.gate", { fill: C.ink, "text-anchor": "middle" });
    el("line", { x1: 210, y1: 90, x2: 210, y2: 70, stroke: C.line2, "stroke-width": 3 }, m);
    const gateDot = el("circle", { cx: 210, cy: 66, r: 6, fill: C.panel2, stroke: C.line2, "stroke-width": 2 }, m);
    const gv = el("text", { x: 222, y: 70, fill: C.ink2, "font-size": 11 }, m, "0 V");
    const wireAttrs = { fill: "none", stroke: C.line2, "stroke-width": 3 };
    const w1 = el("polyline", Object.assign({ points: "95,140 95,30 196,30" }, wireAttrs), m);
    const w2 = el("polyline", Object.assign({ points: "224,30 325,30 325,140" }, wireAttrs), m);
    const lamp = el("circle", { cx: 210, cy: 30, r: 13, fill: C.panel2, stroke: C.line2, "stroke-width": 2 }, m);
    const out = el("text", { x: 362, y: 60, fill: C.muted, "font-size": 34, "font-weight": 500, "text-anchor": "middle" }, m, "0");
    label(m, 362, 78, "cpu.sw.output", { "font-size": 9, "text-anchor": "middle" });
    const electrons = [];
    for (let i = 0; i < 7; i++) electrons.push(el("circle", { cx: 0, cy: 147, r: 3, fill: C.ground, opacity: 0 }, m));

    let on = false;
    const gateBtn = document.getElementById("gateBtn");
    function drawGate() {
      channel.setAttribute("opacity", on ? 0.9 : 0);
      gate.setAttribute("fill", on ? C.copper : "#5b6778");
      gateDot.setAttribute("fill", on ? C.copper : C.panel2);
      gv.textContent = on ? "+1 V" : "0 V";
      [w1, w2].forEach(w => w.setAttribute("stroke", on ? C.signal : C.line2));
      lamp.setAttribute("fill", on ? C.gold : C.panel2);
      lamp.setAttribute("stroke", on ? C.gold : C.line2);
      out.textContent = on ? "1" : "0"; out.setAttribute("fill", on ? C.gold : C.muted);
      gateBtn.textContent = t(on ? "cpu.sw.gateOn" : "cpu.sw.gateOff");
      gateBtn.setAttribute("aria-pressed", on);
    }
    gateBtn.addEventListener("click", () => { on = !on; drawGate(); });
    drawGate(); onChange(drawGate);
    const t0 = performance.now();
    (function flow(now) {
      requestAnimationFrame(flow);
      const p = ((now - t0) / 1400) % 1;
      electrons.forEach((e, i) => {
        const f = (p + i / electrons.length) % 1;
        e.setAttribute("cx", 100 + f * 225);
        e.setAttribute("opacity", on ? (f > 0.08 && f < 0.95 ? 0.9 : 0) : 0);
      });
    })(t0);

    const wa = { fill: "none", "stroke-width": 3, stroke: C.line2 };
    const segs = [
      el("polyline", Object.assign({ points: "50,110 50,60 130,60" }, wa), a),
      el("polyline", Object.assign({ points: "180,60 230,60" }, wa), a),
      el("polyline", Object.assign({ points: "280,60 370,60 370,112" }, wa), a),
      el("polyline", Object.assign({ points: "370,148 370,200 50,200 50,146" }, wa), a)
    ];
    el("line", { x1: 34, y1: 118, x2: 66, y2: 118, stroke: C.ink2, "stroke-width": 3 }, a);
    el("line", { x1: 42, y1: 128, x2: 58, y2: 128, stroke: C.ink2, "stroke-width": 3 }, a);
    el("line", { x1: 34, y1: 138, x2: 66, y2: 138, stroke: C.ink2, "stroke-width": 3 }, a);
    el("line", { x1: 42, y1: 146, x2: 58, y2: 146, stroke: C.ink2, "stroke-width": 3 }, a);
    el("line", { x1: 50, y1: 110, x2: 50, y2: 118, stroke: C.line2, "stroke-width": 3 }, a);
    label(a, 74, 134, "cpu.sw.battery");
    function sw(x, name) {
      el("circle", { cx: x, cy: 60, r: 4, fill: C.ink2 }, a);
      el("circle", { cx: x + 50, cy: 60, r: 4, fill: C.ink2 }, a);
      const lever = el("line", { x1: x, y1: 60, x2: x + 48, y2: 60, stroke: C.ink, "stroke-width": 3, "stroke-linecap": "round" }, a);
      label(a, x + 25, 100, { raw: name }, { fill: C.ink2, "font-size": 14, "text-anchor": "middle" });
      return lever;
    }
    const la = sw(130, "A"), lb = sw(230, "B");
    const bulb = el("circle", { cx: 370, cy: 130, r: 17, fill: C.panel2, stroke: C.line2, "stroke-width": 2 }, a);
    label(a, 395, 176, "cpu.sw.lamp", { "text-anchor": "end" });
    label(a, 50, 236, "cpu.sw.caption", { fill: C.ink2, "font-size": 11.5, "letter-spacing": "0" });

    const st = { A: false, B: false };
    const aBtn = document.getElementById("aBtn"), bBtn = document.getElementById("bBtn"), andOut = document.getElementById("andOut");
    function drawAnd() {
      const setLever = (l, x, closed) => {
        const ang = closed ? 0 : -0.55;
        l.setAttribute("x2", x + 48 * Math.cos(ang)); l.setAttribute("y2", 60 + 48 * Math.sin(ang));
      };
      setLever(la, 130, st.A); setLever(lb, 230, st.B);
      const live = st.A && st.B;
      segs[0].setAttribute("stroke", C.signal);
      segs[1].setAttribute("stroke", st.A ? C.signal : C.line2);
      segs[2].setAttribute("stroke", live ? C.signal : C.line2);
      segs[3].setAttribute("stroke", live ? C.signal : C.line2);
      bulb.setAttribute("fill", live ? C.gold : C.panel2);
      bulb.setAttribute("stroke", live ? C.gold : C.line2);
      aBtn.textContent = t("cpu.sw.inA", { v: st.A ? 1 : 0 }); aBtn.setAttribute("aria-pressed", st.A);
      bBtn.textContent = t("cpu.sw.inB", { v: st.B ? 1 : 0 }); bBtn.setAttribute("aria-pressed", st.B);
      andOut.textContent = t("cpu.sw.and", { a: st.A ? 1 : 0, b: st.B ? 1 : 0, o: live ? 1 : 0 });
    }
    aBtn.addEventListener("click", () => { st.A = !st.A; drawAnd(); });
    bBtn.addEventListener("click", () => { st.B = !st.B; drawAnd(); });
    drawAnd(); onChange(drawAnd);
  })();

  (function dieMap() {
    const svg = document.getElementById("diemap");
    if (!svg) return;
    const die = Internals.cpu.die;
    const reg = Object.fromEntries(die.regions.map(r => [r.id, r]));
    el("rect", { x: 0, y: 0, width: die.w, height: die.h, rx: 1.2, fill: "#161b23", stroke: C.line2, "stroke-width": .4 }, svg);
    const groups = {};
    const txt = (g, x, y, size, key, vars) => bind(el("text", { x, y, "font-size": size, fill: C.ink, "text-anchor": "middle", "font-weight": 500 }, g), key, vars);
    die.blocks.forEach(([id, x, y, w, h], idx) => {
      const g = el("g", { "data-id": id, style: "cursor:pointer" }, svg);
      (groups[id] = groups[id] || []).push(g);
      const col = reg[id].color;
      el("rect", { x, y, width: w, height: h, rx: .6, fill: col, "fill-opacity": .2, stroke: col, "stroke-width": .35, class: "blk" }, g);
      if (id === "core") {
        const top = y < 40;
        el("rect", { x: x + 1.2, y: top ? y + h * .62 : y + 1.2, width: w - 2.4, height: h * .38 - 1.2, fill: C.violet, "fill-opacity": .22 }, g);
        el("text", { x: x + w / 2, y: top ? y + h * .62 + 5.4 : y + 5.6, "font-size": 2.3, fill: C.ink2, "text-anchor": "middle" }, g, "L2");
        el("rect", { x: x + 1.2, y: top ? y + h * .5 : y + h * .4 + 1, width: w - 2.4, height: 2.2, fill: C.violet, "fill-opacity": .35 }, g);
        txt(g, x + w / 2, top ? y + 8 : y + h - 6, 2.6, "cpu.die.coreN", { n: Math.floor(idx / 2) + (idx % 2) * 4 + 1 });
      } else if (id === "l3") {
        for (let i = x + 3; i < x + w; i += 3) el("line", { x1: i, y1: y + .5, x2: i, y2: y + h - .5, stroke: col, "stroke-opacity": .25, "stroke-width": .2 }, g);
        txt(g, x + w / 2, y + h / 2 + 1.2, 3.4, "cpu.die.l3.short");
      } else if (id === "gpu") {
        for (let i = 0; i < 4; i++) for (let j = 0; j < 5; j++)
          el("rect", { x: x + 2 + i * 8.2, y: y + 8 + j * 7.4, width: 7, height: 6.2, rx: .4, fill: col, "fill-opacity": .22 }, g);
        txt(g, x + w / 2, y + 5.2, 3, "cpu.die.gpu.short");
      } else {
        txt(g, x + w / 2, y + h / 2 + 1, 2.8, "cpu.die." + id + ".short");
      }
      g.addEventListener("click", () => select(id));
      g.addEventListener("mouseenter", () => select(id));
    });
    el("line", { x1: 0, y1: 86, x2: die.w, y2: 86, stroke: C.muted, "stroke-width": .3 }, svg);
    el("line", { x1: 0, y1: 84.5, x2: 0, y2: 87.5, stroke: C.muted, "stroke-width": .3 }, svg);
    el("line", { x1: die.w, y1: 84.5, x2: die.w, y2: 87.5, stroke: C.muted, "stroke-width": .3 }, svg);
    bind(el("text", { x: die.w / 2, y: 91, "font-size": 3, fill: C.muted, "text-anchor": "middle" }, svg), "cpu.die.scale");

    const legend = document.getElementById("dieLegend");
    const btns = {};
    die.regions.forEach(r => {
      const b = document.createElement("button");
      b.type = "button";
      const sw = document.createElement("i"); sw.style.background = r.color; b.appendChild(sw);
      bind(b.appendChild(document.createElement("span")), "cpu.die." + r.id);
      b.addEventListener("click", () => select(r.id));
      legend.appendChild(b); btns[r.id] = b;
    });
    let current = "core";
    function select(id) {
      current = id;
      const nameEl = document.getElementById("dieName");
      nameEl.textContent = t("cpu.die." + id);
      nameEl.style.color = reg[id].color;
      document.getElementById("dieBlurb").textContent = t("cpu.die." + id + ".blurb");
      document.getElementById("dieFact").textContent = t("cpu.die." + id + ".fact");
      for (const k in groups) groups[k].forEach(g => {
        g.querySelector(".blk").setAttribute("fill-opacity", k === id ? .5 : .12);
        g.style.opacity = k === id ? 1 : .6;
      });
      for (const k in btns) btns[k].setAttribute("aria-pressed", k === id);
    }
    select("core");
    onChange(() => select(current));
  })();

  (function sim() {
    const svg = document.getElementById("sim");
    if (!svg) return;
    const program = ["LOAD R1, [6]", "LOAD R2, [7]", "ADD R3, R1, R2", "STORE R3, [5]", "HALT"];
    const initMem = () => program.concat(["0", "7", "5"]);

    el("rect", { x: 16, y: 16, width: 470, height: 388, rx: 10, fill: C.panel, stroke: C.line2 }, svg);
    label(svg, 32, 40, "cpu.sim.cpu", { fill: C.copper, "font-size": 13, "letter-spacing": ".14em" });
    const cu = el("rect", { x: 36, y: 56, width: 208, height: 154, rx: 7, fill: C.ground, stroke: C.line2 }, svg);
    label(svg, 50, 76, "cpu.sim.cu");
    const box = (x, y, w, h, key) => {
      const r = el("rect", { x, y, width: w, height: h, rx: 5, fill: C.panel2, stroke: C.line2 }, svg);
      label(svg, x + 10, y + 15, key, { "font-size": 9.5 });
      const v = el("text", { x: x + 10, y: y + h - 9, fill: C.ink, "font-size": 14 }, svg, "");
      return { r, v };
    };
    const PC = box(50, 88, 180, 50, "cpu.sim.pc");
    const IR = box(50, 146, 180, 50, "cpu.sim.ir");
    const regBox = el("rect", { x: 260, y: 56, width: 208, height: 154, rx: 7, fill: C.ground, stroke: C.line2 }, svg);
    label(svg, 274, 76, "cpu.sim.regs");
    const regs = {};
    ["R1", "R2", "R3"].forEach((n, i) => {
      const y = 86 + i * 40;
      const r = el("rect", { x: 274, y, width: 180, height: 32, rx: 5, fill: C.panel2, stroke: C.line2 }, svg);
      label(svg, 286, y + 21, { raw: n }, { fill: C.ink2, "font-size": 12 });
      const v = el("text", { x: 440, y: y + 21, fill: C.ink, "font-size": 15, "text-anchor": "end" }, svg, "");
      regs[n] = { r, v };
    });
    const alu = el("polygon", { points: "120,246 230,246 250,272 270,246 380,246 332,372 168,372", fill: C.ground, stroke: C.line2, "stroke-width": 1.5 }, svg);
    el("text", { x: 250, y: 322, fill: C.ink, "font-size": 20, "text-anchor": "middle", "font-weight": 500 }, svg, "ALU");
    label(svg, 250, 340, "cpu.sim.alu", { "font-size": 8.5, "text-anchor": "middle" });
    const aluOp = el("text", { x: 250, y: 298, fill: C.signal, "font-size": 13, "text-anchor": "middle" }, svg, "");

    el("rect", { x: 496, y: 16, width: 50, height: 388, rx: 6, fill: C.ground, stroke: C.line }, svg);
    label(svg, 521, 210, "cpu.sim.bus", { "font-size": 10, "text-anchor": "middle", "letter-spacing": ".25em", transform: "rotate(-90 521 210)" });

    el("rect", { x: 556, y: 16, width: 188, height: 388, rx: 10, fill: C.panel, stroke: C.line2 }, svg);
    label(svg, 572, 40, "cpu.sim.ram", { fill: C.good, "font-size": 13, "letter-spacing": ".14em" });
    const rows = [];
    for (let i = 0; i < 8; i++) {
      const y = 52 + i * 43;
      const r = el("rect", { x: 568, y, width: 164, height: 38, rx: 5, fill: C.panel2, stroke: C.line }, svg);
      el("text", { x: 578, y: y + 24, fill: C.muted, "font-size": 11 }, svg, String(i));
      const v = el("text", { x: 598, y: y + 24, fill: C.ink2, "font-size": i < 5 ? 11.5 : 14 }, svg, "");
      rows.push({ r, v, y: y + 19 });
    }
    label(svg, 572, 399, "cpu.sim.ramNote", { "font-size": 9 });

    const pts = {
      PC: [230, 113], IR: [230, 171],
      R1: [364, 102], R2: [364, 142], R3: [364, 182],
      ALUL: [185, 250], ALUR: [315, 250], ALUO: [250, 372]
    };
    const ramPt = i => [568, rows[i].y];
    const packetLayer = el("g", {}, svg);

    function route(a, b) {
      const toRam = b[0] >= 560, fromRam = a[0] >= 560;
      if (toRam && !fromRam) return [a, [510, a[1]], [534, b[1]], b];
      if (fromRam && !toRam) return [a, [534, a[1]], [510, b[1]], b];
      return [a, b];
    }
    function fly(a, b, text, color) {
      const path = route(a, b);
      const g = el("g", {}, packetLayer);
      const w = Math.max(34, text.length * 7.6 + 16);
      el("rect", { x: -w / 2, y: -12, width: w, height: 24, rx: 12, fill: color || C.signal }, g);
      el("text", { x: 0, y: 4.5, "font-size": 12, "text-anchor": "middle", fill: C.ground, "font-weight": 600 }, g, text);
      const lens = []; let total = 0;
      for (let i = 1; i < path.length; i++) { const l = Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]); lens.push(l); total += l; }
      const dur = 520 + total * 1.1;
      return new Promise(res => {
        const t0 = performance.now();
        (function step(now) {
          const f = Math.min(1, (now - t0) / dur); const e = f < .5 ? 2 * f * f : 1 - Math.pow(-2 * f + 2, 2) / 2;
          let d = e * total, i = 0;
          while (i < lens.length - 1 && d > lens[i]) { d -= lens[i]; i++; }
          const p0 = path[i], p1 = path[i + 1], k = lens[i] ? d / lens[i] : 1;
          g.setAttribute("transform", `translate(${p0[0] + (p1[0] - p0[0]) * k},${p0[1] + (p1[1] - p0[1]) * k})`);
          if (f < 1) requestAnimationFrame(step); else { g.remove(); res(); }
        })(t0);
      });
    }
    const addr = n => t("cpu.sim.addr", { n });

    const code = document.getElementById("simCode");
    program.forEach((op, i) => {
      const li = document.createElement("li");
      const b = document.createElement("b"); b.textContent = i;
      const o = document.createElement("span"); o.textContent = op;
      const c = document.createElement("span"); c.className = "c"; bind(c, "cpu.sim.note" + i);
      li.append(b, o, c); code.appendChild(li);
    });

    let S;
    function resetState() { S = { pc: 0, ir: "", R1: null, R2: null, R3: null, mem: initMem(), step: 0, cur: -1, aluOp: "", shown: null }; }
    const phaseEls = [...document.querySelectorAll(".sim-phases span")];
    const title = document.getElementById("simTitle"), text = document.getElementById("simText"), count = document.getElementById("simCount");
    function hl(list) {
      [PC.r, IR.r, regs.R1.r, regs.R2.r, regs.R3.r, cu, regBox, alu].forEach(r => r.setAttribute("stroke", C.line2));
      rows.forEach(r => r.r.setAttribute("stroke", C.line));
      (list || []).forEach(r => r.setAttribute("stroke", C.copper));
    }
    function render(phase) {
      PC.v.textContent = S.pc; IR.v.textContent = S.ir || "—";
      ["R1", "R2", "R3"].forEach(n => regs[n].v.textContent = S[n] === null ? "—" : S[n]);
      rows.forEach((r, i) => { r.v.textContent = S.mem[i]; });
      rows[5].v.setAttribute("fill", S.mem[5] !== "0" ? C.gold : C.ink2);
      aluOp.textContent = S.aluOp;
      [...code.children].forEach((li, i) => li.classList.toggle("on", i === S.cur));
      phaseEls.forEach(p => p.classList.toggle("on", p.dataset.ph === phase));
      count.textContent = t("cpu.sim.count", { n: S.step, total: steps.length });
    }
    function explain() {
      const s = S.shown === null ? null : steps[S.shown];
      title.textContent = s ? t("cpu.sim.ph." + s.phase) : t("cpu.sim.ready");
      text.textContent = s ? t(s.key, s.vars) : t("cpu.sim.readyText");
    }

    function stepsFor(i) {
      const op = program[i];
      const fetch = {
        phase: "fetch", key: "cpu.sim.fetch", vars: { i, n: i + 1 },
        run: async () => {
          S.cur = i; render("fetch"); hl([PC.r, rows[i].r]);
          await fly(pts.PC, ramPt(i), addr(i), C.copper);
          hl([rows[i].r, IR.r]);
          await fly(ramPt(i), pts.IR, op);
          S.ir = op; S.pc = i + 1;
        }
      };
      const decode = {
        phase: "decode", key: "cpu.sim.dec" + i,
        run: async () => { hl([cu, IR.r]); await sleep(650); }
      };
      const exec = {
        phase: "execute", key: "cpu.sim.ex" + i,
        run: async () => {
          if (i === 0 || i === 1) {
            const a = i === 0 ? 6 : 7, R = i === 0 ? "R1" : "R2";
            hl([IR.r, rows[a].r]);
            await fly(pts.IR, ramPt(a), addr(a), C.copper);
            hl([rows[a].r, regs[R].r]);
            await fly(ramPt(a), pts[R], S.mem[a]);
            S[R] = Number(S.mem[a]);
          } else if (i === 2) {
            hl([regs.R1.r, regs.R2.r, alu]); S.aluOp = "7 + 5"; render("execute");
            await Promise.all([fly(pts.R1, pts.ALUL, String(S.R1)), fly(pts.R2, pts.ALUR, String(S.R2))]);
            S.aluOp = "7 + 5 = 12"; render("execute"); await sleep(400);
            hl([alu, regs.R3.r]);
            await fly(pts.ALUO, pts.R3, String(S.R1 + S.R2), C.gold);
            S.R3 = S.R1 + S.R2;
          } else if (i === 3) {
            hl([regs.R3.r, rows[5].r]);
            await fly(pts.R3, ramPt(5), String(S.R3), C.gold);
            S.mem[5] = String(S.R3);
          } else {
            hl([rows[5].r]); await sleep(300);
          }
        }
      };
      return [fetch, decode, exec];
    }
    const steps = program.flatMap((_, i) => stepsFor(i));

    const stepBtn = document.getElementById("simStep"), playBtn = document.getElementById("simPlay"), resetBtn = document.getElementById("simReset");
    let busy = false, playing = false, phase = null;
    function buttons() {
      const done = S.step >= steps.length;
      stepBtn.disabled = busy || done; playBtn.disabled = busy || done;
      playBtn.textContent = t(playing ? "cpu.sim.playing" : "cpu.sim.play");
    }
    async function doStep() {
      if (busy || S.step >= steps.length) return;
      busy = true; buttons();
      const s = steps[S.step];
      S.shown = S.step; phase = s.phase; explain();
      render(s.phase);
      await s.run();
      S.step++; render(s.phase);
      busy = false; buttons();
    }
    stepBtn.addEventListener("click", doStep);
    playBtn.addEventListener("click", async () => {
      playing = true; buttons();
      while (S.step < steps.length && playing) { await doStep(); await sleep(450); }
      playing = false; buttons();
    });
    resetBtn.addEventListener("click", () => {
      if (busy) { playing = false; return; }
      playing = false; resetState(); phase = null; hl([PC.r]); render(null); explain(); buttons();
    });
    resetState(); hl([PC.r]); render(null); explain(); buttons();
    onChange(() => { render(phase); explain(); buttons(); });
  })();

  (function clock() {
    const cv = document.getElementById("clockwave");
    if (!cv) return;
    const slider = document.getElementById("ghz"), val = document.getElementById("ghzVal"), read = document.getElementById("ghzRead");
    const g = cv.getContext("2d");
    let ghz = slider.value / 10, offset = 0, W = 0, H = 0;
    function size() {
      const dpr = Math.min(devicePixelRatio || 1, 2), r = cv.getBoundingClientRect();
      W = r.width; H = r.height; cv.width = W * dpr; cv.height = H * dpr; g.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    new ResizeObserver(size).observe(cv); size();
    function update() {
      ghz = slider.value / 10;
      val.textContent = num(ghz, 1) + " GHz";
      const parts = t("cpu.clk.read", { c: "\u0000c", ns: "\u0000ns", cm: "\u0000cm" }).split(/(\u0000\w+)/);
      const vals = { c: [num(ghz * 1e9), "k"], ns: [num(1 / ghz, 2), "s"], cm: [num(30 / ghz, 1), "s"] };
      read.textContent = "";
      parts.forEach(p => {
        if (p.startsWith("\u0000")) {
          const [v, cls] = vals[p.slice(1)]; const s = document.createElement("span"); s.className = cls; s.textContent = v; read.appendChild(s);
        } else read.appendChild(document.createTextNode(p));
      });
    }
    slider.addEventListener("input", update); update(); onChange(update);
    let visible = true;
    new IntersectionObserver(es => { visible = es[0].isIntersecting; }).observe(cv);
    let last = performance.now();
    (function draw(now) {
      requestAnimationFrame(draw);
      const dt = now - last; last = now;
      if (!visible || !W) return;
      const period = W / (ghz * 3);
      offset = (offset + dt * 0.04) % period;
      g.clearRect(0, 0, W, H);
      const top = 24, bot = H - 30;
      g.strokeStyle = C.line; g.lineWidth = 1; g.setLineDash([3, 5]);
      [top, bot].forEach(y => { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); });
      g.setLineDash([]);
      g.fillStyle = C.muted; g.font = "11px 'JetBrains Mono', monospace";
      g.fillText(t("cpu.clk.high"), 6, top - 8); g.fillText(t("cpu.clk.low"), 6, bot + 18);
      g.strokeStyle = C.signal; g.lineWidth = 2.5; g.beginPath();
      let x = -offset - period;
      g.moveTo(x, bot);
      while (x < W + period) {
        g.lineTo(x, top); g.lineTo(x + period / 2, top); g.lineTo(x + period / 2, bot); g.lineTo(x + period, bot); x += period;
      }
      g.stroke();
      let bx = -offset; while (bx < W * 0.55) bx += period;
      bx -= period;
      g.strokeStyle = C.copper; g.fillStyle = C.copper; g.lineWidth = 1.5;
      const by = (top + bot) / 2;
      g.beginPath(); g.moveTo(bx, by); g.lineTo(bx + period, by); g.stroke();
      g.beginPath(); g.moveTo(bx, by - 5); g.lineTo(bx, by + 5); g.moveTo(bx + period, by - 5); g.lineTo(bx + period, by + 5); g.stroke();
      const lbl = t("cpu.clk.cycle");
      g.fillText(lbl, bx + period / 2 - g.measureText(lbl).width / 2, by - 8);
    })(last);
  })();

  (function pipeline() {
    const table = document.getElementById("pipe");
    if (!table) return;
    const stages = [["F", C.copper], ["D", C.violet], ["E", C.signal], ["W", C.good]];
    const N = 6;
    let piped = true, time = Infinity, timer = null;
    const toggle = document.getElementById("pipeToggle"), play = document.getElementById("pipePlay");
    const cyclesEl = document.getElementById("pipeCycles"), ipcEl = document.getElementById("pipeIpc");
    const total = () => piped ? N + stages.length - 1 : N * stages.length;
    function stageAt(i, c) { const s = piped ? c - i : c - i * stages.length; return s >= 0 && s < stages.length ? s : -1; }
    const esc = s => s.replace(/[&<>"]/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch]));
    function draw() {
      const T = total(), cols = N * stages.length;
      let h = `<thead><tr><th class='row'>${esc(t("cpu.pipe.cycle"))}</th>`;
      for (let c = 0; c < cols; c++) h += `<th>${c + 1}</th>`;
      h += "</tr></thead><tbody>";
      for (let i = 0; i < N; i++) {
        h += `<tr><th class="row">${esc(t("cpu.pipe.instr", { n: i + 1 }))}</th>`;
        for (let c = 0; c < cols; c++) {
          const s = stageAt(i, c);
          const show = s >= 0 && c < time;
          const key = show ? "cpu.pipe." + stages[s][0] : "";
          h += `<td class="${c === time - 1 && time <= T ? "now" : ""}" style="${show ? "background:" + stages[s][1] : ""}" title="${show ? esc(t(key + ".name")) : ""}">${show ? esc(t(key)) : ""}</td>`;
        }
        h += "</tr>";
      }
      h += `</tbody><caption style="caption-side:bottom;text-align:left;padding-top:12px;color:${C.muted};font-size:12px">` +
        stages.map(s => `<span style="display:inline-flex;align-items:center;gap:6px;margin-right:16px"><i style="width:10px;height:10px;border-radius:2px;background:${s[1]}"></i>${esc(t("cpu.pipe." + s[0]))} = ${esc(t("cpu.pipe." + s[0] + ".name"))}</span>`).join("") + "</caption>";
      table.innerHTML = h;
      cyclesEl.textContent = Math.min(time, T);
      ipcEl.textContent = time >= T ? num(N / T, 2) : "…";
      toggle.textContent = t(piped ? "cpu.pipe.on" : "cpu.pipe.off");
      toggle.setAttribute("aria-pressed", piped);
    }
    function run() {
      clearInterval(timer); time = 0; draw();
      timer = setInterval(() => { time++; draw(); if (time >= total()) clearInterval(timer); }, 260);
    }
    toggle.addEventListener("click", () => { piped = !piped; run(); });
    play.addEventListener("click", run);
    draw(); onChange(draw);
  })();

  (function ladder() {
    const box = document.getElementById("ladder");
    if (!box) return;
    const levels = [
      { id: "reg", cyc: 1, ns: 0.2, c: C.copper },
      { id: "l1", cyc: 5, ns: 1, c: C.violet },
      { id: "l2", cyc: 15, ns: 3, c: C.violet },
      { id: "l3", cyc: 50, ns: 10, c: C.violet },
      { id: "ram", cyc: 400, ns: 80, c: C.good },
      { id: "ssd", cyc: 400000, ns: 80000, c: C.gold }
    ];
    const realTime = ns => ns >= 1000 ? num(ns / 1000, 0) + " µs" : num(ns, ns < 1 ? 1 : 0) + " ns";
    const maxL = Math.log10(400000) + 0.3;
    const fills = levels.map(l => {
      const row = document.createElement("div"); row.className = "rung"; row.style.setProperty("--c", l.c);
      row.innerHTML = `<div class="nm"><span></span><small></small></div>
        <div class="track"><div class="fill"></div></div>
        <div class="t"><b></b><span></span></div>`;
      bind(row.querySelector(".nm span"), "cpu.mem." + l.id);
      bind(row.querySelector(".nm small"), "cpu.mem." + l.id + ".sub");
      bind(row.querySelector(".t span"), "cpu.mem." + l.id + ".h");
      const b = row.querySelector(".t b");
      const setReal = () => {
        const cyc = t(plural(l.cyc, { one: "cpu.mem.cycle.one", other: "cpu.mem.cycle.other" }), { n: num(l.cyc) });
        b.textContent = realTime(l.ns) + " · " + cyc;
      };
      setReal(); onChange(setReal);
      box.appendChild(row);
      const f = row.querySelector(".fill");
      const pct = (Math.log10(l.cyc) + 0.3) / maxL * 100;
      f.style.width = pct + "%";
      return { f, pct, l };
    });
    document.getElementById("raceBtn").addEventListener("click", () => {
      fills.forEach(({ f, pct, l }) => {
        f.style.transition = "none"; f.style.width = "0%";
        void f.offsetWidth;
        const dur = 250 + (Math.log10(l.cyc) + 0.3) * 520;
        f.style.transition = `width ${dur}ms linear`; f.style.width = pct + "%";
      });
    });
  })();

  (function cores() {
    const grid = document.getElementById("coresGrid");
    if (!grid) return;
    const btnBox = document.getElementById("coreBtns"), serialBtn = document.getElementById("serialBtn");
    const runBtn = document.getElementById("coresRun"), read = document.getElementById("coresRead");
    const SCALE = 20, TASKS = 16, SERIAL = 4;
    let n = 4, serial = false, anim = null, running = false, result = null;
    const counts = [1, 2, 4, 8];
    const coreWord = k => t(plural(k, { one: "cpu.cores.n.one", few: "cpu.cores.n.few", other: "cpu.cores.n.other" }), { n: k });
    const btns = counts.map(k => {
      const b = document.createElement("button"); b.type = "button"; b.className = "btn";
      b.textContent = coreWord(k);
      b.addEventListener("click", () => { n = k; build(true); }); btnBox.appendChild(b); return b;
    });
    function labels() {
      btns.forEach((b, i) => { b.textContent = coreWord(counts[i]); b.setAttribute("aria-pressed", counts[i] === n); });
      serialBtn.setAttribute("aria-pressed", serial);
      serialBtn.textContent = t(serial ? "cpu.cores.serialOn" : "cpu.cores.serialOff");
      grid.querySelectorAll(".lbl").forEach((s, c) => { s.textContent = t("cpu.cores.lane", { n: c + 1 }); });
      if (running) read.textContent = t("cpu.cores.running");
      else if (result) {
        const parts = t("cpu.cores.read", { t: "\u0000t", x: "\u0000x" }).split(/(\u0000\w)/);
        read.textContent = "";
        parts.forEach(p => {
          if (p === "\u0000t" || p === "\u0000x") {
            const s = document.createElement("span"); s.className = p === "\u0000t" ? "k" : "s";
            s.textContent = p === "\u0000t" ? num(result.T) : num(result.x, 1); read.appendChild(s);
          } else read.appendChild(document.createTextNode(p));
        });
      }
    }
    function plan() {
      const jobs = []; const start = serial ? SERIAL : 0;
      if (serial) jobs.push({ core: 0, s: 0, e: SERIAL, serial: true });
      for (let k = 0; k < TASKS; k++) { const core = k % n, slot = Math.floor(k / n); jobs.push({ core, s: start + slot, e: start + slot + 1 }); }
      return jobs;
    }
    function build(animate) {
      grid.innerHTML = "";
      const lanes = [];
      for (let c = 0; c < n; c++) {
        const row = document.createElement("div"); row.className = "core-row";
        row.innerHTML = `<span class="lbl"></span><div class="lane"></div>`;
        grid.appendChild(row); lanes.push(row.querySelector(".lane"));
      }
      const jobs = plan();
      const T = Math.max(...jobs.map(j => j.e));
      const nodes = jobs.map(j => {
        const d = document.createElement("div"); d.className = "job" + (j.serial ? " serial" : "");
        d.style.left = `calc(${j.s / SCALE * 100}% + 1.5px)`; d.style.width = `calc(${(j.e - j.s) / SCALE * 100}% - 3px)`;
        lanes[j.core].appendChild(d); return { d, j };
      });
      const one = serial ? SERIAL + TASKS : TASKS;
      result = { T, x: one / T };
      cancelAnimationFrame(anim);
      if (!animate) { running = false; nodes.forEach(x => x.d.classList.add("done")); labels(); return; }
      running = true; labels();
      const t0 = performance.now();
      (function tick(now) {
        const u = (now - t0) / 160;
        nodes.forEach(x => x.d.classList.toggle("done", x.j.e <= u));
        if (u < T) anim = requestAnimationFrame(tick); else { running = false; labels(); }
      })(t0);
    }
    serialBtn.addEventListener("click", () => { serial = !serial; build(true); });
    runBtn.addEventListener("click", () => build(true));
    build(false); onChange(labels);
  })();

  (function quiz() {
    const box = document.getElementById("quizBox");
    if (!box) return;
    const answers = [0, 2, 1, 1];
    const picked = answers.map(() => null);
    const cards = answers.map((right, qi) => {
      const k = "cpu.quiz.q" + (qi + 1);
      const d = document.createElement("div"); d.className = "q";
      d.innerHTML = `<p class="mono fineprint"></p><p class="ask"></p><div class="opts"></div><p class="why" hidden></p>`;
      bind(d.querySelector(".fineprint"), "cpu.quiz.n", { n: qi + 1, total: answers.length });
      bind(d.querySelector(".ask"), k);
      const opts = d.querySelector(".opts"), why = d.querySelector(".why");
      const buttons = [0, 1, 2].map(ai => {
        const b = document.createElement("button"); b.type = "button";
        bind(b, k + ".a" + ai);
        b.addEventListener("click", () => { picked[qi] = ai; show(); });
        opts.appendChild(b); return b;
      });
      function show() {
        const p = picked[qi];
        buttons.forEach((b, ai) => { b.classList.toggle("right", p === ai && ai === right); b.classList.toggle("wrong", p === ai && ai !== right); });
        if (p === null) return;
        why.hidden = false;
        why.textContent = p === right ? t("cpu.quiz.right", { why: t(k + ".why") }) : t("cpu.quiz.wrong");
      }
      box.appendChild(d);
      return show;
    });
    onChange(() => cards.forEach(show => show()));
  })();
})();
