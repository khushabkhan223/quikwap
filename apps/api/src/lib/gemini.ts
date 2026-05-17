import { GoogleGenerativeAI } from "@google/generative-ai";
import { logger } from "./logger.js";

const apiKey = process.env["GEMINI_API_KEY"];
if (!apiKey) {
  throw new Error("GEMINI_API_KEY must be set");
}

const genAI = new GoogleGenerativeAI(apiKey);
const MODEL_ID = "gemini-2.5-flash-lite";

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

  const result = await model.generateContent(rawText);
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

  const result = await model.generateContent(newMessage);
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
  const systemPrompt = `You are an intent detection assistant for a real estate WhatsApp bot.

Analyze the conversation and the latest customer message.

Detect the intent and return ONLY a JSON object with two fields:
- intent: one of these exact values:
  'site_visit_requested' — customer has proposed or agreed to a specific time for a site visit
  'not_interested' — customer has said they are not interested or want to stop
  'general_enquiry' — customer is asking questions but hasn't committed to anything
  'other' — anything else
- summary: a single sentence summary of what the customer wants.
  Example: 'Rahul is interested in the 2BHK in Whitefield and wants a site visit on Saturday afternoon.'
  Keep it under 20 words. Write it in English regardless of what language the customer used.

CRITICAL: Return ONLY raw JSON. No markdown. No backticks. First character must be { and last must be }.`;

  const model = genAI.getGenerativeModel({
    model: MODEL_ID,
    systemInstruction: systemPrompt,
  });

  const history = conversationHistory.map((msg) => ({
    role: msg.role === "assistant" ? ("model" as const) : ("user" as const),
    parts: [{ text: msg.content }],
  }));

  const contextMessage = `Business knowledge: ${JSON.stringify(businessKnowledge)}\n\nLatest customer message: ${customerMessage}`;

  const chat = model.startChat({ history });
  const result = await chat.sendMessage(contextMessage);
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
  const systemPrompt = `You are a helpful WhatsApp assistant for ${businessName}, a ${industry} business in India.

You have access to the following business information:
${JSON.stringify(businessKnowledge)}

Your job is to answer customer questions accurately based on this information.

STRICT RULES:
1. Never promise to 'check' or 'look up' anything — you have all the information you need in the business data above.
2. Never say 'I'll get back to you' or 'I'll check and confirm' — you cannot do that.
3. For site visit requests: say 'Please share your preferred date and time. Our agent will confirm your slot within 2 hours.'
4. For anything not in the business data: say 'Our agent will get in touch with you shortly for more details.'
5. Keep replies short — 2 to 3 sentences maximum.
6. Reply in the same language the customer uses. If they write Hindi, reply in Hindi. If Hinglish, reply in Hinglish.
7. Never make up prices, locations, or facts not in the business information.
8. Never respond to requests unrelated to the business (coding questions, general knowledge, etc.) — just say 'Please contact us for business enquiries.'

You are a professional assistant. Be warm, helpful, and concise.`;

  const model = genAI.getGenerativeModel({
    model: MODEL_ID,
    systemInstruction: systemPrompt,
  });

  const history = conversationHistory.map((msg) => ({
    role: msg.role === "assistant" ? ("model" as const) : ("user" as const),
    parts: [{ text: msg.content }],
  }));

  const chat = model.startChat({ history });
  const result = await chat.sendMessage(customerMessage);
  return result.response.text();
}
