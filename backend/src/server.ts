import { createApp } from "./app.js";
import { env } from "./config/env.js";
import {
  connectDatabase,
  disconnectDatabase,
} from "./db/connect.js";

async function startServer(): Promise<void> {
  await connectDatabase();

  const app = createApp();

  const server = app.listen(env.PORT, env.HOST, () => {
    console.log(
      `SADS backend listening on http://${env.HOST}:${env.PORT}`,
    );
  });

  let shuttingDown = false;

  async function shutdown(): Promise<void> {
    if (shuttingDown) return;
    shuttingDown = true;

    server.close(async (error) => {
      try {
        await disconnectDatabase();
      } catch (disconnectError) {
        console.error(
          "Database disconnect failed:",
          disconnectError,
        );
        process.exitCode = 1;
      }

      if (error) {
        console.error("HTTP server shutdown failed:", error);
        process.exitCode = 1;
      }
    });
  }

  process.once("SIGINT", () => void shutdown());
  process.once("SIGTERM", () => void shutdown());
}

startServer().catch(async (error: unknown) => {
  console.error("Failed to start SADS backend:", error);

  try {
    await disconnectDatabase();
  } catch (disconnectError) {
    console.error("Database cleanup failed:", disconnectError);
  }

  process.exitCode = 1;
});