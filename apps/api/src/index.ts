import express, { type Express } from "express";
import { logger } from "./lib/logger";

const app: Express = express();
const PORT = 3001;

app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  logger.info({ port: PORT }, "API server started");
});

export { app };
