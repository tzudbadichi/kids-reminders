# TECHNICAL - מפת המערכת

אפליקציית PWA לניהול תזכורות יומיות לילדים (מה להביא לגן/בית ספר), עם זיהוי AI אופציונלי והתראת בוקר.

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
│   ├── supabaseClient.js     # יצירת לקוח Supabase (טוען config.js)
│   ├── auth.js               # התחברות/הרשמה/התנתקות
│   ├── children.js           # ניהול ילדים (נתונים + מסך)
│   ├── reminders.js          # תזכורות: הוספה + תצוגת "מה צריך להביא"
│   ├── ai.js                 # חילוץ AI אופציונלי (קורא ל-Edge Function)
│   ├── settings.js           # שם תצוגה + שעת התראה
│   ├── manifest.webmanifest  # הגדרות PWA
│   ├── sw.js                 # service worker (מטמון + push לעתיד)
│   └── config.example.js     # תבנית לקונפיגורציה (להעתיק ל-config.js)
├── supabase/
│   └── schema.sql            # טבלאות + RLS + טריגר יצירת פרופיל
├── Kingdom_of_Claudes_Beloved_MDs/   # מסמכי פירוט
├── TECHNICAL.md
└── README.md
```

## אינדקס רכיבים

**מסד הנתונים** — טבלאות profiles, children, reminders, push_subscriptions, notification_log, עם RLS לכל משתמש וטריגר ליצירת פרופיל אוטומטית.
> פירוט: `Kingdom_of_Claudes_Beloved_MDs/DATABASE.md`

**הפרונטאנד** — PWA בעברית: התחברות, ניהול ילדים, הוספת תזכורת (ידני + AI אופציונלי), ותצוגת היום. בקר ניתוב פשוט ב-app.js.
> פירוט: `Kingdom_of_Claudes_Beloved_MDs/FRONTEND.md`

**הקמה והרצה** — שלבי ההגדרה של Supabase, קונפיגורציה והרצה מקומית.
> פירוט: `Kingdom_of_Claudes_Beloved_MDs/SETUP.md`

## קונפיגורציה וסביבה

| פריט | מקור | הערה |
|------|------|------|
| `SUPABASE_URL` | `src/config.js` | מ-Project Settings -> API |
| `SUPABASE_ANON_KEY` | `src/config.js` | מפתח ציבורי, מוגן ב-RLS |
| מפתח Gemini | Edge Function (שלב הבא) | לא בדפדפן |
| בוט טלגרם | Edge Function (שלב הבא) | לא בדפדפן |

## תלויות

| חבילה | תפקיד |
|-------|-------|
| `@supabase/supabase-js@2` | לקוח Supabase (נטען מ-esm.sh, ללא שלב build) |

## מצב פיתוח
הליבה הושלמה. בשלבים הבאים: חילוץ AI (Edge Function + Gemini), Web Push, בוט טלגרם, ותזמון בוקר (pg_cron).
