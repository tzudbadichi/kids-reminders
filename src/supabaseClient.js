// Lazily create the Supabase client. The config lives in config.js (not committed).
// If config.js is missing we throw CONFIG_MISSING so the app can show setup instructions.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

let client = null;

export async function getSupabase() {
  if (client) return client;
  let config;
  try {
    config = await import("./config.js");
  } catch (e) {
    throw new Error("CONFIG_MISSING");
  }
  client = createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY);
  return client;
}
