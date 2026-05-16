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

export async function generateCustomerReply(
  customerMessage: string,
  businessKnowledge: Record<string, unknown>,
  businessName: string,
  industry: string,
  conversationHistory: Array<{ role: "user" | "assistant"; content: string }>,
): Promise<string> {
  const systemPrompt = `You are a helpful WhatsApp assistant for ${businessName},
a ${industry} business in India.
You have access to the following business information: ${JSON.stringify(businessKnowledge)}.
Answer customer questions accurately based on this information.
Be conversational and friendly. Keep replies short (2-4 sentences max).
Reply in the same language the customer uses — if they write in Hindi, reply in Hindi.
If they write in Hinglish, reply in Hinglish.
If you don't know the answer based on the business information provided,
say you will check and get back to them shortly.
Never make up prices, locations, or facts not in the business information.`;

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
