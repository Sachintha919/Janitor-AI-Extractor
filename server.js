const http = require("node:http");
const { randomUUID } = require("node:crypto");

const PORT = Number(process.env.PORT || 8787);
const HOST = process.env.HOST || "127.0.0.1";
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "*";
const API_KEY = process.env.API_KEY || "";\nconst API_KEY = process.env.API_KEY || "";
let latest = null;

function send(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Cache-Control": "no-store"
  });
  res.end(payload);
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", chunk => {
      data += chunk;
      if (data.length > 8 * 1024 * 1024) {
        reject(new Error("Request body exceeds 8 MB"));
        req.destroy();
      }
    });
    req.on("end", () => {
      try { resolve(JSON.parse(data || "{}")); }
      catch { reject(new Error("Request body must be valid JSON")); }
    });
    req.on("error", reject);
  });
}
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization"
    });
    return res.end();
  }
  if (req.method === "GET" && url.pathname === "/health") {
    return send(res, 200, { ok: true, mode: "temporary in-memory capture", hasRequest: !!latest });
  }
  if (req.method === "GET" && url.pathname === "/api/latest") {
    return send(res, 200, latest || {});
  }
  if (req.method === "POST" && url.pathname === "/api/clear") {
    latest = null;
    return send(res, 200, { ok: true });
  }
  if (req.method === "POST" && (url.pathname === "/v1/chat/completions" || url.pathname === "/chat/completions")) {
    try {
      if (API_KEY && req.headers.authorization !== "Bearer " + API_KEY) {\n        return send(res, 401, { error: { message: "Invalid API key", type: "authentication_error" } });\n      }\n      if (API_KEY && req.headers.authorization !== "Bearer " + API_KEY) {
        return send(res, 401, { error: { message: "Invalid API key", type: "authentication_error" } });
      }
      const body = await readBody(req);
      latest = { id: randomUUID(), receivedAt: new Date().toISOString(), request: body };
      const content = "Janitor Extractor local capture received your request. This is a mock response; no AI provider was called.";
      return send(res, 200, {
        id: "chatcmpl-" + latest.id,
        object: "chat.completion",
        created: Math.floor(Date.now() / 1000),
        model: body.model || "extractor-mock",
        choices: [{ index: 0, message: { role: "assistant", content }, finish_reason: "stop" }],
        usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }
      });
    } catch (error) {
      return send(res, 400, { error: { message: error.message, type: "invalid_request_error" } });
    }
  }
  return send(res, 404, { error: "Not found" });
});
server.listen(PORT, HOST, () => {
  console.log("Janitor Extractor receiver listening on http://" + HOST + ":" + PORT);
  console.log("POST /v1/chat/completions · GET /api/latest · POST /api/clear");
});
process.on("SIGINT", () => { latest = null; server.close(() => process.exit(0)); });
process.on("SIGTERM", () => { latest = null; server.close(() => process.exit(0)); });
