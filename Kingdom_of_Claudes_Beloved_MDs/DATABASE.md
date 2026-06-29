# DATABASE - מסד הנתונים

מסד הנתונים הוא Postgres מנוהל ב-Supabase. הסכמה המלאה ב-`supabase/schema.sql`, מורצת פעם אחת ב-SQL Editor.

## טבלאות

- **profiles** — שורה אחת לכל משתמש מאומת. `id` (=auth user), `display_name`, `notification_time` (ברירת מחדל 06:30, שעון ישראל), `telegram_chat_id` (chat מחובר), `telegram_link_code` (קוד חד-פעמי לחיבור טלגרם, מאופס אחרי החיבור; אינדקס ייחודי חלקי), `created_at`.
- **children** — `id`, `user_id`, `name`, `color`, `created_at`.
- **reminders** — `id`, `user_id`, `child_id`, `due_date`, `items` (jsonb, מערך מחרוזות), `source_text` (טקסט הווצאפ המקורי, אופציונלי), `created_at`.
- **push_subscriptions** — לשלב Web Push: `endpoint`, `p256dh`, `auth` לכל מכשיר.
- **notification_log** — לשלב ההתראות: מונע שליחה כפולה ביום (`unique(user_id, sent_on, channel)`).

## אבטחה (RLS)

RLS מופעל על כל הטבלאות. לכל טבלה מדיניות יחידה שמתירה גישה רק כאשר `auth.uid()` שווה ל-`user_id` (או `id` ב-profiles), הן ב-`using` והן ב-`with check`. כך כל משתמש ניגש אך ורק לשורות שלו.

## טריגר יצירת פרופיל

הפונקציה `handle_new_user` (security definer) יוצרת שורת `profiles` אוטומטית בעת הרשמת משתמש חדש, עם שם תצוגה ברירת מחדל. ההתחברות היא בשם משתמש, והאפליקציה בונה email פנימי בצורת `<username>@kids-reminders.app`; הטריגר לוקח את שם התצוגה מ-`display_name` שנשלח בהרשמה (ובהיעדרו מהחלק שלפני ה-`@`), כך ששם התצוגה ההתחלתי שווה לשם המשתמש. מופעלת בטריגר `on_auth_user_created` על `auth.users`. דורש ש-"Confirm email" יהיה כבוי ב-Supabase Auth.

## הערות
- `items` נשמר כ-jsonb לפשטות. אפשר בעתיד לנרמל לטבלת פריטים נפרדת אם נרצה סימון "בוצע" לכל פריט.
- **שורה אחת לכל (ילד, תאריך)**: אין אילוץ ייחודיות ב-DB, אבל הלוגיקה באפליקציה (`saveMerged` ב-`reminders.js`) ממזגת פריטים לשורה קיימת ומאחדת כפילויות. גם התצוגה מקבצת לפי ילד למקרה של שורות ישנות כפולות.
- מחיקת ילד מוחקת בקסקייד את כל התזכורות שלו (`on delete cascade`).
