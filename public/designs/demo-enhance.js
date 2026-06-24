const menuItems = [
  ["Who We Are", "#who-we-are"],
  ["Where We Meet", "#where-we-meet"],
  ["Discernment", "#discernment"],
  ["The Scoop", "#the-scoop"],
  ["FAQ", "#faq"],
  ["Contact", "#contact"]
];

const setExternalLinkAttrs = () => {
  for (const link of document.querySelectorAll('a[href^="http"]')) {
    link.target = "_blank";
    link.rel = "noopener noreferrer";
  }
};

const bindSmoothAnchors = () => {
  for (const link of document.querySelectorAll('a[href^="#"]')) {
    link.addEventListener("click", (event) => {
      const id = link.hash.slice(1);
      const target = document.getElementById(id);

      if (!target) return;

      event.preventDefault();
      target.scrollIntoView({ block: "start", behavior: "smooth" });
      history.replaceState(null, "", `#${id}`);
    });
  }
};

const bindMobileMenus = () => {
  const closeMenu = (button, menu) => {
    menu.hidden = true;
    button.setAttribute("aria-expanded", "false");
    button.setAttribute("aria-label", "Open menu");
  };

  for (const [index, button] of document.querySelectorAll(".demo-menu-toggle").entries()) {
    const header = button.closest("header");
    if (!header) continue;

    const menu = document.createElement("nav");
    menu.id = `demo-mobile-menu-${index + 1}`;
    menu.className = "demo-mobile-menu";
    menu.hidden = true;
    menu.setAttribute("aria-label", "Mobile menu");
    menu.innerHTML = menuItems
      .map(([label, href]) => `<a href="${href}">${label}</a>`)
      .join("");

    button.setAttribute("aria-controls", menu.id);
    header.insertAdjacentElement("afterend", menu);

    button.addEventListener("click", () => {
      const isOpen = button.getAttribute("aria-expanded") === "true";
      menu.hidden = isOpen;
      button.setAttribute("aria-expanded", String(!isOpen));
      button.setAttribute("aria-label", isOpen ? "Open menu" : "Close menu");
    });

    menu.addEventListener("click", (event) => {
      if (event.target instanceof HTMLAnchorElement) {
        closeMenu(button, menu);
      }
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        closeMenu(button, menu);
      }
    });
  }
};

const bindDemoForms = () => {
  for (const form of document.querySelectorAll("form")) {
    for (const field of form.querySelectorAll("input, textarea")) {
      field.required = true;
    }

    form.addEventListener("submit", (event) => {
      event.preventDefault();

      if (!form.reportValidity()) return;

      let status = form.querySelector(".demo-form-status");
      if (!status) {
        status = document.createElement("p");
        status.className = "demo-form-status";
        status.setAttribute("aria-live", "polite");
        form.append(status);
      }

      status.textContent =
        "✓ Thanks! This is a demo site — nothing was actually sent.";
      form.reset();
    });
  }
};

setExternalLinkAttrs();
bindSmoothAnchors();
bindMobileMenus();
bindDemoForms();
