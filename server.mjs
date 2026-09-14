import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import nodemailer from "nodemailer";

const root = path.dirname(fileURLToPath(import.meta.url));
const dist = path.join(root, "dist");
const port = Number(process.env.PORT ?? 3000);
const serviceSecret = process.env.AURRIQ_EMAIL_SERVICE_SECRET;

function transport() {
  const host = process.env.SMTP_SERVER;
  const smtpPort = Number(process.env.SMTP_PORT ?? 587);
  const user = process.env.SMTP_USER ?? process.env.MAIL_USERNAME;
  const password = process.env.SMTP_PASS ?? process.env.MAIL_PASSWORD;
  if (!host || !user || !password) throw new Error("SMTP email configuration is missing");
  return nodemailer.createTransport({ host, port: smtpPort, secure: smtpPort === 465, auth: { user, pass: password } });
}

function sendJson(response, status, body) {
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(JSON.stringify(body));
}

async function readJson(request) {
  let body = "";
  for await (const chunk of request) body += chunk;
  return JSON.parse(body || "{}");
}

async function handleEmail(request, response) {
  if (!serviceSecret || request.headers.authorization !== `Bearer ${serviceSecret}`) {
    return sendJson(response, 401, { error: "Unauthorized" });
  }
  const body = await readJson(request);
  if (!body.to || !body.subject || !body.html) return sendJson(response, 400, { error: "Missing email fields" });
  await transport().sendMail({
    from: body.from ?? process.env.MAIL_DEFAULT_SENDER ?? process.env.SMTP_USER ?? process.env.MAIL_USERNAME,
    to: body.to,
    subject: body.subject,
    html: body.html,
  });
  return sendJson(response, 200, { sent: true });
}

function serve(request, response) {
  const requested = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
  const relative = requested === "/" ? "index.html" : requested.replace(/^\//, "");
  const filePath = path.resolve(dist, relative);
  const safePath = filePath.startsWith(path.resolve(dist)) ? filePath : path.join(dist, "index.html");
  const target = fs.existsSync(safePath) && fs.statSync(safePath).isFile() ? safePath : path.join(dist, "index.html");
  const extension = path.extname(target);
  const contentType = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp" }[extension] ?? "application/octet-stream";
  response.writeHead(200, { "Content-Type": contentType });
  fs.createReadStream(target).pipe(response);
}

http.createServer(async (request, response) => {
  try {
    if (request.method === "POST" && request.url === "/api/email/send") return await handleEmail(request, response);
    if (request.method === "GET" || request.method === "HEAD") return serve(request, response);
    return sendJson(response, 405, { error: "Method not allowed" });
  } catch (error) {
    console.error("Request failed:", error);
    return sendJson(response, 500, { error: "Email service failed" });
  }
}).listen(port, "0.0.0.0", () => console.log(`Aurriq server listening on ${port}`));
