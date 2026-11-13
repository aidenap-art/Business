// Upwell cookie consent.
//
// Stores the visitor's choice in a first-party cookie "upwell_consent" for 12 months.
// Nothing non-essential should load until consent is given. To add analytics or ad
// pixels later, wrap them like this:
//
//   window.upwellConsent.onChange((c) => { if (c.analytics) loadAnalytics(); });
//
// The callback runs immediately if a choice already exists, and again whenever it changes.
(() => {
  const COOKIE = "upwell_consent";
  const VERSION = 1; // bump to ask everyone again after the cookie policy changes
  const MAX_AGE = 60 * 60 * 24 * 365;
  const listeners = [];

  function read() {
    const m = document.cookie.match(/(?:^|;\s*)upwell_consent=([^;]+)/);
    if (!m) return null;
    try {
      const c = JSON.parse(decodeURIComponent(m[1]));
      return c && c.v === VERSION ? c : null;
    } catch { return null; }
  }

  function write(choice) {
    const c = { v: VERSION, analytics: !!choice.analytics, marketing: !!choice.marketing, at: new Date().toISOString() };
    const secure = location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `${COOKIE}=${encodeURIComponent(JSON.stringify(c))}; Max-Age=${MAX_AGE}; Path=/; SameSite=Lax${secure}`;
    listeners.forEach((fn) => { try { fn(c); } catch (e) { console.error(e); } });
    document.dispatchEvent(new CustomEvent("upwell:consent", { detail: c }));
    return c;
  }

  window.upwellConsent = {
    get: read,
    onChange(fn) { listeners.push(fn); const c = read(); if (c) fn(c); },
    open: () => show(true),
  };

  const icon = (name) => `<svg class="i" aria-hidden="true"><use href="/icons.svg#${name}"/></svg>`;
  let el;

  function build() {
    el = document.createElement("section");
    el.className = "cookie glass";
    el.setAttribute("role", "dialog");
    el.setAttribute("aria-labelledby", "cookie-title");
    el.setAttribute("aria-describedby", "cookie-desc");
    el.hidden = true;
    el.innerHTML = `
      <div class="cookie__head">${icon("cookie")}<h2 id="cookie-title">Cookies, briefly</h2></div>
      <p id="cookie-desc">We use essential cookies to make this site work. With your OK we'd also use analytics cookies to see which pages help people, and marketing cookies to measure our own ads. Read our <a href="/privacy#cookies">cookie details</a>.</p>
      <div class="cookie__prefs" hidden>
        <label class="toggle"><input type="checkbox" checked disabled /><span><strong>Essential</strong>Remembers your cookie choice and keeps forms working. Always on.</span></label>
        <label class="toggle"><input type="checkbox" name="analytics" /><span><strong>Analytics</strong>Anonymous stats on visits and clicks.</span></label>
        <label class="toggle"><input type="checkbox" name="marketing" /><span><strong>Marketing</strong>Lets ad platforms tell us if our ads worked.</span></label>
      </div>
      <div class="cookie__actions">
        <button type="button" class="btn btn--small" data-act="all">Accept all</button>
        <button type="button" class="btn btn--small btn--ghost" data-act="essential">Essentials only</button>
        <button type="button" class="linkish" data-act="customise">Customise</button>
        <button type="button" class="btn btn--small" data-act="save" hidden>Save choices</button>
      </div>`;
    document.body.appendChild(el);

    const prefs = el.querySelector(".cookie__prefs");
    const btn = (a) => el.querySelector(`[data-act="${a}"]`);
    el.addEventListener("click", (e) => {
      const act = e.target.closest("[data-act]")?.dataset.act;
      if (!act) return;
      if (act === "customise") {
        prefs.hidden = false;
        btn("customise").hidden = true;
        btn("save").hidden = false;
        prefs.querySelector("input[name=analytics]").focus();
        return;
      }
      if (act === "all") write({ analytics: true, marketing: true });
      if (act === "essential") write({ analytics: false, marketing: false });
      if (act === "save") write({
        analytics: prefs.querySelector("[name=analytics]").checked,
        marketing: prefs.querySelector("[name=marketing]").checked,
      });
      hide();
    });
    el.addEventListener("keydown", (e) => { if (e.key === "Escape" && read()) hide(); });
  }

  function show(fromSettings) {
    if (!el) build();
    const c = read() || { analytics: false, marketing: false };
    el.querySelector("[name=analytics]").checked = c.analytics;
    el.querySelector("[name=marketing]").checked = c.marketing;
    const prefs = el.querySelector(".cookie__prefs");
    prefs.hidden = !fromSettings;
    el.querySelector('[data-act="customise"]').hidden = !!fromSettings;
    el.querySelector('[data-act="save"]').hidden = !fromSettings;
    el.hidden = false;
    if (fromSettings) el.querySelector("[data-act=all]").focus();
  }

  function hide() { if (el) el.hidden = true; }

  function init() {
    if (!read()) show(false);
    document.querySelectorAll("[data-cookie-settings]").forEach((b) => b.addEventListener("click", () => show(true)));
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
