import { Router, type Request, type Response } from "express";
import { parseBusinessInfo, generateCustomerReply } from "../lib/gemini.js";
import {
  getBusinessKnowledge,
  saveBusinessKnowledge,
  saveOnboardingMessage,
  getOnboardingMessages,
  confirmBusinessKnowledge,
} from "../db/queries/business-knowledge.js";
import { logger } from "../lib/logger.js";

export const onboardingRouter: ReturnType<typeof Router> = Router();

onboardingRouter.post(
  "/onboarding/message",
  async (req: Request, res: Response) => {
    const { businessId, message, industry } = req.body as {
      businessId: unknown;
      message: unknown;
      industry: unknown;
    };

    if (
      typeof businessId !== "string" ||
      typeof message !== "string" ||
      typeof industry !== "string"
    ) {
      res.status(400).json({
        error: "businessId, message, and industry are required strings",
      });
      return;
    }

    try {
      await saveOnboardingMessage(businessId, "user", message);

      const allMessages = await getOnboardingMessages(businessId);
      // Exclude the message we just saved so history is what came before
      const conversationHistory = allMessages
        .slice(0, -1)
        .map((m) => ({ role: m.role, content: m.content }));

      // Treat as business info if it's substantial and not a question
      const isBusinessInfo =
        message.trim().length > 20 && !message.trim().endsWith("?");

      let structuredData: Record<string, unknown> | null = null;

      if (isBusinessInfo) {
        structuredData = await parseBusinessInfo(message, industry);
        await saveBusinessKnowledge(businessId, message, structuredData);
      }

      const existingKnowledge = await getBusinessKnowledge(businessId);
      const knowledge = existingKnowledge?.structuredData ?? {};

      const reply = await generateCustomerReply(
        message,
        knowledge,
        "Quikwap Onboarding Assistant",
        industry,
        conversationHistory,
      );

      await saveOnboardingMessage(businessId, "assistant", reply);

      res.json({ reply, structuredData });
    } catch (err) {
      logger.error({ err }, "onboarding message handler failed");
      res.status(500).json({ error: "Internal server error" });
    }
  },
);

onboardingRouter.get(
  "/onboarding/knowledge/:businessId",
  async (req: Request, res: Response) => {
    const { businessId } = req.params;

    try {
      const knowledge = await getBusinessKnowledge(businessId);
      res.json({ knowledge });
    } catch (err) {
      logger.error({ err }, "get knowledge handler failed");
      res.status(500).json({ error: "Internal server error" });
    }
  },
);

onboardingRouter.post(
  "/onboarding/confirm/:businessId",
  async (req: Request, res: Response) => {
    const { businessId } = req.params;

    try {
      await confirmBusinessKnowledge(businessId);
      res.json({ ok: true });
    } catch (err) {
      logger.error({ err }, "confirm knowledge handler failed");
      res.status(500).json({ error: "Internal server error" });
    }
  },
);
