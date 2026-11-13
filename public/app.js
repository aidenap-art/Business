(() => {
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  const STORAGE_KEY = "upwell-waitlist";

  // Footer year + sticky-nav border
  document.getElementById("year").textContent = new Date().getFullYear();
  const nav = document.querySelector(".nav");
  const onScroll = () => nav.classList.toggle("is-scrolled", window.scrollY > 8);
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  // Reveal-on-scroll
  if ("IntersectionObserver" in window) {
    const targets = document.querySelectorAll(".feature, .not-y__list li, .who__card, .steps li:not(.steps__arrow), .plan, .faq__list details");
    const io = new IntersectionObserver((items) => {
      items.forEach((it) => {
        if (it.isIntersecting) {
          const el = it.target;
          el.classList.add("is-in");
          io.unobserve(el);
          // drop the stagger delay once revealed so hover animations respond instantly
          setTimeout(() => { el.style.transitionDelay = ""; }, 1000);
        }
      });
    }, { rootMargin: "0px 0px -8% 0px" });
    targets.forEach((el, i) => {
      el.classList.add("reveal");
      el.style.transitionDelay = (i % 3) * 80 + "ms";
      io.observe(el);
    });
  }

  // Social proof: show the live count once there are enough people to be worth showing
  fetch("/api/waitlist/count")
    .then((r) => (r.ok ? r.json() : null))
    .then((d) => {
      if (d && d.count >= 25) {
        document.querySelectorAll("[data-count-text]").forEach((el) => {
          el.textContent = `Join ${d.count.toLocaleString()} businesses already on the list.`;
        });
      }
    })
    .catch(() => {});

  const escapeHtml = (s) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  function successMarkup({ position, already, name }) {
    const first = name ? escapeHtml(name.split(" ")[0]) + ", y" : "Y";
    return `
      <div class="success" tabindex="-1">
        <h3>${already ? "You're already on the list." : `${first}ou're <em>#${position}</em> on the list.`}</h3>
        <p>${already ? `You're <strong>#${position}</strong>. We'll be in touch before launch.` :
          "We'll email you before launch to book your free growth audit. Your 30% founding-client discount is locked in."}</p>
        <div class="share">
          <button type="button" data-share>Share Upwell with a friend</button>
        </div>
      </div>`;
  }

  function showSuccess(form, data) {
    form.outerHTML = successMarkup(data);
    // Swap every other form too, so the visitor isn't asked twice.
    document.querySelectorAll("[data-waitlist]").forEach((f) => (f.outerHTML = successMarkup(data)));
    document.querySelectorAll(".fine").forEach((el) => el.remove());
    document.querySelectorAll("[data-share]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const shareData = { title: "Upwell", text: "Upwell runs online ads & social growth for businesses and creators. Join the waitlist:", url: location.origin };
        try {
          if (navigator.share) await navigator.share(shareData);
          else { await navigator.clipboard.writeText(location.origin); btn.textContent = "Link copied!"; }
        } catch { /* user cancelled */ }
      });
    });
  }

  // Returning visitor who already signed up
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (saved && saved.position) {
      const first = document.querySelector("[data-waitlist]");
      if (first) showSuccess(first, { ...saved, already: true });
    }
  } catch { /* storage unavailable */ }

  document.addEventListener("submit", async (e) => {
    const form = e.target.closest("[data-waitlist]");
    if (!form) return;
    e.preventDefault();

    const msg = form.querySelector(".form-msg");
    const btn = form.querySelector("button[type=submit]");
    const emailInput = form.querySelector("[name=email]");
    const fd = new FormData(form);
    const payload = Object.fromEntries(fd.entries());
    payload.email = (payload.email || "").trim();

    msg.className = "form-msg";
    msg.textContent = "";
    emailInput.removeAttribute("aria-invalid");

    if (!EMAIL_RE.test(payload.email)) {
      msg.textContent = "Please enter a valid email address.";
      msg.classList.add("is-error");
      emailInput.setAttribute("aria-invalid", "true");
      emailInput.focus();
      return;
    }

    const label = btn.textContent;
    btn.disabled = true;
    btn.textContent = "Joining…";

    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Something went wrong. Please try again.");
      const result = { position: data.position, already: !!data.already, name: payload.name || "" };
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ position: data.position })); } catch {}
      showSuccess(form, result);
      const s = document.querySelector(".success");
      if (s) s.focus({ preventScroll: true });
    } catch (err) {
      msg.textContent = err.message || "Network error. Please try again.";
      msg.classList.add("is-error");
      btn.disabled = false;
      btn.textContent = label;
    }
  });
})();
