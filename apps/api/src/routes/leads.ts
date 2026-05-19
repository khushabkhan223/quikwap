import { Router, type Request, type Response } from "express";
import { updateContactBotPaused } from "../db/queries/contacts.js";
import { getLeadsWithContacts, updateLeadStatus } from "../db/queries/leads.js";
import { getContactMessages } from "../db/queries/messages.js";
import { supabaseAdmin } from "../db/client.js";
import { logger } from "../lib/logger.js";

export const leadsRouter: ReturnType<typeof Router> = Router();

leadsRouter.post(
  "/leads/:contactId/takeover",
  async (req: Request, res: Response) => {
    const { contactId } = req.params as { contactId: string };
    const { businessId } = req.body as { businessId?: string };
    if (!businessId) {
      res.status(400).json({ error: "businessId required" });
      return;
    }
    try {
      await updateContactBotPaused(businessId, contactId, true);
      logger.info({ businessId, contactId }, "Agent took over conversation");
      res.json({ ok: true });
    } catch (err) {
      logger.error({ businessId, contactId, err }, "takeover failed");
      res.status(500).json({ error: "Internal server error" });
    }
  },
);

leadsRouter.post(
  "/leads/:contactId/resume",
  async (req: Request, res: Response) => {
    const { contactId } = req.params as { contactId: string };
    const { businessId } = req.body as { businessId?: string };
    if (!businessId) {
      res.status(400).json({ error: "businessId required" });
      return;
    }
    try {
      await updateContactBotPaused(businessId, contactId, false);
      logger.info({ businessId, contactId }, "Bot resumed");
      res.json({ ok: true });
    } catch (err) {
      logger.error({ businessId, contactId, err }, "resume failed");
      res.status(500).json({ error: "Internal server error" });
    }
  },
);

leadsRouter.post(
  "/leads/:contactId/close",
  async (req: Request, res: Response) => {
    const { contactId } = req.params as { contactId: string };
    const { businessId } = req.body as { businessId?: string };
    if (!businessId) {
      res.status(400).json({ error: "businessId required" });
      return;
    }
    try {
      await updateLeadStatus(businessId, contactId, "enrolled");
      const { error } = await supabaseAdmin
        .from("lead_tracking")
        .update({ closed_at: new Date().toISOString() })
        .eq("business_id", businessId)
        .eq("contact_id", contactId);
      if (error) throw error;
      await updateContactBotPaused(businessId, contactId, false);
      logger.info({ businessId, contactId }, "Deal closed");
      res.json({ ok: true });
    } catch (err) {
      logger.error({ businessId, contactId, err }, "close failed");
      res.status(500).json({ error: "Internal server error" });
    }
  },
);

leadsRouter.post(
  "/leads/:contactId/lost",
  async (req: Request, res: Response) => {
    const { contactId } = req.params as { contactId: string };
    const { businessId } = req.body as { businessId?: string };
    if (!businessId) {
      res.status(400).json({ error: "businessId required" });
      return;
    }
    try {
      await updateLeadStatus(businessId, contactId, "lost");
      const { error } = await supabaseAdmin
        .from("lead_tracking")
        .update({ lost_at: new Date().toISOString() })
        .eq("business_id", businessId)
        .eq("contact_id", contactId);
      if (error) throw error;
      await updateContactBotPaused(businessId, contactId, false);
      logger.info({ businessId, contactId }, "Lead marked lost");
      res.json({ ok: true });
    } catch (err) {
      logger.error({ businessId, contactId, err }, "lost failed");
      res.status(500).json({ error: "Internal server error" });
    }
  },
);

leadsRouter.get("/leads", async (req: Request, res: Response) => {
  const businessId = req.query["businessId"] as string | undefined;
  if (!businessId) {
    res.status(400).json({ error: "businessId required" });
    return;
  }
  try {
    const leads = await getLeadsWithContacts(businessId);
    res.json({ leads });
  } catch (err) {
    logger.error({ businessId, err }, "getLeads failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

leadsRouter.get(
  "/leads/:contactId/messages",
  async (req: Request, res: Response) => {
    const { contactId } = req.params as { contactId: string };
    const businessId = req.query["businessId"] as string | undefined;
    if (!businessId) {
      res.status(400).json({ error: "businessId required" });
      return;
    }
    try {
      const messages = await getContactMessages(businessId, contactId);
      res.json({ messages });
    } catch (err) {
      logger.error({ businessId, contactId, err }, "getMessages failed");
      res.status(500).json({ error: "Internal server error" });
    }
  },
);
