import { GoogleGenerativeAI } from "@google/generative-ai";
import { logger } from "./logger.js";

const apiKey = process.env["GEMINI_API_KEY"];
if (!apiKey) {
  throw new Error("GEMINI_API_KEY must be set");
}

const genAI = new GoogleGenerativeAI(apiKey);
const MODEL_ID = "gemini-2.5-flash";

async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  delayMs: number = 2000,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const isRetryable =
        (error instanceof Error && error.message.includes("503")) ||
        (typeof error === "object" &&
          error !== null &&
          "status" in error &&
          (error as Record<string, unknown>).status === 503);

      if (isRetryable && attempt < maxRetries) {
        const waitMs = delayMs * attempt;
        logger.warn({ attempt, maxRetries, waitMs }, "Gemini 503, retrying...");
        await new Promise((resolve) => setTimeout(resolve, waitMs));
        continue;
      }
      throw error;
    }
  }
  throw lastError;
}

export async function parseBusinessInfo(
  rawText: string,
  industry: string,
): Promise<Record<string, unknown>> {
  const systemPrompt = `You are a data extraction assistant for an Indian SMB automation tool.
The user is a ${industry} business owner who has typed their business information in free-form text (possibly broken English, Hindi, or Hinglish).
Extract the key information and return it as a clean JSON object.

CRITICAL: Return ONLY the raw JSON object. No markdown. No code blocks. No backticks. No explanation. No preamble. The very first character of your response must be { and the very last character must be }.

For real_estate industry, extract:
{
  "properties": [{ "location": string, "type": string, "price": number, "description": string }],
  "site_visit_availability": string,
  "negotiable": boolean,
  "additional_info": string
}

For coaching industry, extract:
{
  "courses": [{ "name": string, "duration": string, "fee": number, "batch_timing": string }],
  "admission_process": string,
  "demo_available": boolean,
  "additional_info": string
}

For clinic industry, extract:
{
  "services": [{ "name": string, "fee": number }],
  "doctor_name": string,
  "availability": string,
  "appointment_process": string,
  "additional_info": string
}

For other industries, extract whatever key business information is present as a JSON object.`;

  const model = genAI.getGenerativeModel({
    model: MODEL_ID,
    systemInstruction: systemPrompt,
  });

  const result = await withRetry(() => model.generateContent(rawText));
  const text = result.response.text();

  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    logger.error(
      { geminiResponse: text, industry },
      "parseBusinessInfo: JSON parse failed",
    );
    return { raw: rawText };
  }
}

export async function updateBusinessInfo(
  existingData: Record<string, unknown>,
  newMessage: string,
  industry: string,
): Promise<Record<string, unknown>> {
  const systemPrompt = `You are a data management assistant for an Indian SMB automation tool.
A ${industry} business owner is updating their business information.

Here is their CURRENT business data:
${JSON.stringify(existingData)}

The owner has sent this new message (in English, Hindi, or Hinglish):
${newMessage}

Based on this message, update the business data by:
- Adding new items if they mention new properties/services/courses
- Removing items if they say remove/delete/hatao any specific item
- Updating items if they correct existing information
- Keeping all existing items that are not mentioned in the new message

CRITICAL: Return ONLY the complete updated JSON object.
No markdown. No code blocks. No backticks. No explanation.
The first character must be { and the last must be }.
Return the COMPLETE updated data, not just the changes.`;

  const model = genAI.getGenerativeModel({
    model: MODEL_ID,
    systemInstruction: systemPrompt,
  });

  const result = await withRetry(() => model.generateContent(newMessage));
  const text = result.response.text();

  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    logger.error(
      { geminiResponse: text, industry },
      "updateBusinessInfo: JSON parse failed",
    );
    return existingData;
  }
}

export async function detectIntentAndSummary(
  customerMessage: string,
  conversationHistory: Array<{ role: "user" | "assistant"; content: string }>,
  businessKnowledge: Record<string, unknown>,
): Promise<{
  intent:
    | "site_visit_requested"
    | "general_enquiry"
    | "not_interested"
    | "other";
  summary: string;
}> {
  const systemPrompt = `You are a conversation analyst for a real estate agency WhatsApp bot.

Analyze the full conversation and return a JSON object with two fields:

intent: one of these exact values:
  'site_visit_requested' — customer has proposed or agreed to a time for a site visit
  'not_interested' — customer has clearly said they are not interested
  'general_enquiry' — customer is asking questions, browsing, or showing interest but no commitment yet
  'other' — anything that does not fit above

summary: A comprehensive one to two sentence summary that gives the agent everything they need to continue the deal. Include:
  - Which property the customer is interested in (location, type, price if discussed)
  - Whether they asked about negotiation and what was said
  - Whether they requested a site visit and what time they proposed
  - Overall tone — are they serious, just browsing, etc.

  Example: 'Customer is interested in the Marathahalli 3BHK (₹80L), asked about negotiation, and has requested a site visit on Saturday afternoon. Seems serious.'
  Example: 'Customer enquired about Whitefield 2BHK pricing. No site visit request yet. Early stage.'

  Write in English regardless of what language the customer used.
  Keep it under 40 words.

CRITICAL: Return ONLY raw JSON. No markdown. No backticks.
First character must be { and last must be }.`;

  const model = genAI.getGenerativeModel({
    model: MODEL_ID,
    systemInstruction: systemPrompt,
  });

  const firstUserIndex = conversationHistory.findIndex(
    (m) => m.role === "user",
  );
  const sanitizedHistory =
    firstUserIndex === -1 ? [] : conversationHistory.slice(firstUserIndex);

  const history = sanitizedHistory.map((msg) => ({
    role: msg.role === "assistant" ? ("model" as const) : ("user" as const),
    parts: [{ text: msg.content }],
  }));

  const contextMessage = `Business knowledge: ${JSON.stringify(businessKnowledge)}\n\nLatest customer message: ${customerMessage}`;

  const chat = model.startChat({ history });
  const result = await withRetry(() => chat.sendMessage(contextMessage));
  const text = result.response.text();

  const parsed = JSON.parse(text) as Record<string, unknown>;

  const validIntents = [
    "site_visit_requested",
    "general_enquiry",
    "not_interested",
    "other",
  ] as const;
  type Intent = (typeof validIntents)[number];

  const intent = validIntents.includes(parsed["intent"] as Intent)
    ? (parsed["intent"] as Intent)
    : "other";

  return {
    intent,
    summary: typeof parsed["summary"] === "string" ? parsed["summary"] : "",
  };
}

export async function generateCustomerReply(
  customerMessage: string,
  businessKnowledge: Record<string, unknown>,
  businessName: string,
  industry: string,
  conversationHistory: Array<{ role: "user" | "assistant"; content: string }>,
): Promise<string> {
  const systemPrompt = `You are a sales assistant for ${businessName}, a ${industry} business in India.
You are part of the team — professional, warm, and genuinely helpful.
You are NOT a generic chatbot. You represent this agency.

Business information you have access to:
${JSON.stringify(businessKnowledge)}

HOW TO RESPOND:

For property/service questions:
- Answer directly and naturally from the business data
- Sound like a knowledgeable team member, not a form response
- Vary your phrasing — don't give the same sentence structure every time

For negotiation questions (when customer asks for discount or lower price):
- If negotiable is true in the data: confirm there is room for discussion
  but NEVER entertain a specific counter-offer price the customer suggests
  Vary your response naturally. Examples of the kind of response (not exact templates):
  "There's some room for negotiation — our agent would be the right person to discuss that with you directly."
  "Pricing can be discussed. I'd suggest connecting with our agent to take that forward."
  "Yes, there's flexibility on the price. Our agent handles those conversations — want me to set that up?"
  Do NOT say things like "We can discuss your offer of ₹X" — never repeat or validate their specific number
- If negotiable is false: politely say the price is fixed

For site visit requests:
- Site visits are available based on what's in the business data
- Ask for their preferred date and time
- Tell them the agent will confirm shortly
- If they give a specific time: acknowledge it warmly and confirm the agent will reach out
  Example: "Saturday afternoon works — I'll let our agent know and they'll confirm the slot with you shortly."

For features not in the data (balcony, parking, etc.):
- Say you don't have that detail handy
- Offer to connect them with the agent or suggest a site visit to see for themselves

TONE:
- Warm and professional — like a real team member, not a script
- Conversational but not casual
- Never overly excited or use filler phrases like 'Great!' or 'Absolutely!'
- Short replies — 2 to 3 sentences maximum
- Reply in the same language the customer uses — Hindi reply for Hindi,
  Hinglish for Hinglish, English for English

HARD LIMITS:
- Never make up facts, prices, locations not in the business data
- Never validate or repeat a customer's specific counter-offer price
- Never respond to requests unrelated to the business`;

  const model = genAI.getGenerativeModel({
    model: MODEL_ID,
    systemInstruction: systemPrompt,
  });

  const firstUserIndex = conversationHistory.findIndex(
    (m) => m.role === "user",
  );
  const sanitizedHistory =
    firstUserIndex === -1 ? [] : conversationHistory.slice(firstUserIndex);

  const history = sanitizedHistory.map((msg) => ({
    role: msg.role === "assistant" ? ("model" as const) : ("user" as const),
    parts: [{ text: msg.content }],
  }));

  const chat = model.startChat({ history });
  const result = await withRetry(() => chat.sendMessage(customerMessage));
  return result.response.text();
}
