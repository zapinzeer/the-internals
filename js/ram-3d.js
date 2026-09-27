(function () {
  const root = document.getElementById("ram3d");
  if (!root) return;
  const parts = [
    { id: "heatspreader", color: "#8593a5" },
    { id: "chips", color: "#a594f5" },
    { id: "pmic", color: "#e38b4f" },
    { id: "spd", color: "#5ac8e2" },
    { id: "pcb", color: "#72d49c" },
    { id: "contacts", color: "#d8b25a" }
  ];

  Internals.viewer3d(root, {
    prefix: "ram.part", parts, initial: "chips", explode: 0.7, yaw: -0.5,
    dist: [76, 88, 120], lookY: 2, elev: 0.55, flipSelect: "contacts",
    build(ctx) {
      const { THREE, part, add, std, roundBox, kit } = ctx;

      const MM = 54 / 133.35;
      const BL = 54, BH = 31.25 * MM, BT = 1.2 * MM, TOP = BT / 2;
      const ZC = 7.9, ZT = ZC - BH, ZB = (ZC + ZT) / 2;
      const X = mm => -BL / 2 + mm * MM, Z = mm => ZC - mm * MM;
      const CX = [11.175, 25.175, 39.175, 53.175, 80.175, 94.175, 108.175, 122.175].map(X), CZ = Z(17);
      const CW = 7.6 * MM, CD = 10.8 * MM, BP = .8 * MM;
      const KEYX = X(69.225), KEYW = 1.5 * MM, KEYD = 3.9 * MM;
      const LATCH = Z(17), LATCHH = 3 * MM, LATCHD = 1.5 * MM;
      const pinX = i => X(5.05 + i * .85 + (i >= 75 ? 1.7 : 0));
      const FIN0 = Z(.45), FIN1 = Z(4.3);
      const CHAMF = .45 * MM;
      const bz = z => z - ZB;
      const mp = pts => pts.map(([a, b]) => [X(a), bz(Z(b))]);

      function prism(prof, x0, x1, smoothDeg) {
        const n = prof.length, pos = [], nor = [], uv = [], lim = Math.cos((smoothDeg || 35) * Math.PI / 180);
        const acc = [0];
        for (let i = 0; i < n; i++) { const a = prof[i], b = prof[(i + 1) % n]; acc.push(acc[i] + Math.hypot(b[0] - a[0], b[1] - a[1])); }
        const per = acc[n];
        const en = prof.map((a, i) => { const b = prof[(i + 1) % n], dz = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dz, dy) || 1; return [dy / l, -dz / l]; });
        const blend = (e, o) => {
          const A = en[e], B = en[(o + n) % n], d = A[0] * B[0] + A[1] * B[1];
          if (d < lim) return A;
          const z = A[0] + B[0], y = A[1] + B[1], l = Math.hypot(z, y); return [z / l, y / l];
        };
        const v = (x, p, nn, u, w) => { pos.push(x, p[1], p[0]); nor.push(0, nn[1], nn[0]); uv.push(u, w); };
        for (let e = 0; e < n; e++) {
          const a = prof[e], b = prof[(e + 1) % n], na = blend(e, e - 1), nb = blend(e, e + 1), va = acc[e] / per, vb = acc[e + 1] / per;
          v(x0, a, na, 0, va); v(x1, a, na, 1, va); v(x1, b, nb, 1, vb);
          v(x0, a, na, 0, va); v(x1, b, nb, 1, vb); v(x0, b, nb, 0, vb);
        }
        for (let i = 1; i < n - 1; i++) {
          for (const [x, sgn, i1, i2] of [[x0, -1, i, i + 1], [x1, 1, i + 1, i]]) {
            [prof[0], prof[i1], prof[i2]].forEach(p => { pos.push(x, p[1], p[0]); nor.push(sgn, 0, 0); uv.push(.5, .5); });
          }
        }
        const g = new THREE.BufferGeometry();
        g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
        g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
        g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
        return g;
      }
      function mirrorY(geo) {
        const g = geo.index ? geo.toNonIndexed() : geo.clone();
        g.scale(1, -1, 1);
        for (const name of ["position", "normal", "uv"]) {
          const at = g.attributes[name]; if (!at) continue;
          const a = at.array, k = at.itemSize;
          for (let t = 0; t < a.length; t += 3 * k) for (let c = 0; c < k; c++) { const q = a[t + k + c]; a[t + k + c] = a[t + 2 * k + c]; a[t + 2 * k + c] = q; }
        }
        return g;
      }
      const rot = (ox, oz, ry) => [ox * Math.cos(ry) + oz * Math.sin(ry), -ox * Math.sin(ry) + oz * Math.cos(ry)];
      function marking(w, d, o) {
        const S = kit.surface({ w, h: d, ppu: o.ppu || 150, base: { color: "#191a1d", rough: .7, metal: 0, height: .5 } });
        S.noise(Math.round(S.W * S.H / 30), .006, r => ({ color: r() < .5 ? "#000" : "#fff", alpha: .045 }), 5);
        const ink = { color: o.ink || "#64676c", rough: .88, height: .44, alpha: .95 };
        const rows = o.lines, total = rows.reduce((s, r) => s + r[1] * 1.55, 0);
        let z = (o.shift || 0) - total / 2;
        rows.forEach(([str, size, weight, font]) => {
          z += size * .78;
          S.text(str, 0, z, size, ink, { weight, font: font || "'JetBrains Mono', 'DejaVu Sans Mono', monospace" });
          z += size * .77;
        });
        if (o.logo) o.logo(S, ink);
        const pr = Math.min(w, d) * .05;
        S.circle(-w / 2 + pr * 2.6, -d / 2 + pr * 2.6, pr, { color: "#0c0d0e", height: .36, rough: .4 });
        return S.material({ normal: 1.8 });
      }
      function smallIC(group, o) {
        const g = new THREE.Group(); g.position.set(o.x, 0, o.z);
        const body = new THREE.Mesh(roundBox(o.w, o.h, o.d, .03, .02), kit.mat.epoxy()); body.position.y = o.h / 2 + .012; g.add(body);
        const top = new THREE.Mesh(new THREE.PlaneGeometry(o.w * .95, o.d * .95), o.mark);
        top.rotation.x = -Math.PI / 2; top.position.y = o.h + .015; top.userData.noCast = true; g.add(top);
        const list = [];
        for (const [sx, sz, cnt] of o.sides) for (let i = 0; i < cnt; i++) {
          const a = (i - (cnt - 1) / 2) * o.pitch;
          list.push(sx ? [sx * (o.w / 2 + .012), .03, a, Math.PI / 2] : [a, .03, sz * (o.d / 2 + .012), 0]);
        }
        const pad = new THREE.InstancedMesh(new THREE.BoxGeometry(o.pitch * .5, .06, .1), kit.mat.tin(), list.length);
        const tmp = new THREE.Object3D();
        list.forEach((p, k) => { tmp.position.set(p[0], p[1], p[2]); tmp.rotation.set(0, p[3], 0); tmp.updateMatrix(); pad.setMatrixAt(k, tmp.matrix); });
        g.add(pad);
        add(group, g);
        return g;
      }

      const cap0402 = [], cap0201 = [], cap0603 = [], res0402 = [], rnArr = [];
      const gaps = [0, 1, 2, 4, 5, 6].map(k => (CX[k] + CX[k + 1]) / 2);
      gaps.forEach(gx => {
        for (let r = 0; r < 6; r++) cap0402.push([gx - .33, Z(12.3 + r * 1.9), 0, 1], [gx + .33, Z(12.3 + r * 1.9), 0, 1]);
        cap0402.push([gx, Z(6.2), 0, 1]);
        for (let r = 0; r < 4; r++) cap0402.push([gx, Z(13.4 + r * 2.7), 0, -1]);
      });
      CX.forEach(cx => {
        [-.85, 0, .85].forEach(dx => cap0402.push([cx + dx, Z(10.1), 0, 1]));
        [-1, 1].forEach(dx => cap0402.push([cx + dx, Z(23.7), 0, 1]));
        [-1.3, 1.3].forEach(dx => cap0201.push([cx + dx, Z(22.95), 0, 1]));
        [-.6, .6].forEach(dx => cap0402.push([cx + dx, Z(10.1), 0, -1]));
        cap0402.push([cx, Z(23.7), 0, -1]);
        res0402.push([cx + CW / 2 + .3, Z(12.3), Math.PI / 2]);
      });
      [X(3.2), X(130.15)].forEach(x => {
        [12, 14.2, 27.6].forEach(y => cap0402.push([x, Z(y), Math.PI / 2, 1]));
        [13.2, 15.6, 18.6, 21, 23.4, 25.8].forEach(y => rnArr.push([x + (x < 0 ? .45 : -.45), Z(y), Math.PI / 2]));
        [12.6, 22.4].forEach(y => cap0603.push([x, Z(y), Math.PI / 2, -1]));
      });
      [63.8, 66.5, 69.2].forEach(m => cap0603.push([X(m), Z(20.4), 0, -1]));
      cap0402.push([X(61.5), Z(10.4), Math.PI / 2, 1], [X(65.3), Z(10.9), Math.PI / 2, 1]);
      res0402.push([X(63.4), Z(13.1), 0]);

      const PMX = X(66.7), PMZ = Z(24.2), PMW = 4 * MM;
      const inductors = [[X(60.6), Z(26.7)], [X(60.6), Z(22.3)], [X(72.8), Z(26.7)]];
      const cap0805 = [[X(58.3), Z(28.1), Math.PI / 2], [X(58.3), Z(24.5), Math.PI / 2], [X(58.3), Z(21.0), Math.PI / 2],
        [X(75.1), Z(28.1), Math.PI / 2], [X(75.1), Z(24.9), Math.PI / 2], [X(72.8), Z(22.6), 0],
        [X(64.2), Z(20.1), 0], [X(66.9), Z(20.1), 0], [X(69.6), Z(20.1), 0]];
      const pmic0402 = [[X(63.9), Z(24.2), Math.PI / 2], [X(69.5), Z(24.2), Math.PI / 2], [X(66.7), Z(27.1), 0], [X(64.4), Z(28.6), 0], [X(69.0), Z(28.6), 0]];
      const SPX = X(63.4), SPZ = Z(10.4);
      const RGX = X(88.6), RGZ = Z(28.4);
      cap0402.push([RGX - .95, RGZ, Math.PI / 2, 1], [RGX + .95, RGZ, Math.PI / 2, 1]);

      const pcb = part("pcb");
      const boardShape = new THREE.Shape();
      {
        const s = boardShape, hx = BL / 2, r = .5 * MM, rr = .45 * MM, e0 = ZC - CHAMF;
        const tx = .9 * MM, tz = ZC - 2.6 * MM, L0 = LATCH - LATCHH / 2, L1 = LATCH + LATCHH / 2;
        const P = (x, z) => [x, -(z - ZB)];
        const l = (x, z) => s.lineTo(...P(x, z)), q = (cx, cz, x, z) => s.quadraticCurveTo(...P(cx, cz), ...P(x, z));
        s.moveTo(...P(-hx + r, ZT)); l(hx - r, ZT); q(hx, ZT, hx, ZT + r);
        l(hx, L0); l(hx - LATCHD + rr, L0); q(hx - LATCHD, L0, hx - LATCHD, L0 + rr); l(hx - LATCHD, L1 - rr); q(hx - LATCHD, L1, hx - LATCHD + rr, L1); l(hx, L1);
        l(hx, tz); l(hx - tx, e0);
        l(KEYX + KEYW / 2, e0); l(KEYX + KEYW / 2, ZC - KEYD + KEYW / 2);
        s.absarc(KEYX, -(ZC - KEYD + KEYW / 2 - ZB), KEYW / 2, 0, Math.PI, false);
        l(KEYX - KEYW / 2, e0); l(-hx + tx, e0); l(-hx, tz);
        l(-hx, L1); l(-hx + LATCHD - rr, L1); q(-hx + LATCHD, L1, -hx + LATCHD, L1 - rr); l(-hx + LATCHD, L0 + rr); q(-hx + LATCHD, L0, -hx + LATCHD - rr, L0); l(-hx, L0);
        l(-hx, ZT + r); q(-hx, ZT, -hx + r, ZT);
      }
      const edgeTex = ctx.texture(512, 64, (g, W, H) => {
        const r = kit.rng(9);
        g.fillStyle = "#5e5b37"; g.fillRect(0, 0, W, H);
        for (let y = 5; y < H - 5; y += 3) { g.fillStyle = r() < .5 ? "rgba(30,28,14,.3)" : "rgba(210,200,150,.12)"; g.fillRect(0, y, W, 2); }
        for (let k = 1; k <= 9; k++) { g.fillStyle = "rgba(196,128,70,.6)"; g.fillRect(0, Math.round(4 + k * (H - 8) / 10), W, 1); }
        for (let i = 0; i < 1600; i++) { g.fillStyle = `rgba(232,222,170,${.05 + r() * .12})`; g.fillRect(r() * W, 5 + r() * (H - 10), 1 + r() * 7, 1); }
        g.fillStyle = "#0f4a2b"; g.fillRect(0, 0, W, 4); g.fillRect(0, H - 4, W, 4);
      });
      edgeTex.wrapS = edgeTex.wrapT = THREE.RepeatWrapping;
      {
        const b = .02, depth = BT - 2 * b;
        edgeTex.repeat.set(.3, 1 / BT); edgeTex.offset.set(0, -(1 - depth - b) / BT);
      }
      const edgeMat = std({ map: edgeTex, roughness: .72 });

      function paintFace(P, back) {
        const silk = P.silkP, tp = P.traceP, S = P;
        const via = (x, z, r, open) => P.via(x, bz(z), r || .11, open);
        const trace = (pts, w) => S.line(pts.map(([x, z]) => [x, bz(z)]), w || P.traceW, tp);
        const ref = (str, x, z, size, rot) => P.ref(str, x, bz(z), size || .26, rot);
        const pad = (x, z, w, d, r) => P.pad(x, bz(z), w, d, r);

        const pour = { color: P.maskHi, height: .53, alpha: .32 };
        if (!back) {
          S.poly(mp([[64.8, 4.6], [68.1, 4.6], [68.1, 13.2], [71.8, 16.4], [71.8, 21.4], [62.6, 21.4], [62.6, 16.4], [64.8, 14.2]]), pour);
          S.poly(mp([[57.3, 20.2], [59.6, 20.2], [59.6, 29.2], [57.3, 29.2]]), pour);
          S.poly(mp([[74.2, 22.2], [76.1, 22.2], [76.1, 29.2], [74.2, 29.2]]), pour);
        } else {
          S.poly(mp([[58, 18.8], [75.5, 18.8], [75.5, 23], [58, 23]]), pour);
        }
        S.rect(0, bz(Z(30.1)), BL - 2, .9 * MM, pour);
        for (let m = 3; m < 131; m += 1.27) via(X(m), Z(30.1), .1);

        for (let i = 0; i < 144; i++) {
          const x = pinX(i), zv = Z(i % 2 ? 5.55 : 4.95);
          S.rect(x, bz((FIN0 + FIN1) / 2), .62 * MM, FIN0 - FIN1, { color: "#94643a", height: .53, rough: .5, metal: .75 });
          trace([[x, FIN1], [x, zv]], .22 * MM);
          via(x, zv, .2 * MM, i % 11 === 5);
        }

        CX.forEach((cx, k) => {
          for (let i = 0; i < 9; i++) if (i < 3 || i > 5) for (let j = 0; j < 13; j++) {
            const x = cx + (i - 4) * BP, z = CZ + (j - 6) * BP, dx = (i < 3 ? -1 : 1) * BP / 2;
            trace([[x, z], [x + dx, z - BP / 2]], .12 * MM);
            via(x + dx, z - BP / 2, .1 * MM);
            pad(x, z, .4 * MM, .4 * MM, .2 * MM);
          }
          const w = CW / 2 + .16, d = CD / 2 + .16, c = .45, lw = .1 * MM;
          [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([sx, sz]) =>
            S.line([[cx + sx * w, bz(CZ + sz * (d - c))], [cx + sx * w, bz(CZ + sz * d)], [cx + sx * (w - c), bz(CZ + sz * d)]], lw, silk));
          S.poly([[cx - w - .05, bz(CZ - d - .05)], [cx - w + .35, bz(CZ - d - .05)], [cx - w - .05, bz(CZ - d + .35)]], silk);
          ref("U" + (back ? 11 + k : 1 + k), cx - w + .45, Z(23.3), .26);
        });

        CX.forEach(cx => {
          const pins = [];
          for (let i = 0; i < 144; i++) if (Math.abs(pinX(i) - cx) < 1.75 && i % 2) pins.push(i);
          pins.forEach((i, j) => {
            const px = pinX(i), zv = Z(5.55), tx = cx + (j - (pins.length - 1) / 2) * .3;
            const z1 = Z(6.3), z2 = z1 - Math.abs(tx - px);
            const pts = [[px, zv], [px, z1], [tx, z2]];
            if (j % 2 === 1 && Math.abs(tx - px) < .8) {
              let z = z2 - .15; pts.push([tx, z]);
              for (let m = 0; m < 4; m++) { pts.push([tx + .12, z], [tx + .12, z - .08], [tx, z - .08]); z -= .16; if (m < 3) pts.push([tx, z]); }
            }
            pts.push([tx, Z(11.2)]);
            trace(pts);
          });
        });
        for (let side = -1; side <= 1; side += 2) {
          for (let k = 0; k < 9; k++) {
            const zz = Z(24.9 + k * .34), xa = X(66.675 + side * (9.2 - k * .12)), xb = X(66.675 + side * 62.5);
            trace([[xa, Z(20.5)], [xa, zz + .3], [xa + side * .3, zz], [xb, zz]]);
          }
          CX.filter(cx => Math.sign(cx) === side).forEach(cx => {
            for (let k = 0; k < 9; k += 2) trace([[cx - 1 + k * .25, Z(24.9 + k * .34)], [cx - 1 + k * .25, Z(22.1)]]);
          });
        }
        const r = kit.rng(back ? 77 : 41);
        for (let n = 0; n < 420; n++) {
          const x = (r() - .5) * (BL - 3), z = ZT + .5 + r() * (BH - 3.2);
          if (CX.some(cx => Math.abs(x - cx) < CW / 2 + .3 && Math.abs(z - CZ) < CD / 2 + .3)) continue;
          if (Math.abs(x - PMX) < 3.9 && z < Z(19.5) && z > Z(29.2)) continue;
          via(x, z, .1 * MM * (1 + r() * .6), r() < .08);
        }

        const capPads = (list, l, w, pre, base) => list.forEach(([x, z, ry, sd], k) => {
          if (sd != null && sd !== (back ? -1 : 1)) return;
          const e = l * .3, vert = Math.abs(Math.sin(ry)) > .5;
          [-1, 1].forEach(s => {
            const ox = (l / 2 - e / 2) * s;
            if (vert) pad(x, z - ox, w * 1.12, e * 1.5, .02); else pad(x + ox, z, e * 1.5, w * 1.12, .02);
          });
          if (pre && k % 3 === 0) ref(pre + (base + k), x + (vert ? .42 : 0), z + (vert ? 0 : .34), .19, vert ? -Math.PI / 2 : 0);
        });
        capPads(cap0402, 1 * MM, .5 * MM, "C", back ? 201 : 11);
        capPads(cap0201, .6 * MM, .3 * MM);
        capPads(cap0603, 1.6 * MM, .8 * MM, "C", 301);
        if (!back) {
          capPads(res0402.map(p => [...p, 1]), 1 * MM, .5 * MM, "R", 1);
          rnArr.forEach(([x, z], k) => {
            for (let t = 0; t < 4; t++) [-1, 1].forEach(s => pad(x + s * .2, z + (t - 1.5) * .2, .12, .11, .02));
            ref("RN" + (k + 1), x + (x < 0 ? .75 : -.75), z, .19, -Math.PI / 2);
          });
          for (let t = 0; t < 8; t++) {
            const a = (t - 3.5) * .5 * MM;
            [-1, 1].forEach(s => { pad(PMX + a, PMZ + s * (PMW / 2 + .02), .1, .22, .02); pad(PMX + s * (PMW / 2 + .02), PMZ + a, .22, .1, .02); });
          }
          pad(PMX, PMZ, PMW * .6, PMW * .6, .03);
          for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) via(PMX + (i - 1) * .3, PMZ + (j - 1) * .3, .06, true);
          inductors.forEach(([x, z], k) => {
            [-1, 1].forEach(s => pad(x + s * 1.05 * MM * 1.05, z, .34, .72, .03));
            P.outline(x, bz(z), 2.9 * MM, 2.4 * MM, .08 * MM);
            ref("L" + (k + 1), x, z - 1.5 * MM, .24);
          });
          capPads(cap0805.map(p => [...p, 1]), 2 * MM, 1.25 * MM, "C", 101);
          capPads(pmic0402.map(p => [...p, 1]), 1 * MM, .5 * MM);
          ref("U9", PMX + PMW / 2 + .5, PMZ - PMW / 2 - .15, .26);
          for (let t = 0; t < 4; t++) [-1, 1].forEach(s => pad(SPX + s * .45, SPZ + (t - 1.5) * .5 * MM, .2, .1, .02));
          pad(SPX, SPZ, .36, .8, .02);
          ref("U10", SPX, SPZ - .92, .24);
          for (let t = 0; t < 4; t++) {
            const a = (t - 1.5) * .5 * MM;
            [-1, 1].forEach(s => { pad(RGX + a, RGZ + s * .62, .09, .2, .02); pad(RGX + s * .62, RGZ + a, .2, .09, .02); });
          }
          pad(RGX, RGZ, .6, .6, .03);
          ref("U19", RGX, RGZ - 1.05, .22);
          for (let t = 0; t < 4; t++) pad(X(94.6 + t * 1.6), Z(29.6), .45, .7, .08);
          S.text("5V  DI  DO  GND", X(97), bz(Z(28.1)), .17, silk, { weight: 600 });
          ref("J1", X(93.2), Z(29.6), .22);
          [[59.3, 8.6], [59.3, 11], [73.8, 12.4], [73.8, 10]].forEach(([a, b], k) => {
            S.circle(X(a), bz(Z(b)), .19, P.padP); ref("TP" + (k + 1), X(a) + .5, Z(b), .18);
          });
          ref("1", X(2.9), Z(4.8), .3); ref("144", X(130.6), Z(4.8), .3);
          S.text("AURION  D5U-16G-1R8  REV 1.02", X(10), bz(Z(28.3)), .3, silk, { align: "left", weight: 600 });
          S.text("2432", X(123), bz(Z(28.3)), .3, silk, { weight: 600 });
          S.text("RoHS", X(117), bz(Z(28.3)), .26, silk, { weight: 600 });
          P.fiducial(X(2.3), bz(Z(29.2)), .12); P.fiducial(X(131), bz(Z(29.2)), .12); P.fiducial(X(2.3), bz(Z(8.6)), .12);
        } else {
          ref("145", X(2.9), Z(4.8), .3); ref("288", X(130.6), Z(4.8), .3);
          const bx = X(66.7), bzz = Z(26.8);
          S.rect(bx, bz(bzz), 6.4, 1.5, silk, .06);
          const rr = kit.rng(313), cell = .09, n = 12, ox = bx - 2.9, oz = bz(bzz) - n * cell / 2;
          for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
            const on = i === 0 || j === n - 1 || (j === 0 && i % 2 === 0) || (i === n - 1 && j % 2 === 1) || (i > 0 && j < n - 1 && rr() < .5);
            if (on) S.rect(ox + i * cell + cell / 2, oz + j * cell + cell / 2, cell, cell, { color: "#16181a", height: .5 });
          }
          S.text("SN 24D5U1R8 03142", bx + .8, bz(bzz) - .3, .24, { color: "#16181a" }, { weight: 700 });
          S.text("TI-6L  2431", bx + .8, bz(bzz) + .3, .24, { color: "#16181a" }, { weight: 700 });
          S.text("MADE IN TAIWAN", X(66.7), bz(Z(29.6)), .24, silk, { weight: 600 });
          P.fiducial(X(2.3), bz(Z(29.2)), .12); P.fiducial(X(131), bz(Z(29.2)), .12); P.fiducial(X(131), bz(Z(8.6)), .12);
        }
      }
      const boardP = (back, seed) => kit.pcb({ w: BL, d: BH, ppu: 2040 / BL, mask: "green", seed, traces: 0, vias: 0, traceW: .12 * MM, underside: back, draw: P => paintFace(P, back) });
      const frontMat = boardP(false, 21).material({ fit: true, normal: 3 });
      const backMat = boardP(true, 22).material({ fit: true, normal: 3 });
      add(pcb, kit.extrude(boardShape, BT, .02), [frontMat, edgeMat, backMat], 0, 0, ZB);
      {
        const e0 = ZC - CHAMF, prof = [[e0 - .02, -TOP + .002], [ZC, -TOP * .38], [ZC, TOP * .38], [e0 - .02, TOP - .002]];
        const bevel = kit.merge([[prism(prof, X(0) + .9 * MM + .02, KEYX - KEYW / 2)], [prism(prof, KEYX + KEYW / 2, X(133.35) - .9 * MM - .02)]]);
        add(pcb, bevel, std({ color: 0x7a7550, roughness: .62, metalness: .1 }));
      }

      function mlcc(group, list, l, w, h, body, base) {
        const e = l * .24;
        const bodyGeo = new THREE.BoxGeometry(l - 2 * e + .002, h * .94, w * .94), endGeo = new THREE.BoxGeometry(e, h, w);
        kit.place(group, bodyGeo, body, list.map(([x, z, ry, s]) => [x, (s || 1) * (base + h / 2), z, ry]));
        const ends = [];
        list.forEach(([x, z, ry, s]) => [-1, 1].forEach(d => { const [ox, oz] = rot(d * (l / 2 - e / 2), 0, ry); ends.push([x + ox, (s || 1) * (base + h / 2), z + oz, ry]); }));
        kit.place(group, endGeo, kit.mat.tin(), ends);
      }
      const ceramic = std({ color: 0x8c7757, roughness: .58 }), ceramicDark = std({ color: 0x6f5a40, roughness: .55 });
      mlcc(pcb, cap0402, 1 * MM, .5 * MM, .5 * MM, ceramic, TOP);
      mlcc(pcb, cap0201, .6 * MM, .3 * MM, .3 * MM, ceramic, TOP);
      mlcc(pcb, cap0603, 1.6 * MM, .8 * MM, .8 * MM, ceramicDark, TOP);
      kit.resistor(pcb, res0402.map(([x, z, ry]) => [x, TOP, z, ry]), { l: 1 * MM, w: .5 * MM, h: .35 * MM });
      {
        const l = 2 * MM, w = 1 * MM, h = .45 * MM;
        kit.place(pcb, roundBox(l, h, w * .8, .02, .015), std({ color: 0x141416, roughness: .5 }), rnArr.map(([x, z, ry]) => [x, TOP + h / 2, z, ry]));
        const term = [];
        rnArr.forEach(([x, z, ry]) => { for (let t = 0; t < 4; t++) [-1, 1].forEach(s => { const [ox, oz] = rot((t - 1.5) * .5 * MM, s * w * .42, ry); term.push([x + ox, TOP + h * .45, z + oz, ry]); }); });
        kit.place(pcb, new THREE.BoxGeometry(.24 * MM, h * .9, .26 * MM), kit.mat.tin(), term);
      }

      smallIC(pcb, {
        x: RGX, z: RGZ, w: 3 * MM, d: 3 * MM, h: .28, pitch: .5 * MM, sides: [[1, 0, 4], [-1, 0, 4], [0, 1, 4], [0, -1, 4]],
        mark: marking(3 * MM * .95, 3 * MM * .95, { ppu: 220, lines: [["LX16", .15, 700], ["2419", .12, 500]] })
      }).position.y = TOP;

      const contacts = part("contacts");
      {
        const t = .03, list = [];
        for (let i = 0; i < 144; i++) [1, -1].forEach(s => list.push([pinX(i), s * (TOP + t / 2), (FIN0 + FIN1) / 2]));
        const im = kit.place(contacts, roundBox(.6 * MM, t, FIN0 - FIN1, .06, .01), std({ color: 0xe6b65c, metalness: 1, roughness: .22 }), list);
        im.userData.noCast = true;
      }

      const chips = part("chips");
      {
        const list = CX.map(x => [x, 0, CZ]);
        kit.place(chips, roundBox(CW, .08, CD, .03, .012), std({ color: 0x2a3122, roughness: .6 }), list.map(([x, , z]) => [x, .14, z]));
        kit.place(chips, roundBox(CW - .004, .24, CD - .004, .04, .03), kit.mat.epoxy(), list.map(([x, , z]) => [x, .3, z]));
        const mark = marking(CW * .96, CD * .96, {
          ppu: 140, shift: .15,
          lines: [["VELTRA", .34, 800, "'IBM Plex Sans', Arial, sans-serif"], ["V5R16G8B-HJC", .21, 500], ["2431  TW", .21, 500], ["QK7X2D", .21, 500]],
          logo: (S, ink) => { S.ring(-1.05, -1.25, .17, .22, ink); S.line([[-1.14, -1.33], [-1.05, -1.17], [-.96, -1.33]], .035, ink); }
        });
        const top = new THREE.PlaneGeometry(CW * .96, CD * .96); top.rotateX(-Math.PI / 2);
        kit.place(chips, top, mark, list.map(([x, , z]) => [x, .423, z])).userData.noCast = true;
        const balls = [];
        CX.forEach(cx => { for (let i = 0; i < 9; i++) if (i < 3 || i > 5) for (let j = 0; j < 13; j++) balls.push([cx + (i - 4) * BP, .05, CZ + (j - 6) * BP, 0, 0, 0, 1, .8, 1]); });
        kit.place(chips, new THREE.SphereGeometry(.075, 8, 5), std({ color: 0xbfc3c8, metalness: 1, roughness: .35 }), balls).userData.noCast = true;
      }

      const pmic = part("pmic");
      smallIC(pmic, {
        x: PMX, z: PMZ, w: PMW, d: PMW, h: .3, pitch: .5 * MM, sides: [[1, 0, 8], [-1, 0, 8], [0, 1, 8], [0, -1, 8]],
        mark: marking(PMW * .95, PMW * .95, { ppu: 200, lines: [["PX5100", .2, 700], ["A4K 2429", .15, 500], ["TW 3N7", .15, 500]] })
      });
      kit.choke(pmic, inductors.map(([x, z]) => [x, 0, z, 0]), { w: 2.5 * MM, d: 2 * MM, h: 1 * MM, text: "R47" });
      mlcc(pmic, cap0805, 2 * MM, 1.25 * MM, 1 * MM, ceramicDark, 0);
      mlcc(pmic, pmic0402, 1 * MM, .5 * MM, .5 * MM, ceramic, 0);

      const spd = part("spd");
      smallIC(spd, {
        x: SPX, z: SPZ, w: 2 * MM, d: 3 * MM, h: .3, pitch: .5 * MM, sides: [[1, 0, 4], [-1, 0, 4]],
        mark: marking(2 * MM * .95, 3 * MM * .95, { ppu: 260, lines: [["S5118", .13, 700], ["B24", .11, 500]] })
      });

      const hs = part("heatspreader");
      const PT = .55, PIN = .89, POUT = PIN + PT;
      const PZ0 = Z(6.4), PZ1 = ZT - 3.3;
      const PHW = 26.95, PCZ = (PZ0 + PZ1) / 2, PHD = (PZ0 - PZ1) / 2;
      const plateShape = new THREE.Shape();
      {
        const s = plateShape, P = (x, z) => [x, -(z - PCZ)], hx = PHW, r = .45, c = .5, cd = .55;
        const l0 = LATCH - 1.05, l1 = LATCH + 1.05;
        const l = (x, z) => s.lineTo(...P(x, z));
        s.moveTo(...P(-hx + c, PZ0)); l(hx - c, PZ0); l(hx, PZ0 - c);
        l(hx, l1); l(hx - cd, l1 - .3); l(hx - cd, l0 + .3); l(hx, l0);
        l(hx, PZ1 + r); s.quadraticCurveTo(...P(hx, PZ1), ...P(hx - r, PZ1));
        l(-hx + r, PZ1); s.quadraticCurveTo(...P(-hx, PZ1), ...P(-hx, PZ1 + r));
        l(-hx, l0); l(-hx + cd, l0 + .3); l(-hx + cd, l1 - .3); l(-hx, l1);
        l(-hx, PZ0 - c);
      }
      const FINZ0 = PZ1 + .05, FIND = 2.8, FINZ = FINZ0 + FIND / 2;
      const face = kit.surface({ w: PHW * 2, h: PHD * 2, ppu: 2040 / (PHW * 2), base: { color: "#30343a", rough: .34, metal: .88, height: .5 } });
      {
        const S = face, pz = z => z - PCZ;
        S.noise(6000, .012, r => ({ height: .42 + r() * .16, color: r() < .5 ? "#272a2f" : "#3b4047", alpha: .45, sx: 60 + r() * 260, sz: 1 }), 31);
        S.rect(0, pz(FINZ), PHW * 2, FIND + .1, { color: "#1d2024", rough: .5, height: .42 });
        S.line([[-PHW, pz(FINZ0 + FIND + .12)], [PHW, pz(FINZ0 + FIND + .12)]], .05, { color: "#15171a", height: .3, rough: .6 });
        [-1, 1].forEach(sd => {
          const xa = sd * 16.6, xb = sd * 19.4, zb0 = pz(PZ0), zt0 = pz(FINZ0 + FIND + .2);
          const clip = [[xa, zb0], [xb, zt0], [sd * PHW, zt0], [sd * PHW, zb0]];
          S.poly(clip, { color: "#2a2d33", height: .47 });
          for (let z = zt0 + .2; z < zb0 - .1; z += .26) {
            const f = (z - zt0) / (zb0 - zt0), x0 = xb + (xa - xb) * f + sd * .25;
            S.line([[x0, z], [sd * (PHW - .15), z]], .075, { color: "#1b1d21", height: .32, rough: .45 });
          }
          S.line([[xa, zb0 - .05], [xb, zt0]], .11, { color: "#d3d7dc", height: .62, rough: .18, metal: 1 });
          S.line([[xa + sd * .28, zb0 - .05], [xb + sd * .28, zt0]], .035, { color: "#8e949b", height: .56, rough: .25, metal: 1 });
        });
        S.line([[-15.9, pz(PZ0 - .55)], [15.9, pz(PZ0 - .55)]], .045, { color: "#c9cdd2", height: .58, rough: .2, metal: 1 });
      }
      const faceMat = face.material({ fit: true, normal: 2.2 });
      const innerMat = std({ color: 0x3a3e44, metalness: .75, roughness: .48 });
      const cutMat = std({ color: 0xd2d6db, metalness: 1, roughness: .2, normalMap: kit.tiles.brushed(), normalScale: new THREE.Vector2(.2, .2) });
      const plateGeo = kit.extrude(plateShape, PT, .07);
      add(hs, plateGeo, [faceMat, cutMat, innerMat], 0, PIN + PT / 2, PCZ);
      const FINH = .22, finGeo = roundBox(.42, FINH, FIND, .08, .05), finMat = std({ color: 0x2f3338, metalness: .85, roughness: .34, normalMap: kit.tiles.brushed(), normalScale: new THREE.Vector2(.2, .2) });
      const finXs = []; for (let x = -25.2; x <= 25.21; x += .9) finXs.push(x);
      kit.place(hs, finGeo, [cutMat, finMat], finXs.map(x => [x, POUT + FINH / 2 - .02, FINZ]));
      const PNZ = .15, PNH = 3.3, PNB = 15.5, PNT = 13.9;
      const panelShape = new THREE.Shape();
      panelShape.moveTo(-PNB + .3, -PNH); panelShape.lineTo(PNB - .3, -PNH); panelShape.lineTo(PNB, -PNH + .3);
      panelShape.lineTo(PNT, PNH); panelShape.lineTo(-PNT, PNH); panelShape.lineTo(-PNB, -PNH + .3);
      const panelGeo = kit.extrude(panelShape, .16, .05);
      const panelFace = (back) => {
        const S = kit.surface({ w: PNB * 2, h: PNH * 2, ppu: 33, base: { color: "#16171a", rough: .3, metal: .8, height: .5 }, underside: back });
        S.noise(2600, .012, r => ({ height: .45 + r() * .1, color: r() < .5 ? "#111214" : "#1f2124", alpha: .5, sx: 60 + r() * 200, sz: 1 }), back ? 12 : 11);
        const silver = { color: "#c3c8ce", rough: .26, metal: 1, height: .64 };
        const dim = { color: "#7d838b", rough: .35, metal: .9, height: .56 };
        const logo = (x, z, k) => {
          const em = (px, pz) => [x - 5.1 * k + px * k, z + (back ? -pz : pz) * k];
          S.poly([em(-.9, .85), em(0, -.95), em(.9, .85), em(.5, .85), em(0, -.15), em(-.5, .85)], silver);
          S.poly([em(-.25, .85), em(0, .38), em(.25, .85)], silver);
          S.text("AURION", x + .9 * k, z, 1.15 * k, silver, { weight: 700, spacing: .42 * k, font: "'IBM Plex Sans', 'Liberation Sans', Arial, sans-serif" });
        };
        if (!back) {
          logo(0, -.35, 1);
          S.line([[-7.5, 1.35], [-1.2, 1.35]], .03, dim); S.line([[1.2, 1.35], [7.5, 1.35]], .03, dim);
          S.text("VANTA RGB", 0, 1.35, .34, dim, { weight: 600, spacing: .22 });
          S.text("DDR5", PNB - 2.6, PNH - .75, .36, dim, { weight: 700, spacing: .1 });
        } else {
          logo(9.2, 0, .62);
        }
        return S.material({ fit: true, normal: 2.4 });
      };
      add(hs, panelGeo, [panelFace(false), cutMat, innerMat], 0, POUT + .07, PNZ);
      const padMat = std({ color: 0x686d73, roughness: .92, metalness: 0, normalMap: kit.tiles.grain(), normalScale: new THREE.Vector2(.4, .4) });
      const padL = (CX[3] + CW / 2) - (CX[0] - CW / 2) + .5, padX = (CX[0] + CX[3]) / 2, padD = CD + .5;
      const topPadH = PIN - (TOP + .425);
      const padGeo = roundBox(padL, topPadH, padD, .15, .03);
      [-padX, padX].forEach(x => add(hs, padGeo, padMat, x, PIN - topPadH / 2, CZ));
      add(hs, roundBox(5.2, PIN - TOP - .41, 3.4, .15, .03), padMat, PMX - .25, PIN - (PIN - TOP - .41) / 2, PMZ);
      const blackPlastic = std({ color: 0x131417, roughness: .55, metalness: 0 });
      add(hs, new THREE.BoxGeometry(53, PIN * 2 - .02, ZT - PZ1 - .04), blackPlastic, 0, 0, (ZT + PZ1) / 2 - .02);
      const lightTex = ctx.texture(1024, 64, (g, W, H) => {
        const gr = g.createLinearGradient(0, 0, W, 0);
        gr.addColorStop(0, "#e38b4f"); gr.addColorStop(.5, "#a594f5"); gr.addColorStop(1, "#5ac8e2");
        g.fillStyle = gr; g.fillRect(0, 0, W, H);
        for (let k = 0; k < 12; k++) {
          const x = (k + .5) / 12 * W, rg = g.createRadialGradient(x, H / 2, 0, x, H / 2, W / 22);
          rg.addColorStop(0, "rgba(255,240,230,.2)"); rg.addColorStop(1, "rgba(255,255,255,0)");
          g.fillStyle = rg; g.fillRect(x - W / 20, 0, W / 10, H);
        }
        for (let y = 0; y < H; y++) {
          const v = 1 - (y + .5) / H;
          const f = v < .32 ? .3 : v < .46 ? .55 + (v - .32) / .14 * .3 : v < .87 ? .85 + .15 * Math.sin((v - .46) / .41 * Math.PI) : .85 - (v - .87) / .13 * .3;
          g.fillStyle = `rgba(0,0,0,${1 - f})`; g.fillRect(0, y, W, 1);
        }
      });
      {
        const hy = 1.62, zb = PZ1 - .06, zt = PZ1 - 2.1, r = .7, prof = [[zb, -hy], [zb, hy]];
        for (let k = 0; k <= 6; k++) { const a = Math.PI / 2 + k / 6 * Math.PI / 2; prof.push([zt + r + Math.cos(a) * r, hy - r + Math.sin(a) * r]); }
        for (let k = 0; k <= 6; k++) { const a = Math.PI + k / 6 * Math.PI / 2; prof.push([zt + r + Math.cos(a) * r, -hy + r + Math.sin(a) * r]); }
        add(hs, prism(prof, -26.5, 26.5), std({ color: 0x3c3c3c, map: lightTex, emissiveMap: lightTex, emissive: 0xffffff, emissiveIntensity: .9, roughness: .82 }));
        add(hs, kit.merge([[prism(prof, -26.98, -26.5)], [prism(prof, 26.5, 26.98)]]), blackPlastic);
      }
      {
        const t = .07, w = 1.5, tab = 1.3, items = [];
        [-1, 1].forEach(s => {
          const xe = s * (PHW + .07 + t / 2);
          items.push([new THREE.BoxGeometry(t, (POUT + t) * 2, w), xe, 0, FINZ]);
          [-1, 1].forEach(sy => items.push([new THREE.BoxGeometry(tab, t, w), xe - s * (tab / 2 - t / 2), sy * (POUT + t / 2), FINZ]));
        });
        add(hs, kit.merge(items), std({ color: 0x5b6067, metalness: .9, roughness: .34 }));
      }

      const back = new THREE.Group(); back.userData.id = "heatspreader";
      add(back, mirrorY(plateGeo), [faceMat, cutMat, innerMat], 0, -(PIN + PT / 2), PCZ);
      kit.place(back, finGeo, [cutMat, finMat], finXs.map(x => [x, -(POUT + FINH / 2 - .02), FINZ, 0, Math.PI]));
      add(back, mirrorY(panelGeo), [panelFace(true), cutMat, innerMat], 0, -(POUT + .07), PNZ);
      const backPadH = PIN - TOP, backPadGeo = roundBox(padL, backPadH, padD, .15, .03);
      [-padX, padX].forEach(x => add(back, backPadGeo, padMat, x, -PIN + backPadH / 2, CZ));
      {
        const w = 15.2, d = 4.5;
        const S = kit.surface({ w, h: d, ppu: 1020 / w, base: { color: "#dfe1e3", rough: .42, metal: .35, height: .5 } });
        const ink = { color: "#1b1d20", height: .52 }, grey = { color: "#50555c" };
        const L = -w / 2 + .35, font = "'IBM Plex Sans', 'Liberation Sans', Arial, sans-serif";
        S.text("AURION", L, -1.62, .52, ink, { align: "left", weight: 800, spacing: .16, font });
        S.text("VANTA RGB", L + 3.9, -1.62, .3, grey, { align: "left", weight: 600, spacing: .06, font });
        S.text("DDR5-6000  CL30-38-38-96  1.35V", L, -.86, .26, ink, { align: "left", weight: 600, font });
        S.text("16GB (1x16GB)  288-PIN UDIMM  NON-ECC", L, -.36, .22, grey, { align: "left", weight: 600, font });
        const rb = kit.rng(8128); let bx = L;
        while (bx < L + 7.6) { const bw = .035 + Math.floor(rb() * 4) * .035; if (rb() < .55) S.rect(bx + bw / 2, .55, bw, .95, ink); bx += bw + .035; }
        S.text("S/N  AV5241603147725", L, 1.34, .2, ink, { align: "left", weight: 600, font: "'JetBrains Mono', 'DejaVu Sans Mono', monospace" });
        S.text("P/N  AV5R16G60C30-RGB", L, 1.78, .22, ink, { align: "left", weight: 700, font: "'JetBrains Mono', 'DejaVu Sans Mono', monospace" });
        S.text("16GB", w / 2 - 2.35, -1.25, .95, ink, { weight: 800, font });
        S.text("6000 MT/s", w / 2 - 2.35, -.12, .3, grey, { weight: 700, font });
        const rr = kit.rng(99), n = 14, cell = .085, ox = w / 2 - 3.7, oz = .62;
        for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
          const on = i === 0 || j === n - 1 || (j === 0 && i % 2 === 0) || (i === n - 1 && j % 2 === 1) || (i > 0 && j < n - 1 && rr() < .5);
          if (on) S.rect(ox + i * cell + cell / 2, oz + j * cell + cell / 2, cell, cell, ink);
        }
        S.text("TESTED", w / 2 - 1.15, .95, .2, ink, { weight: 700, font });
        S.text("VOID IF", w / 2 - 1.15, 1.35, .16, grey, { weight: 600, font });
        S.text("REMOVED", w / 2 - 1.15, 1.63, .16, grey, { weight: 600, font });
        S.rect(0, -1.15, w - .5, .02, grey);
        const label = new THREE.Mesh(new THREE.PlaneGeometry(w, d), S.material({ normal: 1.2 }));
        label.rotation.x = Math.PI / 2; label.position.set(-4.2, -(POUT + .16 + .006), PNZ + .1);
        label.userData.noCast = true;
        add(back, label);
      }
      hs.add(back);

      return {
        layout: {
          heatspreader: { y: 0, dy: 10, dz: -6 },
          chips: { y: TOP, dy: 4.5 },
          pmic: { y: TOP, dy: 6.5 },
          spd: { y: TOP, dy: 6.5 },
          pcb: { y: 0 },
          contacts: { y: 0, dy: -3, dz: 3 }
        },
        anchors: {
          heatspreader: [-21.5, POUT + .1, 1], chips: [CX[6], .42, CZ], pmic: [PMX, .3, PMZ], spd: [SPX, .3, SPZ],
          pcb: [X(116), TOP, Z(5.9)], contacts: [X(20), TOP, (FIN0 + FIN1) / 2]
        },
        hideWhenClosed: ["chips", "pmic", "spd"],
        tick(dt, ease) {
          back.position.set(0, -16 * ease, 6 * ease);
        }
      };
    }
  });
})();
