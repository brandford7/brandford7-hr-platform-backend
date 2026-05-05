import "dotenv/config";
import { createApp } from "./app";
import { env } from "./config/env";
import { logger } from "./config/logger";
import { prisma } from "./config/prisma";

const app = createApp();

const server = app.listen(env.PORT, () => {
  logger.info(
    { port: env.PORT, env: env.NODE_ENV },
    "HR Platform API is running",
  );
});


const shutdown = async (signal: string) => {
  logger.info({ signal }, "Shutdown signal received");

  server.close(async () => {
    await prisma.$disconnect();
    logger.info("Server closed. Database disconnected.");
    process.exit(0);
  });

  // Force exit if graceful shutdown stalls after 10s
  setTimeout(() => {
    logger.error("Forced shutdown after timeout");
    process.exit(1);
  }, 10_000);
};

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));

process.on("unhandledRejection", (reason) => {
  logger.error({ reason }, "Unhandled Promise Rejection");
});

process.on("uncaughtException", (error) => {
  logger.fatal({ error }, "Uncaught Exception — shutting down");
  process.exit(1);
});
