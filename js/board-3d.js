(function () {
  const root = document.getElementById("mb3d");
  if (!root) return;
  const parts = [
    { id: "socket", color: "#e38b4f" },
    { id: "vrm", color: "#8593a5" },
    { id: "dimm", color: "#a594f5" },
    { id: "pcie", color: "#5ac8e2" },
    { id: "m2", color: "#72d49c" },
    { id: "chipset", color: "#d8b25a" },
    { id: "io", color: "#f07a7a" },
    { id: "board", color: "#3f8a5c" }
  ];

  Internals.viewer3d(root, {
    prefix: "mb.part", parts, initial: "socket", explode: 0.7, yaw: -0.45,
    dist: [104, 122, 162], lookY: 2, elev: 0.62,
    build(ctx) {
      const { THREE, part, add, texture, std, roundBox, kit } = ctx;
      const PI = Math.PI;
      const BW = 48.8, BD = 61, TOP = .16;
      const SX = -5, SZ = -14;
      const MONO = "'DejaVu Sans Mono', 'JetBrains Mono', monospace";
      const SANS = "'DejaVu Sans', 'IBM Plex Sans', Arial, sans-serif";

      const grain = kit.tiles.grain(), brushed = kit.tiles.brushed();
      const v2 = s => new THREE.Vector2(s, s);
      const M = {
        black: kit.mat.plastic(),
        satin: std({ color: 0x1b1c20, roughness: .42, normalMap: grain, normalScale: v2(.1) }),
        grey: std({ color: 0x3a3d43, roughness: .48, normalMap: grain, normalScale: v2(.12) }),
        white: std({ color: 0xe0ddd4, roughness: .5, normalMap: grain, normalScale: v2(.1) }),
        gold: kit.mat.gold(), tin: kit.mat.tin(), steel: kit.mat.steel(),
        nickel: std({ color: 0xc2c5c8, metalness: 1, roughness: .27, normalMap: grain, normalScale: v2(.15) }),
        epoxy: kit.mat.epoxy(), ferrite: kit.mat.ferrite(),
        hole: std({ color: 0x050506, roughness: .95 }),
        pad: std({ color: 0x9da3a9, roughness: .85, normalMap: grain, normalScale: v2(.5) }),
        sink: std({ color: 0x3b3f46, metalness: .82, roughness: .34, normalMap: brushed, normalScale: v2(.3) }),
        silver: std({ color: 0xcdd1d6, metalness: 1, roughness: .2, normalMap: brushed, normalScale: v2(.25) }),
        brass: std({ color: 0xc9a45a, metalness: 1, roughness: .3 }),
        die: std({ color: 0x2a2d35, metalness: .6, roughness: .14 }),
        substrate: std({ color: 0x28331f, roughness: .45 }),
        blackMetal: kit.mat.blackMetal(), chrome: kit.mat.chrome(),
        blueIns: std({ color: 0x1f5fd6, roughness: .45 }), redIns: std({ color: 0xc8262b, roughness: .45 })
      };

      const gcache = new Map();
      const cached = (k, make) => { let g = gcache.get(k); if (!g) gcache.set(k, g = make()); return g; };
      const box = (w, h, d) => cached(`b${w},${h},${d}`, () => new THREE.BoxGeometry(w, h, d));
      const rbox = (w, h, d, r, b) => cached(`r${w},${h},${d},${r},${b}`, () => roundBox(w, h, d, r, b));
      const cyl = (r, h, n) => cached(`c${r},${h},${n}`, () => new THREE.CylinderGeometry(r, r, h, n || 16));
      const _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3(1, 1, 1), _m = new THREE.Matrix4();
      function merge(items) {
        let count = 0;
        for (const it of items) count += it[0].index ? it[0].index.count : it[0].attributes.position.count;
        const pos = new Float32Array(count * 3), nor = new Float32Array(count * 3), uvs = new Float32Array(count * 2);
        let o = 0;
        for (const [g, x, y, z, ry, rx, rz] of items) {
          _e.set(rx || 0, ry || 0, rz || 0, "YXZ"); _q.setFromEuler(_e); _p.set(x || 0, y || 0, z || 0);
          const e = _m.compose(_p, _q, _s).elements;
          const P = g.attributes.position.array, N = g.attributes.normal.array, U = g.attributes.uv ? g.attributes.uv.array : null;
          const I = g.index ? g.index.array : null, n = I ? I.length : P.length / 3;
          for (let k = 0; k < n; k++, o++) {
            const i = I ? I[k] : k, a = i * 3, b = o * 3;
            const px = P[a], py = P[a + 1], pz = P[a + 2], nx = N[a], ny = N[a + 1], nz = N[a + 2];
            pos[b] = e[0] * px + e[4] * py + e[8] * pz + e[12];
            pos[b + 1] = e[1] * px + e[5] * py + e[9] * pz + e[13];
            pos[b + 2] = e[2] * px + e[6] * py + e[10] * pz + e[14];
            nor[b] = e[0] * nx + e[4] * ny + e[8] * nz;
            nor[b + 1] = e[1] * nx + e[5] * ny + e[9] * nz;
            nor[b + 2] = e[2] * nx + e[6] * ny + e[10] * nz;
            if (U) { uvs[o * 2] = U[i * 2]; uvs[o * 2 + 1] = U[i * 2 + 1]; }
          }
        }
        const out = new THREE.BufferGeometry();
        out.setAttribute("position", new THREE.BufferAttribute(pos, 3));
        out.setAttribute("normal", new THREE.BufferAttribute(nor, 3));
        out.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
        return out;
      }
      const matOf = m => typeof m === "string" ? M[m] : m;
      const buckets = new Map();
      function put(t, mat, geo, x, y, z, ry, rx, rz) {
        const g = t.isObject3D ? t : t.g, sub = t.isObject3D ? null : t.sub, m = matOf(mat);
        const k = g.userData.id + "|" + (sub ? sub.id : "") + "|" + m.uuid;
        let b = buckets.get(k);
        if (!b) buckets.set(k, b = { g, sub, m, items: [] });
        b.items.push([geo, x || 0, y || 0, z || 0, ry || 0, rx || 0, rz || 0]);
      }
      const bx = (t, mat, w, h, d, x, y, z, ry, rx, rz) => put(t, mat, box(w, h, d), x, y, z, ry, rx, rz);
      function asm() {
        const groups = new Map();
        const A = {
          put(mat, geo, x, y, z, ry, rx, rz) {
            const m = matOf(mat); if (!groups.has(m)) groups.set(m, []);
            groups.get(m).push([geo, x || 0, y || 0, z || 0, ry || 0, rx || 0, rz || 0]); return A;
          },
          box(mat, w, h, d, x, y, z, ry, rx, rz) { return A.put(mat, box(w, h, d), x, y, z, ry, rx, rz); },
          bake() { return [...groups].map(([m, items]) => [m, merge(items)]); }
        };
        return A;
      }
      const place = (t, baked, x, y, z, ry) => baked.forEach(([m, geo]) => put(t, m, geo, x, y, z, ry));
      const target = t => t.isObject3D ? t : t.g;
      function inst(t, geo, mat, list) {
        const im = kit.place(target(t), geo, matOf(mat), list);
        if (!t.isObject3D) t.sub.add(im);
        return im;
      }
      function mesh(t, geo, mat, x, y, z) {
        const m = add(target(t), geo, matOf(mat), x, y, z);
        if (!t.isObject3D) t.sub.add(m);
        return m;
      }
      function screws(t, list, o) {
        const g = target(t), n = g.children.length;
        kit.screw(g, list, o);
        if (!t.isObject3D) g.children.slice(n).forEach(c => t.sub.add(c));
      }
      function decal(t, w, d, mat, x, y, z, ry) {
        const geo = new THREE.PlaneGeometry(w, d); geo.rotateX(-PI / 2);
        const m = mesh(t, geo, mat, x, y + .004, z); m.rotation.y = ry || 0; m.userData.noCast = true;
        return m;
      }
      const lathe = (pts, n) => kit.lathe(pts, n || 24);
      function rrPts(ca, cb, w, h, r, seg) {
        const out = [], s = seg || 3;
        r = Math.min(r, w / 2 - .001, h / 2 - .001);
        [[w / 2 - r, h / 2 - r, 0], [-w / 2 + r, h / 2 - r, PI / 2], [-w / 2 + r, -h / 2 + r, PI], [w / 2 - r, -h / 2 + r, PI * 1.5]].forEach(([x, y, a0]) => {
          for (let i = 0; i <= s; i++) { const a = a0 + i / s * PI / 2; out.push([ca + x + Math.cos(a) * r, cb + y + Math.sin(a) * r]); }
        });
        return out;
      }
      const circPts = (ca, cb, r, n) => [...Array(n || 20)].map((_, i) => [ca + Math.cos(i / (n || 20) * PI * 2) * r, cb + Math.sin(i / (n || 20) * PI * 2) * r]);
      function facePlate(outline, holes, d) {
        const s = new THREE.Shape(outline.map(p => new THREE.Vector2(p[0], p[1])));
        holes.forEach(h => s.holes.push(new THREE.Path(h.map(p => new THREE.Vector2(p[0], p[1])))));
        const g = new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: false, curveSegments: 6 });
        g.rotateY(-PI / 2); g.translate(d, 0, 0);
        return g;
      }

      const silk = { text: [], box: [], pads: [], rings: [] };
      const label = (s, x, z, size, rot, align, weight) => silk.text.push([s, x, z, size || .3, rot || 0, align || "center", weight || 700]);
      const outline = (x, z, w, d) => silk.box.push([x, z, w, d]);
      const padAt = (x, z, w, d) => silk.pads.push([x, z, w, d]);
      const occ = [];
      const occupy = (x, z, w, d, m) => { m = m == null ? .12 : m; occ.push([x - w / 2 - m, z - d / 2 - m, x + w / 2 + m, z + d / 2 + m]); };
      const isFree = (x, z, r) => Math.abs(x) < BW / 2 - .5 && Math.abs(z) < BD / 2 - .5 &&
        !occ.some(([a, b, c, d]) => x + r > a && x - r < c && z + r > b && z - r < d);

      const SMD = {
        c04: { l: .2, w: .1, h: .1, list: [] }, c06: { l: .32, w: .16, h: .16, list: [] }, c08: { l: .4, w: .25, h: .24, list: [] },
        r04: { l: .2, w: .1, h: .07, list: [], res: true }, r06: { l: .32, w: .16, h: .09, list: [], res: true }
      };
      const refN = { C: 100, R: 100 };
      function smdAt(k, x, z, ry, ref) {
        const s = SMD[k]; s.list.push([x, TOP, z, ry || 0]);
        const a = ry ? s.w : s.l, b = ry ? s.l : s.w;
        occupy(x, z, a, b, .05);
        if (ref) { const p = s.res ? "R" : "C"; label(p + (refN[p]++), x + (ry ? .22 : 0), z + (ry ? 0 : .2), .12, 0, "center", 600); }
      }
      function rowOf(k, n, x, z, dx, dz, ry, refEvery) {
        for (let i = 0; i < n; i++) smdAt(k, x + i * dx, z + i * dz, ry, refEvery && i % refEvery === 0);
      }
      function scatter(x0, z0, x1, z1, n, mix, seed) {
        const r = kit.rng(seed), keys = Object.keys(mix), tot = keys.reduce((a, k) => a + mix[k], 0);
        let placed = 0;
        for (let i = 0; i < n * 8 && placed < n; i++) {
          const ry = r() < .65 ? 0 : PI / 2;
          const x = x0 + Math.round(r() * (x1 - x0) / .38) * .38, z = z0 + Math.round(r() * (z1 - z0) / .3) * .3;
          let q = r() * tot, k = keys[0];
          for (const kk of keys) { q -= mix[kk]; if (q <= 0) { k = kk; break; } }
          if (x > x1 || z > z1 || !isFree(x, z, .16)) continue;
          smdAt(k, x, z, ry, r() < .22); placed++;
        }
      }

      function around(x, z, w, d, n, seed, mix) {
        const r = kit.rng(seed), kinds = mix || ["c04", "c04", "r04", "c06"];
        for (let i = 0, placed = 0; i < n * 6 && placed < n; i++) {
          const side = Math.floor(r() * 4), row = r() < .7 ? 0 : 1, off = .32 + row * .34;
          const t = (Math.round((r() - .5) * (side < 2 ? w : d) / .26) * .26);
          const px = side === 0 ? x - w / 2 - off : side === 1 ? x + w / 2 + off : x + t;
          const pz = side === 2 ? z - d / 2 - off : side === 3 ? z + d / 2 + off : z + t;
          if (!isFree(px, pz, .13)) continue;
          smdAt(kinds[Math.floor(r() * kinds.length)], px, pz, side < 2 ? 0 : PI / 2, r() < .2); placed++;
        }
      }

      const chips = [], crystals = [];
      const chip = (t, o) => { chips.push(Object.assign({ t, y: 0, ry: 0, pkg: "qfn", h: .18 }, o)); if (t === board || t.g === board) occupy(o.x, o.z, o.ry ? o.d : o.w, o.ry ? o.w : o.d, .15); };

      const socket = part("socket"), vrm = part("vrm"), dimm = part("dimm"), pcie = part("pcie");
      const m2 = part("m2"), chipset = part("chipset"), io = part("io"), board = part("board");
      const sinks = new THREE.Group(); vrm.add(sinks); const SINK = { g: vrm, sub: sinks };
      const cover = new THREE.Group(); m2.add(cover); const COV = { g: m2, sub: cover };
      const csink = new THREE.Group(); chipset.add(csink); const CS = { g: chipset, sub: csink };
      const shroud = new THREE.Group(); io.add(shroud); const SHR = { g: io, sub: shroud };
      const Y = TOP;

      const XF = -24.75, XB = -20.7;
      const shieldHoles = [];
      const ioA = asm();
      function shell(zc, y0, w, h, openings, mat) {
        const d = .9;
        ioA.put(mat || "nickel", facePlate(rrPts(zc, y0 + h / 2, w, h, .08), openings.map(o => o.pts), .07), XF, 0, 0);
        ioA.box(mat || "nickel", XB - XF - d, h, w, (XF + d + XB) / 2, y0 + h / 2, zc);
        ioA.box(mat || "nickel", d, .05, w, XF + d / 2, y0 + h - .025, zc);
        ioA.box(mat || "nickel", d, .05, w, XF + d / 2, y0 + .025, zc);
        [-1, 1].forEach(s => ioA.box(mat || "nickel", d, h, .05, XF + d / 2, y0 + h / 2, zc + s * (w / 2 - .025)));
        openings.forEach(o => ioA.box("hole", .05, o.h, o.w, XF + d - .03, o.y, o.z));
        shieldHoles.push(rrPts(zc, y0 + h / 2, w + .14, h + .14, .12));
      }
      function usbStack(zc, y0, n, insert, contacts) {
        const w = 2.9, pitch = 1.55, h = n * pitch + .12, ops = [];
        for (let i = 0; i < n; i++) {
          const yc = y0 + .06 + pitch * (i + .5);
          ops.push({ pts: rrPts(zc, yc, 2.4, .92, .05), z: zc, y: yc, w: 2.4, h: .92 });
          ioA.box(insert, .8, .19, 2.0, XF + .5, yc + .17, zc);
          for (let k = 0; k < contacts; k++) ioA.box("gold", .55, .015, contacts > 4 ? .1 : .18, XF + .55, yc + .07, zc + (k - (contacts - 1) / 2) * (contacts > 4 ? .2 : .38));
          [-1, 1].forEach(s => { ioA.box("nickel", .9, .88, .04, XF + .45, yc, zc + s * 1.18); ioA.box("nickel", .9, .04, 2.4, XF + .45, yc + s * .44, zc); });
        }
        shell(zc, y0, w, h, ops);
      }
      const btnPlate = [];
      [[1.15, "white"], [3.05, "grey"]].forEach(([yc, m]) => {
        btnPlate.push(rrPts(-27.2, yc, .98, .98, .12));
        ioA.put(m, rbox(.5, .9, .9, .12, .06), XF + .1, yc, -27.2);
        ioA.box("satin", 1.8, 1.7, 1.9, XF + 1.2, yc, -27.2);
      });
      ioA.put("satin", facePlate(rrPts(-27.2, 2.1, 2.1, 3.9, .1), btnPlate, .08), XF, 0, 0);
      shieldHoles.push(rrPts(-27.2, 1.15, 1.12, 1.12, .14), rrPts(-27.2, 3.05, 1.12, 1.12, .14));
      {
        const hd = [[-25.4, 1.25], [-22.6, 1.25], [-22.6, .62], [-22.85, .35], [-25.15, .35], [-25.4, .62]];
        const dp = [[-25.6, 3.05], [-22.4, 3.05], [-22.4, 2.38], [-22.7, 2.08], [-25.6, 2.08]];
        ioA.put("nickel", facePlate(rrPts(-24, 1.75, 3.5, 3.4, .1), [hd, dp], .07), XF, 0, 0);
        ioA.box("nickel", XB - XF - .8, 3.2, 3.4, (XF + .8 + XB) / 2, 1.75, -24);
        ioA.box("hole", .05, 3.2, 3.4, XF + .8, 1.75, -24);
        ioA.box("nickel", .8, .05, 3.5, XF + .4, 3.42, -24); [-1, 1].forEach(s => ioA.box("nickel", .8, 3.4, .05, XF + .4, 1.75, -24 + s * 1.72));
        [[.8, 2.2], [2.56, 2.5]].forEach(([yc, w]) => {
          ioA.box("black", .75, .26, w * .78, XF + .45, yc, -24);
          for (let k = 0; k < 10; k++) ioA.box("gold", .5, .28, .09, XF + .5, yc, -24 + (k - 4.5) * w * .075);
        });
        shieldHoles.push(rrPts(-24, 1.75, 3.62, 3.52, .15));
      }
      usbStack(-20.4, 0, 4, "black", 4);
      usbStack(-16.9, 0, 2, "blueIns", 9);
      usbStack(-13.3, 0, 2, "redIns", 9);
      {
        const zc = -13.3, y0 = 3.3, w = 3.2, h = 2.8, yc = y0 + 1.25;
        const hole = [[zc - 1.17, yc - .76], [zc + 1.17, yc - .76], [zc + 1.17, yc + .56], [zc + .42, yc + .56], [zc + .42, yc + .82], [zc - .42, yc + .82], [zc - .42, yc + .56], [zc - 1.17, yc + .56]];
        const leds = [rrPts(zc - 1.2, y0 + h - .28, .5, .3, .04), rrPts(zc + 1.2, y0 + h - .28, .5, .3, .04)];
        ioA.put("nickel", facePlate(rrPts(zc, y0 + h / 2, w, h, .1), [hole, ...leds], .07), XF, 0, 0);
        ioA.box("nickel", XB - XF - .1, h, w, (XF + .1 + XB) / 2, y0 + h / 2, zc);
        ioA.box("hole", .06, 1.6, 2.3, XF + 1.6, yc, zc);
        [-1, 1].forEach(s => ioA.box("black", 1.5, 1.6, .06, XF + .8, yc, zc + s * 1.15));
        ioA.box("black", 1.5, .06, 2.3, XF + .8, yc - .76, zc);
        for (let k = 0; k < 8; k++) ioA.box("gold", .7, .03, .07, XF + .9, yc + .38, zc + (k - 3.5) * .2, 0, 0, -.35);
        ioA.box(std({ color: 0x46d160, roughness: .25, emissive: 0x0b3312 }), .08, .28, .48, XF - .01, y0 + h - .28, zc - 1.2);
        ioA.box(std({ color: 0xf2a33a, roughness: .25, emissive: 0x3a2206 }), .08, .28, .48, XF - .01, y0 + h - .28, zc + 1.2);
        shieldHoles.push(rrPts(zc, y0 + h / 2, w + .14, h + .14, .12));
      }
      {
        const zc = -9.8, ops = [];
        [.62, 1.62].forEach(yc => {
          ops.push({ pts: rrPts(zc, yc, 1.67, .52, .25, 5), z: zc, y: yc, w: 1.67, h: .52 });
          ioA.put("nickel", facePlate(rrPts(zc, yc, 1.84, .68, .33, 5), [rrPts(zc, yc, 1.67, .52, .25, 5)], .9), XF, 0, 0);
          ioA.box("black", .7, .1, 1.1, XF + .45, yc, zc);
          for (let k = 0; k < 12; k++) ioA.box("gold", .45, .115, .05, XF + .5, yc, zc + (k - 5.5) * .085);
        });
        ioA.put("nickel", facePlate(rrPts(zc, 1.12, 2.4, 2.1, .1), ops.map(o => o.pts), .07), XF, 0, 0);
        ioA.box("nickel", XB - XF - 1, 2.1, 2.4, (XF + 1 + XB) / 2, 1.12, zc);
        ops.forEach(o => ioA.box("hole", .04, .5, 1.6, XF + .95, o.y, zc));
        shieldHoles.push(rrPts(zc, 1.12, 2.55, 2.25, .14));
        usbStack(zc, 2.3, 2, "redIns", 9);
      }
      usbStack(-6.6, 0, 2, "blueIns", 9);
      const jackCols = { blue: 0x3b6fd6, green: 0x58b947, pink: 0xe07aa8, orange: 0xf08a2c, black: 0x1a1b1e };
      {
        const zc = -1.1, w = 5.2, h = 7.0, holes = [];
        const layout = [[-2.4, 1.3, "optical"], [-2.4, 3.55, "orange"], [-2.4, 5.8, "black"], [.2, 1.3, "pink"], [.2, 3.55, "green"], [.2, 5.8, "blue"]];
        const ring = lathe([[.29, 0], [.5, 0], [.5, .22], [.29, .22], [.29, 0]], 24); ring.rotateZ(-PI / 2);
        const disc = new THREE.CircleGeometry(.3, 20); disc.rotateY(-PI / 2);
        layout.forEach(([z, yc, c]) => {
          if (c === "optical") {
            holes.push(rrPts(z, yc, .85, .85, .06));
            ioA.box("grey", .06, .75, .75, XF + .35, yc, z);
            ioA.box("hole", .06, .4, .4, XF + .6, yc, z);
            shieldHoles.push(rrPts(z, yc, 1.0, 1.0, .08));
            return;
          }
          holes.push(circPts(z, yc, .5, 24));
          ioA.put(M["jack_" + c] = M["jack_" + c] || std({ color: jackCols[c], roughness: .42 }), ring, XF - .02, yc, z);
          ioA.put("hole", disc, XF + .3, yc, z);
          shieldHoles.push(circPts(z, yc, .6, 24));
        });
        ioA.put("black", facePlate(rrPts(zc, h / 2, w, h, .12), holes, .08), XF, 0, 0);
        ioA.box("black", XB - XF - .4, h, w, (XF + .4 + XB) / 2 - .1, h / 2, zc);
        ioA.box("black", .4, .08, w, XF + .2, h - .04, zc); ioA.box("black", .4, h, .08, XF + .2, h / 2, zc - w / 2 + .04); ioA.box("black", .4, h, .08, XF + .2, h / 2, zc + w / 2 - .04);
      }
      const sma = lathe([[0, 0], [.7, 0], [.7, .42], [.58, .42], ...[...Array(9)].flatMap((_, i) => [[.6, .5 + i * .17], [.54, .58 + i * .17]]), [.56, 2.1], [.3, 2.16], [0, 2.16]], 6 * 4);
      sma.rotateZ(PI / 2);
      [-27.2, -24.0].forEach(z => {
        ioA.put("gold", sma, XF - .1, 5.55, z);
        ioA.put("white", cyl(.26, .06, 16), XF - 2.25, 5.55, z, 0, 0, PI / 2);
        ioA.put("gold", cyl(.07, .3, 8), XF - 2.2, 5.55, z, 0, 0, PI / 2);
        ioA.box("satin", 1.4, .9, 1.2, XF + .7, 5.55, z);
        shieldHoles.push(circPts(z, 5.55, .66, 24));
      });
      place(io, ioA.bake(), 0, 0, 0);

      const SH = { z0: -29.0, z1: 2.75, y0: -.45, y1: 8.44 };
      {
        const W = SH.z1 - SH.z0, H = SH.y1 - SH.y0, zc = (SH.z0 + SH.z1) / 2, yc = (SH.y0 + SH.y1) / 2;
        const S = kit.surface({ w: W, h: H, ppu: 40, base: { color: "#16171a", rough: .5, metal: .4, height: .5 } });
        S.noise(9000, .02, r => ({ color: r() < .5 ? "#000" : "#fff", alpha: .03 }), 5);
        const at = (z, y) => [z - zc, -(y - yc)];
        for (let z = SH.z0 + .6; z < SH.z1 - .4; z += .9) { S.rect(...at(z, SH.y1 - .22), .5, .24, { height: .7, color: "#232428" }, .08); S.rect(...at(z, SH.y0 + .22), .5, .24, { height: .7, color: "#232428" }, .08); }
        const ink = { color: "#d8dadc", height: .52 }, txt = (s, z, y, sz, rot) => S.text(s, ...at(z, y), sz || .26, ink, { weight: 700, font: SANS, rot });
        txt("BIOS", -27.2, .2, .2); txt("CLR", -27.2, 4.0, .2); txt("HDMI", -26.2, .8, .17, -PI / 2); txt("DP", -26.2, 2.56, .17, -PI / 2);
        txt("WiFi", -25.6, 6.9, .22); txt("USB 2.0", -20.4, 6.75, .2); txt("5G", -16.9, 3.72, .22);
        txt("2.5G LAN", -13.3, 6.75, .2); txt("20G", -11.45, .62, .17, -PI / 2); txt("10G", -11.45, 1.62, .17, -PI / 2);
        txt("10G", -9.8, 6.0, .2); txt("5G", -6.6, 3.72, .22);
        [["OPT", -2.4, .45], ["C/S", -2.4, 2.7], ["REAR", -2.4, 4.95], ["MIC", .2, .45], ["OUT", .2, 2.7], ["IN", .2, 4.95]].forEach(([s, z, y]) => txt(s, z, y, .17));
        S.text("AURION", ...at(-4.6, 7.6), .32, { color: "#9ea3a8", height: .45 }, { weight: 800, font: SANS, spacing: .06 });
        const mat = S.material({ normal: 2 });
        for (const t of [mat.map, mat.normalMap, mat.roughnessMap]) { t.repeat.set(1 / W, 1 / H); t.offset.set(-SH.z0 / W, -SH.y0 / H); }
        const plate = mesh(io, facePlate([[SH.z0, SH.y0], [SH.z1, SH.y0], [SH.z1, SH.y1], [SH.z0, SH.y1]], shieldHoles, .05), mat, XF - .12, 0, 0);
        void plate;
        bx(io, "blackMetal", .5, .04, W, XF - .12 + .25, SH.y1, zc); bx(io, "blackMetal", .5, .04, W, XF - .12 + .25, SH.y0, zc);
        bx(io, "blackMetal", .5, H, .04, XF - .12 + .25, yc, SH.z0); bx(io, "blackMetal", .5, H, .04, XF - .12 + .25, yc, SH.z1);
      }

      {
        const z0 = -28.6, z1 = -4.9, L = z1 - z0, zc = (z0 + z1) / 2, x0 = -24.7, x1 = -20.15;
        put(SHR, "sink", rbox(x1 - x0, .38, L, .25, .08), (x0 + x1) / 2, 7.26, zc);
        bx(SHR, "satin", .32, 6.9, L - .1, x1 - .16, 3.62, zc);
        [z0 + .16, z1 - .16].forEach(z => bx(SHR, "satin", x1 - x0 - .1, 6.9, .32, (x0 + x1) / 2, 3.62, z));
        bx(SHR, "silver", .14, .14, L - .2, x1 - .02, 7.08, zc, 0, 0, PI / 4);
        const T = kit.surface({ w: x1 - x0 - .2, h: L - .2, ppu: 44, base: { color: "#2b2e33", rough: .34, metal: .85, height: .5 } });
        for (let i = -60; i < 60; i++) T.line([[-3, i * .4], [3, i * .4 + 3]], .05, { height: .42, color: "#24272b" });
        T.rect(0, 0, 3.2, 10, { color: "#1b1d20", height: .5, rough: .5, metal: .3 }, .3);
        T.text("AURION", 0, 0, .7, { color: "#b9bec4", height: .56, rough: .25, metal: 1 }, { weight: 800, font: SANS, rot: -PI / 2, spacing: .12 });
        T.text("X7 FORGE", 1.15, 6.5, .3, { color: "#8e939a", height: .55 }, { weight: 700, font: SANS, rot: -PI / 2, spacing: .05 });
        decal(SHR, x1 - x0 - .2, L - .2, T.material({ normal: 3 }), (x0 + x1) / 2, 7.45, zc);
        const Sd = kit.surface({ w: L - .4, h: 6.4, ppu: 40, base: { color: "#18191c", rough: .55, metal: 0, height: .5 } });
        for (let x = -12; x < 12; x += .5) for (let y = -3.2; y < 3.4; y += .56) Sd.poly([[x, y], [x + .25, y - .28], [x + .5, y], [x + .25, y + .28]].map(([a, b]) => [a + ((Math.round(y / .56) % 2) ? .25 : 0), b]), { height: .56, color: "#1f2024" });
        Sd.rect(0, 0, 9, 2.2, { color: "#141518", height: .5, rough: .4 }, .2);
        Sd.text("AURION", 0, .05, .75, { color: "#c4c8cd", height: .54, rough: .3 }, { weight: 800, font: SANS, spacing: .15 });
        const sideMat = Sd.material({ normal: 2.5 });
        const sp = new THREE.PlaneGeometry(L - .4, 6.4); sp.rotateY(PI / 2);
        const side = mesh(SHR, sp, sideMat, x1 + .012, 3.6, zc); side.userData.noCast = true;
        const glowTex = texture(256, 8, (g, W, H) => {
          const gr = g.createLinearGradient(0, 0, W, 0);
          ["#ff6a3d", "#ff3d8b", "#9b5cff", "#3db8ff"].forEach((c, i) => gr.addColorStop(i / 3, c));
          g.fillStyle = gr; g.fillRect(0, 0, W, H);
        });
        const strip = new THREE.BoxGeometry(.06, .16, L - .6);
        mesh(SHR, strip, std({ color: 0xffffff, map: glowTex, emissiveMap: glowTex, emissive: 0xffffff, emissiveIntensity: .55, roughness: .4 }), x1 + .02, 6.72, zc);
      }

      {
        bx(socket, "satin", 9.2, .38, 10.6, SX, .19, SZ);
        bx(socket, "satin", .7, .24, 10.6, SX - 4.25, .5, SZ); bx(socket, "satin", .7, .24, 10.6, SX + 4.25, .5, SZ);
        bx(socket, "satin", 7.8, .24, .65, SX, .5, SZ - 4.975); bx(socket, "satin", 7.8, .24, .65, SX, .5, SZ + 4.975);
        [[-3.85, -2.2], [-3.85, 2.6], [3.85, -1.2]].forEach(([dx, dz]) => bx(socket, "satin", .22, .24, .5, SX + dx, .5, SZ + dz));
        const P = kit.surface({ w: 7.8, h: 9.3, ppu: 20 / .18, base: { color: "#1c1d21", rough: .6, metal: 0, height: .45 } });
        [["color", "#1c1d21", "#dcb25d"], ["height", "rgb(115,115,115)", "rgb(204,204,204)"], ["rm", "rgb(0,153,0)", "rgb(0,64,255)"]].forEach(([k, bg, fg]) => {
          const t = kit.canvas(20, 36), g = t.getContext("2d");
          g.fillStyle = bg; g.fillRect(0, 0, 20, 36);
          g.strokeStyle = fg; g.lineWidth = 4.5; g.lineCap = "round";
          [[5, 9], [15, 27]].forEach(([x, y]) => { g.beginPath(); g.moveTo(x - 4, y + 3); g.lineTo(x + 4, y - 3); g.stroke(); });
          const c = P.g[k]; c.fillStyle = c.createPattern(t, "repeat"); c.fillRect(0, 0, P.W, P.H);
        });
        P.rect(0, 0, 2.1, 3.3, { color: "#15161a", height: .4 });
        P.text("LGA", 0, -.6, .32, { color: "#44464c", height: .47 }, { weight: 800, font: SANS });
        P.text("1851", 0, .1, .32, { color: "#44464c", height: .47 }, { weight: 800, font: SANS });
        P.text("TI · TW", 0, .8, .18, { color: "#3a3c41", height: .47 }, { weight: 600, font: SANS });
        decal(socket, 7.8, 9.3, P.material({ normal: 2.5 }), SX, .38, SZ);
      }
      {
        const s = kit.shapeRect(10.8, 13.4, .5);
        const inner = new THREE.Path(); rrPts(0, 0, 9.4, 11.0, .3).forEach(([a, b], i) => i ? inner.lineTo(a, b) : inner.moveTo(a, b)); s.holes.push(inner);
        put(socket, "steel", kit.extrude(s, .12, .02), SX, .06, SZ);
        screws(socket, [[-4.7, -6.0], [4.7, -6.0], [-4.7, 6.0], [4.7, 6.0]].map(([dx, dz]) => [SX + dx, .12, SZ + dz]), { r: .38, h: .22, mat: M.blackMetal });
        [-3.4, 3.4].forEach(dx => put(socket, "steel", cyl(.2, 1.1, 12), SX + dx, .3, SZ - 6.3, 0, 0, PI / 2));
        [-3.6, 3.9].forEach(dx => bx(socket, "steel", .5, .4, .6, SX + dx, .3, SZ + 6.2));
        bx(socket, "steel", .5, .5, .35, SX + 5.35, .3, SZ - 5.6);
        bx(socket, "steel", .8, .08, .35, SX + 5.2, .56, SZ - 5.6);
        bx(socket, "steel", .22, .7, .9, SX + 5.05, .35, SZ + 6.2);
      }
      const hinge = new THREE.Group(); hinge.position.set(SX, .72, SZ - 6.3); socket.add(hinge);
      const HNG = { g: socket, sub: hinge };
      {
        const s = new THREE.Shape();
        [[-4.9, 0], [4.9, 0], [4.9, 11.9], [.9, 11.9], [.7, 12.7], [-.7, 12.7], [-.9, 11.9], [-4.9, 11.9]].forEach(([x, z], i) => i ? s.lineTo(x, -z) : s.moveTo(x, -z));
        const win = new THREE.Path(); rrPts(0, -6.1, 7.0, 8.4, .5).forEach(([a, b], i) => i ? win.lineTo(a, b) : win.moveTo(a, b)); s.holes.push(win);
        put(HNG, "nickel", kit.extrude(s, .1, .02), 0, 0, 0);
        [-1, 1].forEach(sd => bx(HNG, "nickel", .1, .42, 10.4, sd * 4.87, -.2, 6.0));
        [-3.4, 3.4].forEach(dx => bx(HNG, "nickel", 1.0, .1, .5, dx, -.08, -.1));
        put(HNG, "black", rbox(8.3, .16, 9.7, .35, .04), 0, .13, 6.0);
        put(HNG, "black", rbox(6.2, .18, 7.4, .6, .05), 0, .3, 6.0);
        put(HNG, "black", rbox(2.2, .12, 1.2, .3, .03), 0, .12, 11.3);
        const C = kit.surface({ w: 6.0, h: 7.2, ppu: 70, base: { color: "#141518", rough: .5, metal: 0, height: .5 } });
        C.noise(4000, .03, r => ({ color: r() < .5 ? "#000" : "#fff", alpha: .03 }), 4);
        const ci = { color: "#d7d9dc", height: .54, rough: .6 };
        C.poly([[0, -2.9], [-.45, -2.2], [.45, -2.2]], ci);
        C.text("REMOVE THIS COVER", 0, -1.4, .26, ci, { weight: 800, font: SANS });
        C.text("AFTER THE CPU", 0, -.9, .26, ci, { weight: 800, font: SANS });
        C.text("IS INSTALLED", 0, -.4, .26, ci, { weight: 800, font: SANS });
        C.strokeRect(0, 1.2, 4.6, 1.8, .05, ci, .2);
        C.text("KEEP THE COVER FOR", 0, .9, .17, ci, { weight: 600, font: SANS });
        C.text("RMA / TRANSPORT", 0, 1.35, .17, ci, { weight: 600, font: SANS });
        C.text("TI · SOCKET CAP", 0, 2.9, .2, { color: "#5e6167", height: .46 }, { weight: 700, font: SANS });
        decal(HNG, 6.0, 7.2, C.material({ normal: 2 }), 0, .39, 6.0);
      }
      const leverPivot = new THREE.Group(); leverPivot.position.set(SX + 5.3, .42, SZ + 6.2); socket.add(leverPivot);
      const LEV = { g: socket, sub: leverPivot };
      put(LEV, "chrome", cyl(.12, 12.2, 12), 0, 0, -6.1, 0, PI / 2, 0);
      put(LEV, "chrome", new THREE.SphereGeometry(.12, 12, 8), 0, 0, -12.2);
      put(LEV, "chrome", cyl(.12, 1.1, 12), .55, 0, -12.2, 0, 0, PI / 2);
      put(LEV, "black", rbox(.5, .34, .34, .12, .04), 1.2, 0, -12.2);
      put(LEV, "chrome", cyl(.12, 3.9, 12), -1.95, 0, 0, 0, 0, PI / 2);
      put(LEV, "chrome", cyl(.12, 1.6, 12), -4.3, .18, 0, 0, 0, PI / 2);

      const chokesTop = [], chokesLeft = [];
      for (let i = 0; i < 7; i++) chokesTop.push([-12.2 + i * 2.3, 0, -24.4]);
      for (let i = 0; i < 8; i++) chokesLeft.push([-14.9, 0, -24.4 + i * 2.3]);
      kit.choke(vrm, chokesTop.concat(chokesLeft), { w: 1.95, d: 1.95, h: 1.45, text: "R22" });
      chokesTop.forEach(([x, , z], i) => chip(vrm, { x, z: z - 2.2, w: 1.0, d: 1.2, h: .2, pkg: "stage", lines: ["KPS90", "A" + (2530 + i)] }));
      chokesLeft.forEach(([x, , z], i) => chip(vrm, { x: x - 2.5, z, w: 1.2, d: 1.0, h: .2, pkg: "stage", lines: ["KPS90", "B" + (2530 + i)] }));
      const caps = [];
      for (let i = 0; i < 6; i++) caps.push([-12.35, 0, -19.3 + i * 2.2]);
      for (let i = 0; i < 6; i++) caps.push([-9.4 + i * 2.05, 0, -22.35]);
      kit.polycap(vrm, caps, { r: .52, h: 1.25, band: "#34373d", text: "820" });
      chip(vrm, { x: -11.6, z: -3.9, w: 1.1, d: 1.1, h: .16, pkg: "qfn", lines: ["KPW", "8920"] });
      function vrmSink(t, x0, x1, z0, z1, along, bw, pw) {
        const L = along === "x" ? x1 - x0 : z1 - z0, c = along === "x" ? (x0 + x1) / 2 : (z0 + z1) / 2;
        const o0 = along === "x" ? z0 : x0;
        const at = (l, a) => along === "x" ? [c + l, a] : [a, c + l];
        const bb = (across0, across1, y0, y1, r) => {
          const w = across1 - across0, h = y1 - y0, a = (across0 + across1) / 2;
          const [x, z] = at(0, a);
          put(t, "sink", along === "x" ? rbox(L, h, w, r, .05) : rbox(w, h, L, r, .05), x, y0 + h / 2, z);
        };
        bb(o0, o0 + bw, .36, 1.95, .12);
        bb(o0, o0 + pw, 1.95, 2.55, .12);
        const nf = Math.floor((pw - .2) / .6);
        for (let k = 0; k < nf; k++) {
          const a0 = o0 + .15 + k * .6, hgt = k % 2 ? 2.1 : 2.4;
          bb(a0, a0 + .3, 2.55, 2.55 + hgt, .06);
        }
        { const [x, z] = at(0, o0 + pw - .02); put(t, "silver", box(along === "x" ? L - .2 : .08, .08, along === "x" ? .08 : L - .2), x, 2.5, z); }
        { const [x, z] = at(0, o0 + bw / 2); put(t, "pad", box(along === "x" ? L - .3 : bw - .2, .16, along === "x" ? bw - .2 : L - .3), x, .28, z); }
        return { L, c, o0, at };
      }
      const sTop = vrmSink(SINK, -15.3, 2.4, -28.0, -24.3, "x", 2.5, 3.7);
      const sLeft = vrmSink(SINK, -20.0, -15.4, -27.4, -6.4, "z", 3.4, 4.6);
      {
        const T = kit.surface({ w: 15.6, h: 1.7, ppu: 60, base: { color: "#2a2d32", rough: .32, metal: .85, height: .5 } });
        for (let i = -40; i < 40; i++) T.line([[i * .22, -1], [i * .22 + .9, 1]], .03, { height: .44, color: "#23262a" });
        T.rect(0, 0, 5.2, 1.2, { color: "#1c1e22", height: .5, rough: .45, metal: .4 }, .2);
        T.text("AURION", 0, .03, .56, { color: "#c3c8ce", height: .56, rough: .22, metal: 1 }, { weight: 800, font: SANS, spacing: .12 });
        T.strokeRect(0, 0, 15.5, 1.6, .04, { color: "#aeb3b9", height: .55, metal: 1, rough: .2 });
        const tm = T.material({ normal: 3 });
        const [tx, tz] = sTop.at(-.8, sTop.o0 + .95);
        put(SINK, "sink", rbox(15.8, .36, 1.9, .2, .06), tx, 5.1, tz);
        decal(SINK, 15.6, 1.7, tm, tx, 5.28, tz);
        const [lx, lz] = sLeft.at(.4, sLeft.o0 + .95);
        put(SINK, "sink", rbox(1.9, .36, 15.8, .2, .06), lx, 5.1, lz);
        decal(SINK, 15.6, 1.7, tm, lx, 5.28, lz, PI / 2);
        screws(SINK, [[tx - 7.3, 5.28, tz], [tx + 7.3, 5.28, tz], [lx, 5.28, lz - 7.3], [lx, 5.28, lz + 7.3]], { r: .3, h: .16, mat: M.blackMetal });
      }
      {
        const curve = new THREE.CatmullRomCurve3([[2.0, 1.7, -25.1], [-14.8, 1.7, -25.1], [-16.0, 1.7, -24.6], [-16.35, 1.7, -23.2], [-16.35, 1.7, -8.0]].map(p => new THREE.Vector3(...p)), false, "catmullrom", .1);
        mesh(SINK, new THREE.TubeGeometry(curve, 80, .26, 12, false), "nickel");
      }

      const DIMM_X = [6.45, 8.35, 10.65, 12.55], DZ0 = -27.2, DZ1 = .7, DL = DZ1 - DZ0, DZC = (DZ0 + DZ1) / 2;
      {
        const a = asm(), H = 1.4;
        a.box("satin", .42, H, DL, -.39, H / 2, 0); a.box("satin", .42, H, DL, .39, H / 2, 0);
        a.box("black", .36, .72, DL - .4, 0, .36, 0);
        a.box("satin", 1.2, H + .12, .7, 0, (H + .12) / 2, DL / 2 - .35);
        a.box("satin", 1.2, H, .5, 0, H / 2, -DL / 2 + .25);
        a.box("satin", .36, 1.05, .26, 0, .52, 2.1);
        a.box("satin", .24, .25, DL - 1.4, -.39, H + .02, 0); a.box("satin", .24, .25, DL - 1.4, .39, H + .02, 0);
        for (let k = -6; k <= 6; k++) { a.box("satin", 1.22, .5, .08, 0, .25, k * 2.1); }
        const baked = a.bake();
        const latch = asm();
        latch.put("grey", rbox(1.12, 2.1, .62, .14, .05), 0, 1.05, -.31);
        latch.box("grey", .9, .25, .5, 0, 2.0, -.62);
        latch.box("grey", .36, .6, .35, 0, 1.3, .15);
        const lb = latch.bake();
        lb.forEach(([, g]) => g.rotateX(-.32));
        const contacts = [];
        DIMM_X.forEach((x, i) => {
          place(dimm, baked, x, 0, DZC);
          place(dimm, lb, x, 0, DZ0 - .05);
          for (let z = DZ0 + .8; z < DZ1 - .8; z += .17) if (Math.abs(z - (DZC + 2.1)) > .25) contacts.push([x - .19, 1.3, z], [x + .19, 1.3, z]);
        });
        inst(dimm, box(.04, .12, .07), "gold", contacts);
        DIMM_X.forEach((x, i) => label("DDR5_" + ["A1", "A2", "B1", "B2"][i], x - .95, DZ1 - 3.5, .2, -PI / 2));
      }

      const PX0 = -15;
      const SLOTS = [{ z: 3.1, len: 17.8, armour: true, name: "PCIEX16_1" }, { z: 11.3, len: 5.0, name: "PCIEX1_1" }, { z: 15.3, len: 17.8, name: "PCIEX16_2" }];
      {
        const contacts = [];
        SLOTS.forEach(s => {
          const L = s.len, xc = PX0 + L / 2, H = 2.2, a = asm(), m = s.armour ? "satin" : "satin";
          a.box(m, L, H, .56, 0, H / 2, -.47); a.box(m, L, H, .56, 0, H / 2, .47);
          a.box("black", L - .3, 1.0, .38, 0, .5, 0);
          a.box(m, .5, H, 1.5, -L / 2 + .25, H / 2, 0); a.box(m, .4, H, 1.5, L / 2 - .2, H / 2, 0);
          a.box(m, .28, H - .2, .38, -L / 2 + 2.33, (H - .2) / 2, 0);
          for (let x = -L / 2 + .3; x < L / 2 - .3; x += .2) if (Math.abs(x - (-L / 2 + 2.33)) > .2) contacts.push([xc + x, 2.1, s.z - .2], [xc + x, 2.1, s.z + .2]);
          if (s.len > 10) {
            a.put("grey", rbox(1.0, 1.7, 1.45, .2, .05), L / 2 + .5, .85, 0);
            a.box("grey", .3, .5, 1.1, L / 2 + .15, 1.9, 0);
          }
          place(pcie, a.bake(), xc, 0, s.z);
          outline(xc, s.z, L + .4, 1.9);
          label(s.name, PX0 + .2, s.z + 1.25, .22, 0, "left");
          if (s.armour) {
            const T = kit.surface({ w: L, h: H, ppu: 50, base: { color: "#b8bdc3", rough: .3, metal: 1, height: .5 } });
            T.rect(0, .95, L, .18, { height: .62 }); T.rect(0, -.9, L, .18, { height: .62 });
            T.text("AURION  STEEL ARMOR", -L / 2 + 4.2, .05, .36, { height: .62, color: "#9ea4aa" }, { weight: 800, font: SANS, spacing: .06 });
            T.text("PCIe 5.0", L / 2 - 2.6, .05, .36, { height: .62, color: "#9ea4aa" }, { weight: 800, font: SANS });
            const am = T.material({ normal: 3 });
            [-1, 1].forEach(sd => { const p = new THREE.PlaneGeometry(L + .2, H); if (sd < 0) p.rotateY(PI); put(pcie, am, p, xc, H / 2 + .05, s.z + sd * .797); });
            [-1, 1].forEach(sd => {
              bx(pcie, "steel", L + .2, .05, .5, xc, H + .03, s.z + sd * .55);
              bx(pcie, "steel", L + .2, H - .1, .04, xc, H / 2, s.z + sd * .77);
            });
            bx(pcie, "steel", .05, H, 1.6, PX0 - .12, H / 2, s.z); bx(pcie, "steel", .05, H, 1.6, PX0 + L + .1, H / 2, s.z);
            for (let x = PX0 + 1; x < PX0 + L; x += 2.9) [-1, 1].forEach(sd => bx(pcie, "tin", .5, .05, .25, x, .03, s.z + sd * .92));
          }
        });
        inst(pcie, box(.07, .12, .05), "gold", contacts);
      }

      const M2Z = [-.7, 7.5, 19.8], M2X0 = -15.2, M2X1 = 2.4, M2L = M2X1 - M2X0, M2C = (M2X0 + M2X1) / 2;
      {
        const conn = asm();
        conn.box("satin", 1.0, .7, 4.4, 0, .35, 0);
        conn.box("hole", .05, .26, 4.0, -.5, .42, 0);
        conn.box("satin", .3, .26, .15, -.4, .42, -1.3);
        conn.box("tin", .55, .04, .35, .1, .02, -2.35); conn.box("tin", .55, .04, .35, .1, .02, 2.35);
        for (let k = 0; k < 34; k++) { const z = (k - 16.5) * .115; if (Math.abs(z + 1.3) > .12) { conn.box("gold", .3, .02, .05, -.36, .33, z); conn.box("gold", .3, .02, .05, -.36, .52, z + .057); } }
        const cb = conn.bake();
        const st = asm();
        st.put("brass", cyl(.3, .55, 6), 0, .275, 0); st.put("hole", cyl(.12, .02, 10), 0, .56, 0);
        const sb = st.bake();
        M2Z.forEach((z, i) => {
          place(m2, cb, M2X1 - .6, 0, z);
          place(m2, sb, M2X1 - 1.1 - 16, 0, z);
          outline(M2C, z, M2L + .2, 4.7);
          label("M.2_" + (i + 1) + (i ? "  PCIe 4.0 x4" : "  PCIe 5.0 x4"), M2X0 + .4, z - 1.9, .22, 0, "left");
          label("M2_" + (i + 1), M2X1 - 1.6, z + 1.9, .2);
          [2242, 2260, 2280].forEach((n, k) => { silk.rings.push([M2X1 - 1.1 - [8.4, 12.0, 16][k], z, .28]); label(String(n), M2X1 - 1.1 - [8.4, 12.0, 16][k], z + .55, .14); });
        });
        const T = kit.surface({ w: M2L, h: 4.8, ppu: 52, base: { color: "#34383e", rough: .36, metal: .85, height: .5 } });
        for (let i = -60; i < 60; i++) T.line([[i * .3, -2.4], [i * .3 + 2.4, 2.4]], .05, { height: .42, color: "#2b2e33" });
        T.rect(-2.4, 0, 9.6, 4.8, { color: "#303338", height: .5, rough: .3, metal: .9 });
        for (let x = -7; x <= 2.2; x += .24) T.line([[x, -2.4], [x, 2.4]], .02, { height: .47, color: "#2d3035" });
        T.text("M.2", -5.6, .1, .9, { color: "#c8ccd1", height: .56, rough: .22, metal: 1 }, { weight: 800, font: SANS });
        T.text("SHIELD FROZR", -1.2, .95, .28, { color: "#8f959c", height: .55 }, { weight: 700, font: SANS, spacing: .06 });
        T.text("AURION", -.9, -.6, .5, { color: "#b0b5bb", height: .55, rough: .25, metal: 1 }, { weight: 800, font: SANS, spacing: .1 });
        T.strokeRect(0, 0, M2L - .15, 4.65, .04, { color: "#aeb3b9", height: .55, metal: 1, rough: .2 });
        const cm = T.material({ normal: 3 });
        M2Z.forEach(z => {
          put(COV, "sink", rbox(M2L, .5, 5.0, .3, .08), M2C, .98, z);
          decal(COV, M2L - .1, 4.8, cm, M2C, 1.23, z);
          bx(COV, "pad", M2L - 1.6, .16, 4.2, M2C - .4, .66, z);
          bx(COV, std({ color: 0x2f7fd8, roughness: .3, transparent: false }), 1.1, .02, 1.0, M2X0 + .9, .58, z + 2.2);
          screws(COV, [[M2X0 + .5, 1.23, z], [M2X1 - .5, 1.23, z]], { r: .34, h: .2, mat: M.blackMetal });
        });
      }

      const CHX = 10.2, CHZ = 10.2;
      {
        put(chipset, "substrate", rbox(4.8, .14, 4.8, .12, .03), CHX, .12, CHZ);
        put(chipset, "die", rbox(2.6, .14, 2.0, .05, .02), CHX, .26, CHZ - .2);
        const sm = [];
        for (let k = 0; k < 18; k++) { const a = k / 18 * PI * 2; sm.push([CHX + Math.cos(a) * 1.8, .19, CHZ + Math.sin(a) * 1.7 - .1, Math.round(k / 4) % 2 ? 0 : PI / 2]); }
        kit.mlcc(chipset, sm, { l: .2, w: .1, h: .08 });
        chip(chipset, { x: CHX + 1.4, z: CHZ + 1.9, w: 1.6, d: .6, h: .01, y: .19, pkg: "none", color: "#28331f", ink: "#9aa38e", lines: ["TI-H870"] });
        bx(CS, "pad", 3.0, .12, 2.4, CHX, .39, CHZ - .2);
        put(CS, "sink", rbox(9.0, 1.0, 9.8, .7, .12), CHX, .95, CHZ);
        put(CS, "sink", rbox(7.4, .5, 8.2, .6, .1), CHX, 1.66, CHZ);
        bx(CS, "silver", 7.2, .06, .08, CHX, 1.46, CHZ + 4.15); bx(CS, "silver", 7.2, .06, .08, CHX, 1.46, CHZ - 4.15);
        const T = kit.surface({ w: 7.2, h: 8.0, ppu: 64, base: { color: "#2d3035", rough: .34, metal: .85, height: .5 } });
        for (let r = .6; r < 6; r += .16) T.ring(0, 0, r, r + .04, { height: .45, color: "#282b30" });
        T.rect(0, 0, 5.4, 2.0, { color: "#1c1e22", height: .5, rough: .45, metal: .3 }, .25);
        T.text("AURION", 0, -.2, .62, { color: "#c3c8ce", height: .56, rough: .22, metal: 1 }, { weight: 800, font: SANS, spacing: .1 });
        T.text("X7 FORGE", 0, .55, .26, { color: "#8e939a", height: .55 }, { weight: 700, font: SANS, spacing: .12 });
        decal(CS, 7.2, 8.0, T.material({ normal: 3 }), CHX, 1.91, CHZ);
        screws(CS, [[CHX - 3.8, 1.45, CHZ - 4.3], [CHX + 3.8, 1.45, CHZ + 4.3]], { r: .3, h: .18, mat: M.blackMetal });
      }

      function powerHeader(cols, rows) {
        const p = .84, t = .16, W = cols * p + t * 2, D = rows * p + t * 2, H = 2.0, a = asm();
        a.box("black", W, .75, D, 0, .375, 0);
        a.box("black", W, H - .75, t, 0, .75 + (H - .75) / 2, -D / 2 + t / 2); a.box("black", W, H - .75, t, 0, .75 + (H - .75) / 2, D / 2 - t / 2);
        a.box("black", t, H - .75, D, -W / 2 + t / 2, .75 + (H - .75) / 2, 0); a.box("black", t, H - .75, D, W / 2 - t / 2, .75 + (H - .75) / 2, 0);
        for (let i = 1; i < cols; i++) a.box("black", .13, H - .8, D - t, -W / 2 + t + i * p, .75 + (H - .8) / 2, 0);
        for (let j = 1; j < rows; j++) a.box("black", W - t, H - .8, .13, 0, .75 + (H - .8) / 2, -D / 2 + t + j * p);
        for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
          const x = -W / 2 + t + (i + .5) * p, z = -D / 2 + t + (j + .5) * p;
          a.box("tin", .2, .95, .2, x, 1.2, z);
          if ((i + j) % 2) a.box("black", .22, H - .8, .22, x - p * .32, .75 + (H - .8) / 2, z - p * .32, PI / 4);
        }
        a.box("black", .95, .8, .32, 0, 1.3, -D / 2 - .16); a.box("black", 1.1, .14, .5, 0, 1.75, -D / 2 - .2);
        [-.62, .62].forEach(dx => a.box("black", .12, 1.4, .22, dx, .7, -D / 2 - .1));
        return { baked: a.bake(), W, D };
      }
      {
        const eps = powerHeader(4, 2);
        [-19.3, -15.1].forEach((x, i) => {
          place(board, eps.baked, x, Y, -29.1);
          occupy(x, -29.1, eps.W, eps.D + .4); outline(x, -29.1, eps.W + .2, eps.D + .6);
          label("ATX12V_" + (i + 1), x, -27.75, .22);
        });
        const atx = powerHeader(12, 2);
        place(board, atx.baked, 22.3, Y, -13.8, -PI / 2);
        occupy(22.3, -13.8, atx.D + .4, atx.W); outline(22.3, -13.8, atx.D + .6, atx.W + .2);
        label("ATXPWR1", 20.6, -13.8, .26, -PI / 2);
      }

      const pitch = .508;
      function pinHeader(x, z, cols, rows, ry, name, o = {}) {
        const a = asm(), W = cols * pitch, D = rows * pitch;
        a.put(o.base || "satin", rbox(W, .5, D, .04, .03), 0, .25, 0);
        for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
          if (o.skip && o.skip(i, j)) continue;
          a.box("gold", .13, 1.25, .13, (i - (cols - 1) / 2) * pitch, .62, (j - (rows - 1) / 2) * pitch);
        }
        place(board, a.bake(), x, Y, z, ry || 0);
        const rw = ry ? D : W, rd = ry ? W : D;
        occupy(x, z, rw, rd); outline(x, z, rw + .2, rd + .2);
        if (name) label(name, x + (o.lx || 0), z + (o.lz != null ? o.lz : rd / 2 + .3), o.ls || .2, o.lr || 0);
      }
      function fanHeader(x, z, ry, name, o = {}) {
        const a = asm(), mat = o.mat || "white";
        a.box(mat, 2.03, .45, .62, 0, .225, 0);
        a.box(mat, 2.03, 1.25, .14, 0, .62, .24);
        [-.5, .5].forEach(dx => a.box(mat, .14, .8, .2, dx, .4, .1));
        for (let i = 0; i < (o.pins || 4); i++) a.box("gold", .13, 1.15, .13, (i - 1.5) * pitch, .57, -.05);
        place(board, a.bake(), x, Y, z, ry || 0);
        occupy(x, z, ry ? .7 : 2.1, ry ? 2.1 : .7); outline(x, z, ry ? .8 : 2.2, ry ? 2.2 : .8);
        if (name) label(name, x + (o.lx || 0), z + (o.lz != null ? o.lz : .75), o.ls || .2, o.lr || 0);
      }
      fanHeader(6.9, -29.6, 0, "CPU_FAN", { lz: 1.0 });
      fanHeader(9.5, -29.6, 0, "CPU_OPT", { lz: 1.0 });
      fanHeader(15.2, -29.6, 0, "ARGB_1", { lz: 1.0, mat: "satin" });
      fanHeader(17.8, -29.6, 0, "RGB_1", { lz: 1.0, mat: "satin" });
      fanHeader(23.5, -23.6, PI / 2, "SYS_FAN1", { lx: -.9, lz: 0, lr: -PI / 2 });
      fanHeader(23.5, 15.4, PI / 2, "SYS_FAN2", { lx: -.9, lz: 0, lr: -PI / 2 });
      fanHeader(23.5, 18.4, PI / 2, "PUMP_FAN", { lx: -.9, lz: 0, lr: -PI / 2 });
      fanHeader(5.3, 29.6, PI, "SYS_FAN3", { lz: -.95 });
      fanHeader(11.3, 29.6, PI, "SYS_FAN4", { lz: -.95 });
      fanHeader(-12.9, 29.6, PI, "ARGB_2", { lz: -.95, mat: "satin", pins: 4 });
      fanHeader(-10.3, 29.6, PI, "RGB_2", { lz: -.95, mat: "satin" });
      pinHeader(-20.4, 29.35, 5, 2, 0, "HD_AUDIO", { skip: (i, j) => i === 3 && j === 1, lz: -.95 });
      pinHeader(-6.2, 29.35, 5, 2, 0, "USB_910", { skip: (i, j) => i === 4 && j === 0, lz: -.95 });
      pinHeader(-2.8, 29.35, 5, 2, 0, "USB_1112", { skip: (i, j) => i === 4 && j === 0, lz: -.95 });
      pinHeader(1.1, 29.35, 7, 2, 0, "SPI_TPM", { skip: (i, j) => i === 5 && j === 0, lz: -.95 });
      pinHeader(17.6, 29.35, 5, 2, 0, "F_PANEL", { skip: (i, j) => i === 4 && j === 1, lz: -.95 });
      pinHeader(20.5, 29.6, 2, 1, 0, "T_SENSOR", { lz: -.7, ls: .16 });
      pinHeader(14.0, 29.6, 3, 1, 0, "CLR_CMOS", { lz: -.7, ls: .16 });
      label("PWR_LED", 16.8, 28.15, .12); label("PLED+  PLED-", 17.3, 28.45, .1); label("HDD+ RST", 17.9, 30.25, .1);
      {
        const a = asm(), L = 4.6, D = 1.85, H = 1.8;
        a.box("satin", L, .4, D, 0, .2, 0);
        a.box("satin", L, H, .15, 0, H / 2, -D / 2 + .075);
        a.box("satin", (L - .9) / 2, H, .15, -(L + .9) / 4, H / 2, D / 2 - .075); a.box("satin", (L - .9) / 2, H, .15, (L + .9) / 4, H / 2, D / 2 - .075);
        a.box("satin", .15, H, D, -L / 2 + .075, H / 2, 0); a.box("satin", .15, H, D, L / 2 - .075, H / 2, 0);
        for (let i = 0; i < 10; i++) for (let j = 0; j < 2; j++) if (!(i === 0 && j === 0)) a.box("gold", .1, 1.35, .1, (i - 4.5) * .4, .68, (j - .5) * .4);
        place(board, a.bake(), 22.35, Y, -.9, PI / 2);
        occupy(22.35, -.9, D, L); outline(22.35, -.9, D + .2, L + .2); label("U32G1_12", 20.9, -.9, .22, -PI / 2);
        const c = asm();
        c.box("satin", 2.5, .45, 1.2, 0, .22, 0);
        c.put("nickel", rbox(2.1, 1.3, .72, .3, .04), 0, 1.0, 0);
        c.box("hole", 1.75, .02, .4, 0, 1.655, 0);
        c.box("black", 1.3, .08, .1, 0, 1.64, 0);
        place(board, c.bake(), 22.6, Y, -5.3, PI / 2);
        occupy(22.6, -5.3, 1.2, 2.5); outline(22.6, -5.3, 1.4, 2.7); label("U32G2_C1", 21.3, -5.3, .2, -PI / 2);
      }
      {
        const a = asm(), X0 = 0, X1 = 2.5, Wz = 2.5, h = 1.3;
        a.box("black", .45, 2 * h + .3, Wz, .225, h + .15, 0);
        [0, 1, 2].forEach(k => a.box("black", X1, .15, Wz, X1 / 2, .075 + k * (h + .075), 0));
        [-1, 1].forEach(s => a.box("black", X1, 2 * h + .3, .15, X1 / 2, h + .15, s * (Wz / 2 - .075)));
        [0, 1].forEach(k => {
          const y = .15 + k * (h + .075) + h * .5;
          a.box("black", X1 - .6, .2, 1.65, X1 / 2 - .05, y, .15);
          a.box("black", X1 - .6, .6, .18, X1 / 2 - .05, y + .1, -.72);
          for (let i = 0; i < 7; i++) a.box("gold", 1.3, .02, .1, X1 / 2 + .2, y + .11, -.45 + i * .2);
        });
        void X0;
        const sb = a.bake();
        [6.3, 8.9, 11.5].forEach((z, i) => {
          place(board, sb, 22.0, Y, z);
          occupy(23.2, z, 2.6, 2.6); outline(23.2, z, 2.7, 2.7);
          label(`SATA6G_${i * 2 + 1}  ${i * 2 + 2}`, 20.9, z, .18, -PI / 2);
        });
      }
      {
        const BXc = 6.4, BZc = 22.4;
        put(board, "black", lathe([[1.9, 0], [2.3, 0], [2.3, .42], [2.12, .42], [2.12, .18], [1.9, .18], [1.9, 0]], 40), BXc, Y, BZc);
        bx(board, "black", 1.2, .5, .5, BXc, Y + .25, BZc + 2.35);
        const bat = kit.surface({ w: 4, h: 4, ppu: 64, base: { color: "#c9ccd0", rough: .26, metal: 1, height: .5 } });
        for (let r = .2; r < 2; r += .05) bat.ring(0, 0, r, r + .02, { height: .47, color: "#bcc0c4" });
        const bi = { color: "#8d9197", height: .62, rough: .4 };
        bat.text("+", 0, -1.05, .5, bi, { weight: 800, font: SANS });
        bat.text("CR2032", 0, -.2, .42, bi, { weight: 800, font: SANS });
        bat.text("3V  LITHIUM", 0, .35, .24, bi, { weight: 700, font: SANS });
        bat.text("KESTREL CELL", 0, .85, .2, bi, { weight: 700, font: SANS });
        put(board, "steel", lathe([[0, 0], [1.96, 0], [2.0, .05], [2.0, .6], [1.95, .64], [0, .64]], 48), BXc, Y + .18, BZc);
        const top = new THREE.CircleGeometry(1.94, 48); top.rotateX(-PI / 2);
        const tm = bat.material({ normal: 3 });
        const tp = mesh(board, top, tm, BXc, Y + .825, BZc); tp.userData.noCast = true;
        bx(board, "nickel", .7, .05, 2.2, BXc - 1.3, Y + .87, BZc, 0, 0, .06);
        bx(board, "nickel", .08, .7, 1.2, BXc - 2.38, Y + .4, BZc);
        occupy(BXc, BZc, 4.8, 5.2); label("BAT1", BXc, BZc - 2.75, .22); label("CR2032", BXc - 3.0, BZc, .18, -PI / 2);
      }
      {
        const b = asm();
        b.box("satin", 1.3, .35, 1.3, 0, .175, 0); b.put("white", rbox(.9, .3, .9, .2, .05), 0, .5, 0);
        const bb = b.bake();
        place(board, bb, 18.4, Y, -26.6); place(board, bb, 20.2, Y, -26.6);
        occupy(19.3, -26.6, 3.2, 1.4); label("PWR", 18.4, -25.6, .18); label("RST", 20.2, -25.6, .18);
        put(board, "black", rbox(1.9, .35, 1.4, .08, .03), 17.4, Y + .175, -22.4);
        const Q = kit.surface({ w: 1.8, h: 1.3, ppu: 120, base: { color: "#0e0e10", rough: .2, metal: 0, height: .5 } });
        const seg = (cx, ss) => { const on = { color: "#2a1b1b", height: .5 }; [[0, -.42, .5, .07], [0, 0, .5, .07], [0, .42, .5, .07], [-.28, -.21, .07, .36], [.28, -.21, .07, .36], [-.28, .21, .07, .36], [.28, .21, .07, .36]].forEach(([x, z, w, d], i) => Q.rect(cx + x, z, w, d, ss.includes(i) ? { color: "#3a2020" } : on, .03)); };
        seg(-.4, [0, 1, 2, 3, 4, 5, 6]); seg(.4, [0, 1, 2, 3, 4, 5, 6]);
        decal(board, 1.7, 1.2, Q.material({ normal: 1 }), 17.4, Y + .35, -22.4);
        label("Q-CODE", 17.4, -21.35, .18);
        const ledCols = [0xd83a3a, 0xe0b040, 0xe6e6e6, 0x3cc75e];
        ["CPU", "DRAM", "VGA", "BOOT"].forEach((s, i) => {
          bx(board, std({ color: ledCols[i], roughness: .25, emissive: ledCols[i], emissiveIntensity: .05 }), .3, .12, .18, 20.3, Y + .06, -23.6 + i * .7);
          padAt(20.3, -23.6 + i * .7, .42, .22);
          label(s + "_LED", 19.85, -23.6 + i * .7, .14, 0, "right");
          occupy(20.3, -23.6 + i * .7, .3, .2);
        });
      }

      {
        put(board, "nickel", rbox(2.6, .32, 2.6, .12, .04), -20.2, Y + .16, 17.6);
        const A = kit.surface({ w: 2.4, h: 2.4, ppu: 120, base: { color: "#c0c3c7", rough: .3, metal: 1, height: .5 } });
        const ai = { color: "#27292d", height: .5, rough: .6, metal: 0 };
        A.text("AURION", 0, -.45, .3, ai, { weight: 800, font: SANS, spacing: .04 });
        A.text("HD AUDIO", 0, .1, .22, ai, { weight: 700, font: SANS });
        A.text("7.1 · 120 dB", 0, .55, .16, ai, { weight: 600, font: SANS });
        decal(board, 2.4, 2.4, A.material({ normal: 1.5 }), -20.2, Y + .32, 17.6);
        occupy(-20.2, 17.6, 2.6, 2.6); label("CODEC", -20.2, 19.35, .18);
        chip(board, { x: -18.0, z: 14.4, w: 1.0, d: .8, h: .28, y: Y, pkg: "sop", leads: 4, lines: ["KOP", "2604"] });
        chip(board, { x: -22.4, z: 14.4, w: 1.0, d: .8, h: .28, y: Y, pkg: "sop", leads: 4, lines: ["KOP", "2604"] });
        label("AUDIO", -23.6, 25.0, .3, -PI / 2);
      }
      const goldCaps = [[-22.6, 5.2, .5], [-21.3, 5.2, .5], [-19.9, 5.2, .5], [-18.2, 6.6, .63], [-18.2, 8.3, .63], [-22.6, 9.3, .5], [-21.2, 9.3, .5], [-17.6, 20.4, .5], [-17.6, 22.0, .5], [-22.6, 20.8, .63], [-19.3, 24.4, .5], [-21.0, 24.4, .5]];
      {
        const sleeve = texture(512, 256, (g, W, H) => {
          const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, "#c89c3c"); gr.addColorStop(.5, "#e2bd66"); gr.addColorStop(1, "#b98c32");
          g.fillStyle = gr; g.fillRect(0, 0, W, H);
          g.fillStyle = "#6e5520"; g.fillRect(W * .7, 0, W * .1, H);
          g.fillStyle = "#1c150a"; g.font = `800 ${H * .13}px ${SANS}`; g.textAlign = "center";
          ["AURION", "AUDIO", "220µF", "16V"].forEach((s, k) => g.fillText(s, W * (.12 + k * .16), H * (.45 + (k % 2) * .18)));
          g.fillStyle = "rgba(0,0,0,.25)"; g.fillRect(0, H * .05, W, H * .03); g.fillRect(0, H * .92, W, H * .03);
        });
        const sm = std({ map: sleeve, roughness: .32, metalness: .35 });
        const body = lathe([[.97, 0], [1, .03], [1, .88], [.95, .91], [.97, .94], [.94, 1]], 28);
        const topM = std({ color: 0xbfc3c8, metalness: 1, roughness: .3 });
        const lid = new THREE.CircleGeometry(.94, 28); lid.rotateX(-PI / 2);
        const list = [], lids = [];
        goldCaps.forEach(([x, z, r]) => {
          const h = r > .55 ? 2.2 : 1.8;
          list.push([x, Y, z, (x * 7 + z) % 6, 0, 0, r, h, r]);
          lids.push([x, Y + h - .003, z, 0, 0, 0, r, 1, r]);
          occupy(x, z, r * 2, r * 2); silk.rings.push([x, z, r + .1]);
        });
        inst(board, body, sm, list);
        inst(board, lid, topM, lids);
      }

      chip(board, { x: -18.2, z: -5.2, w: 1.8, d: 1.8, h: .18, y: Y, pkg: "qfn", logo: "KESTREL", lines: ["KLN2525B", "2.5G LAN", "2534 TW"] });
      chip(board, { x: 14.3, z: 21.2, w: 2.8, d: 2.8, h: .3, y: Y, pkg: "qfp", leads: 26, logo: "KSI", lines: ["6720D-A", "2531 G2B"] });
      chip(board, { x: 2.2, z: 25.4, w: 1.0, d: 1.25, h: .3, y: Y, pkg: "sop", leads: 4, lines: ["KF25L", "256"], ry: PI / 2 });
      chip(board, { x: 3.9, z: -3.6, w: .9, d: .9, h: .16, y: Y, pkg: "qfn", lines: ["KCK", "540"] });
      chip(board, { x: 16.8, z: 17.3, w: 1.2, d: 1.2, h: .16, y: Y, pkg: "qfn", lines: ["KLED", "32"] });
      chip(board, { x: 19.6, z: 2.9, w: 1.3, d: 1.3, h: .16, y: Y, pkg: "qfn", lines: ["KUS", "3142"] });
      chip(board, { x: -17.9, z: -1.6, w: 1.0, d: 1.0, h: .16, y: Y, pkg: "qfn", lines: ["KR9", "021"] });
      chip(board, { x: -18.0, z: -12.8 + 10.4, w: .6, d: .5, h: .12, y: Y, pkg: "sot", lines: ["D5"] });
      [[19.6, 6.4], [19.6, 9.0], [19.6, 11.6]].forEach(([x, z]) => chip(board, { x, z, w: .6, d: .5, h: .12, y: Y, pkg: "sot", lines: ["E3"] }));
      [[-12.5, -29.6], [-10.6, -29.6]].forEach(([x, z]) => chip(board, { x, z, w: 1.0, d: 1.2, h: .2, y: Y, pkg: "stage", lines: ["KMN", "030"] }));
      label("BIOS", 2.2, 24.2, .2); label("U8", 2.2, 26.6, .16); label("SIO1", 14.3, 23.1, .2); label("LAN1", -18.2, -3.9, .2);
      kit.sticker(board, { x: 2.2, y: Y + .31, z: 25.4, w: .95, d: .8, ry: PI / 2, draw: S => { S.text("X7F", 0, -.18, .16, { color: "#222" }, { weight: 800 }); S.text("1.02", 0, .15, .14, { color: "#222" }, { weight: 700 }); } });
      {
        put(board, "blackMetal", rbox(7.6, .16, 7.6, .4, .04), SX, -.16 - .08, SZ);
      }

      occupy(SX, SZ, 11.0, 13.6);
      occupy(-6.9, -26.2, 18.8, 4.0); occupy(-18.15, -16.9, 3.9, 21.2);
      chokesTop.concat(chokesLeft).forEach(([x, , z]) => occupy(x, z, 2.0, 2.0));
      caps.forEach(([x, , z]) => occupy(x, z, 1.1, 1.1));
      DIMM_X.forEach(x => occupy(x, DZC - .5, 1.3, DL + 1.2));
      SLOTS.forEach(s => occupy(PX0 + s.len / 2 + .5, s.z, s.len + 1.2, 1.7));
      M2Z.forEach(z => occupy(M2C, z, M2L, 5.0));
      occupy(CHX, CHZ, 9.0, 9.8);
      occupy(-22.5, -13.2, 4.6, 31.8);
      [[-23.1, -28.6], [4.0, -28.6], [23.1, -28.6], [-23.1, 4.3], [8.0, 3.0], [23.1, 3.4], [-23.1, 28.6], [8.0, 28.6], [23.1, 28.6]].forEach(([x, z]) => occupy(x, z, 2.0, 2.0));
      [[-12.8, -21.8], [2.8, -21.8], [-12.8, -6.2], [2.8, -6.2]].forEach(([x, z]) => occupy(x, z, 1.4, 1.4));
      rowOf("c06", 12, -10.2, -5.35, .5, 0, PI / 2, 3); rowOf("c04", 14, -10.1, -4.7, .45, 0, PI / 2);
      rowOf("c06", 8, -11.3, -19.6, 0, .75, 0, 3); rowOf("c04", 10, -10.8, -19.8, 0, .6, PI / 2);
      rowOf("c06", 16, 1.3, -25.8, 0, .5, 0, 4); rowOf("c04", 22, 1.9, -24.5, 0, .45, PI / 2);
      rowOf("r04", 18, 4.3, -25.0, 0, .45, PI / 2, 6); rowOf("c04", 18, 4.8, -25.2, 0, .45, 0);
      rowOf("c04", 44, 5.5, 1.55, .18, 0, PI / 2); rowOf("c04", 26, 9.2, 1.85, .18, 0, PI / 2);
      rowOf("r04", 13, 9.4, 2.4, .36, 0, PI / 2, 4);
      rowOf("c08", 6, -12.6, -24.7, .5, 0, PI / 2); rowOf("c08", 6, -16.1, -25.9, 0, .5, 0);
      rowOf("c06", 10, 15.6, 5.8, 0, .6, 0, 3); rowOf("r06", 10, 16.4, 5.8, 0, .6, PI / 2, 3);
      rowOf("c04", 16, 18.6, 5.3, 0, .45, PI / 2); rowOf("r04", 12, 17.9, 13.0, .38, 0, PI / 2, 4);
      rowOf("c06", 8, 3.3, 5.3, 0, .55, 0, 2); rowOf("c06", 8, 3.3, 17.6, 0, .55, 0, 2); rowOf("c04", 10, 4.4, 17.8, 0, .45, PI / 2);
      rowOf("c06", 10, -14.8, 23.8, .5, 0, PI / 2, 3); rowOf("r04", 12, -14.6, 26.5, .45, 0, 0, 4);
      rowOf("c06", 6, -16.9, 11.0, 0, .55, 0, 3); rowOf("r06", 6, -23.5, 11.0, 0, .55, 0, 2);
      rowOf("c04", 12, 16.2, -7.6, 0, .5, PI / 2, 4); rowOf("r04", 12, 16.9, -7.6, 0, .5, 0);
      for (const c of chips) if (c.t === board && c.pkg !== "none") around(c.x, c.z, c.ry ? c.d : c.w, c.ry ? c.w : c.d, Math.round(6 + (c.w + c.d) * 4), Math.round(c.x * 31 + c.z * 7 + 500));
      around(-20.2, 17.6, 2.6, 2.6, 22, 91, ["c06", "r06", "c04"]);
      around(CHX, CHZ, 9.0, 9.8, 40, 92);
      around(22.3, -13.8, 2.1, 10.6, 16, 93, ["c06", "r04"]);
      scatter(14.0, -27.0, 21.2, -19.0, 30, { c04: 4, r04: 3, c06: 2 }, 3);
      scatter(13.8, -18.5, 20.6, -2.0, 40, { c04: 4, r04: 3, c06: 2, r06: 1 }, 4);
      scatter(14.8, 14.8, 22.6, 27.8, 30, { c04: 3, r04: 3, c06: 2, r06: 1 }, 5);
      scatter(-14.8, 23.2, 3.0, 28.0, 45, { c04: 3, r04: 3, c06: 2, r06: 1 }, 6);
      scatter(-24.0, 3.4, -16.2, 28.0, 36, { c06: 3, r06: 2, c04: 1 }, 7);
      scatter(-20.4, -6.4, -16.2, 2.6, 20, { c04: 3, r04: 3, c06: 1 }, 8);
      scatter(2.6, -20.5, 5.4, -1.0, 30, { c04: 4, r04: 2 }, 9);
      scatter(15.0, -.2, 20.8, 4.8, 20, { c04: 3, r04: 3, c06: 1 }, 10);
      scatter(2.8, 4.8, 5.4, 22.0, 24, { c04: 3, r04: 2, c06: 1 }, 11);
      scatter(-24.0, -29.8, -14.0, -27.8, 12, { c06: 2, r06: 1 }, 12);
      scatter(-12.0, -21.5, 1.4, -20.8, 14, { c04: 3, r04: 1 }, 13);
      [[-16.6, -5.9, 0], [-18.3, 19.8, PI / 2], [3.9, -2.2, 0], [12.4, 22.8, PI / 2]].forEach(([x, z, ry]) => { if (isFree(x, z, .4)) { crystals.push([x, Y, z, ry]); occupy(x, z, 1.0, 1.0); label("Y" + (crystals.length), x, z + .6, .12); } });
      [[5.3, 28.3], [11.3, 28.3], [22.2, 15.4], [22.2, 18.4], [8.2, -28.3], [-12.9, 28.3]].forEach(([x, z], i) => { if (isFree(x, z, .45)) chip(board, { x, z, w: .6, d: .5, h: .12, y: Y, pkg: "sot", lines: ["Q" + (i + 30)] }); });

      const HOLES = [[-23.1, -28.6], [4.0, -28.6], [23.1, -28.6], [-23.1, 4.3], [8.0, 3.0], [23.1, 3.4], [-23.1, 28.6], [8.0, 28.6], [23.1, 28.6]];
      const COOLER = [[-12.8, -21.8], [2.8, -21.8], [-12.8, -6.2], [2.8, -6.2]];
      const top = kit.pcb({
        w: BW, d: BD, ppu: 2048 / BD, mask: "black", gloss: .58, finish: "tin", seed: 17, traces: 60, vias: 1000, silk: "#d9dcde", traceW: .055,
        keep: [[-20.1, 13.4, 8.6, 34.2], [3.2, -13.5, 4.8, 26]],
        draw(P) {
          const tp = P.traceP, tw = .05;
          for (let i = 0; i < 64; i++) {
            const z = -25.6 + i * .38, pts = [[.4, z], [1.3, z]];
            if (i % 3 !== 1) {
              let x = 1.4; const amp = .12, n = 4 + (i * 7) % 9;
              for (let k = 0; k < n; k++) { pts.push([x, z], [x, z - amp], [x + .1, z - amp], [x + .1, z]); x += .2; }
              pts.push([x, z]);
            }
            pts.push([13.4, z]);
            P.line(pts, tw, tp);
            if (i % 5 === 0) P.via(5.0 + (i % 3) * .2, z, .07);
          }
          for (let j = 0; j < 16; j++) for (const o of [-.06, .06]) {
            const x = SX - 4.4 + j * .55 + o;
            P.line([[x, -7.0], [x, -3.6], [x - 3.4 + j * .08, -.2 + j * .02], [x - 3.4 + j * .08, 2.4]], .045, tp);
          }
          for (let j = 0; j < 8; j++) for (const o of [-.06, .06]) {
            P.line([[5.7, 6.2 + j * .3 + o], [4.4, 6.2 + j * .3 + o], [3.2, 7.5 + (j - 3.5) * .3 + o]], .045, tp);
            P.line([[5.8, 14.0 + j * .15 + o], [4.9 - j * .12, 14.0 + j * .15 + o], [4.9 - j * .12, 18.2 + j * .2 + o], [2.8, 19.8 + (j - 3.5) * .3 + o]], .045, tp);
          }
          for (let j = 0; j < 6; j++) for (const o of [-.06, .06]) {
            const z = 5.9 + j * 1.3 + o;
            P.line([[14.8, z], [18.8, z], [19.4, z + .4], [21.9, z + .4]], .05, tp);
          }
          P.poly([[-16.8, -28.2], [2.8, -28.2], [2.8, -22.9], [-11.0, -22.9], [-11.0, -7.0], [-16.8, -7.0]], { color: "#15181c", height: .535, alpha: .8 });
          P.line([[-24.4, -3.7], [-15.8, -3.7], [-15.8, 30.5]], .12, { color: "#0a0b0d", height: .42 });
          P.line([[-24.2, -3.45], [-16.05, -3.45], [-16.05, 30.3]], .03, { color: "#6b6f75", height: .53, alpha: .7 });
          for (let k = 0; k < 8; k++) { const r = kit.rng(40 + k); const z0 = 4 + k * 3; P.line([[-23.6, z0], [-20 + r() * 2, z0 + 1], [-17.5, z0 + .6 + r()]], .07, tp); }
          for (const k in SMD) {
            const s = SMD[k], e = s.l * .3;
            for (const [x, , z, ry] of s.list) [-1, 1].forEach(sd => {
              const ox = ry ? 0 : sd * (s.l / 2 - e / 2), oz = ry ? sd * (s.l / 2 - e / 2) : 0;
              P.rect(x + ox, z + oz, ry ? s.w * 1.35 : e * 1.5, ry ? e * 1.5 : s.w * 1.35, P.padP);
            });
          }
          for (const [x, z, w, d] of silk.pads) P.rect(x, z, w, d, P.padP);
          for (const c of chips) if (c.t === board) {
            const a = c.ry ? c.d : c.w, b = c.ry ? c.w : c.d;
            if (c.pkg === "qfp") P.rect(c.x, c.z, a + .5, b + .5, P.padP);
            else if (c.pkg === "sop") P.rect(c.x, c.z, c.ry ? a * .9 : a + .45, c.ry ? b + .45 : b * .9, P.padP);
            else if (c.pkg !== "none") P.rect(c.x, c.z, a + .14, b + .14, P.padP);
            outline(c.x, c.z, a + (c.pkg === "qfp" ? .8 : .45), b + (c.pkg === "qfp" ? .8 : .45));
          }
          for (const [x, z, w, d] of silk.box) P.strokeRect(x, z, w, d, .035, P.silkP);
          for (const [x, z, r] of silk.rings) P.ring(x, z, r, r + .04, P.silkP);
          for (const [s, x, z, size, rot, align, weight] of silk.text) P.text(s, x, z, size, P.silkP, { rot, align, weight, font: SANS });
          for (const [x, z] of HOLES) P.hole(x, z, .42, .5);
          for (const [x, z] of COOLER) P.hole(x, z, .38, .26);
          [[-22.0, -30.0], [23.6, 27.0], [-23.9, 26.5]].forEach(([x, z]) => P.fiducial(x, z, .09));
          const big = { color: "#d9dcde", height: .54, rough: .7 };
          P.text("AURION", 16.0, 24.6, .75, big, { weight: 800, font: SANS, spacing: .12 });
          P.text("X7 FORGE WIFI", 16.0, 25.8, .42, big, { weight: 700, font: SANS, spacing: .1 });
          P.text("TI-B1  REV 1.02  ·  8 LAYERS  ·  2 oz COPPER", 16.0, 26.7, .2, big, { weight: 600, font: SANS });
          P.text("DESIGNED BY THE INTERNALS", 16.0, 27.2, .16, big, { weight: 600, font: SANS });
          P.poly([[-3.6, 27.2], [-3.0, 26.2], [-2.4, 27.2]], big); P.poly([[-3.4, 27.05], [-3.0, 26.4], [-2.6, 27.05]], { color: P.mask });
          P.text("94V-0  E48213  2531", -.6, 26.9, .16, big, { weight: 600, font: SANS, align: "left" });
          P.text("DDR5", 9.5, 2.9 + .1, .2, big, { weight: 700, font: SANS });
          P.text("CPU", SX, -21.6 + .3, .22, big, { weight: 700, font: SANS });
          [[-6.9, -28.35, "PHASE 1–7"], [-18.2, -27.9, "PH"]].forEach(([x, z, s]) => P.text(s, x, z, .16, big, { weight: 600, font: SANS }));
          const r = kit.rng(77);
          for (let i = 0; i < 40; i++) {
            const x = (r() - .5) * BW * .9, z = (r() - .5) * BD * .9;
            if (!isFree(x, z, .2)) continue;
            P.circle(x, z, .07, P.padP); if (r() < .5) P.text("TP" + (i + 10), x, z + .2, .1, P.silkP, { weight: 600, font: SANS });
          }
        }
      });
      const topMat = top.material({ fit: true, normal: 3.2 });
      const bot = kit.pcb({
        w: BW, d: BD, ppu: 640 / BD, mask: "black", gloss: .55, finish: "tin", seed: 23, traces: 40, vias: 300, underside: true, traceW: .09,
        draw(P) {
          DIMM_X.forEach(x => { for (let z = DZ0 + .6; z < DZ1 - .6; z += .34) { P.circle(x - .2, z, .07, P.padP); P.circle(x + .2, z + .17, .07, P.padP); } });
          SLOTS.forEach(s => { for (let x = PX0 + .3; x < PX0 + s.len; x += .4) { P.circle(x, s.z - .2, .07, P.padP); P.circle(x, s.z + .2, .07, P.padP); } });
          P.text("AURION X7 FORGE WIFI", 0, 18, 1.1, P.silkP, { weight: 800, font: SANS });
        }
      });
      const botMat = bot.material({ fit: true, normal: 2 });
      const edgeTex = texture(8, 64, (g, W, H) => {
        g.fillStyle = "#23221c"; g.fillRect(0, 0, W, H);
        for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? "#3a3627" : "#2c2a21"; g.fillRect(0, i * 8 + 3, W, 2); }
      });
      edgeTex.wrapS = edgeTex.wrapT = THREE.RepeatWrapping; edgeTex.repeat.set(1, 3.1);
      const edgeMat = std({ map: edgeTex, roughness: .75 });
      kit.board(board, { w: BW, d: BD, r: .12, t: .32, top: topMat, bottom: botMat, edgeMat, holes: HOLES.map(([x, z]) => [x, z, .42]).concat(COOLER.map(([x, z]) => [x, z, .38])) });
      const ringGeo = new THREE.RingGeometry(.44, .92, 32); ringGeo.rotateX(-PI / 2);
      inst(board, ringGeo, "tin", HOLES.map(([x, z]) => [x, Y + .003, z])).userData.noCast = true;

      if (crystals.length) kit.crystal(board, crystals, { l: .9, w: .4, h: .3 });
      for (const k in SMD) {
        const s = SMD[k]; if (!s.list.length) continue;
        if (s.res) kit.resistor(board, s.list, { l: s.l, w: s.w, h: s.h });
        else kit.mlcc(board, s.list, { l: s.l, w: s.w, h: s.h, color: k === "c04" ? "#a88760" : k === "c08" ? "#8f7458" : undefined });
      }
      (function buildChips() {
        const PPU = 128, AW = 2048, cells = chips.map(c => ({ c, w: Math.ceil(c.w * PPU) + 6, h: Math.ceil(c.d * PPU) + 6 }));
        let x = 0, y = 0, row = 0;
        [...cells].sort((a, b) => b.h - a.h).forEach(k => { if (x + k.w > AW) { x = 0; y += row; row = 0; } k.x = x; k.y = y; x += k.w; row = Math.max(row, k.h); });
        let AH = 64; while (AH < y + row) AH *= 2;
        const atlas = texture(AW, AH, (g) => {
          const r = kit.rng(99);
          for (const k of cells) {
            const c = k.c, x0 = k.x + 3, y0 = k.y + 3, w = k.w - 6, h = k.h - 6;
            g.fillStyle = c.color || "#1b1c1f"; g.fillRect(k.x, k.y, k.w, k.h);
            for (let i = 0; i < w * h / 150; i++) { g.fillStyle = r() < .5 ? "rgba(0,0,0,.12)" : "rgba(255,255,255,.035)"; g.fillRect(x0 + r() * w, y0 + r() * h, 1.5, 1.5); }
            const rows = (c.logo ? [[c.logo, 1.25, 800]] : []).concat((c.lines || []).map(l => [l, 1, 600]));
            let size = Math.min(h * .72 / Math.max(2.2, rows.reduce((a, q) => a + q[1] * 1.45, 0)), 64);
            g.fillStyle = c.ink || "#8b8e93"; g.textAlign = "center"; g.textBaseline = "middle";
            let yy = y0 + h / 2 - rows.reduce((a, q) => a + q[1] * size * 1.45, 0) / 2;
            rows.forEach(([s, kk, wg]) => {
              let fs = size * kk; g.font = `${wg} ${fs}px ${wg > 700 ? SANS : MONO}`;
              const mw = g.measureText(s).width; if (mw > w * .86) { fs *= w * .86 / mw; g.font = `${wg} ${fs}px ${wg > 700 ? SANS : MONO}`; }
              yy += size * kk * .725; g.fillText(s, x0 + w / 2, yy); yy += size * kk * .725;
            });
            if (c.pkg !== "none") { g.fillStyle = "rgba(0,0,0,.55)"; g.beginPath(); g.arc(x0 + Math.min(w, h) * .13, y0 + h - Math.min(w, h) * .13, Math.min(w, h) * .05, 0, 7); g.fill(); }
          }
        });
        const topMat = std({ map: atlas, roughness: .58, metalness: 0 });
        const leadGeo = new Map();
        const gull = (lw, h) => {
          const key = lw + "," + h;
          if (!leadGeo.has(key)) {
            const t = .025, yE = h * .42, reach = .14, pts = [[0, yE], [reach * .3, yE], [reach * .55, t / 2], [reach, t / 2]];
            const sh = new THREE.Shape();
            pts.forEach(([a, b], i) => i ? sh.lineTo(a, b + t / 2) : sh.moveTo(a, b + t / 2));
            [...pts].reverse().forEach(([a, b]) => sh.lineTo(a, b - t / 2));
            const g = new THREE.ExtrudeGeometry(sh, { depth: lw, bevelEnabled: false }); g.translate(0, 0, -lw / 2);
            leadGeo.set(key, g);
          }
          return leadGeo.get(key);
        };
        const rot = (ox, oz, ry) => [ox * Math.cos(ry) + oz * Math.sin(ry), -ox * Math.sin(ry) + oz * Math.cos(ry)];
        for (const k of cells) {
          const c = k.c, w = c.w, d = c.d, h = c.h;
          if (c.pkg !== "none") put(c.t, c.body || "epoxy", rbox(w, h, d, Math.min(w, d) * .04, Math.min(h * .25, .03)), c.x, c.y + h / 2, c.z, c.ry);
          const pl = new THREE.PlaneGeometry(w * .97, d * .97), uv = pl.attributes.uv;
          for (let i = 0; i < uv.count; i++) uv.setXY(i, (k.x + 3 + uv.getX(i) * (k.w - 6)) / AW, 1 - (k.y + 3 + (1 - uv.getY(i)) * (k.h - 6)) / AH);
          pl.rotateX(-PI / 2);
          put(c.t, topMat, pl, c.x, c.y + h + .003, c.z, c.ry);
          const leads = [];
          if (c.pkg === "sop" || c.pkg === "qfp" || c.pkg === "sot") {
            const sides = c.pkg === "qfp" ? [[1, 0], [-1, 0], [0, 1], [0, -1]] : [[0, 1], [0, -1]];
            for (const [sx, sz] of sides) {
              const along = sx ? d : w, n = c.pkg === "sot" ? (sz > 0 ? 2 : 1) : c.leads || 4, p = along * .8 / n;
              for (let i = 0; i < n; i++) {
                const a = (i - (n - 1) / 2) * p, lx = sx ? sx * w / 2 : a, lz = sx ? a : sz * d / 2;
                const [ox, oz] = rot(lx, lz, c.ry);
                leads.push([gull(Math.min(p * .5, .09), h), c.x + ox, c.y, c.z + oz, c.ry + (sx ? (sx > 0 ? 0 : PI) : (sz > 0 ? -PI / 2 : PI / 2))]);
              }
            }
          } else if (c.pkg === "qfn" || c.pkg === "stage") {
            const sides = c.pkg === "stage" ? [[1, 0], [-1, 0]] : [[1, 0], [-1, 0], [0, 1], [0, -1]];
            for (const [sx, sz] of sides) {
              const along = sx ? d : w, n = Math.max(3, Math.round(along / .13)), p = along * .8 / n;
              for (let i = 0; i < n; i++) {
                const a = (i - (n - 1) / 2) * p, lx = sx ? sx * (w / 2 + .012) : a, lz = sx ? a : sz * (d / 2 + .012);
                const [ox, oz] = rot(lx, lz, c.ry);
                leads.push([box(sx ? .03 : p * .5, .05, sx ? p * .5 : .03), c.x + ox, c.y + .025, c.z + oz, c.ry]);
              }
            }
          }
          leads.forEach(([g, lx, ly, lz, lr]) => put(c.t, "tin", g, lx, ly, lz, lr));
        }
      })();

      for (const b of buckets.values()) {
        const m = add(b.g, merge(b.items), b.m);
        if (b.sub) b.sub.add(m);
      }

      return {
        layout: {
          socket: { y: TOP, dy: 1.5 },
          vrm: { y: TOP },
          dimm: { y: TOP, dy: 4 },
          pcie: { y: TOP, dy: 4 },
          m2: { y: TOP },
          chipset: { y: TOP },
          io: { y: TOP, dy: 2, dx: -7 },
          board: { y: 0 }
        },
        anchors: {
          socket: [SX, 1.0, SZ], vrm: [0, 5.4, -26.2], dimm: [9.5, 1.5, -13], pcie: [0, 2.3, 3.1],
          m2: [-9, 1.3, 19.8], chipset: [CHX, 2.0, CHZ], io: [-22.4, 7.4, -18], board: [16, .3, 25.5]
        },
        tick(dt, e) {
          hinge.rotation.x = -e * 1.95;
          leverPivot.rotation.x = e * 1.2;
          sinks.position.y = 11 * e;
          cover.position.y = 8 * e;
          csink.position.y = 8 * e;
          shroud.position.y = 5 * e;
        }
      };
    }
  });
})();
