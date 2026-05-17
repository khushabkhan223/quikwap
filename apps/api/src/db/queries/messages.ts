import { supabaseAdmin } from "../client.js";

export interface Message {
  id: string;
  businessId: string;
  contactId: string;
  direction: "incoming" | "outgoing";
  body: string;
  externalMessageId: string | null;
  createdAt: string;
}

function toMessage(row: Record<string, unknown>): Message {
  return {
    id: row["id"] as string,
    businessId: row["business_id"] as string,
    contactId: row["contact_id"] as string,
    direction: row["direction"] as "incoming" | "outgoing",
    body: row["body"] as string,
    externalMessageId: row["external_message_id"] as string | null,
    createdAt: row["created_at"] as string,
  };
}

export async function saveMessage(
  businessId: string,
  contactId: string,
  direction: "incoming" | "outgoing",
  body: string,
  externalMessageId?: string,
): Promise<void> {
  const { error } = await supabaseAdmin.from("messages").insert({
    business_id: businessId,
    contact_id: contactId,
    direction,
    body,
    external_message_id: externalMessageId ?? null,
  });

  if (error) throw error;
}

export async function getRecentMessages(
  businessId: string,
  contactId: string,
  limit: number,
): Promise<Message[]> {
  const { data, error } = await supabaseAdmin
    .from("messages")
    .select("*")
    .eq("business_id", businessId)
    .eq("contact_id", contactId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;

  // Reverse to return chronological order
  return (data as Record<string, unknown>[]).map(toMessage).reverse();
}
