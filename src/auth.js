// Authentication: email + password via Supabase Auth.

import { getSupabase } from "./supabaseClient.js";
import { el, clear } from "./ui.js";

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
  const email = el("input", { type: "email", class: "field", placeholder: "אימייל", autocomplete: "email" });
  const pass = el("input", { type: "password", class: "field", placeholder: "סיסמה", autocomplete: "current-password" });
  const msg = el("div", { class: "auth-msg" });

  async function submit(mode) {
    msg.textContent = "";
    const credentials = { email: email.value.trim(), password: pass.value };
    if (!credentials.email || !credentials.password) {
      msg.textContent = "נא למלא אימייל וסיסמה";
      return;
    }
    const supabase = await getSupabase();
    const { data, error } =
      mode === "signup"
        ? await supabase.auth.signUp(credentials)
        : await supabase.auth.signInWithPassword(credentials);

    if (error) {
      msg.textContent = "שגיאה: " + error.message;
      return;
    }
    // When email confirmation is enabled, sign-up returns no session yet.
    if (mode === "signup" && !data.session) {
      msg.textContent = "נשלח אליך אימייל אישור. אשר אותו ואז התחבר.";
      return;
    }
    onAuthed();
  }

  container.append(
    el("div", { class: "auth" },
      el("h1", {}, "תזכורות לילדים"),
      el("p", { class: "subtitle" }, "התחברות לחשבון"),
      email,
      pass,
      el("button", { class: "btn primary", onClick: () => submit("signin") }, "התחברות"),
      el("button", { class: "btn", onClick: () => submit("signup") }, "הרשמה"),
      msg,
    ),
  );
}
