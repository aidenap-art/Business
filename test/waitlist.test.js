const { test, before, after } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "upwell-"));
process.env.DATA_DIR = dir;
process.env.ADMIN_TOKEN = "secret";
const { createServer } = require("../server.js");

let server, base;
before(async () => {
  server = createServer().listen(0);
  await new Promise((r) => server.once("listening", r));
  base = `http://localhost:${server.address().port}`;
});
after(() => { server.close(); fs.rmSync(dir, { recursive: true, force: true }); });

const join = (body) =>
  fetch(`${base}/api/waitlist`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

test("serves the landing page", async () => {
  const res = await fetch(base + "/");
  assert.equal(res.status, 200);
  assert.match(await res.text(), /Upwell/);
});

test("serves legal pages, cookie script and icons", async () => {
  for (const [url, re] of [["/privacy", /Privacy Policy/], ["/terms", /Terms of Service/], ["/consent.js", /upwell_consent/], ["/icons.svg", /<symbol id="arrow-right"/]]) {
    const res = await fetch(base + url);
    assert.equal(res.status, 200, url);
    assert.match(await res.text(), re, url);
  }
});

test("adds signups, dedupes, and validates", async () => {
  let res = await join({ email: "A@Example.com", name: "Ana", business: "Ana's Bakery", budget: "1k-5k" });
  assert.equal(res.status, 201);
  assert.equal((await res.json()).position, 1);

  res = await join({ email: "a@example.com" });
  const dup = await res.json();
  assert.equal(dup.already, true);
  assert.equal(dup.position, 1);

  res = await join({ email: "not-an-email" });
  assert.equal(res.status, 400);

  res = await join({ email: "b@example.com", budget: "a-million" });
  assert.equal(res.status, 400);

  res = await join({ email: "bot@example.com", website: "spam.com" }); // honeypot
  assert.equal(res.status, 200);

  const count = await (await fetch(base + "/api/waitlist/count")).json();
  assert.equal(count.count, 1);

  const saved = JSON.parse(fs.readFileSync(path.join(dir, "waitlist.json"), "utf8"));
  assert.equal(saved[0].email, "a@example.com");
});

test("export requires the admin token", async () => {
  assert.equal((await fetch(base + "/api/waitlist")).status, 401);
  assert.equal((await fetch(base + "/api/waitlist?token=wrong")).status, 401);
  const csv = await (await fetch(base + "/api/waitlist?token=secret&format=csv")).text();
  assert.match(csv, /^position,email,name,business,budget,createdAt\n1,a@example.com,Ana,Ana's Bakery,1k-5k,/);
});

test("blocks path traversal", async () => {
  const res = await fetch(base + "/..%2fserver.js");
  assert.notEqual(res.status, 200);
});
