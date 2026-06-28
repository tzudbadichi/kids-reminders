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
│       └── send-telegram/index.ts      # שליחת פריטי היום למשתמש המחובר
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

## קונפיגורציה וסביבה

| פריט | מקור | הערה |
|------|------|------|
| `SUPABASE_URL` | `src/config.js` | מ-Project Settings -> API |
| `SUPABASE_ANON_KEY` | `src/config.js` | מפתח ציבורי (anon/publishable), מוגן ב-RLS |
| Confirm email = OFF | Supabase Auth settings | חובה - ההתחברות בשם משתמש דורשת זאת |
| `TELEGRAM_BOT_USERNAME` | `src/config.js` | ציבורי, לקישור החיבור |
| `TELEGRAM_BOT_TOKEN` | Supabase Edge Functions Secret | סודי, לא בדפדפן |
| `TELEGRAM_WEBHOOK_SECRET` | Supabase Edge Functions Secret | אימות קריאות ה-webhook |
| מפתח Gemini | Edge Function (שלב הבא) | לא בדפדפן |

## תלויות

| חבילה | תפקיד |
|-------|-------|
| `@supabase/supabase-js@2` | לקוח Supabase (נטען מ-esm.sh, ללא שלב build) |

## מצב פיתוח
הליבה הושלמה (התחברות בשם משתמש, עיצוב מובייל). קוד הטלגרם נכתב (webhook + שליחה + ממשק חיבור) וממתין לפריסה בדאשבורד. בשלבים הבאים: חילוץ AI (Edge Function + Gemini), Web Push, ותזמון בוקר דרך GitHub Actions (טריגר חיצוני יומי שמפעיל Edge Function; גם שומר את פרויקט ה-Supabase ער במסלול החינמי). לסטטוס מפורט, הכרעות, והצעד הבא ראה `Kingdom_of_Claudes_Beloved_MDs/PROJECT_STATUS.md`.
