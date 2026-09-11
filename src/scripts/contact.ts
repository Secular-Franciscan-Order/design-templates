type Turnstile = {
  render: (element: HTMLElement, options: Record<string, unknown>) => string;
  reset: (widget: string) => void;
};
class ContactResponseError extends Error {}
declare global { interface Window { turnstile?: Turnstile } }
const form = document.querySelector<HTMLFormElement>("#contact-form")!;
const button = form.querySelector<HTMLButtonElement>('button[type="submit"]')!;
const status = form.querySelector<HTMLElement>("[data-form-status]")!;
const siteKey = form.dataset.turnstileSiteKey;
if (/^#design-[1-5]$/.test(location.hash)) document.querySelector<HTMLAnchorElement>(location.hash)?.focus();
let token = "";
let widget = "";
let pending = false;
let submissionFeedback = false;
function setStatus(message: string, error = false) {
  status.textContent = message;
  status.dataset.error = String(error);
  status.setAttribute("role", error ? "alert" : "status");
}
function resetChallenge() {
  token = "";
  button.disabled = true;
  if (widget && window.turnstile) window.turnstile.reset(widget);
}
form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (pending || !form.reportValidity()) return;
  if (!token) { setStatus("Please complete the spam check before sending.", true); return; }
  pending = true;
  button.disabled = true;
  button.textContent = "Sending…";
  form.setAttribute("aria-busy", "true");
  setStatus("Sending your message…");
  submissionFeedback = true;
  const data = new FormData(form);
  const fields = Object.fromEntries(["name", "email", "fraternity", "design", "message", "website"].map((name) => [name, String(data.get(name) ?? "")]));
  try {
    const response = await fetch("/api/contact", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...fields, turnstileToken: token }),
      signal: AbortSignal.timeout(25000)
    });
    const result = await response.json() as { ok?: boolean; message?: string };
    if (!response.ok || result.ok !== true) throw new ContactResponseError(typeof result.message === "string" ? result.message : "Your message could not be sent. Please try again or email bill@endian.dev.");
    form.reset();
    setStatus(result.message || "Your message has been accepted for delivery. Thank you for getting in touch.");
  } catch (error) {
    setStatus(error instanceof ContactResponseError ? error.message : "We couldn’t confirm that your message was accepted. Please email bill@endian.dev before trying again.", true);
  } finally {
    pending = false;
    form.removeAttribute("aria-busy");
    button.textContent = "Send message";
    resetChallenge();
  }
});
if (siteKey) {
  const script = document.createElement("script");
  script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
  script.async = true;
  script.addEventListener("error", () => setStatus("The spam check could not load. Please email bill@endian.dev.", true));
  script.addEventListener("load", () => {
    if (!window.turnstile) return;
    widget = window.turnstile.render(form.querySelector<HTMLElement>("[data-turnstile]")!, {
      sitekey: siteKey, action: "contact", size: "flexible",
      "response-field": false,
      callback: (value: string) => { token = value; button.disabled = pending; if (!pending && !submissionFeedback) setStatus(""); },
      "expired-callback": () => { token = ""; button.disabled = true; if (!pending && !submissionFeedback) setStatus("The spam check expired. Please complete it again."); },
      "error-callback": () => { token = ""; button.disabled = true; if (!pending && !submissionFeedback) setStatus("The spam check could not complete. Please try again or email bill@endian.dev.", true); }
    });
  });
  document.head.append(script);
}
export {};
