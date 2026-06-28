// App controller: boots the app, handles auth gating, and switches between views.

import { el, clear } from "./ui.js";
import { getSupabase } from "./supabaseClient.js";
import { getSession, signOut, renderAuth } from "./auth.js";
import { renderToday, renderAdd } from "./reminders.js";
import { renderChildren } from "./children.js";
import { renderSettings } from "./settings.js";

const app = document.getElementById("app");

const views = {
  today: { label: "היום", render: renderToday },
  add: { label: "הוספה", render: renderAdd },
  children: { label: "ילדים", render: renderChildren },
  settings: { label: "הגדרות", render: renderSettings },
};

async function boot() {
  clear(app);
  let session;
  try {
    session = await getSession();
  } catch (e) {
    if (e.message === "CONFIG_MISSING") { renderSetupNotice(); return; }
    renderFatal(e);
    return;
  }
  if (!session) {
    renderAuth(app, boot);
    return;
  }
  renderShell();
}

function renderSetupNotice() {
  app.append(
    el("div", { class: "setup" },
      el("h1", {}, "הגדרה נדרשת"),
      el("p", { class: "subtitle" },
        'צור קובץ config.js בתיקיית src לפי config.example.js, עם כתובת ה-Supabase והמפתח האנונימי, ורענן.'),
    ),
  );
}

function renderFatal(e) {
  app.append(el("div", { class: "setup" },
    el("h1", {}, "שגיאה"),
    el("p", {}, e.message || String(e)),
  ));
}

function renderShell() {
  clear(app);
  const content = el("main", { id: "content" });
  const nav = el("nav", { class: "tabs" });
  const header = el("header", { class: "topbar" },
    el("span", { class: "brand" }, "תזכורות לילדים"),
    el("button", {
      class: "link-btn",
      onClick: async () => { await signOut(); boot(); },
    }, "התנתקות"),
  );

  const tabButtons = {};
  function go(key) {
    for (const k in tabButtons) tabButtons[k].classList.toggle("active", k === key);
    views[key].render(content).catch((e) => {
      clear(content);
      content.append(el("div", { class: "error" }, "שגיאה: " + (e.message || e)));
    });
  }
  for (const [key, view] of Object.entries(views)) {
    const button = el("button", { class: "tab", onClick: () => go(key) }, view.label);
    tabButtons[key] = button;
    nav.append(button);
  }

  app.append(header, nav, content);
  go("today");
}

function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  }
}

boot();
registerServiceWorker();
