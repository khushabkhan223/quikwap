import { GoogleGenerativeAI } from "@google/generative-ai";

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
The user is a ${industry} business owner who has typed their business information
in free-form text (possibly broken English, Hindi, or Hinglish).
Extract the key information and return it as a clean JSON object.
For real_estate industry, extract: properties (array of {location, type, price, description}),
site_visit_availability, negotiable (boolean), additional_info.
For coaching industry, extract: courses (array of {name, duration, fee, batch_timing}),
admission_process, demo_available (boolean), additional_info.
For clinic industry, extract: services (array of {name, fee}), doctor_name,
availability, appointment_process, additional_info.
For other industries, extract whatever key business information is present.
Return ONLY valid JSON, no markdown, no explanation.`;

  const model = genAI.getGenerativeModel({
    model: MODEL_ID,
    systemInstruction: systemPrompt,
  });

  const result = await model.generateContent(rawText);
  const text = result.response.text();

  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return { raw: rawText };
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
