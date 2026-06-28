# תזכורות לילדים

אפליקציית ווב (PWA) שאוספת הודעות מהגן ובית הספר, מזהה מה צריך להביא, ושולחת התראה בכל בוקר.

## הרצה מקומית (שלב הליבה)

1. **Supabase** — צור פרויקט ב-[supabase.com](https://supabase.com).
2. **סכמה** — ב-Supabase פתח SQL Editor והרץ את התוכן של `supabase/schema.sql`.
3. **קונפיגורציה** — העתק את `src/config.example.js` ל-`src/config.js` ומלא את `SUPABASE_URL` ו-`SUPABASE_ANON_KEY` (מתוך Project Settings -> API).
4. **הרצה** — הגש את תיקיית `src` משרת מקומי (לא לפתוח קובץ ישירות, כי משתמשים ב-ES modules). לדוגמה, מתוך התיקייה:
   - `python -m http.server 5173` ואז גלוש ל-`http://localhost:5173/src/`
   - או תוסף Live Server ב-VS Code על `src/index.html`.

## מצב נוכחי
ליבה עובדת: התחברות, ניהול ילדים, הוספת תזכורת (הזנה ידנית; כפתור "חלץ עם AI" אופציונלי), ותצוגת "מה צריך להביא" לפי תאריך.

לפרטים מלאים ראה `TECHNICAL.md`.
