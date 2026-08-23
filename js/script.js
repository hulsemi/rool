/* ==========================================================================
   ELECTRON SEMI — site script
   Handles: nav toggle, active link, and form submission to Google Apps Script
   ========================================================================== */

// ---------------------------------------------------------------------------
// 1. CONFIGURATION — replace these two values after deployment
// ---------------------------------------------------------------------------
const CONFIG = {
  // Paste the Web App URL you get after deploying the Google Apps Script
  // (Deploy > New deployment > Web app). It looks like:
  // https://script.google.com/macros/s/AKfycb.../exec
  APPS_SCRIPT_URL: "https://script.google.com/macros/s/AKfycbxi2S8ZmAHgf9PLWQYcHRH52nrKXBTuUyuNjBQfT7t6gxqUbubTycIs1iiXCr-zXu3IWg/exec",

  // Shown in a couple of places on the site (footer, page titles via JS if needed)
  COMPANY_NAME: "Electron Semi"
};

// ---------------------------------------------------------------------------
// 2. Nav toggle (mobile)
// ---------------------------------------------------------------------------
document.addEventListener("DOMContentLoaded", () => {
  const toggle = document.querySelector(".nav-toggle");
  const links = document.querySelector(".nav-links");
  if (toggle && links) {
    toggle.addEventListener("click", () => {
      const open = links.classList.toggle("open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    });
  }

  // Mark the current page's nav link as active
  const current = window.location.pathname.split("/").pop() || "index.html";
  document.querySelectorAll(".nav-links a").forEach((a) => {
    const href = a.getAttribute("href");
    if (href === current || (current === "" && href === "index.html")) {
      a.classList.add("active");
    }
  });

  // Wire up any form on the page that opts in via data-es-form
  document.querySelectorAll("form[data-es-form]").forEach(initForm);
});

// ---------------------------------------------------------------------------
// 3. Generic form handler
//    Works for the contact, service-enquiry, and career-application forms.
//    Each <form> needs: data-es-form="contact|service|career"
// ---------------------------------------------------------------------------
function initForm(form) {
  const formType = form.getAttribute("data-es-form");
  const msgBox = form.querySelector(".form-msg");
  const submitBtn = form.querySelector('button[type="submit"]');

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    // --- Honeypot spam check -------------------------------------------------
    // A hidden field named "website" that only bots tend to fill in.
    const honeypot = form.querySelector('input[name="website"]');
    if (honeypot && honeypot.value.trim() !== "") {
      // Silently pretend success so bots don't learn anything useful.
      showMessage(msgBox, "success", "Thanks — your submission has been received.");
      form.reset();
      return;
    }

    // --- Required-field validation -------------------------------------------
    const requiredFields = form.querySelectorAll("[required]");
    for (const field of requiredFields) {
      if (!field.value || !field.value.toString().trim()) {
        showMessage(msgBox, "error", `Please fill in "${fieldLabel(field)}" before submitting.`);
        field.focus();
        return;
      }
    }

    // --- Basic email sanity check ---------------------------------------------
    const emailField = form.querySelector('input[type="email"]');
    if (emailField && emailField.value) {
      const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailPattern.test(emailField.value.trim())) {
        showMessage(msgBox, "error", "Please enter a valid email address.");
        emailField.focus();
        return;
      }
    }

    if (CONFIG.APPS_SCRIPT_URL.includes("hi")) {
      showMessage(
        msgBox,
        "error",
        "Form endpoint is not configured yet. Add your Apps Script Web App URL to js/script.js (CONFIG.APPS_SCRIPT_URL)."
      );
      return;
    }

    // --- Build payload -----------------------------------------------------
    const payload = { formType };

    // Handle a resume <input type="file"> specially (career form)
    const fileInput = form.querySelector('input[type="file"]');

    setSubmitting(submitBtn, true);
    showMessage(msgBox, "pending", "Submitting…");

    try {
      if (fileInput && fileInput.files && fileInput.files[0]) {
        const file = fileInput.files[0];

        const maxBytes = 5 * 1024 * 1024; // 5 MB
        if (file.size > maxBytes) {
          showMessage(msgBox, "error", "Resume file is too large. Please upload a file under 5 MB.");
          setSubmitting(submitBtn, false);
          return;
        }
        const allowed = ["application/pdf", "application/msword",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document"];
        if (allowed.indexOf(file.type) === -1) {
          showMessage(msgBox, "error", "Please upload your resume as a PDF or Word document.");
          setSubmitting(submitBtn, false);
          return;
        }

        const base64 = await fileToBase64(file);
        payload.resume = {
          fileName: file.name,
          mimeType: file.type,
          base64Data: base64.split(",")[1] // strip the data: prefix
        };
      }

      // Collect the rest of the named fields
      new FormData(form).forEach((value, key) => {
        if (key === "website") return; // skip honeypot
        if (fileInput && key === fileInput.name) return; // handled above
        payload[key] = value;
      });

      await submitToAppsScript(payload);

      showMessage(
        msgBox,
        "success",
        "Thank you — your submission has been received. We'll be in touch soon."
      );
      form.reset();
    } catch (err) {
      console.error("Submission error:", err);
      showMessage(
        msgBox,
        "error",
        "Something went wrong sending your submission. Please try again, or email us directly."
      );
    } finally {
      setSubmitting(submitBtn, false);
    }
  });
}

// ---------------------------------------------------------------------------
// 4. Network call to the Apps Script Web App
//    Uses a simple text/plain POST to avoid CORS preflight (Apps Script Web
//    Apps don't support the OPTIONS preflight request), then Apps Script
//    parses the JSON body itself. See apps-script/Code.gs.
// ---------------------------------------------------------------------------
async function submitToAppsScript(payload) {
  const response = await fetch(CONFIG.APPS_SCRIPT_URL, {
    method: "POST",
    // "text/plain" keeps this a "simple request" so the browser does not
    // send a CORS preflight OPTIONS call, which Apps Script cannot answer.
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error("Network response was not OK: " + response.status);
  }

  const data = await response.json();
  if (!data || data.result !== "success") {
    throw new Error((data && data.message) || "Unknown error from Apps Script");
  }
  return data;
}

// ---------------------------------------------------------------------------
// 5. Small helpers
// ---------------------------------------------------------------------------
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function fieldLabel(field) {
  const label = field.closest(".field")?.querySelector("label");
  return label ? label.textContent.replace("*", "").trim() : field.name;
}

function showMessage(box, type, text) {
  if (!box) return;
  box.textContent = text;
  box.className = "form-msg show " + type;
}

function setSubmitting(btn, isSubmitting) {
  if (!btn) return;
  btn.disabled = isSubmitting;
  btn.dataset.originalText = btn.dataset.originalText || btn.textContent;
  btn.textContent = isSubmitting ? "Submitting…" : btn.dataset.originalText;
}
