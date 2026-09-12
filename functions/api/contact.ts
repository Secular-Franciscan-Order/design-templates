export interface ContactEnv {
  CLOUDFLARE_ACCOUNT_ID?: string;
  EMAIL_API_TOKEN?: string;
  EMAIL_FROM?: string;
  CONTACT_RECIPIENT?: string;
  TURNSTILE_SECRET_KEY?: string;
}
type Fetcher = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;
type Submission = { name: string; email: string; fraternity: string; design: string; message: string; website: string; turnstileToken: string };
const MAX_BYTES = 32 * 1024;
const DESIGNS = new Set(["", "Quiet Welcome", "Pilgrim’s Path", "Living Tradition", "Come and See", "Gospel to Life"]);
const FALLBACK = "Please email bill@endian.dev.";
const EMAIL = /^[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9](?:[A-Z0-9-]*[A-Z0-9])?(?:\.[A-Z0-9](?:[A-Z0-9-]*[A-Z0-9])?)+$/i;

function json(status: number, message: string, ok = false) {
  return Response.json({ ok, message }, { status, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", ...(status === 405 ? { Allow: "POST" } : {}) } });
}
function allowedHost(url: URL) {
  if (url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) return true;
  return url.protocol === "https:" && !url.port && (
    url.hostname === "ofs-demos.endian.dev" ||
    /^(?:[a-z0-9-]+\.)?design-templates-27d\.pages\.dev$/.test(url.hostname)
  );
}
async function readBody(request: Request): Promise<unknown> {
  if (Number(request.headers.get("content-length")) > MAX_BYTES) throw new RangeError("body");
  if (!request.body) throw new SyntaxError("body");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BYTES) { await reader.cancel(); throw new RangeError("body"); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
}
function submission(value: unknown): Submission | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  const limits = { name: 100, email: 254, fraternity: 160, design: 80, message: 5000, website: 200, turnstileToken: 2048 };
  if (Object.keys(input).some((key) => !Object.hasOwn(limits, key))) return null;
  const result: Record<string, string> = {};
  for (const [key, max] of Object.entries(limits)) {
    const raw = input[key] ?? "";
    if (typeof raw !== "string" || raw.length > max) return null;
    const clean = raw.trim();
    if ((key === "message" ? /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/ : /[\u0000-\u001f\u007f]/).test(clean)) return null;
    result[key] = clean;
  }
  if (!result.name || !EMAIL.test(result.email) || !result.message || !result.turnstileToken || !DESIGNS.has(result.design)) return null;
  return result as Submission;
}
function configured(env: ContactEnv) {
  return /^[a-f0-9]{32}$/i.test(env.CLOUDFLARE_ACCOUNT_ID ?? "") &&
    Boolean(env.EMAIL_API_TOKEN?.trim()) && Boolean(env.TURNSTILE_SECRET_KEY?.trim()) &&
    EMAIL.test(env.CONTACT_RECIPIENT ?? "") && EMAIL.test(env.EMAIL_FROM ?? "");
}

// The injectable transport lets the deterministic tests exercise the real handler
// without transmitting visitor data, verifying a token, or sending any email.
export async function handleContact(request: Request, env: ContactEnv, fetcher: Fetcher = fetch): Promise<Response> {
  if (request.method !== "POST") return json(405, "Use the contact form to send a message.");
  const url = new URL(request.url);
  if (!allowedHost(url) || request.headers.get("origin") !== url.origin) return json(403, "This request could not be accepted.");
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") return json(415, "The form request must use JSON.");
  let raw: unknown;
  try { raw = await readBody(request); }
  catch (error) { return json(error instanceof RangeError ? 413 : 400, "Please check your message and try again."); }
  const fields = submission(raw);
  if (!fields || fields.website) return json(400, "Please check your name, email, message, and spam check.");
  if (!configured(env)) return json(503, `The contact form is not available yet. ${FALLBACK}`);

  try {
    const response = await fetcher("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secret: env.TURNSTILE_SECRET_KEY, response: fields.turnstileToken, remoteip: request.headers.get("CF-Connecting-IP") ?? undefined }),
      signal: AbortSignal.timeout(8000)
    });
    const verification = await response.json() as { success?: boolean; hostname?: string; action?: string };
    if (!response.ok) return json(503, `The spam check is temporarily unavailable. ${FALLBACK}`);
    if (verification.success !== true || verification.hostname !== url.hostname || verification.action !== "contact") return json(400, "Please complete a fresh spam check and try again.");
  } catch { return json(503, `The spam check is temporarily unavailable. ${FALLBACK}`); }

  const message = [
    "Fraternity website inquiry", "",
    `Name: ${fields.name}`, `Email: ${fields.email}`,
    `Fraternity: ${fields.fraternity || "Not provided"}`,
    `Design interest: ${fields.design || "Still exploring"}`,
    "", "Message:", fields.message
  ].join("\n");
  try {
    const response = await fetcher(`https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/email/sending/send`, {
      method: "POST", headers: { Authorization: `Bearer ${env.EMAIL_API_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({ to: env.CONTACT_RECIPIENT, from: env.EMAIL_FROM, reply_to: fields.email, subject: "Fraternity website inquiry", text: message }),
      signal: AbortSignal.timeout(10000)
    });
    const delivery = await response.json() as { success?: boolean; errors?: unknown[]; result?: { delivered?: string[]; queued?: string[]; permanent_bounces?: string[] } };
    const recipient = env.CONTACT_RECIPIENT!.toLowerCase();
    const result = delivery.result;
    const accepted = [...(Array.isArray(result?.delivered) ? result.delivered : []), ...(Array.isArray(result?.queued) ? result.queued : [])];
    if (!response.ok || delivery.success !== true || !Array.isArray(delivery.errors) || delivery.errors.length || !Array.isArray(result?.permanent_bounces) || result.permanent_bounces.length || !accepted.some((address) => typeof address === "string" && address.toLowerCase() === recipient)) {
      return json(502, `Your message was not confirmed as accepted. ${FALLBACK}`);
    }
    return json(200, "Your message has been accepted for delivery. Thank you for getting in touch.", true);
  } catch { return json(502, `We couldn’t confirm whether your message was accepted. Please email bill@endian.dev before trying again.`); }
}

export const onRequest = ({ request, env }: { request: Request; env: ContactEnv }) => handleContact(request, env);
