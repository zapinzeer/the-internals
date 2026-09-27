(function () {
  const { t, num, bind, onChange } = Internals.i18n;

  const TESTS = {
    cpu: { prefix: "cpu", order: 4, match: 4, est: { min: 0, max: 20, step: 1, start: 12, answer: 5, tol: 0, digits: 0 } },
    gpu: { prefix: "gpu", order: 4, match: 4, est: { min: 0, max: 8, step: 0.1, start: 5, answer: 2.1, tol: 0.15, digits: 1 } },
    ram: { prefix: "ram", order: 4, match: 4, est: { min: 0, max: 100, step: 1, start: 20, answer: 48, tol: 1, digits: 0 } },
    storage: { prefix: "sto", order: 4, match: 4, est: { min: 0, max: 300, step: 5, start: 240, answer: 120, tol: 0, digits: 0 } },
    board: { prefix: "mb", order: 4, match: 4, est: { min: 0, max: 64, step: 1, start: 8, answer: 32, tol: 0, digits: 0 } },
    psu: { prefix: "psu", order: 5, match: 4, est: { min: 300, max: 900, step: 10, start: 800, answer: 600, tol: 0, digits: 0 } }
  };
  const PENALTY = 10;

  function shuffle(n, seed) {
    const a = [...Array(n).keys()];
    let s = seed;
    const r = () => (s = s * 16807 % 2147483647) / 2147483647;
    do { for (let i = n - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } }
    while (a.every((v, i) => v === i));
    return a;
  }
  const make = (tag, cls, parent, key) => {
    const e = document.createElement(tag); if (cls) e.className = cls;
    if (key) bind(e, key); if (parent) parent.appendChild(e); return e;
  };
  const calm = () => document.documentElement.classList.contains("calm");
  const replay = (e, cls) => { e.classList.remove(cls); void e.offsetWidth; e.classList.add(cls); };

  function labtest(box, id) {
    const cfg = TESTS[id], k = cfg.prefix + ".test.";
    const kinds = ["order", "match", "estimate"];
    let step = -1, mistakes = [0, 0, 0], attempt = 0;

    box.classList.add("labtest");
    const head = make("div", "lt-head", box);
    const steps = kinds.map((kind, i) => {
      const s = make("div", "lt-step", head);
      make("b", "", s).textContent = i + 1;
      make("span", "", s, "ui.test." + kind);
      return s;
    });
    const scoreBox = make("div", "lt-score", head);
    const body = make("div", "lt-body", box);

    function setSteps() {
      steps.forEach((s, i) => { s.classList.toggle("on", i === step); s.classList.toggle("done", i < step || step === 3); });
      const live = step < 0 ? 100 : Math.max(0, Math.round(score()));
      scoreBox.textContent = t("ui.test.points", { n: live });
    }
    function score() {
      return mistakes.reduce((a, m) => a + Math.max(0, 100 / 3 - m * PENALTY), 0);
    }
    function panel(cls) {
      const old = body.firstElementChild;
      if (old) { old.classList.add("lt-out"); setTimeout(() => old.remove(), 380); }
      const p = make("div", "lt-panel " + (cls || ""), body);
      requestAnimationFrame(() => p.classList.add("lt-in"));
      return p;
    }
    function feedback(p) { return make("p", "lt-feedback", p); }
    function clearFeedback(p) { const f = p.querySelector(".lt-feedback"); if (f) { f.className = "lt-feedback"; f.textContent = ""; } }
    function nextBtn(p, key, fn) {
      const b = make("button", "btn primary lt-next", p, key); b.type = "button";
      b.addEventListener("click", fn); requestAnimationFrame(() => b.focus({ preventScroll: true }));
      return b;
    }
    function done(p, why) {
      const r = p.getBoundingClientRect();
      document.dispatchEvent(new CustomEvent("internals:burst", { detail: { x: r.left + r.width / 2, y: r.top + r.height / 2 } }));
      const f = p.querySelector(".lt-feedback");
      f.className = "lt-feedback good"; f.textContent = t("ui.test.right") + " " + t(why);
      nextBtn(p, step < 2 ? "ui.test.next" : "ui.test.finish", () => go(step + 1));
      setSteps();
    }
    function miss(el, key) {
      mistakes[step]++; setSteps();
      if (el) replay(el, "shake");
      const f = body.querySelector(".lt-panel:not(.lt-out) .lt-feedback");
      f.className = "lt-feedback bad"; f.textContent = t(key || "ui.test.wrong");
      replay(scoreBox, "hit");
    }

    function intro() {
      const p = panel("lt-intro");
      make("p", "lt-ask", p, "ui.test.intro");
      const b = make("button", "btn primary", p, "ui.test.start"); b.type = "button";
      b.addEventListener("click", () => go(0));
    }

    function order() {
      const n = cfg.order, p = panel();
      make("p", "lt-ask", p, k + "o.q");
      make("p", "lt-hint", p, "ui.test.orderHint");
      const slots = make("ol", "lt-slots", p);
      const slotEls = [...Array(n)].map((_, i) => { const li = make("li", "", slots); li.dataset.n = i + 1; return li; });
      const pool = make("div", "lt-pool", p);
      let next = 0;
      shuffle(n, 97 + n + attempt).forEach(i => {
        const b = make("button", "lt-item", pool, k + "o.i" + i); b.type = "button";
        b.addEventListener("click", () => {
          if (b.disabled) return;
          if (i !== next) return miss(b);
          clearFeedback(p);
          const from = b.getBoundingClientRect();
          const chip = make("span", "lt-chip", slotEls[next], k + "o.i" + i);
          const to = chip.getBoundingClientRect();
          if (!calm()) chip.animate([{ transform: `translate(${from.left - to.left}px, ${from.top - to.top}px) scale(1.04)`, opacity: .6 }, { transform: "none", opacity: 1 }],
            { duration: 420, easing: "cubic-bezier(.2,.8,.2,1.2)" });
          slotEls[next].classList.add("filled");
          b.disabled = true; b.classList.add("used");
          if (++next === n) done(p, k + "o.why");
        });
      });
      feedback(p);
    }

    function match() {
      const n = cfg.match, p = panel();
      make("p", "lt-ask", p, k + "m.q");
      make("p", "lt-hint", p, "ui.test.matchHint");
      const cols = make("div", "lt-match", p);
      const left = make("div", "lt-col", cols), right = make("div", "lt-col", cols);
      let picked = null, matched = 0;
      const L = [...Array(n).keys()].map(i => {
        const b = make("button", "lt-item", left, k + "m.a" + i); b.type = "button"; b.dataset.i = i;
        b.addEventListener("click", () => {
          if (b.disabled) return;
          L.forEach(x => x.classList.remove("picked"));
          picked = i; b.classList.add("picked");
        });
        return b;
      });
      shuffle(n, 31 + attempt).forEach(i => {
        const b = make("button", "lt-item", right, k + "m.b" + i); b.type = "button";
        b.addEventListener("click", () => {
          if (b.disabled) return;
          if (picked === null) { replay(L.find(x => !x.disabled), "nudge"); return; }
          if (picked !== i) { L[picked].classList.remove("picked"); picked = null; return miss(b); }
          clearFeedback(p);
          const hue = ["var(--mint)", "var(--sage)", "#5ac8e2", "#d8b25a"][matched % 4];
          [L[i], b].forEach(x => { x.disabled = true; x.classList.remove("picked"); x.classList.add("paired"); x.style.setProperty("--pair", hue); replay(x, "pop"); });
          picked = null;
          if (++matched === n) done(p, k + "m.why");
        });
      });
      feedback(p);
    }

    function estimate() {
      const e = cfg.est, p = panel();
      make("p", "lt-ask", p, k + "e.q");
      const row = make("div", "lt-est", p);
      const input = make("input", "", row); input.type = "range";
      Object.assign(input, { min: e.min, max: e.max, step: e.step, value: e.start });
      const val = make("output", "lt-val", row);
      const unit = make("span", "lt-unit", row, k + "e.unit");
      void unit;
      const show = () => { val.textContent = num(+input.value, e.digits); };
      input.addEventListener("input", show); show();
      const check = make("button", "btn primary", p, "ui.test.check"); check.type = "button";
      check.addEventListener("click", () => {
        const v = +input.value;
        if (Math.abs(v - e.answer) <= e.tol + 1e-9) {
          check.remove(); input.disabled = true; val.classList.add("ok"); replay(val, "pop");
          done(p, k + "e.why");
        } else miss(val, v > e.answer ? "ui.test.high" : "ui.test.low");
      });
      const aria = () => input.setAttribute("aria-label", t("ui.test.slider"));
      aria(); onChange(aria);
      feedback(p);
    }

    function result() {
      const s = Math.round(score()), p = panel("lt-result");
      const ring = make("div", "lt-ring", p);
      ring.innerHTML = `<svg viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="52" class="bg"/><circle cx="60" cy="60" r="52" class="fg" pathLength="100"/></svg><b>0</b>`;
      const fg = ring.querySelector(".fg"), label = ring.querySelector("b");
      const grade = s >= 90 ? "ui.test.g3" : s >= 60 ? "ui.test.g2" : "ui.test.g1";
      make("h3", "", p, grade);
      const m = mistakes.reduce((a, b) => a + b, 0);
      bind(make("p", "lt-hint", p), "ui.test.summary", { s, m });
      const again = make("button", "btn", p, "ui.test.again"); again.type = "button";
      again.addEventListener("click", () => { attempt++; mistakes = [0, 0, 0]; go(0); });
      const t0 = performance.now(), dur = calm() ? 1 : 1400;
      (function tick(now) {
        const f = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - f, 3);
        fg.style.strokeDasharray = `${s * e} 100`; label.textContent = Math.round(s * e);
        if (f < 1) requestAnimationFrame(tick);
        else if (s >= 60 && !calm()) burst(ring);
      })(t0);
    }

    function burst(at) {
      const colors = ["#daf1de", "#8eb69b", "#c9e8cf", "#ffffff", "#5ac8e2"];
      for (let i = 0; i < 26; i++) {
        const c = make("i", "lt-confetti", at);
        const a = Math.random() * Math.PI * 2, d = 70 + Math.random() * 90;
        c.style.background = colors[i % colors.length];
        c.animate([{ transform: "translate(-50%,-50%) scale(.4)", opacity: 1 },
          { transform: `translate(calc(-50% + ${Math.cos(a) * d}px), calc(-50% + ${Math.sin(a) * d + 40}px)) rotate(${Math.random() * 540}deg)`, opacity: 0 }],
          { duration: 1100 + Math.random() * 500, easing: "cubic-bezier(.1,.7,.3,1)" }).onfinish = () => c.remove();
      }
    }

    function go(i) {
      step = i; setSteps();
      [order, match, estimate, result][i]();
    }
    onChange(setSteps);
    setSteps(); intro();
  }

  document.querySelectorAll("[data-labtest]").forEach(b => labtest(b, b.dataset.labtest));
})();
