export interface BusinessKnowledge {
  id: string;
  businessId: string;
  rawOnboardingText: string | null;
  structuredData: Record<string, unknown>;
  isConfirmed: boolean;
  lastUpdatedAt: string;
  createdAt: string;
}

export interface OnboardingMessage {
  id: string;
  businessId: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}
