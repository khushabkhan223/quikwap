import twilio from "twilio";
import pino from "pino";
import { BspAdapter } from "../adapter.js";
import type { OutgoingMessage, SendResult, WebhookEvent } from "../types.js";

const logger = pino({ level: "info" });

function isTwilioPayload(
  value: unknown,
): value is { Body: string; From: string; To: string; MessageSid: string } {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v["Body"] === "string" &&
    typeof v["From"] === "string" &&
    typeof v["To"] === "string" &&
    typeof v["MessageSid"] === "string"
  );
}

export class TwilioBspAdapter extends BspAdapter {
  async sendMessage(message: OutgoingMessage): Promise<SendResult> {
    const accountSid = process.env["TWILIO_ACCOUNT_SID"];
    const authToken = process.env["TWILIO_AUTH_TOKEN"];
    const fromNumber = process.env["TWILIO_WHATSAPP_NUMBER"];

    if (!accountSid || !authToken || !fromNumber) {
      throw new Error(
        "TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_WHATSAPP_NUMBER must be set",
      );
    }

    const client = twilio(accountSid, authToken);

    try {
      const result = await client.messages.create({
        from: `whatsapp:${fromNumber}`,
        to: `whatsapp:${message.to.phoneNumber}`,
        body: message.body,
      });
      logger.info(
        { to: message.to.phoneNumber, messageSid: result.sid },
        "TwilioBspAdapter: message sent",
      );
      return { success: true, messageId: result.sid };
    } catch (err) {
      logger.error(
        { err, to: message.to.phoneNumber },
        "TwilioBspAdapter: send failed",
      );
      throw err;
    }
  }

  async processWebhook(rawPayload: unknown): Promise<WebhookEvent> {
    if (!isTwilioPayload(rawPayload)) {
      throw new Error(
        "TwilioBspAdapter: invalid webhook payload — expected Body, From, To, MessageSid",
      );
    }

    const customerPhone = rawPayload.From.replace("whatsapp:", "");

    return {
      type: "message_received",
      payload: {
        from: { id: customerPhone, phoneNumber: customerPhone },
        body: rawPayload.Body,
        timestamp: new Date(),
        messageId: rawPayload.MessageSid,
      },
    };
  }

  async registerNumber(phoneNumber: string): Promise<void> {
    logger.info(
      { phoneNumber },
      "TwilioBspAdapter: registerNumber not implemented",
    );
  }
}
