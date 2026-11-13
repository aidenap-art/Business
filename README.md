# Upwell

**Online marketing & ads for businesses and social media influencers.** This repo is Upwell's landing page and waitlist.

*Why "Upwell"?* In the ocean, an upwelling is a rising current that brings nutrients up to the surface, which is roughly what good marketing does for a business. The tagline is "Marketing that brings customers to the surface."

## What's here

```
public/          Landing page (plain HTML/CSS/JS, no build step)
  index.html     Hero, 3 feature cards, "It's not X, it's Y", who it's for, how it works, pricing, FAQ, waitlist
  privacy.html   Privacy Policy (served at /privacy), including the cookie table
  terms.html     Terms of Service (served at /terms)
  styles.css     Design system: neon + pastel tokens, harsh/rainbow gradients, liquid glass
  app.js         Form handling, success state, share button, scroll reveals
  consent.js     Cookie banner + "Cookie settings" (all pages)
  icons.svg      Lucide icons (ISC license), self-hosted as an SVG sprite
server.js        Node server with zero dependencies: static files + waitlist API
test/            Tests (run with `npm test`)
data/            waitlist.json is written here (gitignored)
```

## Run it locally

```bash
ADMIN_TOKEN=pick-a-long-random-string npm start
# open http://localhost:3000
```

Requires Node 18+. There's nothing to install.

## The waitlist

| Endpoint | What it does |
|---|---|
| `POST /api/waitlist` | Join. Body: `{ email, name?, business?, budget? }`. Returns the person's position. Duplicate emails just return their existing spot. |
| `GET /api/waitlist/count` | Public count. The page shows "Join N businesses…" once there are 25 or more. |
| `GET /api/waitlist?token=ADMIN_TOKEN` | All signups as JSON. |
| `GET /api/waitlist?token=ADMIN_TOKEN&format=csv` | Download as CSV (open in Excel/Sheets, import into Mailchimp etc.). |

Built-in protection: email validation, a hidden honeypot field for bots, per-IP rate limiting, atomic file writes, and constant-time token checks. Export is disabled unless `ADMIN_TOKEN` is set.

## Deploy

Any host that runs Node works. Signups are stored in `DATA_DIR/waitlist.json`, so **give it persistent storage**:

- **Render**: New Web Service → start command `npm start` → add a Disk mounted at `/var/data` → env vars `DATA_DIR=/var/data`, `ADMIN_TOKEN=…`
- **Railway / Fly.io**: same idea; attach a volume and point `DATA_DIR` at it.

Environment variables: `PORT` (default 3000), `DATA_DIR` (default `./data`), `ADMIN_TOKEN` (required for export).

## Cookies

`consent.js` shows the cookie banner (Accept all / Essentials only / Customise) and saves the choice in an `upwell_consent` cookie for 12 months. The site sets **no analytics or ad cookies today**. If you add any, load them only after consent, and list them in the cookie table in `privacy.html`:

```js
window.upwellConsent.onChange((c) => {
  if (c.analytics) { /* load analytics */ }
  if (c.marketing) { /* load Meta / Google / TikTok pixels */ }
});
```

Bump `VERSION` in `consent.js` to ask everyone again after changing what you use.

## Things to customise before launch

- **Legal pages**: replace every highlighted `[placeholder]` in `privacy.html` and `terms.html` (legal entity name, address, contact emails, hosting/email providers, governing law, liability cap, offer window). These are written to match what the site actually does, but **have a lawyer review them** for your countries before launch.

- **Pricing** (`#pricing` in `index.html`): Creator $490 / Business $1,490 / Partner Custom are starting placeholders.
- **Offer**: "30% off for 6 months" and "free growth audit (worth $500)" appear in the hero, pricing, FAQ and waitlist section.
- **Launch timing**: "launching early 2027" in the hero badge.
- **Name check**: confirm the domain and trademark for "Upwell" in your market before printing anything.
