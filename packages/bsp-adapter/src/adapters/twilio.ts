import { BspAdapter } from "../adapter";
import type { OutgoingMessage, SendResult, WebhookEvent } from "../types";

export class TwilioBspAdapter extends BspAdapter {
  async sendMessage(_message: OutgoingMessage): Promise<SendResult> {
    throw new Error("TwilioBspAdapter: not implemented yet");
  }

  async processWebhook(_rawPayload: unknown): Promise<WebhookEvent> {
    throw new Error("TwilioBspAdapter: not implemented yet");
  }

  async registerNumber(_phoneNumber: string): Promise<void> {
    throw new Error("TwilioBspAdapter: not implemented yet");
  }
}
