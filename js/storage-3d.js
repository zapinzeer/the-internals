(function () {
  const root = document.getElementById("sto3d");
  if (!root) return;
  const parts = [
    { id: "label", color: "#e38b4f" },
    { id: "nand", color: "#a594f5" },
    { id: "dram", color: "#72d49c" },
    { id: "controller", color: "#5ac8e2" },
    { id: "pcb", color: "#3f8a5c" },
    { id: "connector", color: "#d8b25a" }
  ];

  Internals.viewer3d(root, {
    prefix: "sto.part", parts, initial: "nand", explode: 0.7, yaw: -0.5,
    dist: [98, 114, 150], lookY: 3, elev: 0.55, flipSelect: "pcb",
    build(ctx) {
      const { THREE, part, add, std, kit } = ctx;
      const MM = .75;
      const L = 30, HW = 8.25, T = .6, Y0 = T / 2;
      const SPLIT = L - 5 * MM;
      const V = Math.PI / 2;
      const SANS = "Arial, 'Liberation Sans', 'Helvetica Neue', sans-serif";
      const MONO = "'DejaVu Sans Mono', 'Liberation Mono', Consolas, monospace";

      const slab = (w, d, h, r, b) => kit.extrude(kit.shapeRect(w - 2 * b, d - 2 * b, Math.max(.01, r - b)), h, b, 8);
      const fitTo = (mat, w, d) => {
        for (const t of [mat.map, mat.normalMap, mat.roughnessMap]) if (t) { t.repeat.set(1 / w, 1 / d); t.offset.set(.5, .5); }
        return mat;
      };
      const grid = (cols, rows, pitch, skip) => {
        const out = [];
        for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++)
          if (!skip || !skip(i, j)) out.push([(i - (cols - 1) / 2) * pitch, (j - (rows - 1) / 2) * pitch]);
        return out;
      };

      const CT = { x: 15.4, z: 0, s: 9.4, lid: 7.35 };
      const DR = { x: 5.3, z: 0, w: 5.6, d: 10 };
      const NA = [{ x: -5.2, z: 0 }, { x: -18.3, z: 0 }];
      const NW = 10.5, ND = 13.5;
      const TOP = 1.0875;
      const LB = { x0: -25.5, x1: 20.85, d: 15.9 };
      const PM = { x: 23.7, z: 1.6 };
      const IND = [[22.35, -6.95], [22.35, -5.05], [22.35, -3.15]];
      const XT = [21.8, 5.6];
      const LED = [24.3, 7.45];
      const EF = [23.5, 5.3];
      const ballsC = grid(15, 15, .6, (i, j) => Math.abs(i - 7) < 2 && Math.abs(j - 7) < 2);
      const ballsD = grid(9, 16, .6, i => i >= 3 && i <= 5);
      const ballsN = grid(12, 16, .75, (i, j) => i >= 4 && i <= 7 && j >= 3 && j <= 12);

      const SZ = {
        c0201: { l: .45, w: .23, h: .22 }, c0402: { l: .75, w: .38, h: .36 }, c0603: { l: 1.2, w: .6, h: .55 },
        c0805: { l: 1.5, w: .94, h: .9 }, r0201: { l: .45, w: .23, h: .17 }, r0402: { l: .75, w: .38, h: .25 }
      };
      const SMD = { c0201: [], c0402: [], c0603: [], c0805: [], r0201: [], r0402: [] };
      const put = (k, x, z, ry) => SMD[k].push([x, z, ry || 0]);
      for (const s of [-1, 1]) {
        for (let i = 0; i < 15; i++) if (i % 5 !== 2) put("c0402", 11.1 + i * .62, s * 5.35, V);
        for (let i = 0; i < 11; i++) put(i % 3 ? "c0201" : "r0201", 11.3 + i * .82, s * 6.3);
        for (let i = 0; i < 6; i++) put("c0402", 3.1 + i * .8, s * 5.55, V);
        for (let i = 0; i < 4; i++) put("r0201", 3.4 + i * 1.2, s * 6.55);
        for (const n of NA) for (let i = 0; i < 6; i++) put(i % 2 ? "c0402" : "c0201", n.x - 4.2 + i * 1.7, s * 7.35);
      }
      for (let i = 0; i < 12; i++) put(i % 4 === 3 ? "r0201" : "c0201", 9.05 + (i % 2) * .75, -4.1 + Math.floor(i / 2) * 1.6);
      for (let i = 0; i < 8; i++) put("c0402", .8 + (i % 2) * .85, -4.6 + Math.floor(i / 2) * 3.1, V);
      for (let i = 0; i < 8; i++) put("c0402", -12.2 + (i % 2) * .85, -4.6 + Math.floor(i / 2) * 3.1, V);
      [-2.4, -.6, 1.2, 3].forEach(z => { put("c0201", 21.4, z - .19); put("c0201", 21.4, z + .19); });
      [-6.95, -5.6, -4.25].forEach(z => put("c0805", 24.5, z));
      [4.1, 5.95].forEach(z => put("c0805", 25.55, z, V));
      put("c0603", 21.75, .9, V); put("c0603", 21.75, 2.55, V); put("c0603", 25.6, 1.1, V);
      [[23.7, -.55, 0], [22.9, 3.65, 0], [24.5, 3.65, 0], [25.95, -1.35, V], [25.95, -2.55, V], [21.5, -1.65, 0], [23.2, -1.65, 0]]
        .forEach(([x, z, r]) => put("c0402", x, z, r));
      put("r0402", 25.6, 2.75, V); put("r0402", 23, 7.45); put("r0201", 22.6, -1.1); put("r0201", 24.6, -1.1);
      put("c0201", 21.25, 4.55); put("c0201", 22.35, 4.55);
      put("c0603", -26.6, 5.3, V); put("c0603", -26.6, -5.3, V); put("c0402", -27.7, 4.1); put("c0402", -27.7, -4.1);

      function qr(S, x, z, size, seed, dark) {
        const n = 25, m = size / n, r = kit.rng(seed), x0 = x - size / 2, z0 = z - size / 2;
        const cell = (i, j) => S.rect(x0 + (i + .5) * m, z0 + (j + .5) * m, m * 1.03, m * 1.03, dark);
        const finder = (i0, j0) => { for (let i = 0; i < 7; i++) for (let j = 0; j < 7; j++) if (Math.max(Math.abs(i - 3), Math.abs(j - 3)) !== 2) cell(i0 + i, j0 + j); };
        const reserved = (i, j) => (i < 8 && j < 8) || (i >= n - 8 && j < 8) || (i < 8 && j >= n - 8) || (i >= 15 && i <= 21 && j >= 15 && j <= 21);
        finder(0, 0); finder(n - 7, 0); finder(0, n - 7);
        for (let i = 16; i <= 20; i++) for (let j = 16; j <= 20; j++) if (Math.max(Math.abs(i - 18), Math.abs(j - 18)) !== 1) cell(i, j);
        for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
          if (reserved(i, j)) continue;
          if (i === 6 || j === 6) { if ((i + j) % 2 === 0) cell(i, j); continue; }
          if (r() < .5) cell(i, j);
        }
      }
      function dmx(S, x, z, size, n, seed, dark) {
        const m = size / n, r = kit.rng(seed), x0 = x - size / 2, z0 = z - size / 2;
        for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
          const on = i === 0 || j === n - 1 ? true : j === 0 ? i % 2 === 0 : i === n - 1 ? j % 2 === 1 : r() < .47;
          if (on) S.rect(x0 + (i + .5) * m, z0 + (j + .5) * m, m * 1.02, m * 1.02, dark);
        }
      }
      function barcode(S, x, z, w, h, seed, dark) {
        const r = kit.rng(seed), bars = [];
        let p = 0;
        const bar = (bw, gw) => { bars.push([p, bw]); p += bw + gw; };
        bar(2, 1); bar(1, 1); bar(1, 2);
        while (p < 150) bar(1 + Math.floor(r() * 3.4), 1 + Math.floor(r() * 3));
        bar(2, 3); bar(3, 1); bar(1, 1); bar(2, 0);
        const m = w / p;
        for (const [q, bw] of bars) S.rect(x - w / 2 + (q + bw / 2) * m, z, bw * m, h, dark);
      }
      function padPair(P, x, z, ry, s) {
        const e = s.l * .22, off = s.l / 2 - e * .35, pl = e * 1.6, pw = s.w * 1.18;
        for (const sd of [-1, 1]) {
          if (ry) P.rect(x, z + sd * off, pw, pl, P.padP);
          else P.rect(x + sd * off, z, pl, pw, P.padP);
        }
      }

      const gold = { color: "#eec06a", rough: .3, metal: 1, height: .57 };
      const pinZ = n => (9.25 - (n - 1) * .25) * MM;
      const FX0 = 27.45, FX1 = L - .22;
      const keep = [[CT.x, CT.z, CT.s + .4, CT.s + .4], [DR.x, DR.z, DR.w + .4, DR.d + .4],
        ...NA.map(n => [n.x, n.z, NW + .4, ND + .4]), [28.7, 0, 2.7, 2 * HW], [-L, 0, 5, 5]];
      const finger = (P, side) => {
        P.rect((FX0 + L) / 2 - .1, 0, L - FX0 + .2, 2 * HW, { color: "#191a1b", rough: .45, metal: 0, height: .46 });
        P.line([[FX0 - .15, -HW], [FX0 - .15, HW]], .05, { color: "#2c3036", height: .52 });
        const r = kit.rng(side ? 9 : 19);
        for (let n = side ? 2 : 1; n <= 75; n += 2) {
          if (n >= 59 && n <= 66) continue;
          const z = pinZ(n), jog = (r() - .5) * .5, end = FX0 - .8 - r() * 1.1;
          P.trace([[FX0 + .2, z], [FX0 - .3, z], [end + .3, z + jog], [end, z + jog]], .09);
          P.via(end, z + jog, .1, r() < .25);
        }
      };
      const bracket = (P, x, z, w, d, ref, rz, rx) => {
        const hx = w / 2 + .28, hz = d / 2 + .28, k = Math.min(w, d) * .16;
        for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]])
          P.line([[x + sx * hx, z + sz * (hz - k)], [x + sx * hx, z + sz * hz], [x + sx * (hx - k), z + sz * hz]], .07, P.silkP);
        P.circle(x - hx - .22, z + hz + .22, .11, P.silkP);
        if (ref) P.ref(ref, rx != null ? rx : x, rz, .42);
      };
      const topP = kit.pcb({
        w: 2 * L, d: 2 * HW, maxPx: 2048, mask: "black", finish: "tin", gloss: .62, seed: 23, traceW: .08,
        traces: 60, vias: 240, keep,
        draw(P) {
          finger(P, 0);
          [-2.4, -.6, 1.2, 3].forEach((z, i) => [-.19, .19].forEach(o => {
            const zf = pinZ(41 - i * 12) + o;
            P.trace([[FX0 - .3, zf], [25.2, zf], [24.2, z + o], [21.4, z + o], [20.3, z + o * .6]], .07);
          }));
          for (let i = 0; i < 7; i++) {
            P.trace([[-1 + i * .2, -6.8], [-.2 + i * .2, -6], [-.2 + i * .2, 6], [-1 + i * .2, 6.8]], .07);
            P.trace([[-14.1 + i * .17, -6.5], [-13.4 + i * .17, -5.8], [-13.4 + i * .17, 5.8], [-14.1 + i * .17, 6.5]], .07);
          }
          const lands = (cx, cz, list, r) => list.forEach(([x, z]) => P.circle(cx + x, cz + z, r, P.padP));
          lands(CT.x, CT.z, ballsC, .16); lands(DR.x, DR.z, ballsD, .15); NA.forEach(n => lands(n.x, n.z, ballsN, .19));
          bracket(P, CT.x, CT.z, CT.s, CT.s, "U1", -7.45, CT.x + 3.9);
          bracket(P, DR.x, DR.z, DR.w, DR.d, "U2", -7.4, DR.x + 2.2);
          bracket(P, NA[0].x, 0, NW, ND, "U3", -7.95, NA[0].x + 4.9);
          bracket(P, NA[1].x, 0, NW, ND, "U4", -7.95, NA[1].x + 4.9);
          for (const k in SMD) SMD[k].forEach(([x, z, ry]) => padPair(P, x, z, ry, SZ[k]));
          for (let i = 0; i < 6; i++) for (const s of [-1, 1]) {
            const a = (i - 2.5) * .5 * MM * 1.2;
            P.rect(PM.x + a, PM.z + s * 1.62, .2, .5, P.padP); P.rect(PM.x + s * 1.62, PM.z + a, .5, .2, P.padP);
          }
          IND.forEach(([x, z]) => { P.rect(x - .62, z, .5, 1.05, P.padP); P.rect(x + .62, z, .5, 1.05, P.padP); });
          [[-.45, -.4], [.45, -.4], [-.45, .4], [.45, .4]].forEach(([a, b]) => P.rect(XT[0] + b, XT[1] + a, .42, .38, P.padP));
          P.rect(LED[0] - .5, LED[1], .4, .6, P.padP); P.rect(LED[0] + .5, LED[1], .4, .6, P.padP);
          [[-.3, -.25], [.3, -.25], [-.3, .25], [.3, .25]].forEach(([a, b]) => P.circle(EF[0] + a, EF[1] + b, .1, P.padP));
          [[25.7, -3.65, "TP3"], [21.55, -.75, "TP5"], [25.65, 7.2, "TP1"], [-28.2, 6.6, "TP9"]].forEach(([x, z, t]) => {
            P.circle(x, z, .3, gold); P.ref(t, x - (x > 0 ? .95 : -.95), z, .32);
          });
          [["U5", PM.x, PM.z - 2.2], ["L1", 21.05, -6.95], ["L2", 21.05, -5.05], ["L3", 21.05, -3.15], ["C1", 25.2, -7.85],
            ["Y1", 21.8, 7.05], ["D1", LED[0], LED[1] - .8], ["U6", EF[0] + .95, EF[1] - .6]]
            .forEach(([t, x, z]) => P.ref(t, x, z, .36));
          P.silk(s => P.rect(LED[0], LED[1], 1.55, .9, Object.assign({}, s, { alpha: .18 })));
          P.ring(-L, 0, 1.28, 2.25, gold);
          for (let k = 0; k < 7; k++) { const a = -V + (k + .5) * Math.PI / 7; P.circle(-L + Math.cos(a) * 1.8, Math.sin(a) * 1.8, .065, { color: "#5a4523", height: .45 }); }
          P.ref("M.2 2280", -28.6, 3.4, .42, -V);
          P.ref("REV A1", -28.8, -4.3, .34, -V);
          P.text("94V-0  2436", -27.6, -4.8, .3, P.silkP, { rot: -V, weight: 600 });
          P.fiducial(-27.9, 7.35, .2); P.fiducial(25.9, -7.6, .2); P.fiducial(12.3, 7.55, .2);
        }
      });
      const topMat = topP.material({ normal: 3, fit: true });

      const botP = kit.pcb({
        w: 2 * L, d: 2 * HW, maxPx: 2048, mask: "black", finish: "tin", gloss: .62, seed: 41, traceW: .08,
        traces: 90, vias: 300, underside: true, keep: [[28.7, 0, 2.7, 2 * HW], [-L, 0, 5, 5], [CT.x, 0, 8, 8], ...NA.map(n => [n.x, 0, NW + .4, ND + .4])],
        draw(P) {
          finger(P, 1);
          P.ring(-L, 0, 1.28, 2.25, gold);
          grid(14, 14, .6).forEach(([x, z]) => P.via(CT.x + x, z, .1, false));
          grid(6, 4, 1.05).forEach(([x, z], k) => P.circle(CT.x + x, z, .27, k % 7 === 3 ? P.padP : gold));
          P.ref("TP20", CT.x, -2.85, .34); P.ref("TP43", CT.x, 2.85, .34);
          NA.forEach((n, i) => {
            ballsN.forEach(([x, z]) => P.circle(n.x + x, z, .17, gold));
            bracket(P, n.x, 0, NW, ND, i ? "U8" : "U7", -7.9, n.x + 4.9);
            for (let k = 0; k < 5; k++) padPair(P, n.x - 3.6 + k * 1.8, 7.45, 0, SZ.c0402);
          });
          [["3V3", -6.2], ["VCORE", -3.6], ["VCCQ", -1], ["VDDQ", 1.6], ["GND", 4.2]].forEach(([t, z]) => {
            P.circle(23.2, z, .42, gold); P.text(t, 24.55, z, .34, P.silkP, { align: "left", weight: 600 });
          });
          ["TX", "RX", "GND", "1V8"].forEach((t, i) => {
            P.rect(5.2 + i * 1.15, 6.6, .75, .95, gold, .12); P.text(t, 5.2 + i * 1.15, 7.65, .3, P.silkP, { weight: 600 });
          });
          P.outline(6.93, 6.6, 4.8, 1.5, .06);
          P.text("AURION  NX7P-2T0", 5.4, -5.9, .52, P.silkP, { weight: 700, spacing: .06 });
          P.text("M.2 2280-S3-M   PCIe 4.0 ×4", 5.4, -5, .4, P.silkP, { weight: 600 });
          P.text("PCB REV A1   2436   94V-0", 5.4, -4.2, .36, P.silkP, { weight: 600 });
          P.rect(5.4, -2.3, 2.3, 2.3, P.silkP);
          dmx(P, 5.4, -2.3, 1.9, 16, 97, { color: P.mask, height: .5, rough: .4 });
          P.text("SN 5K24D0917A3", 8.1, -2.3, .3, P.silkP, { align: "left", weight: 600 });
          P.text("ASSEMBLED IN TAIWAN", 8.1, -1.6, .26, P.silkP, { align: "left", weight: 600 });
          P.fiducial(-27.9, -7.35, .2); P.fiducial(25.9, 7.6, .2); P.fiducial(-1.2, -7.6, .2);
        }
      });
      const botMat = botP.material({ normal: 3, fit: true });
      const edgeMat = std({ color: 0x2a2924, roughness: .82 });

      const pcb = part("pcb");
      const bs = new THREE.Shape(), CR = .6, NR = 1.3125;
      bs.moveTo(SPLIT, HW); bs.lineTo(-L + CR, HW); bs.absarc(-L + CR, HW - CR, CR, V, Math.PI, false);
      bs.lineTo(-L, NR); bs.absarc(-L, 0, NR, V, -V, true);
      bs.lineTo(-L, -HW + CR); bs.absarc(-L + CR, -HW + CR, CR, Math.PI, Math.PI * 1.5, false);
      bs.lineTo(SPLIT, -HW); bs.closePath();
      add(pcb, kit.extrude(bs, T, 0, 32), [topMat, edgeMat, botMat]);
      add(pcb, new THREE.CylinderGeometry(NR - .008, NR - .008, T, 28, 1, true, 0, Math.PI),
        std({ color: 0xe0b35c, metalness: 1, roughness: .25, side: THREE.DoubleSide }), -L, 0, 0);

      const capTints = { c0201: "#9b8466", c0402: "#8e7456", c0603: "#a08463", c0805: "#8a7a64" };
      for (const k of ["c0201", "c0402", "c0603", "c0805"]) {
        const s = SZ[k];
        kit.mlcc(pcb, SMD[k].map(([x, z, ry]) => [x, Y0, z, ry]), { l: s.l, w: s.w, h: s.h, color: capTints[k] });
      }
      const resMat = std({ vertexColors: true, roughness: .5 });
      for (const k of ["r0201", "r0402"]) {
        const s = SZ[k], e = s.l * .18;
        const g = new THREE.BoxGeometry(s.l - 2 * e + .002, s.h * .94, s.w * .97);
        const cols = [], white = new THREE.Color(0xd8d4c8).convertSRGBToLinear(), black = new THREE.Color(0x141414).convertSRGBToLinear();
        for (let f = 0; f < 6; f++) for (let v = 0; v < 4; v++) { const c = f === 2 ? black : white; cols.push(c.r, c.g, c.b); }
        g.setAttribute("color", new THREE.Float32BufferAttribute(cols, 3));
        kit.place(pcb, g, resMat, SMD[k].map(([x, z, ry]) => [x, Y0 + s.h / 2, z, ry]));
        const eg = new THREE.BoxGeometry(e, s.h, s.w), ends = [];
        SMD[k].forEach(([x, z, ry]) => [-1, 1].forEach(sd => ends.push([x + Math.cos(ry) * sd * (s.l / 2 - e / 2), Y0 + s.h / 2, z - Math.sin(ry) * sd * (s.l / 2 - e / 2), ry])));
        kit.place(pcb, eg, kit.mat.tin(), ends);
      }

      kit.ic(pcb, { x: PM.x, y: Y0, z: PM.z, w: 3, d: 3, h: .6, pkg: "qfn", leads: 6, pitch: .45, lines: ["AP8204", "K3T 419"], color: "#1c1d20" });
      kit.choke(pcb, IND.map(([x, z]) => [x, Y0, z]), { w: 1.5, d: 1.2, h: .75, text: "R47" });
      add(pcb, slab(1.5, 1.2, .12, .12, .02), std({ color: 0xc9c2b2, roughness: .6 }), XT[0], Y0 + .06, XT[1]).rotation.y = V;
      add(pcb, slab(1.34, 1.04, .22, .1, .03), kit.mat.nickel(), XT[0], Y0 + .23, XT[1]).rotation.y = V;
      kit.ic(pcb, { x: EF[0], y: Y0, z: EF[1], w: 1.2, d: .9, h: .38, pkg: "plain", lines: ["E4"], pin1: true, color: "#161719" });
      kit.mlcc(pcb, [[LED[0], Y0, LED[1]]], { l: 1.2, w: .6, h: .26, color: "#e4e1d6" });
      add(pcb, slab(.86, .52, .2, .1, .05), std({ color: 0x9fe8b4, emissive: 0x1f9a4a, emissiveIntensity: .9, roughness: .12 }), LED[0], Y0 + .34, LED[1]);

      const conn = part("connector");
      const X1 = L - .2, CH = .12;
      const KZ = pinZ(62.5), NZ0 = KZ - .45, NZ1 = KZ + .45, KR = .45, KX = L - 3.8 * MM + KR;
      const ks = new THREE.Shape();
      ks.moveTo(SPLIT, -HW); ks.lineTo(X1, -HW); ks.lineTo(X1, -NZ1); ks.lineTo(KX, -NZ1);
      ks.absarc(KX, -KZ, KR, -V, V, true); ks.lineTo(X1, -NZ0); ks.lineTo(X1, HW); ks.lineTo(SPLIT, HW); ks.closePath();
      add(conn, kit.extrude(ks, T, 0, 16), [topMat, edgeMat, botMat]);
      const prof = new THREE.Shape();
      prof.moveTo(X1, Y0); prof.lineTo(L, CH); prof.lineTo(L, -CH); prof.lineTo(X1, -Y0); prof.closePath();
      const bevelSeg = (z0, z1) => { const g = new THREE.ExtrudeGeometry(prof, { depth: z1 - z0, bevelEnabled: false }); g.translate(0, 0, z0); return g; };
      add(conn, kit.merge([[bevelSeg(-HW, NZ0), 0, 0, 0], [bevelSeg(NZ1, HW), 0, 0, 0]]), edgeMat);
      const brushed = kit.tiles.brushed().clone(); brushed.needsUpdate = true;
      const fingerMat = std({ color: 0xe8bf66, metalness: 1, roughness: .2, normalMap: brushed, normalScale: new THREE.Vector2(.12, .12) });
      const FT = .03, FW = .25, fgeo = slab(FX1 - FX0, FW, FT, .06, .008);
      const fl = [];
      for (let n = 1; n <= 75; n++) if (n < 59 || n > 66) fl.push([(FX0 + FX1) / 2, n % 2 ? Y0 + FT / 2 : -Y0 - FT / 2, pinZ(n)]);
      kit.place(conn, fgeo, fingerMat, fl).userData.noCast = true;

      const ballGeo = new THREE.SphereGeometry(1, 10, 6);
      const tin = kit.mat.tin();
      const substrate = std({ color: 0x2a3326, roughness: .55 });
      const epoxy = kit.mat.epoxy();
      function chipTop(w, d, ppu, seed, paint) {
        const S = kit.surface({ w, h: d, ppu, base: { color: "#1b1c1f", rough: .66, metal: 0, height: .5 } });
        S.noise(Math.round(S.W * S.H / 90), 1 / ppu, r => ({ color: r() < .5 ? "#000" : "#fff", alpha: .035, height: .45 + r() * .1, size: (1 + r() * 2) / ppu }), seed);
        paint(S, { color: "#7a7e84", rough: .9, height: .47 });
        return S.material({ normal: 1.5 });
      }
      function bga(group, list, o) {
        const r = o.ball, so = o.so;
        const balls = [];
        list.forEach(([cx, cz]) => o.balls.forEach(([x, z]) => balls.push([cx + x, so / 2, cz + z, 0, 0, 0, r, so / (2 * r), r])));
        kit.place(group, ballGeo, tin, balls).userData.noCast = true;
        kit.place(group, slab(o.w, o.d, o.sub, .1, .02), substrate, list.map(([x, z]) => [x, so + o.sub / 2, z]));
        const mw = o.w - .12, md = o.d - .12, b = .06;
        kit.place(group, slab(mw, md, o.mold, .22, b), epoxy, list.map(([x, z]) => [x, so + o.sub + o.mold / 2, z]));
        const topGeo = new THREE.PlaneGeometry(mw - 2 * b, md - 2 * b); topGeo.rotateX(-V);
        kit.place(group, topGeo, o.top, list.map(([x, z]) => [x, so + o.sub + o.mold + .003, z])).userData.noCast = true;
      }

      const nand = part("nand");
      const nTop = chipTop(NW - .24, ND - .24, 76, 5, (S, ink) => {
        const x0 = -S.w / 2 + .9;
        S.text("AURION", x0, -4.6, .78, ink, { align: "left", weight: 800, font: SANS, spacing: .12 });
        ["AF8T1B3W-TCK0", "H24D5170A2  B3", "1TB 3D TLC NAND", "TAIWAN  2436"]
          .forEach((t, i) => S.text(t, x0, -2.95 + i * 1.02, .5, ink, { align: "left", weight: 600, font: SANS }));
        dmx(S, S.w / 2 - 1.7, S.h / 2 - 1.7, 1.5, 14, 71, ink);
        S.circle(-S.w / 2 + .7, S.h / 2 - .7, .26, { color: "#0c0d0f", height: .38, rough: .35 });
      });
      bga(nand, NA.map(n => [n.x, n.z]), { w: NW, d: ND, so: .19, sub: .19, mold: TOP - .19 - .19 - .008, ball: .19, balls: ballsN, top: nTop });

      const dram = part("dram");
      const dTop = chipTop(DR.w - .24, DR.d - .24, 96, 6, (S, ink) => {
        const x0 = -S.w / 2 + .6;
        S.text("AURION", x0, -2.4, .6, ink, { align: "left", weight: 800, font: SANS, spacing: .08 });
        ["AD4L16G2S", "-JE8 2GB", "LPDDR4", "D2431 TW"].forEach((t, i) => S.text(t, x0, -1.1 + i * .88, .44, ink, { align: "left", weight: 600, font: SANS }));
        S.circle(-S.w / 2 + .55, S.h / 2 - .55, .2, { color: "#0c0d0f", height: .38, rough: .35 });
      });
      bga(dram, [[DR.x, DR.z]], { w: DR.w, d: DR.d, so: .19, sub: .17, mold: .58, ball: .15, balls: ballsD, top: dTop });

      const ctrl = part("controller");
      const SO = .225, SUB = .42, LID = TOP - SO - SUB;
      const subS = kit.surface({ w: CT.s - .06, h: CT.s - .06, ppu: 56, base: { color: "#1d3125", rough: .36, metal: 0, height: .5 } });
      subS.noise(2400, .03, r => ({ color: r() < .5 ? "#000" : "#fff", alpha: .04 }), 3);
      {
        const S = subS, h = CT.s / 2 - .6, r = kit.rng(8);
        for (let i = 0; i < 40; i++) {
          const a = Math.floor(r() * 4), t = (r() - .5) * 2 * (h - .4), p = (x, z) => a === 0 ? [x, z] : a === 1 ? [-x, z] : a === 2 ? [z, x] : [z, -x];
          S.line([p(3.3, t), p(3.9, t + (r() - .5) * .4), p(4.5, t + (r() - .5) * .4)], .05, { color: "#29483a", height: .54, alpha: .7 });
        }
        S.poly([[-S.w / 2 + .15, S.h / 2 - .15], [-S.w / 2 + .75, S.h / 2 - .15], [-S.w / 2 + .15, S.h / 2 - .75]], gold);
        S.text("KX9412-B1", 0, S.h / 2 - .35, .26, { color: "#cfd3cf", rough: .7 }, { weight: 600, font: SANS });
      }
      const subCaps = [];
      for (let i = 0; i < 5; i++) {
        const a = (i - 2) * 1.35;
        subCaps.push([CT.x + a, SO + SUB, 4.15, 0], [CT.x + a, SO + SUB, -4.15, 0], [CT.x + 4.15, SO + SUB, a, V], [CT.x - 4.15, SO + SUB, a, V]);
      }
      subCaps.forEach(([x, , z, ry]) => {
        const off = .16;
        for (const sd of [-1, 1]) subS.rect(x - CT.x + (ry ? 0 : sd * off), z + (ry ? sd * off : 0), ry ? .26 : .16, ry ? .16 : .26, gold);
      });
      const subTop = fitTo(subS.material({ normal: 2 }), CT.s - .06, CT.s - .06);
      const lidS = kit.surface({ w: CT.lid - .14, h: CT.lid - .14, ppu: 96, base: { color: "#c6c8ca", rough: .26, metal: 1, height: .5 } });
      {
        const S = lidS, etch = { color: "#7d8187", rough: .62, metal: .8, height: .48 };
        S.noise(9000, .02, r => ({ rough: .2 + r() * .16, metal: 1, alpha: .6, size: .015 + r() * .04 }), 12);
        S.text("KESTREL", 0, -2, .8, etch, { weight: 800, font: SANS, spacing: .2 });
        ["KX-9412", "PCIe 4.0 ×4  NVMe", "FCKX0417.3", "TW 2436  A1"].forEach((t, i) => S.text(t, -.4, -.55 + i * .78, .42, etch, { weight: 600, font: SANS }));
        dmx(S, 2.35, 2.35, 1.2, 12, 33, etch);
        S.poly([[-S.w / 2 + .3, S.h / 2 - .3], [-S.w / 2 + .9, S.h / 2 - .3], [-S.w / 2 + .3, S.h / 2 - .9]], etch);
      }
      const lidTop = fitTo(lidS.material({ normal: 2 }), CT.lid - .14, CT.lid - .14);
      const nickel = kit.mat.nickel();
      const subSide = std({ color: 0x1f2a21, roughness: .6 });
      const cb = [];
      ballsC.forEach(([x, z]) => cb.push([CT.x + x, SO / 2, z, 0, 0, 0, .15, SO / .3, .15]));
      kit.place(ctrl, ballGeo, tin, cb).userData.noCast = true;
      add(ctrl, slab(CT.s, CT.s, SUB, .15, .03), [subTop, subSide, subSide], CT.x, SO + SUB / 2, CT.z);
      add(ctrl, slab(CT.lid + .12, CT.lid + .12, .07, .6, .03), std({ color: 0x141414, roughness: .5 }), CT.x, SO + SUB + .035, CT.z);
      add(ctrl, slab(CT.lid, CT.lid, LID, .55, .07), [lidTop, nickel, nickel], CT.x, SO + SUB + LID / 2, CT.z);
      kit.mlcc(ctrl, subCaps, { l: .45, w: .23, h: .2 });

      const LW = LB.x1 - LB.x0, LD = LB.d, LCX = (LB.x0 + LB.x1) / 2;
      const labS = kit.surface({ w: LW - .05, h: LD - .05, ppu: 2048 / LW, base: { color: "#111214", rough: .4, metal: 0, height: .5 } });
      {
        const S = labS, hx = S.w / 2, hz = S.h / 2;
        const ink = c => ({ color: c, rough: .55, height: .505 });
        const white = ink("#eceef0"), grey = ink("#a3a8ae"), dim = ink("#6c7178"), orange = ink("#e3843f"), black = { color: "#0d0e10", rough: .5 };
        [[(CT.x - CT.s / 2 + DR.x + DR.w / 2) / 2, 2.4], [(DR.x - DR.w / 2 + NA[0].x + NW / 2) / 2, 2.3], [(NA[0].x - NW / 2 + NA[1].x + NW / 2) / 2, 2.4]]
          .forEach(([x, w]) => S.rect(x - LCX, 0, w, LD, { height: .45, blur: .3 }));
        S.poly([[-hx, -hz], [-hx + 19, -hz], [-hx + 12.5, hz], [-hx, hz]], { color: "#17181b" });
        S.poly([[-hx + 19.6, -hz], [-hx + 20.4, -hz], [-hx + 13.9, hz], [-hx + 13.1, hz]], { color: "#1a1b1f" });
        S.line([[-hx + 19, -hz], [-hx + 12.5, hz]], .06, orange);
        const X0 = -hx + 1.8;
        S.poly([[X0, -2.9], [X0 + 1.3, -5.35], [X0 + 2.6, -2.9]], white);
        S.poly([[X0 + .78, -2.9], [X0 + 1.3, -3.9], [X0 + 1.82, -2.9]], { color: "#111214" });
        S.rect(X0 + 1.3, -2.55, 2.6, .18, orange);
        S.text("AURION", X0 + 3.25, -4.05, 1.6, white, { align: "left", weight: 800, font: SANS, spacing: .34 });
        S.text("NOVA X7 PRO", X0, -1.2, .78, ink("#d5d8dc"), { align: "left", weight: 700, font: SANS, spacing: .22 });
        S.text("PCIe 4.0 ×4  ·  NVMe 2.0  ·  M.2 2280", X0, .25, .46, grey, { align: "left", weight: 500, font: SANS, spacing: .04 });
        S.text("2TB", X0 - .1, 4.55, 2.35, white, { align: "left", weight: 800, font: SANS, spacing: .1 });
        S.text("SOLID STATE DRIVE", X0 + 6.9, 3.75, .5, grey, { align: "left", weight: 700, font: SANS, spacing: .14 });
        S.text("UP TO 7,300 MB/s READ  ·  6,900 MB/s WRITE", X0 + 6.9, 4.85, .36, dim, { align: "left", weight: 600, font: SANS });
        for (let i = 0; i < 6; i++) S.poly([[X0 + 6.9 + i * .55, 6.2], [X0 + 7.2 + i * .55, 5.75], [X0 + 7.45 + i * .55, 5.75], [X0 + 7.15 + i * .55, 6.2]], i < 4 ? orange : dim);
        const RX = 8.3;
        S.line([[RX - .9, -hz + .8], [RX - .9, hz - .8]], .04, ink("#2a2d31"));
        ["MODEL  AR-NX7P-2T0", "P/N  4A21-2T00-B00", "S/N  NX7P24D09173K", "DC 3.3V  2.5A"]
          .forEach((t, i) => S.text(t, RX, -6.45 + i * .8, .36, i < 3 ? white : grey, { align: "left", weight: 600, font: SANS }));
        S.rect(20.55, -5.35, 3.7, 3.7, ink("#f1f1ee"), .12);
        qr(S, 20.55, -5.35, 3.2, 404, black);
        const bx = (RX + hx - .45) / 2;
        S.rect(bx, -1.75, hx - .45 - RX, 2.9, ink("#f1f1ee"), .1);
        barcode(S, bx, -2.05, hx - 1.3 - RX, 1.8, 77, black);
        S.text("NX7P24D09173K", bx, -.62, .3, black, { weight: 600, font: MONO, spacing: .12 });
        S.text("WARRANTY VOID IF LABEL IS DAMAGED OR REMOVED", RX, .55, .27, grey, { align: "left", weight: 600, font: SANS });
        S.text("COPPER HEAT-SPREADER LABEL · DO NOT REMOVE", RX, 1.15, .27, dim, { align: "left", weight: 600, font: SANS });
        const ix = RX + .6, iz = 3.05, stroke = grey;
        S.line([[ix - .45, iz - .55], [ix - .35, iz + .6], [ix + .35, iz + .6], [ix + .45, iz - .55], [ix - .45, iz - .55]], .06, stroke);
        S.line([[ix - .55, iz - .7], [ix + .55, iz - .7]], .06, stroke);
        S.line([[ix - .7, iz - .85], [ix + .7, iz + .85]], .06, stroke); S.line([[ix + .7, iz - .85], [ix - .7, iz + .85]], .06, stroke);
        S.rect(ix, iz + 1.05, 1.3, .18, stroke);
        S.strokeRect(ix + 2.1, iz, 1.7, .9, .05, stroke, .1); S.text("RoHS", ix + 2.1, iz, .38, stroke, { weight: 700, font: SANS });
        S.ring(ix + 4.1, iz, .42, .5, stroke); S.text("Pb", ix + 4.1, iz, .36, stroke, { weight: 700, font: SANS });
        S.line([[ix + 3.8, iz + .3], [ix + 4.4, iz - .3]], .05, stroke);
        S.text("Assembled in Taiwan", ix + 5, iz - .35, .3, grey, { align: "left", weight: 600, font: SANS });
        S.text("Designed by The Internals", ix + 5, iz + .35, .3, grey, { align: "left", weight: 600, font: SANS });
        S.rect(21.35, 3.1, 1.85, 1.85, ink("#f1f1ee"), .08);
        dmx(S, 21.35, 3.1, 1.5, 14, 55, black);
        S.rect((RX + hx) / 2 - .2, 5.9, hx - RX - .4, .12, orange);
        S.text("AURION.EXAMPLE/SUPPORT", RX, 6.6, .3, dim, { align: "left", weight: 600, font: SANS, spacing: .06 });
      }
      const labTop = labS.material({ normal: 1.5, fit: true });
      const cuS = kit.surface({ w: LW - .05, h: LD - .05, ppu: 22, base: { color: "#d68d5c", rough: .4, metal: 1, height: .5 } });
      {
        const S = cuS, r = kit.rng(31);
        S.noise(3000, .1, rr => ({ color: rr() < .5 ? "#a9653d" : "#d8946a", alpha: .3, height: .5 + (rr() - .5) * .1, size: .05 + rr() * .25 }), 32);
        for (let i = 0; i < 26; i++) {
          const x = (r() - .5) * S.w, z = (r() - .5) * S.h, a = r() * Math.PI, l = 1 + r() * 4;
          S.line([[x, z], [x + Math.cos(a) * l, z + Math.sin(a) * l]], .05 + r() * .06, { height: r() < .5 ? .44 : .56, color: "#b56f45", alpha: .6 });
        }
        [[CT.x, CT.lid, CT.lid], [DR.x, DR.w, DR.d], [NA[0].x, NW, ND], [NA[1].x, NW, ND]]
          .forEach(([x, w, d]) => S.strokeRect(x - LCX, 0, w, d, .1, { height: .45, color: "#b06b42", alpha: .7 }, .2));
      }
      const labBot = cuS.material({ normal: 3, fit: true });
      const label = part("label");
      add(label, slab(LW, LD, .1, .5, .025), [labTop, std({ color: 0x6b4a36, metalness: .7, roughness: .45 }), labBot], LCX, .05, 0);

      return {
        layout: {
          label: { y: Y0 + TOP + .002, dy: 14, dz: -8 },
          nand: { y: Y0, dy: 5 },
          dram: { y: Y0, dy: 6.2 },
          controller: { y: Y0, dy: 7.2 },
          pcb: { y: 0 },
          connector: { y: 0, dx: 6 }
        },
        anchors: {
          label: [4, .1, -7.95], nand: [-25, 1.1, 2], dram: [5.3, .95, 5], controller: [15.4, 1.1, 4.7],
          pcb: [-8, .3, 8.25], connector: [30.6, .33, -7.2]
        },
        hideWhenClosed: ["nand", "dram", "controller"]
      };
    }
  });
})();
