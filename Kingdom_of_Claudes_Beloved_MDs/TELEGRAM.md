# TELEGRAM - חיבור והתראות טלגרם

ערוץ ההתראות האמין (עובד בכל מכשיר כולל אייפון). שתי Edge Functions ב-Deno, שמירת `telegram_chat_id` בפרופיל, וממשק חיבור בלשונית הגדרות.

## רכיבים וקבצים
- `supabase/functions/telegram-webhook/index.ts` — webhook שמקבל עדכונים מטלגרם. מטפל ב-`/start <code>`: מאתר פרופיל לפי קוד חד-פעמי, שומר את `telegram_chat_id`, ומאשר למשתמש. משתמש ב-service role (הקריאה מטלגרם לא מאומתת ולכן עוקפת RLS).
- `supabase/functions/send-telegram/index.ts` — נקרא מהאפליקציה ("שלח התראת בדיקה"). מזהה את המשתמש מה-JWT, בונה את פריטי היום (שעון ישראל) מקובצים לפי ילד, ושולח להודעה ל-`telegram_chat_id`. תומך CORS (נקרא מהדפדפן).
- `src/settings.js` — מקטע "טלגרם": "חבר טלגרם" (יוצר קוד, פותח `https://t.me/<bot>?start=<code>`), "בדוק חיבור" (טעינה מחדש), "שלח התראת בדיקה", ו"ניתוק".
- `src/config.js` — `TELEGRAM_BOT_USERNAME` (ציבורי) לבניית קישור החיבור.

## זרימת החיבור
המקטע בהגדרות הוא תלת-מצבי לפי הפרופיל: idle (כפתור "חבר טלגרם"), pending (קיים `telegram_link_code`), connected (קיים `telegram_chat_id`).
1. המשתמש לוחץ "חבר טלגרם" -> נוצר קוד קצר חד-פעמי (8 תווים) ונשמר ב-`profiles.telegram_link_code`, ונפתח `https://t.me/<bot>?start=<code>`.
2. במצב pending מוצגים גם **הקישור והקוד** במפורש, כך שאפשר לפתוח/להקליד מהטלפון אם `t.me` חסום ברשת (`/start <code>` לבוט). המשתמש לוחץ Start בטלגרם.
3. ה-webhook מקבל `/start <code>`, מאתר את הפרופיל, שומר `telegram_chat_id` ומאפס את הקוד.
4. המשתמש לוחץ "בדוק חיבור" -> מוצג כמחובר.

## סודות (Secrets) ב-Supabase
מוגדרים ב-Project Settings -> Edge Functions -> Secrets:
- `TELEGRAM_BOT_TOKEN` — מ-BotFather.
- `TELEGRAM_WEBHOOK_SECRET` — מחרוזת אקראית כלשהי; אותו ערך נמסר ל-Telegram ב-`setWebhook` ומאומת בכל קריאה.

`SUPABASE_URL` ו-`SUPABASE_SERVICE_ROLE_KEY` מוזרקים אוטומטית ל-Edge Functions.

## פריסה (דרך הדאשבורד, בלי CLI)
1. **DB**: הרצת `supabase/telegram.sql` ב-SQL Editor (מוסיף `telegram_link_code`).
2. **פונקציות**: Edge Functions -> Create function. יוצרים `telegram-webhook` ו-`send-telegram`, מדביקים את תוכן ה-`index.ts` המתאים, ופורסים.
3. **סודות**: מגדירים `TELEGRAM_BOT_TOKEN` ו-`TELEGRAM_WEBHOOK_SECRET`.
4. **config**: ממלאים `TELEGRAM_BOT_USERNAME` ב-`src/config.js`.
5. **רישום webhook** מול טלגרם (פעם אחת):
   ```
   curl "https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://<PROJECT-REF>.supabase.co/functions/v1/telegram-webhook&secret_token=<WEBHOOK_SECRET>"
   ```

## מבנה ההודעה
"בוקר טוב! מה צריך להביא היום (<תאריך>):" ואז לכל ילד שם ושורות פריטים עם תבליט. אם אין פריטים - הודעה מתאימה.

## הערות ומגבלות
- `send-telegram` הנוכחי שולח למשתמש המחובר בלבד (בדיקה). שליחה אצווה לכל המשתמשים בשעה שנקבעה תיבנה בשלב התזמון (GitHub Actions cron).
- ה-webhook מאמת את הכותרת `X-Telegram-Bot-Api-Secret-Token` מול `TELEGRAM_WEBHOOK_SECRET`.
