// Upwell — landing page + waitlist server.
// Zero dependencies: runs on any Node 18+ host (Render, Railway, Fly.io, a VPS…).
//
//   PORT          port to listen on (default 3000)
//   DATA_DIR      where waitlist.json is stored (default ./data)
//   ADMIN_TOKEN   required to export signups (GET /api/waitlist?token=...)

const http = require("node:http");
const fs = require("node:fs");
const fsp = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");

const PORT = Number(process.env.PORT) || 3000;
const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(__dirname, "data"));
const DATA_FILE = path.join(DATA_DIR, "waitlist.json");
const PUBLIC_DIR = path.join(__dirname, "public");
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "";

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
};

const BUDGETS = new Set(["", "under-1k", "1k-5k", "5k-20k", "20k-plus", "not-sure"]);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// ---------- storage (single JSON file, writes serialized + atomic) ----------
let entries = [];
let writeChain = Promise.resolve();

function load() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  try {
    entries = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
    if (!Array.isArray(entries)) entries = [];
  } catch {
    entries = [];
  }
}

function persist() {
  writeChain = writeChain.then(async () => {
    const tmp = DATA_FILE + "." + crypto.randomBytes(4).toString("hex") + ".tmp";
    await fsp.writeFile(tmp, JSON.stringify(entries, null, 2));
    await fsp.rename(tmp, DATA_FILE);
  });
  return writeChain;
}

// ---------- tiny per-IP rate limiter ----------
const hits = new Map();
function rateLimited(ip, limit = 10, windowMs = 60_000) {
  const now = Date.now();
  const list = (hits.get(ip) || []).filter((t) => now - t < windowMs);
  list.push(now);
  hits.set(ip, list);
  return list.length > limit;
}

// ---------- helpers ----------
function send(res, status, body, headers = {}) {
  const isObj = typeof body === "object" && !Buffer.isBuffer(body);
  res.writeHead(status, {
    "Content-Type": isObj ? "application/json; charset=utf-8" : "text/plain; charset=utf-8",
    "X-Content-Type-Options": "nosniff",
    ...headers,
  });
  res.end(isObj ? JSON.stringify(body) : body);
}

function readBody(req, max = 10_000) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", (c) => {
      size += c.length;
      if (size > max) {
        reject(new Error("too large"));
        req.destroy();
      } else chunks.push(c);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

const clean = (v, max) => String(v ?? "").trim().slice(0, max);

function csvCell(v) {
  let s = String(v ?? "");
  if (/^[=+\-@]/.test(s)) s = "'" + s; // avoid spreadsheet formula injection
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function authorized(url) {
  if (!ADMIN_TOKEN) return false;
  const given = Buffer.from(url.searchParams.get("token") || "");
  const expected = Buffer.from(ADMIN_TOKEN);
  return given.length === expected.length && crypto.timingSafeEqual(given, expected);
}

// ---------- handlers ----------
async function joinWaitlist(req, res) {
  const ip = (req.headers["x-forwarded-for"] || "").split(",")[0].trim() || req.socket.remoteAddress;
  if (rateLimited(ip)) return send(res, 429, { error: "Too many requests. Try again in a minute." });

  let data;
  try {
    data = JSON.parse(await readBody(req));
  } catch {
    return send(res, 400, { error: "Invalid request." });
  }

  // Honeypot: real people never fill the hidden "website" field.
  if (data.website) return send(res, 200, { ok: true, position: entries.length + 1 });

  const email = clean(data.email, 254).toLowerCase();
  const name = clean(data.name, 100);
  const business = clean(data.business, 150);
  const budget = clean(data.budget, 20);

  if (!EMAIL_RE.test(email)) return send(res, 400, { error: "Please enter a valid email address." });
  if (!BUDGETS.has(budget)) return send(res, 400, { error: "Please pick a budget from the list." });

  const existing = entries.findIndex((e) => e.email === email);
  if (existing !== -1) {
    return send(res, 200, { ok: true, already: true, position: existing + 1 });
  }

  entries.push({ email, name, business, budget, createdAt: new Date().toISOString() });
  const position = entries.length;
  try {
    await persist();
  } catch (err) {
    console.error("Failed to save waitlist:", err);
    return send(res, 500, { error: "Something went wrong on our side. Please try again." });
  }
  console.log(`Waitlist +1 (#${position})`);
  send(res, 201, { ok: true, position });
}

function exportWaitlist(url, res) {
  if (!authorized(url)) return send(res, 401, { error: "Unauthorized" });
  if (url.searchParams.get("format") === "csv") {
    const rows = [["position", "email", "name", "business", "budget", "createdAt"]];
    entries.forEach((e, i) => rows.push([i + 1, e.email, e.name, e.business, e.budget, e.createdAt]));
    return send(res, 200, rows.map((r) => r.map(csvCell).join(",")).join("\n") + "\n", {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="upwell-waitlist.csv"',
    });
  }
  send(res, 200, { count: entries.length, entries });
}

async function serveStatic(url, res) {
  let rel = decodeURIComponent(url.pathname);
  if (rel.endsWith("/")) rel += "index.html";
  else if (!path.extname(rel)) rel += ".html"; // clean URLs: /privacy -> privacy.html
  const file = path.join(PUBLIC_DIR, path.normalize(rel));
  if (!file.startsWith(PUBLIC_DIR + path.sep)) return send(res, 403, "Forbidden");
  try {
    const body = await fsp.readFile(file);
    res.writeHead(200, {
      "Content-Type": MIME[path.extname(file)] || "application/octet-stream",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": file.endsWith(".html") ? "no-cache" : "public, max-age=3600",
    });
    res.end(body);
  } catch {
    const notFound = await fsp.readFile(path.join(PUBLIC_DIR, "index.html")).catch(() => null);
    res.writeHead(404, { "Content-Type": "text/html; charset=utf-8" });
    res.end(notFound || "Not found");
  }
}

function createServer() {
  return http.createServer(async (req, res) => {
    const url = new URL(req.url, "http://localhost");
    try {
      if (url.pathname === "/api/waitlist" && req.method === "POST") return await joinWaitlist(req, res);
      if (url.pathname === "/api/waitlist" && req.method === "GET") return exportWaitlist(url, res);
      if (url.pathname === "/api/waitlist/count" && req.method === "GET")
        return send(res, 200, { count: entries.length });
      if (url.pathname === "/healthz") return send(res, 200, "ok");
      if (req.method !== "GET" && req.method !== "HEAD") return send(res, 405, "Method not allowed");
      return await serveStatic(url, res);
    } catch (err) {
      console.error(err);
      if (!res.headersSent) send(res, 500, { error: "Server error" });
    }
  });
}

load();

if (require.main === module) {
  createServer().listen(PORT, () => {
    console.log(`Upwell running on http://localhost:${PORT}  (${entries.length} on waitlist)`);
    if (!ADMIN_TOKEN) console.log("Tip: set ADMIN_TOKEN to enable exporting the waitlist.");
  });
}

module.exports = { createServer };
