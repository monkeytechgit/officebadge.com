/* WhatsApp floating action button (FAB)
   Creates a prefilled message that includes the current page title + URL.
*/

(() => {
  const WHATSAPP_E164 = "526643053834"; // +52 664 305 3834

  function buildMessage() {
    const title = (document.title || "this page").trim();
    const parts = [
      "Hi OfficeBadge,",
      "I'm interested in a quote.",
      title ? `I'm viewing: ${title}.` : null,
    ].filter(Boolean);

    return parts.join(" ");
  }

  document.addEventListener("DOMContentLoaded", () => {
    const message = encodeURIComponent(buildMessage());
    const href = `https://wa.me/${WHATSAPP_E164}?text=${message}`;

    document.querySelectorAll("[data-whatsapp-link]").forEach((link) => {
      link.setAttribute("href", href);
    });
  });
})();
