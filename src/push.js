// Web Push: subscribe the browser/device and store the subscription in Supabase.
// The morning cron (send-push Edge Function) delivers the notifications; the service
// worker (sw.js) shows them.

import { getSupabase } from "./supabaseClient.js";

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

export function pushSupported() {
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

export async function currentPushSubscription() {
  if (!pushSupported()) return null;
  const reg = await navigator.serviceWorker.ready;
  return reg.pushManager.getSubscription();
}

// Request permission, subscribe, and save the subscription. Throws with a known
// message ("unsupported" | "no_vapid" | "denied") so the UI can explain.
export async function enablePush() {
  if (!pushSupported()) throw new Error("unsupported");
  const cfg = await import("./config.js");
  const vapid = (cfg.VAPID_PUBLIC_KEY || "").trim();
  if (!vapid) throw new Error("no_vapid");

  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("denied");

  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapid),
    });
  }

  const data = sub.toJSON();
  const supabase = await getSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase.from("push_subscriptions").upsert({
    user_id: user.id,
    endpoint: sub.endpoint,
    p256dh: data.keys.p256dh,
    auth: data.keys.auth,
  }, { onConflict: "endpoint" });
  if (error) throw error;
  return sub;
}

export async function disablePush() {
  const supabase = await getSupabase();
  const sub = await currentPushSubscription();
  if (sub) {
    await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
    await sub.unsubscribe();
  }
}
