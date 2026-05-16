import pino from "pino";
import { BspAdapter } from "../adapter";
import type {
  IncomingMessage,
  OutgoingMessage,
  SendResult,
  WebhookEvent,
} from "../types";

const logger = pino({ level: "info" });

function isRawWebhookPayload(
  value: unknown,
): value is { from: string; body: string } {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v["from"] === "string" && typeof v["body"] === "string";
}

export class MockBspAdapter extends BspAdapter {
  async sendMessage(message: OutgoingMessage): Promise<SendResult> {
    const messageId = `mock-${Date.now()}`;
    logger.info(
      { to: message.to.phoneNumber, body: message.body, messageId },
      "MockBspAdapter: sending message",
    );
    return { success: true, messageId };
  }

  async processWebhook(rawPayload: unknown): Promise<WebhookEvent> {
    if (!isRawWebhookPayload(rawPayload)) {
      throw new Error(
        "MockBspAdapter: invalid webhook payload — expected { from: string; body: string }",
      );
    }
    const incoming: IncomingMessage = {
      from: { id: rawPayload.from, phoneNumber: rawPayload.from },
      body: rawPayload.body,
      timestamp: new Date(),
      messageId: `mock-incoming-${Date.now()}`,
    };
    return { type: "message_received", payload: incoming };
  }

  async registerNumber(phoneNumber: string): Promise<void> {
    logger.info({ phoneNumber }, "MockBspAdapter: registering number");
  }

  simulateIncoming(from: string, body: string): WebhookEvent {
    const incoming: IncomingMessage = {
      from: { id: from, phoneNumber: from },
      body,
      timestamp: new Date(),
      messageId: `mock-incoming-${Date.now()}`,
    };
    return { type: "message_received", payload: incoming };
  }
}
