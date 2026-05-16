export type Contact = {
  id: string;
  phoneNumber: string;
  name?: string;
};

export type IncomingMessage = {
  from: Contact;
  body: string;
  timestamp: Date;
  messageId: string;
};

export type OutgoingMessage = {
  to: Contact;
  body: string;
};

export type SendResult = {
  success: boolean;
  messageId?: string;
  error?: string;
};

export type WebhookEvent = {
  type: "message_received";
  payload: IncomingMessage;
};
