import { supabaseAdmin } from "../client.js";

export interface LeadTracking {
  id: string;
  businessId: string;
  contactId: string;
  status: string;
  summary: string | null;
  notes: string | null;
  createdAt: string;
  closedAt: string | null;
  lostAt: string | null;
}

export interface LeadWithContact extends LeadTracking {
  phoneNumber: string;
  name: string | null;
  tags: string[];
  botPaused: boolean;
  lastMessageAt: string | null;
}

function toLeadTracking(row: Record<string, unknown>): LeadTracking {
  return {
    id: row["id"] as string,
    businessId: row["business_id"] as string,
    contactId: row["contact_id"] as string,
    status: row["status"] as string,
    summary: row["summary"] as string | null,
    notes: row["notes"] as string | null,
    createdAt: row["created_at"] as string,
    closedAt: row["closed_at"] as string | null,
    lostAt: row["lost_at"] as string | null,
  };
}

export async function findOrCreateLead(
  businessId: string,
  contactId: string,
): Promise<LeadTracking> {
  const { data: existing, error: selectError } = await supabaseAdmin
    .from("lead_tracking")
    .select("*")
    .eq("business_id", businessId)
    .eq("contact_id", contactId)
    .single();

  if (selectError && selectError.code !== "PGRST116") throw selectError;
  if (existing) return toLeadTracking(existing as Record<string, unknown>);

  const { data: created, error: insertError } = await supabaseAdmin
    .from("lead_tracking")
    .insert({ business_id: businessId, contact_id: contactId, status: "new" })
    .select()
    .single();

  if (insertError) throw insertError;
  return toLeadTracking(created as Record<string, unknown>);
}

export async function getLeadsWithContacts(
  businessId: string,
): Promise<LeadWithContact[]> {
  const { data, error } = await supabaseAdmin
    .from("lead_tracking")
    .select(
      "*, contacts(phone_number, name, tags, bot_paused, last_message_at)",
    )
    .eq("business_id", businessId)
    .order("created_at", { ascending: false });

  if (error) throw error;

  return (data as Record<string, unknown>[]).map((row) => {
    const contact = row["contacts"] as Record<string, unknown>;
    return {
      ...toLeadTracking(row),
      phoneNumber: contact["phone_number"] as string,
      name: contact["name"] as string | null,
      tags: contact["tags"] as string[],
      botPaused: contact["bot_paused"] as boolean,
      lastMessageAt: contact["last_message_at"] as string | null,
    };
  });
}

export async function updateLeadStatus(
  businessId: string,
  contactId: string,
  status: string,
  summary?: string,
): Promise<LeadTracking> {
  const { data, error } = await supabaseAdmin
    .from("lead_tracking")
    .update({ status, summary: summary ?? null })
    .eq("business_id", businessId)
    .eq("contact_id", contactId)
    .select()
    .single();

  if (error) throw error;
  return toLeadTracking(data as Record<string, unknown>);
}
