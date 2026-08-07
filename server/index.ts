import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic, log } from "./runtime";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import publicVerifyRoutes from "./routes/public-verify";
import { pool } from "./db";
import { ensureCurrentSchema } from "./schema-bootstrap";
import { startBackupScheduler } from "./backups/scheduler";
import { registerPaddleWebhook } from "./billing/paddle";
import { startUltimateScheduler } from "./ultimate/automation";
import { randomUUID } from "node:crypto";
import {
  accountRecoveryLimiter,
  adminLimiter,
  apiLimiter,
  contactLimiter,
  emailVerificationLimiter,
  loginLimiter,
  protectStateChangingApiRequests,
  registrationLimiter,
  securityHeaders,
  SESSION_COOKIE_NAME,
  sessionCookieOptions,
  ultimateAiLimiter,
} from "./security";

const app = express();
const isProduction = process.env.NODE_ENV === "production";
const sessionSecret = process.env.SESSION_SECRET;

if (isProduction && !sessionSecret) {
  throw new Error("SESSION_SECRET must be set in production");
}

if (isProduction) {
  app.set("trust proxy", 1);
}
app.disable("x-powered-by");
app.use(securityHeaders);

app.use((req, res, next) => {
  const requestId = randomUUID();
  res.setHeader("X-Request-ID", requestId);
  res.locals.requestId = requestId;
  next();
});

// Paddle signature verification requires the untouched request body.
registerPaddleWebhook(app);
app.use(express.json({ limit: "8mb" }));
app.use(express.urlencoded({ extended: false, limit: "1mb" }));

app.use("/api/login", loginLimiter);
app.use("/api/auth/register", registrationLimiter);
app.use("/api/auth/forgot-password", accountRecoveryLimiter);
app.use("/api/auth/reset-password", accountRecoveryLimiter);
app.use("/api/auth/resend-verification", emailVerificationLimiter);
app.use("/api/auth/verify-email-code", emailVerificationLimiter);
app.use("/api/contact", contactLimiter);
app.use("/api/admin", adminLimiter);
app.use("/api/ultimate", ultimateAiLimiter);
app.use("/api", apiLimiter, protectStateChangingApiRequests);

app.get('/api/health', async (_req, res) => {
  try {
    await pool.query('select 1');
    res.json({ status: 'ok' });
  } catch (error) {
    console.error('Health check failed:', error);
    res.status(503).json({ status: 'unavailable' });
  }
});

// Register public verification routes before authentication middleware
app.use('/api/auth', publicVerifyRoutes);

// Configure session middleware
const PgSessionStore = connectPgSimple(session);

app.use(session({
  name: SESSION_COOKIE_NAME,
  store: new PgSessionStore({
    pool,
    tableName: "express_sessions",
    createTableIfMissing: true,
  }),
  secret: sessionSecret || 'tickd-local-development-secret',
  resave: false,
  saveUninitialized: false,
  rolling: true,
  cookie: sessionCookieOptions,
}));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      log(`${req.method} ${path} ${res.statusCode} in ${duration}ms [${res.locals.requestId}]`);
    }
  });

  next();
});

(async () => {
  await ensureCurrentSchema();
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    console.error(err);
    res.status(status).json({ message });
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV !== "production") {
    const { setupVite } = await import("./vite");
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // Serve both the API and client from one port. Replit defaults to 5000,
  // but local development can override it when another service owns that port.
  const port = parseInt(process.env.PORT || "5000", 10);
  const host = process.env.HOST || "0.0.0.0";
  server.listen({
    port,
    host,
  }, () => {
    log(`serving on port ${port}`);
    startBackupScheduler();
    startUltimateScheduler();
  });
})();
