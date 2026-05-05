import "dotenv/config";
import type { PrismaConfig } from "prisma";
import { defineConfig, env, } from "@prisma/config";


export default defineConfig({
  schema: "./src/prisma/schema.prisma",
  migrations: {
    path: "./src/prisma/migrations",
    seed: "ts-node ./src/prisma/seed.ts",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
}) satisfies PrismaConfig;
