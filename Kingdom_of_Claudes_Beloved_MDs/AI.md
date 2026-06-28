# AI - חילוץ פריטים עם Gemini

חילוץ אופציונלי של רשימת הפריטים מתוך הודעת ווצאפ חופשית, באמצעות Google Gemini (free tier). ההזנה הידנית נשארת ברירת המחדל; ה-AI רק ממלא מראש את רשימת הפריטים.

## רכיבים
- `supabase/functions/extract-items/index.ts` - Edge Function. מקבל `{ text }`, דורש משתמש מחובר (אימות ה-JWT בקוד, כדי להגן על מכסת ה-Gemini), קורא ל-Gemini עם פרומפט בעברית, ומחזיר `{ items: [...] }`.
- `src/ai.js` - צד הלקוח: `extractItems(text, childrenNames)` קורא ל-Edge Function; `normalizeAi` משטח את התשובה למערך מחרוזות.
- כפתור "חלץ עם AI" ב-`src/reminders.js` (מסך הוספת תזכורת).

## פרטי ה-Gemini
- Endpoint: `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=...`
- מודל ברירת מחדל: `gemini-2.5-flash` (ניתן לשינוי דרך הסוד `GEMINI_MODEL`, או `model` בגוף הבקשה לבדיקה). הערה: ל-`gemini-2.0-flash` גוגל החזירה free-tier בגודל 0 - לכן ברירת המחדל היא 2.5.
- `generationConfig.responseMimeType = "application/json"` ו-`temperature = 0` לתשובה יציבה ומובנית. התשובה מפורסרת ל-`items`.

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
