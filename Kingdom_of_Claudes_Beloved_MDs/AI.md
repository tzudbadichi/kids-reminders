# AI - חילוץ פריטים עם Gemini

חילוץ אופציונלי של רשימת הפריטים (וגם תאריך, אם מצוין) מתוך הודעת ווצאפ חופשית, באמצעות Google Gemini (free tier). ההזנה הידנית נשארת ברירת המחדל; ה-AI ממלא מראש את רשימת הפריטים ומעדכן את התאריך.

## רכיבים
- `supabase/functions/extract-items/index.ts` - Edge Function. מקבל `{ text }`, דורש משתמש מחובר (אימות ה-JWT בקוד, כדי להגן על מכסת ה-Gemini), קורא ל-Gemini, ומחזיר תמיד HTTP 200 עם גוף מובנה: `{ ok:true, items:[...], date:"YYYY-MM-DD"|"" }` או `{ ok:false, reason:"unauthorized"|"quota"|"ai_error" }`.
- `src/ai.js` - צד הלקוח: `extractItems(text, childrenNames)` מחזיר `{ items, date }`; אם `ok:false` או כשל תקשורת, זורק שגיאה עם `.code` (כולל `service_unavailable`) כדי שה-UI יציג הודעה רלוונטית.
- כפתור "חלץ עם AI" ב-`src/reminders.js`: ממלא את הפריטים, ואם הוחזר תאריך - מעדכן את שדה התאריך.

## חילוץ תאריך
הפרומפט מקבל את התאריך והיום הנוכחיים (שעון ישראל), ומבקש להמיר ביטויים יחסיים ("מחר", "ביום שני", "ב-15/6") לתאריך מוחלט `YYYY-MM-DD` (היום הקרוב שאינו בעבר). אם אין תאריך - מוחזרת מחרוזת ריקה. הפונקציה מאמתת את הפורמט ופוסלת תאריך בעבר.

## פרטי ה-Gemini
- Endpoint: `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=...`
- מודל ברירת מחדל: `gemini-2.5-flash` (ניתן לשינוי דרך הסוד `GEMINI_MODEL`, או `model` בגוף הבקשה לבדיקה). הערה: ל-`gemini-2.0-flash` גוגל החזירה free-tier בגודל 0 - לכן ברירת המחדל היא 2.5.
- `generationConfig`: `responseMimeType = "application/json"` עם `responseSchema` (אובייקט עם `items: string[]` ו-`date: string`) לפלט מובנה ואמין, `temperature = 0`, ו-`thinkingConfig.thinkingBudget = 0` (כיבוי ה-"thinking" של מודלי 2.5 - אחרת הוא עלול להחזיר את ברירת המחדל הריקה של הסכמה).
- מצב debug: שליחת `{"debug": true}` בגוף מחזירה גם `raw`/`model`/`today` (ובשגיאה גם `detail`). דורש משתמש מחובר.
- שגיאות: כשל מכסה של Gemini (429 / RESOURCE_EXHAUSTED) ממופה ל-`reason:"quota"`; כשל אחר ל-`reason:"ai_error"`.

## סודות
- `GEMINI_API_KEY` - מ-Google AI Studio. Edge Function Secret בלבד (לא בדפדפן).
- `GEMINI_MODEL` - אופציונלי.

## פריסה
1. השג מפתח מ-Google AI Studio.
2. בדאשבורד: Edge Functions -> create `extract-items`, הדבק את הקוד, **Verify JWT OFF**, Deploy.
3. הוסף Secret `GEMINI_API_KEY` (ואופציונלית `GEMINI_MODEL`).
4. בדיקה: במסך "הוספה" הדבק טקסט ולחץ "חלץ עם AI".

## התנהגות כשלא מוגדר
אם הפונקציה לא פרוסה או נכשלת, `src/reminders.js` תופס את השגיאה ומציג הודעה ידידותית, וההזנה הידנית ממשיכה לעבוד.

## מגבלות
- מחזיר רשימת פריטים שטוחה (לא מפצל בין כמה ילדים בהודעה אחת); הזרימה היא ילד אחד נבחר בכל פעם.
- עד 50 פריטים לתשובה.
