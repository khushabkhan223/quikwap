import { Router, type Request, type Response } from "express";
import { createBspAdapter } from "@quikwap/bsp-adapter";
import {
  generateCustomerReply,
  detectIntentAndSummary,
} from "../lib/gemini.js";
import { findMatchingRule } from "../lib/keyword-matcher.js";
import { findBusinessByPhoneNumber } from "../db/queries/businesses.js";
import { getBusinessKnowledge } from "../db/queries/business-knowledge.js";
import {
  findOrCreateContact,
  updateContactLastMessage,
  addTagToContact,
} from "../db/queries/contacts.js";
import { findOrCreateLead, updateLeadStatus } from "../db/queries/leads.js";
import { saveMessage, getRecentMessages } from "../db/queries/messages.js";
import { getActiveKeywordRules } from "../db/queries/keyword-rules.js";
import { logger } from "../lib/logger.js";

export const webhookRouter: ReturnType<typeof Router> = Router();

const adapter = createBspAdapter({ provider: "twilio" });

webhookRouter.post("/webhook/whatsapp", async (req: Request, res: Response) => {
  // Step 1 — Extract fields from Twilio form-encoded payload
  const customerMessage = req.body.Body as string;
  const fromNumber = req.body.From as string; // "whatsapp:+91XXXXXXXXXX"
  const toNumber = req.body.To as string; // "whatsapp:+91XXXXXXXXXX"
  const messageSid = req.body.MessageSid as string;

  const customerPhone = fromNumber.replace("whatsapp:", "");
  const businessPhone = toNumber.replace("whatsapp:", "");

  try {
    // Step 2 — Find the business by phone number
    const business = await findBusinessByPhoneNumber(businessPhone);
    if (!business) {
      logger.error({ businessPhone }, "No business found for phone number");
      res.status(404).send("Not found");
      return;
    }
    const businessId = business.id;

    // Step 3 — Find or create the contact
    const contact = await findOrCreateContact(businessId, customerPhone);

    // Step 4 — Save the incoming message
    await saveMessage(
      businessId,
      contact.id,
      "incoming",
      customerMessage,
      messageSid,
    );

    // Step 5 — Get recent conversation history for Gemini context
    const recentMessages = await getRecentMessages(businessId, contact.id, 10);

    // Step 6 — Get business knowledge for RAG
    const knowledge = await getBusinessKnowledge(businessId);
    const businessKnowledgeData = knowledge?.structuredData ?? {};

    // Step 7 — Reply logic: Gemini → keyword rules → fallback
    let replyText: string;
    let replySource: "gemini" | "keyword" | "fallback";

    try {
      replyText = await generateCustomerReply(
        customerMessage,
        businessKnowledgeData,
        business.businessName,
        business.industry,
        recentMessages.map((m) => ({
          role:
            m.direction === "incoming"
              ? ("user" as const)
              : ("assistant" as const),
          content: m.body,
        })),
      );
      replySource = "gemini";
      logger.info({ businessId, replySource }, "Reply generated");
    } catch (geminiError) {
      logger.warn(
        { businessId, error: geminiError },
        "Gemini failed, falling back to keyword rules",
      );

      try {
        const keywordRules = await getActiveKeywordRules(businessId);
        const matchedRule = findMatchingRule(customerMessage, keywordRules);

        if (matchedRule) {
          replyText = matchedRule.replyMessage;
          replySource = "keyword";
          logger.info(
            { businessId, replySource, ruleId: matchedRule.id },
            "Reply from keyword rule",
          );
        } else {
          replyText =
            "Thank you for your message. We will get back to you shortly.";
          replySource = "fallback";
          logger.info({ businessId, replySource }, "Reply from fallback");
        }
      } catch (keywordError) {
        replyText =
          "Thank you for your message. We will get back to you shortly.";
        replySource = "fallback";
        logger.error(
          { businessId, error: keywordError },
          "Keyword lookup failed, using fallback",
        );
      }
    }

    // Step 8 — Send the reply via Twilio (soft failure — always return 200 to prevent retries)
    try {
      await adapter.sendMessage({
        to: { id: customerPhone, phoneNumber: customerPhone },
        body: replyText,
      });
    } catch (sendError) {
      logger.error(
        { businessId, error: sendError },
        "Failed to send WhatsApp reply",
      );
    }

    // Step 9 — Save the outgoing message
    // Step 10 — Update contact's last_message_at (DB trigger also handles this automatically)
    try {
      await saveMessage(businessId, contact.id, "outgoing", replyText);
      await updateContactLastMessage(contact.id);
    } catch (dbError) {
      logger.error(
        { businessId, error: dbError },
        "Failed to save outgoing message",
      );
    }

    // Step 11 — Detect intent and update lead tracking (soft failure — reply already sent)
    try {
      const conversationHistory = recentMessages.map((m) => ({
        role:
          m.direction === "incoming"
            ? ("user" as const)
            : ("assistant" as const),
        content: m.body,
      }));

      const { intent, summary } = await detectIntentAndSummary(
        customerMessage,
        conversationHistory,
        businessKnowledgeData,
      );

      const lead = await findOrCreateLead(businessId, contact.id);

      if (intent === "site_visit_requested") {
        await addTagToContact(businessId, contact.id, "site_visit_requested");
        await updateLeadStatus(businessId, contact.id, "interested", summary);
        logger.info(
          { businessId, contactId: contact.id, intent },
          "Lead marked interested",
        );
      } else if (intent === "not_interested") {
        await updateLeadStatus(businessId, contact.id, "lost", summary);
        logger.info(
          { businessId, contactId: contact.id, intent },
          "Lead marked lost",
        );
      } else if (intent === "general_enquiry") {
        // Only move forward — don't downgrade an already-interested lead back to contacted
        if (lead.status === "new") {
          await updateLeadStatus(businessId, contact.id, "contacted", summary);
          logger.info(
            { businessId, contactId: contact.id, intent },
            "Lead marked contacted",
          );
        }
      }
    } catch (intentError) {
      logger.warn(
        { businessId, error: intentError },
        "Intent detection failed, skipping lead update",
      );
    }

    // Step 12 — Return 200 to Twilio
    res.status(200).send("OK");
  } catch (err) {
    logger.error({ err, businessPhone }, "Webhook handler failed");
    res.status(500).send("Error");
  }
});
