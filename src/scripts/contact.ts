type Turnstile = {
  ready: (callback: () => void) => void;
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
let challengeWait: number | undefined;
function setStatus(message: string, error = false) {
  status.textContent = message;
  status.dataset.error = String(error);
  status.setAttribute("role", error ? "alert" : "status");
}
function clearChallengeWait() {
  window.clearTimeout(challengeWait);
  challengeWait = undefined;
}
function challengeStatus(message: string, error = false) {
  if (!pending && !submissionFeedback) setStatus(message, error);
}
function waitForChallenge() {
  clearChallengeWait();
  challengeWait = window.setTimeout(() => {
    if (!token) challengeStatus("The spam check is taking longer than expected. Please refresh the page or email bill@endian.dev.", true);
  }, 30_000);
}
function challengeFailed(message: string) {
  clearChallengeWait();
  token = "";
  button.disabled = true;
  challengeStatus(message, true);
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
  waitForChallenge();
  script.addEventListener("error", () => challengeFailed("The spam check could not load. Please refresh the page or email bill@endian.dev."));
  script.addEventListener("load", () => {
    const initializationFailed = () => challengeFailed("The spam check could not start. Please refresh the page or email bill@endian.dev.");
    const turnstile = window.turnstile;
    if (!turnstile) { initializationFailed(); return; }
    try {
      turnstile.ready(() => {
        try {
          widget = turnstile.render(form.querySelector<HTMLElement>("[data-turnstile]")!, {
            sitekey: siteKey, action: "contact", size: "flexible",
            "response-field": false,
            callback: (value: string) => { clearChallengeWait(); token = value; button.disabled = pending; challengeStatus(""); },
            "before-interactive-callback": () => { clearChallengeWait(); challengeStatus("Please complete the spam check to send your message."); },
            "after-interactive-callback": () => { if (!token) { challengeStatus("Completing the spam check…"); waitForChallenge(); } },
            "expired-callback": () => { clearChallengeWait(); token = ""; button.disabled = true; challengeStatus("The spam check expired. Please complete it again."); },
            "error-callback": () => challengeFailed("The spam check could not complete. Please try again or email bill@endian.dev."),
            "timeout-callback": () => challengeFailed("The spam check timed out. Please try it again or email bill@endian.dev."),
            "unsupported-callback": () => challengeFailed("The spam check is not supported in this browser. Please try another browser or email bill@endian.dev.")
          });
        } catch { initializationFailed(); }
      });
    } catch { initializationFailed(); }
  });
  document.head.append(script);
}
export {};
