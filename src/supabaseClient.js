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
  client = createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY, {
    auth: {
      // Remember the device: keep the session in localStorage and refresh tokens
      // automatically, so the user stays logged in after closing the app. Each
      // device keeps its own session, so the same user can sign in on several devices.
      persistSession: true,
      autoRefreshToken: true,
      storage: window.localStorage,
      storageKey: "kids-reminders-auth",
      detectSessionInUrl: false,
    },
  });
  return client;
}
