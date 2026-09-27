(function () {
  const { t, num, bind, onChange } = Internals.i18n;
  const { C, el, label, rich, loop, canvas2d, quiz } = Internals.ui;

  (function map() {
    const svg = document.getElementById("mbMap");
    if (!svg) return;
    const col = { cpu: C.copper, ram: C.violet, gpu: C.signal, ssd: C.good, chipset: C.gold, usb: C.ink2, net: C.ink2, sata: C.ink2, audio: C.ink2 };
    const box = {
      ram: [220, 16, 120, 44], gpu: [16, 138, 110, 44], cpu: [220, 120, 120, 80], ssd: [434, 138, 110, 44],
      chipset: [220, 250, 120, 40], usb: [16, 346, 116, 38], net: [156, 346, 116, 38], sata: [296, 346, 116, 38], audio: [436, 346, 116, 38]
    };
    const bus = (cx) => [[cx, 346], [cx, 318], [280, 318], [280, 290], [280, 250], [280, 200]];
    const routes = {
      ram: [[280, 60], [280, 120]], gpu: [[126, 160], [220, 160]], ssd: [[434, 160], [340, 160]], chipset: [[280, 250], [280, 200]],
      usb: bus(74), net: bus(214), sata: bus(354), audio: bus(494)
    };
    const width = { ram: 9, gpu: 7, ssd: 4, chipset: 4, usb: 2, net: 2, sata: 2, audio: 2 };
    const gap = { ram: 13, gpu: 15, ssd: 28, chipset: 28, usb: 70, net: 58, sata: 46, audio: 90 };
    const through = { usb: 1, net: 1, sata: 1, audio: 1 };
    const devs = ["ram", "gpu", "ssd", "chipset", "usb", "net", "sata", "audio"];

    const pts = p => p.map(q => q.join(",")).join(" ");
    const linkLayer = el("g", {}, svg), hiLayer = el("g", {}, svg);
    const links = {};
    devs.forEach(d => {
      const p = through[d] ? routes[d].slice(0, 4) : routes[d];
      links[d] = el("polyline", { points: pts(p), fill: "none", stroke: C.line2, "stroke-width": width[d], "stroke-linejoin": "round", "stroke-linecap": "round" }, linkLayer);
    });
    const hi = el("polyline", { fill: "none", "stroke-width": 3, "stroke-linejoin": "round", opacity: .9 }, hiLayer);
    const small = { "font-size": 9.5, fill: C.muted, "letter-spacing": ".02em" };
    const two = (x, y, a, b, anchor) => {
      label(svg, x, y, { raw: a }, Object.assign({ "text-anchor": anchor }, small));
      label(svg, x, y + 12, { raw: b }, Object.assign({ "text-anchor": anchor, fill: C.ink2 }, small));
    };
    two(290, 86, "DDR5", "~96 GB/s", "start");
    two(173, 136, "PCIe 5.0 ×16", "~64 GB/s", "middle");
    two(387, 136, "PCIe 4.0 ×4", "~8 GB/s", "middle");
    two(290, 222, "PCIe 4.0 ×4–×8", "~8–16 GB/s", "start");

    const dots = [];
    for (let i = 0; i < 48; i++) dots.push(el("circle", { r: 3, fill: C.ink, opacity: 0 }, svg));

    const boxes = {};
    Object.keys(box).forEach(d => {
      const [x, y, w, h] = box[d];
      const g = el("g", { style: d === "cpu" ? "" : "cursor:pointer" }, svg);
      const r = el("rect", { x, y, width: w, height: h, rx: 7, fill: C.panel, stroke: col[d], "stroke-width": 1.5 }, g);
      label(g, x + w / 2, y + h / 2 + 4, "mb.dev." + d, { "text-anchor": "middle", fill: C.ink, "font-size": d === "cpu" ? 15 : 11.5, "font-weight": d === "cpu" ? 600 : 400 });
      if (d !== "cpu") g.addEventListener("click", () => pick(d));
      boxes[d] = r;
    });

    const chipsBox = document.getElementById("mbDevs");
    const chips = {};
    devs.forEach(d => {
      const b = document.createElement("button"); b.type = "button"; b.className = "chip"; bind(b, "mb.dev." + d);
      b.addEventListener("click", () => pick(d)); chipsBox.appendChild(b); chips[d] = b;
    });
    const titleEl = document.getElementById("mbDevTitle"), routeEl = document.getElementById("mbDevRoute"), textEl = document.getElementById("mbDevText");

    let cur = "gpu", path = [], lens = [], total = 0, phase = 0;
    function pick(d) {
      cur = d;
      path = routes[d];
      lens = []; total = 0;
      for (let i = 1; i < path.length; i++) { const l = Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]); lens.push(l); total += l; }
      hi.setAttribute("points", pts(path)); hi.setAttribute("stroke", col[d]);
      devs.forEach(k => links[k].setAttribute("opacity", k === d || (through[d] && k === "chipset") ? 1 : .45));
      Object.keys(boxes).forEach(k => boxes[k].setAttribute("fill", k === d ? C.panel2 : C.panel));
      devs.forEach(k => chips[k].setAttribute("aria-pressed", k === d));
      text();
    }
    function text() {
      titleEl.textContent = t("mb.dev." + cur);
      const hops = through[cur] ? [cur, "chipset", "cpu"] : [cur, "cpu"];
      routeEl.textContent = t("mb.map.route") + ": " + hops.map(h => t("mb.dev." + h)).join(" → ");
      textEl.textContent = t("mb.dev." + cur + ".t");
    }
    function at(s) {
      for (let i = 0; i < lens.length; i++) {
        if (s <= lens[i]) { const k = s / lens[i], a = path[i], b = path[i + 1]; return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k]; }
        s -= lens[i];
      }
      return path[path.length - 1];
    }
    pick(cur); onChange(text);
    loop(svg, dt => {
      phase += dt * 120;
      const g = gap[cur];
      dots.forEach((c, i) => {
        const s = ((phase % g) + i * g);
        if (s > total) { c.setAttribute("opacity", 0); return; }
        const [x, y] = at(s);
        c.setAttribute("cx", x); c.setAttribute("cy", y); c.setAttribute("fill", col[cur]); c.setAttribute("opacity", 1);
      });
    });
  })();

  (function lanes() {
    const cv = document.getElementById("mbPcie");
    if (!cv) return;
    const s = canvas2d(cv);
    const gens = [["3.0", 1], ["4.0", 2], ["5.0", 4]];
    let n = 16, gen = 2, off = 0;
    const out = document.getElementById("mbPcieRead");
    const lb = [1, 4, 8, 16].map(v => {
      const b = document.createElement("button"); b.type = "button"; b.className = "btn"; b.textContent = "×" + v;
      b.addEventListener("click", () => { n = v; update(); }); document.getElementById("mbLanes").appendChild(b); return [b, v];
    });
    const gb = gens.map(([name], i) => {
      const b = document.createElement("button"); b.type = "button"; b.className = "btn"; b.textContent = name;
      b.addEventListener("click", () => { gen = i; update(); }); document.getElementById("mbGens").appendChild(b); return [b, i];
    });
    function update() {
      lb.forEach(([b, v]) => b.setAttribute("aria-pressed", v === n));
      gb.forEach(([b, i]) => b.setAttribute("aria-pressed", i === gen));
      const [g, per] = gens[gen];
      rich(out, "mb.pcie.read", { g: [g, ""], n: [String(n), "k"], per: [num(per), "k"], tot: [num(n * per), "s"] });
    }
    update(); onChange(update);
    loop(cv, dt => {
      const { g, W, H } = s; if (!W) return;
      const per = gens[gen][1];
      off += dt * 40 * per;
      g.clearRect(0, 0, W, H);
      const bw = Math.min(96, W * .16), x0 = bw + 8, x1 = W - bw - 8;
      const top = 12, bot = H - 12, lh = (bot - top) / 16;
      g.fillStyle = C.panel2; g.lineWidth = 1.5;
      g.fillRect(0, top, bw, bot - top); g.strokeStyle = C.copper; g.strokeRect(.75, top, bw - 1.5, bot - top);
      g.fillRect(W - bw, top, bw, bot - top); g.strokeStyle = C.signal; g.strokeRect(W - bw + .75, top, bw - 1.5, bot - top);
      g.fillStyle = C.ink; g.textAlign = "center";
      const fit = (txt, weight, size, x) => {
        g.font = `${weight} ${size}px 'JetBrains Mono', monospace`;
        const w = g.measureText(txt).width;
        if (w > bw - 10) g.font = `${weight} ${Math.floor(size * (bw - 10) / w)}px 'JetBrains Mono', monospace`;
        g.fillText(txt, x, H / 2 + 5);
      };
      fit(t("mb.dev.cpu"), 600, 14, bw / 2);
      fit(t("mb.pcie.device"), 400, 12, W - bw / 2);
      g.textAlign = "left";
      const spacing = 44;
      for (let i = 0; i < 16; i++) {
        const y = top + lh * (i + .5), on = i < n;
        const ya = y - lh * .2, yb = y + lh * .2;
        g.strokeStyle = on ? C.line2 : C.line; g.lineWidth = 1; g.globalAlpha = on ? 1 : .5;
        g.beginPath(); g.moveTo(x0, ya); g.lineTo(x1, ya); g.moveTo(x0, yb); g.lineTo(x1, yb); g.stroke();
        g.globalAlpha = 1;
        if (!on) continue;
        const len = x1 - x0, sz = Math.max(2, lh * .22);
        const shift = (i * 7.3) % spacing;
        for (let d = (off + shift) % spacing; d < len; d += spacing) {
          g.fillStyle = C.copper; g.fillRect(x0 + d, ya - sz / 2, Math.min(14, len - d), sz);
          g.fillStyle = C.signal; g.fillRect(Math.max(x0, x1 - d - 14), yb - sz / 2, Math.min(14, len - d), sz);
        }
      }
    });
  })();

  (function vrm() {
    const svg = document.getElementById("mbVrm");
    if (!svg) return;
    const loads = [["mb.vrm.idle", 10], ["mb.vrm.game", 100], ["mb.vrm.heavy", 200]];
    let phases = 8, load = 2, active = 0, acc = 0;
    const out = document.getElementById("mbVrmRead");

    label(svg, 20, 30, "mb.vrm.in", { fill: C.gold, "font-size": 11 });
    label(svg, 620, 30, "mb.vrm.out", { fill: C.copper, "font-size": 11, "text-anchor": "end" });
    el("rect", { x: 34, y: 48, width: 8, height: 262, rx: 4, fill: C.gold }, svg);
    el("rect", { x: 500, y: 48, width: 8, height: 262, rx: 4, fill: C.copper }, svg);
    el("rect", { x: 530, y: 110, width: 90, height: 140, rx: 10, fill: C.panel, stroke: C.copper, "stroke-width": 1.5 }, svg);
    label(svg, 575, 146, "mb.dev.cpu", { "text-anchor": "middle", fill: C.ink, "font-size": 15, "font-weight": 600 });
    el("line", { x1: 508, y1: 180, x2: 530, y2: 180, stroke: C.copper, "stroke-width": 4 }, svg);
    el("rect", { x: 546, y: 170, width: 58, height: 64, rx: 4, fill: C.ground }, svg);
    const meter = el("rect", { x: 546, y: 234, width: 58, height: 0, rx: 4, fill: C.copper, opacity: .85 }, svg);
    const amps = el("text", { x: 575, y: 206, "text-anchor": "middle", fill: C.ink, "font-size": 13, "font-weight": 600 }, svg, "");

    const layer = el("g", {}, svg);
    let cells = [];
    function build() {
      layer.textContent = "";
      const cols = Math.min(phases, 8), rows = Math.ceil(phases / 8);
      const cw = 42, chh = 76, gx = 10, rg = 44;
      const x0 = 271 - (cols * cw + (cols - 1) * gx) / 2, y0 = 179 - (rows * chh + (rows - 1) * rg) / 2;
      for (let r = 0; r < rows; r++) {
        const y = y0 + r * (chh + rg), xl = x0 + cw / 2, xr = x0 + (cols - 1) * (cw + gx) + cw / 2;
        el("line", { x1: 42, y1: y - 14, x2: xr, y2: y - 14, stroke: C.gold, "stroke-width": 2, opacity: .45 }, layer);
        el("line", { x1: xl, y1: y + chh + 14, x2: 500, y2: y + chh + 14, stroke: C.copper, "stroke-width": 2, opacity: .45 }, layer);
      }
      cells = [];
      for (let i = 0; i < phases; i++) {
        const c = i % cols, r = Math.floor(i / cols);
        const x = x0 + c * (cw + gx), y = y0 + r * (chh + rg), mx = x + cw / 2;
        const wIn = el("line", { x1: mx, y1: y - 14, x2: mx, y2: y, stroke: C.line2, "stroke-width": 1.5 }, layer);
        const wOut = el("line", { x1: mx, y1: y + chh, x2: mx, y2: y + chh + 14, stroke: C.line2, "stroke-width": 1.5 }, layer);
        const body = el("rect", { x, y, width: cw, height: chh, rx: 6, fill: C.panel2, stroke: C.line2, "stroke-width": 1.5 }, layer);
        el("rect", { x: x + 8, y: y + 8, width: 26, height: 26, rx: 4, fill: "#4a4f58" }, layer);
        el("circle", { cx: x + 21, cy: y + 21, r: 7.5, fill: "none", stroke: "#8593a5", "stroke-width": 2 }, layer);
        const tag = el("text", { x: mx, y: y + 51, "text-anchor": "middle", fill: C.ink2, "font-size": 10.5 }, layer, "");
        el("rect", { x: x + 6, y: y + 59, width: 30, height: 9, rx: 2, fill: C.ground }, layer);
        const heat = el("rect", { x: x + 6, y: y + 59, width: 0, height: 9, rx: 2, fill: C.good }, layer);
        cells.push({ body, heat, tag, wIn, wOut });
      }
    }
    const heatOf = each => each < 20 ? ["mb.vrm.cool", C.good] : each <= 40 ? ["mb.vrm.warm", C.gold] : ["mb.vrm.hot", C.bad];
    function update() {
      pb.forEach(([b, v]) => b.setAttribute("aria-pressed", v === phases));
      ldb.forEach(([b, i]) => b.setAttribute("aria-pressed", i === load));
      const a = loads[load][1], each = a / phases, [hk, hc] = heatOf(each);
      const eachTx = num(each, each % 1 ? 1 : 0);
      cells.forEach(c => {
        c.heat.setAttribute("width", 30 * Math.min(1, each / 50)); c.heat.setAttribute("fill", hc);
        c.body.setAttribute("stroke", hc);
        c.tag.textContent = eachTx + " A";
      });
      meter.setAttribute("height", 64 * a / 200); meter.setAttribute("y", 234 - 64 * a / 200);
      amps.textContent = a + " A";
      rich(out, "mb.vrm.read", { a: [String(a), "k"], p: [String(phases), "k"], each: [eachTx, "s"] });
      out.appendChild(document.createTextNode(" · "));
      const st = document.createElement("span"); st.style.color = hc; st.textContent = t(hk); out.appendChild(st);
    }
    const pb = [4, 8, 16].map(v => {
      const b = document.createElement("button"); b.type = "button"; b.className = "btn"; b.textContent = v;
      b.addEventListener("click", () => { phases = v; active = 0; build(); update(); }); document.getElementById("mbPhases").appendChild(b); return [b, v];
    });
    const ldb = loads.map(([k], i) => {
      const b = document.createElement("button"); b.type = "button"; b.className = "btn"; bind(b, k);
      b.addEventListener("click", () => { load = i; update(); }); document.getElementById("mbLoads").appendChild(b); return [b, i];
    });
    build(); update(); onChange(update);
    loop(svg, dt => {
      acc += dt;
      const step = .5 / phases;
      if (acc > step) { acc = 0; active = (active + 1) % phases; }
      cells.forEach((c, i) => {
        const on = i === active;
        c.body.setAttribute("fill", on ? "#2b3340" : C.panel2);
        c.wIn.setAttribute("stroke", on ? C.gold : C.line2); c.wIn.setAttribute("stroke-width", on ? 3 : 1.5);
        c.wOut.setAttribute("stroke", on ? C.copper : C.line2); c.wOut.setAttribute("stroke-width", on ? 3 : 1.5);
      });
    });
  })();

  const box = document.getElementById("mbQuiz");
  if (box) quiz(box, "mb.quiz", [1, 0, 0]);
})();
