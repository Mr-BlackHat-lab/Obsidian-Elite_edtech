import { PrismaClient } from "@prisma/client";
import { env } from "../config/env";

declare global {
  // eslint-disable-next-line no-var
  var __learnpulsePrisma: PrismaClient | undefined;
}

export const prisma =
  global.__learnpulsePrisma ??
  new PrismaClient({
    log: env.NODE_ENV === "development" ? ["query", "warn", "error"] : ["warn", "error"],
  });

if (env.NODE_ENV !== "production") {
  global.__learnpulsePrisma = prisma;
}
