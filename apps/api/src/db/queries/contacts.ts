import { supabaseAdmin } from "../client.js";

export interface Contact {
  id: string;
  businessId: string;
  phoneNumber: string;
  name: string | null;
  isLead: boolean;
  tags: string[];
  createdAt: string;
  lastMessageAt: string | null;
}

function toContact(row: Record<string, unknown>): Contact {
  return {
    id: row["id"] as string,
    businessId: row["business_id"] as string,
    phoneNumber: row["phone_number"] as string,
    name: row["name"] as string | null,
    isLead: row["is_lead"] as boolean,
    tags: row["tags"] as string[],
    createdAt: row["created_at"] as string,
    lastMessageAt: row["last_message_at"] as string | null,
  };
}

export async function findOrCreateContact(
  businessId: string,
  phoneNumber: string,
): Promise<Contact> {
  const { data: existing, error: selectError } = await supabaseAdmin
    .from("contacts")
    .select("*")
    .eq("business_id", businessId)
    .eq("phone_number", phoneNumber)
    .single();

  if (selectError && selectError.code !== "PGRST116") throw selectError;
  if (existing) return toContact(existing as Record<string, unknown>);

  const { data: created, error: insertError } = await supabaseAdmin
    .from("contacts")
    .insert({
      business_id: businessId,
      phone_number: phoneNumber,
      is_lead: true,
    })
    .select()
    .single();

  if (insertError) throw insertError;
  return toContact(created as Record<string, unknown>);
}

export async function updateContactLastMessage(
  contactId: string,
): Promise<void> {
  const { error } = await supabaseAdmin
    .from("contacts")
    .update({ last_message_at: new Date().toISOString() })
    .eq("id", contactId);

  if (error) throw error;
}
