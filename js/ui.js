window.Internals = window.Internals || {};

Internals.ui = (function () {
  const NS = "http://www.w3.org/2000/svg";
  const { t, bind, onChange } = Internals.i18n;
  const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  const C = {
    ink: css("--ink"), ink2: css("--ink-2"), muted: css("--muted"), line: css("--line"), line2: css("--line-strong"),
    panel: css("--panel"), panel2: css("--panel-2"), ground: css("--ground"), ground2: css("--ground-2"),
    copper: css("--copper"), signal: css("--signal"), violet: css("--violet"), good: css("--good"), gold: css("--gold"), bad: css("--bad")
  };
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  function el(tag, attrs, parent, text) {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (text !== undefined) e.textContent = text;
    if (parent) parent.appendChild(e);
    return e;
  }
  function label(svg, x, y, key, opts, vars) {
    const e = el("text", Object.assign({ x, y, fill: C.muted, "font-size": 11, "letter-spacing": ".06em" }, opts || {}), svg);
    if (typeof key === "string") bind(e, key, vars); else e.textContent = key.raw;
    return e;
  }
  function rich(target, key, vals) {
    const marks = {}; for (const k in vals) marks[k] = "\u0000" + k + "\u0000";
    const parts = t(key, marks).split("\u0000");
    target.textContent = "";
    parts.forEach((p, i) => {
      if (i % 2 === 1 && vals[p]) {
        const s = document.createElement("span"); s.className = vals[p][1] || ""; s.textContent = vals[p][0]; target.appendChild(s);
      } else if (p) target.appendChild(document.createTextNode(p));
    });
  }
  function loop(watch, fn) {
    let visible = true, last = performance.now(), frames = 0;
    new IntersectionObserver(es => { visible = es[0].isIntersecting; }).observe(watch);
    (function f(now) {
      requestAnimationFrame(f);
      const dt = Math.min(0.1, (now - last) / 1000); last = now;
      if (visible || (frames++ % 60 === 0)) fn(visible ? dt : 0, now);
    })(last);
  }
  function canvas2d(cv) {
    const g = cv.getContext("2d"); const s = { g, W: 0, H: 0 };
    function size() {
      const dpr = Math.min(devicePixelRatio || 1, 2), r = cv.getBoundingClientRect();
      s.W = r.width; s.H = r.height; cv.width = Math.max(1, s.W * dpr); cv.height = Math.max(1, s.H * dpr);
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    new ResizeObserver(size).observe(cv); size();
    return s;
  }
  function quiz(box, prefix, answers) {
    const picked = answers.map(() => null);
    const shows = answers.map((right, qi) => {
      const k = prefix + ".q" + (qi + 1);
      const d = document.createElement("div"); d.className = "q";
      d.innerHTML = `<p class="mono fineprint"></p><p class="ask"></p><div class="opts"></div><p class="why" hidden></p>`;
      bind(d.querySelector(".fineprint"), "ui.quiz.n", { n: qi + 1, total: answers.length });
      bind(d.querySelector(".ask"), k);
      const opts = d.querySelector(".opts"), why = d.querySelector(".why");
      const buttons = [0, 1, 2].map(ai => {
        const b = document.createElement("button"); b.type = "button";
        bind(b, k + ".a" + ai);
        b.addEventListener("click", () => { picked[qi] = ai; show(); });
        opts.appendChild(b); return b;
      });
      function show() {
        const p = picked[qi];
        buttons.forEach((b, ai) => { b.classList.toggle("right", p === ai && ai === right); b.classList.toggle("wrong", p === ai && ai !== right); });
        if (p === null) return;
        why.hidden = false;
        why.textContent = p === right ? t("ui.quiz.right", { why: t(k + ".why") }) : t("ui.quiz.wrong");
      }
      box.appendChild(d);
      return show;
    });
    onChange(() => shows.forEach(s => s()));
  }
  function stepper(chipsBox, prevBtn, nextBtn, n, keyOf, render) {
    let i = 0;
    const chips = [];
    for (let k = 0; k < n; k++) {
      const b = document.createElement("button"); b.type = "button"; b.className = "chip";
      bind(b, keyOf(k), { n: k + 1 });
      b.addEventListener("click", () => go(k, true));
      chipsBox.appendChild(b); chips.push(b);
    }
    function go(k, animate) {
      i = Math.max(0, Math.min(n - 1, k));
      chips.forEach((c, j) => c.setAttribute("aria-pressed", j === i));
      prevBtn.disabled = i === 0; nextBtn.disabled = i === n - 1;
      render(i, animate);
    }
    prevBtn.addEventListener("click", () => go(i - 1, true));
    nextBtn.addEventListener("click", () => go(i + 1, true));
    onChange(() => render(i, false));
    go(0, false);
    return { go, get i() { return i; } };
  }
  return { C, el, label, rich, loop, canvas2d, quiz, stepper, sleep };
})();
