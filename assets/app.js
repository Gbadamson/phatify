/**
 * assets/app.js
 *
 * The verification page. No server involved: the certificate ID in the URL
 * (/verify/{id}) is used to load the matching JSON file from
 * /data/certificates/{id}.json, and the page shows what that file says.
 *
 *   file exists + status "active"  -> VERIFIED
 *   file exists + status "revoked" -> REVOKED
 *   no such file                   -> NOT FOUND
 */
(function () {
  const card = document.getElementById("card");
  // IDs are plain letters, digits, "-" and "_" only. This also stops anyone
  // from using the URL to request some other path.
  const ID_RE = /^[A-Za-z0-9_-]{6,64}$/;

  let site = {};

  // ---------- helpers ----------
  function esc(str) {
    if (str === null || str === undefined) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function readId() {
    const parts = window.location.pathname.split("/").filter(Boolean);
    const at = parts.indexOf("verify");
    let id = at >= 0 && parts[at + 1] ? parts[at + 1] : "";
    try { id = decodeURIComponent(id); } catch (e) { /* keep raw */ }
    if (!ID_RE.test(id)) {
      // Fallback for hosts without the /verify/:id rewrite: /verify/?id=...
      id = new URLSearchParams(window.location.search).get("id") || "";
    }
    return id.trim();
  }

  function formatDate(ymd) {
    if (!ymd) return "—";
    const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(ymd) ? `${ymd}T00:00:00` : ymd);
    if (isNaN(d)) return esc(ymd);
    return d.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
  }

  function contactText() {
    return site.contact ? ` You can contact the institution at ${esc(site.contact)}.` : "";
  }

  /**
   * Loads a JSON file. Returns:
   *   { missing: true }  when the file does not exist
   *   { data }           when it was read successfully
   * Throws when the file exists but cannot be used (for example a typo such
   * as a missing comma), so a mistake in a hand-edited file is never mistaken
   * for "certificate not found".
   */
  async function loadJson(path) {
    const res = await fetch(path, { cache: "no-store" });
    if (res.status === 404) return { missing: true };
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${path}`);
    const text = await res.text();
    // Some hosts answer unknown paths with an HTML page instead of a 404.
    if (!text.trim().startsWith("{")) return { missing: true };
    try {
      return { data: JSON.parse(text) };
    } catch (err) {
      throw new Error(`${path} is not valid JSON (${err.message}). Check for a missing comma or quote.`);
    }
  }

  // ---------- renderers ----------
  function row(label, value) {
    return `<div class="result-row"><span class="result-label">${label}</span><span class="result-value">${value}</span></div>`;
  }

  function renderVerified(c) {
    const score = Number.isFinite(Number(c.percentage)) && c.percentage !== null && c.percentage !== ""
      ? row("Score", `${esc(Math.round(Number(c.percentage) * 100) / 100)}%`) : "";
    card.innerHTML = `
      <div class="status-badge verified">✓ VERIFIED</div>
      ${row("Student Name", esc(c.student_name))}
      ${row("Course / Program", esc(c.course_name))}
      ${score}
      ${c.grade ? row("Grade", esc(c.grade)) : ""}
      ${row("Date Issued", formatDate(c.date_issued))}
      ${row("Issuing Institution", esc(c.institution_name || site.institution_name || "—"))}
      ${c.certificate_code ? `<div class="cert-code">${esc(c.certificate_code)}</div>` : ""}
    `;
  }

  function renderRevoked(c) {
    card.innerHTML = `
      <div class="status-badge revoked">✕ REVOKED</div>
      <div class="message-box">
        <p class="message-text">This certificate was issued but has since been revoked by the issuing institution and is no longer valid.${contactText()}</p>
      </div>
      ${row("Student Name", esc(c.student_name))}
      ${row("Course / Program", esc(c.course_name))}
      ${c.certificate_code ? `<div class="cert-code">${esc(c.certificate_code)}</div>` : ""}
    `;
  }

  function renderNotFound() {
    card.innerHTML = `
      <div class="status-badge not_found">✕ NOT FOUND</div>
      <div class="message-box">
        <div class="message-icon">⚠️</div>
        <p class="message-text">No certificate matches this code. This may not be a genuine certificate, or the link may be broken.${contactText()}</p>
      </div>
    `;
  }

  function renderError() {
    card.innerHTML = `
      <div class="message-box">
        <div class="message-icon">⚠️</div>
        <p class="message-text">We couldn't complete this verification right now. Please try again in a moment, and contact the institution if the problem continues.${contactText()}</p>
      </div>
    `;
  }

  // ---------- main ----------
  async function run() {
    // Branding is optional: the page works without data/site.json.
    try {
      const s = await loadJson("/data/site.json");
      if (s.data) {
        site = s.data;
        if (site.portal_title) document.getElementById("brand").textContent = site.portal_title;
        if (site.institution_name) document.getElementById("brand-sub").textContent = site.institution_name;
      }
    } catch (err) {
      console.error(err.message);
    }

    const id = readId();
    if (!ID_RE.test(id)) {
      renderNotFound();
      return;
    }

    try {
      const result = await loadJson(`/data/certificates/${encodeURIComponent(id)}.json`);
      if (result.missing) {
        renderNotFound();
        return;
      }

      const c = result.data;
      const hasRequired =
        c && typeof c.student_name === "string" && c.student_name.trim() &&
        typeof c.course_name === "string" && c.course_name.trim();
      if (!hasRequired) {
        throw new Error(`data/certificates/${id}.json needs "student_name" and "course_name".`);
      }

      const status = String(c.status || "active").trim().toLowerCase();
      if (status === "revoked") {
        renderRevoked(c);
      } else if (status === "active") {
        renderVerified(c);
        // The honour roll is only shown for genuine, active certificates.
        if (window.HonourRoll) window.HonourRoll.mount({ certificateId: id });
      } else {
        // A typo such as "activ" must never be shown as VERIFIED.
        throw new Error(`Unknown status "${c.status}" in ${id}.json. Use "active" or "revoked".`);
      }
    } catch (err) {
      console.error(err.message);
      renderError();
    }
  }

  run();
})();
