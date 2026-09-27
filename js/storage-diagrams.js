(function () {
  const { t, num, bind, onChange } = Internals.i18n;
  const { C, el, label, rich, loop, quiz } = Internals.ui;

  (function hddSsd() {
    const svg = document.getElementById("stoHdd");
    if (!svg) return;
    const cx = 145, cy = 180, R = 104;
    let seed = 5; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

    el("rect", { x: 16, y: 36, width: 290, height: 284, rx: 12, fill: C.panel, stroke: C.line2 }, svg);
    label(svg, 16, 24, "sto.hdd.hdd", { fill: C.ink2, "font-size": 12 });
    const hddCount = el("text", { x: 16, y: 342, fill: C.ink2, "font-size": 12 }, svg, "");
    const platter = el("g", {}, svg);
    el("circle", { cx, cy, r: R, fill: "#1b2230", stroke: C.line2 }, platter);
    for (let r = 34; r <= 100; r += 11) el("circle", { cx, cy, r, fill: "none", stroke: C.line, "stroke-width": 1 }, platter);
    el("line", { x1: cx, y1: cy - R, x2: cx, y2: cy - 30, stroke: C.line2, "stroke-width": 1 }, platter);
    const tracks = [34, 45, 56, 67, 78, 89, 100];
    const files = [];
    for (let i = 0; i < 8; i++) {
      const r = tracks[Math.floor(rnd() * tracks.length)], a = rnd() * Math.PI * 2;
      files.push({ r, a, dot: el("circle", { cx: cx + r * Math.cos(a), cy: cy + r * Math.sin(a), r: 4.5, fill: C.good }, platter) });
    }
    el("circle", { cx, cy, r: 20, fill: C.panel2, stroke: C.line2 }, svg);
    label(svg, cx, cy + 4, "sto.hdd.platter", { "text-anchor": "middle", "font-size": 8.5 });
    const px = 282, py = 300, L = 150, D = Math.hypot(cx - px, cy - py), th0 = Math.atan2(cy - py, cx - px);
    const armAngle = r => th0 + Math.acos(Math.min(1, Math.max(-1, (D * D + L * L - r * r) / (2 * D * L))));
    const arm = el("line", { x1: px, y1: py, x2: px, y2: py, stroke: C.ink2, "stroke-width": 5, "stroke-linecap": "round" }, svg);
    const head = el("circle", { r: 6, fill: C.copper }, svg);
    el("circle", { cx: px, cy: py, r: 10, fill: C.panel2, stroke: C.ink2, "stroke-width": 2 }, svg);
    label(svg, px - 16, py + 4, "sto.hdd.arm", { "text-anchor": "end", "font-size": 9 });

    el("rect", { x: 334, y: 36, width: 290, height: 284, rx: 12, fill: C.panel, stroke: C.line2 }, svg);
    label(svg, 334, 24, "sto.hdd.ssd", { fill: C.ink2, "font-size": 12 });
    const ssdCount = el("text", { x: 334, y: 342, fill: C.ink2, "font-size": 12 }, svg, "");
    const blocks = [];
    for (let chip = 0; chip < 4; chip++) {
      const bx = 352 + (chip % 2) * 134, by = 58 + Math.floor(chip / 2) * 120;
      el("rect", { x: bx, y: by, width: 120, height: 104, rx: 6, fill: C.ground, stroke: C.line2 }, svg);
      for (let i = 0; i < 6; i++) for (let j = 0; j < 5; j++)
        blocks.push(el("rect", { x: bx + 8 + i * 18, y: by + 8 + j * 18.5, width: 14, height: 14.5, rx: 2, fill: C.panel2 }, svg));
    }
    label(svg, 479, 306, "sto.hdd.chips", { "text-anchor": "middle", "font-size": 9 });
    const ssdFiles = [];
    while (ssdFiles.length < 8) { const k = Math.floor(rnd() * blocks.length); if (!ssdFiles.includes(k)) ssdFiles.push(k); }

    const st = { rot: 0, arm: armAngle(67), running: false, idx: 8, ssdIdx: 8, ssdT: 0 };
    function counts() {
      hddCount.textContent = st.idx >= 8 ? t("sto.hdd.done", { ms: num(96) }) : t("sto.hdd.count", { n: st.idx });
      ssdCount.textContent = st.ssdIdx >= 8 ? t("sto.hdd.done", { ms: num(0.8, 1) }) : t("sto.hdd.count", { n: st.ssdIdx });
    }
    function paintFiles() {
      files.forEach((f, i) => f.dot.setAttribute("fill", i < st.idx ? C.good : C.copper));
      blocks.forEach(b => b.setAttribute("fill", C.panel2));
      ssdFiles.forEach((k, i) => blocks[k].setAttribute("fill", i < st.ssdIdx ? C.good : C.copper));
    }
    paintFiles(); counts(); onChange(counts);
    document.getElementById("stoHddRun").addEventListener("click", () => {
      st.idx = 0; st.ssdIdx = 0; st.ssdT = 0; st.running = true; paintFiles(); counts();
    });
    const norm = a => { a = (a + Math.PI) % (Math.PI * 2); if (a < 0) a += Math.PI * 2; return a - Math.PI; };
    loop(svg, dt => {
      st.rot += dt * (Math.PI * 2 / 1.4);
      platter.setAttribute("transform", `rotate(${st.rot * 180 / Math.PI} ${cx} ${cy})`);
      if (st.running && st.idx < 8) {
        const f = files[st.idx], target = armAngle(f.r);
        const d = target - st.arm, maxStep = dt * 1.6;
        st.arm += Math.abs(d) < maxStep ? d : Math.sign(d) * maxStep;
        if (Math.abs(target - st.arm) < 1e-3) {
          const hx = px + L * Math.cos(st.arm), hy = py + L * Math.sin(st.arm);
          const ah = Math.atan2(hy - cy, hx - cx);
          if (Math.abs(norm(f.a + st.rot - ah)) < 0.12) { st.idx++; paintFiles(); counts(); }
        }
      }
      if (st.running && st.ssdIdx < 8) {
        st.ssdT += dt;
        const n = Math.min(8, Math.floor(st.ssdT / 0.07));
        if (n !== st.ssdIdx) { st.ssdIdx = n; paintFiles(); counts(); }
      }
      if (st.idx >= 8 && st.ssdIdx >= 8) st.running = false;
      const hx = px + L * Math.cos(st.arm), hy = py + L * Math.sin(st.arm);
      arm.setAttribute("x2", hx); arm.setAttribute("y2", hy);
      head.setAttribute("cx", hx); head.setAttribute("cy", hy);
    });
  })();

  (function cell() {
    const svg = document.getElementById("stoCell");
    if (!svg) return;
    const types = [["SLC", 1, 100000], ["MLC", 2, 10000], ["TLC", 3, 3000], ["QLC", 4, 1000]];
    let type = 2, level = 5, shown = 0;

    el("rect", { x: 20, y: 226, width: 290, height: 80, rx: 4, fill: "#241f33" }, svg);
    el("rect", { x: 36, y: 226, width: 70, height: 34, fill: "#2e4a68" }, svg);
    el("rect", { x: 224, y: 226, width: 70, height: 34, fill: "#2e4a68" }, svg);
    label(svg, 165, 280, "sto.cell.ch", { "text-anchor": "middle", "font-size": 10 });
    el("rect", { x: 104, y: 212, width: 122, height: 14, fill: "#8593a5" }, svg);
    el("rect", { x: 104, y: 168, width: 122, height: 44, rx: 2, fill: "#343947", stroke: C.copper, "stroke-width": 1.5 }, svg);
    label(svg, 165, 164 + 58, "sto.cell.ins", { "text-anchor": "middle", "font-size": 8, fill: C.ground });
    el("rect", { x: 104, y: 154, width: 122, height: 14, fill: "#8593a5" }, svg);
    el("rect", { x: 104, y: 110, width: 122, height: 44, rx: 3, fill: "#5b6778" }, svg);
    label(svg, 165, 136, "sto.cell.cg", { "text-anchor": "middle", "font-size": 9.5, fill: C.ink });
    label(svg, 234, 194, "sto.cell.fg", { "font-size": 9.5, fill: C.copper });
    el("line", { x1: 165, y1: 110, x2: 165, y2: 84, stroke: C.line2, "stroke-width": 3 }, svg);
    el("circle", { cx: 165, cy: 80, r: 6, fill: C.panel2, stroke: C.line2, "stroke-width": 2 }, svg);
    const valueTx = el("text", { x: 20, y: 40, fill: C.gold, "font-size": 20, "font-weight": 600 }, svg, "");
    const slots = [];
    for (let j = 0; j < 3; j++) for (let i = 0; i < 5; i++) slots.push([116 + i * 24, 179 + j * 12]);
    const electrons = slots.map(([x, y]) => el("circle", { cx: x, cy: y, r: 4.2, fill: C.signal, opacity: 0 }, svg));

    label(svg, 350, 30, "sto.cell.levels", { "font-size": 10 });
    const lv = el("g", {}, svg);
    const readout = document.getElementById("stoCellRead");
    const Y0 = 44, HH = 256;
    function bitsOf(i, b) { const L = 1 << b; return (L - 1 - i).toString(2).padStart(b, "0"); }
    function drawLevels() {
      lv.textContent = "";
      const [name, b] = types[type], L = 1 << b, h = HH / L;
      for (let i = 0; i < L; i++) {
        const y = Y0 + HH - (i + 1) * h;
        const on = i === level;
        el("rect", { x: 350, y: y + 1, width: 230, height: h - 2, rx: Math.min(4, h / 4), fill: on ? C.copper : C.panel, stroke: on ? C.copper : C.line }, lv);
        el("text", { x: 465, y: y + h / 2 + 4, "font-size": Math.min(12, h * .62), "text-anchor": "middle", fill: on ? C.ground : C.ink2, "font-weight": on ? 600 : 400 }, lv, bitsOf(i, b));
      }
      valueTx.textContent = t("sto.cell.value", { v: bitsOf(level, b) });
      rich(readout, "sto.cell.read", { name: [name, "k"], b: [String(b), "s"], l: [String(L), "s"], c: [num(types[type][2]), "s"] });
    }
    const target = () => { const L = 1 << types[type][1]; return Math.round(level / (L - 1) * slots.length); };
    function paintElectrons() { electrons.forEach((e, i) => e.setAttribute("opacity", i < shown ? 1 : 0)); }

    const typeBox = document.getElementById("stoCellTypes");
    const tbs = types.map(([name], i) => {
      const b = document.createElement("button"); b.type = "button"; b.className = "btn"; b.textContent = name;
      b.addEventListener("click", () => { type = i; level = Math.min(level, (1 << types[i][1]) - 1); pick(); });
      typeBox.appendChild(b); return b;
    });
    function pick() { tbs.forEach((b, i) => b.setAttribute("aria-pressed", i === type)); drawLevels(); }
    document.getElementById("stoCellStore").addEventListener("click", () => {
      const L = 1 << types[type][1]; let n; do { n = Math.floor(Math.random() * L); } while (n === level && L > 1); level = n; drawLevels();
    });
    pick(); shown = target(); paintElectrons();
    onChange(drawLevels);
    let acc = 0;
    loop(svg, dt => {
      const goal = target();
      if (shown === goal) return;
      acc += dt;
      if (acc > .05) { acc = 0; shown += Math.sign(goal - shown); paintElectrons(); }
    });
  })();

  (function speed() {
    const box = document.getElementById("stoSpeed");
    if (!box) return;
    const rows = [["hdd", 200, C.gold], ["sata", 550, C.violet], ["g3", 3500, C.signal], ["g4", 7000, C.signal], ["g5", 14000, C.good]];
    const fills = rows.map(([id, mbs, col]) => {
      const secs = 10000 / mbs;
      const row = document.createElement("div"); row.className = "rung"; row.style.setProperty("--c", col);
      row.innerHTML = `<div class="nm"><span></span><small></small></div><div class="track"><div class="fill" style="width:100%"></div></div><div class="t"><b></b></div>`;
      bind(row.querySelector(".nm span"), "sto.speed." + id);
      bind(row.querySelector(".nm small"), "sto.speed." + id + ".sub");
      const tb = row.querySelector(".t b");
      const setT = () => { tb.textContent = t("sto.speed.row", { s: num(mbs), t: num(secs, secs >= 10 ? 0 : 1) }); };
      setT(); onChange(setT);
      box.appendChild(row);
      return { f: row.querySelector(".fill"), secs };
    });
    document.getElementById("stoSpeedRun").addEventListener("click", () => {
      fills.forEach(({ f, secs }) => {
        f.style.transition = "none"; f.style.width = "0%"; void f.offsetWidth;
        f.style.transition = `width ${secs * 100}ms linear`; f.style.width = "100%";
      });
    });
  })();

  const box = document.getElementById("stoQuiz");
  if (box) quiz(box, "sto.quiz", [0, 1, 2]);
})();
