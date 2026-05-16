import type { OutgoingMessage, SendResult, WebhookEvent } from "./types";

export abstract class BspAdapter {
  abstract sendMessage(message: OutgoingMessage): Promise<SendResult>;
  abstract processWebhook(rawPayload: unknown): Promise<WebhookEvent>;
  abstract registerNumber(phoneNumber: string): Promise<void>;
}
