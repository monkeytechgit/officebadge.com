/* Mobile/tablet hamburger nav toggle */

(() => {
  const MOBILE_MAX_WIDTH = 1024;

  function setExpanded(btn, expanded) {
    btn.setAttribute("aria-expanded", expanded ? "true" : "false");
  }

  function isMobileWidth() {
    return window.innerWidth <= MOBILE_MAX_WIDTH;
  }

  document.addEventListener("DOMContentLoaded", () => {
    const btn = document.querySelector("[data-nav-toggle]");
    const nav = document.getElementById("primary-nav");
    if (!btn || !nav) return;

    const productsLink = nav.querySelector(".nav__dropdown > a");
    const productsDropdown = productsLink ? productsLink.closest(".nav__dropdown") : null;

    if (productsLink && productsDropdown) {
      productsLink.setAttribute("aria-expanded", "false");

      productsLink.addEventListener("click", (e) => {
        if (!isMobileWidth()) return;
        e.preventDefault();
        const isSubopen = productsDropdown.classList.toggle("is-subopen");
        productsLink.setAttribute("aria-expanded", isSubopen ? "true" : "false");
      });
    }

    setExpanded(btn, false);

    btn.addEventListener("click", () => {
      const isOpen = nav.classList.toggle("is-open");
      setExpanded(btn, isOpen);

      if (!isOpen && productsDropdown) {
        productsDropdown.classList.remove("is-subopen");
        productsLink?.setAttribute("aria-expanded", "false");
      }
    });

    // Close on resize back to desktop.
    window.addEventListener("resize", () => {
      if (window.innerWidth > MOBILE_MAX_WIDTH && nav.classList.contains("is-open")) {
        nav.classList.remove("is-open");
        setExpanded(btn, false);
      }

      if (window.innerWidth > MOBILE_MAX_WIDTH && productsDropdown) {
        productsDropdown.classList.remove("is-subopen");
        productsLink?.setAttribute("aria-expanded", "false");
      }
    });
  });
})();
