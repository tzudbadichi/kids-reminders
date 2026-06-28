// Settings: display name, daily notification time (Israel time), and Telegram linking.

import { getSupabase } from "./supabaseClient.js";
import { el, clear, toast } from "./ui.js";

// Read the optional Telegram bot username from config.js (public value).
async function botUsername() {
  try {
    const cfg = await import("./config.js");
    return (cfg.TELEGRAM_BOT_USERNAME || "").trim();
  } catch (_) {
    return "";
  }
}

export async function renderSettings(container) {
  clear(container);
  container.append(el("div", { class: "loading" }, "טוען..."));

  const supabase = await getSupabase();
  const { data: { user } } = await supabase.auth.getUser();

  let { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) {
    await supabase.from("profiles").upsert({ id: user.id });
    profile = { display_name: "", notification_time: "06:30", telegram_chat_id: null };
  }

  clear(container);
  const name = el("input", { class: "field", value: profile.display_name || "" });
  const time = el("input", {
    type: "time", class: "field",
    value: (profile.notification_time || "06:30").slice(0, 5),
  });

  async function save() {
    const { error } = await supabase.from("profiles").upsert({
      id: user.id,
      display_name: name.value.trim(),
      notification_time: time.value,
    });
    if (error) { toast("שגיאה: " + error.message, "error"); return; }
    toast("נשמר");
  }

  container.append(
    el("h2", {}, "הגדרות"),
    el("label", { class: "lbl" }, "שם תצוגה"), name,
    el("label", { class: "lbl" }, "שעת התראה יומית"), time,
    el("button", { class: "btn primary", onClick: save }, "שמירה"),
    await renderTelegram(container, supabase, user, profile),
    el("p", { class: "muted" }, "כל השעות לפי שעון ישראל."),
  );
}

// Telegram section. Three states based on the profile:
//   connected (telegram_chat_id set) -> status + send test + disconnect
//   pending   (telegram_link_code set) -> show deep link + code to finish in Telegram
//   idle      -> "connect" button that generates a code
async function renderTelegram(container, supabase, user, profile) {
  const wrap = el("div", { class: "note-box" });
  wrap.append(el("div", { class: "section-title" }, "טלגרם"));
  const bot = await botUsername();

  if (profile.telegram_chat_id) {
    const testBtn = el("button", { class: "btn primary", onClick: sendTest }, "שלח התראת בדיקה");
    wrap.append(
      el("p", { class: "ok-text" }, "מחובר. תקבל/י תזכורות יומיות בטלגרם."),
      el("div", { class: "row gap", style: "margin-top:10px; flex-wrap:wrap" },
        testBtn,
        el("button", { class: "btn", onClick: disconnect }, "ניתוק"),
      ),
    );

    async function sendTest() {
      testBtn.disabled = true;
      const original = testBtn.textContent;
      testBtn.textContent = "שולח...";
      try {
        const { data, error } = await supabase.functions.invoke("send-telegram", { body: {} });
        if (error) { toast("שגיאה בשליחה. ודא/י שהפונקציה נפרסה.", "error"); return; }
        if (!data?.ok) {
          if (data?.reason === "not_connected") toast("טלגרם לא מחובר", "error");
          else toast("השליחה נכשלה", "error");
          return;
        }
        toast(data.sent ? "נשלחה התראת בדיקה לטלגרם" : "נשלח (אין פריטים להיום)");
      } catch (e) {
        toast("שגיאה: " + (e.message || e), "error");
      } finally {
        testBtn.disabled = false;
        testBtn.textContent = original;
      }
    }

    async function disconnect() {
      if (!confirm("לנתק את טלגרם?")) return;
      const { error } = await supabase.from("profiles")
        .update({ telegram_chat_id: null, telegram_link_code: null }).eq("id", user.id);
      if (error) { toast("שגיאה: " + error.message, "error"); return; }
      renderSettings(container);
    }
  } else if (profile.telegram_link_code) {
    const code = profile.telegram_link_code;
    const link = bot ? `https://t.me/${bot}?start=${code}` : "";
    wrap.append(
      el("p", {}, "כדי לסיים את החיבור, פתח/י בטלגרם (במכשיר שבו טלגרם עובד) את הקישור ולחץ/י Start:"),
      link
        ? el("a", { class: "tg-link", href: link, target: "_blank", rel: "noopener" }, link)
        : el("p", { class: "error-text" }, "שם הבוט לא הוגדר ב-config.js"),
      bot ? el("p", { class: "muted" }, `או שלח/י לבוט @${bot} את ההודעה:  /start ${code}`) : null,
      el("div", { class: "row gap", style: "margin-top:10px; flex-wrap:wrap" },
        el("button", { class: "btn primary", onClick: () => renderSettings(container) }, "בדוק חיבור"),
        el("button", { class: "btn", onClick: cancel }, "ביטול"),
      ),
    );

    async function cancel() {
      await supabase.from("profiles").update({ telegram_link_code: null }).eq("id", user.id);
      renderSettings(container);
    }
  } else {
    wrap.append(
      el("p", {}, "חבר/י את טלגרם כדי לקבל את תזכורות הבוקר."),
      el("div", { class: "row gap", style: "margin-top:10px" },
        el("button", { class: "btn primary", onClick: connect }, "חבר טלגרם"),
      ),
    );

    async function connect() {
      if (!bot) { toast("שם הבוט לא הוגדר ב-config.js", "error"); return; }
      const code = (crypto.randomUUID?.() || String(Date.now())).replace(/-/g, "").slice(0, 8);
      const { error } = await supabase.from("profiles")
        .update({ telegram_link_code: code }).eq("id", user.id);
      if (error) { toast("שגיאה: " + error.message, "error"); return; }
      window.open(`https://t.me/${bot}?start=${code}`, "_blank");
      renderSettings(container); // show the link + code fallback (in case t.me is blocked)
    }
  }

  return wrap;
}
