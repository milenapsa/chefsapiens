import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import {
  listRecipes,
  getRecipe,
  scaleRecipeById,
  analyzeRecipe,
  recommend,
  generateShoppingList,
  suggestSubstitutions
} from "./lib/engine.mjs";
import { importRecipeText } from "./lib/importer.mjs";
import { searchIngredients } from "./lib/ontology.mjs";
import { VERSION, openApiDocument } from "./openapi.mjs";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const SITE_ROOT = normalize(join(__dirname, "..", "site"));
const PORT = Number(process.env.PORT || 8080);
const HOST = process.env.HOST || "0.0.0.0";
const MAX_BODY_BYTES = Math.min(2_000_000, Math.max(10_000, Number(process.env.MAX_BODY_BYTES) || 1_000_000));
const RATE_LIMIT = Math.min(10_000, Math.max(10, Number(process.env.RATE_LIMIT_PER_MINUTE) || 120));
const API_KEYS = new Set(String(process.env.CHEFSAPIENS_API_KEYS || "").split(",").map((item) => item.trim()).filter(Boolean));
const REQUIRE_API_KEY = String(process.env.REQUIRE_API_KEY || "").toLowerCase() === "true";
const CORS_ORIGINS = new Set(String(process.env.CORS_ORIGINS || "").split(",").map((item) => item.trim()).filter(Boolean));
const buckets = new Map();

const CONTENT_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon"
};

function json(res, status, payload, extraHeaders = {}) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(body),
    "cache-control": "no-store",
    ...securityHeaders(),
    ...extraHeaders
  });
  res.end(body);
}

function securityHeaders() {
  return {
    "x-content-type-options": "nosniff",
    "x-frame-options": "DENY",
    "referrer-policy": "no-referrer",
    "permissions-policy": "camera=(), microphone=(), geolocation=()",
    "content-security-policy": "default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"
  };
}

function corsHeaders(req) {
  const origin = req.headers.origin;
  if (!origin || !CORS_ORIGINS.size || !CORS_ORIGINS.has(origin)) return {};
  return {
    "access-control-allow-origin": origin,
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "content-type,x-api-key",
    "access-control-max-age": "600",
    "vary": "Origin"
  };
}

function clientKey(req) {
  return req.headers["x-api-key"] || req.socket.remoteAddress || "unknown";
}

function allowRequest(req) {
  const key = clientKey(req);
  const minute = Math.floor(Date.now() / 60_000);
  const bucketKey = `${key}:${minute}`;
  const count = (buckets.get(bucketKey) || 0) + 1;
  buckets.set(bucketKey, count);
  if (buckets.size > 10_000) {
    for (const entry of buckets.keys()) {
      if (!entry.endsWith(`:${minute}`)) buckets.delete(entry);
    }
  }
  return count <= RATE_LIMIT;
}

function authorized(req) {
  if (!REQUIRE_API_KEY && !API_KEYS.size) return true;
  const key = String(req.headers["x-api-key"] || "");
  return API_KEYS.has(key);
}

async function readJson(req) {
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) {
      const error = new Error("request_too_large");
      error.status = 413;
      throw error;
    }
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    const error = new Error("invalid_json");
    error.status = 400;
    throw error;
  }
}

async function routeApi(req, res, url) {
  const headers = corsHeaders(req);
  if (req.method === "OPTIONS") {
    res.writeHead(204, { ...securityHeaders(), ...headers });
    res.end();
    return true;
  }
  if (!allowRequest(req)) {
    json(res, 429, { ok: false, error: { code: "rate_limited", message: "Limite de requisições excedido." } }, headers);
    return true;
  }
  if (url.pathname.startsWith("/v1/") && !authorized(req)) {
    json(res, 401, { ok: false, error: { code: "unauthorized", message: "Chave de API ausente ou inválida." } }, headers);
    return true;
  }

  if (req.method === "GET" && ["/healthz", "/readyz"].includes(url.pathname)) {
    json(res, 200, { ok: true, service: "chefsapiens", version: VERSION }, headers);
    return true;
  }
  if (req.method === "GET" && url.pathname === "/openapi.json") {
    json(res, 200, openApiDocument(), headers);
    return true;
  }
  if (req.method === "GET" && url.pathname === "/v1/ingredients/search") {
    json(res, 200, { ok: true, data: searchIngredients(url.searchParams.get("q") || "", url.searchParams.get("limit") || 10) }, headers);
    return true;
  }
  if (req.method === "GET" && url.pathname === "/v1/recipes") {
    json(res, 200, { ok: true, data: listRecipes() }, headers);
    return true;
  }
  const recipeMatch = url.pathname.match(/^\/v1\/recipes\/([^/]+)$/);
  if (req.method === "GET" && recipeMatch && !["scale", "analyze", "import"].includes(recipeMatch[1])) {
    const recipe = getRecipe(decodeURIComponent(recipeMatch[1]));
    json(res, recipe ? 200 : 404, recipe ? { ok: true, data: recipe } : { ok: false, error: { code: "recipe_not_found", message: "Receita não encontrada." } }, headers);
    return true;
  }
  if (req.method === "POST" && url.pathname === "/v1/recipes/scale") {
    const input = await readJson(req);
    const result = scaleRecipeById(input.recipeId, input.servings);
    json(res, result.ok ? 200 : 404, result, headers);
    return true;
  }
  if (req.method === "POST" && url.pathname === "/v1/recipes/analyze") {
    json(res, 200, analyzeRecipe(await readJson(req)), headers);
    return true;
  }
  if (req.method === "POST" && url.pathname === "/v1/recipes/import") {
    const result = importRecipeText(await readJson(req));
    json(res, result.ok ? 200 : 400, result, headers);
    return true;
  }
  if (req.method === "POST" && url.pathname === "/v1/recommendations") {
    json(res, 200, recommend(await readJson(req)), headers);
    return true;
  }
  if (req.method === "POST" && url.pathname === "/v1/substitutions") {
    const result = suggestSubstitutions(await readJson(req));
    json(res, result.ok ? 200 : 404, result, headers);
    return true;
  }
  if (req.method === "POST" && url.pathname === "/v1/shopping-lists/generate") {
    json(res, 200, generateShoppingList(await readJson(req)), headers);
    return true;
  }
  return false;
}

async function serveStatic(req, res, url) {
  if (!["GET", "HEAD"].includes(req.method)) return false;
  let pathname = decodeURIComponent(url.pathname);
  if (pathname === "/") pathname = "/index.html";
  const normalizedPath = normalize(pathname).replace(/^(\.\.[/\\])+/, "");
  let filePath = join(SITE_ROOT, normalizedPath);
  if (!filePath.startsWith(SITE_ROOT)) return false;

  try {
    const info = await stat(filePath);
    if (info.isDirectory()) filePath = join(filePath, "index.html");
    const extension = extname(filePath);
    res.writeHead(200, {
      "content-type": CONTENT_TYPES[extension] || "application/octet-stream",
      "cache-control": extension === ".html" ? "no-cache" : "public, max-age=3600",
      ...securityHeaders()
    });
    if (req.method === "HEAD") return res.end();
    createReadStream(filePath).pipe(res);
    return true;
  } catch {
    return false;
  }
}

export function createServer() {
  return http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
      if (await routeApi(req, res, url)) return;
      if (await serveStatic(req, res, url)) return;
      json(res, 404, { ok: false, error: { code: "not_found", message: "Rota não encontrada." } });
    } catch (error) {
      const status = error.status || 500;
      const code = error.message === "invalid_json" ? "invalid_json"
        : error.message === "request_too_large" ? "request_too_large"
        : "internal_error";
      json(res, status, {
        ok: false,
        error: {
          code,
          message: status === 500 ? "Erro interno." : code === "invalid_json" ? "JSON inválido." : "Corpo da requisição excede o limite."
        }
      });
    }
  });
}

export function validateRuntimeConfig() {
  if (REQUIRE_API_KEY && !API_KEYS.size) {
    throw new Error("CHEFSAPIENS_API_KEYS_REQUIRED");
  }
  return { requireApiKey: REQUIRE_API_KEY, configuredKeys: API_KEYS.size };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    validateRuntimeConfig();
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
  const server = createServer();
  server.listen(PORT, HOST, () => {
    console.log(`ChefSapiens API v${VERSION} em http://${HOST}:${PORT}`);
  });
  const shutdown = () => server.close(() => process.exit(0));
  process.once("SIGTERM", shutdown);
  process.once("SIGINT", shutdown);
}
