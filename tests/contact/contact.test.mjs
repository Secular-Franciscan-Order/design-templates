import { test } from "node:test";
import assert from "node:assert/strict";
import { handleContact } from "../../functions/api/contact.ts";

const env = { CLOUDFLARE_ACCOUNT_ID: "a".repeat(32), EMAIL_API_TOKEN: "test-token", EMAIL_FROM: "sender@example.org", CONTACT_RECIPIENT: "owner@example.org", TURNSTILE_SECRET_KEY: "test-secret" };
const valid = { name: "Alex Example", email: "alex@example.org", fraternity: "St. Clare", design: "Quiet Welcome", message: "I would like to discuss a website.", website: "", turnstileToken: "single-use-test-token" };
const origin = "https://ofs-demos.endian.dev";
const request = (body = valid, extra = {}) => new Request(`${origin}/api/contact`, { method: "POST", headers: { origin, "Content-Type": "application/json" }, body: JSON.stringify(body), ...extra });
function transport({ verification = {}, delivery = {}, status = 200, thrown = false } = {}) {
  const calls = [];
  const fetcher = async (url, init) => {
    calls.push({ url, body: JSON.parse(init.body), init });
    assert.ok(init.signal instanceof AbortSignal, "upstream requests have deadlines");
    if (String(url).includes("siteverify")) return Response.json({ success: true, hostname: "ofs-demos.endian.dev", action: "contact", ...verification });
    if (thrown) throw new Error("upstream timeout");
    return Response.json({ success: true, errors: [], result: { delivered: [env.CONTACT_RECIPIENT], permanent_bounces: [], queued: [] }, ...delivery }, { status });
  };
  return { calls, fetcher };
}
test("delivered acceptance uses only configured routing and plain text", async () => {
  const { calls, fetcher } = transport();
  const response = await handleContact(request({ ...valid, message: '<img src="x">\nSecond line' }), env, fetcher);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).ok, true);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(calls.length, 2);
  assert.match(calls[1].url, /\/accounts\/a{32}\/email\/sending\/send$/);
  assert.equal(calls[1].body.to, env.CONTACT_RECIPIENT);
  assert.equal(calls[1].body.from, env.EMAIL_FROM);
  assert.equal(calls[1].body.reply_to, valid.email);
  assert.equal(calls[1].body.subject, "Fraternity website inquiry");
  assert.equal(calls[1].body.html, undefined);
  assert.match(calls[1].body.text, /<img src="x">\nSecond line/);
});
test("queued response confirms acceptance without claiming delivery", async () => {
  const { fetcher } = transport({ delivery: { result: { delivered: [], queued: [env.CONTACT_RECIPIENT], permanent_bounces: [] } } });
  const response = await handleContact(request(), env, fetcher);
  assert.equal(response.status, 200);
  assert.match((await response.json()).message, /accepted for delivery/);
});
test("rejects method, cross-origin, untrusted hosts, missing origin, and non-JSON before contacting providers", async () => {
  const { calls, fetcher } = transport();
  const attempts = [
    [new Request(`${origin}/api/contact`), 405],
    [request(valid, { headers: { origin: "https://attacker.example", "Content-Type": "application/json" } }), 403],
    [new Request("https://attacker.example/api/contact", { method: "POST", headers: { origin: "https://attacker.example", "Content-Type": "application/json" }, body: JSON.stringify(valid) }), 403],
    [request(valid, { headers: { "Content-Type": "application/json" } }), 403],
    [request(valid, { headers: { origin, "Content-Type": "text/plain" } }), 415]
  ];
  for (const [attempt, code] of attempts) assert.equal((await handleContact(attempt, env, fetcher)).status, code);
  assert.equal(calls.length, 0);
});
test("validates actual Pages preview hosts and exact Turnstile hostname", async () => {
  for (const hostname of ["design-templates-27d.pages.dev", "codex-issue-20-demo-refresh.design-templates-27d.pages.dev", "abc123.design-templates-27d.pages.dev"]) {
    const { fetcher } = transport({ verification: { hostname } });
    const url = `https://${hostname}`;
    const attempt = new Request(`${url}/api/contact`, { method: "POST", headers: { origin: url, "Content-Type": "application/json" }, body: JSON.stringify(valid) });
    assert.equal((await handleContact(attempt, env, fetcher)).status, 200);
  }
  for (const hostname of ["evil-design-templates-27d.pages.dev", "abc.design-templates-27d.pages.dev.evil.test", "unrelated.pages.dev"]) {
    const { calls, fetcher } = transport();
    const url = `https://${hostname}`;
    const attempt = new Request(`${url}/api/contact`, { method: "POST", headers: { origin: url, "Content-Type": "application/json" }, body: JSON.stringify(valid) });
    assert.equal((await handleContact(attempt, env, fetcher)).status, 403);
    assert.equal(calls.length, 0);
  }
});
test("invalid, oversized, malformed, and honeypot submissions never reach providers", async () => {
  const { calls, fetcher } = transport();
  const invalid = [null, [], { ...valid, name: " " }, { ...valid, message: " " }, { ...valid, email: "alex@example.org\r\nBcc: other@example.org" }, { ...valid, email: "a@b.org,c@d.org" }, { ...valid, name: "x".repeat(101) }, { ...valid, message: "x".repeat(5001) }, { ...valid, message: 1 }, { ...valid, website: "bot.example.org" }, { ...valid, design: "Unknown" }, { ...valid, turnstileToken: "" }, { ...valid, to: "other@example.org" }];
  for (const body of invalid) assert.equal((await handleContact(request(body), env, fetcher)).status, 400);
  assert.equal((await handleContact(request(valid, { body: "{" }), env, fetcher)).status, 400);
  assert.equal((await handleContact(request(valid, { body: "x".repeat(33000) }), env, fetcher)).status, 413);
  assert.equal(calls.length, 0);
});
test("missing or malformed deployment configuration fails honestly", async () => {
  const { calls, fetcher } = transport();
  for (const key of Object.keys(env)) {
    const response = await handleContact(request(), { ...env, [key]: undefined }, fetcher);
    assert.equal(response.status, 503);
    assert.match((await response.json()).message, /bill@endian.dev/);
  }
  assert.equal((await handleContact(request(), { ...env, CONTACT_RECIPIENT: "bad\nrecipient" }, fetcher)).status, 503);
  assert.equal(calls.length, 0);
});
test("failed, wrong-site, and wrong-action spam checks do not send mail", async () => {
  for (const verification of [{ success: false }, { hostname: "other.example.org" }, { action: "login" }]) {
    const { calls, fetcher } = transport({ verification });
    assert.equal((await handleContact(request(), env, fetcher)).status, 400);
    assert.equal(calls.length, 1);
  }
});
test("bounce, false success, errors, unknown recipient, and provider failures never report success", async () => {
  const results = [
    { success: false }, { errors: [{ message: "provider rejection" }] },
    { result: { delivered: [], queued: [], permanent_bounces: [env.CONTACT_RECIPIENT] } },
    { result: { delivered: [env.CONTACT_RECIPIENT], queued: [], permanent_bounces: [env.CONTACT_RECIPIENT] } },
    { result: { delivered: ["other@example.org"], queued: [], permanent_bounces: [] } },
    { result: { delivered: [], queued: [], permanent_bounces: [] } }, { result: null }
  ];
  for (const delivery of results) {
    const { fetcher } = transport({ delivery });
    const response = await handleContact(request(), env, fetcher);
    assert.equal(response.status, 502);
    assert.equal((await response.json()).ok, false);
  }
  assert.equal((await handleContact(request(), env, transport({ status: 503 }).fetcher)).status, 502);
  const unknown = await handleContact(request(), env, transport({ thrown: true }).fetcher);
  assert.equal(unknown.status, 502);
  assert.match((await unknown.json()).message, /before trying again/);
});
test("unavailable spam verification fails closed", async () => {
  const response = await handleContact(request(), env, async () => { throw new Error("timeout"); });
  assert.equal(response.status, 503);
  assert.equal((await response.json()).ok, false);
});
