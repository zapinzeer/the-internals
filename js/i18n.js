window.Internals = window.Internals || {};
Internals.strings = Internals.strings || { en: {}, sr: {} };

(function () {
  const LANGS = ["en", "sr"];
  const LOCALE = { en: "en-US", sr: "sr-Latn-RS" };
  let lang = "en";
  try {
    const saved = localStorage.getItem("internals-lang");
    if (LANGS.includes(saved)) lang = saved;
    else if (/^(sr|hr|bs|sh)\b/i.test(navigator.language || "")) lang = "sr";
  } catch (e) { }
  const hash = location.hash.replace("#", "");
  if (LANGS.includes(hash)) lang = hash;

  const bound = [];
  const listeners = [];

  function t(key, vars) {
    const S = Internals.strings;
    let s = (S[lang] && S[lang][key]) != null ? S[lang][key] : (S.en[key] != null ? S.en[key] : key);
    if (vars) s = s.replace(/\{(\w+)\}/g, (m, k) => (vars[k] != null ? vars[k] : m));
    return s;
  }

  function num(n, digits) {
    const d = digits || 0;
    return Number(n).toLocaleString(LOCALE[lang], { minimumFractionDigits: d, maximumFractionDigits: d });
  }

  function plural(n, forms) {
    if (lang === "sr") {
      const m10 = n % 10, m100 = n % 100;
      if (m10 === 1 && m100 !== 11) return forms.one;
      if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return forms.few || forms.other;
      return forms.other;
    }
    return n === 1 ? forms.one : forms.other;
  }

  function bind(el, key, vars) {
    const entry = { el, key, vars };
    bound.push(entry); render(entry); return el;
  }
  function render(e) {
    e.el.textContent = t(e.key, typeof e.vars === "function" ? e.vars() : e.vars);
  }

  function apply() {
    document.documentElement.lang = lang === "sr" ? "sr-Latn" : "en";
    document.querySelectorAll("[data-i18n]").forEach(el => { el.textContent = t(el.dataset.i18n); });
    document.querySelectorAll("[data-i18n-html]").forEach(el => { el.innerHTML = t(el.dataset.i18nHtml); });
    document.querySelectorAll("[data-i18n-aria]").forEach(el => { el.setAttribute("aria-label", t(el.dataset.i18nAria)); });
    document.querySelectorAll("[data-lang]").forEach(b => b.setAttribute("aria-pressed", b.dataset.lang === lang));
    for (let i = bound.length - 1; i >= 0; i--) {
      if (!bound[i].el.isConnected) { bound.splice(i, 1); continue; }
      render(bound[i]);
    }
    listeners.forEach(fn => fn(lang));
  }

  function setLang(l) {
    if (!LANGS.includes(l) || l === lang) return;
    lang = l;
    try { localStorage.setItem("internals-lang", l); } catch (e) { }
    apply();
  }

  Internals.i18n = {
    t, num, plural, bind, apply, setLang,
    onChange: fn => listeners.push(fn),
    get lang() { return lang; }
  };
})();
