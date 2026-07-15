import http from "node:http";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

const key = process.env.ADMIN_API_KEY || "";
const dataDir = process.env.DATA_DIR || "/data";
const allowedOrigin = process.env.ALLOWED_ORIGIN || "https://culinaria-rc3-hml.homosapiens.id";
const stateFile = path.join(dataDir, "pipeline.json");
const auditFile = path.join(dataDir, "audit.jsonl");
const auditArchiveDir = path.join(dataDir, "audit-archive");
const auditManifestFile = path.join(auditArchiveDir, "manifest.jsonl");
const auditRotateBytes = Number(process.env.AUDIT_ROTATE_BYTES || 5242880);
const coreUrl = process.env.CORE_URL || "http://chefsapiens-rc3-hml-app:8080";

await fsp.mkdir(dataDir, { recursive: true });
await fsp.mkdir(auditArchiveDir, { recursive: true });

let writeQueue = Promise.resolve();
const enqueue = fn => {
  const run = writeQueue.then(fn, fn);
  writeQueue = run.catch(() => {});
  return run;
};

async function readState() {
  try {
    const parsed = JSON.parse(await fsp.readFile(stateFile, "utf8"));
    return parsed && typeof parsed === "object" ? parsed : { version: 1, items: {} };
  } catch {
    return { version: 1, items: {} };
  }
}

async function writeState(state) {
  const tmp = `${stateFile}.${process.pid}.${Date.now()}.tmp`;
  await fsp.writeFile(tmp, JSON.stringify(state, null, 2) + "\n", { mode: 0o600 });
  await fsp.rename(tmp, stateFile);
}

async function maybeRotateAudit() {
  try {
    const stat = await fsp.stat(auditFile);
    if (!Number.isFinite(auditRotateBytes) || auditRotateBytes < 65536 || stat.size < auditRotateBytes) return null;

    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const archiveName = `audit-${stamp}.jsonl`;
    const archivePath = path.join(auditArchiveDir, archiveName);
    await fsp.rename(auditFile, archivePath);
    await fsp.writeFile(auditFile, "", { mode: 0o600 });

    const hash = crypto.createHash("sha256").update(await fsp.readFile(archivePath)).digest("hex");
    const manifest = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      file: archiveName,
      bytes: stat.size,
      sha256: hash,
      mode: "size_rotation",
      deleted: false
    };
    await fsp.appendFile(auditManifestFile, JSON.stringify(manifest) + "\n", { mode: 0o600 });
    return manifest;
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}

async function appendAudit(event) {
  await maybeRotateAudit();
  await fsp.appendFile(auditFile, JSON.stringify(event) + "\n", { mode: 0o600 });
}

async function auditSegments() {
  const names = await fsp.readdir(auditArchiveDir).catch(() => []);
  const archives = names.filter(name => /^audit-.*\.jsonl$/.test(name)).sort();
  return [...archives.map(name => path.join(auditArchiveDir, name)), auditFile];
}

async function readAudit(limit = 100) {
  const events = [];
  for (const file of await auditSegments()) {
    try {
      const raw = await fsp.readFile(file, "utf8");
      for (const line of raw.trim().split("\n").filter(Boolean)) events.push(JSON.parse(line));
    } catch {}
  }
  return events.slice(-limit).reverse();
}

async function auditStatus() {
  const current = await fsp.stat(auditFile).catch(() => ({ size: 0 }));
  const names = await fsp.readdir(auditArchiveDir).catch(() => []);
  const archives = names.filter(name => /^audit-.*\.jsonl$/.test(name)).sort();
  const manifestLines = await fsp.readFile(auditManifestFile, "utf8")
    .then(raw => raw.trim().split("\n").filter(Boolean).length)
    .catch(() => 0);
  return {
    mode: "archive_only_no_deletion",
    rotateBytes: auditRotateBytes,
    currentBytes: current.size || 0,
    archiveCount: archives.length,
    manifestEntries: manifestLines,
    deletionEnabled: false
  };
}

function send(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
    "referrer-policy": "no-referrer"
  });
  res.end(body);
}

function auth(req) {
  return key.length >= 24 && String(req.headers["x-admin-key"] || "") === key;
}

function originAllowed(req) {
  const origin = String(req.headers.origin || "");
  return origin === allowedOrigin;
}

async function body(req) {
  let raw = "";
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 50000) throw new Error("too_large");
  }
  return raw ? JSON.parse(raw) : {};
}

async function coreLeads() {
  const response = await fetch(`${coreUrl}/internal/leads`, { headers: { "x-admin-key": key } });
  const json = await response.json();
  if (!response.ok) {
    const error = new Error("core_leads_failed");
    error.status = response.status;
    error.payload = json;
    throw error;
  }
  return Array.isArray(json?.data?.leads) ? json.data.leads : [];
}

const files = {
  "/cockpit": ["cockpit.html", "text/html; charset=utf-8"],
  "/cockpit.html": ["cockpit.html", "text/html; charset=utf-8"],
  "/admin-assets/cockpit-v18.css": ["cockpit-v18.css", "text/css; charset=utf-8"],
  "/admin-assets/cockpit-v18.js": ["cockpit-v18.js", "text/javascript; charset=utf-8"],
  "/audit": ["audit.html", "text/html; charset=utf-8"],
  "/audit.html": ["audit.html", "text/html; charset=utf-8"],
  "/audit-assets/audit.css": ["audit.css", "text/css; charset=utf-8"],
  "/audit-assets/audit.js": ["audit.js", "text/javascript; charset=utf-8"]
};

http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://local");

    if (url.pathname === "/healthz") {
      return send(res, 200, {
        ok: true,
        service: "chefsapiens-admin",
        version: "2.1",
        pipeline: true,
        editable: true,
        audit: true,
        originGuard: true,
        leadValidation: true,
        serializedWrites: true,
        auditRotation: true,
        auditDeletion: false,
        cockpitAligned: true
      });
    }

    if (url.pathname === "/admin-api/pipeline" && req.method === "GET") {
      if (!auth(req)) return send(res, 401, { ok: false, error: { code: "unauthorized" } });
      const leads = await coreLeads();
      const state = await readState();
      const merged = leads.map(lead => ({
        ...lead,
        pipeline: state.items[lead.id] || {
          stage: "new",
          owner: null,
          nextAction: null,
          nextActionAt: null,
          notes: null,
          updatedAt: null
        }
      }));
      return send(res, 200, { ok: true, data: { count: merged.length, leads: merged } });
    }

    if (url.pathname === "/admin-api/audit" && req.method === "GET") {
      if (!auth(req)) return send(res, 401, { ok: false, error: { code: "unauthorized" } });
      const requested = Number(url.searchParams.get("limit") || 100);
      const limit = Number.isFinite(requested) ? Math.max(1, Math.min(500, Math.floor(requested))) : 100;
      const events = await readAudit(limit);
      return send(res, 200, { ok: true, data: { count: events.length, events } });
    }

    if (url.pathname === "/admin-api/audit/status" && req.method === "GET") {
      if (!auth(req)) return send(res, 401, { ok: false, error: { code: "unauthorized" } });
      return send(res, 200, { ok: true, data: await auditStatus() });
    }

    const match = url.pathname.match(/^\/admin-api\/pipeline\/([^/]+)$/);
    if (match && req.method === "PATCH") {
      if (!auth(req)) return send(res, 401, { ok: false, error: { code: "unauthorized" } });
      if (!originAllowed(req)) return send(res, 403, { ok: false, error: { code: "origin_forbidden" } });

      const input = await body(req);
      const allowedStages = new Set(["new", "qualified", "contacted", "proposal", "won", "lost"]);
      if (input.stage && !allowedStages.has(input.stage)) {
        return send(res, 422, { ok: false, error: { code: "invalid_stage" } });
      }

      const id = decodeURIComponent(match[1]);
      const leads = await coreLeads();
      if (!leads.some(lead => lead.id === id)) {
        return send(res, 404, { ok: false, error: { code: "lead_not_found" } });
      }

      const result = await enqueue(async () => {
        const state = await readState();
        const previous = state.items[id] || {
          stage: "new",
          owner: null,
          nextAction: null,
          nextActionAt: null,
          notes: null,
          updatedAt: null
        };
        const next = {
          stage: input.stage ?? previous.stage ?? "new",
          owner: String(input.owner ?? previous.owner ?? "").slice(0, 120) || null,
          nextAction: String(input.nextAction ?? previous.nextAction ?? "").slice(0, 240) || null,
          nextActionAt: input.nextActionAt ?? previous.nextActionAt ?? null,
          notes: String(input.notes ?? previous.notes ?? "").slice(0, 2000) || null,
          updatedAt: new Date().toISOString()
        };

        const changes = {};
        for (const field of ["stage", "owner", "nextAction", "nextActionAt", "notes"]) {
          if (previous[field] !== next[field]) {
            changes[field] = field === "stage" || field === "nextActionAt"
              ? { from: previous[field] ?? null, to: next[field] ?? null }
              : { changed: true };
          }
        }

        state.items[id] = next;
        await writeState(state);

        if (Object.keys(changes).length > 0) {
          await appendAudit({
            id: crypto.randomUUID(),
            timestamp: next.updatedAt,
            leadId: id,
            action: "pipeline.updated",
            source: "admin-api",
            changes
          });
        }

        return next;
      });

      return send(res, 200, { ok: true, data: { id, pipeline: result } });
    }

    const hit = files[url.pathname];
    if (!hit) return send(res, 404, { ok: false, error: { code: "not_found" } });

    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("Cache-Control", url.pathname.endsWith(".css") || url.pathname.endsWith(".js") ? "public, max-age=300" : "no-store");
    res.writeHead(200, { "content-type": hit[1] });
    let content = fs.readFileSync(path.join(process.cwd(), hit[0]));
    if (hit[0] === "cockpit.html") {
      content = content.toString("utf8")
        .replace("OPERAÇÃO INTERNA • V1.8", "OPERAÇÃO INTERNA • V2.1")
        .replace("</nav>", '<a href="/agenda">Agenda</a><a href="/audit">Auditoria</a></nav>')
        .replace('<a href="/status.html">Status</a>', '<a href="/audit">Auditoria</a><a href="/agenda">Agenda</a><a href="/status.html">Status</a>');
    }
    res.end(content);
  } catch (error) {
    if (error.status) return send(res, error.status, error.payload || { ok: false, error: { code: error.message } });
    return send(res, error.message === "too_large" ? 413 : 400, {
      ok: false,
      error: { code: "bad_request", message: "Requisição inválida." }
    });
  }
}).listen(8082, "0.0.0.0", () => {
  console.log("ADMIN_READY 8082 version=2.1 pipeline=true editable=true audit=true originGuard=true leadValidation=true serializedWrites=true auditRotation=true auditDeletion=false cockpitAligned=true");
});