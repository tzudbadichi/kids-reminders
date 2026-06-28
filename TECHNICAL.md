# TECHNICAL - מפת המערכת

אפליקציית PWA לניהול תזכורות יומיות לילדים (מה להביא לגן/בית ספר), עם זיהוי AI אופציונלי והתראת בוקר.

> **ממשיכים את העבודה?** קרא קודם את `Kingdom_of_Claudes_Beloved_MDs/PROJECT_STATUS.md` - שם כל ההכרעות, הנימוקים, מצב הבנייה, והצעד הבא. מסמך זה (TECHNICAL.md) הוא מפת המערכת.

## סקירת ארכיטקטורה

פרונטאנד סטטי (PWA) מדבר ישירות מול Supabase (מסד נתונים + התחברות), עם הגנת Row-Level Security כך שכל משתמש רואה רק את הנתונים שלו. חילוץ ה-AI וההתראות (בשלבים הבאים) ירוצו כפונקציות צד-שרת ב-Supabase כדי להחביא מפתחות.

```
[PWA / src]  --auth + data-->  [Supabase: Postgres + RLS + Auth]
   |                                  (Edge Functions + cron - שלבים הבאים)
   |--AI (אופציונלי)-->  Edge Function "extract-items" -> Gemini
```

## מבנה הקבצים

```
project-root/
├── src/                      # קוד הפרונטאנד (PWA)
│   ├── index.html            # מעטפת האפליקציה (RTL, עברית)
│   ├── styles.css            # עיצוב
│   ├── app.js                # בקר ראשי: אתחול, ניתוב בין מסכים, גייטינג התחברות
│   ├── push.js               # Web Push: הרשמה/ביטול ושמירת המנוי
│   ├── supabaseClient.js     # יצירת לקוח Supabase (טוען config.js, שומר סשן במכשיר)
│   ├── auth.js               # התחברות בשם משתמש + סיסמה (email פנימי מסונתז)
│   ├── ui.js                 # עזרי DOM: el/clear/toast, אייקוני SVG, אווטארים צבעוניים
│   ├── children.js           # ניהול ילדים (נתונים + מסך)
│   ├── reminders.js          # תזכורות: הוספה + תצוגת "מה צריך להביא"
│   ├── ai.js                 # חילוץ AI אופציונלי (קורא ל-Edge Function)
│   ├── settings.js           # שם תצוגה + שעת התראה
│   ├── manifest.webmanifest  # הגדרות PWA
│   ├── sw.js                 # service worker (מטמון + push לעתיד)
│   └── config.example.js     # תבנית לקונפיגורציה (להעתיק ל-config.js)
├── supabase/
│   ├── schema.sql            # טבלאות + RLS + טריגר יצירת פרופיל
│   ├── telegram.sql          # מיגרציה: telegram_link_code ל-DB קיים
│   └── functions/            # Edge Functions (Deno) - נפרסות דרך הדאשבורד
│       ├── telegram-webhook/index.ts   # webhook: /start <code> -> שמירת chat_id
│       ├── send-telegram/index.ts      # שליחת פריטי היום למשתמש המחובר (בדיקה)
│       ├── send-morning/index.ts       # שליחת אצווה יומית בטלגרם (cron)
│       ├── send-push/index.ts          # שליחת אצווה יומית ב-Web Push (cron)
│       └── extract-items/index.ts      # חילוץ פריטים עם Gemini
├── .github/workflows/
│   ├── deploy-pages.yml      # פריסה אוטומטית ל-GitHub Pages (מ-src/)
│   └── morning-notify.yml    # cron יומי שמפעיל את send-morning
├── Kingdom_of_Claudes_Beloved_MDs/   # מסמכי פירוט
├── TECHNICAL.md
└── README.md
```

## אינדקס רכיבים

**מצב הפרויקט וההכרעות** — נקודת ההמשך לעבודה: מצב נוכחי, כל ההכרעות והנימוקים, שלבי הבנייה, והצעד הבא.
> פירוט: `Kingdom_of_Claudes_Beloved_MDs/PROJECT_STATUS.md`

**מסד הנתונים** — טבלאות profiles, children, reminders, push_subscriptions, notification_log, עם RLS לכל משתמש וטריגר ליצירת פרופיל אוטומטית.
> פירוט: `Kingdom_of_Claudes_Beloved_MDs/DATABASE.md`

**הפרונטאנד** — PWA בעברית מובייל-פירסט (ניווט תחתון, אווטארים): התחברות בשם משתמש, ניהול ילדים, הוספת תזכורת (ידני + AI אופציונלי), ותצוגת היום. הסשן נשמר במכשיר. בקר ניתוב פשוט ב-app.js.
> פירוט: `Kingdom_of_Claudes_Beloved_MDs/FRONTEND.md`

**הקמה והרצה** — שלבי ההגדרה של Supabase, קונפיגורציה והרצה מקומית.
> פירוט: `Kingdom_of_Claudes_Beloved_MDs/SETUP.md`

**טלגרם** — חיבור חשבון טלגרם בלחיצה (deep link + webhook) ושליחת תזכורות. שתי Edge Functions, חיבור דרך לשונית הגדרות.
> פירוט: `Kingdom_of_Claudes_Beloved_MDs/TELEGRAM.md`

**תזמון התראות** — שליחת בוקר אוטומטית: פונקציית אצווה `send-morning` שמופעלת ב-GitHub Actions cron כל 15 דקות, עם לוגיקת catch-up ומניעת כפילויות.
> פירוט: `Kingdom_of_Claudes_Beloved_MDs/SCHEDULING.md`

**Web Push** — התראות דפדפן/מכשיר כערוץ שני: הרשמה ב-`push.js`, שליחה ב-`send-push` (אותו cron), VAPID.
> פירוט: `Kingdom_of_Claudes_Beloved_MDs/WEBPUSH.md`

**חילוץ AI** — Edge Function `extract-items` שמחלץ פריטים מהודעת ווצאפ עם Google Gemini (אופציונלי).
> פירוט: `Kingdom_of_Claudes_Beloved_MDs/AI.md`

**פריסה** — הפרונטאנד מתפרסם ל-GitHub Pages דרך GitHub Actions; config.js נוצר בבנייה ממשתני-ריפו. כתובת חיה: https://tzudbadichi.github.io/kids-reminders/
> פירוט: `Kingdom_of_Claudes_Beloved_MDs/DEPLOY.md`

## קונפיגורציה וסביבה

| פריט | מקור | הערה |
|------|------|------|
| `SUPABASE_URL` | `src/config.js` | מ-Project Settings -> API |
| `SUPABASE_ANON_KEY` | `src/config.js` | מפתח ציבורי (anon/publishable), מוגן ב-RLS |
| Confirm email = OFF | Supabase Auth settings | חובה - ההתחברות בשם משתמש דורשת זאת |
| `TELEGRAM_BOT_USERNAME` | `src/config.js` | ציבורי, לקישור החיבור |
| `TELEGRAM_BOT_TOKEN` | Supabase Edge Functions Secret | סודי, לא בדפדפן |
| `TELEGRAM_WEBHOOK_SECRET` | Supabase Edge Functions Secret | אימות קריאות ה-webhook |
| `CRON_SECRET` | Supabase Secret + GitHub Secret | אימות שה-cron בלבד מפעיל את send-morning |
| `GEMINI_API_KEY` | Supabase Edge Functions Secret | סודי, ל-extract-items |
| `GEMINI_MODEL` | Supabase Secret (אופציונלי) | ברירת מחדל gemini-2.5-flash |
| `VAPID_PUBLIC_KEY` | `src/config.js` + Repo Variable + Supabase Secret | ציבורי, ל-Web Push |
| `VAPID_PRIVATE_KEY` | Supabase Edge Functions Secret | סודי, ל-send-push |
| `VAPID_SUBJECT` | Supabase Secret (אופציונלי) | mailto/URL ל-Web Push |
| `SUPABASE_URL` / `SUPABASE_ANON_KEY` / `TELEGRAM_BOT_USERNAME` / `VAPID_PUBLIC_KEY` | GitHub Repository Variables | מהם נוצר config.js בפריסה |

## תלויות

| חבילה | תפקיד |
|-------|-------|
| `@supabase/supabase-js@2` | לקוח Supabase (נטען מ-esm.sh, ללא שלב build) |

## מצב פיתוח
**כל הפיצ'רים חיים בפרודקשן**: התחברות בשם משתמש, עיצוב מובייל, אייקוני PWA, ניהול ילדים ותזכורות, התראת טלגרם אוטומטית כל בוקר (GitHub Actions cron שגם שומר את Supabase ער), חילוץ AI עם Gemini, והכל פרוס ב-GitHub Pages. Web Push: הקוד נכתב וממתין לפריסת `send-push` + סודות VAPID. לסטטוס מפורט, הכרעות, והצעד הבא ראה `Kingdom_of_Claudes_Beloved_MDs/PROJECT_STATUS.md`.
