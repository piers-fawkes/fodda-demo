import express from "express";
import cors from "cors";
import crypto from "crypto";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

// Routers
import authRouter from "./routers/authRouter.js";
import accountRouter from "./routers/accountRouter.js";
import queryRouter from "./routers/queryRouter.js";
import mcpRouter from "./routers/mcpRouter.js";
import expertGraphRouter from "./routers/expertGraphRouter.js";
import catalogRouter from "./routers/catalogRouter.js";
import userRouter from "./routers/userRouter.js";
import cronRouter from "./routers/cronRouter.js";
import slackEventsRouter from "./routers/slackEventsRouter.js";
import contributionRouter from "./routers/contributionRouter.js";

dotenv.config();

console.log("--------------------------------------------------");
console.log("FODDA DISCOVERY ENGINE: MODULAR INITIALIZATION");
console.log(`TIME: ${new Date().toISOString()}`);
console.log("--------------------------------------------------");

// Security startup assertions
if (!process.env.FODDA_MCP_SECRET) {
  console.warn("[SECURITY] FODDA_MCP_SECRET is not set — HMAC verification is DISABLED. Set this env var in production.");
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Standard Middlewares
// Restrict CORS to known origins only — do not mirror arbitrary origins
const ALLOWED_ORIGINS = [
  'https://app.fodda.ai',
  'https://fodda.ai',
  'https://www.fodda.ai',
  'https://fodda-sandbox-1095548227950.us-central1.run.app',
  'http://localhost:5173',
  'http://localhost:8080',
];
app.use(cors({
  origin: (origin, callback) => {
    // Allow server-to-server requests (no origin header) and known origins
    if (!origin || ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
    console.warn(`[CORS] Blocked request from unknown origin: ${origin}`);
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
}) as any);
app.use(express.json({
  limit: "75mb", // Supports base64-encoded PDF uploads up to ~50MB
  verify: (req: any, res, buf) => {
    req.rawBody = buf.toString();
  }
}) as any);

// Handle JSON parsing errors
app.use((err: any, req: any, res: any, next: any) => {
  if (err instanceof SyntaxError && 'body' in err) {
    console.error("[JSON Parse Error]", err);
    return res.status(400).json({ ok: false, error: "Invalid JSON payload" });
  }
  next();
});

// HMAC Verification Middleware (Self-contained)
app.use((req, res, next) => {
  const signature = req.headers["x-fodda-signature"];
  if (signature) {
    const secret = process.env.FODDA_MCP_SECRET;
    if (!secret) return next();

    const timestamp = req.headers["x-fodda-timestamp"] || "";
    const bodyContent = (req as any).rawBody || JSON.stringify(req.body);
    const payload = timestamp + "." + bodyContent;
    const expected = crypto.createHmac("sha256", secret).update(payload).digest("hex");

    if (signature !== expected) return res.status(401).json({ error: "Invalid HMAC signature" });
    const ts = Number(timestamp);
    if (!ts || Math.abs(Date.now() - ts) > 5 * 60 * 1000) return res.status(401).json({ error: "Request expired" });
  }
  next();
});

// Logging & Profiling Middleware
app.use((req, res, next) => {
  const start = Date.now();
  const originalJson = res.json;
  res.json = function (body) {
    const duration = Date.now() - start;
    if (req.headers['x-fodda-profiling'] === 'true') {
      res.setHeader('X-Fodda-Latency', `${duration}ms`);
      if (body && typeof body === 'object' && !Array.isArray(body) && body.meta && typeof body.meta === 'object') {
        body.meta.latency_ms = duration;
      }
      console.log(`[PROFILING] ${req.method} ${req.path} - ${duration}ms`);
    }
    return originalJson.call(this, body);
  };
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// Mount Routers
app.use("/api/auth", authRouter);
app.use("/api/account", accountRouter);
app.use("/api", queryRouter); // Search, log, and gemini-search are often called at /api/query etc
app.use("/api/mcp", mcpRouter);
app.use("/api/expert-graph", expertGraphRouter);
app.use("/api", catalogRouter);
app.use("/api/user", userRouter);
app.use("/api/cron", cronRouter);
app.use("/api/slack/events", slackEventsRouter);
app.use("/api/contributions", contributionRouter);

// Health Check
app.get("/health", (req, res) => res.json({ status: "ok", uptime: process.uptime() }));

// Serve Vite frontend build
const distPath = path.join(__dirname, "..", "dist");
app.use(express.static(distPath));

// SPA fallback — serve index.html for any non-API route
app.get("*", (req, res) => {
  if (req.path.startsWith("/api/")) return res.status(404).json({ error: "Not found" });
  res.sendFile(path.join(distPath, "index.html"));
});

// Error Handling Middleware
app.use((err: any, req: any, res: any, next: any) => {
  console.error("[Fatal Error]", err);
  res.status(500).json({
    ok: false,
    error: process.env.NODE_ENV === 'production' ? "Internal Server Error" : err.message
  });
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`[Server] Fodda Discovery Engine listening on port ${PORT}`);
});
