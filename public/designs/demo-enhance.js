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
      target.scrollIntoView({ block: "start", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
      try { history.replaceState(null, "", `#${id}`); } catch { /* Opaque preview origin; scrolling still works. */ }
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
    const sourceNav = header.querySelector(".desktop-nav");
    if (!sourceNav) continue;
    for (const link of sourceNav.querySelectorAll("a")) menu.append(link.cloneNode(true));
    if (document.getElementById("contact") && !menu.querySelector('a[href="#contact"]')) {
      const contact = document.createElement("a");
      contact.href = "#contact";
      contact.textContent = "Contact";
      menu.append(contact);
    }

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
    const showDemoFeedback = (event) => {
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
    };
    form.addEventListener("submit", showDemoFeedback);
    // In the opaque preview, allow-forms is intentionally absent. Handle the
    // button before its native submit action so the non-sending demo still works.
    for (const button of form.querySelectorAll('button[type="submit"]')) button.addEventListener("click", showDemoFeedback);
    // Controls start disabled in HTML, preventing native submission if JavaScript fails.
    form.removeAttribute("action");
    for (const field of form.querySelectorAll("input, textarea")) {
      field.required = true;
      field.disabled = false;
    }
    for (const button of form.querySelectorAll('button[type="submit"]')) button.disabled = false;
  }
};

setExternalLinkAttrs();
bindMobileMenus();
bindSmoothAnchors();
bindDemoForms();
