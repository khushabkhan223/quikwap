import "dotenv/config.js";
import express, { type Express } from "express";
import { logger } from "./lib/logger";
import { supabaseClient } from "./db/client.js";

const app: Express = express();
const PORT = 3001;

app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.get("/db-test", async (_req, res) => {
  const { data, error } = await supabaseClient
    .from("businesses")
    .select("*")
    .limit(1);

  if (error) {
    logger.error({ error }, "db-test failed");
    res.status(500).json({ ok: false, error: error.message });
    return;
  }

  res.json({ ok: true, rowCount: data.length });
});

app.listen(PORT, () => {
  logger.info({ port: PORT }, "API server started");
});

export { app };
