window.Internals = window.Internals || {};

Internals.kit3d = function (ctx) {
  const { THREE } = ctx;
  const maxAniso = Math.min(8, ctx.renderer.capabilities.getMaxAnisotropy());
  const kit = {};
  const cache = new Map();
  const once = (k, make) => { if (!cache.has(k)) cache.set(k, make()); return cache.get(k); };

  kit.rng = seed => {
    let s = Math.floor(seed || 1) % 2147483647; if (s <= 0) s += 2147483646;
    return () => (s = s * 16807 % 2147483647) / 2147483647;
  };

  function canvas(w, h) { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; }
  function tex(c, srgb, repeat) {
    const t = new THREE.CanvasTexture(c);
    if (srgb) t.encoding = THREE.sRGBEncoding;
    t.anisotropy = maxAniso;
    if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
    return t;
  }
  kit.canvas = canvas;
  kit.tex = tex;

  function normalFromHeight(src, strength, wrap) {
    const W = src.width, H = src.height;
    const sd = src.getContext("2d").getImageData(0, 0, W, H).data;
    const h = new Float32Array(W * H);
    for (let i = 0; i < W * H; i++) h[i] = sd[i * 4] / 255;
    const out = canvas(W, H), og = out.getContext("2d"), img = og.createImageData(W, H), d = img.data;
    const ix = x => wrap ? (x + W) % W : Math.max(0, Math.min(W - 1, x));
    const iy = y => wrap ? (y + H) % H : Math.max(0, Math.min(H - 1, y));
    for (let y = 0; y < H; y++) {
      const yu = iy(y - 1) * W, yd = iy(y + 1) * W, row = y * W;
      for (let x = 0; x < W; x++) {
        const dx = (h[row + ix(x + 1)] - h[row + ix(x - 1)]) * strength;
        const dy = (h[yd + x] - h[yu + x]) * strength;
        const len = Math.sqrt(dx * dx + dy * dy + 1), k = (row + x) * 4;
        d[k] = (-dx / len * .5 + .5) * 255; d[k + 1] = (dy / len * .5 + .5) * 255; d[k + 2] = (1 / len * .5 + .5) * 255; d[k + 3] = 255;
      }
    }
    og.putImageData(img, 0, 0);
    return out;
  }
  kit.normalFromHeight = normalFromHeight;

  const gray = v => { const n = Math.round(Math.max(0, Math.min(1, v)) * 255); return `rgb(${n},${n},${n})`; };
  const rmStyle = (r, m) => `rgb(0,${Math.round(r * 255)},${Math.round(m * 255)})`;

  kit.surface = function (o) {
    const ppu = o.ppu || 16;
    const W = Math.max(4, Math.round(o.w * ppu)), H = Math.max(4, Math.round(o.h * ppu));
    const base = Object.assign({ color: "#808080", height: .5, rough: .6, metal: 0 }, o.base);
    const C = { color: canvas(W, H), height: canvas(W, H), rm: canvas(W, H) };
    const g = { color: C.color.getContext("2d"), height: C.height.getContext("2d"), rm: C.rm.getContext("2d") };
    g.color.fillStyle = base.color; g.color.fillRect(0, 0, W, H);
    g.height.fillStyle = gray(base.height); g.height.fillRect(0, 0, W, H);
    g.rm.fillStyle = rmStyle(base.rough, base.metal); g.rm.fillRect(0, 0, W, H);
    const px = x => (x + o.w / 2) * ppu, pz = z => (z + o.h / 2) * ppu, s = v => v * ppu;

    function paint(p, draw) {
      const jobs = [];
      if (p.color != null) jobs.push([g.color, p.color]);
      if (p.height != null) jobs.push([g.height, gray(p.height)]);
      if (p.rough != null || p.metal != null) jobs.push([g.rm, rmStyle(p.rough != null ? p.rough : base.rough, p.metal != null ? p.metal : base.metal)]);
      for (const [c, style] of jobs) {
        c.save();
        c.globalAlpha = p.alpha != null ? p.alpha : 1;
        if (p.blur) c.filter = `blur(${Math.max(.5, s(p.blur))}px)`;
        c.fillStyle = c.strokeStyle = style;
        draw(c);
        c.restore();
      }
    }
    function rrect(c, x, y, w, h, r) {
      r = Math.min(r, w / 2, h / 2);
      c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
      c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
    }

    const S = {
      W, H, ppu, px, pz, s, g, canvases: C, base, w: o.w, h: o.h,
      paint,
      rect(x, z, w, h, p, r) {
        paint(p, c => { c.beginPath(); if (r) rrect(c, px(x - w / 2), pz(z - h / 2), s(w), s(h), s(r)); else c.rect(px(x - w / 2), pz(z - h / 2), s(w), s(h)); c.fill(); });
      },
      strokeRect(x, z, w, h, lw, p, r) {
        paint(p, c => { c.lineWidth = Math.max(1, s(lw)); c.beginPath(); if (r) rrect(c, px(x - w / 2), pz(z - h / 2), s(w), s(h), s(r)); else c.rect(px(x - w / 2), pz(z - h / 2), s(w), s(h)); c.stroke(); });
      },
      circle(x, z, r, p) { paint(p, c => { c.beginPath(); c.arc(px(x), pz(z), Math.max(.5, s(r)), 0, Math.PI * 2); c.fill(); }); },
      ring(x, z, r0, r1, p) {
        paint(p, c => { c.beginPath(); c.arc(px(x), pz(z), s(r1), 0, Math.PI * 2); c.arc(px(x), pz(z), s(r0), 0, Math.PI * 2, true); c.fill(); });
      },
      line(pts, width, p) {
        paint(p, c => {
          c.lineWidth = Math.max(1, s(width)); c.lineJoin = "round"; c.lineCap = p.cap || "round";
          c.beginPath(); pts.forEach(([x, z], i) => i ? c.lineTo(px(x), pz(z)) : c.moveTo(px(x), pz(z))); c.stroke();
        });
      },
      poly(pts, p) { paint(p, c => { c.beginPath(); pts.forEach(([x, z], i) => i ? c.lineTo(px(x), pz(z)) : c.moveTo(px(x), pz(z))); c.closePath(); c.fill(); }); },
      text(str, x, z, size, p, opts = {}) {
        paint(p, c => {
          c.translate(px(x), pz(z));
          if (opts.rot) c.rotate(opts.rot);
          if (o.underside) c.scale(1, -1);
          c.font = `${opts.weight || 600} ${Math.max(4, s(size) * 1.36)}px ${opts.font || "'IBM Plex Sans', 'Helvetica Neue', Arial, sans-serif"}`;
          c.textAlign = opts.align || "center"; c.textBaseline = opts.base || "middle";
          if (opts.spacing && "letterSpacing" in c) c.letterSpacing = s(opts.spacing) + "px";
          c.fillText(str, 0, 0);
        });
      },
      noise(count, size, fn, seed) {
        const r = kit.rng(seed || 7);
        for (let i = 0; i < count; i++) {
          const p = fn(r), x = r() * o.w - o.w / 2, z = r() * o.h - o.h / 2, sz = p.size || size;
          paint(p, c => c.fillRect(px(x), pz(z), Math.max(1, s(sz * (p.sx || 1))), Math.max(1, s(sz * (p.sz || 1)))));
        }
      },
      material(m = {}) {
        const map = tex(C.color, true), rmMap = tex(C.rm, false);
        const normalMap = tex(normalFromHeight(C.height, m.normal != null ? m.normal : 3), false);
        const mat = new THREE.MeshStandardMaterial(Object.assign({ map, normalMap, roughnessMap: rmMap, metalnessMap: rmMap, roughness: 1, metalness: 1 }, m.mat));
        if (m.fit) for (const t of [map, rmMap, normalMap]) { t.repeat.set(1 / o.w, 1 / o.h); t.offset.set(.5, .5); }
        return mat;
      }
    };
    return S;
  };

  const MASKS = {
    green: ["#0f4a2b", "#1e7046"], black: ["#121417", "#262a30"], blue: ["#0f2c55", "#1f4f8c"],
    brown: ["#3a2a18", "#5c4428"], red: ["#6b1414", "#8e2626"], white: ["#dfe0dc", "#f2f2ee"]
  };
  kit.pcb = function (o) {
    const long = Math.max(o.w, o.d);
    const ppu = o.ppu || Math.min(o.maxPx || 1024, 2048) / long;
    const [mask, maskHi] = MASKS[o.mask || "green"] || [o.mask, o.maskHi || o.mask];
    const fin = o.finish === "tin" ? { color: "#c3c7cc", rough: .3, metal: 1 } : { color: "#d9ad55", rough: .22, metal: 1 };
    const S = kit.surface({ w: o.w, h: o.d, ppu, base: { color: mask, height: .5, rough: o.gloss != null ? 1 - o.gloss : .34, metal: 0 }, underside: o.underside });
    const r = kit.rng(o.seed || 11);
    const tw = o.traceW || Math.max(1.3 / ppu, long * .0022);

    S.noise(Math.round(S.W * S.H / 900), 4 / ppu, rr => ({ color: rr() < .5 ? "#000" : "#fff", alpha: .025, size: (2 + rr() * 5) / ppu }), (o.seed || 11) + 1);

    const clip = c => {
      if (!o.keep || !o.keep.length) return;
      c.beginPath(); c.rect(0, 0, S.W, S.H);
      for (const [x, z, w, d] of o.keep) c.rect(S.px(x - w / 2), S.pz(z - d / 2), S.s(w), S.s(d));
      c.clip("evenodd");
    };
    for (const k of ["color", "height"]) { S.g[k].save(); clip(S.g[k]); }
    const traceP = { color: maskHi, height: .56, alpha: .4 };
    const dirs = [...Array(8)].map((_, k) => [Math.cos(k * Math.PI / 4), Math.sin(k * Math.PI / 4)]);
    function bundle() {
      const n = 1 + Math.floor(r() * 7), gap = tw * (2 + r() * 1.5);
      let x = (r() - .5) * o.w, z = (r() - .5) * o.d, dir = Math.floor(r() * 8);
      const path = [[x, z]];
      const segs = 2 + Math.floor(r() * 4);
      for (let i = 0; i < segs; i++) {
        const L = long * (.03 + r() * .22);
        x += dirs[dir][0] * L; z += dirs[dir][1] * L; path.push([x, z]);
        dir = (dir + (r() < .5 ? 1 : 7)) % 8;
      }
      for (let i = 0; i < n; i++) {
        const off = (i - (n - 1) / 2) * gap;
        const pts = path.map((p, k) => {
          const a = path[Math.max(0, k - 1)], b = path[Math.min(path.length - 1, k + 1)];
          const n1 = normal2(path[k === 0 ? 0 : k - 1], path[k === 0 ? 1 : k]);
          const n2 = normal2(path[k === path.length - 1 ? k - 1 : k], path[k === path.length - 1 ? k : k + 1]);
          let mx = n1[0] + n2[0], mz = n1[1] + n2[1]; const ml = Math.hypot(mx, mz) || 1; mx /= ml; mz /= ml;
          const f = off / Math.max(.5, mx * n1[0] + mz * n1[1]);
          void a; void b;
          return [p[0] + mx * f, p[1] + mz * f];
        });
        S.line(pts, tw, traceP);
      }
      if (r() < .6) for (let i = 0; i < n; i++) { const e = path[path.length - 1]; P.via(e[0] + (i - (n - 1) / 2) * gap * 1.6, e[1] + (r() - .5) * gap, tw * 1.6); }
    }
    function normal2(a, b) { const dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz) || 1; return [-dz / l, dx / l]; }

    const silkP = { color: o.silk || "#e9ebe6", height: .54, rough: .7, metal: 0 };
    const padP = Object.assign({ height: .57 }, fin);
    const P = Object.assign(S, {
      fin, silkP, padP, traceP, mask, maskHi, traceW: tw,
      pad(x, z, w, d, rad) { S.rect(x, z, w, d, padP, rad); },
      padGrid(x, z, cols, rows, pitchX, pitchZ, w, d, skip) {
        for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
          const px = x + (i - (cols - 1) / 2) * pitchX, pz = z + (j - (rows - 1) / 2) * pitchZ;
          if (!skip || !skip(px, pz, i, j)) S.rect(px, pz, w, d, padP, Math.min(w, d) * .2);
        }
      },
      via(x, z, rad, open) {
        rad = rad || tw * 1.6;
        if (open) { S.circle(x, z, rad, padP); S.circle(x, z, rad * .45, { color: "#0c0d0e", height: .3, rough: .9, metal: 0 }); }
        else { S.circle(x, z, rad, { color: maskHi, height: .6, alpha: .9 }); S.circle(x, z, rad * .4, { color: "#000", height: .48, alpha: .35 }); }
      },
      hole(x, z, rad, ring) {
        S.circle(x, z, rad + (ring || rad * .6), padP);
        for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4, rr = rad + (ring || rad * .6) * .55; S.circle(x + Math.cos(a) * rr, z + Math.sin(a) * rr, (ring || rad * .6) * .16, { color: "#101112", height: .45, alpha: .8 }); }
        S.circle(x, z, rad, { color: "#060708", height: .2, rough: .95, metal: 0 });
      },
      trace(pts, width) { S.line(pts, width || tw, traceP); },
      silk(fn) { fn(silkP); },
      ref(str, x, z, size, rot) { S.text(str, x, z, size, silkP, { rot, weight: 600 }); },
      outline(x, z, w, d, lw, corner) {
        lw = lw || Math.max(1.6 / ppu, long * .0012);
        S.strokeRect(x, z, w, d, lw, silkP);
        if (corner) S.circle(x - w / 2 - lw * 3, z - d / 2 - lw * 3, lw * 1.4, silkP);
      },
      fiducial(x, z, rad) { S.circle(x, z, rad * 2.2, { color: mask, height: .5, alpha: .9 }); S.circle(x, z, rad * 2.2, { color: "#000", alpha: .15 }); S.circle(x, z, rad, padP); }
    });
    for (let i = 0; i < (o.traces != null ? o.traces : 40); i++) bundle();
    for (let i = 0; i < (o.vias != null ? o.vias : 80); i++) P.via((r() - .5) * o.w * .96, (r() - .5) * o.d * .96, tw * (1.4 + r() * .8), r() < .15);
    for (const k of ["color", "height"]) S.g[k].restore();
    if (o.draw) o.draw(P);
    return P;
  };

  kit.shapeRect = function (w, d, r) {
    const W = w / 2, D = d / 2; r = Math.max(0, Math.min(r || 0, W, D));
    const s = new THREE.Shape();
    if (!r) { s.moveTo(-W, -D); s.lineTo(W, -D); s.lineTo(W, D); s.lineTo(-W, D); s.closePath(); return s; }
    s.moveTo(-W + r, -D); s.lineTo(W - r, -D); s.absarc(W - r, -D + r, r, -Math.PI / 2, 0, false);
    s.lineTo(W, D - r); s.absarc(W - r, D - r, r, 0, Math.PI / 2, false); s.lineTo(-W + r, D);
    s.absarc(-W + r, D - r, r, Math.PI / 2, Math.PI, false); s.lineTo(-W, -D + r); s.absarc(-W + r, -D + r, r, Math.PI, Math.PI * 1.5, false);
    return s;
  };
  kit.circlePath = function (x, y, r) { const p = new THREE.Path(); p.absarc(x, y, r, 0, Math.PI * 2, true); return p; };

  kit.extrude = function (shape, h, bevel, curveSegments) {
    const b = bevel != null ? bevel : Math.min(.05, h / 6);
    const depth = Math.max(.001, h - 2 * b);
    const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: b > 0, bevelThickness: b, bevelSize: b, bevelSegments: b > 0 ? 2 : 0, curveSegments: curveSegments || 16 });
    geo.rotateX(-Math.PI / 2); geo.translate(0, -depth / 2, 0);
    const g0 = geo.groups.find(gr => gr.materialIndex === 0);
    if (g0) {
      const half = g0.count / 2;
      geo.groups = geo.groups.filter(gr => gr !== g0).concat([{ start: g0.start + half, count: half, materialIndex: 0 }, { start: g0.start, count: half, materialIndex: 2 }]);
    }
    return geo;
  };

  kit.lathe = function (profile, segs) { return new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), segs || 32); };

  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3();
  function compose(x, y, z, ry, rx, rz, sx, sy, sz) {
    _e.set(rx || 0, ry || 0, rz || 0, "YXZ"); _q.setFromEuler(_e);
    _p.set(x || 0, y || 0, z || 0);
    _s.set(sx != null ? sx : 1, sy != null ? sy : (sx != null ? sx : 1), sz != null ? sz : (sx != null ? sx : 1));
    return _m.compose(_p, _q, _s);
  }

  kit.merge = function (items) {
    const pos = [], nor = [], uv = [];
    for (const [geo, x, y, z, ry, rx, rz, s] of items) {
      const gg = geo.index ? geo.toNonIndexed() : geo.clone();
      gg.applyMatrix4(compose(x, y, z, ry, rx, rz, s));
      const P = gg.attributes.position, N = gg.attributes.normal, U = gg.attributes.uv;
      for (let i = 0; i < P.count; i++) {
        pos.push(P.getX(i), P.getY(i), P.getZ(i));
        nor.push(N.getX(i), N.getY(i), N.getZ(i));
        uv.push(U ? U.getX(i) : 0, U ? U.getY(i) : 0);
      }
      gg.dispose();
    }
    const out = new THREE.BufferGeometry();
    out.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    out.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
    out.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    return out;
  };

  kit.place = function (group, geo, mat, list) {
    const im = new THREE.InstancedMesh(geo, mat, list.length);
    list.forEach((p, k) => im.setMatrixAt(k, compose(...p)));
    im.instanceMatrix.needsUpdate = true;
    return ctx.add(group, im);
  };
  const rot = (ox, oz, ry) => [ox * Math.cos(ry) + oz * Math.sin(ry), -ox * Math.sin(ry) + oz * Math.cos(ry)];

  const std = o => new THREE.MeshStandardMaterial(o);
  function tile(key, size, draw, strength) {
    return once("tile:" + key, () => {
      const c = canvas(size, size); draw(c.getContext("2d"), size, kit.rng(size + key.length));
      return tex(normalFromHeight(c, strength, true), false, [1, 1]);
    });
  }
  const brushed = () => tile("brushed", 512, (g, N, r) => {
    g.fillStyle = gray(.5); g.fillRect(0, 0, N, N);
    for (let i = 0; i < 2600; i++) { g.fillStyle = gray(.35 + r() * .3); g.globalAlpha = .5; const y = r() * N, w = 30 + r() * 300; g.fillRect(r() * N, y, w, 1); g.fillRect(r() * N - N, y, w, 1); }
  }, 1.4);
  const peel = () => tile("peel", 256, (g, N, r) => {
    g.fillStyle = gray(.5); g.fillRect(0, 0, N, N); g.filter = "blur(2px)";
    for (let i = 0; i < 1400; i++) { g.fillStyle = gray(.3 + r() * .4); g.beginPath(); g.arc(r() * N, r() * N, 2 + r() * 5, 0, 7); g.fill(); }
  }, 2);
  const grain = () => tile("grain", 256, (g, N, r) => {
    g.fillStyle = gray(.5); g.fillRect(0, 0, N, N);
    for (let i = 0; i < 9000; i++) { g.fillStyle = gray(.3 + r() * .4); g.fillRect(r() * N, r() * N, 1, 1); }
  }, 1.2);
  const M = (name, make) => () => once("mat:" + name, make);
  kit.tiles = { brushed, peel, grain };
  kit.mat = {
    gold: M("gold", () => std({ color: 0xe8bd62, metalness: 1, roughness: .2 })),
    tin: M("tin", () => std({ color: 0xc9cdd2, metalness: 1, roughness: .32 })),
    copper: M("copper", () => std({ color: 0xd07a4a, metalness: 1, roughness: .26 })),
    nickel: M("nickel", () => std({ color: 0xc4c6c8, metalness: 1, roughness: .2 })),
    steel: M("steel", () => std({ color: 0xaeb3b9, metalness: 1, roughness: .36, normalMap: grain(), normalScale: new THREE.Vector2(.3, .3) })),
    chrome: M("chrome", () => std({ color: 0xe6e8ea, metalness: 1, roughness: .08 })),
    alu: M("alu", () => std({ color: 0xc8ccd1, metalness: 1, roughness: .34, normalMap: brushed(), normalScale: new THREE.Vector2(.35, .35) })),
    aluDark: M("aluDark", () => std({ color: 0x4a4e55, metalness: .85, roughness: .38, normalMap: brushed(), normalScale: new THREE.Vector2(.25, .25) })),
    blackMetal: M("blackMetal", () => std({ color: 0x1d1f23, metalness: .7, roughness: .42, normalMap: brushed(), normalScale: new THREE.Vector2(.2, .2) })),
    powder: M("powder", () => std({ color: 0x1a1c1f, metalness: .25, roughness: .62, normalMap: peel(), normalScale: new THREE.Vector2(.25, .25) })),
    plastic: M("plastic", () => std({ color: 0x141518, metalness: 0, roughness: .55, normalMap: grain(), normalScale: new THREE.Vector2(.15, .15) })),
    plasticGrey: M("plasticGrey", () => std({ color: 0x3a3d42, metalness: 0, roughness: .6, normalMap: grain(), normalScale: new THREE.Vector2(.15, .15) })),
    whitePlastic: M("whitePlastic", () => std({ color: 0xe6e3da, metalness: 0, roughness: .5 })),
    rubber: M("rubber", () => std({ color: 0x0e0f10, metalness: 0, roughness: .92 })),
    ferrite: M("ferrite", () => std({ color: 0x3c3e42, metalness: .15, roughness: .72, normalMap: grain(), normalScale: new THREE.Vector2(.35, .35) })),
    epoxy: M("epoxy", () => std({ color: 0x18191c, metalness: 0, roughness: .72, normalMap: grain(), normalScale: new THREE.Vector2(.12, .12) })),
    ceramic: M("ceramic", () => std({ color: 0x9a7a55, metalness: 0, roughness: .55 })),
    glass: M("glass", () => std({ color: 0xdfe8ee, metalness: 0, roughness: .05, transparent: true, opacity: .3, depthWrite: false })),
    fr4: M("fr4", () => std({ color: 0x5f5a36, metalness: 0, roughness: .8 }))
  };

  kit.board = function (group, o) {
    const shape = o.shape || kit.shapeRect(o.w, o.d, o.r || 0);
    for (const [x, z, r] of o.holes || []) shape.holes.push(kit.circlePath(x, -z, r));
    const geo = kit.extrude(shape, o.t, o.bevel != null ? o.bevel : Math.min(.04, o.t / 8));
    const edge = o.edgeMat || std({ color: o.edge || 0x4b4a2c, roughness: .78 });
    return ctx.add(group, geo, [o.top, edge, o.bottom || o.top], o.x, o.y, o.z);
  };

  kit.mlcc = function (group, list, o = {}) {
    const l = o.l || 1, w = o.w || l * .5, h = o.h || w, e = l * .22;
    const bodyGeo = once(`mlccB${l},${w},${h}`, () => new THREE.BoxGeometry(l - 2 * e + .001, h * .94, w * .94));
    const endGeo = once(`mlccE${l},${w},${h}`, () => new THREE.BoxGeometry(e, h, w));
    const body = o.color ? std({ color: o.color, roughness: .55 }) : kit.mat.ceramic();
    kit.place(group, bodyGeo, body, list.map(([x, y, z, ry = 0]) => [x, y + h / 2, z, ry]));
    const ends = [];
    list.forEach(([x, y, z, ry = 0]) => [-1, 1].forEach(sd => { const [ox, oz] = rot(sd * (l / 2 - e / 2), 0, ry); ends.push([x + ox, y + h / 2, z + oz, ry]); }));
    return kit.place(group, endGeo, kit.mat.tin(), ends);
  };

  kit.resistor = function (group, list, o = {}) {
    const l = o.l || 1, w = o.w || l * .5, h = o.h || w * .7, e = l * .18;
    const bodyGeo = once(`resB${l},${w},${h}`, () => new THREE.BoxGeometry(l - 2 * e + .001, h * .92, w * .96));
    const white = once("mat:resW", () => std({ color: 0xd9d6cc, roughness: .6 })), black = once("mat:resK", () => std({ color: 0x151515, roughness: .5 }));
    kit.place(group, bodyGeo, [white, white, black, white, white, white], list.map(([x, y, z, ry = 0]) => [x, y + h / 2, z, ry]));
    const endGeo = once(`resE${l},${w},${h}`, () => new THREE.BoxGeometry(e, h, w));
    const ends = [];
    list.forEach(([x, y, z, ry = 0]) => [-1, 1].forEach(sd => { const [ox, oz] = rot(sd * (l / 2 - e / 2), 0, ry); ends.push([x + ox, y + h / 2, z + oz, ry]); }));
    return kit.place(group, endGeo, kit.mat.tin(), ends);
  };

  kit.marking = function (w, d, o = {}) {
    const key = `mark:${w},${d},${(o.lines || []).join("|")},${o.color},${o.pin1},${o.logo}`;
    return once(key, () => {
      const ppu = Math.min(64, 512 / Math.max(w, d));
      const S = kit.surface({ w, h: d, ppu, base: { color: o.color || "#1a1b1e", height: .5, rough: o.rough || .7, metal: 0 } });
      S.noise(Math.round(S.W * S.H / 60), 1 / ppu, r => ({ color: r() < .5 ? "#000" : "#fff", alpha: .035 }));
      const ink = { color: o.ink || "#56595e", rough: .9, height: .47, alpha: .9 };
      const lines = o.lines || [], n = lines.length + (o.logo ? 1.3 : 0);
      const size = o.size || Math.min(d * .34 / Math.max(2, n), w * .7 / Math.max(6, ...lines.map(l => l.length)));
      const rows = (o.logo ? [[o.logo, 1.3, 800]] : []).concat(lines.map(l => [l, 1, 600]));
      let zc = -rows.reduce((a, r) => a + r[1] * size * 1.6, 0) / 2;
      rows.forEach(([l, k, wgt]) => { zc += k * size * .8; S.text(l, 0, zc, size * k, ink, { weight: wgt, font: o.font }); zc += k * size * .8; });
      if (o.pin1 !== false) S.circle(-w / 2 + Math.min(w, d) * .12, d / 2 - Math.min(w, d) * .12, Math.min(w, d) * .045, { color: "#0e0f10", height: .38, rough: .35 });
      return S.material({ normal: 2 });
    });
  };

  kit.ic = function (group, o) {
    const g = new THREE.Group(); g.position.set(o.x || 0, o.y || 0, o.z || 0); g.rotation.y = o.ry || 0;
    const w = o.w, d = o.d, h = o.h || Math.min(w, d) * .12, pkg = o.pkg || "qfn", m = Math.min(w, d);
    let y0 = 0, inset = 1;
    if (pkg === "bga") {
      const sub = new THREE.Mesh(ctx.roundBox(w, h * .22, d, m * .02, h * .03), std({ color: o.subColor || 0x2d3b2a, roughness: .5 }));
      sub.position.y = h * .06 + h * .11; g.add(sub); y0 = h * .39; inset = .97;
    } else if (pkg === "qfp" || pkg === "sop") y0 = h * .1;
    const bh = h - y0;
    const body = new THREE.Mesh(ctx.roundBox(w * inset, bh, d * inset, m * .03, Math.min(bh * .2, .06 * m)), o.bodyMat || kit.mat.epoxy());
    body.position.y = y0 + bh / 2; g.add(body);
    const top = new THREE.Mesh(new THREE.PlaneGeometry(w * .96 * inset, d * .96 * inset), kit.marking(w, d, o));
    top.rotation.x = -Math.PI / 2; top.position.y = h + .004; top.userData.noCast = true; g.add(top);
    if (pkg === "qfp" || pkg === "sop" || pkg === "qfn") {
      const n = o.leads || Math.max(4, Math.round(Math.max(w, d) / (m * .08)));
      const pitch = o.pitch || (Math.min(w, d) * .8) / n, lw = pitch * .5;
      let leadGeo;
      if (pkg === "qfn") leadGeo = new THREE.BoxGeometry(lw, h * .14, m * .06);
      else {
        const t = Math.max(.02, h * .07), reach = m * .09, yExit = y0 + bh * .42;
        const pts = [[0, yExit], [reach * .3, yExit], [reach * .55, t / 2], [reach, t / 2]];
        const sh = new THREE.Shape();
        pts.forEach(([x, y], i) => i ? sh.lineTo(x, y + t / 2) : sh.moveTo(x, y + t / 2));
        [...pts].reverse().forEach(([x, y]) => sh.lineTo(x, y - t / 2));
        leadGeo = new THREE.ExtrudeGeometry(sh, { depth: lw, bevelEnabled: false });
        leadGeo.translate(0, 0, -lw / 2);
      }
      const list = [], sides = pkg === "sop" ? [[0, 1], [0, -1]] : [[0, 1], [0, -1], [1, 0], [-1, 0]];
      for (const [sx, sz] of sides) {
        const along = sx ? d : w, cnt = pkg === "sop" ? n : Math.max(3, Math.round(n * along / Math.max(w, d)));
        for (let i = 0; i < cnt; i++) {
          const a = (i - (cnt - 1) / 2) * pitch;
          if (pkg === "qfn") list.push(sx ? [sx * (w / 2 + .001), h * .07, a, Math.PI / 2] : [a, h * .07, sz * (d / 2 + .001), 0]);
          else list.push(sx ? [sx * w / 2 * .98, 0, a, sx > 0 ? 0 : Math.PI] : [a, 0, sz * d / 2 * .98, sz > 0 ? -Math.PI / 2 : Math.PI / 2]);
        }
      }
      const im = new THREE.InstancedMesh(leadGeo, kit.mat.tin(), list.length);
      list.forEach((p, k) => im.setMatrixAt(k, compose(...p)));
      g.add(im);
    }
    return ctx.add(group, g);
  };

  kit.choke = function (group, list, o = {}) {
    const w = o.w || 1, d = o.d || w, h = o.h || w * .6;
    const bodyGeo = once(`chokeB${w},${d},${h}`, () => ctx.roundBox(w, h, d, Math.min(w, d) * .08, Math.min(h * .12, w * .05)));
    kit.place(group, bodyGeo, o.mat || kit.mat.ferrite(), list.map(([x, y, z, ry = 0]) => [x, y + h / 2, z, ry]));
    const markMat = once(`chokeM${o.text || "R22"}${w}${d}`, () => {
      const ppu = 256 / Math.max(w, d);
      const S = kit.surface({ w, h: d, ppu, base: { color: "#3a3c40", rough: .72, metal: .12, height: .5 } });
      S.noise(1600, 1 / ppu, r => ({ color: r() < .5 ? "#000" : "#fff", alpha: .05 }));
      S.text(o.text || "R22", 0, 0, Math.min(w, d) * .15, { color: "#b4b7bc", rough: .8, height: .52, alpha: .7 }, { weight: 700 });
      const m = S.material({ normal: 2 }); m.transparent = false; return m;
    });
    const top = once(`chokeT${w},${d}`, () => { const p = new THREE.PlaneGeometry(w * .9, d * .9); p.rotateX(-Math.PI / 2); return p; });
    const im = kit.place(group, top, markMat, list.map(([x, y, z, ry = 0]) => [x, y + h + .004, z, ry]));
    im.userData.noCast = true;
    const termGeo = once(`chokeF${w},${d},${h}`, () => new THREE.BoxGeometry(w * .1, h * .1, d * .55));
    const feet = [];
    list.forEach(([x, y, z, ry = 0]) => [-1, 1].forEach(sd => { const [ox, oz] = rot(sd * (w / 2 + w * .02), 0, ry); feet.push([x + ox, y + h * .05, z + oz, ry]); }));
    kit.place(group, termGeo, kit.mat.tin(), feet);
    return im;
  };

  kit.polycap = function (group, list, o = {}) {
    const r = o.r || .5, h = o.h || r * 2.2;
    const can = once(`pcapC${r},${h}`, () => kit.lathe([[0, 0], [r * .92, 0], [r * .92, h * .06], [r, h * .08], [r, h * .9], [r * .97, h * .97], [r * .88, h], [0, h]], 28));
    kit.place(group, can, kit.mat.alu(), list.map(([x, y, z, ry = 0]) => [x, y + h * .06, z, ry]));
    const base = once(`pcapB${r}`, () => new THREE.CylinderGeometry(r * 1.02, r * 1.02, h * .08, 24));
    kit.place(group, base, kit.mat.rubber(), list.map(([x, y, z]) => [x, y + h * .04, z]));
    const topMat = once(`pcapT${o.band || "#5b3f8f"}`, () => {
      const S = kit.surface({ w: 2, h: 2, ppu: 128, base: { color: "#b9bdc2", rough: .3, metal: 1, height: .5 } });
      S.ring(0, 0, .62, 1, { color: o.band || "#5b3f8f", rough: .45, metal: .2 });
      S.line([[-.55, 0], [.55, 0]], .07, { height: .3, color: "#8b8f94" }); S.line([[0, -.55], [0, .55]], .07, { height: .3, color: "#8b8f94" });
      S.text(o.text || "560", 0, -.34, .18, { color: "#e8e8ea", alpha: .8 }, { weight: 700 });
      return S.material({ normal: 3, mat: { transparent: true, alphaTest: .5 } });
    });
    const disc = once("pcapD", () => { const c = new THREE.CircleGeometry(1, 28); c.rotateX(-Math.PI / 2); return c; });
    const im = kit.place(group, disc, topMat, list.map(([x, y, z, ry = 0]) => [x, y + h * 1.06 + .003, z, ry, 0, 0, r * .88]));
    im.userData.noCast = true;
    return im;
  };

  kit.elcap = function (group, o) {
    const r = o.r, h = o.h, g = new THREE.Group(); g.position.set(o.x || 0, o.y || 0, o.z || 0); g.rotation.y = o.ry || 0;
    const sleeveMat = once(`elcapS${o.sleeve}${o.text}${o.ink}${o.stripe}`, () => {
      const W = 1024, H = 512, c = canvas(W, H), x = c.getContext("2d");
      x.fillStyle = o.sleeve || "#1b1c20"; x.fillRect(0, 0, W, H);
      x.fillStyle = o.stripe || "#8e939a"; x.fillRect(W * .72, 0, W * .14, H);
      x.fillStyle = "#1b1c20"; x.font = `800 ${H * .09}px Arial`; x.textAlign = "center";
      for (let k = 0; k < 6; k++) x.fillText("−", W * .79, H * (.12 + k * .16));
      x.fillStyle = o.ink || "#d9c27a"; x.font = `700 ${H * .1}px 'IBM Plex Sans', Arial`;
      (o.text || ["450V", "330µF", "105°C"]).forEach((t, k) => { x.save(); x.translate(W * (.2 + k * .16), H * .5); x.rotate(-Math.PI / 2); x.fillText(t, 0, H * .03); x.restore(); });
      x.fillStyle = "rgba(255,255,255,.06)"; x.fillRect(0, H * .08, W, H * .02); x.fillRect(0, H * .9, W, H * .02);
      return std({ map: tex(c, true), roughness: .35, metalness: 0 });
    });
    const body = new THREE.Mesh(kit.lathe([[r * .98, 0], [r, h * .02], [r, h * .93], [r * .93, h * .95], [r * .95, h * .98], [r * .9, h]], 40), sleeveMat);
    g.add(body);
    const topMat = once(`elcapT${o.top || "k"}`, () => {
      const S = kit.surface({ w: 2, h: 2, ppu: 128, base: { color: "#c3c7cc", rough: .28, metal: 1, height: .5 } });
      S.noise(900, .01, rr => ({ color: rr() < .5 ? "#000" : "#fff", alpha: .06 }));
      const groove = { height: .25, color: "#9a9ea4" };
      if (o.top === "k") { S.line([[-.5, -.5], [-.5, .5]], .06, groove); S.line([[-.5, 0], [.4, -.55]], .06, groove); S.line([[-.5, 0], [.4, .55]], .06, groove); }
      else { S.line([[-.6, 0], [.6, 0]], .06, groove); S.line([[0, -.6], [0, .6]], .06, groove); }
      return S.material({ normal: 4, mat: { transparent: true, alphaTest: .5 } });
    });
    const top = new THREE.Mesh(new THREE.CircleGeometry(r * .9, 40), topMat);
    top.rotation.x = -Math.PI / 2; top.position.y = h - .002; g.add(top);
    return ctx.add(group, g);
  };

  kit.crystal = function (group, list, o = {}) {
    const l = o.l || 1, w = o.w || l * .4, h = o.h || w * .9;
    const can = once(`xtal${l},${w},${h}`, () => ctx.roundBox(l, h, w, w * .45, h * .15));
    return kit.place(group, can, kit.mat.nickel(), list.map(([x, y, z, ry = 0]) => [x, y + h / 2, z, ry]));
  };

  kit.screw = function (group, list, o = {}) {
    const r = o.r || .5, h = o.h || r * .6;
    const head = once(`screwH${r},${h}`, () => kit.lathe([[0, 0], [r, 0], [r, h * .35], [r * .88, h * .8], [r * .6, h * .98], [0, h]], 24));
    const mat = o.mat || kit.mat.steel();
    kit.place(group, head, mat, list.map(([x, y, z, ry = 0, rx = 0, rz = 0]) => [x, y, z, ry, rx, rz]));
    const cross = once("screwX", () => {
      const c = canvas(128, 128), x = c.getContext("2d");
      x.fillStyle = "#000"; x.fillRect(0, 0, 128, 128);
      x.fillStyle = "#fff"; x.fillRect(54, 16, 20, 96); x.fillRect(16, 54, 96, 20);
      const a = tex(c, false);
      return std({ color: 0x07080a, roughness: .9, alphaMap: a, transparent: true, depthWrite: false });
    });
    const plane = once(`screwP${r}`, () => { const p = new THREE.PlaneGeometry(r * 1.1, r * 1.1); p.rotateX(-Math.PI / 2); return p; });
    const im = new THREE.InstancedMesh(plane, cross, list.length);
    list.forEach(([x, y, z, ry = 0, rx = 0, rz = 0], k) => {
      const m = compose(x, y, z, ry + Math.PI / 5, rx, rz).clone();
      m.multiply(new THREE.Matrix4().makeTranslation(0, h + .004, 0));
      im.setMatrixAt(k, m);
    });
    im.userData.noCast = true;
    return ctx.add(group, im);
  };

  kit.header = function (group, o) {
    const g = new THREE.Group(); g.position.set(o.x || 0, o.y || 0, o.z || 0); g.rotation.y = o.ry || 0;
    const p = o.pitch || 1, cols = o.cols || 1, rows = o.rows || 1, h = o.h || p * 3.4, bh = p * 1;
    const base = new THREE.Mesh(ctx.roundBox(cols * p, bh, rows * p, p * .06, p * .04), o.baseMat || kit.mat.plastic());
    base.position.y = bh / 2; g.add(base);
    const pinGeo = new THREE.BoxGeometry(p * .25, h, p * .25), list = [];
    for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) if (!o.skip || !o.skip(i, j)) list.push([(i - (cols - 1) / 2) * p, h / 2, (j - (rows - 1) / 2) * p]);
    const im = new THREE.InstancedMesh(pinGeo, o.pinMat || kit.mat.gold(), list.length);
    list.forEach((q, k) => im.setMatrixAt(k, compose(...q)));
    g.add(im);
    if (o.shroud) {
      const sh = o.shroudMat || kit.mat.plastic(), t = p * .22, W = cols * p + p * .9, D = rows * p + p * .9, H = h * .95;
      [[0, D / 2 - t / 2, W, t], [0, -D / 2 + t / 2, W, t]].forEach(([x, z, w, d]) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, H, d), sh); m.position.set(x, H / 2, z); g.add(m); });
      [[W / 2 - t / 2, 0], [-W / 2 + t / 2, 0]].forEach(([x, z]) => { const m = new THREE.Mesh(new THREE.BoxGeometry(t, H, D), sh); m.position.set(x, H / 2, z); g.add(m); });
    }
    return ctx.add(group, g);
  };

  kit.fingers = function (group, o) {
    const n = o.n, p = o.pitch, w = o.w || p * .7, len = o.len, t = o.t || .03;
    const geo = new THREE.BoxGeometry(o.axis === "z" ? len : w, t, o.axis === "z" ? w : len);
    const list = [];
    for (let i = 0; i < n; i++) {
      if (o.skip && o.skip(i)) continue;
      const a = (i - (n - 1) / 2) * p;
      const x = o.axis === "z" ? (o.x || 0) : (o.x || 0) + a, z = o.axis === "z" ? (o.z || 0) + a : (o.z || 0);
      list.push([x, o.ty != null ? o.ty : (o.y || 0) + t / 2, z]);
      if (o.both) list.push([x, o.by != null ? o.by : (o.y || 0) - t / 2, z]);
    }
    const im = kit.place(group, geo, o.mat || kit.mat.gold(), list);
    im.userData.noCast = true;
    return im;
  };

  kit.fins = function (group, o) {
    const geo = o.axis === "z" ? new THREE.BoxGeometry(o.w, o.h, o.t) : new THREE.BoxGeometry(o.t, o.h, o.w);
    const list = [];
    for (let i = 0; i < o.n; i++) {
      const a = (i - (o.n - 1) / 2) * o.pitch;
      list.push(o.axis === "z" ? [o.x || 0, o.y || 0, (o.z || 0) + a] : [(o.x || 0) + a, o.y || 0, o.z || 0]);
    }
    return kit.place(group, o.geo || geo, o.mat || kit.mat.alu(), list);
  };

  kit.pipe = function (group, pts, r, mat, tension) {
    const curve = new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(...p)), false, "catmullrom", tension != null ? tension : .08);
    return ctx.add(group, new THREE.TubeGeometry(curve, Math.max(24, pts.length * 20), r, 14, false), mat || kit.mat.nickel());
  };

  kit.sticker = function (group, o) {
    const ppu = o.ppu || Math.min(96, 1024 / Math.max(o.w, o.d));
    const S = kit.surface({ w: o.w, h: o.d, ppu, base: { color: o.color || "#f1f0ea", rough: o.rough || .55, metal: o.metal || 0, height: .5 } });
    if (o.draw) o.draw(S);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(o.w, o.d), S.material({ normal: 2 }));
    m.rotation.x = -Math.PI / 2; m.rotation.z = o.ry || 0;
    m.position.set(o.x || 0, (o.y || 0) + .006, o.z || 0);
    m.userData.noCast = true;
    return ctx.add(group, m);
  };

  return kit;
};
