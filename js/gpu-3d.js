(function () {
  const root = document.getElementById("gpu3d");
  if (!root) return;
  const parts = [
    { id: "shroud", color: "#8593a5" },
    { id: "cooler", color: "#e38b4f" },
    { id: "gpu", color: "#5ac8e2" },
    { id: "vram", color: "#a594f5" },
    { id: "pcb", color: "#72d49c" },
    { id: "backplate", color: "#b9c3cf" }
  ];

  Internals.viewer3d(root, {
    prefix: "gpu.part", parts, initial: "gpu", explode: 0.7, yaw: -0.55,
    dist: [140, 158, 205], lookY: 9, elev: 0.52, flipSelect: "backplate",
    build(ctx) {
      const { THREE, part, add, roundBox } = ctx;
      const kit = ctx.kit, M = kit.mat, PI = Math.PI;
      const std = o => new THREE.MeshStandardMaterial(o);
      const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
      const noCast = m => { m.userData.noCast = true; return m; };
      const flatUp = (w, d) => { const g = new THREE.PlaneGeometry(w, d); g.rotateX(-PI / 2); return g; };
      const flatDown = (w, d) => { const g = new THREE.PlaneGeometry(w, d); g.rotateX(PI / 2); return g; };
      const poly = pts => { const s = new THREE.Shape(); pts.forEach(([x, y], i) => i ? s.lineTo(x, y) : s.moveTo(x, y)); s.closePath(); return s; };
      const rectPath = (x, y, w, h, r) => {
        const p = new THREE.Path(), X = x - w / 2, Y = y - h / 2; r = Math.min(r || 0, w / 2, h / 2);
        if (!r) { p.moveTo(X, Y); p.lineTo(X, Y + h); p.lineTo(X + w, Y + h); p.lineTo(X + w, Y); p.closePath(); return p; }
        p.moveTo(X + r, Y); p.absarc(X + r, Y + r, r, -PI / 2, -PI, true); p.lineTo(X, Y + h - r); p.absarc(X + r, Y + h - r, r, PI, PI / 2, true);
        p.lineTo(X + w - r, Y + h); p.absarc(X + w - r, Y + h - r, r, PI / 2, 0, true); p.lineTo(X + w, Y + r); p.absarc(X + w - r, Y + r, r, 0, -PI / 2, true);
        return p;
      };
      const extrudeZY = (shape, depth, x0, bevel) => {
        const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: !!bevel, bevelThickness: bevel || 0, bevelSize: bevel || 0, bevelSegments: 1, curveSegments: 6 });
        g.rotateY(-PI / 2); g.translate(x0 + depth, 0, 0); return g;
      };
      const fans = [];
      const _o = new THREE.Object3D();
      function merge(items) {
        const gs = items.map(([geo, x, y, z, ry, rx, rz, sc]) => {
          _o.position.set(x || 0, y || 0, z || 0); _o.rotation.set(rx || 0, ry || 0, rz || 0, "YXZ"); _o.scale.setScalar(sc || 1); _o.updateMatrix();
          const g = geo.clone(); g.applyMatrix4(_o.matrix); if (!g.attributes.normal) g.computeVertexNormals(); return g;
        });
        let nv = 0, ni = 0;
        gs.forEach(g => { nv += g.attributes.position.count; ni += g.index ? g.index.count : g.attributes.position.count; });
        const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), uv = new Float32Array(nv * 2), idx = new Uint32Array(ni);
        let v = 0, i = 0;
        gs.forEach(g => {
          const n = g.attributes.position.count;
          pos.set(g.attributes.position.array, v * 3); nor.set(g.attributes.normal.array, v * 3);
          if (g.attributes.uv) uv.set(g.attributes.uv.array, v * 2);
          if (g.index) { const a = g.index.array; for (let k = 0; k < a.length; k++) idx[i + k] = a[k] + v; i += a.length; }
          else { for (let k = 0; k < n; k++) idx[i + k] = v + k; i += n; }
          v += n; g.dispose();
        });
        const out = new THREE.BufferGeometry();
        out.setAttribute("position", new THREE.BufferAttribute(pos, 3)); out.setAttribute("normal", new THREE.BufferAttribute(nor, 3));
        out.setAttribute("uv", new THREE.BufferAttribute(uv, 2)); out.setIndex(new THREE.BufferAttribute(idx, 1));
        return out;
      }
      const speckle = (S, n, size, props, seed, sx) => {
        const r = kit.rng(seed);
        S.paint(props, c => { c.beginPath(); for (let k = 0; k < n; k++) c.rect(S.px(r() * S.w - S.w / 2), S.pz(r() * S.h - S.h / 2), Math.max(1, S.s(size * (sx || 1) * (.4 + r()))), Math.max(1, S.s(size))); c.fill(); });
      };

      const TOP = .15, BOT = -.15;
      const GX = -8.5, GZ = .3;
      const B = { x0: -29.6, x1: 14.5, z0: -11, z1: 11 };
      const TAB = { x0: -21.9, x1: -5.9, z: 12.55 };
      const memPos = [];
      [-3.05, 0, 3.05].forEach(dz => memPos.push([GX - 7.3, GZ + dz, PI / 2], [GX + 7.3, GZ + dz, PI / 2]));
      [-4.2, -1.4, 1.4, 4.2].forEach(dx => memPos.push([GX + dx, GZ - 7.0, 0]));
      [-2.4, 2.4].forEach(dx => memPos.push([GX + dx, GZ + 7.0, 0]));
      const chokePos = [], stagePos = [];
      for (let i = 0; i < 9; i++) { const z = -8.4 + i * 2; chokePos.push([2.4, z], [5.3, z]); stagePos.push([1.05, z], [3.95, z]); }
      for (let i = 0; i < 5; i++) { const z = -8.4 + i * 2; chokePos.push([-20.1, z]); stagePos.push([-18.75, z]); }
      const pcapPos = [];
      for (let i = 0; i < 9; i++) { const z = -8.6 + i * 1.9; pcapPos.push([6.95, z], [7.95, z]); }
      for (let i = 0; i < 5; i++) { const z = -8.6 + i * 1.95; pcapPos.push([-21.85, z], [-22.85, z]); }
      const bigCapPos = [[9.9, -7.7], [11.2, -7.7], [12.5, -7.7], [13.8, -7.7]];
      const inChokePos = [[10.5, -5.3], [12.8, -5.3]];
      const CONN = { x: 11.6, z: -10.0, w: 3.9, h: 1.85, d: 2.0 };
      const PORTS = [[8.9, "dp"], [5.2, "dp"], [1.5, "hdmi"], [-2.2, "dp"]];
      const PORT_X0 = -29.95, PORT_D = 3.15;
      const mountHoles = [[GX - 5.0, GZ - 5.0], [GX + 5.0, GZ - 5.0], [GX - 5.0, GZ + 5.0], [GX + 5.0, GZ + 5.0]];
      const boardHoles = [[-27.9, -9.9], [-27.9, 9.9], [-14.3, -10.2], [-1.0, 9.9], [13.4, -3.2], [13.4, 9.6], [8.9, 9.9]];
      const ics = [
        { x: 10.9, z: -1.4, w: 1.1, d: 1.1, pkg: "qfn", lines: ["AUR 7108", "2437 C3"] },
        { x: 12.9, z: 1.3, w: .8, d: .8, pkg: "qfn", lines: ["AUR 5210", "B4"] },
        { x: -3.2, z: -9.35, w: .95, d: .7, pkg: "sop", lines: ["25Q16", "AX97"] },
        { x: -24.2, z: 4.4, w: 1.3, d: 1.3, pkg: "qfn", lines: ["KSTL", "HR21", "24A"] },
        { x: 12.4, z: 4.2, w: .9, d: .9, pkg: "qfn", lines: ["RGB", "M0 32"] }
      ];

      const occ = [];
      const take = (x, z, w, d, m = .12) => occ.push([x - w / 2 - m, z - d / 2 - m, x + w / 2 + m, z + d / 2 + m]);
      const isFree = (x, z, w, d) => x - w / 2 > B.x0 + .35 && x + w / 2 < B.x1 - .35 && z - d / 2 > B.z0 + .35 && z + d / 2 < B.z1 - .3 &&
        !occ.some(o => x + w / 2 > o[0] && x - w / 2 < o[2] && z + d / 2 > o[1] && z - d / 2 < o[3]);
      memPos.forEach(([x, z, r]) => r ? take(x, z, 2.2, 2.5) : take(x, z, 2.5, 2.2));
      take(GX, GZ, 8.4, 8.4, .1);
      chokePos.forEach(([x, z]) => take(x, z, 1.35, 1.35, .18));
      stagePos.forEach(([x, z]) => take(x, z, 1.0, .85, .1));
      pcapPos.forEach(([x, z]) => take(x, z, .84, .84, .06));
      bigCapPos.forEach(([x, z]) => take(x, z, 1.0, 1.0));
      inChokePos.forEach(([x, z]) => take(x, z, 1.6, 1.6));
      take(CONN.x, CONN.z, CONN.w, CONN.d + .2, .25);
      take(-28.0, 3.6, 3.6, 14.6, .1);
      mountHoles.concat(boardHoles).forEach(([x, z]) => take(x, z, .9, .9, .05));
      ics.forEach(c => take(c.x, c.z, c.w + (c.pkg === "sop" ? .4 : 0), c.d, .12));
      take(11.2, 7.3, 1.2, .6, .15); take(11.2, 8.8, .95, .6, .15);
      take(-5.2, -10.35, 1.1, .55, .1);
      take(-13, 10.8, 18, .6, 0);

      const rnd = kit.rng(97);
      const smallC = [], midC = [], resist = [];
      const put = (list, x, z, ry, l, w) => { const hw = ry ? w : l, hd = ry ? l : w; if (!isFree(x, z, hw, hd)) return false; list.push([x, z, ry]); take(x, z, hw, hd, .04); return true; };
      memPos.forEach(([x, z, r]) => {
        const along = r ? [0, 1] : [1, 0], hl = r ? 1.25 : 1.1;
        for (let k = -3; k <= 3; k++) for (const sd of [-1, 1]) {
          const cx = x + along[0] * k * .33 + (r ? sd * 1.3 : 0), cz = z + along[1] * k * .33 + (r ? 0 : sd * (hl + .22));
          put(k % 2 ? smallC : midC, cx, cz, r ? 0 : PI / 2, .3, .15);
        }
      });
      for (let a = 0; a < 56; a++) {
        const s = Math.floor(a / 14), t = (a % 14 - 6.5) * .55, off = 4.62;
        const [cx, cz] = [[t, -off], [off, t], [t, off], [-off, t]][s];
        put(smallC, GX + cx, GZ + cz, s % 2 ? 0 : PI / 2, .2, .1);
      }
      stagePos.forEach(([x, z]) => { put(midC, x - .2, z + .62, 0, .3, .15); put(resist, x + .3, z + .62, 0, .2, .1); put(smallC, x - .55, z - .6, PI / 2, .2, .1); });
      for (let i = 0; i < 2600 && smallC.length + midC.length + resist.length < 900; i++) {
        const x = B.x0 + rnd() * (B.x1 - B.x0), z = B.z0 + rnd() * (B.z1 - B.z0), ry = rnd() < .5 ? 0 : PI / 2, k = rnd();
        if (k < .5) put(smallC, x, z, ry, .2, .1); else if (k < .8) put(resist, x, z, ry, .2, .1); else put(midC, x, z, ry, .3, .15);
        if (k < .3) for (let j = 1; j < 4; j++) put(smallC, x + (ry ? .2 * j : 0), z + (ry ? 0 : .2 * j), ry, .2, .1);
      }

      const pcb = part("pcb");
      const BW = B.x1 - B.x0, BD = TAB.z - B.z0, CX = (B.x0 + B.x1) / 2, CZ = (B.z0 + TAB.z) / 2;
      const lx = x => x - CX, lz = z => z - CZ;
      const pads2 = (P, x, z, ry, l, w) => {
        const e = l * .28;
        if (ry) { P.pad(lx(x), lz(z - l / 2 + e / 2), w * 1.15, e * 1.2); P.pad(lx(x), lz(z + l / 2 - e / 2), w * 1.15, e * 1.2); }
        else { P.pad(lx(x - l / 2 + e / 2), lz(z), e * 1.2, w * 1.15); P.pad(lx(x + l / 2 - e / 2), lz(z), e * 1.2, w * 1.15); }
      };
      const keepTop = [[lx(GX), lz(GZ), 8.6, 8.6]].concat(memPos.map(([x, z]) => [lx(x), lz(z), 2.6, 2.6]));
      const topP = kit.pcb({ w: BW, d: BD, ppu: 2048 / BW, mask: "black", finish: "tin", seed: 23, traces: 90, vias: 520, keep: keepTop, draw(P) {
        const silk = P.silkP, lw = .045;
        for (let i = 0; i < 82; i++) {
          const x = i < 11 ? -21.72 + i * .182 : -19.27 + (i - 11) * .182;
          P.trace([[lx(x), lz(11.5)], [lx(x), lz(10.95)], [lx(x + (x < -13 ? .35 : -.35)), lz(10.4)]], .07);
          if (i % 3 === 0) P.via(lx(x + (x < -13 ? .35 : -.35)), lz(10.3 - (i % 2) * .2), .07);
        }
        memPos.forEach(([x, z, r], k) => {
          const w = r ? 2.2 : 2.5, d = r ? 2.5 : 2.2;
          [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => {
            P.line([[lx(x + sx * (w / 2 + .12)), lz(z + sz * (d / 2 - .25))], [lx(x + sx * (w / 2 + .12)), lz(z + sz * (d / 2 + .12))], [lx(x + sx * (w / 2 - .25)), lz(z + sz * (d / 2 + .12))]], lw, silk);
          });
          P.ref("M" + (k + 1), lx(x + (r ? 0 : -w / 2 - .35)), lz(z + (r ? -d / 2 - .3 : 0)), .17, r ? 0 : -PI / 2);
        });
        P.outline(lx(GX), lz(GZ), 8.75, 8.75, lw);
        P.poly([[lx(GX - 4.6), lz(GZ - 4.6)], [lx(GX - 3.9), lz(GZ - 4.6)], [lx(GX - 4.6), lz(GZ - 3.9)]], silk);
        P.ref("U1", lx(GX + 3.6), lz(GZ + 4.72), .2);
        [[GX - 5.8, GZ - 3.2], [GX + 5.8, GZ + 3.4], [-26.5, -10.3], [13.9, 10.3]].forEach(([x, z]) => P.fiducial(lx(x), lz(z), .1));
        chokePos.forEach(([x, z], k) => {
          [-1, 1].forEach(sd => P.pad(lx(x + sd * .64), lz(z), .3, .95));
          P.ref("L" + (k + 1), lx(x), lz(z + .86), .13);
        });
        stagePos.forEach(([x, z], k) => { P.pad(lx(x), lz(z), 1.08, .92); P.outline(lx(x), lz(z), 1.2, 1.02, .03); P.ref("Q" + (k + 1), lx(x - .1), lz(z - .62), .11); });
        pcapPos.concat(bigCapPos).forEach(([x, z], k) => {
          const r = k < pcapPos.length ? .46 : .54;
          P.ring(lx(x), lz(z), r, r + .05, silk);
          P.paint(silk, c => { c.beginPath(); c.arc(P.px(lx(x)), P.pz(lz(z)), P.s(r), PI * .5, PI * 1.5); c.closePath(); c.globalAlpha = .45; c.fill(); });
          P.ref("C" + (301 + k), lx(x + r + .28), lz(z), .11, -PI / 2);
        });
        inChokePos.forEach(([x, z], k) => { [-1, 1].forEach(sd => P.pad(lx(x + sd * .75), lz(z), .3, 1.1)); P.ref("L" + (40 + k), lx(x), lz(z + 1.05), .14); });
        smallC.forEach(([x, z, r]) => pads2(P, x, z, r, .2, .1));
        midC.forEach(([x, z, r]) => pads2(P, x, z, r, .3, .15));
        resist.forEach(([x, z, r]) => pads2(P, x, z, r, .2, .1));
        ics.forEach(c => { P.outline(lx(c.x), lz(c.z), c.w + .25, c.d + .25, .03, true); P.pad(lx(c.x), lz(c.z), c.w * .6, c.d * .6); });
        mountHoles.forEach(([x, z]) => P.hole(lx(x), lz(z), .2, .2));
        boardHoles.forEach(([x, z]) => P.hole(lx(x), lz(z), .17, .17));
        const tp = kit.rng(5);
        for (let i = 0; i < 70; i++) {
          const x = B.x0 + 1 + tp() * (BW - 2), z = B.z0 + .6 + tp() * 21;
          if (isFree(x, z, .2, .2)) { P.circle(lx(x), lz(z), .07, P.padP); if (tp() < .4) P.ref("TP" + (10 + i), lx(x), lz(z + .18), .08); }
        }
        const T = (s, x, z, sz, rot, wt) => P.text(s, lx(x), lz(z), sz, silk, { rot, weight: wt || 600 });
        T("AURION  AX-9700 XT", -10.6, 9.75, .34, 0, 700);
        T("PCB-A97G-V102   E2438-0117", -10.6, 10.3, .18);
        T("PCIe x16", -2.6, 10.3, .2);
        T("12V-2x6", CONN.x, CONN.z + 1.55, .2);
        T("600W MAX", CONN.x + 2.3, CONN.z + .3, .13, -PI / 2);
        T("BIOS", -5.2, -9.75, .15);
        T("OC", -6.05, -10.35, .12); T("Q", -4.4, -10.35, .12);
        T("FAN1", 11.2, 6.7, .13); T("ARGB", 11.2, 9.4, .13);
        T("THE INTERNALS", 9.0, 8.6, .16, -PI / 2);
        T("94V-0", 8.85, 3.3, .13, -PI / 2);
        T("MADE FOR TEACHING", -24.4, -9.9, .14);
        T("NVDD", 3.3, -9.9, .15); T("MVDD", -20.1, -9.95, .15);
        T("DP1", -25.9, 8.9, .12, -PI / 2); T("DP2", -25.9, 5.2, .12, -PI / 2); T("HDMI", -25.9, 1.5, .12, -PI / 2); T("DP3", -25.9, -2.2, .12, -PI / 2);
      } });
      const topMat = topP.material({ fit: true, normal: 3 });
      [topMat.map, topMat.normalMap, topMat.roughnessMap].forEach(t => { t.repeat.set(1 / BW, 1 / BD); t.offset.set(.5 - CX / BW, .5 + CZ / BD); });

      const botP = kit.pcb({ w: BW, d: BD, ppu: 1400 / BW, mask: "black", finish: "tin", seed: 31, traces: 70, vias: 420, underside: true, draw(P) {
        const silk = P.silkP;
        P.outline(lx(GX), lz(GZ), 7.6, 7.6, .04);
        for (let i = 0; i < 13; i++) for (let j = 0; j < 13; j++) P.pad(lx(GX - 3.3 + i * .55), lz(GZ - 3.3 + j * .55), .26, .16);
        mountHoles.forEach(([x, z]) => P.hole(lx(x), lz(z), .2, .2));
        boardHoles.forEach(([x, z]) => P.hole(lx(x), lz(z), .17, .17));
        memPos.forEach(([x, z, r]) => P.outline(lx(x), lz(z), r ? 2.2 : 2.5, r ? 2.5 : 2.2, .03));
        P.text("AURION AX-9700 XT  REV 1.02", lx(-10), lz(-9.8), .3, silk, { weight: 700 });
        P.text("SN 24380117-00482", lx(4), lz(-9.8), .2, silk);
        [[-24, 6], [-20, -4], [4, 5], [10, -3]].forEach(([x, z], k) => P.ref("C" + (801 + k * 7), lx(x), lz(z), .14));
      } });
      const botMat = botP.material({ fit: true, normal: 2 });
      [botMat.map, botMat.normalMap, botMat.roughnessMap].forEach(t => { t.repeat.set(1 / BW, 1 / BD); t.offset.set(.5 - CX / BW, .5 + CZ / BD); });

      const outline = [[B.x0, B.z0], [B.x1 - .3, B.z0], [B.x1, B.z0 + .3], [B.x1, B.z1 - .3], [B.x1 - .3, B.z1],
        [TAB.x1 + .9, B.z1], [TAB.x1 + .9, B.z1 + .3], [TAB.x1, B.z1 + .3], [TAB.x1, TAB.z - .12], [TAB.x1 - .12, TAB.z],
        [-19.4, TAB.z], [-19.4, 11.3], [-19.75, 11.3], [-19.75, TAB.z], [TAB.x0 + .12, TAB.z], [TAB.x0, TAB.z - .12], [TAB.x0, B.z1], [B.x0, B.z1]];
      kit.board(pcb, { shape: poly(outline.map(([x, z]) => [x, -z])), t: .3, y: 0, top: topMat, bottom: botMat,
        edgeMat: std({ color: 0x2e2c24, roughness: .7 }), holes: mountHoles.map(([x, z]) => [x, z, .2]).concat(boardHoles.map(([x, z]) => [x, z, .17])) });
      const fingerList = [];
      for (let i = 0; i < 82; i++) {
        const x = i < 11 ? -21.72 + i * .182 : -19.27 + (i - 11) * .182, short = i === 16 || i === 48 || i === 80;
        [TOP + .01, BOT - .01].forEach(y => fingerList.push([x, y, short ? 12.05 : 11.95, 0, 0, 0, 1, 1, short ? .8 : 1]));
      }
      noCast(kit.place(pcb, box(.125, .02, 1.0), M.gold(), fingerList));

      kit.choke(pcb, chokePos.map(([x, z]) => [x, TOP, z]), { w: 1.35, d: 1.35, h: .95, text: "R22" });
      kit.choke(pcb, inChokePos.map(([x, z]) => [x, TOP, z]), { w: 1.35, d: 1.35, h: 1.0, text: "R22" });
      kit.place(pcb, roundBox(1.0, .14, .85, .05, .02), M.epoxy(), stagePos.map(([x, z]) => [x, TOP + .07, z]));
      noCast(kit.place(pcb, flatUp(.94, .8), kit.marking(1.0, .85, { lines: ["AP7050", "D2436"], ink: "#6a6d72" }), stagePos.map(([x, z]) => [x, TOP + .145, z])));
      kit.polycap(pcb, pcapPos.map(([x, z]) => [x, TOP, z]), { r: .42, h: .95, band: "#4b3a78", text: "470" });
      kit.polycap(pcb, bigCapPos.map(([x, z]) => [x, TOP, z]), { r: .5, h: 1.0, band: "#7a1f24", text: "560" });
      kit.mlcc(pcb, smallC.map(([x, z, r]) => [x, TOP, z, r]), { l: .2, w: .1, h: .1 });
      kit.mlcc(pcb, midC.map(([x, z, r]) => [x, TOP, z, r]), { l: .3, w: .15, h: .15 });
      kit.mlcc(pcb, resist.map(([x, z, r]) => [x, TOP, z, r]), { l: .2, w: .1, h: .07, color: "#17181a" });
      ics.forEach(c => kit.ic(pcb, { x: c.x, y: TOP, z: c.z, w: c.w, d: c.d, h: c.pkg === "sop" ? .22 : .14, pkg: c.pkg, lines: c.lines, leads: c.pkg === "sop" ? 4 : undefined }));
      kit.crystal(pcb, [[12.1, TOP, -3.0, 0]], { l: .6, w: .3, h: .14 });
      kit.header(pcb, { x: 11.2, y: TOP, z: 7.3, cols: 4, rows: 1, pitch: .23, h: .6, shroud: true });
      kit.header(pcb, { x: 11.2, y: TOP, z: 8.8, cols: 3, rows: 1, pitch: .23, h: .6, shroud: true });
      add(pcb, roundBox(.95, .24, .45, .04, .02), M.plastic(), -5.2, TOP + .12, -10.35);
      add(pcb, roundBox(.24, .12, .2, .03, .02), M.whitePlastic(), -5.46, TOP + .28, -10.35);

      add(pcb, roundBox(CONN.w, CONN.h, CONN.d, .1, .05), M.plastic(), CONN.x, TOP + CONN.h / 2, CONN.z);
      add(pcb, box(.8, .14, .42), M.plastic(), CONN.x, TOP + CONN.h + .06, CONN.z - .72);
      const connFace = kit.surface({ w: CONN.w - .1, h: CONN.h - .1, ppu: 150, base: { color: "#161719", rough: .6, metal: 0, height: .5 } });
      for (let i = 0; i < 6; i++) for (let j = 0; j < 2; j++) {
        const x = (i - 2.5) * .55, z = .05 + j * .56, s = .43, c = (i + j) % 3 === 0 ? .12 : 0;
        const pts = [[x - s / 2 + c, z - s / 2], [x + s / 2, z - s / 2], [x + s / 2, z + s / 2], [x - s / 2, z + s / 2], [x - s / 2, z - s / 2 + c]];
        connFace.poly(pts, { color: "#060607", height: .08, rough: .9 });
        connFace.rect(x, z, .17, .17, { color: "#8d9095", height: .2, rough: .35, metal: 1 });
        connFace.circle(x, z, .045, { color: "#0b0b0c", height: .12 });
      }
      for (let j = 0; j < 4; j++) connFace.rect((j - 1.5) * .5, -.62, .2, .2, { color: "#050506", height: .1, rough: .9 }, .03);
      connFace.rect(0, -.8, .8, .1, { color: "#0c0c0d", height: .3 });
      const face = add(pcb, new THREE.PlaneGeometry(CONN.w - .1, CONN.h - .1), connFace.material({ normal: 4 }), CONN.x, TOP + CONN.h / 2, CONN.z - CONN.d / 2 - .004);
      face.rotation.y = PI; noCast(face);

      const portPts = (kind, W, H, c) => kind === "dp"
        ? [[-W / 2, -H / 2 + c], [-W / 2 + c, -H / 2], [W / 2, -H / 2], [W / 2, H / 2], [-W / 2, H / 2]]
        : [[-W / 2, H / 2], [-W / 2, -H / 2 + c], [-W / 2 + c, -H / 2], [W / 2 - c, -H / 2], [W / 2, -H / 2 + c], [W / 2, H / 2]];
      const portSize = k => k === "dp" ? [2.95, .88, .32] : [2.75, .84, .28];
      const PY = TOP + .46;
      const shells = [], tongues = [], contacts = [];
      PORTS.forEach(([z, k]) => {
        const [W, H, c] = portSize(k), t = .06;
        const sh = poly(portPts(k, W, H, c));
        const hole = new THREE.Path(); portPts(k, W - 2 * t, H - 2 * t, c - .02).forEach(([a, b], i) => i ? hole.lineTo(a, b) : hole.moveTo(a, b)); hole.closePath();
        sh.holes.push(hole);
        shells.push([extrudeZY(sh, PORT_D, PORT_X0), 0, PY, z]);
        shells.push([box(.2, H * 1.05, W * 1.05), PORT_X0 + .35, PY, z]);
        tongues.push([box(PORT_D - .5, .16, W * .7), PORT_X0 + .3 + (PORT_D - .5) / 2, PY + (k === "dp" ? .1 : 0), z]);
        tongues.push([box(.5, H - .14, W - .14), PORT_X0 + PORT_D - .3, PY, z]);
        const n = k === "dp" ? 10 : 10;
        for (let i = 0; i < n; i++) [1, -1].forEach(sd => { if (k === "hdmi" && sd < 0 && i === 9) return; contacts.push([PORT_X0 + 1.1, PY + (k === "dp" ? .1 : 0) + sd * .085, z + (i - (n - 1) / 2) * W * .065]); });
        [-1, 1].forEach(sd => shells.push([box(.3, .12, .12), PORT_X0 + 1.4, TOP - .02, z + sd * (W / 2 - .2)]));
      });
      add(pcb, merge(shells), M.tin());
      add(pcb, merge(tongues), M.plastic());
      noCast(kit.place(pcb, box(1.6, .012, .07), M.gold(), contacts));
      const BY0 = -.8, BY1 = 9.2;
      const plate = poly([[-11.5, BY0], [11.3, BY0], [11.3, -.3], [13.0, -.3], [13.5, .4], [13.0, 1.2], [11.3, 1.4], [11.3, BY1], [-11.2, BY1], [-11.5, BY1 - .3]]);
      PORTS.forEach(([z, k]) => {
        const [W, H, c] = portSize(k), h = new THREE.Path();
        portPts(k, W + .14, H + .14, c + .04).forEach(([a, b], i) => i ? h.lineTo(z + a, PY + b) : h.moveTo(z + a, PY + b)); h.closePath();
        plate.holes.push(h);
      });
      const bars = [];
      [[3.0, -10.75, 10.8], [4.55, -10.75, 10.8], [6.1, -10.75, 10.8], [7.65, -10.75, 10.8], [1.0, -10.75, -4.1]].forEach(([y, z0, z1]) => {
        plate.holes.push(rectPath((z0 + z1) / 2, y, z1 - z0, 1.3, .15));
        for (let z = z0 + .56; z < z1 - .2; z += .74) bars.push([box(.15, 1.34, .36), -29.925, y, z]);
      });
      const plateGeo = new THREE.ExtrudeGeometry(plate, { depth: .15, bevelEnabled: false, curveSegments: 3 });
      plateGeo.rotateY(-PI / 2); plateGeo.translate(-29.85, 0, 0);
      const tabPts = [[-30, BY0], [-28.2, BY0]];
      [1.0, 4.7, 8.4].forEach(y => tabPts.push([-28.2, y - .28], [-28.85, y - .28], [-28.85, y + .28], [-28.2, y + .28]));
      tabPts.push([-28.2, BY1], [-30, BY1]);
      const tabGeo = new THREE.ExtrudeGeometry(poly(tabPts), { depth: .15, bevelEnabled: false });
      tabGeo.translate(0, 0, -11.65);
      add(pcb, merge([[plateGeo, 0, 0, 0], [tabGeo, 0, 0, 0]].concat(bars)), M.steel());

      const backCaps = [];
      for (let i = 0; i < 13; i++) for (let j = 0; j < 13; j++) if (Math.abs(i - 6) > 1 || Math.abs(j - 6) > 1) backCaps.push([GX - 3.3 + i * .55, BOT - .15, GZ - 3.3 + j * .55, 0]);
      const bk = kit.rng(12);
      for (let i = 0; i < 160; i++) {
        const x = B.x0 + 1 + bk() * (BW - 2), z = B.z0 + .8 + bk() * 20.4;
        if (Math.abs(x - GX) < 5.5 && Math.abs(z - GZ) < 5.5) continue;
        backCaps.push([x, BOT - .15, z, bk() < .5 ? 0 : PI / 2]);
      }
      kit.mlcc(pcb, backCaps, { l: .3, w: .15, h: .15 });

      const gpu = part("gpu");
      const SUB = 8.4, SY = TOP + .04, DIE = [4.6, 4.2];
      const subP = kit.surface({ w: SUB, h: SUB, ppu: 72, base: { color: "#2a3f2c", rough: .42, metal: 0, height: .5 } });
      speckle(subP, 4500, .04, { color: "#1f3322", alpha: .5 }, 3); speckle(subP, 4500, .04, { color: "#35503a", alpha: .5 }, 4);
      for (let i = 0; i < 40; i++) {
        const a = i / 40 * PI * 2, r0 = 2.6 + (i % 3) * .1;
        subP.line([[Math.cos(a) * r0, Math.sin(a) * r0], [Math.cos(a) * 3.9, Math.sin(a) * 3.9]], .03, { color: "#36553b", height: .54, alpha: .6 });
      }
      const subCaps = [];
      for (let i = 0; i < 12; i++) {
        const t = (i - 5.5) * .34;
        subCaps.push([t, -2.72, 0], [t, 2.72, 0], [-2.92, t, PI / 2], [2.92, t, PI / 2]);
        if (i > 1 && i < 10) subCaps.push([t, -3.05, 0], [t, 3.05, 0]);
      }
      subCaps.forEach(([x, z, r]) => { const e = [.09, 0]; subP.rect(x + (r ? 0 : -e[0]), z + (r ? -e[0] : 0), r ? .13 : .07, r ? .07 : .13, { color: "#d4b066", metal: 1, rough: .3, height: .56 }); subP.rect(x + (r ? 0 : e[0]), z + (r ? e[0] : 0), r ? .13 : .07, r ? .07 : .13, { color: "#d4b066", metal: 1, rough: .3, height: .56 }); });
      const ink = { color: "#dfe3da", rough: .7, height: .53, alpha: .85 };
      subP.text("AX102-400-A1", 0, 3.55, .2, ink, { weight: 700 });
      subP.text("2438A1  TAIWAN", 0, 3.85, .13, ink);
      subP.text("TI", -3.62, -3.7, .16, ink, { weight: 800 });
      const dm = kit.rng(44);
      for (let i = 0; i < 12; i++) for (let j = 0; j < 12; j++) if (i === 0 || j === 11 || (dm() < .5 && i > 0 && j < 11)) subP.rect(3.15 + i * .045, -3.95 + j * .045, .045, .045, { color: "#dfe3da", alpha: .9 });
      subP.circle(-3.95, 3.95, .08, { color: "#d4b066", metal: 1, rough: .3 });
      const subMat = subP.material({ fit: true, normal: 2 });
      add(gpu, roundBox(SUB, .18, SUB, .2, .03), [subMat, std({ color: 0x223024, roughness: .5 })], GX, SY + .09, GZ);
      kit.mlcc(gpu, subCaps.map(([x, z, r]) => [GX + x, SY + .18, GZ + z, r]), { l: .2, w: .1, h: .1 });
      const ring = kit.shapeRect(8.0, 8.0, .35); ring.holes.push(rectPath(0, 0, 6.9, 6.9, .3));
      add(gpu, kit.extrude(ring, .1, .02), M.nickel(), GX, SY + .23, GZ);
      const dieP = kit.surface({ w: DIE[0], h: DIE[1], ppu: 90, base: { color: "#1e2129", rough: .06, metal: .9, height: .5 } });
      dieP.rect(0, 0, DIE[0] - .1, DIE[1] - .1, { color: "#232731", alpha: .6 });
      dieP.text("AX102", -1.55, 1.82, .14, { color: "#3a3f4a", rough: .25, alpha: .8 }, { align: "left" });
      dieP.text("P4K812.00  2436", 1.9, 1.82, .1, { color: "#3a3f4a", rough: .25, alpha: .8 }, { align: "right" });
      add(gpu, roundBox(DIE[0], .15, DIE[1], .04, .015), [dieP.material({ fit: true, normal: 1 }), std({ color: 0x3a3d44, metalness: .6, roughness: .3 })], GX, SY + .18 + .075, GZ);
      add(gpu, roundBox(DIE[0] + .16, .05, DIE[1] + .16, .1, .02), std({ color: 0x1b1d17, roughness: .35 }), GX, SY + .205, GZ);

      const vram = part("vram");
      const MW = 2.4, MD = 2.1;
      kit.place(vram, roundBox(2.5, .05, 2.2, .05, .01), std({ color: 0x24302a, roughness: .5 }), memPos.map(([x, z, r]) => [x, TOP + .045, z, r]));
      kit.place(vram, roundBox(MW, .15, MD, .06, .025), M.epoxy(), memPos.map(([x, z, r]) => [x, TOP + .145, z, r]));
      noCast(kit.place(vram, flatUp(MW - .08, MD - .08), kit.marking(MW, MD, { lines: ["M7G16-32KX", "GDDR7 16Gb 32G", "2436 TW 0Z81"], logo: "AURMEM", ink: "#8c9096" }), memPos.map(([x, z, r]) => [x, TOP + .224, z, r])));

      const cooler = part("cooler");
      const FX0 = -27.2, FX1 = 28.2, FP = .34, FY0 = 2.2, FY1 = 6.4, FZ = 10.4, FLOW = 14.9;
      add(cooler, roundBox(11, .45, 11, .5, .06), M.nickel(), GX, .825, GZ);
      add(cooler, roundBox(5.2, .08, 4.8, .15, .02), M.chrome(), GX, .56, GZ);
      const pipeZ = [-4.5, -2.7, -.9, .9, 2.7, 4.5].map(z => GZ + z), PR = .42, pipeGeos = [], collars = [];
      const V = (x, y, z) => new THREE.Vector3(x, y, z);
      const tip = (x, y, z, dir) => {
        const dome = new THREE.SphereGeometry(PR, 12, 8, 0, PI * 2, 0, PI / 2); dome.scale(1, .55, 1); dome.rotateZ(-dir * PI / 2);
        pipeGeos.push([dome, x, y, z], [box(.35, .1, PR * 1.3), x + dir * (PR * .55 + .12), y, z]);
      };
      pipeZ.forEach((z, i) => {
        const dir = i % 2 ? -1 : 1, yu = 3.25 + Math.floor(i / 2) * .95, yl = 1.95;
        const xe = dir > 0 ? 28.45 : -27.35, R = (yu - yl) / 2, k = .5523 * R;
        const xs = GX - dir * 5.5, xr = GX + dir * 3.4, xback = dir > 0 ? GX + 1.5 : 5.5;
        const path = new THREE.CurvePath();
        path.add(new THREE.LineCurve3(V(xs, 1.47, z), V(xr, 1.47, z)));
        path.add(new THREE.CubicBezierCurve3(V(xr, 1.47, z), V(xr + dir * 1.1, 1.47, z), V(xr + dir * 1.1, yl, z), V(xr + dir * 2.2, yl, z)));
        path.add(new THREE.LineCurve3(V(xr + dir * 2.2, yl, z), V(xe, yl, z)));
        path.add(new THREE.CubicBezierCurve3(V(xe, yl, z), V(xe + dir * k, yl, z), V(xe + dir * R, yl + R - k, z), V(xe + dir * R, yl + R, z)));
        path.add(new THREE.CubicBezierCurve3(V(xe + dir * R, yl + R, z), V(xe + dir * R, yu - R + k, z), V(xe + dir * k, yu, z), V(xe, yu, z)));
        path.add(new THREE.LineCurve3(V(xe, yu, z), V(xback, yu, z)));
        pipeGeos.push([new THREE.TubeGeometry(path, Math.ceil(path.getLength() / .28), PR, 12, false), 0, 0, 0]);
        tip(xs, 1.47, z, -dir); tip(xback, yu, z, -dir);
        for (let n = 0; ; n++) {
          const x = FX0 + n * FP; if (x > FX1) break;
          if ((dir > 0 && x > xback && x < xe) || (dir < 0 && x < xback && x > xe)) collars.push([x, yu, z]);
          if (x > FLOW && dir > 0) collars.push([x, yl, z]);
        }
      });
      add(cooler, merge(pipeGeos), M.nickel());
      const collarGeo = new THREE.CylinderGeometry(PR + .035, PR + .035, .2, 14, 1, true); collarGeo.rotateZ(PI / 2);
      kit.place(cooler, collarGeo, M.alu(), collars);
      const finShape = (y0, y1) => poly([[-FZ, y0], [FZ, y0], [FZ, y1 - .5], [FZ - .5, y1], [-FZ + .5, y1], [-FZ, y1 - .5]]);
      const finGeo = (y0, y1) => {
        const g = new THREE.ExtrudeGeometry(finShape(y0, y1), { depth: .05, bevelEnabled: false }); g.rotateY(-PI / 2); g.translate(.025, 0, 0);
        return merge([[g, 0, 0, 0], [box(.16, .03, 2 * FZ - 1), 0, y1 - .015, 0], [box(.16, .5, .03), 0, (y0 + y1) / 2, FZ], [box(.16, .5, .03), 0, (y0 + y1) / 2, -FZ]]);
      };
      const finsA = [], finsB = [];
      for (let n = 0; ; n++) { const x = FX0 + n * FP; if (x > FX1) break; (x > FLOW ? finsB : finsA).push([x, 0, 0]); }
      kit.place(cooler, finGeo(FY0, FY1), M.alu(), finsA);
      kit.place(cooler, finGeo(-.3, FY1), M.alu(), finsB);
      const mid = poly([[-28.9, 10.75], [9.3, 10.75], [9.3, 8.6], [13.9, 8.6], [13.9, 10.75], [14.3, 10.35], [14.3, -10.35], [13.9, -10.75], [-28.9, -10.75]]);
      mid.holes.push(rectPath(GX, -GZ, 11.5, 11.5, .5));
      for (let k = 0; k < 4; k++) mid.holes.push(rectPath(9.8 + k * 1.05, -3.5, .5, 9, .25));
      for (let k = 0; k < 6; k++) mid.holes.push(rectPath(-26.3 + k * 1.05, 5.5, .5, 7.5, .25));
      const midItems = [[kit.extrude(mid, .25, .03, 4), 0, 1.375, 0]], padItems = [];
      memPos.forEach(([x, z, r]) => { midItems.push([box(2.2, .76, 1.9), x, .87, z, r]); padItems.push([box(2.3, .12, 2.0), x, .43, z, r]); });
      [[1.05, -.4, 16.8], [3.95, -.4, 16.8], [-18.75, -4.4, 8.8]].forEach(([x, z, d]) => { midItems.push([box(.95, .84, d), x, .83, z]); padItems.push([box(1.0, .12, d + .2), x, .35, z]); });
      [[2.4, -.4, 17.4], [5.3, -.4, 17.4], [-20.1, -4.4, 9.4]].forEach(([x, z, d]) => padItems.push([box(1.3, .15, d), x, 1.175, z]));
      inChokePos.forEach(([x, z]) => padItems.push([box(1.55, .1, 1.55), x, 1.2, z]));
      add(cooler, merge(midItems), std({ color: 0x1b1c20, metalness: .45, roughness: .55, normalMap: kit.tiles.grain(), normalScale: new THREE.Vector2(.35, .35) }));
      add(cooler, merge(padItems), std({ color: 0x6d8198, roughness: .88, metalness: 0 }));
      const xb = [];
      [PI / 4, -PI / 4].forEach(a => xb.push([box(14.9, .1, .9), GX, -.41, GZ, a]));
      mountHoles.forEach(([x, z]) => xb.push([new THREE.CylinderGeometry(.6, .6, .1, 20), x, -.41, z]));
      add(cooler, merge(xb), M.blackMetal());
      const posts = [], springs = [];
      class Helix extends THREE.Curve {
        getPoint(t) { const a = t * PI * 2 * 3.5; return new THREE.Vector3(Math.cos(a) * .24, -.46 - t * .12, Math.sin(a) * .24); }
      }
      const helix = new THREE.TubeGeometry(new Helix(), 64, .035, 6, false);
      mountHoles.forEach(([x, z]) => {
        posts.push([new THREE.CylinderGeometry(.3, .3, .45, 16), x, .375, z], [new THREE.CylinderGeometry(.11, .11, 1.18, 10), x, -.03, z]);
        springs.push([helix, x, 0, z]);
      });
      add(cooler, merge(posts), M.steel());
      add(cooler, merge(springs), M.chrome());
      add(cooler, merge(mountHoles.map(([x, z]) => [new THREE.CylinderGeometry(.42, .42, .21, 20), x, -.255, z])), M.whitePlastic());
      kit.screw(cooler, mountHoles.map(([x, z]) => [x, -.58, z, 0, PI]), { r: .34, h: .14, mat: M.blackMetal() });

      const shroud = part("shroud");
      const SX0 = -29.3, SX1 = 31.0, SZ0 = -11.8, SZ1 = 10.9, ST = 9.0, SB = 6.25;
      const FANX = [-19.2, 0, 19.2], HOLE = 8.78;
      const PW = SX1 - SX0, PD = SZ1 - SZ0 - .8, PCX = (SX0 + SX1) / 2, PCZ = (SZ0 + .4 + SZ1 - .4) / 2;
      const topS = kit.surface({ w: PW, h: PD, ppu: 30, base: { color: "#16171a", rough: .5, metal: .05, height: .5 } });
      speckle(topS, 12000, .05, { height: .43, alpha: .5 }, 9); speckle(topS, 12000, .05, { height: .57, alpha: .5 }, 10);
      const groove = { color: "#0b0b0d", height: .3, rough: .6 };
      FANX.forEach(fx => {
        const x = fx - PCX, z = -PCZ;
        topS.ring(x, z, HOLE, HOLE + .12, { color: "#2a2c31", height: .62, rough: .35 });
        const o = HOLE + .7;
        topS.line([[x - o * .55, z - o * .98], [x + o * .55, z - o * .98], [x + o * .98, z - o * .45]], .07, groove);
        topS.line([[x - o * .98, z + o * .45], [x - o * .55, z + o * .98], [x + o * .55, z + o * .98]], .07, groove);
      });
      topS.text("AX-9700 XT", 28.9 - PCX, 7.8 - PCZ, .45, { color: "#2c2e33", height: .38, rough: .4 }, { rot: -PI / 2, weight: 700 });
      const topMatS = topS.material({ normal: 3 });
      [topMatS.map, topMatS.normalMap, topMatS.roughnessMap].forEach(t => { t.repeat.set(1 / PW, 1 / PD); t.offset.set(.5 - PCX / PW, .5 + PCZ / PD); });
      const cover = poly([[SX0 + .6, -(SZ0 + .4)], [SX1 - 1.4, -(SZ0 + .4)], [SX1 - .4, -(SZ0 + 1.4)], [SX1 - .4, -(SZ1 - 1.4)], [SX1 - 1.4, -(SZ1 - .4)], [SX0 + .6, -(SZ1 - .4)], [SX0 + .6, -(SZ0 + .4)]]);
      FANX.forEach(fx => cover.holes.push(kit.circlePath(fx, 0, HOLE)));
      add(shroud, kit.extrude(cover, .35, .06, 48), [topMatS, M.plastic(), M.plastic()], 0, ST - .175, 0);
      const skirt = pts => poly(pts);
      const alongX = (shape, x0, x1) => { const g = new THREE.ExtrudeGeometry(shape, { depth: x1 - x0, bevelEnabled: false }); g.rotateY(-PI / 2); g.translate(x1, 0, 0); return g; };
      const alongZ = (shape, z0, z1) => { const g = new THREE.ExtrudeGeometry(shape, { depth: z1 - z0, bevelEnabled: false }); g.translate(0, 0, z0); return g; };
      const skirtItems = [
        [alongX(skirt([[SZ0, SB], [SZ0 + .4, SB], [SZ0 + .4, ST - .3], [SZ0 + .9, ST], [SZ0 + .5, ST], [SZ0, ST - .5]]), SX0 + .6, SX1 - 1.4), 0, 0, 0],
        [alongX(skirt([[SZ1 - .4, SB], [SZ1, SB], [SZ1, ST - .5], [SZ1 - .5, ST], [SZ1 - .9, ST], [SZ1 - .4, ST - .3]]), SX0 + .6, SX1 - 1.4), 0, 0, 0],
        [alongZ(poly([[SX1 - .4, SB], [SX1, SB], [SX1, ST - .5], [SX1 - .5, ST], [SX1 - .9, ST], [SX1 - .4, ST - .3]]), SZ0 + 1.4, SZ1 - 1.4), 0, 0, 0],
        [alongZ(poly([[SX0 + .6, SB + 1.2], [SX0 + 1.0, SB + 1.2], [SX0 + 1.0, ST - .3], [SX0 + 1.4, ST], [SX0 + .9, ST], [SX0 + .6, ST - .4]]), SZ0 + .4, SZ1 - .4), 0, 0, 0]
      ];
      [[SZ0, 1], [SZ1, -1]].forEach(([z, s]) => skirtItems.push([box(1.8, ST - SB - .3, .42), SX1 - .75, (ST + SB) / 2 - .15, z + s * .7, -s * PI / 4]));
      const trim = [];
      [-9.6, 9.6].forEach(x => trim.push([kit.extrude(poly([[x - 1.9, 11.2], [x + 1.9, 11.2], [x + .7, 3.0], [x + .7, -3.0], [x + 1.9, -10.2], [x - 1.9, -10.2], [x - .7, -3.0], [x - .7, 3.0]]), .25, .05), 0, ST + .12, 0]));
      trim.push([kit.extrude(poly([[28.3, 10.9], [30.2, 9.6], [30.2, -8.6], [28.3, -9.9], [29.0, -5], [29.0, 6.0]]), .25, .05), 0, ST + .12, 0]);
      trim.push([kit.extrude(poly([[-28.6, 10.9], [-27.9, 10.9], [-28.2, 0], [-27.9, -9.9], [-28.6, -9.9]]), .25, .05), 0, ST + .12, 0]);
      add(shroud, merge(skirtItems), M.plastic());
      add(shroud, merge(trim), std({ color: 0x2e3035, roughness: .45, metalness: .1, normalMap: kit.tiles.grain(), normalScale: new THREE.Vector2(.15, .15) }));
      const aluItems = [];
      [-9.6, 9.6].forEach(x => aluItems.push([kit.extrude(poly([[x - .9, 10.2], [x + .9, 10.2], [x + .25, 3.2], [x + .25, -3.2], [x + .9, -9.2], [x - .9, -9.2], [x - .25, -3.2], [x - .25, 3.2]]), .08, .02), 0, ST + .27, 0]));
      aluItems.push([box(40, .07, .5), -6, ST - .02 + .04, SZ0 + 1.15]);
      aluItems.push([box(SX1 - SX0 - 4, .08, .3), (SX0 + SX1) / 2 - 1, SB + .22, SZ0 - .02]);
      add(shroud, merge(aluItems), M.alu());
      const rgbTex = ctx.texture(1024, 16, (g, W, H) => {
        const gr = g.createLinearGradient(0, 0, W, 0);
        ["#35d2ff", "#7a6cff", "#ff5fb7", "#ff9b4a", "#35d2ff"].forEach((c, i) => gr.addColorStop(i / 4, c));
        g.fillStyle = gr; g.fillRect(0, 0, W, H);
      });
      const bar = add(shroud, box(SX1 - SX0 - 6, .09, .06), std({ color: 0x222222, emissive: 0xffffff, emissiveMap: rgbTex, emissiveIntensity: 1.3, roughness: .3 }), (SX0 + SX1) / 2 - 1.5, ST - .62, SZ0 - .01);
      bar.userData.noCast = true;
      const logoTex = ctx.texture(1024, 128, (g, W, H) => {
        g.fillStyle = "#000"; g.fillRect(0, 0, W, H);
        g.fillStyle = "#fff"; g.font = "800 84px 'IBM Plex Sans', 'Helvetica Neue', Arial, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle";
        if ("letterSpacing" in g) g.letterSpacing = "18px";
        g.fillText("AURION", W / 2, H / 2 + 4);
      });
      const logoMat = std({ color: 0x0c0c0e, emissive: 0xdff4ff, emissiveMap: logoTex, emissiveIntensity: 1.1, roughness: .4, alphaMap: logoTex, transparent: true });
      const logo = add(shroud, new THREE.PlaneGeometry(9.6, 1.2), logoMat, -14, SB + (ST - .5 - SB) / 2 + .15, SZ0 - .012);
      logo.rotation.y = PI;
      const modelTex = ctx.texture(512, 64, (g, W, H) => {
        g.fillStyle = "#000"; g.fillRect(0, 0, W, H); g.fillStyle = "#fff"; g.font = "600 40px 'IBM Plex Sans', Arial, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle";
        g.fillText("AX-9700 XT  ·  24 GB", W / 2, H / 2 + 2);
      });
      const model = add(shroud, new THREE.PlaneGeometry(5.6, .7), std({ color: 0x8a9099, roughness: .5, alphaMap: modelTex, transparent: true }), 16, SB + (ST - .5 - SB) / 2 + .15, SZ0 - .012);
      model.rotation.y = PI;
      kit.screw(shroud, [[SX0 + 1.6, ST, SZ0 + 1.2], [SX0 + 1.6, ST, SZ1 - 1.2], [SX1 - 2.6, ST, SZ0 + 1.9], [SX1 - 2.6, ST, SZ1 - 1.9], [-9.6, ST + .37, SZ1 - 1.0], [9.6, ST + .37, SZ1 - 1.0]], { r: .26, h: .1, mat: M.blackMetal() });

      const frame = [];
      FANX.forEach(fx => {
        frame.push([kit.lathe([[HOLE, SB + .05], [HOLE + .22, SB + .05], [HOLE + .22, ST - .3], [HOLE, ST - .3], [HOLE, SB + .05]], 72), fx, 0, 0]);
        frame.push([new THREE.CylinderGeometry(2.1, 2.2, .36, 36), fx, 6.62, 0]);
        for (let k = 0; k < 3; k++) {
          const a = k * PI * 2 / 3 + PI / 6, g = box(6.75, .22, .42);
          frame.push([g, fx + Math.cos(a) * 5.45, 6.55, -Math.sin(a) * 5.45, a]);
        }
      });
      add(shroud, merge(frame), M.plastic());
      function blade(s) {
        const nu = 12, nv = 7, r0 = 2.05, r1 = 8.5, yc = 7.62, th = .035, pos = [], idx = [];
        const pt = (u, v, side) => {
          const r = r0 + (r1 - r0) * u, ch = 2.2 + 1.6 * u, p = (42 - 18 * u) * PI / 180;
          const a = s * (.45 * Math.pow(u, 1.3) + (v - .5) * ch * Math.cos(p) / r);
          const y = yc - (v - .5) * ch * Math.sin(p) + .09 * ch * 4 * v * (1 - v) + side * th * (1 - .5 * Math.abs(2 * v - 1));
          return [Math.cos(a) * r, y, Math.sin(a) * r];
        };
        for (const side of [1, -1]) for (let i = 0; i <= nu; i++) for (let j = 0; j <= nv; j++) pos.push(...pt(i / nu, j / nv, side));
        const id = (side, i, j) => (side > 0 ? 0 : (nu + 1) * (nv + 1)) + i * (nv + 1) + j;
        const quad = (a, b, c, d, flip) => flip ? idx.push(a, c, b, b, c, d) : idx.push(a, b, c, b, d, c);
        for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) {
          quad(id(1, i, j), id(1, i, j + 1), id(1, i + 1, j), id(1, i + 1, j + 1), s < 0);
          quad(id(-1, i, j), id(-1, i, j + 1), id(-1, i + 1, j), id(-1, i + 1, j + 1), s > 0);
        }
        for (let i = 0; i < nu; i++) for (const j of [0, nv]) quad(id(1, i, j), id(-1, i, j), id(1, i + 1, j), id(-1, i + 1, j), (j === 0) === (s > 0));
        for (let j = 0; j < nv; j++) for (const i of [0, nu]) quad(id(1, i, j), id(1, i, j + 1), id(-1, i, j), id(-1, i, j + 1), (i === 0) === (s > 0));
        const g = new THREE.BufferGeometry();
        g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
        return g;
      }
      const rotorGeo = s => {
        const b = blade(s), items = [];
        for (let k = 0; k < 11; k++) items.push([b, 0, 0, 0, k * PI * 2 / 11]);
        items.push([kit.lathe([[8.42, 6.9], [8.64, 6.9], [8.66, 7.0], [8.66, 8.3], [8.42, 8.3], [8.42, 6.9]], 72), 0, 0, 0]);
        return merge(items);
      };
      const rotors = { 1: rotorGeo(1), "-1": rotorGeo(-1) };
      const bladeMat = std({ color: 0x141518, roughness: .38, metalness: .05, side: THREE.DoubleSide });
      const hubGeo = kit.lathe([[0, 6.8], [2.25, 6.8], [2.28, 8.1], [2.2, 8.34], [1.98, 8.46], [0, 8.46]], 48);
      const hubS = kit.surface({ w: 4, h: 4, ppu: 96, base: { color: "#111214", rough: .45, metal: 0, height: .5 } });
      hubS.ring(0, 0, 1.55, 1.72, { color: "#9aa0a8", rough: .25, metal: 1, height: .55 });
      hubS.ring(0, 0, 1.2, 1.24, { color: "#3b3e44" });
      hubS.poly([[-.55, .25], [0, -.62], [.55, .25], [.3, .25], [0, -.2], [-.3, .25]], { color: "#c9ced6", rough: .3, metal: 1, height: .56 });
      hubS.text("AURION", 0, .62, .2, { color: "#d9dde3", rough: .5 }, { weight: 700, spacing: .03 });
      hubS.text("AX-9700", 0, -.95, .12, { color: "#7f858d" }, { weight: 600 });
      const hubMat = hubS.material({ normal: 2 });
      const sticker = new THREE.CircleGeometry(1.8, 48); sticker.rotateX(-PI / 2); sticker.translate(0, 8.465, 0);
      [hubMat.map, hubMat.normalMap, hubMat.roughnessMap].forEach(t => { t.repeat.set(.9, .9); t.offset.set(.05, .05); });
      FANX.forEach((fx, fi) => {
        const dir = fi === 1 ? -1 : 1;
        const fan = new THREE.Group(); fan.position.set(fx, 0, 0); fan.userData.dir = dir; fan.userData.id = "shroud";
        shroud.add(fan);
        add(fan, new THREE.Mesh(rotors[dir], bladeMat));
        add(fan, new THREE.Mesh(hubGeo, M.plastic()));
        noCast(add(fan, new THREE.Mesh(sticker, hubMat)));
        fan.rotation.y = fi * .9;
        fans.push(fan);
      });

      const backplate = part("backplate");
      const P0 = -29.4, P1 = 30.8, Q0 = -11.35, Q1 = 10.85, BPY = -.575;
      const BPW = P1 - P0, BPD = Q1 - Q0, BCX = (P0 + P1) / 2, BCZ = (Q0 + Q1) / 2;
      const bx = x => x - BCX, bz = z => z - BCZ;
      const vents = [];
      for (let k = 0; k < 9; k++) vents.push([1.2 + k * .85, -4.6, .36, 6.2], [1.2 + k * .85, 4.2, .36, 6.2]);
      const bpS = kit.surface({ w: BPW, h: BPD, ppu: 34, underside: true, base: { color: "#2b2e34", rough: .42, metal: .9, height: .5 } });
      speckle(bpS, 9000, .03, { height: .43, color: "#272a30", alpha: .35 }, 21, 90); speckle(bpS, 9000, .03, { height: .57, color: "#30343b", alpha: .35 }, 22, 90);
      const emb = { color: "#3a3e46", height: .64, rough: .32 }, cut = { color: "#1b1d21", height: .32, rough: .6 };
      bpS.poly([[bx(-26), bz(-9.6)], [bx(-8), bz(-9.6)], [bx(-6.4), bz(-8.2)], [bx(-24.4), bz(-8.2)]], emb);
      bpS.line([[bx(-27.8), bz(7.6)], [bx(-18.6), bz(7.6)], [bx(-16.2), bz(9.9)], [bx(14), bz(9.9)]], .08, cut);
      bpS.line([[bx(-27.8), bz(-7.2)], [bx(-18.8), bz(-7.2)]], .08, cut);
      bpS.text("AURION", bx(-17.2), bz(-8.9), .85, { color: "#9aa1ab", height: .36, rough: .3 }, { weight: 800, spacing: .25 });
      bpS.text("AX-9700 XT", bx(-24.6), bz(5.9), .5, { color: "#565b64", height: .4 }, { weight: 700, align: "left" });
      bpS.text("THE INTERNALS · ENGINEERED FOR LEARNING", bx(-24.6), bz(4.8), .22, { color: "#6a707a", height: .45 }, { weight: 600, align: "left" });
      [[GX, GZ]].forEach(([x, z]) => bpS.strokeRect(bx(x), bz(z), 13.0, 13.0, .12, { color: "#43474f", height: .6, rough: .3 }, 1.3));
      vents.forEach(([x, z, w, d]) => bpS.strokeRect(bx(x), bz(z), w + .18, d + .18, .06, { color: "#45494f", height: .6 }, .25));
      bpS.strokeRect(bx(23), bz(0), 14.2, 19.6, .12, { color: "#474b53", height: .6, rough: .3 }, 1.6);
      boardHoles.forEach(([x, z]) => bpS.ring(bx(x), bz(z), .3, .42, { color: "#1d1f23", height: .35 }));
      const bpMat = bpS.material({ normal: 3 });
      [bpMat.map, bpMat.normalMap, bpMat.roughnessMap].forEach(t => { t.repeat.set(1 / BPW, 1 / BPD); t.offset.set(.5 - BCX / BPW, .5 + BCZ / BPD); });
      const bpShape = poly([[P0, -Q0], [P1 - 1.0, -Q0], [P1, -Q0 - 1.0], [P1, -Q1 + 1.0], [P1 - 1.0, -Q1], [P0, -Q1]]);
      bpShape.holes.push(rectPath(GX, -GZ, 12.2, 12.2, 1.2));
      bpShape.holes.push(rectPath(23, 0, 13.4, 18.8, 1.2));
      vents.forEach(([x, z, w, d]) => bpShape.holes.push(rectPath(x, -z, w, d, .18)));
      add(backplate, kit.extrude(bpShape, .25, .05, 12), [std({ color: 0x2a2d33, metalness: .8, roughness: .5 }), M.alu(), bpMat], 0, BPY, 0);
      add(backplate, merge([[box(P1 - P0 - 1.2, .8, .2), (P0 + P1) / 2 - .6, BPY + .28, Q0 + .1], [box(.2, .8, BPD - 2), P1 - .1, BPY + .28, BCZ]]), std({ color: 0x2b2e34, metalness: .85, roughness: .45 }));
      kit.screw(backplate, boardHoles.concat([[20, -10.3], [26.5, -10.3], [20, 10.1], [26.5, 10.1]]).map(([x, z]) => [x, BPY - .125, z, 0, PI]), { r: .3, h: .1, mat: M.blackMetal() });
      const stS = kit.surface({ w: 5.2, h: 2.4, ppu: 110, base: { color: "#c9ccd1", rough: .35, metal: .75, height: .5 } });
      const dark = { color: "#141518", metal: 0, rough: .6 };
      stS.text("AURION  AX-9700 XT 24G", -2.4, -.85, .2, dark, { align: "left", weight: 700 });
      stS.text("P/N A97X-24G-OC1  ·  S/N A97X2438000482", -2.4, -.5, .13, dark, { align: "left" });
      const bc = kit.rng(8);
      for (let x = -2.4; x < .9;) { const w = .02 + bc() * .05; if (bc() < .6) stS.rect(x + w / 2, .15, w, .7, dark); x += w + .015 + bc() * .02; }
      stS.text("A97X2438000482", -.75, .72, .12, dark);
      for (let i = 0; i < 21; i++) for (let j = 0; j < 21; j++) {
        const f = (a, b) => a < 7 && b < 7, fin = f(i, j) || f(20 - i, j) || f(i, 20 - j);
        const on = fin ? (Math.max(Math.abs((i > 10 ? 20 - i : i) - 3), Math.abs((j > 10 ? 20 - j : j) - 3)) !== 2) : bc() < .5;
        if (on && !(fin && Math.max(Math.abs((i > 10 ? 20 - i : i) - 3), Math.abs((j > 10 ? 20 - j : j) - 3)) > 3)) stS.rect(1.35 + i * .07, -.75 + j * .07, .07, .07, dark);
      }
      const stMesh = add(backplate, flatDown(5.2, 2.4), stS.material({ normal: 1 }), 5.2, BPY - .13, -9.3);
      noCast(stMesh);

      return {
        layout: {
          shroud: { y: 0, dy: 27, dz: -12 },
          cooler: { y: 0, dy: 16, dz: -6 },
          gpu: { y: 0, dy: 8 },
          vram: { y: 0, dy: 3.5 },
          pcb: { y: 0 },
          backplate: { y: 0, dy: -7 }
        },
        anchors: {
          shroud: [-24, ST + .1, 9.5], cooler: [27, FY1, 5], gpu: [GX - .5, .52, GZ - 1.6], vram: [GX + 2.4, .37, GZ + 7.0],
          pcb: [10, TOP, 9.8], backplate: [-26, BPY - .13, 9.8]
        },
        hideWhenClosed: ["gpu", "vram", "cooler"],
        tick(dt) { fans.forEach(f => { f.rotation.y += dt * 7 * f.userData.dir; }); }
      };
    }
  });
})();
