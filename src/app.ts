import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import pinoHttp from "pino-http";
import { env } from "./config/env";
import { logger } from "./config/logger";
import { errorHandler } from "./middleware/error.middleware";
import authRouter  from "./routes/auth.routes";
import  employeesRouter  from "./routes/employee.routes";
import  departmentsRouter  from "./routes/department.routes";
import  leaveRouter  from "./routes/leave.routes";
import  leaveTypesRouter  from "./routes/leave-types.routes";
import  attendanceRouter  from "./routes/attendance.routes";
import dashboardRouter from "./routes/dashboard.routes";
import rolesRouter from "./routes/roles.routes";
import holidaysRouter from "./routes/holidays.routes";
import jobPositionsRoutes from "./routes/job-positions.routes";

export function createApp() {
  const app = express();

  // ── Security ───────────────────────────────────────────────────────────────
  app.use(helmet());
  app.set("trust proxy", 1); // needed for rate limiter behind reverse proxy

  app.use(
    cors({
      origin: env.CLIENT_URL,
      credentials: true,
      methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"],
    }),
  );

  // ── Rate limiting ──────────────────────────────────────────────────────────
  const limiter = rateLimit({
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    max: env.RATE_LIMIT_MAX,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      success: false,
      message: "Too many requests, please try again later.",
    },
  });

  // Stricter limiter for auth routes
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      success: false,
      message: "Too many auth attempts, please try again later.",
    },
  });

  app.use(limiter);

  // ── Request parsing ────────────────────────────────────────────────────────
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());

  // ── HTTP logging ───────────────────────────────────────────────────────────
  app.use(
    pinoHttp({
      logger,
      customLogLevel: (_req, res) => {
        if (res.statusCode >= 500) return "error";
        if (res.statusCode >= 400) return "warn";
        return "info";
      },
      customSuccessMessage: (req, res) =>
        `${req.method} ${req.url} → ${res.statusCode}`,
    }),
  );

  // ── Health check ───────────────────────────────────────────────────────────
  app.get("/health", (_req, res) => {
    res.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      env: env.NODE_ENV,
    });
  });

  //  API Routes 
  app.use("/api/auth", authLimiter, authRouter);
  app.use("/api/employees", employeesRouter);
  app.use("/api/departments", departmentsRouter);
  app.use("/api/leave", leaveRouter);
  app.use("/api/leave-types", leaveTypesRouter);
  app.use("/api/attendance", attendanceRouter);
  app.use("/api/dashboard", dashboardRouter);
  app.use("/api/roles", rolesRouter);
  app.use("/api/holidays", holidaysRouter);
  app.use('/api/job-positions', jobPositionsRoutes);


  //  404 handler 
  app.use((_req, res) => {
    res.status(404).json({ success: false, message: "Route not found" });
  });

  // ── Global error handler (must be last) ────────────────────────────────────
  app.use(errorHandler);

  return app;
}
