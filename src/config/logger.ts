import pino from "pino";
import { env } from "./env";

export const logger = pino({
  level: env.NODE_ENV === "production" ? "info" : "debug",
  ...(env.NODE_ENV !== "production" && {
    transport: {
      target: "pino-pretty",
      options: {
        colorize: true,
        translateTime: "SYS:standard",
        ignore: "pid,hostname",
      },
    },
  }),
  redact: {
    // Never log these fields — security
    paths: [
      "*.password",
      "*.passwordHash",
      "*.token",
      "*.tokenHash",
      "*.authorization",
    ],
    censor: "[REDACTED]",
  },
});
