// Authentication: username + password.
//
// Supabase Auth needs an email as the login identifier, but we never ask the user
// for one. Instead we synthesize an internal email from the username by appending a
// fixed domain (e.g. "dani88" -> "dani88@kids-reminders.app"). The user only ever
// types a username and a password; the synthesized email is rebuilt the same way on
// every sign-in, so it stays consistent. No real email is ever sent (this relies on
// "Confirm email" being turned OFF in the Supabase Auth settings).

import { getSupabase } from "./supabaseClient.js";
import { el, clear, icon } from "./ui.js";

// Fixed internal domain for the synthesized login email. Not a real mailbox.
const AUTH_DOMAIN = "kids-reminders.app";

// Allowed username: ASCII letters/digits and . _ - , 3-30 chars. Kept to characters
// that are valid in an email local-part so the synthesized email is always well-formed.
const USERNAME_RE = /^[a-z0-9._-]{3,30}$/;
const MIN_PASSWORD = 6;

function usernameToEmail(username) {
  return `${username}@${AUTH_DOMAIN}`;
}

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

  const username = el("input", {
    class: "field", placeholder: "שם משתמש", autocomplete: "username",
    autocapitalize: "none", autocorrect: "off", spellcheck: "false",
  });
  const pass = el("input", {
    type: "password", class: "field", placeholder: "סיסמה", autocomplete: "current-password",
  });

  // Show/hide password toggle (helpful on mobile).
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
  const hint = el("p", { class: "auth-hint" }, "שם באנגלית: אותיות, מספרים, ו- . _ -");

  function setMode(next) {
    mode = next;
    const signup = mode === "signup";
    submitBtn.textContent = signup ? "הרשמה" : "התחברות";
    switchBtn.textContent = signup ? "כבר יש לך חשבון? התחברות" : "אין לך חשבון? הרשמה";
    pass.setAttribute("autocomplete", signup ? "new-password" : "current-password");
    hint.style.display = signup ? "block" : "none";
    msg.textContent = "";
    msg.className = "auth-msg";
  }

  function showError(text) {
    msg.textContent = text;
    msg.className = "auth-msg error-text";
  }

  async function submit() {
    const name = username.value.trim().toLowerCase();
    const password = pass.value;
    msg.textContent = "";
    msg.className = "auth-msg";

    if (!name || !password) { showError("נא למלא שם משתמש וסיסמה"); return; }
    if (!USERNAME_RE.test(name)) {
      showError("שם משתמש לא תקין: אותיות באנגלית/מספרים, 3-30 תווים");
      return;
    }
    if (mode === "signup" && password.length < MIN_PASSWORD) {
      showError(`הסיסמה צריכה להיות לפחות ${MIN_PASSWORD} תווים`);
      return;
    }

    submitBtn.disabled = true;
    const original = submitBtn.textContent;
    submitBtn.textContent = mode === "signup" ? "נרשם..." : "מתחבר...";

    try {
      const supabase = await getSupabase();
      const email = usernameToEmail(name);

      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email, password, options: { data: { display_name: name } },
        });
        if (error) {
          if (/already|registered|exists/i.test(error.message)) {
            showError("שם המשתמש כבר תפוס, בחר/י אחר");
          } else {
            showError("שגיאה: " + error.message);
          }
          return;
        }
        // When "Confirm email" is ON, an existing user is returned with no identities
        // (enumeration protection) and no session. Treat that as "taken".
        if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
          showError("שם המשתמש כבר תפוס, בחר/י אחר");
          return;
        }
        if (!data.session) {
          showError('ההרשמה לא הושלמה. ודא/י ש-"Confirm email" כבוי בהגדרות Supabase.');
          return;
        }
        onAuthed();
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) { showError("שם משתמש או סיסמה שגויים"); return; }
        onAuthed();
      }
    } catch (e) {
      showError("שגיאה: " + (e.message || e));
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = original;
    }
  }

  submitBtn.addEventListener("click", submit);
  switchBtn.addEventListener("click", () => setMode(mode === "signin" ? "signup" : "signin"));
  pass.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); submit(); } });
  username.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); pass.focus(); } });

  container.append(
    el("div", { class: "auth" },
      el("div", { class: "auth-logo" }, icon("kids")),
      el("h1", { class: "auth-title" }, "תזכורות לילדים"),
      el("p", { class: "subtitle" }, "מה צריך להביא היום לגן ולבית הספר"),
      el("div", { class: "auth-card" },
        username,
        passWrap,
        hint,
        submitBtn,
        msg,
        switchBtn,
      ),
    ),
  );
  setMode("signin");
}
