"use strict";

const http = require("node:http");
const { randomUUID } = require("node:crypto");
const path = require("node:path");
const { readFile } = require("node:fs/promises");

const PORT = Number(process.env.PORT || 8787);
const HOST = process.env.HOST || "127.0.0.1";
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "*";
const API_KEY = process.env.API_KEY || "";
const MAX_BODY_BYTES = 8 * 1024 * 1024;
const STATIC_ROOT = path.resolve(__dirname);
const MIME_TYPES = {
  ".html":"text/html; charset=utf-8",
  ".css":"text/css; charset=utf-8",
  ".js":"text/javascript; charset=utf-8",
  ".svg":"image/svg+xml",
  ".png":"image/png",
  ".jpg":"image/jpeg",
  ".jpeg":"image/jpeg",
  ".webp":"image/webp",
  ".gif":"image/gif",
  ".json":"application/json; charset=utf-8",
  ".txt":"text/plain; charset=utf-8",
  ".ico":"image/x-icon"
};

async function serveStatic(res, url) {
  let pathname;
  try { pathname = decodeURIComponent(url.pathname); }
  catch { res.writeHead(400); return res.end("Bad request"); }
  const relative = pathname === "/" ? "index.html" : pathname.replace(/^\\/+/, "");
  const filePath = path.resolve(STATIC_ROOT, relative);
  if (filePath !== STATIC_ROOT && !filePath.startsWith(STATIC_ROOT + path.sep)) {
    res.writeHead(403); return res.end("Forbidden");
  }
  try {
    const data = await readFile(filePath);
    const type = MIME_TYPES[path.extname(filePath).toLowerCase()] || "application/octet-stream";
    res.writeHead(200, {
      "Content-Type": type,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": type.startsWith("text/html") ? "no-cache" : "public, max-age=300"
    });
    res.end(data);
  } catch (error) {
    res.writeHead(error.code === "EISDIR" ? 404 : error.code === "ENOENT" ? 404 : 500);
    res.end("Not found");
  }
}


if (HOST !== "127.0.0.1" && HOST !== "localhost" && HOST !== "::1" && !API_KEY) {
  console.error("Refusing to listen on a public interface without API_KEY.");
  process.exit(1);
}

let latest = null;
let closing = false;

function corsHeaders(origin) {
  const allowed = ALLOWED_ORIGIN === "*" || origin === ALLOWED_ORIGIN;
  return {
    "Access-Control-Allow-Origin": allowed ? (ALLOWED_ORIGIN === "*" ? "*" : origin) : "null",
    "Vary": "Origin",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Cache-Control": "no-store"
  };
}

function sendJson(res, status, body, origin) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", ...corsHeaders(origin) });
  res.end(JSON.stringify(body));
}

function isAuthorized(req) {
  return !API_KEY || req.headers.authorization === "Bearer " + API_KEY;
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", chunk => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error("Request body exceeds the 8 MB limit."));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      try {
        const raw = Buffer.concat(chunks).toString("utf8");
        resolve(JSON.parse(raw || "{}"));
      } catch {
        reject(new Error("Request body must be valid JSON."));
      }
    });
    req.on("error", reject);
  });
}

function openAIError(res, status, message, origin, type = "invalid_request_error") {
  sendJson(res, status, { error: { message, type } }, origin);
}

function makeCompletion(body, captureId) {
  const content = "Janitor Extractor received your request. This is a local mock response; no AI provider was called.";
  return {
    id: "chatcmpl-" + captureId,
    object: "chat.completion",
    created: Math.floor(Date.now() / 1000),
    model: body.model || "extractor-mock",
    choices: [{ index: 0, message: { role: "assistant", content }, finish_reason: "stop" }],
    usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }
  };
}

function sendStream(res, completion, origin) {
  res.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    "Connection": "keep-alive",
    ...corsHeaders(origin)
  });
  const choice = completion.choices[0];
  const chunks = [
    { id: completion.id, object: "chat.completion.chunk", created: completion.created, model: completion.model,
      choices: [{ index: 0, delta: { role: "assistant" }, finish_reason: null }] },
    { id: completion.id, object: "chat.completion.chunk", created: completion.created, model: completion.model,
      choices: [{ index: 0, delta: { content: choice.message.content }, finish_reason: null }] },
    { id: completion.id, object: "chat.completion.chunk", created: completion.created, model: completion.model,
      choices: [{ index: 0, delta: {}, finish_reason: "stop" }] }
  ];
  for (const chunk of chunks) res.write("data: " + JSON.stringify(chunk) + "\n\n");
  res.end("data: [DONE]\n\n");
}

const server = http.createServer(async (req, res) => {
  const origin = req.headers.origin || "";
  const url = new URL(req.url, "http://localhost");

  if (req.method === "OPTIONS") {
    const headers = corsHeaders(origin);
    if (headers["Access-Control-Allow-Origin"] === "null") {
      res.writeHead(403, headers);
      return res.end();
    }
    res.writeHead(204, headers);
    return res.end();
  }

  if (corsHeaders(origin)["Access-Control-Allow-Origin"] === "null") {
    return sendJson(res, 403, { error: "Origin not allowed." }, origin);
  }

  const isApiPath = ["/health", "/api/latest", "/api/clear", "/v1/models", "/v1/chat/completions", "/chat/completions"].includes(url.pathname);
  if (req.method === "GET" && !isApiPath) {
    return serveStatic(res, url);
  }

  if (!isAuthorized(req)) {
    return openAIError(res, 401, "Invalid or missing receiver API key.", origin, "authentication_error");
  }

  if (req.method === "GET" && url.pathname === "/health") {
    return sendJson(res, 200, {
      ok: true, mode: "temporary in-memory capture", hasRequest: !!latest,
      authenticated: !!API_KEY, api: "OpenAI-compatible mock"
    }, origin);
  }

  if (req.method === "GET" && url.pathname === "/api/latest") {
    return sendJson(res, 200, latest || {}, origin);
  }

  if (req.method === "POST" && url.pathname === "/api/clear") {
    latest = null;
    return sendJson(res, 200, { ok: true, cleared: true }, origin);
  }

  if (req.method === "GET" && url.pathname === "/v1/models") {
    return sendJson(res, 200, {
      object: "list",
      data: [{ id: "extractor-mock", object: "model", created: 0, owned_by: "janitor-extractor" }]
    }, origin);
  }

  if (req.method === "POST" && ["/v1/chat/completions", "/chat/completions"].includes(url.pathname)) {
    try {
      const body = await readJson(req);
      if (!Array.isArray(body.messages)) {
        return openAIError(res, 400, "The request must include a messages array.", origin);
      }
      const captureId = randomUUID();
      latest = {
        id: captureId,
        receivedAt: new Date().toISOString(),
        request: body
      };
      const completion = makeCompletion(body, captureId);
      if (body.stream === true) return sendStream(res, completion, origin);
      return sendJson(res, 200, completion, origin);
    } catch (error) {
      if (!res.headersSent && !res.destroyed) {
        return openAIError(res, 400, error.message, origin);
      }
    }
  }

  return sendJson(res, 404, { error: "Not found" }, origin);
});

server.listen(PORT, HOST, () => {
  const address = server.address();
  console.log("Janitor Extractor receiver listening on http://" + HOST + ":" + address.port);
  console.log("GET /health · GET /api/latest · POST /api/clear · POST /v1/chat/completions");
});

function shutdown() {
  if (closing) return;
  closing = true;
  latest = null;
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 3000).unref();
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
