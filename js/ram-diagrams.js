(function () {
  const { t, num, bind, onChange } = Internals.i18n;
  const { C, el, label, rich, loop, canvas2d, quiz, sleep } = Internals.ui;

  (function grid() {
    const svg = document.getElementById("ramGrid");
    if (!svg) return;
    const N = 8, CS = 34, X0 = 120, Y0 = 30, BY = 322;
    let seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const bits = []; for (let r = 0; r < N; r++) { bits.push([]); for (let c = 0; c < N; c++) bits[r].push(rnd() > .5 ? 1 : 0); }

    el("rect", { x: 20, y: Y0, width: 80, height: N * CS, rx: 6, fill: C.panel, stroke: C.line2 }, svg);
    label(svg, 60, Y0 + N * CS / 2, "ram.grid.rowdec", { "text-anchor": "middle", "font-size": 10, transform: `rotate(-90 60 ${Y0 + N * CS / 2})` });
    const rowNums = [];
    for (let r = 0; r < N; r++) rowNums.push(el("text", { x: 92, y: Y0 + r * CS + 22, fill: C.muted, "font-size": 11, "text-anchor": "end" }, svg, r));
    for (let c = 0; c < N; c++) el("text", { x: X0 + c * CS + CS / 2, y: Y0 - 8, fill: C.muted, "font-size": 11, "text-anchor": "middle" }, svg, c);

    const cellEls = [];
    for (let r = 0; r < N; r++) {
      cellEls.push([]);
      for (let c = 0; c < N; c++) {
        const x = X0 + c * CS, y = Y0 + r * CS, v = bits[r][c];
        const g = el("g", {}, svg);
        el("rect", { x: x + 2, y: y + 2, width: CS - 4, height: CS - 4, rx: 4, fill: v ? C.signal : C.panel, "fill-opacity": v ? .75 : 1 }, g);
        el("text", { x: x + CS / 2, y: y + 22, "font-size": 12, "text-anchor": "middle", fill: v ? C.ground : C.muted }, g, v);
        cellEls[r].push(g);
      }
    }
    const rowHi = el("rect", { x: X0, y: Y0, width: N * CS, height: CS, rx: 5, fill: "none", stroke: C.copper, "stroke-width": 2.5, opacity: 0 }, svg);
    const buf = [];
    for (let c = 0; c < N; c++) {
      const x = X0 + c * CS;
      const r = el("rect", { x: x + 2, y: BY, width: CS - 4, height: CS - 4, rx: 4, fill: C.panel2, stroke: C.line2 }, svg);
      const tx = el("text", { x: x + CS / 2, y: BY + 20, "font-size": 12, "text-anchor": "middle", fill: C.ink }, svg, "");
      buf.push({ r, tx });
    }
    label(svg, X0, BY + 50, "ram.grid.buffer", { "font-size": 10 });
    label(svg, X0 + N * CS, BY + 50, "ram.grid.coldec", { "font-size": 10, "text-anchor": "end" });
    const colHi = el("rect", { x: X0, y: BY - 2, width: CS, height: CS, rx: 5, fill: "none", stroke: C.copper, "stroke-width": 2.5, opacity: 0 }, svg);
    el("rect", { x: 430, y: BY - 4, width: 80, height: 38, rx: 6, fill: C.ground, stroke: C.line2 }, svg);
    label(svg, 470, BY - 12, "ram.grid.out", { "font-size": 10, "text-anchor": "middle" });
    const outTx = el("text", { x: 470, y: BY + 21, "font-size": 20, "text-anchor": "middle", fill: C.gold, "font-weight": 600 }, svg, "");
    const fx = el("g", {}, svg);

    function fly(x1, y1, x2, y2, v, dur) {
      const dot = el("circle", { cx: x1, cy: y1, r: 7, fill: v ? C.signal : C.muted }, fx);
      return new Promise(res => {
        const t0 = performance.now();
        (function f(now) {
          const k = Math.min(1, (now - t0) / dur), e = k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
          dot.setAttribute("cx", x1 + (x2 - x1) * e); dot.setAttribute("cy", y1 + (y2 - y1) * e);
          if (k < 1) requestAnimationFrame(f); else { dot.remove(); res(); }
        })(t0);
      });
    }

    const rowSel = document.getElementById("ramRow"), colSel = document.getElementById("ramCol");
    for (let i = 0; i < N; i++) { rowSel.add(new Option(i, i)); colSel.add(new Option(i, i)); }
    rowSel.value = 2; colSel.value = 5;
    const resEl = document.getElementById("ramGridResult"), textEl = document.getElementById("ramGridText");
    const st = { open: null, r: 2, c: 5, v: null, msg: ["ram.grid.s0"] };
    function text() {
      resEl.textContent = st.v === null ? "" : t("ram.grid.result", { r: st.r, c: st.c, v: st.v });
      textEl.textContent = st.msg.map(k => t(k)).join(" ");
    }
    function setRow(r) {
      rowHi.setAttribute("y", Y0 + r * CS); rowHi.setAttribute("opacity", 1);
      rowNums.forEach((n, i) => n.setAttribute("fill", i === r ? C.copper : C.muted));
      buf.forEach((b, c) => { b.tx.textContent = bits[r][c]; b.r.setAttribute("fill", bits[r][c] ? C.signal : C.panel2); b.r.setAttribute("fill-opacity", bits[r][c] ? .5 : 1); });
    }
    function setCol(c) { colHi.setAttribute("x", X0 + c * CS); colHi.setAttribute("opacity", 1); }
    setRow(2); setCol(5); st.open = 2; st.v = bits[2][5]; outTx.textContent = st.v; text();
    onChange(text);

    let busy = false;
    const readBtn = document.getElementById("ramRead");
    readBtn.addEventListener("click", async () => {
      if (busy) return; busy = true; readBtn.disabled = true;
      const r = +rowSel.value, c = +colSel.value;
      st.r = r; st.c = c; st.v = null; outTx.textContent = ""; colHi.setAttribute("opacity", 0);
      if (st.open !== r) {
        st.msg = ["ram.grid.s1"]; text();
        buf.forEach(b => { b.tx.textContent = ""; b.r.setAttribute("fill", C.panel2); b.r.setAttribute("fill-opacity", 1); });
        rowHi.setAttribute("y", Y0 + r * CS); rowHi.setAttribute("opacity", 1);
        rowNums.forEach((n, i) => n.setAttribute("fill", i === r ? C.copper : C.muted));
        await sleep(350);
        await Promise.all(bits[r].map((v, k) => fly(X0 + k * CS + CS / 2, Y0 + r * CS + CS / 2, X0 + k * CS + CS / 2, BY + 15, v, 650)));
        setRow(r); st.open = r;
        await sleep(300);
        st.msg = ["ram.grid.s1", "ram.grid.s2"];
      } else st.msg = ["ram.grid.s3", "ram.grid.s2"];
      text();
      setCol(c);
      await sleep(350);
      await fly(X0 + c * CS + CS / 2, BY + 15, 470, BY + 15, bits[r][c], 600);
      st.v = bits[r][c]; outTx.textContent = st.v; text();
      busy = false; readBtn.disabled = false;
    });
  })();

  (function refresh() {
    const svg = document.getElementById("ramRefresh");
    if (!svg) return;
    const glyphs = {
      R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
      A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
      M: ["10001", "11011", "10101", "10101", "10001", "10001", "10001"]
    };
    const COLS = 19, ROWS = 9, CS = 26, X0 = 43, Y0 = 16;
    const truth = [];
    for (let r = 0; r < ROWS; r++) { truth.push(new Array(COLS).fill(0)); }
    ["R", "A", "M"].forEach((ch, i) => glyphs[ch].forEach((line, r) => [...line].forEach((b, c) => { truth[r + 1][1 + i * 6 + c] = +b; })));
    const charge = truth.map(row => row.map(v => v));
    const cells = [];
    for (let r = 0; r < ROWS; r++) {
      cells.push([]);
      for (let c = 0; c < COLS; c++) {
        el("rect", { x: X0 + c * CS + 2, y: Y0 + r * CS + 2, width: CS - 4, height: CS - 4, rx: 3, fill: C.panel }, svg);
        cells[r].push(el("rect", { x: X0 + c * CS + 2, y: Y0 + r * CS + 2, width: CS - 4, height: CS - 4, rx: 3, fill: C.signal, opacity: 0 }, svg));
      }
    }
    const rowMark = el("rect", { x: X0 - 1, y: Y0, width: COLS * CS + 2, height: CS, rx: 4, fill: "none", stroke: C.copper, "stroke-width": 2, opacity: 0 }, svg);
    const arrow = el("polygon", { points: "0,-6 10,0 0,6", fill: C.copper, opacity: 0 }, svg);
    label(svg, X0, Y0 + ROWS * CS + 28, "ram.ref.scale", { "font-size": 11, "letter-spacing": "0" });

    let refreshOn = true, power = true, row = 0, acc = 0;
    const refBtn = document.getElementById("ramRefBtn"), powBtn = document.getElementById("ramPowerBtn"), kept = document.getElementById("ramKept");
    function labels() {
      refBtn.textContent = t(refreshOn ? "ram.ref.on" : "ram.ref.off"); refBtn.setAttribute("aria-pressed", refreshOn);
      powBtn.textContent = t(power ? "ram.ref.powerOn" : "ram.ref.powerOff"); powBtn.setAttribute("aria-pressed", power);
    }
    function keptPct() {
      let ones = 0, ok = 0;
      for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (truth[r][c]) { ones++; if (charge[r][c] > .5) ok++; }
      return Math.round(ok / ones * 100);
    }
    function paint() {
      for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) cells[r][c].setAttribute("opacity", (charge[r][c] * .85).toFixed(3));
      const on = refreshOn && power;
      rowMark.setAttribute("opacity", on ? 1 : 0); arrow.setAttribute("opacity", on ? 1 : 0);
      rowMark.setAttribute("y", Y0 + row * CS);
      arrow.setAttribute("transform", `translate(${X0 - 16},${Y0 + row * CS + CS / 2})`);
      kept.textContent = t("ram.ref.kept", { p: keptPct() });
    }
    refBtn.addEventListener("click", () => { refreshOn = !refreshOn; labels(); paint(); });
    powBtn.addEventListener("click", () => { power = !power; labels(); paint(); });
    document.getElementById("ramWrite").addEventListener("click", () => {
      for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) charge[r][c] = truth[r][c];
      paint();
    });
    labels(); paint();
    onChange(() => { labels(); paint(); });
    loop(svg, dt => {
      const leak = power ? .33 : 1.6;
      for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) charge[r][c] = Math.max(0, charge[r][c] - dt * leak * (0.8 + ((r * 7 + c * 3) % 5) * .1));
      if (refreshOn && power) {
        acc += dt;
        while (acc > .11) {
          acc -= .11;
          for (let c = 0; c < COLS; c++) charge[row][c] = charge[row][c] > .5 ? 1 : 0;
          row = (row + 1) % ROWS;
        }
      }
      paint();
    });
  })();

  (function ddr() {
    const cv = document.getElementById("ramDdr");
    if (!cv) return;
    const s = canvas2d(cv);
    const speeds = [["DDR4-3200", 3200], ["DDR5-6000", 6000], ["DDR5-8000", 8000]];
    let mt = 6000, ch = 2, off = 0;
    const speedBox = document.getElementById("ramSpeeds"), chBox = document.getElementById("ramChannels"), out = document.getElementById("ramBw");
    const sb = speeds.map(([name, v]) => {
      const b = document.createElement("button"); b.type = "button"; b.className = "btn"; b.textContent = name;
      b.addEventListener("click", () => { mt = v; update(); }); speedBox.appendChild(b); return [b, v];
    });
    const cb = [1, 2].map(n => {
      const b = document.createElement("button"); b.type = "button"; b.className = "btn"; bind(b, "ram.ddr.ch" + n);
      b.addEventListener("click", () => { ch = n; update(); }); chBox.appendChild(b); return [b, n];
    });
    function update() {
      sb.forEach(([b, v]) => b.setAttribute("aria-pressed", v === mt));
      cb.forEach(([b, n]) => b.setAttribute("aria-pressed", n === ch));
      const gb = mt * 8 * ch / 1000;
      rich(out, "ram.ddr.read", { mt: [num(mt), "k"], ch: [String(ch), "k"], gb: [num(gb, gb % 1 ? 1 : 0), "s"] });
    }
    update(); onChange(update);
    loop(cv, dt => {
      const { g, W, H } = s; if (!W) return;
      const P = 96;
      off = (off + dt * 60 * (mt / 6000)) % P;
      g.clearRect(0, 0, W, H);
      g.font = "11.5px 'JetBrains Mono', monospace";
      const x0 = 16;
      const cTop = 30, cBot = 62;
      g.fillStyle = C.muted; g.fillText(t("ram.ddr.clock"), x0, 18);
      g.strokeStyle = C.ink2; g.lineWidth = 2; g.beginPath();
      let x = x0 - off; g.moveTo(x0, cBot);
      const edges = [];
      for (; x < W + P; x += P) {
        edges.push([x, 1], [x + P / 2, 0]);
        g.lineTo(Math.max(x0, x), cBot); g.lineTo(Math.max(x0, x), cTop); g.lineTo(Math.max(x0, x + P / 2), cTop); g.lineTo(Math.max(x0, x + P / 2), cBot); g.lineTo(Math.max(x0, x + P), cBot);
      }
      g.stroke();
      const lane = (y, key, both, col) => {
        g.fillStyle = C.ink2; g.fillText(t(key), x0, y - 10);
        g.fillStyle = C.panel; g.fillRect(x0, y, W - x0 * 2, 30);
        edges.forEach(([ex, rising]) => {
          if (!both && !rising) return;
          const w = both ? P / 2 - 6 : P - 6;
          const a = Math.max(x0, ex + 3), b = Math.min(W - x0, ex + 3 + w);
          if (b <= a) return;
          g.fillStyle = col; g.globalAlpha = .9; g.fillRect(a, y + 4, b - a, 22); g.globalAlpha = 1;
          if (ex > x0 && ex < W - x0) { g.strokeStyle = C.line2; g.lineWidth = 1; g.setLineDash([2, 4]); g.beginPath(); g.moveTo(ex, cBot + 4); g.lineTo(ex, y); g.stroke(); g.setLineDash([]); }
        });
      };
      lane(112, "ram.ddr.sdr", false, C.copper);
      lane(186, "ram.ddr.ddr", true, C.signal);
    });
  })();

  const box = document.getElementById("ramQuiz");
  if (box) quiz(box, "ram.quiz", [1, 0, 1]);
})();
