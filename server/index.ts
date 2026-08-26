import express from "express";
import cors from "cors";
import crypto from "crypto";
import "dotenv/config";
import helmet from "helmet";
import path from "path";
import { fileURLToPath } from "url";

// Routers
import authRouter from "./routers/authRouter.js";
import accountRouter from "./routers/accountRouter.js";
import queryRouter from "./routers/queryRouter.js";
import mcpRouter from "./routers/mcpRouter.js";
import catalogRouter from "./routers/catalogRouter.js";
import userRouter from "./routers/userRouter.js";
import cronRouter from "./routers/cronRouter.js";
import slackEventsRouter from "./routers/slackEventsRouter.js";
import contributionRouter from "./routers/contributionRouter.js";
import webhookRouter from "./routers/webhookRouter.js";
import creatorRouter from "./routers/creatorRouter.js";
import expertRouter from "./routers/expertRouter.js";
import unclaimedRouter from "./routers/unclaimedRouter.js";
import coverageRouter from "./routers/coverageRouter.js";
import { resolveIdentity, isPendingKey, handleLegacyTrialKey } from './helpers.js';
import { clerkMiddleware, requireAuth } from "@clerk/express";
import { getQueryLogFailureCount } from "./services/queryReconciliationService.js";



// Clerk Express SDK expects CLERK_PUBLISHABLE_KEY, but VITE_CLERK_PUBLISHABLE_KEY is standard in the environment config.
process.env.CLERK_PUBLISHABLE_KEY = process.env.CLERK_PUBLISHABLE_KEY || process.env.VITE_CLERK_PUBLISHABLE_KEY;

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

// Use Helmet for security headers, allowing external assets like GTM, GA, Tailwind, ESM.sh, Clerk, and Stripe
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: [
        "'self'", 
        "'unsafe-inline'", 
        "'unsafe-eval'", 
        "https://www.googletagmanager.com", 
        "https://www.google-analytics.com", 
        "https://cdn.tailwindcss.com", 
        "https://esm.sh", 
        "https://*.clerk.accounts.dev",
        "https://clerk.fodda.ai",
        "https://clerk.com",
        "https://challenges.cloudflare.com",
        "https://js.stripe.com"
      ],
      connectSrc: [
        "'self'", 
        "https://www.google-analytics.com", 
        "https://*.clerk.accounts.dev", 
        "https://clerk.fodda.ai", 
        "https://clerk.com", 
        "https://api.stripe.com", 
        "https://upload.uploadcare.com",
        "https://api.fodda.ai",
        "https://*.fodda.ai"
      ],
      frameSrc: ["'self'", "https://js.stripe.com", "https://www.googletagmanager.com", "https://challenges.cloudflare.com"],
      imgSrc: ["'self'", "data:", "https://images.unsplash.com", "https://ucarecdn.com", "https://www.google-analytics.com", "https://www.googletagmanager.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      workerSrc: ["'self'", "blob:"],
      childSrc: ["'self'", "blob:"],
    },
  },
}));

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
  limit: "1mb", // Standard JSON limit
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
    if (!secret) {
      if (process.env.NODE_ENV === 'production') {
        return res.status(500).json({ error: "HMAC signature secret is not configured" });
      }
      return next();
    }

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
  const authHeader = req.headers.authorization;
  const authStatus = authHeader 
    ? `Auth: Present (len: ${authHeader.length})` 
    : 'Auth: NONE';
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} - ${authStatus}`);
  next();
});


// Reconstruct the PEM key structure (convert literal \n to actual newlines) if set
if (process.env.CLERK_JWT_KEY) {
  process.env.CLERK_JWT_KEY = process.env.CLERK_JWT_KEY.replace(/\\n/g, '\n');
}

// Global Clerk authentication middleware
app.use(clerkMiddleware({
  publishableKey: process.env.CLERK_PUBLISHABLE_KEY || process.env.VITE_CLERK_PUBLISHABLE_KEY,
  secretKey: process.env.CLERK_SECRET_KEY,
  jwtKey: process.env.CLERK_JWT_KEY,
  debug: process.env.NODE_ENV !== 'production'
}));

// ── Pending API Key Gate ─────────────────────────────────────────────
// Website-provisioned Base accounts get a 'Pending' API key until email
// is confirmed. Reject those keys globally so no router needs to check.
app.use('/api', async (req, res, next) => {
  const apiKey = req.headers['x-api-key'] as string;
  if (!apiKey) return next(); // No API key = session/Clerk auth, not our concern

  // Legacy trial keys — block and auto-migrate if we have an email
  if (apiKey.startsWith('sk_trial_')) {
    return handleLegacyTrialKey(req, res);
  }

  try {
    const identity = await resolveIdentity(apiKey);
    if (identity && isPendingKey(identity)) {
      return res.status(403).json({
        ok: false,
        error: 'API key pending activation. Check your email and click the confirmation link.',
        code: 'KEY_PENDING_CONFIRMATION'
      });
    }
  } catch (err) {
    console.error('[PendingKeyGate] Error checking key status:', err);
    // Fail-open: don't block on identity resolution errors
  }
  next();
});

// Mount Routers
app.use("/api/webhooks", webhookRouter);
app.use("/api/auth", authRouter);
app.use("/api/account", accountRouter);
app.use("/api", queryRouter); // Search, log, and gemini-search are often called at /api/query etc
app.use("/api/mcp", mcpRouter);
app.use("/api", catalogRouter);
app.use("/api/user", userRouter);
app.use("/api/cron", cronRouter);
app.use("/api/slack/events", slackEventsRouter);
app.use("/api/contributions", contributionRouter);
app.use("/api/creator", creatorRouter);
app.use("/api/expert", requireAuth(), expertRouter);
app.use("/api/unclaimed", unclaimedRouter);
app.use("/api/coverage", coverageRouter);

// Health Check
app.get("/health", (req, res) => res.json({ 
  status: "ok", 
  uptime: process.uptime(),
  queryLogFailures: getQueryLogFailureCount()
}));

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
