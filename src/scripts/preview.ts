type Design = { slug: string; title: string; src: string; listed: boolean };
const data = JSON.parse(document.getElementById("template-data")!.textContent!) as { templates: Design[] };
const listed = data.templates.filter((design) => design.listed);
const frame = document.querySelector<HTMLIFrameElement>("[data-preview-frame]")!;
const title = document.querySelector<HTMLHeadingElement>("[data-template-title]")!;
const number = document.querySelector<HTMLElement>("[data-design-number]")!;
const previous = document.querySelector<HTMLButtonElement>("[data-previous]")!;
const next = document.querySelector<HTMLButtonElement>("[data-next]")!;
const back = document.querySelector<HTMLAnchorElement>(".back-to-designs")!;
const entryIndex = listed.findIndex((design) => design.slug === new URLSearchParams(location.search).get("d"));
back.href = entryIndex < 0 ? "/#designs" : `/#design-${entryIndex + 1}`;
let current: Design;
function readLocation() {
  return data.templates.find((design) => design.slug === new URLSearchParams(location.search).get("d")) ?? listed[0];
}
function render(design: Design, mode: "push" | "replace" | "pop" = "push", focus = false) {
  current = design;
  const index = listed.findIndex((item) => item.slug === current.slug);
  title.textContent = current.title;
  number.textContent = index < 0 ? "Archived design · outside this collection" : `Design ${index + 1} of ${listed.length}`;
  previous.disabled = index <= 0;
  next.disabled = index < 0 || index === listed.length - 1;
  if (frame.getAttribute("src") !== current.src) frame.src = current.src;
  frame.title = `${current.title} website design`;
  document.title = `${current.title} · Design preview`;
  if (mode !== "pop") {
    const url = new URL(location.href);
    url.search = "";
    url.searchParams.set("d", current.slug);
    history[mode === "replace" ? "replaceState" : "pushState"]({ design: current.slug }, "", url);
  }
  if (focus) title.focus({ preventScroll: true });
}
previous.addEventListener("click", () => {
  const index = listed.indexOf(current);
  if (index > 0) render(listed[index - 1], "push", true);
});
next.addEventListener("click", () => {
  const index = listed.indexOf(current);
  if (index >= 0 && index < listed.length - 1) render(listed[index + 1], "push", true);
});
window.addEventListener("popstate", () => render(readLocation(), "pop"));
render(readLocation(), "replace");
export {};
