window.Internals = window.Internals || {};

Internals.viewer3d = function (root, cfg) {
  const { t, onChange, bind } = Internals.i18n;
  const tagLayer = root.querySelector(".tags");
  const card = root.parentElement.querySelector(".partcard");
  const slider = root.querySelector("input.explode");
  const flipBtn = root.querySelector("button.flip");
  const resetBtn = root.querySelector("button.resetview");
  const zoomIn = root.querySelector("button.zoomin"), zoomOut = root.querySelector("button.zoomout");
  const colors = Object.fromEntries(cfg.parts.map(p => [p.id, p.color]));
  const key = (id, s) => cfg.prefix + "." + id + (s ? "." + s : "");

  let cardId = cfg.initial;
  function showCard(id) {
    cardId = id;
    card.querySelector(".swatch").style.background = colors[id];
    card.querySelector("h3").textContent = t(key(id));
    card.querySelector("p").textContent = t(key(id, "blurb"));
    card.querySelector(".fact").textContent = t(key(id, "fact"));
  }
  showCard(cfg.initial);
  onChange(() => showCard(cardId));

  let live = null, releaseTimer = 0;
  new IntersectionObserver(es => {
    const on = es[0].isIntersecting;
    clearTimeout(releaseTimer);
    if (on && !live) live = start();
    if (live) live.visible = on;
    const hidden = () => root.offsetParent === null;
    if (!on && live && hidden()) releaseTimer = setTimeout(() => { if (live && hidden()) { live.destroy(); live = null; } }, 20000);
  }).observe(root);

  function start() {
    const canvas = root.querySelector("canvas");
    const state = { visible: true, destroy: null };
    const offs = [];
    const on = (el, type, fn, opts) => { if (!el) return; el.addEventListener(type, fn, opts); offs.push(() => el.removeEventListener(type, fn, opts)); };
    let renderer;
    try {
      if (!window.THREE) throw new Error("three.js missing");
      renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    } catch (e) {
      root.querySelector(".viewer-fallback").hidden = false;
      root.querySelector(".viewer-hint").hidden = true;
      return null;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(32, 1, 2, 800);

    const env = new THREE.Scene(), box = new THREE.BoxGeometry();
    const room = new THREE.Mesh(box, new THREE.MeshStandardMaterial({ side: THREE.BackSide, color: 0x23272d }));
    room.position.set(-0.757, 13.219, 0.717); room.scale.set(31.713, 28.305, 28.591); env.add(room);
    const envLight = new THREE.PointLight(0xffffff, 5, 28, 2); envLight.position.set(0.418, 16.199, 0.3); env.add(envLight);
    const propMat = new THREE.MeshStandardMaterial({ color: 0x30353c });
    [[-10.906, 2.009, 1.846, -0.195, 2.328, 7.905, 4.651], [-5.607, -0.754, -0.758, 0.994, 1.97, 1.534, 3.955], [6.167, 0.857, 7.803, 0.561, 3.927, 6.285, 3.687],
     [-2.017, 0.018, 6.124, 0.333, 2.002, 4.566, 2.064], [2.291, -0.756, -2.621, -0.286, 1.546, 1.552, 1.496], [-2.193, -0.369, -5.547, 0.516, 3.875, 3.487, 2.986]]
      .forEach(([x, y, z, r, sx, sy, sz]) => { const m = new THREE.Mesh(box, propMat); m.position.set(x, y, z); m.rotation.y = r; m.scale.set(sx, sy, sz); env.add(m); });
    [[50, 0xfff1e0, -16.116, 14.37, 8.208, .1, 2.428, 2.739], [50, 0xffffff, -16.109, 18.021, -8.207, .1, 2.425, 2.751], [17, 0xdff4ff, 14.904, 12.198, -1.832, .15, 4.265, 6.331],
     [43, 0xffffff, -0.462, 8.89, 14.52, 4.38, 5.441, .088], [20, 0xe6f6ff, 3.235, 11.486, -12.541, 2.5, 2, .1], [100, 0xffffff, 0, 20, 0, 1, .1, 1]]
      .forEach(([k, c, x, y, z, sx, sy, sz]) => {
        const mat = new THREE.MeshBasicMaterial({ color: c }); mat.color.multiplyScalar(k * .3);
        const m = new THREE.Mesh(box, mat); m.position.set(x, y, z); m.scale.set(sx, sy, sz); env.add(m);
      });
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(env, 0.035).texture;
    pmrem.dispose();

    scene.add(new THREE.HemisphereLight(0xdfeeff, 0x241a12, 0.25));
    const keyL = new THREE.DirectionalLight(0xfff0e0, 1.5); keyL.position.set(-20, 40, 25);
    keyL.castShadow = true; keyL.shadow.mapSize.set(2048, 2048); keyL.shadow.bias = -0.0004; keyL.shadow.normalBias = 0.03; keyL.shadow.radius = 3;
    scene.add(keyL); scene.add(keyL.target);
    const rim = new THREE.DirectionalLight(0x8fdcf0, 0.55); rim.position.set(30, 10, -30); scene.add(rim);

    const model = new THREE.Group(); scene.add(model);
    const parts = {}; const pickables = [];
    const own = (id, mat) => {
      const p = parts[id];
      if (mat.userData.owner === id) return mat;
      let c = p.clones.get(mat);
      if (!c) {
        c = mat.clone(); c.userData.owner = id; p.clones.set(mat, c); p.mats.push(c);
        if (c.color) c.color.convertSRGBToLinear();
        if (c.emissive) c.emissive.convertSRGBToLinear();
      }
      return c;
    };
    const ctx = {
      THREE, renderer,
      part(id) {
        const g = new THREE.Group(); g.userData.id = id; model.add(g);
        parts[id] = { group: g, mats: [], clones: new Map() }; return g;
      },
      add(group, geo, mat, x, y, z) {
        const m = geo.isMesh || geo.isObject3D ? geo : new THREE.Mesh(geo, mat);
        if (!geo.isObject3D) m.position.set(x || 0, y || 0, z || 0);
        const id = group.userData.id;
        m.traverse(o => {
          if (!o.isMesh) return;
          o.userData.part = id; pickables.push(o);
          o.material = Array.isArray(o.material) ? o.material.map(mm => own(id, mm)) : own(id, o.material);
        });
        group.add(m);
        return m;
      },
      texture(w, h, draw) {
        const c = document.createElement("canvas"); c.width = w; c.height = h;
        draw(c.getContext("2d"), w, h);
        const tx = new THREE.CanvasTexture(c); tx.encoding = THREE.sRGBEncoding; tx.anisotropy = 8; return tx;
      },
      std(o) { return new THREE.MeshStandardMaterial(o); },
      roundBox(w, h, d, r, b) {
        b = b != null ? b : Math.min(.08, h / 4);
        const W = w / 2 - b, D = d / 2 - b, R = Math.max(.01, Math.min(r, W, D));
        const s = new THREE.Shape();
        s.moveTo(-W + R, -D); s.lineTo(W - R, -D); s.quadraticCurveTo(W, -D, W, -D + R);
        s.lineTo(W, D - R); s.quadraticCurveTo(W, D, W - R, D); s.lineTo(-W + R, D);
        s.quadraticCurveTo(-W, D, -W, D - R); s.lineTo(-W, -D + R); s.quadraticCurveTo(-W, -D, -W + R, -D);
        const depth = Math.max(.001, h - 2 * b);
        const geo = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: b > 0, bevelThickness: b, bevelSize: b, bevelSegments: 2, curveSegments: 6 });
        geo.rotateX(-Math.PI / 2); geo.translate(0, -depth / 2, 0);
        return geo;
      },
      decal(group, w, d, mat, x, y, z) {
        const m = ctx.add(group, new THREE.PlaneGeometry(w, d), mat, x, y + .006, z);
        m.rotation.x = -Math.PI / 2;
        return m;
      },
      inst(group, geo, mat, list) {
        const im = new THREE.InstancedMesh(geo, mat, list.length), o = new THREE.Object3D();
        list.forEach((p, k) => { o.position.set(p[0], p[1], p[2]); o.rotation.set(0, p[3] || 0, 0); o.updateMatrix(); im.setMatrixAt(k, o.matrix); });
        return ctx.add(group, im);
      }
    };
    ctx.kit = Internals.kit3d(ctx);
    const t0 = performance.now();
    const built = cfg.build(ctx);
    root._three = { renderer, scene, camera, buildMs: performance.now() - t0 };
    const layout = built.layout;

    model.traverse(o => {
      if (!o.isMesh) return;
      const transparent = [].concat(o.material).some(m => m.transparent);
      o.castShadow = !o.userData.noCast && !transparent;
      o.receiveShadow = true;
    });
    for (const id in layout) {
      const L = layout[id];
      parts[id].group.position.set((L.dx || 0) + (L.x || 0), L.y + (L.dy || 0), (L.dz || 0) + (L.z || 0));
    }
    const bounds = new THREE.Box3().setFromObject(model);
    let radius = 1;
    for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y]) for (const z of [bounds.min.z, bounds.max.z]) radius = Math.max(radius, Math.hypot(x, y, z));
    keyL.position.set(-26, 42, -14).setLength(radius * 2.2);
    Object.assign(keyL.shadow.camera, { left: -radius, right: radius, top: radius, bottom: -radius, near: radius * .2, far: radius * 4.4 });
    keyL.shadow.camera.updateProjectionMatrix();
    const anchors = {};
    for (const id in built.anchors) anchors[id] = new THREE.Vector3(...built.anchors[id]);
    const hideClosed = built.hideWhenClosed || [];

    const tags = {};
    cfg.parts.forEach(p => {
      const b = document.createElement("button");
      b.type = "button"; b.className = "tag"; b.style.setProperty("--dot", p.color);
      b.appendChild(document.createElement("i"));
      bind(b.appendChild(document.createElement("span")), key(p.id));
      b.addEventListener("click", () => select(p.id));
      tagLayer.appendChild(b); tags[p.id] = b;
    });

    const baseEmissive = new Map(), warm = new THREE.Color(0x3a1d08), tmpC = new THREE.Color();
    let selected = null, glow = 0, shownGlow = -1;
    function applyGlow() {
      shownGlow = glow;
      for (const k in parts) for (const m of parts[k].mats) {
        if (!m.emissive) continue;
        if (!baseEmissive.has(m)) baseEmissive.set(m, m.emissiveMap ? m.emissiveIntensity : m.emissive.clone());
        const on = k === selected ? glow : 0;
        if (m.emissiveMap) m.emissiveIntensity = baseEmissive.get(m) * (1 + on);
        else m.emissive.copy(tmpC.copy(warm).multiplyScalar(on).add(baseEmissive.get(m)));
      }
    }
    function select(id) {
      showCard(id);
      for (const k in tags) tags[k].classList.toggle("on", k === id);
      selected = id; glow = 1; applyGlow();
    }
    select(cfg.initial);

    const yaw0 = cfg.yaw != null ? cfg.yaw : -0.65;
    const view = { yaw: yaw0, pitch: 0, vy: 0, vp: 0, pitchTarget: null, auto: true };
    const explode0 = cfg.explode != null ? cfg.explode : 0.75;
    let explodeTarget = slider.value / 100, explode = explodeTarget;
    on(slider, "input", () => { explodeTarget = slider.value / 100; });

    const cam = { zoom: 1, zoomNow: 1, pan: new THREE.Vector2(), panNow: new THREE.Vector2() };
    const setZoom = z => { cam.zoom = Math.max(0.3, Math.min(1.3, z)); };
    const pointers = new Map();
    let dragging = false, panning = false, lastX = 0, lastY = 0, moved = 0, pinch = null;
    function panBy(dx, dy) {
      const k = baseDist * cam.zoom / Math.max(1, H) * 0.85;
      cam.pan.x = Math.max(-baseDist * .4, Math.min(baseDist * .4, cam.pan.x - dx * k));
      cam.pan.y = Math.max(-baseDist * .3, Math.min(baseDist * .3, cam.pan.y + dy * k));
    }
    const pinchInfo = () => {
      const [a, b] = [...pointers.values()];
      return { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    };
    on(canvas, "contextmenu", e => e.preventDefault());
    on(canvas, "pointerdown", e => {
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      canvas.setPointerCapture(e.pointerId);
      view.auto = false; view.pitchTarget = null;
      if (pointers.size === 2) { dragging = false; pinch = Object.assign(pinchInfo(), { zoom: cam.zoom }); return; }
      dragging = true; panning = e.button === 2 || e.shiftKey; moved = 0; lastX = e.clientX; lastY = e.clientY;
    });
    on(canvas, "pointermove", e => {
      if (!pointers.has(e.pointerId)) return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pinch && pointers.size === 2) {
        const p = pinchInfo();
        setZoom(pinch.zoom * pinch.d / p.d); panBy(p.x - pinch.x, p.y - pinch.y); pinch.x = p.x; pinch.y = p.y;
        return;
      }
      if (!dragging) return;
      const dx = e.clientX - lastX, dy = e.clientY - lastY; lastX = e.clientX; lastY = e.clientY; moved += Math.abs(dx) + Math.abs(dy);
      if (panning) { panBy(dx, dy); return; }
      view.vy = dx * 0.008; view.vp = dy * 0.008; view.yaw += view.vy; view.pitch += view.vp;
    });
    const release = e => {
      pointers.delete(e.pointerId);
      if (pinch) { if (pointers.size < 2) pinch = null; dragging = false; return; }
      if (!dragging) return;
      dragging = false;
      if (e.type === "pointerup" && moved < 6 && !panning) pick(e);
    };
    on(canvas, "pointerup", release);
    on(canvas, "pointercancel", release);
    on(canvas, "wheel", e => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault(); setZoom(cam.zoom * Math.exp(e.deltaY * 0.01));
    }, { passive: false });
    on(zoomIn, "click", () => setZoom(cam.zoom / 1.4));
    on(zoomOut, "click", () => setZoom(cam.zoom * 1.4));

    const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
    function pick(e) {
      const r = canvas.getBoundingClientRect();
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      const hit = ray.intersectObjects(pickables, false)[0];
      if (hit) select(hit.object.userData.part);
    }

    let flipped = false;
    function flipLabel() { if (flipBtn) flipBtn.textContent = t(flipped ? "ui.3d.top" : "ui.3d.under"); }
    onChange(() => { if (state.destroy) flipLabel(); });
    on(flipBtn, "click", () => {
      flipped = !flipped; view.auto = false;
      view.pitchTarget = flipped ? Math.PI : 0; view.vp = 0;
      flipLabel();
      if (flipped && cfg.flipSelect) select(cfg.flipSelect);
    });
    on(resetBtn, "click", () => {
      flipped = false; flipLabel();
      view.yaw = yaw0; view.pitch = 0; view.vy = view.vp = 0; view.pitchTarget = null; view.auto = true;
      cam.zoom = 1; cam.pan.set(0, 0);
      slider.value = explode0 * 100; explodeTarget = explode0; select(cfg.initial);
    });

    let W = 0, H = 0, baseDist = 100;
    const dists = cfg.dist || [92, 104, 128];
    const elev = cfg.elev != null ? cfg.elev : 0.5, lookY = cfg.lookY != null ? cfg.lookY : 4;
    const camDir = new THREE.Vector3(0, elev, Math.sqrt(1 - elev * elev));
    const camRight = new THREE.Vector3(1, 0, 0), camUp = new THREE.Vector3().crossVectors(camDir, camRight);
    const look = new THREE.Vector3();
    function placeCamera() {
      look.set(0, lookY, 0).addScaledVector(camRight, cam.panNow.x).addScaledVector(camUp, cam.panNow.y);
      camera.position.copy(look).addScaledVector(camDir, baseDist * cam.zoomNow);
      camera.lookAt(look);
    }
    function resize() {
      const r = canvas.getBoundingClientRect(); W = r.width; H = r.height;
      if (!W || !H) return;
      renderer.setSize(W, H, false);
      camera.aspect = W / H;
      baseDist = W / H < 1 ? dists[2] : W / H < 1.3 ? dists[1] : dists[0];
      placeCamera();
      camera.updateProjectionMatrix();
    }
    const ro = new ResizeObserver(resize); ro.observe(canvas); resize();

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const v = new THREE.Vector3();
    let last = performance.now();
    function frame(now) {
      if (!state.destroy) return;
      requestAnimationFrame(frame);
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      if (!state.visible || !W) return;
      if (view.auto && !reduce) view.yaw += 0.0025;
      if (!dragging) {
        view.yaw += view.vy; view.pitch += view.vp; view.vy *= 0.92; view.vp *= 0.92;
        if (view.pitchTarget !== null) view.pitch += (view.pitchTarget - view.pitch) * 0.08;
      }
      model.rotation.set(view.pitch, view.yaw, 0, "XYZ");
      if (Math.abs(cam.zoom - cam.zoomNow) > 1e-4 || cam.pan.distanceTo(cam.panNow) > 1e-3) {
        cam.zoomNow += (cam.zoom - cam.zoomNow) * 0.18; cam.panNow.lerp(cam.pan, 0.18); placeCamera();
      }
      explode += (explodeTarget - explode) * 0.1;
      const ease = explode * explode * (3 - 2 * explode);
      for (const id in layout) {
        const L = layout[id], g = parts[id].group;
        g.position.set((L.dx || 0) * ease + (L.x || 0), L.y + (L.dy || 0) * ease, (L.dz || 0) * ease + (L.z || 0));
      }
      glow -= glow * (1 - Math.exp(-dt * 1.8));
      if (Math.abs(glow - shownGlow) > 0.004) applyGlow();
      if (built.tick) built.tick(dt, ease);
      renderer.render(scene, camera);

      model.updateMatrixWorld();
      for (const id in tags) {
        v.copy(anchors[id]).applyMatrix4(parts[id].group.matrixWorld).project(camera);
        const hide = v.z > 1 || (hideClosed.includes(id) && explode < 0.12);
        tags[id].classList.toggle("hidden", hide);
        tags[id].style.left = ((v.x + 1) / 2 * W) + "px";
        tags[id].style.top = ((1 - v.y) / 2 * H) + "px";
      }
    }

    state.destroy = () => {
      state.destroy = null;
      offs.forEach(off => off()); ro.disconnect();
      const textures = new Set();
      scene.traverse(o => {
        if (o.geometry) o.geometry.dispose();
        for (const m of [].concat(o.material || [])) {
          for (const k in m) if (m[k] && m[k].isTexture) textures.add(m[k]);
          m.dispose();
        }
      });
      textures.forEach(tx => tx.dispose());
      if (scene.environment) scene.environment.dispose();
      keyL.shadow.dispose();
      renderer.dispose(); renderer.forceContextLoss();
      canvas.replaceWith(canvas.cloneNode(false));
      tagLayer.textContent = "";
      if (flipBtn) flipBtn.textContent = t("ui.3d.under");
      root._three = null;
    };
    requestAnimationFrame(frame);
    return state;
  }
};
