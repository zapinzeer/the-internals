(function () {
  const PARTS = ["cpu", "gpu", "ram", "storage", "board", "psu"];
  const sections = {};
  document.querySelectorAll("section[data-part]").forEach(s => { sections[s.dataset.part] = s; });
  const ready = id => !!sections[id];

  const nav = document.querySelector(".partnav");
  nav.innerHTML = "";
  PARTS.forEach(id => {
    if (ready(id)) {
      const a = document.createElement("a"); a.href = "#" + id; a.dataset.nav = id; a.dataset.i18n = "site.nav." + id;
      nav.appendChild(a);
    } else {
      const s = document.createElement("span");
      s.innerHTML = `<span data-i18n="site.nav.${id}"></span><small data-i18n="site.soon"></small>`;
      nav.appendChild(s);
    }
  });

  const nextLink = document.querySelector(".next-part");
  const grid = document.querySelector(".next-grid");
  grid.innerHTML = "";
  PARTS.forEach(id => {
    const card = document.createElement(ready(id) ? "a" : "div");
    card.className = "part-card";
    if (ready(id)) { card.href = "#" + id; card.dataset.nav = id; }
    card.innerHTML = `<b data-i18n="site.nav.${id}"></b><span data-i18n="site.next.${id}"></span>` +
      (ready(id) ? "" : `<small data-i18n="site.soon"></small>`);
    grid.appendChild(card);
  });

  document.querySelectorAll(".viewer[data-viewer]").forEach(v => {
    const id = v.dataset.viewer, flip = v.hasAttribute("data-flip");
    v.innerHTML = `
      <canvas data-i18n-aria="ui.3d.aria"></canvas>
      <div class="tags"></div>
      <p class="viewer-hint" data-i18n="ui.3d.hint"></p>
      <div class="viewer-zoom">
        <button class="btn zoomin" type="button" data-i18n-aria="ui.3d.zoomIn">+</button>
        <button class="btn zoomout" type="button" data-i18n-aria="ui.3d.zoomOut">−</button>
      </div>
      <div class="viewer-fallback" hidden data-i18n="ui.3d.fallback"></div>
      <div class="viewer-bar">
        <div class="range">
          <label for="explode-${id}" data-i18n="ui.3d.explode"></label>
          <input type="range" class="explode" id="explode-${id}" min="0" max="100" value="${v.dataset.explode || 75}">
        </div>
        <div class="btn-row">
          ${flip ? `<button class="btn flip" type="button" data-i18n="ui.3d.under"></button>` : ""}
          <button class="btn resetview" type="button" data-i18n="ui.3d.reset"></button>
        </div>
      </div>`;
    const card = document.createElement("div");
    card.className = "partcard"; card.setAttribute("aria-live", "polite");
    card.innerHTML = `<span class="swatch"></span><h3></h3><p></p><span class="fact"></span>`;
    v.after(card);
  });

  let current = null;
  function show(id, scroll) {
    if (!ready(id)) id = "cpu";
    current = id;
    for (const k in sections) sections[k].hidden = k !== id;
    document.querySelectorAll("[data-nav]").forEach(a => {
      if (a.dataset.nav === id) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
    });
    const i = PARTS.indexOf(id);
    const next = PARTS.slice(i + 1).concat(PARTS.slice(0, i)).find(ready);
    if (next && next !== id) {
      nextLink.hidden = false; nextLink.href = "#" + next;
      nextLink.querySelector("b").dataset.i18n = "site.nav." + next;
      nextLink.querySelector("b").textContent = Internals.i18n.t("site.nav." + next);
    } else nextLink.hidden = true;
    try { localStorage.setItem("internals-part", id); } catch (e) { }
    if (scroll) window.scrollTo({ top: 0, behavior: "instant" });
    document.dispatchEvent(new CustomEvent("internals:show", { detail: id }));
  }
  function fromHash(scroll) {
    const h = location.hash.replace("#", "");
    if (h === "en" || h === "sr") { Internals.i18n.setLang(h); if (!current) show(savedPart(), false); return; }
    if (PARTS.includes(h)) show(h, scroll);
    else if (!current) show(savedPart(), false);
  }
  function savedPart() {
    try { const p = localStorage.getItem("internals-part"); if (ready(p)) return p; } catch (e) { }
    return "cpu";
  }
  window.addEventListener("hashchange", () => fromHash(true));
  fromHash(false);

  Internals.i18n.apply();
  document.querySelectorAll("[data-lang]").forEach(b => {
    b.addEventListener("click", () => Internals.i18n.setLang(b.dataset.lang));
  });
})();
