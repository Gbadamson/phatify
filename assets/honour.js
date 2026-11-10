/**
 * assets/honour.js
 *
 * Honour roll shown on the verification page after a successful verification.
 * Reads /data/honour.json (no server involved) and lists the season's winners:
 * Champion, First Runner-Up, Second Runner-Up and any Consolation prizes.
 * Tapping a winner opens a performance card with their five scores and a
 * write-up about their reward.
 *
 * Usage: HonourRoll.mount({ certificateId })
 */
(function () {
  const RANKS = {
    champion: {
      label: "Champion",
      medal: "🏆",
      tagline: "Overall best performer",
      css: "champion",
      order: 1,
    },
    first_runner_up: {
      label: "First Runner-Up",
      medal: "🥈",
      tagline: "A step from the top",
      css: "first",
      order: 2,
    },
    second_runner_up: {
      label: "Second Runner-Up",
      medal: "🥉",
      tagline: "Steady excellence",
      css: "second",
      order: 3,
    },
    consolation: {
      label: "Consolation Prize",
      medal: "🎖️",
      tagline: "Outstanding effort",
      css: "consolation",
      order: 4,
    },
  };

  // Congratulations text for each rank. {n} is replaced by the winner's name.
  const CONGRATS = {
    champion:
      "Congratulations to {n} on being crowned this season's Champion. An outstanding " +
      "all-round performance set the standard for the entire class: in the exam hall, " +
      "in attendance, in class participation, in project work and in conduct.",
    first_runner_up:
      "Congratulations to {n}, First Runner-Up this season. A remarkable result built " +
      "on consistency and hard work, finishing just one step from the very top.",
    second_runner_up:
      "Congratulations to {n}, Second Runner-Up this season. Steady excellence across " +
      "every area that counts earned a well-deserved place on the podium.",
    consolation:
      "Congratulations to {n}, winner of a Consolation Prize this season. Strong effort " +
      "and real progress deserve recognition, and this one is thoroughly earned.",
  };

  const METRICS = [
    ["exam", "Exam"],
    ["attendance", "Attendance"],
    ["class_activity", "Class activity"],
    ["project", "Project"],
    ["conduct", "General conduct"],
  ];

  // You can override this by adding an "intro" line to data/honour.json.
  const DEFAULT_INTRO =
    "Behind every certificate is a story of discipline. These students went beyond " +
    "passing: they showed up, took part, delivered on their projects and carried " +
    "themselves with integrity.";

  const YMD = /^\d{4}-\d{2}-\d{2}$/;

  let awards = [];
  let lastFocused = null;

  function esc(str) {
    if (str === null || str === undefined) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function normalizeText(str) {
    return String(str || "").trim().toLowerCase().replace(/\s+/g, " ");
  }

  function isNum(v) {
    return v !== null && v !== "" && v !== undefined && Number.isFinite(Number(v));
  }

  function pct(v) {
    return isNum(v) ? `${Math.round(Number(v) * 100) / 100}%` : "—";
  }

  function todayYmd() {
    const d = new Date();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${d.getFullYear()}-${mm}-${dd}`;
  }

  function longDate(ymd) {
    if (!YMD.test(ymd)) return String(ymd);
    const d = new Date(`${ymd}T00:00:00`);
    if (isNaN(d)) return String(ymd);
    return d.toLocaleDateString(undefined, {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }

  // ---------- Section ----------
  function cardHtml(a, index) {
    const r = RANKS[a.rank];
    return `
      <button type="button" class="honour-card rank-${r.css}" data-index="${index}"
              aria-label="${esc(r.label)}: ${esc(a.student_name)}. View performance">
        <span class="honour-medal" aria-hidden="true">${r.medal}</span>
        <span class="honour-card-body">
          <span class="honour-rank">${esc(r.label)}</span>
          <span class="honour-name">${esc(a.student_name)}</span>
          <span class="honour-tagline">${esc(r.tagline)}</span>
        </span>
        <span class="honour-chevron" aria-hidden="true">›</span>
      </button>`;
  }

  async function mount(opts) {
    const root = document.getElementById("honour");
    if (!root) return;
    const certificateId = String((opts && opts.certificateId) || "").toLowerCase();

    let data;
    try {
      const res = await fetch("/data/honour.json", { cache: "no-store" });
      if (!res.ok) return; // no honour roll published: stay silent
      data = JSON.parse(await res.text());
    } catch (err) {
      // The honour roll is a bonus and must never break verification.
      console.error("data/honour.json could not be read:", err.message);
      return;
    }

    const list = Array.isArray(data.awards) ? data.awards : [];
    awards = list
      .filter((a) => {
        if (!a || a.published === false) return false;
        if (!RANKS[a.rank] || !a.student_name) {
          console.warn("Skipping an honour roll entry with a missing name or unknown rank:", a);
          return false;
        }
        return true;
      })
      .map((a) => Object.assign({ season: data.season }, a)) // season is set once at the top of the file
      .sort((a, b) => RANKS[a.rank].order - RANKS[b.rank].order); // stable: keeps file order within a rank

    if (awards.length === 0) return;

    const byName = normalizeText(opts && opts.studentName ? opts.studentName : "");
    const mine = certificateId
      ? awards.findIndex((a) => String(a.certificate_id || "").toLowerCase() === certificateId)
      : -1;

    const nameMatch = mine < 0 && byName
      ? awards.findIndex((a) => {
          const match = normalizeText(a.student_name);
          return match === byName || match.includes(byName) || byName.includes(match);
        })
      : -1;

    const actualIndex = mine >= 0 ? mine : nameMatch;

    const banner =
      actualIndex >= 0
        ? `<div class="honour-banner">
             <div class="honour-banner-text">🎉 <strong>Congratulations!</strong> You are on this season's Honour Roll.</div>
             <button type="button" class="honour-banner-btn" data-index="${actualIndex}">View my performance</button>
           </div>`
        : "";

    root.innerHTML = `
      <div class="honour-head">
        <div class="honour-eyebrow">Honour Roll${data.season ? ` · ${esc(data.season)}` : ""}</div>
        <h2 class="honour-title">Celebrating Excellence</h2>
        <p class="honour-intro">${esc(data.intro || DEFAULT_INTRO)}</p>
      </div>
      ${banner}
      <div class="honour-list">${awards.map(cardHtml).join("")}</div>
      <p class="honour-hint">Tap a winner to see how they earned their place.</p>
    `;
    root.classList.remove("hidden");

    root.addEventListener("click", (e) => {
      const trigger = e.target.closest("[data-index]");
      if (trigger) openModal(Number(trigger.dataset.index), trigger);
    });
  }

  // ---------- Modal ----------
  function ensureModal() {
    let modal = document.getElementById("honour-modal");
    if (modal) return modal;
    modal = document.createElement("div");
    modal.id = "honour-modal";
    modal.className = "honour-modal hidden";
    modal.innerHTML = `
      <div class="honour-modal-backdrop" data-close="1"></div>
      <div class="honour-modal-sheet" role="dialog" aria-modal="true" aria-labelledby="honour-modal-title">
        <button type="button" class="honour-modal-close" data-close="1" aria-label="Close">&times;</button>
        <div id="honour-modal-content"></div>
      </div>`;
    document.body.appendChild(modal);
    modal.addEventListener("click", (e) => {
      if (e.target.closest("[data-close]")) closeModal();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !modal.classList.contains("hidden")) closeModal();
    });
    return modal;
  }

  function closeModal() {
    const modal = document.getElementById("honour-modal");
    if (!modal) return;
    modal.classList.add("hidden");
    document.body.classList.remove("honour-lock");
    if (lastFocused && lastFocused.focus) lastFocused.focus();
  }

  function openModal(index, trigger) {
    const a = awards[index];
    if (!a) return;
    lastFocused = trigger || null;

    const modal = ensureModal();
    const content = document.getElementById("honour-modal-content");
    content.innerHTML = detailHtml(a);
    modal.classList.remove("hidden");
    document.body.classList.add("honour-lock");
    modal.querySelector(".honour-modal-sheet").scrollTop = 0;
    modal.querySelector(".honour-modal-close").focus();

    // Animate the bars in on the next frame.
    requestAnimationFrame(() => {
      content.querySelectorAll(".bar-fill").forEach((el) => {
        el.style.width = el.dataset.width;
      });
    });
  }

  function detailHtml(a) {
    const r = RANKS[a.rank];
    const perf = a.performance || {};

    const rows = METRICS.map(([key, label]) => {
      const value = perf[key];
      const width = isNum(value) ? Math.max(0, Math.min(100, Number(value))) : 0;
      return `
        <div class="perf-row">
          <div class="perf-label">${label}</div>
          <div class="perf-value">${pct(value)}</div>
          <div class="bar" role="img" aria-label="${label}: ${pct(value)}">
            <div class="bar-fill" data-width="${width}%" style="width:0"></div>
          </div>
        </div>`;
    }).join("");

    // The rank class sits on a wrapper so the accent colour reaches the
    // header, the performance bars and the reward card alike.
    return `
      <div class="rank-${r.css}">
        <div class="detail-head">
          <div class="detail-medal" aria-hidden="true">${r.medal}</div>
          <div class="detail-rank">${esc(r.label)}</div>
          <h3 id="honour-modal-title" class="detail-name">${esc(a.student_name)}</h3>
          ${a.season ? `<div class="detail-season">${esc(a.season)}</div>` : ""}
        </div>

        <div class="detail-section">
          <h4 class="detail-heading">Performance</h4>
          ${rows}
        </div>

        <div class="detail-section reward-card">
          <h4 class="detail-heading">🎁 Reward</h4>
          ${rewardHtml(a)}
        </div>
      </div>`;
  }

  function rewardHtml(a) {
    const name = esc(a.student_name);
    const congrats = (CONGRATS[a.rank] || CONGRATS.consolation).replace(
      /\{n\}/g,
      `<strong>${name}</strong>`
    );

    const prize = a.prize ? esc(a.prize) : "a prize";
    const when = a.claim_date ? ` to be claimed on <strong>${esc(longDate(a.claim_date))}</strong>` : "";
    const where = a.claim_venue ? ` at <strong>${esc(a.claim_venue)}</strong>` : "";
    const forfeiture = a.claim_date
      ? "Failure to claim the prize by this date might result in forfeiture."
      : "The collection date will be announced by the school.";

    const passed = YMD.test(a.claim_date || "") && a.claim_date < todayYmd();
    let status = "";
    if (a.claimed === true) {
      status = `<div class="reward-status claimed">✓ This prize has been claimed.</div>`;
    } else if (passed) {
      status = `<div class="reward-status overdue">The claim date has passed. Please contact the school administration without delay.</div>`;
    }

    const note = a.note
      ? `<p class="reward-note"><em>A note from the school:</em> ${esc(a.note)}</p>`
      : "";

    return `
      <p class="reward-text">${congrats}</p>
      <p class="reward-text">${name} has won <strong>${prize}</strong>${when}${where}. ${forfeiture}</p>
      ${note}
      ${status}`;
  }

  window.HonourRoll = { mount };
})();
