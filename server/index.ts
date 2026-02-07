
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

console.log("--------------------------------------------------");
console.log("FODDA DISCOVERY ENGINE: STARTING INITIALIZATION");
console.log(`TIME: ${new Date().toISOString()}`);
console.log("--------------------------------------------------");

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors({ origin: true }) as any);
app.use(express.json({ limit: "10mb" }) as any);

// Handle JSON parsing errors
app.use((err: any, req: any, res: any, next: any) => {
  if (err instanceof SyntaxError && 'body' in err) {
    console.error("[JSON Parse Error]", err);
    return res.status(400).json({ ok: false, error: "Invalid JSON payload" });
  }
  next();
});

// Logging middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

const FODDA_API_URL = "https://api.fodda.ai";

app.post(["/api/query", "/api/query/"], async (req, res) => {
  try {
    const response = await fetch(`${FODDA_API_URL}/api/query`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req.body)
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Fodda API Error ${response.status}: ${text}`);
    }

    const data = await response.json();
    res.json(data);
  } catch (err: any) {
    console.error("[Fodda API Proxy Error]", err);
    res.status(500).json({ ok: false, error: err.message, dataStatus: "ERROR" });
  }
});

app.get("/api/ping", (req, res) => res.json({ ok: true, message: "pong", timestamp: new Date().toISOString() }));

app.get("/api/neo4j/health", async (req, res) => {
  try {
    const response = await fetch(`${FODDA_API_URL}/api/health`).catch(() => null);
    if (response && response.ok) {
      res.json({ ok: true, source: "Fodda API" });
    } else {
      res.json({ ok: false, error: "Fodda API Unreachable" });
    }
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Keep log endpoints but maybe they should also be proxied or handled locally?
// For now, let's just make them no-ops or simple success to avoid errors if Neo4j is gone.
app.post("/api/log", (req, res) => res.json({ ok: true }));
app.get("/api/logs", (req, res) => res.json({ ok: true, logs: [] }));

app.post("/api/import/trends", async (req, res) => {
  try {
    const response = await fetch(`${FODDA_API_URL}/api/import/trends`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req.body)
    });
    const data = await response.json();
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.post("/api/import/articles", async (req, res) => {
  try {
    const response = await fetch(`${FODDA_API_URL}/api/import/articles`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req.body)
    });
    const data = await response.json();
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.get("/__deploy_check", (req, res) => res.json({ ok: true, timestamp: new Date().toISOString() }));

// Ensure any other /api/* routes return 404 JSON instead of falling through to SPA HTML
app.all("/api/*", (req, res) => {
  res.status(404).json({ ok: false, error: `API Route ${req.method} ${req.path} not found` });
});

async function startServer() {
  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Serve static files in production
    const distPath = path.resolve(__dirname, "../dist");
    const fs = await import("fs");
    if (fs.existsSync(distPath)) {
      console.log(`[Server] dist directory found at: ${distPath}`);
    } else {
      console.error(`[Server] CRITICAL: dist directory NOT found at: ${distPath}`);
    }
    
    app.use(express.static(distPath));
    
    // Handle SPA routing
    app.get("*", (req, res, next) => {
      if (req.path.startsWith("/api")) return next();
      const indexPath = path.join(distPath, "index.html");
      res.sendFile(indexPath, (err) => {
        if (err) {
          console.error(`[Server] Error sending index.html from ${indexPath}:`, err);
          res.status(500).send("Internal Server Error: Missing static assets.");
        }
      });
    });
  }

  const PORT = process.env.PORT || 8080;
  app.listen(Number(PORT), "0.0.0.0", () => {
    console.log(`Fodda Discovery Engine Active on port ${PORT}`);
    console.log(`Production Mode: ${process.env.NODE_ENV === "production"}`);
  });
}

startServer();
