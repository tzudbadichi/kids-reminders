// Authentication: email + password, with password recovery by email.
// Relies on "Confirm email" being OFF in Supabase Auth (sign-up returns a session
// immediately). Password reset uses Supabase's built-in recovery email.

import { getSupabase } from "./supabaseClient.js";
import { el, clear, icon } from "./ui.js";
import { renderHelp } from "./help.js";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD = 6;

export async function getSession() {
  const supabase = await getSupabase();
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export async function signOut() {
  const supabase = await getSupabase();
  await supabase.auth.signOut();
}

// Render the login / sign-up screen. Calls onAuthed() once a session exists.
export function renderAuth(container, onAuthed) {
  clear(container);
  let mode = "signin"; // "signin" | "signup"

  const email = el("input", {
    type: "email", class: "field", placeholder: "אימייל", autocomplete: "email",
    autocapitalize: "none", autocorrect: "off", spellcheck: "false",
  });
  const pass = el("input", {
    type: "password", class: "field", placeholder: "סיסמה", autocomplete: "current-password",
  });

  const toggle = el("button", { type: "button", class: "field-toggle", "aria-label": "הצג סיסמה" }, icon("eye"));
  toggle.addEventListener("click", () => {
    const show = pass.type === "password";
    pass.type = show ? "text" : "password";
    clear(toggle);
    toggle.append(icon(show ? "eye-off" : "eye"));
    toggle.setAttribute("aria-label", show ? "הסתר סיסמה" : "הצג סיסמה");
  });
  const passWrap = el("div", { class: "field-wrap" }, pass, toggle);

  const msg = el("div", { class: "auth-msg" });
  const submitBtn = el("button", { class: "btn primary block" }, "התחברות");
  const switchBtn = el("button", { class: "link-btn-inline" }, "אין לך חשבון? הרשמה");
  const forgotBtn = el("button", { class: "link-btn-inline" }, "שכחת סיסמה?");
  const hint = el("p", { class: "auth-hint" }, "סיסמה: לפחות 6 תווים");

  function showMsg(text, isError) {
    msg.textContent = text;
    msg.className = "auth-msg" + (isError ? " error-text" : "");
  }

  function setMode(next) {
    mode = next;
    const signup = mode === "signup";
    submitBtn.textContent = signup ? "הרשמה" : "התחברות";
    switchBtn.textContent = signup ? "כבר יש לך חשבון? התחברות" : "אין לך חשבון? הרשמה";
    pass.setAttribute("autocomplete", signup ? "new-password" : "current-password");
    hint.style.display = signup ? "block" : "none";
    forgotBtn.style.display = signup ? "none" : "block";
    showMsg("");
  }

  async function submit() {
    const e = email.value.trim().toLowerCase();
    const password = pass.value;
    showMsg("");
    if (!e || !password) { showMsg("נא למלא אימייל וסיסמה", true); return; }
    if (!EMAIL_RE.test(e)) { showMsg("כתובת אימייל לא תקינה", true); return; }
    if (mode === "signup" && password.length < MIN_PASSWORD) {
      showMsg(`הסיסמה צריכה להיות לפחות ${MIN_PASSWORD} תווים`, true); return;
    }

    submitBtn.disabled = true;
    const original = submitBtn.textContent;
    submitBtn.textContent = mode === "signup" ? "נרשם..." : "מתחבר...";
    try {
      const supabase = await getSupabase();
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({ email: e, password });
        if (error) {
          showMsg(/already|registered|exists/i.test(error.message)
            ? "כתובת האימייל כבר רשומה. אפשר להתחבר." : "שגיאה: " + error.message, true);
          return;
        }
        if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
          showMsg("כתובת האימייל כבר רשומה. אפשר להתחבר.", true); return;
        }
        if (!data.session) {
          showMsg('ההרשמה לא הושלמה. ודא/י ש-"Confirm email" כבוי בהגדרות Supabase.', true); return;
        }
        onAuthed();
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: e, password });
        if (error) { showMsg("אימייל או סיסמה שגויים", true); return; }
        onAuthed();
      }
    } catch (err) {
      showMsg("שגיאה: " + (err.message || err), true);
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = original;
    }
  }

  async function forgot() {
    const e = email.value.trim().toLowerCase();
    if (!EMAIL_RE.test(e)) { showMsg("הקלד/י קודם את האימייל למעלה, ואז 'שכחת סיסמה?'", true); return; }
    forgotBtn.disabled = true;
    try {
      const supabase = await getSupabase();
      const { error } = await supabase.auth.resetPasswordForEmail(e, {
        redirectTo: location.origin + location.pathname,
      });
      if (error) { showMsg("שגיאה: " + error.message, true); return; }
      showMsg("נשלח אליך קישור לאיפוס סיסמה. בדוק/י את תיבת המייל (גם ספאם).", false);
    } catch (err) {
      showMsg("שגיאה: " + (err.message || err), true);
    } finally {
      forgotBtn.disabled = false;
    }
  }

  submitBtn.addEventListener("click", submit);
  switchBtn.addEventListener("click", () => setMode(mode === "signin" ? "signup" : "signin"));
  forgotBtn.addEventListener("click", forgot);
  pass.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); submit(); } });
  email.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); pass.focus(); } });

  container.append(
    el("div", { class: "auth" },
      el("div", { class: "auth-logo" }, icon("kids")),
      el("h1", { class: "auth-title" }, "תזכורות לילדים"),
      el("p", { class: "subtitle" }, "מה צריך להביא היום לגן ולבית הספר"),
      el("div", { class: "auth-card" },
        email, passWrap, hint, submitBtn, msg, switchBtn, forgotBtn,
      ),
      el("button", {
        class: "link-btn-inline", style: "margin-top:16px",
        onClick: () => renderHelp(container, { onBack: () => renderAuth(container, onAuthed) }),
      }, "איך זה עובד? הסבר על האפליקציה"),
    ),
  );
  setMode("signin");
}

// Shown when the user arrives via a password-recovery link. onDone() is called
// after the password is updated successfully.
export function renderResetPassword(container, onDone) {
  clear(container);
  const pass = el("input", { type: "password", class: "field", placeholder: "סיסמה חדשה", autocomplete: "new-password" });
  const pass2 = el("input", { type: "password", class: "field", placeholder: "אימות סיסמה", autocomplete: "new-password" });
  const msg = el("div", { class: "auth-msg" });
  const btn = el("button", { class: "btn primary block" }, "עדכון סיסמה");

  function showMsg(text, isError) { msg.textContent = text; msg.className = "auth-msg" + (isError ? " error-text" : ""); }

  async function submit() {
    const p = pass.value, p2 = pass2.value;
    showMsg("");
    if (p.length < MIN_PASSWORD) { showMsg(`הסיסמה צריכה להיות לפחות ${MIN_PASSWORD} תווים`, true); return; }
    if (p !== p2) { showMsg("הסיסמאות אינן תואמות", true); return; }
    btn.disabled = true; btn.textContent = "מעדכן...";
    try {
      const supabase = await getSupabase();
      const { error } = await supabase.auth.updateUser({ password: p });
      if (error) { showMsg("שגיאה: " + error.message, true); return; }
      onDone();
    } catch (e) {
      showMsg("שגיאה: " + (e.message || e), true);
    } finally {
      btn.disabled = false; btn.textContent = "עדכון סיסמה";
    }
  }

  btn.addEventListener("click", submit);
  pass2.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); submit(); } });

  container.append(
    el("div", { class: "auth" },
      el("div", { class: "auth-logo" }, icon("kids")),
      el("h1", { class: "auth-title" }, "איפוס סיסמה"),
      el("p", { class: "subtitle" }, "בחר/י סיסמה חדשה"),
      el("div", { class: "auth-card" }, pass, pass2, btn, msg),
    ),
  );
}
