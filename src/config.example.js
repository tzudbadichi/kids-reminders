// Copy this file to "config.js" (same folder) and fill in your Supabase values.
// The anon key is safe to expose in the browser - Row-Level Security protects the data.
// Find both values in the Supabase dashboard: Project Settings -> API.

export const SUPABASE_URL = "https://YOUR-PROJECT-ref.supabase.co";
export const SUPABASE_ANON_KEY = "YOUR-PUBLIC-ANON-KEY";

// Optional - only for the Telegram feature. The bot's public username (without @),
// as chosen in BotFather. Used to build the "connect Telegram" deep link.
export const TELEGRAM_BOT_USERNAME = "";

// Optional - only for Web Push. The VAPID public key (safe to expose in the browser).
export const VAPID_PUBLIC_KEY = "";
