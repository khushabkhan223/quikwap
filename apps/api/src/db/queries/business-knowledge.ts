import { supabaseAdmin } from "../client.js";
import type {
  BusinessKnowledge,
  OnboardingMessage,
} from "../../types/business-knowledge.js";

function toBusinessKnowledge(row: Record<string, unknown>): BusinessKnowledge {
  return {
    id: row["id"] as string,
    businessId: row["business_id"] as string,
    rawOnboardingText: row["raw_onboarding_text"] as string | null,
    structuredData: row["structured_data"] as Record<string, unknown>,
    isConfirmed: row["is_confirmed"] as boolean,
    lastUpdatedAt: row["last_updated_at"] as string,
    createdAt: row["created_at"] as string,
  };
}

function toOnboardingMessage(row: Record<string, unknown>): OnboardingMessage {
  return {
    id: row["id"] as string,
    businessId: row["business_id"] as string,
    role: row["role"] as "user" | "assistant",
    content: row["content"] as string,
    createdAt: row["created_at"] as string,
  };
}

export async function getBusinessKnowledge(
  businessId: string,
): Promise<BusinessKnowledge | null> {
  const { data, error } = await supabaseAdmin
    .from("business_knowledge")
    .select("*")
    .eq("business_id", businessId)
    .single();

  if (error) {
    // PGRST116 = no rows found — not an error in this context
    if (error.code === "PGRST116") return null;
    throw error;
  }

  return toBusinessKnowledge(data as Record<string, unknown>);
}

export async function saveBusinessKnowledge(
  businessId: string,
  rawText: string,
  structuredData: Record<string, unknown>,
): Promise<BusinessKnowledge> {
  const existing = await getBusinessKnowledge(businessId);
  const appendedText = existing?.rawOnboardingText
    ? `${existing.rawOnboardingText}\n---\n${rawText}`
    : rawText;

  const { data, error } = await supabaseAdmin
    .from("business_knowledge")
    .upsert(
      {
        business_id: businessId,
        raw_onboarding_text: appendedText,
        structured_data: structuredData,
        is_confirmed: false,
      },
      { onConflict: "business_id" },
    )
    .select()
    .single();

  if (error) throw error;
  return toBusinessKnowledge(data as Record<string, unknown>);
}

export async function confirmBusinessKnowledge(
  businessId: string,
): Promise<BusinessKnowledge> {
  const { data, error } = await supabaseAdmin
    .from("business_knowledge")
    .update({ is_confirmed: true })
    .eq("business_id", businessId)
    .select()
    .single();

  if (error) throw error;
  return toBusinessKnowledge(data as Record<string, unknown>);
}

export async function saveOnboardingMessage(
  businessId: string,
  role: "user" | "assistant",
  content: string,
): Promise<void> {
  const { error } = await supabaseAdmin
    .from("onboarding_messages")
    .insert({ business_id: businessId, role, content });

  if (error) throw error;
}

export async function getOnboardingMessages(
  businessId: string,
): Promise<OnboardingMessage[]> {
  const { data, error } = await supabaseAdmin
    .from("onboarding_messages")
    .select("*")
    .eq("business_id", businessId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return (data as Record<string, unknown>[]).map(toOnboardingMessage);
}
