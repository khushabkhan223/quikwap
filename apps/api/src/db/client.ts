import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.resolve(__dirname, "../../.env.local");

if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf-8");
  envContent.split("\n").forEach((line) => {
    const [key, value] = line.split("=");
    if (key && value) {
      process.env[key.trim()] = value.trim();
    }
  });
}

const url = process.env["SUPABASE_URL"];
const key = process.env["SUPABASE_ANON_KEY"];

if (!url || !key) {
  throw new Error("SUPABASE_URL and SUPABASE_ANON_KEY must be set");
}

export const supabaseClient = createClient(url, key);
