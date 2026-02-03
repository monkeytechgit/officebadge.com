/* Quote modal + Supabase submit (client-side)
   Note: Ensure Supabase RLS policies allow INSERT for anon key on public.contact_webpage.
*/

(() => {
  const SUPABASE_URL = "https://syybzslumpqqhrgmmeux.supabase.co";
  const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN5eWJ6c2x1bXBxcWhyZ21tZXV4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg4NDYxNjksImV4cCI6MjA4NDQyMjE2OX0.3tOICNWzxyJjS8I1sT-zeJnnnipP3AGRknbt8tEqE40";

  // EmailJS configuration
  const EMAILJS_PUBLIC_KEY = "5vTFdcXJ0G3y7ZaPs";
  const EMAILJS_SERVICE_ID = "service_z1d7utk";
  const EMAILJS_TEMPLATE_ID = "template_y4y0gl8";

  let emailJsInitPromise = null;

  function ensureEmailJsLoadedAndInit() {
    if (emailJsInitPromise) return emailJsInitPromise;

    emailJsInitPromise = new Promise((resolve, reject) => {
      const init = () => {
        try {
          if (!window.emailjs || typeof window.emailjs.send !== "function") {
            throw new Error("EmailJS SDK not available");
          }
          window.emailjs.init({ publicKey: EMAILJS_PUBLIC_KEY });
          resolve();
        } catch (e) {
          reject(e);
        }
      };

      if (window.emailjs && typeof window.emailjs.send === "function") {
        init();
        return;
      }

      const existing = document.querySelector('script[data-emailjs-sdk="true"]');
      if (existing) {
        existing.addEventListener("load", init, { once: true });
        existing.addEventListener("error", () => reject(new Error("Could not load EmailJS")), { once: true });
        return;
      }

      const script = document.createElement("script");
      script.type = "text/javascript";
      script.src = "https://cdn.jsdelivr.net/npm/@emailjs/browser@4/dist/email.min.js";
      script.async = true;
      script.setAttribute("data-emailjs-sdk", "true");
      script.onload = init;
      script.onerror = () => reject(new Error("Could not load EmailJS"));
      document.head.appendChild(script);
    });

    return emailJsInitPromise;
  }

  function $(selector, root = document) {
    return root.querySelector(selector);
  }

  function $all(selector, root = document) {
    return Array.from(root.querySelectorAll(selector));
  }

  function normalizeOptional(value) {
    const trimmed = (value ?? "").toString().trim();
    return trimmed.length ? trimmed : null;
  }

  function toTimestampOrNull(dateValue) {
    const v = (dateValue ?? "").toString().trim();
    if (!v) return null;
    // Store as a timestamp without timezone in Postgres.
    // Send a simple ISO-like timestamp string.
    return `${v}T00:00:00`;
  }

  function getProductNameFromJsonLd() {
    const scripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
    for (const script of scripts) {
      const raw = (script.textContent ?? "").trim();
      if (!raw) continue;

      let json;
      try {
        json = JSON.parse(raw);
      } catch {
        continue;
      }

      const candidates = [];
      if (Array.isArray(json)) candidates.push(...json);
      else if (json && typeof json === "object") {
        if (Array.isArray(json["@graph"])) candidates.push(...json["@graph"]);
        else candidates.push(json);
      }

      for (const item of candidates) {
        if (!item || typeof item !== "object") continue;
        const type = item["@type"];
        const isProduct =
          type === "Product" ||
          (Array.isArray(type) && type.includes("Product")) ||
          (typeof type === "string" && type.split(/\s+/).includes("Product"));
        if (!isProduct) continue;
        const name = (item.name ?? "").toString().trim();
        if (name) return name;
      }
    }

    return null;
  }

  function getProductNameFromMeta() {
    const alt = document
      .querySelector('meta[property="og:image:alt"]')
      ?.getAttribute("content")
      ?.toString()
      .trim();
    if (alt) return alt;

    const ogTitle = document
      .querySelector('meta[property="og:title"]')
      ?.getAttribute("content")
      ?.toString()
      .trim();
    if (ogTitle) return ogTitle.split("|")[0].trim() || ogTitle;

    return null;
  }

  function getSuggestedProductType() {
    // For product pages, prefer the actual product name (JSON-LD / OG meta)
    // over a shorter on-page heading.
    if (isProductPage()) {
      const structuredName = getProductNameFromJsonLd();
      if (structuredName) return structuredName;

      const metaName = getProductNameFromMeta();
      if (metaName) return metaName;
    }

    const h1 = document.querySelector("main h1") || document.querySelector("h1");
    const h1Text = (h1?.textContent ?? "").trim();
    if (h1Text) return h1Text;

    const rawTitle = (document.title ?? "").trim();
    if (!rawTitle) return null;
    // Titles are typically like: "Full Badge Kit — Horizontal | ..."
    return rawTitle.split("|")[0].trim() || null;
  }

  function getProductTypeSelect(form) {
    if (!form) return null;

    const byElements =
      form.elements?.productType ||
      form.elements?.["product-type"] ||
      form.elements?.["product_type"]; // defensive

    if (byElements && byElements.tagName === "SELECT") return byElements;

    return (
      form.querySelector(
        'select[name="productType"], select[name="product-type"], select[name="product_type"], select#productType, select#product-type, select#product_type'
      ) || null
    );
  }

  function isProductPage() {
    const ogType = document
      .querySelector('meta[property="og:type"]')
      ?.getAttribute("content")
      ?.toLowerCase()
      .trim();
    return ogType === "product";
  }

  function isHomePage() {
    const path = (window.location?.pathname ?? "").toString().toLowerCase();
    return path === "/" || path.endsWith("/index.html") || path.endsWith("index.html");
  }

  function getProductTypeHintFromTrigger(triggerEl) {
    // On the homepage, never pre-select a product type when opening the quote dialog.
    // (Avoids auto-selecting things like "Custom Design" from nearby card titles.)
    if (isHomePage()) return { value: null, allowInsert: false };

    const explicit =
      triggerEl?.getAttribute?.("data-product-type") ||
      triggerEl?.getAttribute?.("data-quote-product") ||
      triggerEl?.dataset?.productType ||
      triggerEl?.dataset?.quoteProduct;

    const explicitTrimmed = (explicit ?? "").toString().trim();
    if (explicitTrimmed) return { value: explicitTrimmed, allowInsert: true };

    const card = triggerEl?.closest?.(".card");
    if (card) {
      const titleEl = $(".card__title", card);
      const titleText = (titleEl?.textContent ?? "").trim();
      if (titleText) return { value: titleText, allowInsert: true };
    }

    return { value: getSuggestedProductType(), allowInsert: isProductPage() };
  }

  function setProductTypeValue(form, value, { onlyIfEmpty = false, allowInsert = false } = {}) {
    const select = getProductTypeSelect(form);
    if (!select) return;

    const desired = (value ?? "").toString().trim();
    if (!desired) return;

    if (onlyIfEmpty && (select.value ?? "").toString().trim()) return;

    const hasOption = Array.from(select.options).some((o) => o.value === desired);
    if (!hasOption && !allowInsert) return;

    if (!hasOption) {
      const opt = document.createElement("option");
      opt.value = desired;
      opt.textContent = desired;

      // Insert right after the placeholder option if present.
      const first = select.options[0];
      if (first && first.disabled) {
        select.insertBefore(opt, first.nextSibling);
      } else {
        select.appendChild(opt);
      }
    }

    select.value = desired;
  }

  async function submitToSupabase(form) {
    const statusEl = $("[data-quote-status]", form) || $("[data-quote-status]");
    const submitBtn = $("[data-quote-submit]", form);

    const fullName = (form.elements.fullName?.value ?? "").trim();
    const email = (form.elements.email?.value ?? "").trim();
    const phone = normalizeOptional(form.elements.phone?.value);
    const company = normalizeOptional(form.elements.company?.value);
    const productType = (form.elements.productType?.value ?? "").trim();
    const estimatedQty = (form.elements.estimatedQty?.value ?? "").trim();
    const desiredDeliveryDateRaw = (form.elements.desiredDeliveryDate?.value ?? "").toString().trim();
    const desiredDeliveryDate = toTimestampOrNull(desiredDeliveryDateRaw);
    const projectDescription = normalizeOptional(form.elements.projectDescription?.value);

    const payload = {
      "full-name": fullName,
      email,
      phone,
      company,
      "product-type": productType,
      "estimated-quantity": estimatedQty,
      "delivery-date": desiredDeliveryDate,
      "project-description": projectDescription,
    };

    if (statusEl) {
      statusEl.classList.remove("quote-status--success", "quote-status--error");
      statusEl.textContent = "Sending…";
    }
    if (submitBtn) submitBtn.disabled = true;

    try {
      // 1) Send EmailJS notification first
      try {
        await ensureEmailJsLoadedAndInit();

        const producto = productType;
        const templateParams = {
          nombre: fullName,
          empresa: company ?? "",
          correo: email,
          telefono: phone ?? "",
          producto,
          cantidad: estimatedQty,
          entrega: desiredDeliveryDateRaw || "",
          descripcion: projectDescription ?? "",
          title: `Office Badge | Cotización: ${producto || ""}`.trim(),
          name: fullName,
        };

        const emailResp = await window.emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, templateParams);
        // eslint-disable-next-line no-console
        console.log("✅ EmailJS sent:", emailResp);
      } catch (emailErr) {
        // eslint-disable-next-line no-console
        console.warn("EmailJS send failed:", emailErr);
      }

      // 2) Send to Supabase as backup
      const res = await fetch(`${SUPABASE_URL}/rest/v1/contact_webpage`, {
        method: "POST",
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          "Content-Type": "application/json",
          Prefer: "return=minimal",
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        throw new Error(errText || `Request failed (${res.status})`);
      }

      if (statusEl) {
        statusEl.classList.remove("quote-status--error");
        statusEl.classList.add("quote-status--success");
        statusEl.textContent = "Thanks — we received your request. We'll follow up shortly.";
      }
      form.reset();

      // Close modal if this form is inside the dialog.
      const dialog = form.closest("dialog");
      if (dialog && typeof dialog.close === "function") {
        setTimeout(() => dialog.close(), 700);
      }
    } catch (err) {
      if (statusEl) {
        statusEl.classList.remove("quote-status--success");
        statusEl.classList.add("quote-status--error");
        statusEl.textContent = "Sorry — something went wrong sending your request. Please try again.";
      }
      // Keep a console breadcrumb for debugging.
      // eslint-disable-next-line no-console
      console.error("Supabase quote submit failed:", err);
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  }

  function wireModal() {
    const dialog = document.getElementById("quote-dialog");
    if (!dialog || typeof dialog.showModal !== "function") return;

    // Never treat buttons/links inside a form as modal openers.
    const openers = $all("[data-quote-open]").filter((el) => !el.closest("form"));
    const closers = $all("[data-quote-close]", dialog);
    const form = $("form[data-quote-form]", dialog);
    const inlineForm = $("form[data-quote-form-inline]");

    openers.forEach((el) => {
      el.addEventListener("click", (e) => {
        // If a click bubbles up from inside any form, never open the modal.
        // This prevents the inline quote form's submit/button interactions from triggering a modal opener.
        if (e.target && typeof e.target.closest === "function" && e.target.closest("form")) return;

        e.preventDefault();

        const openMode = (el.getAttribute("data-quote-open") ?? "").toString().toLowerCase().trim();
        const forceModal = openMode === "modal" || openMode === "dialog";

        const hint = getProductTypeHintFromTrigger(el);
        const selectedProductType = hint?.value;
        const allowInsert = Boolean(hint?.allowInsert);

        // If the page already has an inline quote form, use it instead of opening the modal
        // unless the trigger explicitly requests the dialog.
        if (inlineForm && !forceModal) {
          setProductTypeValue(inlineForm, selectedProductType, { allowInsert });
          inlineForm.scrollIntoView({ behavior: "smooth", block: "start" });
          const firstInline = $("input[required], select[required]", inlineForm);
          if (firstInline) firstInline.focus();
          return;
        }

        if (form) setProductTypeValue(form, selectedProductType, { allowInsert });
        dialog.showModal();
        const first = $("input[required], select[required]", dialog);
        if (first) first.focus();
      });
    });

    closers.forEach((el) => {
      el.addEventListener("click", (e) => {
        e.preventDefault();
        dialog.close();
      });
    });

    if (form) {
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        if (!form.reportValidity()) return;
        submitToSupabase(form);
      });
    }

    // Close on backdrop click.
    // Coordinate-based checks can misfire for native <select> dropdowns (notably Safari/macOS).
    dialog.addEventListener("click", (e) => {
      if (e.target === dialog) dialog.close();
    });
  }

  function wireInlineForms() {
    // Optional: any inline forms can share the same submit handler.
    const forms = $all("form[data-quote-form-inline]");
    const suggestedProductType = getSuggestedProductType();
    const allowInsert = isProductPage();
    forms.forEach((form) => {
      const explicitProductType =
        form.getAttribute("data-product-type") ||
        form.getAttribute("data-quote-product") ||
        form.dataset?.productType ||
        form.dataset?.quoteProduct;

      // Preselect product type on page-load (only if user hasn't chosen already).
      if ((explicitProductType ?? "").toString().trim()) {
        setProductTypeValue(form, explicitProductType, { onlyIfEmpty: true, allowInsert: true });
      } else {
        setProductTypeValue(form, suggestedProductType, { onlyIfEmpty: true, allowInsert });
      }
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        if (!form.reportValidity()) return;
        submitToSupabase(form);
      });
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    wireModal();
    wireInlineForms();
  });
})();
