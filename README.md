# Upwell

**Online marketing & ads for growing businesses.** This repo is Upwell's landing page and waitlist.

*Why "Upwell"?* In the ocean, an upwelling is a rising current that brings nutrients up to the surface, which is roughly what good marketing does for a business. The tagline is "Marketing that brings customers to the surface."

## What's here

```
public/          Landing page (plain HTML/CSS/JS, no build step)
  index.html     Hero, services, how it works, promises, pricing, FAQ, waitlist form
  styles.css
  app.js         Form handling, success state, share button, scroll reveals
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

## Things to customise before launch

- **Pricing** (`#pricing` in `index.html`): $990 / $2,400 / Custom are starting placeholders.
- **Offer**: "30% off for 6 months" and "free growth audit (worth $500)" appear in the hero, pricing, FAQ and waitlist section.
- **Launch timing**: "launching early 2027" in the hero badge.
- **Name check**: confirm the domain and trademark for "Upwell" in your market before printing anything.
