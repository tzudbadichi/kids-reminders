# WEBPUSH - התראות דפדפן (Web Push)

ערוץ התראות שני (בנוסף לטלגרם): התראת דפדפן/מכשיר עם תזכורות הבוקר. עובד ב-Android/דסקטופ, ובאייפון רק כשהאפליקציה מותקנת למסך הבית (iOS 16.4+).

## רכיבים
- `src/push.js` - צד הלקוח: `pushSupported`, `enablePush` (בקשת הרשאה + `pushManager.subscribe` עם ה-VAPID הציבורי + שמירת המנוי ב-`push_subscriptions`), `disablePush`, `currentPushSubscription`.
- `src/settings.js` - מקטע "התראות בדפדפן": הפעלה/כיבוי לפי מצב המנוי.
- `src/sw.js` - מאזיני `push` (מציג notification מ-`{title, body}`) ו-`notificationclick` (פותח/ממקד את האפליקציה).
- `supabase/functions/send-push/index.ts` - שולח אצווה (כמו send-morning אך לערוץ push), מופעל מה-cron. מאומת ב-`x-cron-secret`. נפרד מ-send-morning כדי שתלות ה-web-push לא תסכן את מסלול הטלגרם.
- `.github/workflows/morning-notify.yml` - מפעיל גם את send-push (step שני).
- טבלת `push_subscriptions` (endpoint ייחודי, p256dh, auth, user_id) עם RLS.

## מפתחות VAPID
- `VAPID_PUBLIC_KEY` - ציבורי. ב-`config.js` (ומשתנה-ריפו לפריסה) וגם כסוד לפונקציה.
- `VAPID_PRIVATE_KEY` - סודי. Edge Function Secret בלבד.
- `VAPID_SUBJECT` - אופציונלי (`mailto:` או URL); ברירת מחדל `mailto:admin@kids-reminders.app`.
- נוצרו פעם אחת (זוג מפתחות P-256). אם מחליפים - צריך לעדכן בכל המקומות והמנויים הקיימים יתבטלו.

## זרימה
1. בהגדרות לוחצים "הפעל התראות בדפדפן" -> בקשת הרשאה -> `subscribe` -> המנוי נשמר ב-`push_subscriptions`.
2. כל בוקר ה-cron מפעיל את send-push; הוא מוצא משתמשים עם מנוי, ששעתם עברה, שיש להם פריטים, ושלא נשלח להם push היום, ושולח.
3. ה-service worker מציג את ההתראה. מנוי שפג (404/410) נמחק אוטומטית.

## פריסה
1. בדאשבורד: Edge Functions -> create `send-push`, הדבק את הקוד, **Verify JWT OFF**, Deploy.
2. Secrets: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, (אופציונלי `VAPID_SUBJECT`). `CRON_SECRET` כבר קיים.
3. `VAPID_PUBLIC_KEY` כבר ב-config (משתנה-ריפו) ונכנס לאתר בפריסה.

## מגבלות
- דורש HTTPS (GitHub Pages מספק). באייפון - רק כ-PWA מותקנת.
- תלוי בספריית `npm:web-push` בתוך ה-Edge runtime; אם יש בעיית סביבה, היא מבודדת ל-send-push בלבד (טלגרם לא מושפע).
- מבחן מלא מתבצע מהדפדפן (אי אפשר לדמות מנוי דחיפה אמיתי מ-curl).
