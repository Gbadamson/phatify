/**
 * tools/check-data.js
 *
 * Run this before every deploy:   node tools/check-data.js
 *
 * Because every record is a hand-edited JSON file, one missing comma or a
 * misspelt status can break verification for a real student. This script
 * reads every data file and tells you exactly what is wrong and where.
 * It exits with an error code if it finds a problem, so it can also be used
 * as a build check.
 */
const fs = require("fs");
const path = require("path");

const DATA = path.join(__dirname, "..", "data");
const CERT_DIR = path.join(DATA, "certificates");

const ID_RE = /^[A-Za-z0-9_-]{6,64}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;
const RANKS = ["champion", "first_runner_up", "second_runner_up", "consolation"];
const METRICS = ["exam", "attendance", "class_activity", "project", "conduct"];

const errors = [];
const warnings = [];
const err = (where, msg) => errors.push(`  ✗ ${where}: ${msg}`);
const warn = (where, msg) => warnings.push(`  ! ${where}: ${msg}`);

function readJson(file, label) {
  let text;
  try {
    text = fs.readFileSync(file, "utf8");
  } catch (e) {
    err(label, `cannot be read (${e.message})`);
    return null;
  }
  try {
    return JSON.parse(text);
  } catch (e) {
    err(label, `is not valid JSON: ${e.message}. Look for a missing comma, quote or bracket.`);
    return null;
  }
}

function validYmd(s) {
  if (typeof s !== "string" || !YMD_RE.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !isNaN(d) && d.toISOString().slice(0, 10) === s;
}

const isNum = (v) => typeof v === "number" && Number.isFinite(v);

// ---------- site.json ----------
const siteFile = path.join(DATA, "site.json");
if (fs.existsSync(siteFile)) {
  const site = readJson(siteFile, "data/site.json");
  if (site && !site.institution_name) warn("data/site.json", 'no "institution_name" set');
} else {
  warn("data/site.json", "not found (optional, but it holds your institution name and contact)");
}

// ---------- certificates ----------
const certIds = new Set();
const codes = new Map();
let certCount = 0;

if (!fs.existsSync(CERT_DIR)) {
  err("data/certificates", "folder not found");
} else {
  for (const name of fs.readdirSync(CERT_DIR).sort()) {
    if (name.startsWith("_") || name.startsWith(".")) continue; // templates / hidden files
    const label = `data/certificates/${name}`;

    if (!name.endsWith(".json")) {
      warn(label, "is not a .json file, so it will be ignored");
      continue;
    }
    const id = name.slice(0, -5);
    certCount++;

    if (!ID_RE.test(id)) {
      err(label, "the file name (the verification ID) may only use letters, digits, - and _ (6 to 64 characters)");
    } else if (!UUID_RE.test(id)) {
      warn(label, "the ID is not a long random UUID, so it is easier for someone to guess. Use the entry tool to create IDs.");
    }
    certIds.add(id.toLowerCase());

    const c = readJson(path.join(CERT_DIR, name), label);
    if (!c) continue;
    if (typeof c !== "object" || Array.isArray(c)) {
      err(label, "must contain a single JSON object { ... }");
      continue;
    }

    for (const f of ["student_name", "course_name"]) {
      if (typeof c[f] !== "string" || !c[f].trim()) err(label, `"${f}" is required`);
    }
    if (c.status !== undefined && !["active", "revoked"].includes(String(c.status).toLowerCase())) {
      err(label, `status "${c.status}" is not valid. Use "active" or "revoked"`);
    }
    if (c.percentage !== undefined && c.percentage !== null && (!isNum(c.percentage) || c.percentage < 0 || c.percentage > 100)) {
      err(label, `"percentage" must be a number from 0 to 100 (no quotes, no % sign)`);
    }
    if (c.date_issued !== undefined && !validYmd(c.date_issued)) {
      err(label, `"date_issued" must be a real date written like 2026-08-22`);
    }
    if (!c.institution_name) warn(label, 'no "institution_name" (the site name will be used instead)');

    if (c.certificate_code) {
      if (codes.has(c.certificate_code)) {
        err(label, `certificate_code ${c.certificate_code} is already used by ${codes.get(c.certificate_code)}`);
      } else {
        codes.set(c.certificate_code, name);
      }
    }
  }
}

// ---------- honour.json ----------
const honourFile = path.join(DATA, "honour.json");
let awardCount = 0;
if (fs.existsSync(honourFile)) {
  const h = readJson(honourFile, "data/honour.json");
  if (h) {
    if (!Array.isArray(h.awards)) {
      err("data/honour.json", 'needs an "awards" list: "awards": [ ... ]');
    } else {
      if (!h.season) warn("data/honour.json", 'no "season" title set');
      const seen = {};
      h.awards.forEach((a, i) => {
        const label = `data/honour.json award #${i + 1}${a && a.student_name ? ` (${a.student_name})` : ""}`;
        if (!a || typeof a !== "object") return err(label, "must be an object { ... }");
        const published = a.published !== false;
        if (published) awardCount++;

        if (!RANKS.includes(a.rank)) err(label, `"rank" must be one of: ${RANKS.join(", ")}`);
        if (typeof a.student_name !== "string" || !a.student_name.trim()) err(label, `"student_name" is required`);

        const p = a.performance;
        if (!p || typeof p !== "object") {
          err(label, `needs a "performance" block with ${METRICS.join(", ")}`);
        } else {
          for (const m of METRICS) {
            if (!isNum(p[m]) || p[m] < 0 || p[m] > 100) {
              err(label, `performance "${m}" must be a number from 0 to 100`);
            }
          }
        }

        if (!a.prize) warn(label, 'no "prize" text, so the page will say "a prize"');
        if (a.claim_date !== undefined && !validYmd(a.claim_date)) {
          err(label, `"claim_date" must be a real date written like 2027-01-15`);
        }
        if (a.claimed !== undefined && typeof a.claimed !== "boolean") {
          err(label, `"claimed" must be true or false (no quotes)`);
        }
        if (a.certificate_id && !certIds.has(String(a.certificate_id).toLowerCase())) {
          err(label, `"certificate_id" ${a.certificate_id} does not match any file in data/certificates/`);
        }

        // Only one Champion / First / Second Runner-Up among the published awards
        if (published && RANKS.includes(a.rank) && a.rank !== "consolation") {
          if (seen[a.rank]) err(label, `there is more than one published ${a.rank.replace(/_/g, " ")} (also #${seen[a.rank]})`);
          else seen[a.rank] = i + 1;
        }
      });
    }
  }
} else {
  warn("data/honour.json", "not found, so no honour roll will be shown (that is fine if you don't want one)");
}

// ---------- report ----------
console.log(`Checked ${certCount} certificate file(s) and ${awardCount} published award(s).\n`);
if (warnings.length) console.log(`Warnings (${warnings.length}):\n${warnings.join("\n")}\n`);
if (errors.length) {
  console.log(`Problems to fix (${errors.length}):\n${errors.join("\n")}\n`);
  process.exit(1);
}
console.log("✔ No problems found. Safe to deploy.");
