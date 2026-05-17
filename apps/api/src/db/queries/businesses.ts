import { supabaseAdmin } from "../client.js";

export interface Business {
  id: string;
  ownerId: string;
  email: string;
  phoneNumber: string;
  businessName: string;
  industry: string;
  subscriptionStatus: string;
  subscriptionPlan: string;
  createdAt: string;
}

function toBusiness(row: Record<string, unknown>): Business {
  return {
    id: row["id"] as string,
    ownerId: row["owner_id"] as string,
    email: row["email"] as string,
    phoneNumber: row["phone_number"] as string,
    businessName: row["business_name"] as string,
    industry: row["industry"] as string,
    subscriptionStatus: row["subscription_status"] as string,
    subscriptionPlan: row["subscription_plan"] as string,
    createdAt: row["created_at"] as string,
  };
}

export async function findBusinessByPhoneNumber(
  phoneNumber: string,
): Promise<Business | null> {
  const { data, error } = await supabaseAdmin
    .from("businesses")
    .select("*")
    .eq("phone_number", phoneNumber)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw error;
  }

  return toBusiness(data as Record<string, unknown>);
}
