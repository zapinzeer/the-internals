(function () {
  const root = document.getElementById("cpu3d");
  if (!root) return;
  const data = Internals.cpu;

  Internals.viewer3d(root, {
    prefix: "cpu.part", parts: data.parts, initial: "die", explode: 0.75, yaw: -0.65,
    dist: [92, 104, 128], lookY: 4, elev: 0.5, flipSelect: "pads",
    build(ctx) {
      const { THREE, part, add, std, kit } = ctx;
      const V2 = (x, y) => new THREE.Vector2(x, y);

      const SW = 45, SD = 37.5, ST = 1.15, TOP = ST / 2;
      const DW = 15, DD = DW * data.die.h / data.die.w, DT = .7, BUMP = .08;
      const TW = DW + 1, TD = DD + 1, TT = .2;
      const GAP = .06;
      const PW = 33, PD = 31, PR = 2.2, RE = .45, RF = .22;
      const CW = 28.6, CD = 26.6, CR = 1.4;
      const TF = .65;
      const Y_DIE = TOP + BUMP, Y_TIM = Y_DIE + DT + TT / 2, Y_IHS = TOP + GAP;
      const CEIL = Y_DIE + DT + TT - Y_IHS;
      const LID_H = CEIL + 1.85;
      const PAD_T = .035;
      const FONT = "'Liberation Sans', 'Helvetica Neue', Arial, sans-serif";

      function roundPoly(verts, seg) {
        const out = [], n = verts.length;
        for (let i = 0; i < n; i++) {
          const [x, z, r = 0] = verts[i], P = verts[(i + n - 1) % n], N = verts[(i + 1) % n];
          if (!r) { out.push([x, z]); continue; }
          let ax = P[0] - x, az = P[1] - z, bx = N[0] - x, bz = N[1] - z;
          const la = Math.hypot(ax, az), lb = Math.hypot(bx, bz);
          ax /= la; az /= la; bx /= lb; bz /= lb;
          const th = Math.acos(Math.max(-1, Math.min(1, ax * bx + az * bz)));
          const t = r / Math.tan(th / 2);
          let mx = ax + bx, mz = az + bz; const ml = Math.hypot(mx, mz); mx /= ml; mz /= ml;
          const cd = r / Math.sin(th / 2), cx = x + mx * cd, cz = z + mz * cd;
          const a1 = Math.atan2(z + az * t - cz, x + ax * t - cx), a2 = Math.atan2(z + bz * t - cz, x + bx * t - cx);
          let da = a2 - a1;
          while (da > Math.PI) da -= 2 * Math.PI;
          while (da < -Math.PI) da += 2 * Math.PI;
          const k = Math.max(2, Math.ceil(Math.abs(da) / (Math.PI / 2) * (seg || 6)));
          for (let j = 0; j <= k; j++) { const a = a1 + da * j / k; out.push([cx + Math.cos(a) * r, cz + Math.sin(a) * r]); }
        }
        return out;
      }
      const rrect = (w, d, r, seg) => roundPoly([[-w / 2, -d / 2, r], [w / 2, -d / 2, r], [w / 2, d / 2, r], [-w / 2, d / 2, r]], seg);

      function toShape(pts, holes, down) {
        const conv = list => list.map(([x, z]) => V2(x, down ? z : -z));
        const v = conv(pts);
        if (THREE.ShapeUtils.area(v) < 0) v.reverse();
        const sh = new THREE.Shape(v);
        (holes || []).forEach(h => { const hv = conv(h); if (THREE.ShapeUtils.area(hv) > 0) hv.reverse(); sh.holes.push(new THREE.Path(hv)); });
        return sh;
      }
      function cap(pts, y, down) {
        const g = new THREE.ShapeGeometry(toShape(pts, null, down));
        g.rotateX(down ? Math.PI / 2 : -Math.PI / 2); g.translate(0, y, 0);
        return g;
      }
      function slab(shape, h, b, segs) {
        const geo = new THREE.ExtrudeGeometry(shape, { depth: h - 2 * b, bevelEnabled: true, bevelThickness: b, bevelSize: b, bevelOffset: -b, bevelSegments: segs || 3, curveSegments: 6 });
        geo.rotateX(-Math.PI / 2); geo.translate(0, b, 0);
        const g0 = geo.groups.find(g => g.materialIndex === 0), half = g0.count / 2;
        geo.groups = geo.groups.filter(g => g !== g0).concat([{ start: g0.start + half, count: half, materialIndex: 0 }, { start: g0.start, count: half, materialIndex: 2 }]);
        return geo;
      }
      function sweep(pts, prof, o = {}) {
        const n = pts.length, m = prof.length;
        let A = 0;
        for (let i = 0; i < n; i++) { const p = pts[i], q = pts[(i + 1) % n]; A += p[0] * q[1] - q[0] * p[1]; }
        const s = (A > 0 ? 1 : -1) * (o.inward ? -1 : 1);
        const SN = pts.map((p, i) => {
          const q = pts[(i + 1) % n], dx = q[0] - p[0], dz = q[1] - p[1], l = Math.hypot(dx, dz) || 1;
          return [s * dz / l, -s * dx / l, l];
        });
        const crease = Math.cos(40 * Math.PI / 180);
        const V = pts.map((p, i) => {
          const a = SN[(i + n - 1) % n], b = SN[i];
          let mx = a[0] + b[0], mz = a[1] + b[1]; const ml = Math.hypot(mx, mz) || 1; mx /= ml; mz /= ml;
          const k = 1 / Math.max(.35, mx * b[0] + mz * b[1]);
          return { x: p[0], z: p[1], ox: mx * k, oz: mz * k, nx: mx, nz: mz, smooth: a[0] * b[0] + a[1] * b[1] > crease };
        });
        const PN = prof.map((p, j) => {
          const a = prof[Math.max(0, j - 1)], b = prof[Math.min(m - 1, j + 1)];
          const to = b[0] - a[0], ty = b[1] - a[1], l = Math.hypot(to, ty) || 1;
          return [-ty / l, to / l];
        });
        const pos = [], nor = [], uv = [], idx = [];
        let u = 0;
        for (let i = 0; i < n; i++) {
          const sn = SN[i], base = pos.length / 3;
          [[V[i], u], [V[(i + 1) % n], u + sn[2]]].forEach(([P, uu]) => {
            const nx = P.smooth ? P.nx : sn[0], nz = P.smooth ? P.nz : sn[1];
            prof.forEach(([off, y], j) => {
              pos.push(P.x + P.ox * off, y, P.z + P.oz * off);
              nor.push(nx * PN[j][0], PN[j][1], nz * PN[j][0]);
              uv.push(uu / (o.uScale || 1), o.v ? o.v(off, y) : y);
            });
          });
          for (let j = 0; j < m - 1; j++) { const a = base + j, b = base + m + j; idx.push(a, b, b + 1, a, b + 1, a + 1); }
          u += sn[2];
        }
        let dot = 0;
        for (let t = 0; t < idx.length; t += 3) {
          const [a, b, c] = [idx[t] * 3, idx[t + 1] * 3, idx[t + 2] * 3];
          const e1 = [pos[b] - pos[a], pos[b + 1] - pos[a + 1], pos[b + 2] - pos[a + 2]], e2 = [pos[c] - pos[a], pos[c + 1] - pos[a + 1], pos[c + 2] - pos[a + 2]];
          dot += (e1[1] * e2[2] - e1[2] * e2[1]) * nor[a] + (e1[2] * e2[0] - e1[0] * e2[2]) * nor[a + 1] + (e1[0] * e2[1] - e1[1] * e2[0]) * nor[a + 2];
        }
        if (dot < 0) for (let t = 0; t < idx.length; t += 3) { const k = idx[t + 1]; idx[t + 1] = idx[t + 2]; idx[t + 2] = k; }
        const g = new THREE.BufferGeometry();
        g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
        g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
        g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
        g.setIndex(idx);
        return g;
      }

      function grain(S, amp, seed, scale) {
        const k = scale || 2, w = Math.ceil(S.W / k), h = Math.ceil(S.H / k), c = kit.canvas(w, h), g = c.getContext("2d");
        const img = g.createImageData(w, h), d = img.data, r = kit.rng(seed);
        for (let i = 0; i < d.length; i += 4) { const v = 128 + (r() - .5) * 255; d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255; }
        g.putImageData(img, 0, 0);
        S.g.height.save(); S.g.height.globalAlpha = amp; S.g.height.drawImage(c, 0, 0, S.W, S.H); S.g.height.restore();
      }
      function matrix(S, x, z, size, n, props, seed) {
        const r = kit.rng(seed), m = size / n;
        for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
          const on = i === 0 || j === n - 1 ? true : j === 0 ? i % 2 === 0 : i === n - 1 ? j % 2 === 1 : r() < .48;
          if (on) S.rect(x - size / 2 + (i + .5) * m, z - size / 2 + (j + .5) * m, m * .9, m * .9, props);
        }
      }
      function logo(S, x, z, s, props) {
        S.paint(props, c => {
          const X = S.px(x), Z = S.pz(z), u = S.s(s);
          c.lineWidth = u * .13; c.beginPath();
          c.moveTo(X - u * .5, Z - u * .5); c.lineTo(X + u * .28, Z - u * .5); c.lineTo(X + u * .5, Z - u * .28);
          c.lineTo(X + u * .5, Z + u * .5); c.lineTo(X - u * .5, Z + u * .5); c.closePath(); c.stroke();
          c.fillRect(X - u * .2, Z - u * .2, u * .4, u * .4);
        });
      }

      const nickel = std({ color: 0xc3c5c8, metalness: 1, roughness: .3, normalMap: kit.tiles.grain(), normalScale: V2(.25, .25) });
      const gold = std({ color: 0xe2b464, metalness: 1, roughness: .3 });

      const dscS = [], dscL = [];
      for (let i = 0; i < 15; i++) for (const z of [DD / 2 + .95, DD / 2 + 1.65]) for (const sg of [-1, 1]) dscS.push([-7.35 + i * 1.05, sg * z, 0]);
      for (let i = 0; i < 9; i++) for (const x of [DW / 2 + .95, DW / 2 + 1.65]) for (const sg of [-1, 1]) dscS.push([sg * x, -4.2 + i * 1.05, Math.PI / 2]);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) for (let i = 0; i < 3; i++) dscS.push([sx * 10.9, sz * (6.1 + i * .7), 0]);
      for (let i = 0; i < 15; i++) for (const sg of [-1, 1]) dscL.push([-9.8 + i * 1.4, sg * 11.6, 0]);
      for (let i = 0; i < 12; i++) for (const sg of [-1, 1]) dscL.push([sg * 12.7, -7.7 + i * 1.4, Math.PI / 2]);
      const lscS = [], lscL = [];
      for (let i = 0; i < 8; i++) for (let j = 0; j < 7; j++) lscS.push([-7.0 + i * .8, -4.9 + j * 1.3, Math.PI / 2]);
      for (let i = 0; i < 5; i++) for (let j = 0; j < 11; j++) lscS.push([1.35 + i * 1.35, -5.0 + j * .8, 0]);
      for (let j = 0; j < 4; j++) lscL.push([0, -4.1 + j * 2.1, Math.PI / 2]);
      const PX = .95, PZ = .85, FX = 21.4, FZ = 17.6, lands = [];
      const keys = [[-16.6, -10.2], [16.6, 10.2], [-4.3, -15.4], [4.3, 15.4], [12.2, -13.6], [-12.2, 13.6]];
      const nRows = Math.floor(2 * FZ / PZ) + 1;
      for (let j = 0; j < nRows; j++) {
        const z = -(nRows - 1) * PZ / 2 + j * PZ, off = j % 2 ? PX / 2 : 0;
        for (let x = -FX + off; x <= FX + 1e-6; x += PX) {
          if (Math.abs(x) < 8 && Math.abs(z) < 6) continue;
          const cx = FX + .3 - Math.abs(x), cz = FZ + .3 - Math.abs(z);
          if (cx / PX + cz / PZ < (x < 0 && z > 0 ? 4.6 : 2.4)) continue;
          if (Math.abs(x + 9.5) < 2 && Math.abs(z) > 16) continue;
          if (Math.abs(x) < .5 && Math.abs(z) > 13.5) continue;
          if (keys.some(([kx, kz]) => Math.hypot(x - kx, z - kz) < .9)) continue;
          lands.push([x, z]);
        }
      }

      const sub = part("substrate");
      const subPts = roundPoly([
        [-SW / 2, -SD / 2, .5], [-10.5, -SD / 2, .2], [-10.5, -SD / 2 + 1.3, .95], [-8.5, -SD / 2 + 1.3, .95], [-8.5, -SD / 2, .2],
        [SW / 2, -SD / 2, .5], [SW / 2, SD / 2, .5],
        [-8.5, SD / 2, .2], [-8.5, SD / 2 - 1.3, .95], [-10.5, SD / 2 - 1.3, .95], [-10.5, SD / 2, .2], [-SW / 2, SD / 2, .5]
      ], 6);
      const MASK = "#0f3a27", MASK_HI = "#1a5639";
      const goldP = { color: "#d9ad55", height: .57, rough: .22, metal: 1 };
      const inkP = { color: "#dfe3da", height: .53, rough: .7, metal: 0, alpha: .8 };
      const capPads = (P, list, l, w, flip) => list.forEach(([x, z, ry]) => {
        const e = l * .22, a = e + .16, b = w + .12, zz = flip ? -z : z;
        [-1, 1].forEach(sg => ry ? P.pad(x, zz + sg * (l / 2 - e / 2), b, a, .03) : P.pad(x + sg * (l / 2 - e / 2), zz, a, b, .03));
      });

      const topS = kit.pcb({
        w: SW, d: SD, ppu: 32, mask: MASK, maskHi: MASK_HI, finish: "tin", seed: 5, traces: 0, vias: 0, gloss: .62,
        draw(P) {
          const plane = { color: MASK_HI, height: .52, alpha: .16 };
          P.rect(0, 0, 27.6, 25.6, plane, 1.4);
          P.rect(0, -17.5, 38, 1.7, plane, .3); P.rect(0, 17.5, 38, 1.7, plane, .3);
          const fan = (n, half, span, reach, sg, vert) => {
            for (let i = 0; i < n; i++) {
              const a = (i / (n - 1) - .5) * span, d0 = half + .35, d1 = d0 + .5 + (i % 4) * .22, sp = a * .6, d2 = d1 + Math.abs(sp);
              const pts = [[a, d0], [a, d1], [a + sp, d2], [a + sp, reach - (i % 3) * .6]].map(([p, q]) => vert ? [p, sg * q] : [sg * q, p]);
              P.trace(pts, .07);
              const e = pts[pts.length - 1]; P.via(e[0], e[1], .12);
            }
          };
          fan(40, DD / 2, DW - 1, 13, 1, true); fan(40, DD / 2, DW - 1, 13, -1, true);
          fan(24, DW / 2, DD - 1, 14, 1, false); fan(24, DW / 2, DD - 1, 14, -1, false);
          for (let x = -13.5; x <= 13.5; x += .75) for (const z of [-13.2, 13.2]) P.via(x, z, .1);
          for (let z = -12.4; z <= 12.4; z += .75) for (const x of [-14.2, 14.2]) P.via(x, z, .1);
          P.rect(0, 0, DW + .4, DD + .4, { color: "#15140f", height: .5, rough: .5, metal: 0 }, .2);
          for (let x = -DW / 2 + .3; x < DW / 2 - .2; x += .28) for (let z = -DD / 2 + .3; z < DD / 2 - .2; z += .28) P.circle(x, z, .07, { color: "#9a9ea3", height: .56, rough: .35, metal: 1 });
          capPads(P, dscS, .8, .4); capPads(P, dscL, 1, .5);
          P.poly([[-SW / 2 + .45, SD / 2 - .45], [-SW / 2 + .45, SD / 2 - 2.6], [-SW / 2 + 2.6, SD / 2 - .45]], goldP);
          for (const [x, z] of [[21.3, -17.6], [-21.3, -17.6], [21.3, 17.6]]) { P.circle(x, z, .55, { color: "#0a2a1b", height: .49 }); P.circle(x, z, .25, goldP); }
          for (let i = 0; i < 8; i++) P.circle(3 + i * .75, -17.75, .22, goldP);
          P.text("TI", -16.2, -17.7, .7, inkP, { weight: 800, font: FONT });
          P.text("2518 A07  e4", -12, -17.7, .5, inkP, { font: FONT, align: "left" });
          P.text("SUB 7K2-118", 12.2, 17.75, .5, inkP, { font: FONT, align: "left" });
          matrix(P, 18.6, 17.55, 1.3, 12, { color: "#dfe3da", height: .53, rough: .7, metal: 0 }, 5);
        }
      });
      const topMat = topS.material({ normal: 2.5, fit: true });

      const botS = kit.pcb({
        w: SW, d: SD, ppu: 28, mask: MASK, maskHi: MASK_HI, finish: "tin", seed: 21, traces: 0, vias: 0, gloss: .62,
        draw(Q) {
          lands.forEach(([x, z]) => { Q.circle(x, -z, .35, { color: "#0a2718", height: .47, alpha: .75 }); Q.circle(x, -z, .28, { color: "#3b3120", height: .45, rough: .4, metal: .6 }); });
          Q.rect(0, 0, 15.6, 11.6, { color: MASK_HI, height: .52, alpha: .18 }, .4);
          capPads(Q, lscS, 1, .5, true); capPads(Q, lscL, 1.6, .8, true);
          Q.poly([[-SW / 2 + .4, -SD / 2 + .4], [-SW / 2 + 2.2, -SD / 2 + .4], [-SW / 2 + .4, -SD / 2 + 2.2]], goldP);
          Q.text("TI", -5.6, -5.25, .55, inkP, { weight: 800, font: FONT });
          Q.text("9870K  QX7M  L523F118", 1.2, -5.25, .4, inkP, { font: FONT });
          matrix(Q, 6.9, -5.3, .9, 10, { color: "#dfe3da", height: .53, rough: .7, metal: 0 }, 9);
          for (const [x, z] of [[-7.3, 5.4], [7.3, 5.4]]) { Q.circle(x, z, .3, { color: "#0a2718" }); Q.circle(x, z, .14, goldP); }
        }
      });
      const botMat = botS.material({ normal: 2.5, fit: true });

      const edgeTex = (() => {
        const c = kit.canvas(128, 256), g = c.getContext("2d"), r = kit.rng(3);
        const band = (y0, y1, col) => { g.fillStyle = col; g.fillRect(0, y0 * 256, 128, (y1 - y0) * 256); };
        band(0, 1, "#1d2019"); band(.33, .67, "#5c5739");
        band(0, .04, MASK); band(.96, 1, MASK);
        for (const y of [.08, .13, .18, .23, .28, .71, .76, .81, .86, .91]) band(y, y + .014, "#8a6a42");
        for (let i = 0; i < 1400; i++) { g.fillStyle = r() < .5 ? "rgba(255,250,220,.10)" : "rgba(0,0,0,.18)"; g.fillRect(r() * 128, (.34 + r() * .32) * 256, 1 + r() * 4, 1); }
        return kit.tex(c, true, [1, 1]);
      })();
      const edgeMat = std({ map: edgeTex, roughness: .7 });

      add(sub, cap(subPts, TOP), topMat);
      add(sub, cap(subPts, -TOP, true), botMat);
      add(sub, sweep(subPts, [[0, TOP], [0, -TOP]], { uScale: 3, v: (o, y) => (y + TOP) / ST }), edgeMat);
      const bead = [];
      for (let k = 0; k <= 8; k++) { const o = -.5 + k / 8; bead.push([o, TOP + .003 + .068 * Math.sqrt(Math.max(0, 1 - (o / .5) ** 2))]); }
      add(sub, sweep(rrect(30.8, 28.8, 2), bead), std({ color: 0x0f0f10, roughness: .45 }));
      kit.mlcc(sub, dscS.map(([x, z, ry]) => [x, TOP, z, ry]), { l: .8, w: .4, h: .4 });
      kit.mlcc(sub, dscL.map(([x, z, ry]) => [x, TOP, z, ry]), { l: 1, w: .5, h: .45 });
      const under = new THREE.Group(); under.userData.id = "substrate"; under.rotation.x = Math.PI; under.position.y = -TOP; sub.add(under);
      kit.mlcc(under, lscS.map(([x, z, ry]) => [x, 0, -z, ry]), { l: 1, w: .5, h: .38, color: "#7a6247" });
      kit.mlcc(under, lscL.map(([x, z, ry]) => [x, 0, -z, ry]), { l: 1.6, w: .8, h: .45, color: "#6f5a43" });

      const pads = part("pads");
      kit.place(pads, new THREE.CylinderGeometry(.28, .28, PAD_T, 14), gold, lands.map(([x, z]) => [x, 0, z]));

      const die = part("die");
      const dieS = kit.surface({ w: DW, h: DD, ppu: 68, base: { color: "#8a9099", height: .5, rough: .07, metal: 1 } });
      {
        const k = DW / data.die.w, col = Object.fromEntries(data.die.regions.map(r => [r.id, r.color])), r = kit.rng(77);
        for (const [id, x, y, w, h] of data.die.blocks) {
          const X = -DW / 2 + x * k, Z = -DD / 2 + y * k, W = w * k, H = h * k, cx = X + W / 2, cz = Z + H / 2;
          dieS.rect(cx, cz, W, H, { color: col[id], alpha: .16, rough: id === "l3" ? .05 : .09, height: .51 });
          const fine = { height: .54, alpha: .45 };
          if (id === "l3") {
            for (let u = X + .12; u < X + W; u += .12) dieS.line([[u, Z + .05], [u, Z + H - .05]], .02, fine);
            for (let v = Z + .3; v < Z + H; v += .3) dieS.line([[X + .05, v], [X + W - .05, v]], .03, { height: .47, alpha: .5 });
          } else if (id === "core") {
            const top = y < 40, ch = H * .36, cy = top ? Z + H - ch / 2 - .1 : Z + ch / 2 + .1;
            dieS.rect(cx, cy, W - .3, ch - .1, { color: col.l3, alpha: .12, height: .53 });
            for (let i = 0; i < 18; i++) dieS.rect(X + .2 + r() * (W - .6), (top ? Z + .2 : Z + ch + .3) + r() * (H - ch - .7), .15 + r() * .6, .1 + r() * .4, { color: col.core, alpha: .12, height: .52 + r() * .04 });
          } else if (id === "gpu") {
            for (let i = 0; i < 4; i++) for (let j = 0; j < 6; j++) dieS.rect(X + (i + .5) * W / 4, Z + (j + .5) * H / 6, W / 4 - .22, H / 6 - .22, { color: col.gpu, alpha: .1, height: .53 });
          } else {
            for (let u = X + .15; u < X + W - .1; u += .22) dieS.line([[u, Z + .12], [u, Z + H - .12]], .07, { color: col[id], alpha: .12, height: .53 });
          }
          dieS.strokeRect(cx, cz, W, H, .04, { color: "#000", alpha: .35, height: .47 });
        }
        dieS.strokeRect(0, 0, DW - .2, DD - .2, .06, { height: .47, color: "#000", alpha: .3 });
        const g = dieS.g.color, sheen = g.createLinearGradient(0, dieS.H, dieS.W, 0);
        sheen.addColorStop(0, "rgba(90,200,226,.10)"); sheen.addColorStop(.5, "rgba(165,148,245,.10)"); sheen.addColorStop(1, "rgba(227,139,79,.10)");
        g.fillStyle = sheen; g.fillRect(0, 0, dieS.W, dieS.H);
      }
      const dm = dieS.material({ normal: 1.2, fit: true });
      const dieTop = new THREE.MeshPhysicalMaterial({
        map: dm.map, normalMap: dm.normalMap, normalScale: V2(.5, .5), roughnessMap: dm.roughnessMap, metalnessMap: dm.metalnessMap,
        roughness: 1, metalness: 1, clearcoat: 1, clearcoatRoughness: .03
      });
      const dieSide = std({ color: 0x3a3e46, roughness: .38, metalness: .7 });
      add(die, slab(toShape(rrect(DW, DD, .12, 3)), DT, .06, 2), [dieTop, dieSide, std({ color: 0x1c1d20, roughness: .6 })]);
      const UF = .55, uf = [];
      for (let k = 0; k <= 8; k++) { const a = k / 8 * Math.PI / 2; uf.push([UF * (1 - Math.cos(a)), -BUMP + .004 + (.32 + BUMP) * (1 - Math.sin(a))]); }
      const ufMat = std({ color: 0x1d1915, roughness: .3 });
      add(die, sweep(rrect(DW, DD, .12, 3), uf), ufMat);
      add(die, cap(rrect(DW + 2 * UF, DD + 2 * UF, .12 + UF, 3), -BUMP + .004, true), ufMat);

      const tim = part("tim");
      const timS = kit.surface({ w: TW, h: TD, ppu: 40, base: { color: "#c9ccce", height: .5, rough: .36, metal: 1 } });
      {
        const r = kit.rng(41);
        timS.noise(3000, .1, rr => ({ height: .44 + rr() * .12, alpha: .35, size: .04 + rr() * .1 }), 42);
        const hc = timS.g.height; hc.save(); hc.filter = "blur(1px)"; hc.drawImage(hc.canvas, 0, 0); hc.restore();
        timS.rect(0, 0, DW - .1, DD - .1, { color: "#d2d4d6", rough: .28, alpha: .7 }, .2);
        timS.strokeRect(0, 0, DW, DD, .05, { height: .44, alpha: .5 }, .15);
        for (let i = 0; i < 6; i++) { const x = (r() - .5) * TW * .8, z = (r() - .5) * TD * .8, a = r() * 6.3, l = .4 + r() * 1.2; timS.line([[x, z], [x + Math.cos(a) * l, z + Math.sin(a) * l]], .025, { height: .47, alpha: .4 }); }
      }
      const timSide = std({ color: 0xb9bcbf, metalness: 1, roughness: .42 });
      add(tim, slab(toShape(rrect(TW, TD, .5, 4)), TT, .05, 2), [timS.material({ normal: 3, fit: true }), timSide, timSide], 0, -TT / 2, 0);

      const ihs = part("ihs");
      const topW = PW - 2 * RE, topD = PD - 2 * RE;
      const lidS = kit.surface({ w: topW, h: topD, ppu: 40, base: { color: "#c4c6c9", height: .5, rough: .3, metal: 1 } });
      {
        const r = kit.rng(31), hg = lidS.g.height, rg = lidS.g.rm, W = lidS.W, H = lidS.H;
        grain(lidS, .06, 32, 1);
        hg.save(); rg.save();
        for (let i = 0; i < 700; i++) {
          const a0 = r() * 6.283, R = (.6 + r() * 1.8) * W, cx = W / 2 + Math.cos(a0) * R * (.7 + r() * .3), cy = H / 2 + Math.sin(a0) * R * (.7 + r() * .3);
          const px = r() * W, py = r() * H, rad = Math.hypot(px - cx, py - cy), at = Math.atan2(py - cy, px - cx), span = .04 + r() * .12;
          const c = r() < .5 ? hg : rg;
          c.globalAlpha = c === hg ? .18 : .22; c.lineWidth = 1 + r() * .8;
          const v = r() < .5 ? 112 : 148;
          c.strokeStyle = c === hg ? `rgb(${v},${v},${v})` : `rgb(0,${Math.round((.24 + r() * .14) * 255)},255)`;
          c.beginPath(); c.arc(cx, cy, rad, at - span, at + span); c.stroke();
        }
        hg.restore(); rg.restore();
        for (let i = 0; i < 26; i++) lidS.circle((r() - .5) * topW, (r() - .5) * topD, 2 + r() * 5, { rough: .25 + r() * .12, alpha: .18, blur: 1.5 });
        const etch = { color: "#8b8e93", height: .485, rough: .62, metal: .85 };
        const X0 = -13.6;
        logo(lidS, X0 + 1.4, -8.9, 2.8, etch);
        lidS.text("TI", X0 + 3.4, -8.85, 2.5, etch, { weight: 800, font: FONT, align: "left", spacing: .05 });
        lidS.rect(X0 + 11.1, -8.85, .16, 2.9, etch);
        lidS.text("CORE 9", X0 + 11.9, -8.85, 1.9, etch, { weight: 600, font: FONT, align: "left", spacing: .08 });
        lidS.text("9870K", X0, -4.8, 2.3, etch, { weight: 700, font: FONT, align: "left", spacing: .06 });
        lidS.text("QX7M  3.60GHZ", X0, -1.4, 1.3, etch, { weight: 600, font: FONT, align: "left", spacing: .1 });
        lidS.text("L523F118  00482", X0, 1.4, 1.3, etch, { weight: 600, font: FONT, align: "left", spacing: .1 });
        lidS.text("© '25", X0, 4.1, 1, etch, { weight: 600, font: FONT, align: "left" });
        matrix(lidS, 10.2, 6.6, 4.2, 18, etch, 17);
        lidS.text("G1  e4", 10.2, 9.8, .8, etch, { weight: 600, font: FONT });
      }
      add(ihs, cap(rrect(topW, topD, PR - RE), LID_H), lidS.material({ normal: 1, fit: true }));
      const wall = [];
      for (let k = 0; k <= 5; k++) { const a = Math.PI / 2 * (1 - k / 5); wall.push([-RE + RE * Math.cos(a), LID_H - RE + RE * Math.sin(a)]); }
      for (let k = 0; k <= 4; k++) { const a = Math.PI + Math.PI / 2 * k / 4; wall.push([RF + RF * Math.cos(a), TF + RF + RF * Math.sin(a)]); }
      add(ihs, sweep(rrect(PW, PD, PR), wall), nickel);
      const flangePts = roundPoly([
        [-17.2, -16.2, 1.1], [17.2, -16.2, 1.1], [20.4, -13, 1], [20.4, -4, .3], [19, -4, .45], [19, 4, .45], [20.4, 4, .3], [20.4, 13, 1],
        [17.2, 16.2, 1.1], [-17.2, 16.2, 1.1], [-20.4, 13, 1], [-20.4, 4, .3], [-19, 4, .45], [-19, -4, .45], [-20.4, -4, .3], [-20.4, -13, 1]
      ], 5);
      const cavity = rrect(CW, CD, CR);
      const flS = kit.surface({ w: 41, h: 33, ppu: 12, base: { color: "#c1c3c6", height: .5, rough: .34, metal: 1 } });
      flS.strokeRect(0, 0, 30.8, 28.8, .8, { color: "#141415", rough: .55, metal: 0, alpha: .85 }, 2);
      { const r = kit.rng(6); for (let i = 0; i < 160; i++) { const t = r() * 4, a = t % 1, sd = Math.floor(t), rw = .5 + r() * .9, jit = (r() - .5) * 1.2;
        const [x, z] = sd === 0 ? [(a - .5) * 30, -14.4 + jit] : sd === 1 ? [15.4 + jit, (a - .5) * 28] : sd === 2 ? [(a - .5) * 30, 14.4 + jit] : [-15.4 + jit, (a - .5) * 28];
        flS.circle(x, z, rw * .5, { color: "#141415", rough: .55, metal: 0, alpha: .35 + r() * .4 }); } }
      flS.strokeRect(0, 0, 30.8, 28.8, 1.6, { color: "#1b1b1c", rough: .5, metal: 0, alpha: .25 }, 2);
      const flBottom = flS.material({ normal: 1, fit: true });
      add(ihs, slab(toShape(flangePts, [cavity]), TF, .1, 3), [nickel, nickel, flBottom]);
      add(ihs, sweep(cavity, [[0, CEIL], [0, TF - .1]], { inward: true }), nickel);
      const ceilS = kit.surface({ w: CW, h: CD, ppu: 16, base: { color: "#bdc0c3", height: .5, rough: .36, metal: 1 } });
      ceilS.rect(0, 0, TW + .8, TD + .8, { color: "#d3a65a", rough: .3, metal: 1, height: .49 }, .6);
      ceilS.noise(900, .08, rr => ({ color: rr() < .5 ? "#000" : "#fff", alpha: .05 }), 3);
      add(ihs, cap(cavity, CEIL, true), ceilS.material({ normal: 1, fit: true }));

      return {
        layout: {
          ihs: { y: Y_IHS, dy: 21, dz: -13 },
          tim: { y: Y_TIM, dy: 12, dz: -5 },
          die: { y: Y_DIE, dy: 5.5 },
          substrate: { y: 0 },
          pads: { y: -TOP - PAD_T / 2, dy: -7 }
        },
        anchors: {
          ihs: [-12.5, LID_H, 12], tim: [7.4, TT / 2, 4.9], die: [-6.5, DT, 4], substrate: [21.6, TOP, 17.3], pads: [-19.5, 0, 15.4]
        },
        hideWhenClosed: ["die", "tim"]
      };
    }
  });
})();
