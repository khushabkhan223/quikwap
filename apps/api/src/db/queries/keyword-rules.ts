import { supabaseAdmin } from "../client.js";
import type { KeywordRule } from "../../types/keyword-rule.js";

function toKeywordRule(row: Record<string, unknown>): KeywordRule {
  return {
    id: row["id"] as string,
    businessId: row["business_id"] as string,
    keywords: row["keywords"] as string[],
    replyMessage: row["reply_message"] as string,
    isActive: row["is_active"] as boolean,
    createdAt: row["created_at"] as string,
  };
}

export async function getActiveKeywordRules(
  businessId: string,
): Promise<KeywordRule[]> {
  const { data, error } = await supabaseAdmin
    .from("keyword_rules")
    .select("*")
    .eq("business_id", businessId)
    .eq("is_active", true)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return (data as Record<string, unknown>[]).map(toKeywordRule);
}

export async function createKeywordRule(
  businessId: string,
  keywords: string[],
  replyMessage: string,
): Promise<KeywordRule> {
  const { data, error } = await supabaseAdmin
    .from("keyword_rules")
    .insert({
      business_id: businessId,
      keywords,
      reply_message: replyMessage,
      is_active: true,
    })
    .select()
    .single();

  if (error) throw error;
  return toKeywordRule(data as Record<string, unknown>);
}

export async function updateKeywordRule(
  businessId: string,
  ruleId: string,
  updates: { keywords?: string[]; replyMessage?: string },
): Promise<KeywordRule> {
  const updateData: Record<string, unknown> = {};
  if (updates.keywords !== undefined) updateData["keywords"] = updates.keywords;
  if (updates.replyMessage !== undefined)
    updateData["reply_message"] = updates.replyMessage;

  const { data, error } = await supabaseAdmin
    .from("keyword_rules")
    .update(updateData)
    .eq("id", ruleId)
    .eq("business_id", businessId)
    .select()
    .single();

  if (error) throw error;
  return toKeywordRule(data as Record<string, unknown>);
}

export async function deleteKeywordRule(
  businessId: string,
  ruleId: string,
): Promise<void> {
  const { error } = await supabaseAdmin
    .from("keyword_rules")
    .delete()
    .eq("id", ruleId)
    .eq("business_id", businessId);

  if (error) throw error;
}

export async function toggleKeywordRule(
  businessId: string,
  ruleId: string,
): Promise<KeywordRule> {
  const { data: current, error: fetchError } = await supabaseAdmin
    .from("keyword_rules")
    .select("is_active")
    .eq("id", ruleId)
    .eq("business_id", businessId)
    .single();

  if (fetchError) throw fetchError;

  const currentIsActive = (current as Record<string, unknown>)[
    "is_active"
  ] as boolean;

  const { data, error } = await supabaseAdmin
    .from("keyword_rules")
    .update({ is_active: !currentIsActive })
    .eq("id", ruleId)
    .eq("business_id", businessId)
    .select()
    .single();

  if (error) throw error;
  return toKeywordRule(data as Record<string, unknown>);
}
