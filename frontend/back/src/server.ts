import app from "./app";
import { env } from "./config/env";
import { prisma } from "./db/prisma";

async function startServer(): Promise<void> {
  await prisma.$connect();

  const server = app.listen(env.PORT, () => {
    console.info(`[Auth API] Listening on http://localhost:${env.PORT}`);
  });

  const shutdown = (signal: string) => {
    console.info(`[Auth API] Received ${signal}. Shutting down.`);

    server.close(async () => {
      await prisma.$disconnect();
      process.exit(0);
    });
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

startServer().catch(async (error: unknown) => {
  console.error("[Auth API] Failed to start server", error);
  await prisma.$disconnect();
  process.exit(1);
});
