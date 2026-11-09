/**
 * serve-local.js
 * A tiny preview server so you can test the site on your own computer.
 * It needs nothing installed except Node.js and behaves like the live site,
 * including the /verify/{id} routing.
 *
 *   node serve-local.js            -> http://localhost:3000
 *   PORT=4000 node serve-local.js  -> http://localhost:4000
 */
const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

function sendFile(res, file) {
  fs.readFile(file, (err, body) => {
    if (err) return notFound(res);
    res.writeHead(200, {
      "Content-Type": TYPES[path.extname(file).toLowerCase()] || "application/octet-stream",
      "Cache-Control": "no-cache",
    });
    res.end(body);
  });
}

function notFound(res) {
  res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
  res.end("404 Not Found");
}

// A real file inside the project folder for this URL path, or null.
function existingFile(urlPath) {
  // An encoded slash or backslash must never act as a folder separator.
  if (/%2f|%5c/i.test(urlPath)) return null;
  const clean = path.normalize(decodeURIComponent(urlPath)).replace(/^(\.\.[/\\])+/, "");
  let file = path.join(ROOT, clean);
  if (!file.startsWith(ROOT)) return null; // never leave the project folder
  if (path.basename(file).startsWith(".")) return null; // no dotfiles

  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, "index.html");
  if (fs.existsSync(file) && fs.statSync(file).isFile()) return file;
  return null;
}

// Returns the file to serve for a URL path, or null.
function resolve(urlPath) {
  const file = existingFile(urlPath);
  if (file) return file;

  // The same rewrite as vercel.json: /verify/{anything} -> the verify page.
  // (Checked on the raw URL, whatever the ID looks like. The page itself
  // decides that an invalid ID means NOT FOUND.)
  if (/^\/verify\/[^/]+$/.test(urlPath)) return path.join(ROOT, "verify", "index.html");
  return null;
}

http
  .createServer((req, res) => {
    let pathname;
    try {
      pathname = new URL(req.url, "http://localhost").pathname;
      const file = resolve(pathname);
      if (!file) return notFound(res);
      sendFile(res, file);
    } catch (err) {
      notFound(res);
    }
  })
  .listen(PORT, () => {
    console.log(`Preview running at http://localhost:${PORT}`);
    console.log(`Try a certificate: http://localhost:${PORT}/verify/b6e3f93b-c568-4c89-a225-6093bd2efc6f`);
  });
