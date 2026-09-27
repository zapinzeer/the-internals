(function () {
  const root = document.getElementById("psu3d");
  if (!root) return;
  const parts = [
    { id: "fan", color: "#5ac8e2" },
    { id: "transformer", color: "#d8b25a" },
    { id: "caps", color: "#a594f5" },
    { id: "heatsinks", color: "#8593a5" },
    { id: "modular", color: "#e38b4f" },
    { id: "pcb", color: "#72d49c" },
    { id: "case", color: "#f07a7a" }
  ];

  Internals.viewer3d(root, {
    prefix: "psu.part", parts, initial: "transformer", explode: 0.7, yaw: -0.6,
    dist: [128, 148, 196], lookY: 13, elev: 0.42,
    build(ctx) {
      const { THREE, part, add, std, roundBox, kit } = ctx;
      const W = 37.5, H = 21.5, D = 40, PCB_Y = 1.9, T_ = .25;
      const PI = Math.PI, V3 = (x, y, z) => new THREE.Vector3(x, y, z), V2 = (x, y) => new THREE.Vector2(x, y);

      const _o = new THREE.Object3D();
      function T(x, y, z, ry, rx, rz, sx, sy, sz) {
        _o.position.set(x || 0, y || 0, z || 0);
        _o.rotation.set(rx || 0, ry || 0, rz || 0, "YXZ");
        const s = sx != null ? sx : 1;
        _o.scale.set(s, sy != null ? sy : s, sz != null ? sz : s);
        _o.updateMatrix();
        return _o.matrix.clone();
      }
      const TB = (ex, ey, ez, p) => new THREE.Matrix4().makeBasis(ex, ey, ez).setPosition(p);

      function mergeGeos(items, colors) {
        let nv = 0, ni = 0;
        for (const it of items) {
          if (!it.geo.attributes.normal) it.geo.computeVertexNormals();
          const n = it.geo.attributes.position.count;
          nv += n; ni += it.geo.index ? it.geo.index.count : n;
        }
        const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), uv = new Float32Array(nv * 2);
        const col = colors ? new Float32Array(nv * 3) : null;
        const idx = nv > 65535 ? new Uint32Array(ni) : new Uint16Array(ni);
        const v = new THREE.Vector3(), nm = new THREE.Matrix3(), c = new THREE.Color();
        let vo = 0, io = 0;
        for (const it of items) {
          const g = it.geo, P = g.attributes.position, N = g.attributes.normal, U = g.attributes.uv;
          nm.getNormalMatrix(it.m);
          if (col) c.set(it.color != null ? it.color : 0xffffff).convertSRGBToLinear();
          for (let i = 0; i < P.count; i++) {
            const k = (vo + i) * 3;
            v.fromBufferAttribute(P, i).applyMatrix4(it.m); pos[k] = v.x; pos[k + 1] = v.y; pos[k + 2] = v.z;
            v.fromBufferAttribute(N, i).applyMatrix3(nm).normalize(); nor[k] = v.x; nor[k + 1] = v.y; nor[k + 2] = v.z;
            if (U) { uv[(vo + i) * 2] = U.getX(i); uv[(vo + i) * 2 + 1] = U.getY(i); }
            if (col) { col[k] = c.r; col[k + 1] = c.g; col[k + 2] = c.b; }
          }
          if (g.index) for (let i = 0; i < g.index.count; i++) idx[io++] = g.index.getX(i) + vo;
          else for (let i = 0; i < P.count; i++) idx[io++] = vo + i;
          vo += P.count;
        }
        const out = new THREE.BufferGeometry();
        out.setAttribute("position", new THREE.BufferAttribute(pos, 3));
        out.setAttribute("normal", new THREE.BufferAttribute(nor, 3));
        out.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
        if (col) out.setAttribute("color", new THREE.BufferAttribute(col, 3));
        out.setIndex(new THREE.BufferAttribute(idx, 1));
        return out;
      }
      function worldUV(geo, s) {
        const P = geo.attributes.position, N = geo.attributes.normal, U = geo.attributes.uv;
        for (let i = 0; i < P.count; i++) {
          const ax = Math.abs(N.getX(i)), ay = Math.abs(N.getY(i)), az = Math.abs(N.getZ(i));
          const x = P.getX(i) * s, y = P.getY(i) * s, z = P.getZ(i) * s;
          if (ax >= ay && ax >= az) U.setXY(i, z, y); else if (ay >= az) U.setXY(i, x, z); else U.setXY(i, x, y);
        }
        U.needsUpdate = true;
      }
      function bucket(group) {
        const lists = new Map();
        const B = {
          add(mat, geo, m, color) { let l = lists.get(mat); if (!l) lists.set(mat, l = []); l.push({ geo, m: m || T(), color }); return B; },
          flush() {
            for (const [mat, items] of lists) {
              const geo = mergeGeos(items, mat.vertexColors);
              if (mat.userData.tile) worldUV(geo, mat.userData.tile);
              const mesh = add(group, geo, mat);
              if (mat.userData.decal) mesh.userData.noCast = true;
            }
            lists.clear();
          }
        };
        return B;
      }
      function vgroup(parent, facing, x, y, z) {
        const g = new THREE.Group(); g.userData.id = parent.userData.id;
        const ey = facing.clone().normalize(), ez = V3(0, -1, 0), ex = new THREE.Vector3().crossVectors(ey, ez);
        g.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(ex, ey, ez));
        g.position.set(x, y, z); parent.add(g);
        return g;
      }
      function ink(w, h, ppu, draw, o = {}) {
        const S = kit.surface({ w, h, ppu, base: {} });
        S.g.color.clearRect(0, 0, S.W, S.H);
        draw(S);
        const m = std({ map: kit.tex(S.canvases.color, true), transparent: true, depthWrite: false, roughness: o.rough != null ? o.rough : .6, metalness: o.metal || 0,
          polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -4 });
        m.userData.decal = true;
        return m;
      }
      const plane = (w, h) => new THREE.PlaneGeometry(w, h);
      const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
      const cyl = (r, h, n, r2) => new THREE.CylinderGeometry(r2 != null ? r2 : r, r, h, n || 16);
      const rectPath = (x, y, w, h, P) => { const p = P || new THREE.Path(); p.moveTo(x - w / 2, y - h / 2); p.lineTo(x + w / 2, y - h / 2); p.lineTo(x + w / 2, y + h / 2); p.lineTo(x - w / 2, y + h / 2); p.closePath(); return p; };
      const polyPath = (pts, P) => { const p = P || new THREE.Path(); pts.forEach(([x, y], i) => i ? p.lineTo(x, y) : p.moveTo(x, y)); p.closePath(); return p; };
      const extrudeZ = (shape, depth, bevel, seg) => new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: !!bevel, bevelThickness: bevel || 0, bevelSize: bevel || 0, bevelSegments: 2, curveSegments: seg || 12 });
      const tube = (pts, r, n, closed) => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(p => V3(...p)), !!closed, "catmullrom", .1), n || Math.max(12, pts.length * 10), r, 8, !!closed);
      const rng = kit.rng(850);

      const tiled = (m, s) => { m.userData.tile = s; return m; };
      const peel = (() => {
        const N = 256, c = kit.canvas(N, N), g = c.getContext("2d"), img = g.createImageData(N, N), r = kit.rng(99);
        const oct = [[16, .65], [32, .35]].map(([n, a]) => ({ n, a, v: Float32Array.from({ length: n * n }, () => r()) }));
        for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
          let h = 0;
          for (const o of oct) {
            const fx = x / N * o.n, fy = y / N * o.n, x0 = Math.floor(fx), y0 = Math.floor(fy), x1 = (x0 + 1) % o.n, y1 = (y0 + 1) % o.n;
            const tx = fx - x0, ty = fy - y0, sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
            const a = o.v[y0 * o.n + x0], b = o.v[y0 * o.n + x1], cc = o.v[y1 * o.n + x0], d = o.v[y1 * o.n + x1];
            h += o.a * (a + (b - a) * sx + (cc - a) * sy + (a - b - cc + d) * sx * sy);
          }
          const k = (y * N + x) * 4; img.data[k] = img.data[k + 1] = img.data[k + 2] = h * 255; img.data[k + 3] = 255;
        }
        g.putImageData(img, 0, 0);
        return kit.tex(kit.normalFromHeight(c, 2.2, true), false, [1, 1]);
      })();
      const powder = tiled(std({ color: 0x222327, roughness: .5, metalness: .2, normalMap: peel, normalScale: V2(.6, .6) }), 1 / 4.5);
      const nylon = std({ color: 0x141517, roughness: .6, metalness: 0 });
      const pbt = std({ color: 0x111214, roughness: .42, metalness: 0 });
      const pbt2 = std({ color: 0x131416, roughness: .38, metalness: 0, side: THREE.DoubleSide });
      const wire = std({ color: 0x191a1c, roughness: .3, metalness: .7 });
      const tin = kit.mat.tin(), nickel = kit.mat.nickel(), steel = kit.mat.steel(), ferrite = kit.mat.ferrite();
      const zinc = std({ color: 0x9ea3a8, roughness: .3, metalness: 1 });
      const blackScrew = std({ color: 0x202124, roughness: .3, metalness: .85 });
      const dark = std({ color: 0x08090a, roughness: .9, metalness: 0 });
      const paint = std({ vertexColors: true, roughness: .45, metalness: 0 });

      const kase = part("case"), CB = bucket(kase);
      const INL = [-12.4, 6.0], SW = [-5.3, 6.0];
      const MOUNT = [[-16.9, 1.9], [16.9, 1.9], [-16.9, 19.3], [16.9, 19.3]];
      {
        const s = new THREE.Shape(), X = W / 2, r = .45, top = 20;
        s.moveTo(-X, top); s.lineTo(-X, r); s.absarc(-X + r, r, r, PI, PI * 1.5, false);
        s.lineTo(X - r, 0); s.absarc(X - r, r, r, -PI / 2, 0, false); s.lineTo(X, top);
        s.lineTo(X - T_, top); s.lineTo(X - T_, r); s.absarc(X - r, r, r - T_, 0, -PI / 2, true);
        s.lineTo(-X + r, T_); s.absarc(-X + r, r, r - T_, -PI / 2, -PI, true); s.lineTo(-X + T_, top); s.closePath();
        CB.add(powder, extrudeZ(s, D, 0, 6), T(0, 0, -D / 2));
      }
      {
        const X = W / 2 - T_, s = new THREE.Shape();
        polyPath([[-X, T_], [X, T_], [X, 21.25], [-X, 21.25]], s);
        s.holes.push(rectPath(INL[0], INL[1], 7.0, 4.6), rectPath(SW[0], SW[1], 2.9, 4.3));
        MOUNT.forEach(([x, y]) => s.holes.push(kit.circlePath(x, y, .42)));
        const R = .72, px = 1.55, py = px * Math.sqrt(3) / 2;
        for (let j = 0; ; j++) {
          const y = 1.55 + j * py; if (y > 20.2) break;
          for (let i = 0; ; i++) {
            const x = -17.15 + i * px + (j % 2) * px / 2; if (x > 17.3) break;
            if (x < -.9 && y < 10.8) continue;
            if (MOUNT.some(([mx, my]) => Math.hypot(x - mx, y - my) < 1.7)) continue;
            s.holes.push(polyPath([...Array(6)].map((_, k) => [x + R * Math.cos(PI / 2 + k * PI / 3), y + R * Math.sin(PI / 2 + k * PI / 3)])));
          }
        }
        CB.add(powder, extrudeZ(s, T_), T(0, 0, -D / 2));
        MOUNT.forEach(([x, y]) => { CB.add(zinc, cyl(.75, .45, 6), T(x, y, -D / 2 + T_ + .22, 0, PI / 2)); CB.add(dark, new THREE.CircleGeometry(.42, 16), T(x, y, -D / 2 + T_ + .005, PI)); });
      }
      {
        const [x, y] = INL, z0 = -D / 2;
        const rec = [[-3.05, 1.95], [3.05, 1.95], [3.05, -.95], [2.05, -1.95], [-2.05, -1.95], [-3.05, -.95]];
        const recP = () => polyPath(rec);
        const fl = kit.shapeRect(10.2, 5.6, .6); fl.holes.push(recP(), kit.circlePath(-4.35, 0, .22), kit.circlePath(4.35, 0, .22));
        CB.add(nylon, extrudeZ(fl, .38, .05, 8), T(x, y, z0 - .43));
        const body = kit.shapeRect(7.0, 4.6, .3); body.holes.push(recP());
        CB.add(nylon, extrudeZ(body, 2.6), T(x, y, z0));
        CB.add(nylon, extrudeZ(polyPath(rec, new THREE.Shape()), .3), T(x, y, z0 + 2.3));
        [[0, .72, 1.0], [-1.75, -.55, 1.0], [1.75, -.55, 1.0]].forEach(([px, py, h]) => {
          CB.add(nickel, roundBox(.34, 2.0, h, .06, .05), T(x + px, y + py, z0 + 1.3, 0, PI / 2));
          CB.add(tin, box(.16, 1.3, .7), T(x + px, y + py, z0 + 2.95));
        });
        kit.screw(kase, [[x - 4.35, y, z0 - .43, 0, -PI / 2], [x + 4.35, y, z0 - .43, 0, -PI / 2]], { r: .42, h: .26, mat: blackScrew });
      }
      {
        const [x, y] = SW, z0 = -D / 2;
        const bz = kit.shapeRect(3.5, 5.0, .45); bz.holes.push(rectPath(0, 0, 2.7, 4.2));
        CB.add(nylon, extrudeZ(bz, .4, .05, 8), T(x, y, z0 - .45));
        CB.add(nylon, box(2.9, 4.3, 2.4), T(x, y, z0 + 1.2));
        const rocker = std({ color: 0x17181a, roughness: .5 });
        CB.add(rocker, roundBox(2.55, .7, 2.05, .12, .05), T(x, y + 1.02, z0 - .25, 0, PI / 2 - .3, 0));
        CB.add(rocker, roundBox(2.55, .7, 2.05, .12, .05), T(x, y - 1.02, z0 - .05, 0, PI / 2 + .06, 0));
      }

      const fan = part("fan"), FB = bucket(fan);
      const FAN_R = 16.6, FY = 21.25;
      {
        const s = kit.shapeRect(W - .8, D, 0); s.holes.push(kit.circlePath(0, 0, FAN_R));
        FB.add(powder, kit.extrude(s, T_, 0, 64), T(0, H - T_ / 2, 0));
        for (const sx of [-1, 1]) {
          const p = new THREE.Shape(), cx = sx * (W / 2 - .4), a0 = sx > 0 ? PI / 2 : PI / 2, a1 = sx > 0 ? 0 : PI;
          p.moveTo(cx, H); p.absarc(cx, H - .4, .4, a0, a1, sx > 0);
          p.lineTo(sx * W / 2, 20); p.lineTo(sx * (W / 2 - T_), 20); p.lineTo(sx * (W / 2 - T_), H - .4);
          p.absarc(cx, H - .4, .15, a1, a0, sx < 0); p.closePath();
          FB.add(powder, extrudeZ(p, D, 0, 6), T(0, 0, -D / 2));
        }
        const yR = H + .13, yS = yR + .25, SCR = 15.3;
        [2.9, 5.6, 8.3, 11.0, 13.7, 16.95].forEach(r => FB.add(wire, new THREE.TorusGeometry(r, .12, 6, Math.round(28 + r * 5)), T(0, yS, 0, 0, PI / 2)));
        for (let k = 0; k < 8; k++) {
          const a = k * PI / 4, c = Math.cos(a), s2 = Math.sin(a);
          if (k % 2 === 0) { FB.add(wire, cyl(.12, 14.3, 6), T(c * 9.85, yR, s2 * 9.85, -a, 0, PI / 2)); continue; }
          const L = SCR * Math.SQRT2;
          FB.add(wire, tube([[c * 2.7, yR, s2 * 2.7], [c * 16.9, yR, s2 * 16.9], [c * 18.2, H + .12, s2 * 18.2], [c * (L - .5), H + .12, s2 * (L - .5)]], .12, 24), T());
          FB.add(wire, new THREE.TorusGeometry(.42, .12, 6, 16), T(c * L, H + .12, s2 * L, 0, PI / 2));
        }
        FB.add(wire, cyl(2.5, .22, 32), T(0, yS + .1, 0));
        kit.screw(fan, [[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([a, b]) => [a * SCR, H + .24, b * SCR]), { r: .55, h: .32, mat: blackScrew });
        kit.screw(fan, [-1, 1].flatMap(sx => [-13.5, 13.5].map(z => [sx * W / 2, 20.65, z, 0, 0, -sx * PI / 2])), { r: .5, h: .28, mat: blackScrew });
        const fs = kit.shapeRect(34.4, 34.4, 1.8); fs.holes.push(kit.circlePath(0, 0, 16.45));
        [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => fs.holes.push(kit.circlePath(a * SCR, b * SCR, .3)));
        FB.add(pbt, kit.extrude(fs, 6.25, .06, 48), T(0, FY - 3.125, 0));
        for (let k = 0; k < 4; k++) { const a = PI / 4 + k * PI / 2; FB.add(pbt, box(12.4, .5, .8), T(Math.cos(a) * 10.4, FY - 6.0, -Math.sin(a) * 10.4, a)); }
        FB.add(pbt, cyl(4.4, .9, 40), T(0, FY - 5.8, 0));
      }
      const rotor = new THREE.Group(); fan.add(rotor);
      {
        const hub = add(fan, kit.lathe([[0, 16.2], [4.22, 16.2], [4.25, 20.45], [4.15, 20.72], [3.9, 20.82], [0, 20.82]], 48), pbt);
        rotor.add(hub);
        const NS = 14, NC = 9, r0 = 4.05, r1 = 16.1, pos = [], idx = [];
        for (let i = 0; i <= NS; i++) {
          const s = i / NS, r = r0 + (r1 - r0) * s;
          const chord = 4.3 + 4.4 * s, pitch = .8 - .32 * s, sweep = .45 * Math.pow(s, 1.6);
          const cut = s > .7 ? 1 - Math.sqrt(Math.max(0, 1 - Math.pow((s - .7) / .3, 2))) : 0;
          for (let j = 0; j <= NC; j++) {
            const c = j / NC * (1 - .6 * cut);
            const a = sweep + (c - .5) * chord * Math.cos(pitch) / r;
            const y = 18.5 + (c - .5) * chord * Math.sin(pitch) + .32 * Math.sin(PI * c) * (.5 + .5 * s);
            pos.push(r * Math.cos(a), y, -r * Math.sin(a));
          }
        }
        for (let i = 0; i < NS; i++) for (let j = 0; j < NC; j++) { const a = i * (NC + 1) + j, b = a + NC + 1; idx.push(a, b, a + 1, b, b + 1, a + 1); }
        const blade = new THREE.BufferGeometry();
        blade.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); blade.setIndex(idx); blade.computeVertexNormals();
        blade.setAttribute("uv", new THREE.Float32BufferAttribute(new Float32Array(pos.length / 3 * 2), 2));
        const blades = add(fan, mergeGeos([...Array(9)].map((_, k) => ({ geo: blade, m: T(0, 0, 0, k * 2 * PI / 9) }))), pbt2);
        rotor.add(blades);
        const S = kit.surface({ w: 7.6, h: 7.6, ppu: 64, base: { color: "#141518", rough: .35, metal: 0, height: .5 } });
        S.ring(0, 0, 3.25, 3.42, { color: "#9aa0a6", rough: .3, metal: .8 });
        S.text("TI", 0, -.9, .95, { color: "#e9e9e6" }, { weight: 800 });
        S.text("KESTREL · FDB", 0, .35, .42, { color: "#b7bbbf" }, { weight: 600 });
        S.text("DC 12V  0.33A", 0, 1.2, .36, { color: "#8e9398" }, { weight: 500 });
        S.text("KF1352512H", 0, 1.9, .3, { color: "#8e9398" }, { weight: 500 });
        const st = add(fan, new THREE.CircleGeometry(3.8, 48), S.material({ normal: 1 }));
        st.rotation.x = -PI / 2; st.position.y = 20.83; st.userData.noCast = true; rotor.add(st);
      }

      const mod = part("modular"), MB = bucket(mod);
      const SOCK = [
        { x: -9.175, y: 12.7, cols: 12, rows: 2, p: 1.05, label: "24-PIN ATX", key: "SDDSDSSDDSSDDSSDSDDSSDDS" },
        { x: 1.2, y: 12.7, cols: 6, rows: 2, p: .75, sense: true, label: "12V-2x6", key: "SSSSSSSSSSSS" },
        { x: 7.375, y: 12.7, cols: 4, rows: 2, p: 1.05, label: "CPU / PCIe", key: "DSSDSDDS" },
        { x: 13.375, y: 12.7, cols: 4, rows: 2, p: 1.05, label: "CPU / PCIe", key: "DSSDSDDS" },
        { x: -12.9, y: 7.7, cols: 4, rows: 2, p: 1.05, label: "CPU / PCIe", key: "DSSDSDDS" },
        { x: -6.9, y: 7.7, cols: 4, rows: 2, p: 1.05, label: "CPU / PCIe", key: "DSSDSDDS" },
        { x: -1.425, y: 7.7, cols: 3, rows: 2, p: 1.05, label: "SATA / PERIF.", key: "SDSDSD" },
        { x: 3.525, y: 7.7, cols: 3, rows: 2, p: 1.05, label: "SATA / PERIF.", key: "SDSDSD" },
        { x: 8.475, y: 7.7, cols: 3, rows: 2, p: 1.05, label: "SATA / PERIF.", key: "SDSDSD" },
        { x: 13.425, y: 7.7, cols: 3, rows: 2, p: 1.05, label: "SATA / PERIF.", key: "SDSDSD" }
      ];
      SOCK.forEach(o => { o.w = o.cols * o.p + .55; o.h = o.rows * o.p + .55 + (o.sense ? .5 : 0); });
      const PANEL_Z = D / 2 - T_, HOUSE_Z = 17.3;
      const ramp = (() => { const s = new THREE.Shape(); s.moveTo(0, 0); s.lineTo(.8, .38); s.lineTo(.8, 0); s.closePath(); return extrudeZ(s, 1.1); })();
      {
        const X = W / 2 - T_, s = new THREE.Shape();
        polyPath([[-X, T_], [X, T_], [X, 21.25], [-X, 21.25]], s);
        const pins = [], ends = [];
        SOCK.forEach(o => {
          const w2 = o.w / 2 + .08, h2 = o.h / 2 + .08, top = o.y + h2;
          s.holes.push(polyPath([[o.x - w2, o.y - h2], [o.x + w2, o.y - h2], [o.x + w2, top], [o.x + .75, top], [o.x + .75, top + .55], [o.x - .75, top + .55], [o.x - .75, top], [o.x - w2, top]]));
          const hs = kit.shapeRect(o.w, o.h, .12), cav = o.p * .74, ch = cav * .28;
          const yc = o.sense ? -.25 : 0;
          for (let j = 0; j < o.rows; j++) for (let i = 0; i < o.cols; i++) {
            const cx = (i - (o.cols - 1) / 2) * o.p, cy = yc + ((o.rows - 1) / 2 - j) * o.p, c2 = cav / 2;
            const k = o.key[j * o.cols + i];
            hs.holes.push(k === "D" ? polyPath([[cx - c2, cy - c2 + ch], [cx - c2 + ch, cy - c2], [cx + c2 - ch, cy - c2], [cx + c2, cy - c2 + ch], [cx + c2, cy + c2], [cx - c2, cy + c2]])
              : rectPath(cx, cy, cav, cav));
            pins.push([o.x + cx, o.y + cy, o.p]);
          }
          if (o.sense) for (let i = 0; i < 4; i++) { const cx = (i - 1.5) * o.p, cy = o.h / 2 - .42; hs.holes.push(rectPath(cx, cy, .32, .32)); ends.push([o.x + cx, o.y + cy]); }
          MB.add(nylon, extrudeZ(hs, D / 2 - .1 - HOUSE_Z), T(o.x, o.y, HOUSE_Z));
          MB.add(nylon, box(o.w - .1, o.h - .1, .3), T(o.x, o.y, HOUSE_Z + .15));
          MB.add(nylon, ramp, TB(V3(0, 0, -1), V3(0, 1, 0), V3(1, 0, 0), V3(o.x - .55, o.y + o.h / 2, D / 2 - .15)));
        });
        MB.add(powder, extrudeZ(s, T_), T(0, 0, PANEL_Z));
        const term = box(1, 1, .8);
        pins.forEach(([x, y, p]) => MB.add(tin, term, T(x, y, HOUSE_Z + .6, 0, 0, 0, p * .26, p * .26, 1)));
        ends.forEach(([x, y]) => MB.add(tin, term, T(x, y, HOUSE_Z + .6, 0, 0, 0, .14, .14, 1)));
        const pr = ink(37, 17, 40, S => {
          SOCK.forEach(o => S.text(o.label, o.x, 9.5 - (o.y - o.h / 2 - .62), .42, { color: "#dcddd8" }, { weight: 600 }));
          S.text("CAUTION: USE ONLY THE MODULAR CABLES SUPPLIED WITH THIS UNIT", -2.5, 9.5 - 3.3, .38, { color: "#b9bab5" }, { weight: 500 });
          S.text("KESTREL 850  ·  FULLY MODULAR", -2.5, 9.5 - 2.3, .46, { color: "#dcddd8" }, { weight: 700 });
        });
        MB.add(pr, plane(37, 17), T(0, 9.5, D / 2 + .004));
        kit.screw(mod, [[-17.2, 17.5, D / 2, 0, PI / 2], [17.2, 17.5, D / 2, 0, PI / 2]], { r: .45, h: .26, mat: blackScrew });
      }

      function tileTex(N, strength, draw) {
        const c = kit.canvas(N, N), g = c.getContext("2d");
        g.fillStyle = "rgb(128,128,128)"; g.fillRect(0, 0, N, N);
        draw(g, N, kit.rng(N + 7));
        return kit.tex(kit.normalFromHeight(c, strength, true), false, [1, 1]);
      }
      const tapeN = tileTex(256, 1.6, (g, N, r) => {
        for (let i = 0; i < 8; i++) { const x = r() * N, v = 100 + r() * 60 | 0; g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(x, 0, N * (.08 + r() * .25), N); }
        g.fillStyle = "rgb(70,70,70)"; for (let i = 0; i < 6; i++) g.fillRect(r() * N, 0, 1.5, N);
        g.strokeStyle = "rgb(175,175,175)"; g.lineWidth = 1.2;
        for (let i = 0; i < 12; i++) { const x = r() * N, y = r() * N; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 4 + r() * 10, y + (r() - .5) * 50); g.stroke(); }
      });
      const windN = tileTex(128, 2.4, (g, N) => {
        for (let x = 0; x < N; x++) { const v = 128 + 115 * Math.cos(x / N * 20 * PI) | 0; g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(x, 0, 1, N); }
      });
      const braidN = tileTex(128, 2, (g, N) => {
        const img = g.getImageData(0, 0, N, N), d = img.data;
        for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
          const a = (x + y) % 16, b = (x - y + N) % 16, over = ((Math.floor((x + y) / 16) + Math.floor((x - y + N) / 16)) & 1);
          const v = over ? 120 + 110 * Math.sin(b / 16 * PI) : 120 + 110 * Math.sin(a / 16 * PI), k = (y * N + x) * 4;
          d[k] = d[k + 1] = d[k + 2] = v; d[k + 3] = 255;
        }
        g.putImageData(img, 0, 0);
      });
      const tape = tiled(std({ color: 0xdcaa16, roughness: .5, metalness: 0, normalMap: tapeN, normalScale: V2(.45, .45) }), 1 / 3.5);
      const copperW = tiled(std({ color: 0xc8773d, roughness: .3, metalness: 1, normalMap: windN, normalScale: V2(.8, .8) }), 1 / .9);
      const copper = std({ color: 0xc8773d, roughness: .28, metalness: 1 });
      const braid = std({ color: 0x141517, roughness: .6, metalness: 0, normalMap: braidN, normalScale: V2(1.2, 1.2) });
      const aluX = kit.mat.alu().clone();
      aluX.normalMap = kit.tiles.brushed().clone(); aluX.normalMap.rotation = PI / 2; aluX.normalMap.needsUpdate = true;
      const epoxy = kit.mat.epoxy(), glass = kit.mat.glass(), rubber = kit.mat.rubber();
      const pcbBottom = std({ color: 0x0d3f25, roughness: .45 });

      const AW = 16, AH = 14, AT = kit.surface({ w: AW, h: AH, ppu: 96, base: { color: "#1a1b1e", rough: .6, metal: 0, height: .5 } });
      let shX = -AW / 2, shZ = -AH / 2, shH = 0;
      function cell(w, h, bg, draw, rough) {
        if (shX + w > AW / 2) { shX = -AW / 2; shZ += shH + .12; shH = 0; }
        const cx = shX + w / 2, cz = shZ + h / 2;
        shX += w + .12; shH = Math.max(shH, h);
        AT.rect(cx, cz, w + .1, h + .1, { color: bg, rough: rough != null ? rough : .55, metal: 0, height: .5 });
        const t = (s, dx, dz, size, col, wt, o) => AT.text(s, cx + dx, cz + dz, size, { color: col, height: .46, rough: .8 }, Object.assign({ weight: wt || 600 }, o));
        if (draw) draw(t, cx, cz);
        return { w, h, u0: (cx - w / 2) / AW + .5, u1: (cx + w / 2) / AW + .5, v0: .5 - (cz + h / 2) / AH, v1: .5 - (cz - h / 2) / AH };
      }
      function cellGeo(c, geo) {
        const g = geo || plane(c.w, c.h), U = g.attributes.uv;
        for (let i = 0; i < U.count; i++) U.setXY(i, c.u0 + U.getX(i) * (c.u1 - c.u0), c.v0 + U.getY(i) * (c.v1 - c.v0));
        return g;
      }
      const bars = (x0, x1, z, h, seed) => { const r = kit.rng(seed); for (let x = x0; x < x1;) { const w = .025 + r() * .06; if (r() < .6) AT.rect(x + w / 2, z, w, h, { color: "#161616" }); x += w + .02; } };
      const laser = "#8e9196", C = {};
      C.xcap = cell(4.4, 3.4, "#dfb420", t => {
        t("TI", -1.35, -1.05, .44, "#191919", 800); t("MKP X2", .7, -1.05, .38, "#191919", 700);
        t("0.47µF ±10%", 0, -.2, .38, "#191919"); t("310VAC~", 0, .45, .38, "#191919"); t("40/110/56/B  2609", 0, 1.1, .26, "#2b2b2b", 500);
      }, .5);
      C.relay = cell(4.6, 2.4, "#17181b", t => { t("TI-RY12", 0, -.68, .36, "#d9d9d6", 700); t("12VDC   10A 250VAC~", 0, 0, .25, "#bdbdb9"); t("16A 30VDC     2609", 0, .58, .22, "#9d9d99", 500); });
      C.ycap = cell(2.3, 2.3, "#1d52a3", t => { t("Y1", 0, -.45, .34, "#dfe6f2", 700); t("222M", 0, .05, .3, "#dfe6f2"); t("400V~", 0, .5, .22, "#c7d2e6"); }, .35);
      C.mov = cell(3.2, 3.2, "#2257aa", t => { t("TI", 0, -.62, .38, "#e2e8f2", 800); t("V471K14", 0, .02, .36, "#e2e8f2"); t("2609", 0, .62, .26, "#c7d2e6"); }, .35);
      C.ntc = cell(2.8, 2.8, "#1b201d", t => { t("NTC", 0, -.4, .34, "#c9c9c4", 700); t("5D-15", 0, .22, .3, "#c9c9c4"); }, .35);
      C.gbu = cell(5.4, 2.8, "#1b1c1f", t => { t("PBU1508", 0, -.75, .56, laser, 700); t("15A  800V   2609", 0, .05, .36, laser); t("~     +     −     ~", 0, .85, .4, laser, 700); });
      C.pfc = cell(4.0, 2.6, "#1b1c1f", t => { t("PCL65R099C", 0, -.55, .4, laser, 700); t("650V  2609", 0, .1, .34, laser); t("•", -1.55, .78, .3, laser); });
      C.llc = cell(4.0, 2.6, "#1b1c1f", t => { t("PCL60R140E", 0, -.55, .4, laser, 700); t("600V  2609", 0, .1, .34, laser); t("•", -1.55, .78, .3, laser); });
      C.sr = cell(4.0, 2.6, "#1b1c1f", t => { t("PCL040N08", 0, -.55, .4, laser, 700); t("80V  2609", 0, .1, .34, laser); t("•", -1.55, .78, .3, laser); });
      C.to220 = cell(2.4, 1.9, "#1b1c1f", t => { t("PCS10065", 0, -.35, .32, laser, 700); t("SiC 2609", 0, .3, .26, laser); });
      C.t1 = cell(2.8, 1.5, "#eeede7", (t, cx, cz) => { t("T1  TI-ERL35", 0, -.45, .26, "#1b1b1b", 700); t("850FM   E-01   2609", 0, -.05, .18, "#333"); bars(cx - 1.2, cx + 1.2, cz + .45, .38, 5); });
      C.t2 = cell(1.8, 1.0, "#eeede7", (t, cx, cz) => { t("TI-EE19", 0, -.25, .2, "#1b1b1b", 700); bars(cx - .75, cx + .75, cz + .22, .3, 9); });
      C.film = cell(3.0, 2.4, "#1b4f9d", t => { t("TI MPP", 0, -.65, .32, "#e8edf5", 700); t("333J", 0, 0, .36, "#e8edf5"); t("1600V", 0, .6, .28, "#e8edf5"); }, .45);
      C.soic = cell(2.0, 1.0, "#18191c", t => { t("PCL6599", 0, -.15, .24, laser, 700); t("2609A", 0, .22, .17, laser); });
      C.dip = cell(1.9, 1.0, "#18191c", t => { t("TI-SB7", 0, -.15, .22, laser, 700); t("2609", 0, .22, .16, laser); });
      C.opto = cell(1.2, .8, "#e9e7df", t => { t("PCL817", 0, -.1, .16, "#2a2a2a", 700); t("C 26", 0, .18, .12, "#555"); }, .5);
      C.fetS = cell(1.2, .9, "#18191c", t => { t("4N10", 0, -.1, .2, laser, 700); t("A26", 0, .22, .14, laser); });
      C.choke = cell(1.9, 1.9, "#34363a", t => t("1R0", 0, 0, .4, "#b4b7bc", 700), .72);
      C.rockI = cell(2.4, 1.9, "#17181a", (t, cx, cz) => AT.rect(cx, cz, .2, 1.0, { color: "#e6e6e2" }));
      C.rockO = cell(2.4, 1.9, "#17181a", (t, cx, cz) => AT.ring(cx, cz, .36, .5, { color: "#e6e6e2" }));
      const atlas = AT.material({ normal: 1.5, mat: { polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 } });
      atlas.userData.decal = true;

      {
        const S = kit.surface({ w: 27, h: 14.6, ppu: 48, base: { color: "#dcddd8", rough: .5, metal: .1, height: .5 } });
        const k = { color: "#161616" }, wh = { color: "#f1f1ed" }, grey = { color: "#c6c7c3" };
        S.noise(2500, .04, r => ({ color: r() < .5 ? "#000" : "#fff", alpha: .03 }), 3);
        S.rect(0, -5.95, 27, 2.7, { color: "#161718", rough: .42 });
        S.rect(-11.95, -5.95, 1.8, 1.8, wh, .3);
        S.poly([[-12.65, -5.35], [-11.95, -6.55], [-11.25, -5.35], [-11.95, -5.85]], { color: "#161718" });
        S.text("THE INTERNALS", -10.7, -6.4, .6, wh, { align: "left", weight: 800 });
        S.text("Fully Modular ATX Power Supply", -10.7, -5.3, .42, grey, { align: "left", weight: 500 });
        S.text("KESTREL 850", 12.9, -6.25, .95, wh, { align: "right", weight: 800 });
        S.text("MODEL: TI-850FM", 12.9, -5.1, .38, grey, { align: "right", weight: 600 });
        S.text("AC INPUT:  100–240V~   12–6A   50/60Hz", -12.9, -3.85, .46, k, { align: "left", weight: 700 });
        const x0 = -12.9, x1 = 12.9, cw0 = 5.3, cw = 4.1, rh = .95, z0 = -3.15;
        const rows = [["DC OUTPUT", ["+3.3V", "+5V", "+12V", "−12V", "+5VSB"]], ["MAX. LOAD", ["20A", "20A", "70.8A", "0.3A", "3.0A"]],
          ["MAX. COMBINED", ["100W", null, "849.6W", "3.6W", "15W"]], ["TOTAL POWER", ["850W"]]];
        S.rect(0, z0 + rh / 2, x1 - x0, rh, { color: "#c3c4bf" });
        rows.forEach(([h, vals], i) => {
          const zc = z0 + (i + .5) * rh;
          S.text(h, x0 + .25, zc, .34, k, { align: "left", weight: 700 });
          if (vals.length === 1) S.text(vals[0], x0 + cw0 + cw * 2.5, zc, .42, k, { weight: 800 });
          else vals.forEach((v, j) => { if (v != null) S.text(v, x0 + cw0 + cw * (j + (i === 2 && j === 0 ? 1 : .5)), zc, .38, k, { weight: i === 0 ? 800 : 600 }); });
          for (let j = 0; j <= 5; j++) {
            if ((i === 2 && j === 1) || (i === 3 && j > 0 && j < 5)) continue;
            S.rect(j === 5 ? x1 : x0 + cw0 + j * cw, zc, .045, rh + .045, k);
          }
          S.rect(x0, zc, .045, rh + .045, k);
        });
        for (let i = 0; i <= 4; i++) S.rect(0, z0 + i * rh, x1 - x0, .045, k);
        const zw = 1.95;
        S.poly([[-12.3, zw + .75], [-11.15, zw - 1.2], [-10.0, zw + .75]], k);
        S.poly([[-11.95, zw + .5], [-11.15, zw - .85], [-10.35, zw + .5]], { color: "#dcddd8" });
        S.poly([[-11.0, zw - .6], [-11.45, zw + .05], [-11.1, zw + .02], [-11.35, zw + .45], [-10.85, zw - .15], [-11.2, zw - .12]], k);
        S.text("CAUTION  ·  ATTENTION  ·  VORSICHT", -9.5, zw - .75, .36, k, { align: "left", weight: 800 });
        S.text("Hazardous voltage inside. Do not remove the cover: no user-serviceable parts inside.", -9.5, zw - .1, .28, k, { align: "left", weight: 500 });
        S.text("Refer servicing to qualified personnel. For indoor use only. Keep away from water.", -9.5, zw + .45, .28, k, { align: "left", weight: 500 });
        const zm = 4.75;
        S.ring(-11.9, zm, .78, .88, k); S.text("TI", -11.9, zm - .2, .3, k, { weight: 800 }); S.text("SAFE", -11.9, zm + .26, .2, k, { weight: 700 });
        S.poly([...Array(6)].map((_, i) => [-9.5 + .9 * Math.cos(i * PI / 3), zm + .9 * Math.sin(i * PI / 3)]), k);
        S.poly([...Array(6)].map((_, i) => [-9.5 + .76 * Math.cos(i * PI / 3), zm + .76 * Math.sin(i * PI / 3)]), { color: "#dcddd8" });
        S.text("GOLD", -9.5, zm - .18, .24, k, { weight: 800 }); S.text("90%", -9.5, zm + .24, .22, k, { weight: 700 });
        S.strokeRect(-7.1, zm, 1.9, 1.0, .07, k); S.text("RoHS", -7.1, zm, .34, k, { weight: 800 });
        S.poly([[-5.3, zm - .55], [-4.1, zm - .55], [-4.3, zm + .6], [-5.1, zm + .6]], k);
        S.poly([[-5.15, zm - .42], [-4.25, zm - .42], [-4.42, zm + .47], [-4.98, zm + .47]], { color: "#dcddd8" });
        S.line([[-5.6, zm - .85], [-3.8, zm + .85]], .09, k); S.line([[-3.8, zm - .85], [-5.6, zm + .85]], .09, k);
        S.text("Designed by The Internals  ·  Assembled 2609", -12.9, 6.55, .26, k, { align: "left", weight: 500 });
        const br = kit.rng(4217);
        for (let x = .6; x < 8.6;) { const w = .04 + br() * .1; if (br() < .62) S.rect(x + w / 2, 4.55, w, 1.35, k); x += w + .03; }
        S.text("S/N  PCL850FM2609K004217", 4.6, 5.75, .3, k, { weight: 600 });
        for (let i = 0; i < 12; i++) for (let j = 0; j < 12; j++) if (i === 0 || j === 11 || (i + j) % 2 === 0 && j === 0 || i === 11 && j % 2 === 0 || (i > 0 && j < 11 && br() < .5)) S.rect(10.3 + i * .16, 3.9 + j * .16, .16, .16, k);
        const lab = add(kase, plane(27, 14.6), S.material({ normal: .8 }));
        lab.rotation.y = PI / 2; lab.position.set(W / 2 + .006, 10.3, .6); lab.userData.noCast = true;
      }
      {
        const cx = -9.7, cy = 5.6, px = x => cx - x, pz = y => cy - y;
        const pr = ink(17.4, 10.6, 48, S => {
          const w = { color: "#d9dad5" };
          S.text("AC INPUT  100–240V~  12–6A  50/60Hz", px(INL[0] - .4), pz(9.55), .36, w, { weight: 600 });
          S.poly([[px(-17.6), pz(1.25)], [px(-17.05), pz(2.2)], [px(-16.5), pz(1.25)]], w);
          S.text("!", px(-17.05), pz(1.55), .38, { color: "#1d1e21" }, { weight: 800 });
          S.text("CAUTION: DISCONNECT THE POWER CORD BEFORE SERVICING", px(-9.4), pz(1.7), .28, w, { weight: 600 });
        });
        CB.add(pr, plane(17.4, 10.6), T(cx, cy, -D / 2 - .006, PI));
        CB.add(atlas, cellGeo(C.rockI, plane(2.35, 1.85)), T(SW[0], SW[1] + .95, -D / 2 - .63, PI, .3));
        CB.add(atlas, cellGeo(C.rockO, plane(2.35, 1.85)), T(SW[0], SW[1] - .98, -D / 2 - .42, PI, -.06));
        CB.add(std({ color: 0x0f1011, roughness: .3, metalness: 0 }), box(36.2, .05, 38.6), T(0, T_ + .03, 0));
        const warn = ink(22, 3.2, 40, S => {
          S.text("⚠  INSULATOR  —  DO NOT REMOVE", 0, -.7, .5, { color: "#d8d8d2" }, { weight: 700 });
          S.text("PC-FR 0.43 mm  ·  TI-850FM-INS", 0, .55, .36, { color: "#a9a9a4" }, { weight: 500 });
        });
        CB.add(warn, plane(22, 3.2), T(3, T_ + .061, 17.6, 0, -PI / 2));
        [[-17.5, -18.7], [17.5, -18.7], [-17.5, 15.7], [17.5, 15.7], [4.4, 15.7]].forEach(([x, z]) => CB.add(zinc, cyl(.45, 1.22, 6), T(x, T_ + .64, z)));
        CB.add(paint, tube([[INL[0], INL[1] + .72, -16.75], [INL[0] - 1.2, INL[1] + .9, -16.0], [-15.6, 4.6, -16.4], [-17.1, 3.4, -18.4], [-17.3, 3.2, -19.35]], .22, 40), T(), 0x7fa82e);
        CB.add(paint, box(.5, 1.5, 1.0), T(INL[0], INL[1] + .72, -16.95), 0x2d8c3c);
        CB.add(tin, new THREE.TorusGeometry(.42, .12, 6, 16), T(-17.3, 2.7, -19.66));
        kit.screw(kase, [[-17.3, 2.7, -19.72, 0, PI / 2]], { r: .45, h: .3, mat: zinc });
      }

      {
        const cy = 8.3, zb = 16.9;
        const vg = vgroup(mod, V3(0, 0, -1), 0, cy, zb), VB = bucket(vg);
        const loc = (xw, yw) => [-xw, cy - yw];
        const pinsW = [];
        SOCK.forEach(o => {
          const yc = o.sense ? -.25 : 0;
          for (let j = 0; j < o.rows; j++) for (let i = 0; i < o.cols; i++) pinsW.push([o.x + (i - (o.cols - 1) / 2) * o.p, o.y + yc + ((o.rows - 1) / 2 - j) * o.p, o.p]);
        });
        const capsW = [[-15.2, 10.2], [-12.4, 10.2], [-4.2, 10.2], [-1.4, 10.2], [4.6, 10.2], [7.4, 10.2], [11.6, 10.2], [16.4, 10.2]];
        const HDR = [[13.2, 4.2], [-4.0, 4.2]];
        const P = kit.pcb({ w: 36.4, d: 12.6, ppu: 40, mask: "green", seed: 31, traces: 16, vias: 40, finish: "tin", draw(P) {
          const cu = { color: P.maskHi, height: .6, alpha: .5 };
          P.rect(...loc(-9.2, 12.7), 14.2, 3.4, cu, .3); P.rect(...loc(7.4, 12.7), 17.6, 3.4, cu, .3);
          pinsW.forEach(([x, y, p]) => { const [lx, lz] = loc(x, y); P.circle(lx, lz, p * .36, P.padP); });
          capsW.forEach(([x, y]) => { const [lx, lz] = loc(x, y); P.ring(lx, lz, .84, .9, P.silkP); P.circle(lx - .3, lz, .2, P.padP); P.circle(lx + .3, lz, .2, P.padP); });
          HDR.forEach(([x, y]) => { const [lx, lz] = loc(x, y); P.strokeRect(lx, lz, 4.0, 2.8, .07, P.silkP); });
          P.ref("TI-850FM-MOD  REV 1.1", ...loc(-8, 3.2), .5); P.ref("J1", ...loc(-9.2, 14.6), .45); P.ref("J2", ...loc(1.2, 14.6), .45);
          P.ref("CN12  +12V", ...loc(13.2, 2.6), .4); P.ref("CN5  SIG", ...loc(-4, 2.6), .4);
          [[-17.2, 13.9], [17.2, 13.9], [-17.2, 2.6], [17.2, 2.6]].forEach(([x, y]) => P.hole(...loc(x, y), .28, .25));
          P.fiducial(...loc(-16.5, 5.5), .12); P.fiducial(...loc(16.5, 12.2), .12);
        } });
        kit.board(vg, { w: 36.4, d: 12.6, t: .4, y: -.2, top: P.material({ normal: 3, fit: true }), bottom: pcbBottom });
        const joint = kit.lathe([[.3, 0], [.26, .08], [.14, .2], [.07, .27], [0, .28]], 10);
        pinsW.forEach(([x, y, p]) => { const [lx, lz] = loc(x, y); VB.add(tin, joint, T(lx, 0, lz, 0, 0, 0, p / 1.05)); });
        kit.polycap(vg, capsW.map(([x, y]) => { const [lx, lz] = loc(x, y); return [lx, 0, lz]; }), { r: .8, h: 2.3, band: "#3a3483", text: "470" });
        HDR.forEach(([x, y]) => { const [lx, lz] = loc(x, y); VB.add(nylon, roundBox(3.8, .9, 2.6, .12, .05), T(lx, .45, lz)); });
        VB.flush();
      }

      const pcb = part("pcb"), PB = bucket(pcb);
      const PZ = -1.5, BW = 36.4, BD = 35.8;
      const FUSE = [-17.2, -14.2], LF1 = [-13.4, -13.6], LF2 = [-7.6, -13.6], CX1 = [-11.2, -9.4], CX2 = [-3.6, -17.3];
      const CYS = [[-16.8, -9.6], [-15.4, -9.6], [-4.7, -9.6], [-2.3, -9.6]], RELAY = [-3.6, -13.0], MOV = [-1.0, -14.2], NTC = [-7.4, -9.6];
      const BRX = 1.2, BRZ = [-19.2, -8.4], GBUZ = [-16.5, -11.1];
      const PFC = [-13.2, -2.6], BULK = [-12.6, 9.2], PRX = -6.6, PRZ = [-8.6, 10.4];
      const T1 = [2.0, -3.2], T2 = [8.8, -16.2], L2 = [-2.6, 5.8], SRX = 10.2, SRZ = [-9.6, 5.4];
      const FILM = [[-2.4, 9.4], [-2.4, 10.9]], OPTO = [[1.4, 7.0], [1.4, 9.0]], SBIC = [5.4, -14.0];
      const CARD = [-5.2, 12.6], DCDC = [[6.5, 12.6], [13.7, 12.6]], FANCON = [-1.4, 15.4], OCHOKE = [14.1, -.6];
      const HOLES = [[-17.5, -18.7], [17.5, -18.7], [-17.5, 15.7], [17.5, 15.7], [4.4, 15.7]];
      const Q_PRI = [[-6.4, "pfc"], [-2.3, "pfc"], [4.3, "llc"], [8.2, "llc"]], D_PRI = 1.2, Q_SEC = [-7.6, -3.3, 1.0], D_SEC = 4.0;
      const POLY = [[13.2, -8.2], [13.2, -6.4], [13.2, -4.6], [13.2, 3.2], [13.2, 5.0], [15.0, -8.2], [15.0, -6.4], [15.0, -4.6], [15.0, 3.2], [15.0, 5.0], [15.0, 6.8],
        [16.8, -8.2], [16.8, -6.4], [16.8, -4.6], [16.8, -2.8], [16.8, -1.0], [16.8, .8], [16.8, 2.6], [16.8, 4.4], [16.8, 6.2], [16.8, 8.0]];
      const ELCAP = [[13.4, -17.3, 1.25, 4.6], [16.2, -17.3, 1.25, 4.6], [13.4, -14.5, 1.25, 4.6], [16.2, -14.5, 1.25, 4.6], [16.4, -11.8, 1.0, 3.6],
        [12.6, 8.4, 1.0, 3.6], [5.0, -18.3, .6, 1.9], [11.8, -12.0, .6, 1.9], [-.2, 12.6, .6, 1.9]];
      const RES = [[-4.3, -6.4, PI / 2, 0x2f63a7], [-4.3, -2.2, PI / 2, 0x2f63a7], [-4.3, 2.4, PI / 2, 0xc9ae84], [-4.3, 6.4, PI / 2, 0x2f63a7],
        [3.2, -12.0, 0, 0xc9ae84], [6.8, -11.4, 0, 0x2f63a7], [-.9, 13.5, 0, 0xc9ae84], [2.2, 14.9, 0, 0x2f63a7], [11.4, -13.8, PI / 2, 0xc9ae84], [-9.8, -16.6, 0, 0x2f63a7]];
      const HARN = [[17.0, 9.8], [17.0, 10.5], [17.0, 11.2], [17.7, 9.8], [17.7, 10.5], [17.7, 11.2]], SIGP = [[.1, 14.3], [.4, 14.3], [.7, 14.3], [1.0, 14.3], [1.3, 14.3]];
      const smdR = [], smdC = [];
      function smdField(x0, z0, x1, z1, seed, fill) {
        const r = kit.rng(seed);
        for (let x = x0; x <= x1; x += .95) for (let z = z0; z <= z1; z += .72) if (r() < (fill || .55)) (r() < .55 ? smdR : smdC).push([x + (r() - .5) * .15, PCB_Y, z, r() < .7 ? 0 : PI / 2]);
      }
      smdField(-8.2, 14.2, -2.4, 15.8, 11); smdField(3.2, -13.2, 6.6, -11.2, 12); smdField(7.4, -9.2, 8.1, 4.4, 13, .75);
      smdField(-.4, 6.2, .5, 10.6, 14, .6); smdField(5.4, 14.9, 16.4, 15.9, 15, .45); smdField(-11.2, -19.0, -8.2, -17.6, 16, .5);

      const PT = kit.pcb({ w: BW, d: BD, ppu: 42, mask: "green", seed: 85, traces: 26, vias: 70, finish: "tin", draw(P) {
        const Z = z => z - PZ, cu = { color: P.maskHi, height: .62, alpha: .55 }, silk = P.silkP;
        const poly = pts => P.poly(pts.map(([x, z]) => [x, Z(z)]), cu);
        const fat = (w, pts) => P.line(pts.map(([x, z]) => [x, Z(z)]), w, cu);
        const pad = (x, z, r) => { r = r || .3; P.circle(x, Z(z), r, P.padP); P.circle(x, Z(z), r * .45, { color: "#a9adb2", height: .72, rough: .3, metal: 1 }); };
        const rect = (x, z, w, d, ref, dz) => { P.strokeRect(x, Z(z), w, d, .07, silk); if (ref) P.ref(ref, x, Z(z) + (dz != null ? dz : d / 2 + .45), .42); };
        const ring = (x, z, r, ref, dz) => { P.ring(x, Z(z), r, r + .08, silk); if (ref) P.ref(ref, x, Z(z) + (dz != null ? dz : r + .5), .42); };
        fat(1.0, [[-14.0, -16.1], [-16.4, -16.2], [-17.2, -16.6]]); fat(1.0, [[-17.2, -11.8], [-15.9, -11.3], [-14.6, -11.3]]);
        fat(1.0, [[-10.8, -16.1], [-11.2, -15.2], [-12.2, -15.2]]); fat(1.0, [[-10.6, -11.6], [-9.2, -11.6]]);
        fat(1.0, [[-6.0, -11.6], [-4.8, -10.6], [-3.4, -10.4], [-1.2, -11.2], [0, -12.2]]);
        fat(1.3, [[.2, -8.9], [-1.4, -8.2], [-4.4, -7.6], [-10.0, -7.8], [-12.0, -8.6]]);
        poly([[-17.0, 3.6], [-8.4, 3.6], [-4.4, 1.0], [-4.4, 11.2], [-8.4, 14.0], [-17.0, 14.0]]);
        poly([[-8.3, -8.9], [-4.6, -8.9], [-4.6, .8], [-8.3, .8]]);
        poly([[6.8, -9.9], [12.1, -9.9], [12.1, 9.6], [17.9, 9.6], [17.9, 11.6], [6.8, 11.6]]);
        poly([[12.4, -10.1], [17.9, -10.1], [17.9, 9.2], [12.4, 9.2]]);
        poly([[11.0, -19.2], [17.9, -19.2], [17.9, -10.5], [11.0, -10.5]]);
        P.paint(silk, c => {
          c.lineWidth = P.s(.1); c.setLineDash([P.s(.5), P.s(.3)]); c.beginPath();
          [[8.8, -19.4], [8.8, -12.2], [2.0, -8.8], [2.0, 2.2], [1.2, 4.2], [1.2, 16.4]].forEach(([x, z], i) => i ? c.lineTo(P.px(x), P.pz(Z(z))) : c.moveTo(P.px(x), P.pz(Z(z))));
          c.stroke();
        });
        P.ref("PRIMARY", -2.0, Z(15.9), .42); P.ref("SECONDARY", 4.2, Z(15.9), .42); P.ref("PRIMARY", 6.3, Z(-19.0), .36); P.ref("SECONDARY", 11.0, Z(-19.0), .36);
        P.poly([[-15.6, Z(15.6)], [-14.8, Z(14.3)], [-14.0, Z(15.6)]], silk); P.poly([[-15.25, Z(15.4)], [-14.8, Z(14.65)], [-14.35, Z(15.4)]], { color: P.mask });
        P.ref("DANGER! HIGH VOLTAGE", -10.6, Z(15.05), .42);
        P.ref("TI-850FM-MAIN  REV 1.3   94V-0   2609", 10.2, Z(16.05), .36);
        P.ref("L", -14.0, Z(-17.2), .5); P.ref("N", -10.8, Z(-17.2), .5); P.ref("FAN", FANCON[0], Z(FANCON[1]) - .95, .36);
        P.ref("+12V", 16.2, Z(10.5), .36); P.ref("GND", 18.0 - .9, Z(12.0), .32);
        rect(FUSE[0], FUSE[1], 1.7, 5.6, "F1", 3.2); pad(FUSE[0], FUSE[1] - 2.3); pad(FUSE[0], FUSE[1] + 2.3);
        [[LF1, "LF1"], [LF2, "LF2"]].forEach(([[x, z], ref]) => { rect(x, z, 5.8, 2.6, ref); [[-2.2, -.7], [2.2, -.7], [-2.2, .7], [2.2, .7]].forEach(([a, b]) => pad(x + a, z + b)); });
        [[CX1, "CX1"], [CX2, "CX2"]].forEach(([[x, z], ref]) => { rect(x, z, 4.6, 2.2, ref); pad(x - 1.9, z); pad(x + 1.9, z); });
        CYS.forEach(([x, z], i) => { rect(x, z, 2.5, .8, "CY" + (i + 1), -.9); pad(x - .4, z, .22); pad(x + .4, z, .22); });
        rect(RELAY[0], RELAY[1], 2.6, 4.8, "RY1", 2.9); [[-.7, -1.8], [.7, -1.8], [-.7, 1.8], [.7, 1.8]].forEach(([a, b]) => pad(RELAY[0] + a, RELAY[1] + b));
        rect(MOV[0], MOV[1], .9, 3.4, "RV1", 2.2); pad(MOV[0], MOV[1] - .8, .24); pad(MOV[0], MOV[1] + .8, .24);
        rect(NTC[0], NTC[1], 3.0, .9, "TH1", -1.0); pad(NTC[0] - .6, NTC[1], .24); pad(NTC[0] + .6, NTC[1], .24);
        rect(BRX + 1.1, (BRZ[0] + BRZ[1]) / 2, 3.2, BRZ[1] - BRZ[0], "HS1", -6.0);
        GBUZ.forEach((z, i) => { [-1.7, -.57, .57, 1.7].forEach(o => pad(BRX - .75, z + o, .26)); P.ref("BD" + (i + 1), BRX - 2.0, Z(z), .4); });
        rect(PFC[0], PFC[1], 4.0, 12.0, "L1", -6.5); pad(PFC[0] - .6, PFC[1] - 1.5, .4); pad(PFC[0] + .6, PFC[1] + 1.5, .4);
        ring(BULK[0], BULK[1], 4.35, "C1", -5.0); P.paint(silk, c => { c.beginPath(); c.arc(P.px(BULK[0]), P.pz(Z(BULK[1])), P.s(4.35), PI * .6, PI * 1.4); c.lineTo(P.px(BULK[0] - 2.6), P.pz(Z(BULK[1]))); c.closePath(); c.globalAlpha = .35; c.fill(); });
        pad(BULK[0] - 1.1, BULK[1], .45); pad(BULK[0] + 1.1, BULK[1], .45); P.ref("+", BULK[0] + 2.4, Z(BULK[1]), .7);
        rect(PRX - .7, (PRZ[0] + PRZ[1]) / 2, 2.2, PRZ[1] - PRZ[0], "HS2", -10.0);
        Q_PRI.forEach(([z], i) => { [-1.36, 0, 1.36].forEach(o => pad(PRX + 1.0, z + o, .3)); P.ref("Q" + (i + 1), PRX + 2.1, Z(z), .4, PI / 2); });
        rect(SRX + .7, (SRZ[0] + SRZ[1]) / 2, 2.2, SRZ[1] - SRZ[0], "HS3", -8.0);
        Q_SEC.forEach((z, i) => { [-1.36, 0, 1.36].forEach(o => pad(SRX - 1.0, z + o, .3)); P.ref("Q" + (i + 11), SRX - 2.2, Z(z), .4, PI / 2); });
        rect(T1[0], T1[1], 8.4, 9.4, "T1", 5.2); for (let i = 0; i < 6; i++) [-1, 1].forEach(s => pad(T1[0] + s * 3.95, T1[1] + (i - 2.5) * 1.3, .25));
        [-1, 1].forEach(s => [1.0, 2.0].forEach(dx => P.rect(T1[0] + dx, Z(T1[1] + s * 4.55), .95, .35, P.padP)));
        rect(T2[0], T2[1], 3.8, 4.0, "T2", 2.5); rect(L2[0], L2[1], 4.4, 4.8, "L2", -2.9);
        FILM.forEach(([x, z], i) => { rect(x, z, 3.2, 1.4, "C" + (i + 7), 0); pad(x - 1.2, z, .22); pad(x + 1.2, z, .22); });
        OPTO.forEach(([x, z], i) => rect(x, z, 1.1, 1.4, "U" + (i + 4), 0));
        rect(SBIC[0], SBIC[1], 1.1, 2.1, "U3", 1.6);
        POLY.forEach(([x, z]) => { ring(x, z, .84); pad(x - .3, z, .18); pad(x + .3, z, .18); });
        ELCAP.forEach(([x, z, r]) => { ring(x, z, r + .06); pad(x - r * .4, z, .2); pad(x + r * .4, z, .2); });
        RES.forEach(([x, z, ry]) => { const c = Math.cos(ry), s = Math.sin(ry); pad(x - c * 1.0, z + s * 1.0, .2); pad(x + c * 1.0, z - s * 1.0, .2); });
        [CARD, ...DCDC].forEach(([x, z], i) => { rect(x, z - .2, 6.6, .6, ["U1", "U21", "U22"][i], .8); for (let k = 0; k < 12; k++) P.rect(x - 2.75 + k * .5, Z(z - .2), .3, .5, P.padP); });
        rect(FANCON[0], FANCON[1], 1.8, 1.1); HARN.concat(SIGP).forEach(([x, z]) => pad(x, z, .26));
        HOLES.forEach(([x, z]) => P.hole(x, Z(z), .32, .32));
        smdR.concat(smdC).forEach(([x, , z, ry]) => { const c = ry ? 0 : 1; [-1, 1].forEach(s => P.rect(x + s * .26 * c, Z(z) + s * .26 * (1 - c), .2 + .08 * (1 - c), .2 + .08 * c, P.padP)); });
        [[-16.8, 16.0], [16.8, -10.8], [9.0, 14.8]].forEach(([x, z]) => P.fiducial(x, Z(z), .14));
        const tr_ = kit.rng(77); for (let i = 0; i < 14; i++) { const x = 6.6 + tr_() * 5, z = -9 + tr_() * 20; P.circle(x, Z(z), .2, P.padP); P.ref("TP" + (i + 1), x, Z(z) + .45, .24); }
      } });
      {
        const shape = kit.shapeRect(BW, BD, .3);
        shape.holes.push(rectPath(T1[0], -(-3.6 - PZ), .45, 8.4), rectPath(T2[0], -(T2[1] - PZ), .4, 3.0));
        kit.board(pcb, { shape, t: .4, y: PCB_Y - .2, z: PZ, top: PT.material({ normal: 3, fit: true }), bottom: pcbBottom, edge: 0x6d6a45,
          holes: HOLES.map(([x, z]) => [x, z - PZ, .32]) });
      }

      function toroid(Bk, m, R, r, wr, turns, arcs, core) {
        Bk.add(paint, new THREE.TorusGeometry(R, r, 10, 40), m, core);
        arcs.forEach(([a0, a1]) => {
          const pts = [], n = Math.round(turns * 12), rr = r + wr * .85;
          for (let i = 0; i <= n; i++) {
            const t = i / n, th = a0 + (a1 - a0) * t, ph = t * turns * 2 * PI, rad = R + rr * Math.cos(ph);
            pts.push(V3(rad * Math.cos(th), rad * Math.sin(th), rr * Math.sin(ph)));
          }
          Bk.add(copper, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), n, wr, 6, false), m);
        });
      }
      const disc = (R, t) => kit.lathe([[0, -t / 2], [R * .88, -t / 2], [R, -t * .18], [R, t * .18], [R * .88, t / 2], [0, t / 2]], 28);
      const glue = (Bk, x, y, z, sx, sy, sz) => Bk.add(paint, new THREE.SphereGeometry(1, 10, 7), T(x, y, z, 0, 0, 0, sx, sy, sz), 0xe9e6dc);
      {
        const [x, z] = FUSE, y = PCB_Y + 1.1;
        PB.add(glass, cyl(.55, 3.3, 16), T(x, y, z, 0, PI / 2));
        PB.add(copper, cyl(.035, 3.3, 4), T(x, y + .05, z, 0, PI / 2));
        [-1, 1].forEach(s => {
          PB.add(nickel, cyl(.58, .8, 16), T(x, y, z + s * 1.95, 0, PI / 2));
          [-1, 1].forEach(sx => PB.add(tin, box(.1, 1.25, .5), T(x + sx * .64, PCB_Y + .62, z + s * 1.95)));
          PB.add(tin, box(1.4, .12, .6), T(x, PCB_Y + .06, z + s * 1.95));
        });
      }
      [[LF1, 1.85, .8], [LF2, 1.7, .74]].forEach(([[x, z], R, r]) => {
        const yc = PCB_Y + .5 + R + r + .2;
        toroid(PB, T(x, yc, z), R, r, .12, 11, [[PI / 2 + .3, PI * 1.5 - .3], [-PI / 2 + .3, PI / 2 - .3]], 0x2a2c2e);
        PB.add(nylon, roundBox(2 * (R + r) + .5, .5, 2 * r + .9, .12, .05), T(x, PCB_Y + .25, z));
        PB.add(nylon, box(.18, 2 * (R - r) - .1, 2 * r + .5), T(x, yc, z));
        glue(PB, x - R, PCB_Y + .55, z + r + .1, .6, .3, .35); glue(PB, x + R * .8, PCB_Y + .55, z - r - .1, .5, .28, .3);
      });
      [CX1, CX2].forEach(([x, z]) => {
        PB.add(paint, roundBox(4.4, 3.4, 2.0, .15, .1), T(x, PCB_Y + .12 + 1.7, z), 0xdfb420);
        PB.add(atlas, cellGeo(C.xcap, plane(4.2, 3.2)), T(x, PCB_Y + .12 + 1.7, z + 1.006));
      });
      {
        const yd = disc(1.15, .5);
        CYS.forEach(([x, z]) => {
          const yc = PCB_Y + .8 + 1.15;
          PB.add(paint, yd, T(x, yc, z, 0, PI / 2), 0x1d52a3);
          PB.add(atlas, cellGeo(C.ycap, new THREE.CircleGeometry(1.0, 24)), T(x, yc, z + .26));
          [-.4, .4].forEach(o => PB.add(tin, cyl(.05, .9, 5), T(x + o, PCB_Y + .45, z)));
        });
        const [mx, mz] = MOV, my = PCB_Y + .7 + 1.6;
        PB.add(paint, disc(1.6, .6), T(mx, my, mz, PI / 2, PI / 2), 0x2257aa);
        PB.add(atlas, cellGeo(C.mov, new THREE.CircleGeometry(1.4, 28)), T(mx + .31, my, mz, PI / 2));
        [-.8, .8].forEach(o => PB.add(tin, cyl(.06, .8, 5), T(mx, PCB_Y + .4, mz + o)));
        const [nx, nz] = NTC, ny = PCB_Y + .7 + 1.4;
        PB.add(paint, disc(1.4, .55), T(nx, ny, nz, 0, PI / 2), 0x1b201d);
        PB.add(atlas, cellGeo(C.ntc, new THREE.CircleGeometry(1.2, 28)), T(nx, ny, nz + .285));
        [-.6, .6].forEach(o => PB.add(tin, cyl(.06, .8, 5), T(nx + o, PCB_Y + .4, nz)));
        const [rx, rz] = RELAY;
        PB.add(paint, roundBox(2.4, 3.6, 4.6, .1, .06), T(rx, PCB_Y + 1.85, rz), 0x17181b);
        PB.add(atlas, cellGeo(C.relay, plane(4.4, 2.2)), T(rx, PCB_Y + 3.656, rz, PI / 2, -PI / 2));
      }
      [[-1.75, [-14.0, -16.1], 0x6b4424], [1.75, [-10.8, -16.1], 0x2446a0]].forEach(([dx, [px, pz], col]) => {
        const x = INL[0] + dx, y = INL[1] - .55;
        PB.add(paint, roundBox(.75, 1.6, 1.3, .12, .08), T(x, y, -16.6), 0xb8322a);
        PB.add(paint, tube([[x, y, -15.95], [x, y - .4, -15.3], [px + (x - px) * .3, PCB_Y + 2.0, -15.4], [px, PCB_Y + .6, pz], [px, PCB_Y, pz]], .22, 30), T(), col);
      });

      {
        const [x, z] = PFC, R = 4.1, r = 1.25, wr = .17, yc = PCB_Y + .55 + R + r + wr * 2;
        toroid(PB, T(x, yc, z, PI / 2), R, r, wr, 36, [[-PI / 2 + .28, PI * 1.5 - .28]], 0xcfc6a0);
        PB.add(nylon, roundBox(3.6, .6, 6.0, .2, .06), T(x, PCB_Y + .3, z));
        [[-1.2, -2.2], [1.2, 2.4], [-1.1, 2.0]].forEach(([a, b]) => glue(PB, x + a, PCB_Y + .8, z + b, .7, .45, .8));
        [-1, 1].forEach(s => PB.add(copper, tube([[x, yc - R * .96 - r - .1, z + s * 1.2], [x + s * .6, PCB_Y + .5, z + s * 1.5], [x + s * .6, PCB_Y, z + s * 1.5]], .16, 12)));
      }
      FILM.forEach(([x, z]) => {
        PB.add(paint, roundBox(3.0, 2.4, 1.2, .1, .08), T(x, PCB_Y + 1.28, z), 0x1b4f9d);
        PB.add(atlas, cellGeo(C.film, plane(2.85, 2.25)), T(x, PCB_Y + 1.28, z + .606));
      });
      OPTO.forEach(([x, z]) => {
        PB.add(paint, roundBox(1.2, .7, .9, .06, .05), T(x, PCB_Y + .45, z, PI / 2), 0xe9e7df);
        PB.add(atlas, cellGeo(C.opto, plane(1.1, .75)), T(x, PCB_Y + .806, z, PI / 2, -PI / 2));
        [-1, 1].forEach(a => [-1, 1].forEach(b => PB.add(tin, box(.12, .35, .1), T(x + a * .5, PCB_Y + .17, z + b * .32))));
      });
      {
        const [x, z] = SBIC;
        PB.add(epoxy, roundBox(1.0, .7, 1.9, .06, .05), T(x, PCB_Y + .45, z));
        PB.add(atlas, cellGeo(C.dip, plane(1.8, .9)), T(x, PCB_Y + .806, z, PI / 2, -PI / 2));
        for (let i = 0; i < 4; i++) [-1, 1].forEach(s => PB.add(tin, box(.3, .45, .1), T(x + s * .55, PCB_Y + .25, z + (i - 1.5) * .5, 0, 0, s * .3)));
      }
      {
        const body = kit.lathe([[0, -.72], [.2, -.72], [.25, -.58], [.2, -.36], [.2, .36], [.25, .58], [.2, .72], [0, .72]], 14);
        RES.forEach(([x, z, ry, col]) => {
          const y = PCB_Y + .5;
          PB.add(paint, body, T(x, y, z, ry, 0, PI / 2), col);
          [-1, 1].forEach(s => {
            const c = Math.cos(ry), sn = -Math.sin(ry);
            PB.add(tin, cyl(.045, .32, 5), T(x + s * .88 * c, y, z + s * .88 * sn, ry, 0, PI / 2));
            PB.add(tin, cyl(.045, .5, 5), T(x + s * 1.02 * c, PCB_Y + .25, z + s * 1.02 * sn));
          });
        });
      }
      {
        toroid(PB, T(OCHOKE[0], PCB_Y + .78, OCHOKE[1], 0, PI / 2), 1.1, .45, .11, 14, [[.15, 2 * PI - .15]], 0x2b3a33);
        const [fx, fz] = FANCON;
        PB.add(paint, roundBox(1.7, 1.0, .9, .08, .05), T(fx, PCB_Y + .5, fz), 0xefece2);
        [-.3, .3].forEach(o => PB.add(tin, box(.14, .7, .14), T(fx + o, PCB_Y + .5, fz)));
      }
      kit.resistor(pcb, smdR, { l: .62, w: .32, h: .16 });
      kit.mlcc(pcb, smdC, { l: .52, w: .27, h: .26 });
      kit.screw(pcb, HOLES.map(([x, z]) => [x, PCB_Y, z]), { r: .52, h: .3, mat: zinc });

      {
        const DP = kit.pcb({ w: 6.4, d: 5.2, ppu: 80, mask: "green", seed: 21, traces: 12, vias: 24, finish: "tin", draw(P) {
          for (let i = 0; i < 12; i++) P.rect(-2.75 + i * .5, 2.35, .32, .5, P.padP);
          P.ref("TI-DB2  REV 1.0", -1.6, -2.25, .26);
          [[-2.3, 1.1], [-1.0, 1.1], [.3, 1.1]].forEach(([x, z]) => P.rect(x, z, 1.25, 1.05, P.padP));
          [[-2.3, -1.3], [-.95, -1.3], [2.2, -1.4]].forEach(([x, z]) => P.ring(x, z, .66, .72, P.silkP));
          P.ref("L1", .6, -2.25, .26); P.ref("Q1  Q2  Q3", -1.0, 1.95, .24);
        } });
        const dbTop = DP.material({ normal: 2.5, fit: true });
        const smd = (DB, list) => list.forEach(([x, z, col, l]) => DB.add(paint, box(l || .5, .22, .26), T(x, .11, z), col));
        const card = (x, z, fill) => {
          const vg = vgroup(pcb, V3(0, 0, 1), x, PCB_Y + 2.4, z), DB = bucket(vg);
          kit.board(vg, { w: 6.4, d: 5.2, t: .35, y: -.175, top: dbTop, bottom: pcbBottom });
          fill(DB, vg);
          for (let k = 0; k < 12; k++) DB.add(tin, kit.lathe([[.22, 0], [.12, .14], [0, .18]], 8), T(-2.75 + k * .5, -.175, 2.4, 0, -PI / 2));
          DB.flush();
        };
        const dcdc = (DB, vg) => {
          kit.polycap(vg, [[-2.3, 0, -1.3], [-.95, 0, -1.3], [2.2, 0, -1.4]], { r: .6, h: 1.7, band: "#3a3483", text: "820" });
          DB.add(ferrite, roundBox(1.9, 1.2, 1.9, .12, .06), T(.6, .6, -1.1));
          DB.add(atlas, cellGeo(C.choke, plane(1.8, 1.8)), T(.6, 1.206, -1.1, 0, -PI / 2));
          [-2.3, -1.0, .3].forEach(lx => { DB.add(epoxy, roundBox(1.15, .28, .95, .06, .04), T(lx, .14, 1.1)); DB.add(atlas, cellGeo(C.fetS, plane(1.05, .8)), T(lx, .286, 1.1, 0, -PI / 2)); });
          DB.add(epoxy, roundBox(1.0, .25, .65, .05, .03), T(2.0, .125, .9));
          smd(DB, [[1.6, 1.8, 0x9a7a55], [2.3, 1.8, 0x161616], [1.6, .1, 0x9a7a55], [2.5, .1, 0x161616], [1.4, -2.3, 0x9a7a55], [2.6, -.6, 0x9a7a55], [-1.7, -.1, 0x161616], [-.4, -.1, 0x9a7a55]]);
        };
        card(CARD[0], CARD[1], (DB) => {
          DB.add(epoxy, roundBox(2.0, .3, 1.0, .05, .04), T(-1.2, .15, -.6)); DB.add(atlas, cellGeo(C.soic, plane(1.9, .9)), T(-1.2, .306, -.6, 0, -PI / 2));
          DB.add(epoxy, roundBox(1.1, .28, .65, .05, .03), T(1.4, .14, -.9));
          for (let i = 0; i < 8; i++) [-1, 1].forEach(s => DB.add(tin, box(.12, .1, .25), T(-1.2 - .875 + i * .25, .05, -.6 + s * .6)));
          DB.add(paint, cyl(.45, 1.3, 16), T(1.9, .65, 1.2), 0x1f2c4f); DB.add(zinc, new THREE.CircleGeometry(.42, 16), T(1.9, 1.305, 1.2, 0, -PI / 2));
          smd(DB, [[-2.4, 1.0, 0x9a7a55], [-1.6, 1.0, 0x161616], [-.8, 1.0, 0x9a7a55], [0, 1.0, 0x161616], [.6, .2, 0x9a7a55], [2.6, -.8, 0x161616], [-2.6, -1.9, 0x9a7a55], [.4, -1.9, 0x161616]]);
        });
        DCDC.forEach(([x, z]) => card(x, z, dcdc));
      }

      function bundle(pads, path, cols, r, grid, sleeveR, ties) {
        const pts = path.map(p => V3(...p)), n = pts.length, fr = [];
        for (let i = 0; i < n; i++) {
          const t = pts[Math.min(n - 1, i + 1)].clone().sub(pts[Math.max(0, i - 1)]).normalize();
          const ref = Math.abs(t.x) > .9 ? V3(0, 1, 0) : V3(1, 0, 0);
          const a = ref.sub(t.clone().multiplyScalar(ref.dot(t))).normalize(), b = new THREE.Vector3().crossVectors(t, a);
          fr.push([a, b]);
        }
        pads.forEach(([px, pz], k) => {
          const [ox, oy] = grid[k];
          const wp = [V3(px, PCB_Y, pz), V3(px, PCB_Y + .7, pz)].concat(pts.map((p, i) => p.clone().addScaledVector(fr[i][0], ox).addScaledVector(fr[i][1], oy)));
          PB.add(paint, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(wp, false, "catmullrom", .3), 60, r, 7, false), T(), cols[k]);
        });
        const curve = new THREE.CatmullRomCurve3(pts, false, "catmullrom", .3);
        if (sleeveR) {
          const sub = new THREE.CatmullRomCurve3(pts.slice(1, -1), false, "catmullrom", .3), g = new THREE.TubeGeometry(sub, 48, sleeveR, 12, false);
          const len = sub.getLength(), U = g.attributes.uv;
          for (let i = 0; i < U.count; i++) U.setXY(i, U.getX(i) * len / .5, U.getY(i) * 2 * PI * sleeveR / .5);
          PB.add(braid, g, T());
        }
        ties.forEach(f => {
          const p = curve.getPointAt(f), t = curve.getTangentAt(f), q = new THREE.Quaternion().setFromUnitVectors(V3(0, 0, 1), t);
          const m = new THREE.Matrix4().compose(p, q, V3(1, 1, 1)), R = (sleeveR || r * 2.6) + .06;
          PB.add(paint, new THREE.TorusGeometry(R, .07, 4, 24), m, 0xe7e4da);
          PB.add(paint, box(.42, .36, .34), m.clone().multiply(T(0, R + .12, 0)), 0xe7e4da);
        });
        const end = pts[n - 1];
        return end;
      }
      {
        const e = bundle(HARN, [[17.3, PCB_Y + 2.2, 10.6], [17.0, 7.6, 11.5], [15.8, 9.4, 13.2], [14.2, 8.4, 14.3], [13.2, 6.4, 14.6], [13.2, 4.9, 14.75]],
          [0xd8b21c, 0xd8b21c, 0xd8b21c, 0x151515, 0x151515, 0x151515], .26, [[-.28, -.55], [-.28, 0], [-.28, .55], [.28, -.55], [.28, 0], [.28, .55]], .95, [.28, .62]);
        PB.add(paint, roundBox(3.6, 2.4, 1.2, .15, .08), T(e.x, 4.2, 15.4), 0xe9e6dc);
        const s = bundle(SIGP, [[.7, PCB_Y + 1.4, 14.7], [-.6, 4.6, 15.0], [-2.8, 5.3, 14.9], [-4.0, 4.9, 14.75]],
          [0x2f8a3a, 0x8a8d90, 0x6a3d99, 0xd8731f, 0xb3261e], .16, [[-.36, 0], [-.18, 0], [0, 0], [.18, 0], [.36, 0]], 0, [.55]);
        PB.add(paint, roundBox(3.0, 2.0, 1.2, .15, .08), T(s.x, 4.2, 15.4), 0xe9e6dc);
      }

      const tr = part("transformer"), TRB = bucket(tr);
      function magnetic(x, z, s, label, lw, lh, straps) {
        const cw = 3.9 * s, ch = 4.6 * s, cd = 1.9 * s, leg = .9 * s, bh = .5 * s, lift = .25 * s;
        const yc = PCB_Y + lift + bh + ch, base = PCB_Y + lift;
        TRB.add(nylon, roundBox(2 * cw + .5 * s, bh, 8.8 * s, .2 * s, .05 * s), T(x, base + bh / 2, z));
        for (let i = 0; i < 6; i++) [-1, 1].forEach(sx => TRB.add(tin, cyl(.09 * s + .02, lift + .1, 6), T(x + sx * (cw + .02 * s), PCB_Y + lift / 2, z + (i - 2.5) * 1.3 * s)));
        [-1, 1].forEach(sx => {
          TRB.add(ferrite, roundBox(leg, 2 * ch, 2 * cd, .1 * s, .04 * s), T(x + sx * (cw - leg / 2), yc, z));
          [1, -1].forEach(sy => TRB.add(ferrite, box(cw - leg - .03 * s, leg, 2 * cd), T(x + sx * ((cw - leg) / 2 + .015 * s), yc + sy * (ch - leg / 2), z)));
        });
        const wl = 2 * (cw - leg) - .5 * s, wh = 2 * (ch - leg) - .02, wd = 8.4 * s, band = .32 * s;
        const along = p => TB(V3(0, 0, -1), V3(0, 1, 0), V3(1, 0, 0), p);
        TRB.add(tape, extrudeZ(kit.shapeRect(wd, wh, 1.4 * s), wl - 2 * band, 0, 6), along(V3(x - wl / 2 + band, yc, z)));
        [-1, 1].forEach(sx => {
          TRB.add(copperW, extrudeZ(kit.shapeRect(wd - .3 * s, wh - .02, 1.3 * s), band, 0, 6), along(V3(x + sx * (wl / 2 - band / 2) - band / 2, yc, z)));
          TRB.add(nylon, box(.2 * s, wh, wd + .5 * s), T(x + sx * (wl / 2 + .1 * s), yc, z));
        });
        TRB.add(tape, box(2 * cw + .08 * s, .06 * s, 1.3 * s), T(x, yc + ch + .03 * s, z));
        [-1, 1].forEach(sx => TRB.add(tape, box(.06 * s, 2 * ch, 1.3 * s), T(x + sx * (cw + .03 * s), yc, z)));
        if (label) TRB.add(atlas, cellGeo(label, plane(lw, lh)), T(x, yc - .5 * s, z + wd / 2 + .012));
        [-1, 1].forEach(sz => TRB.add(copper, tube([[x - wl / 2 + .7 * s, yc - wh / 2 + .5 * s, z + sz * (wd / 2 - .6 * s)], [x - cw + .2 * s, yc - wh / 2 - .1 * s, z + sz * 3.4 * s], [x - cw - .05 * s, base + bh + .05, z + sz * 3.25 * s]], .06 * s + .03, 14)));
        if (straps) [-1, 1].forEach(sz => [1.0, 2.0].forEach(dx => {
          const yy = yc - 2.4, zo = z + sz * (wd / 2 + .35);
          TRB.add(copper, box(.85, .12, .7), T(x + dx, yy, z + sz * (wd / 2 + .02)));
          TRB.add(copper, box(.85, yy - PCB_Y + .06, .12), T(x + dx, (yy + PCB_Y) / 2, zo));
        }));
      }
      magnetic(T1[0], T1[1], 1, C.t1, 2.8, 1.5, true);
      magnetic(T2[0], T2[1], .42, C.t2, 1.5, .83);
      magnetic(L2[0], L2[1], .5, C.t2, 1.7, .94);

      const caps = part("caps"), KB = bucket(caps);
      const capTop = (() => {
        const S = kit.surface({ w: 2, h: 2, ppu: 128, base: { color: "#c3c7cc", rough: .3, metal: 1, height: .5 } });
        S.noise(700, .012, r => ({ color: r() < .5 ? "#000" : "#fff", alpha: .06 }));
        S.ring(0, 0, .86, 1.0, { color: "#9ca0a5", height: .4 });
        const g = { height: .22, color: "#8d9196" };
        S.line([[-.45, -.55], [-.45, .55]], .07, g); S.line([[-.45, 0], [.42, -.58]], .07, g); S.line([[-.45, 0], [.42, .58]], .07, g);
        return S.material({ normal: 4 });
      })();
      const rimMat = std({ color: 0x17181b, roughness: .36 });
      function sleeve(W, H, bg, stripe, ink, lines) {
        return std({ roughness: .36, metalness: 0, map: ctx.texture(W, H, (g, w, h) => {
          g.fillStyle = bg; g.fillRect(0, 0, w, h);
          g.fillStyle = stripe; g.fillRect(w * .5, 0, w * .13, h);
          g.fillStyle = bg; g.font = `800 ${h * .09}px Arial`; g.textAlign = "center"; g.textBaseline = "middle";
          for (let k = 0; k < 7; k++) g.fillText("−", w * .565, h * (.08 + k * .14));
          g.fillStyle = ink;
          lines.forEach(([s, y, px, wt]) => { g.font = `${wt} ${h * px}px 'IBM Plex Sans', Arial, sans-serif`; for (const dx of [-w, 0, w]) g.fillText(s, w * .13 + dx, h * y); });
          g.fillStyle = "rgba(255,255,255,.08)"; g.fillRect(0, h * .025, w, h * .012); g.fillRect(0, h * .965, w, h * .012);
        }) });
      }
      {
        const [x, z] = BULK, r = 4.25, hs = 11.0, y0 = PCB_Y + .3;
        const mat = sleeve(1024, 448, "#17181b", "#8b9097", "#d6b56a", [["TI", .18, .1, 800], ["LHX  105°C", .32, .06, 600], ["470µF  420V", .47, .085, 800], ["(M)   35×45", .61, .055, 600], ["2609   TI-B", .74, .05, 600]]);
        KB.add(rubber, cyl(r * .97, .3, 48), T(x, PCB_Y + .15, z));
        KB.add(mat, new THREE.CylinderGeometry(r, r, hs, 64, 1, true), T(x, y0 + hs / 2, z, .25));
        KB.add(rimMat, kit.lathe([[r, 0], [r, .1], [r * .985, .25], [r * .95, .36], [r * .9, .4]], 64), T(x, y0 + hs, z));
        KB.add(capTop, new THREE.CircleGeometry(r * .905, 48), T(x, y0 + hs + .38, z, 0, -PI / 2));
        glue(KB, x + 3.6, PCB_Y + .7, z - 1.6, .9, .6, 1.2); glue(KB, x + 2.8, PCB_Y + .6, z + 2.9, .8, .5, .9);
      }
      {
        const mat = sleeve(512, 256, "#1b1f27", "#7e8793", "#d9dde4", [["TI", .22, .15, 800], ["2200µF", .45, .13, 700], ["16V  105°C", .65, .1, 600], ["LZ  2609", .83, .08, 600]]);
        const EL = ELCAP.map(([x, z, r, h]) => ({ x, z, r, h: h - .15 }));
        const body = new THREE.CylinderGeometry(1, 1, 1, 32, 1, true), rim = kit.lathe([[1, 0], [.985, .06], [.95, .1], [.9, .11]], 32), top = new THREE.CircleGeometry(.905, 32);
        top.rotateX(-PI / 2);
        kit.place(caps, cyl(1, .15, 24), rubber, EL.map(c => [c.x, PCB_Y + .075, c.z, 0, 0, 0, c.r * .96, 1, c.r * .96]));
        kit.place(caps, body, mat, EL.map(c => [c.x, PCB_Y + .15 + c.h / 2, c.z, .35, 0, 0, c.r, c.h, c.r]));
        kit.place(caps, rim, rimMat, EL.map(c => [c.x, PCB_Y + .15 + c.h, c.z, 0, 0, 0, c.r, c.r, c.r]));
        kit.place(caps, top, capTop, EL.map(c => [c.x, PCB_Y + .15 + c.h + .108 * c.r, c.z, 0, 0, 0, c.r, 1, c.r]));
      }
      kit.polycap(caps, POLY.map(([x, z]) => [x, PCB_Y, z]), { r: .8, h: 2.4, band: "#3a3483", text: "470" });

      const hs = part("heatsinks"), HB = bucket(hs), hsScrews = [];
      function sink(x, z0, z1, h, fins, finLen, dir) {
        const t = .5, ft = .26, pts = [[-t / 2, 0], [-t / 2, h]];
        for (let k = 0; k < fins; k++) {
          const y = h - ft / 2 - k * (h - 1.8) / (fins - 1);
          pts.push([t / 2, y + ft / 2], [t / 2 + finLen, y + ft / 2], [t / 2 + finLen, y - ft / 2], [t / 2, y - ft / 2]);
        }
        pts.push([t / 2, .3], [t / 2 + .5, .3], [t / 2 + .5, 0]);
        HB.add(aluX, extrudeZ(polyPath(pts.map(([u, v]) => [u * dir, v]), new THREE.Shape()), z1 - z0, .03, 2), T(x, PCB_Y, z0));
      }
      const frame = (xf, z, dir) => dir > 0 ? TB(V3(0, 0, -1), V3(0, 1, 0), V3(1, 0, 0), V3(xf, 0, z)) : TB(V3(0, 0, 1), V3(0, 1, 0), V3(-1, 0, 0), V3(xf, 0, z));
      const at = (F, x, y, z, ry, rx, rz) => F.clone().multiply(T(x, y, z, ry, rx, rz));
      const screwAt = (F, x, y, z, dir) => { const p = V3(x, y, z).applyMatrix4(F); hsScrews.push([p.x, p.y, p.z, 0, 0, -dir * PI / 2]); };
      function to247(xf, z, dir, mark) {
        const F = frame(xf, z, dir), yb = PCB_Y + 2.3;
        HB.add(paint, box(4.5, 5.9, .1), at(F, 0, yb + 2.65, .05), 0x8e949a);
        HB.add(epoxy, roundBox(4.0, 5.2, 1.25, .1, .08), at(F, 0, yb + 2.6, .1 + .625));
        HB.add(atlas, cellGeo(mark, plane(3.5, 2.28)), at(F, 0, yb + 1.45, 1.356));
        [-1.36, 0, 1.36].forEach(lx => {
          HB.add(tin, box(.62, .5, .22), at(F, lx, yb - .2, .72));
          HB.add(tin, box(.3, yb - .45 - PCB_Y, .14), at(F, lx, (yb - .45 + PCB_Y) / 2, .72));
        });
        screwAt(F, 0, yb + 4.05, 1.36, dir);
      }
      function to220(xf, z, dir, mark) {
        const F = frame(xf, z, dir), yb = PCB_Y + 3.0;
        HB.add(paint, box(2.9, 4.4, .08), at(F, 0, yb + 2.0, .04), 0x8e949a);
        HB.add(nickel, box(2.6, 1.8, .3), at(F, 0, yb + 3.2, .23));
        HB.add(epoxy, roundBox(2.6, 2.3, 1.1, .08, .06), at(F, 0, yb + 1.15, .08 + .55));
        HB.add(atlas, cellGeo(mark, plane(2.3, 1.8)), at(F, 0, yb + 1.15, 1.186));
        [-.95, 0, .95].forEach(lx => HB.add(tin, box(.22, yb - PCB_Y, .1), at(F, lx, (yb + PCB_Y) / 2, .45)));
        screwAt(F, 0, yb + 3.3, .38, dir);
      }
      function gbu(xf, z, dir) {
        const F = frame(xf, z, dir), yb = PCB_Y + 1.5;
        HB.add(paint, box(5.1, 4.1, .08), at(F, 0, yb + 1.9, .04), 0x8e949a);
        HB.add(epoxy, roundBox(4.8, 3.8, .9, .1, .06), at(F, 0, yb + 1.9, .08 + .45));
        HB.add(atlas, cellGeo(C.gbu, plane(4.4, 2.3)), at(F, 0, yb + 1.25, .986));
        [-1.7, -.57, .57, 1.7].forEach(lx => HB.add(tin, box(.26, yb - PCB_Y + .1, .12), at(F, lx, (yb + PCB_Y) / 2, .5)));
        screwAt(F, 0, yb + 3.0, .99, dir);
      }
      sink(BRX, BRZ[0], BRZ[1], 7.0, 5, 1.8, 1);
      GBUZ.forEach(z => gbu(BRX - .25, z, -1));
      sink(PRX, PRZ[0], PRZ[1], 9.2, 7, 1.3, -1);
      Q_PRI.forEach(([z, k]) => to247(PRX + .25, z, 1, C[k]));
      to220(PRX + .25, D_PRI, 1, C.to220);
      sink(SRX, SRZ[0], SRZ[1], 7.2, 5, 1.6, 1);
      Q_SEC.forEach(z => to247(SRX - .25, z, -1, C.sr));
      to220(SRX - .25, D_SEC, -1, C.to220);
      kit.screw(hs, hsScrews, { r: .48, h: .3, mat: zinc });

      [CB, FB, MB, PB, TRB, KB, HB].forEach(b => b.flush());

      return {
        layout: {
          fan: { y: 0, dy: 23 },
          transformer: { y: 0, dy: 20 },
          caps: { y: 0, dy: 18 },
          heatsinks: { y: 0, dy: 16 },
          modular: { y: 0, dy: -12, dz: 15 },
          pcb: { y: 0, dy: 12 },
          case: { y: 0, dy: -12 }
        },
        anchors: {
          fan: [12, H + .3, 12], transformer: [T1[0], PCB_Y + 9.8, T1[1]], caps: [BULK[0], PCB_Y + 11.7, BULK[1]], heatsinks: [PRX - .8, PCB_Y + 9.2, 1],
          modular: [8, 4, D / 2], pcb: [-15.5, PCB_Y, 15], case: [W / 2, 5, -8]
        },
        hideWhenClosed: ["transformer", "caps", "heatsinks", "pcb"],
        tick(dt) { rotor.rotation.y += dt * 2.4; }
      };
    }
  });
})();
