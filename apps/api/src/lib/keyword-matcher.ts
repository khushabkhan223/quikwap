import type { KeywordRule } from "../types/keyword-rule.js";

export function findMatchingRule(
  message: string,
  rules: KeywordRule[],
): KeywordRule | null {
  const lower = message.toLowerCase();
  for (const rule of rules) {
    if (rule.keywords.some((kw) => lower.includes(kw.toLowerCase()))) {
      return rule;
    }
  }
  return null;
}
