# FRONTEND - הפרונטאנד (PWA)

פרונטאנד סטטי בעברית (RTL), ללא שלב build. JavaScript מודולרי (ES modules), עיצוב מובייל-פירסט עם ניווט תחתון (bottom tab bar), כרטיסים מעוגלים, אווטארים צבעוניים לכל ילד, וגופן Rubik. לקוח Supabase נטען מ-esm.sh.

## בקר ראשי - app.js
- `boot()` בודק קונפיגורציה וסשן. אם חסר `config.js` -> מסך הגדרה. אם אין סשן -> מסך התחברות. אחרת -> מעטפת האפליקציה.
- `renderShell()` בונה כותרת עליונה (מותג + כפתור התנתקות כאייקון), אזור תוכן, וסרגל לשוניות **תחתון** עם אייקונים (היום / הוספה / ילדים / הגדרות / עזרה), ומנתב בין המסכים.
- רושם את ה-service worker.

## עזרי DOM - ui.js
- `el(tag, props, ...children)` ליצירת אלמנטים (תומך class / html / מאזיני on<Event> / מאפיינים), `clear(node)`, ו-`toast(message, type)`.
- `icon(name)` מחזיר אייקון SVG מוטמע (today, add, kids, settings, eye, eye-off, logout, trash) שצובע לפי `currentColor`.
- `avatar(name, seed)` מחזיר עיגול צבעוני עם האות הראשונה של הילד/ה; `avatarColor(seed)` בוחר צבע יציב מתוך פלטה לפי hash של ה-seed (בדרך כלל מזהה הילד), כך שאותו ילד תמיד מקבל אותו צבע בלי לאחסן אותו.

## מסכים
- **התחברות (auth.js)** — **אימייל + סיסמה**. הרשמה/התחברות דרך `signUp`/`signInWithPassword`; כולל מתג הצג/הסתר סיסמה ומעבר בין התחברות/הרשמה. סיסמה לפחות 6 תווים. **דורש ש-"Confirm email" יהיה כבוי** בהגדרות Supabase Auth (אחרת ההרשמה לא נכנסת מיד).
  - **שחזור סיסמה**: קישור "שכחת סיסמה?" קורא ל-`resetPasswordForEmail` (קישור איפוס נשלח למייל, דרך המנגנון המובנה של Supabase). `renderResetPassword` מוצג כשמגיעים מהקישור (אירוע `PASSWORD_RECOVERY` ב-`onAuthStateChange`, ב-`app.js`), ומעדכן סיסמה דרך `updateUser`. דורש `detectSessionInUrl: true` ו-`flowType: implicit` (ב-`supabaseClient.js`), ו-Site URL + Redirect URLs מוגדרים ב-Supabase.
- **ילדים (children.js)** — רשימה עם אווטאר צבעוני לכל ילד/ה, הוספה (Enter או כפתור), ומחיקה (כפתור אייקון פח) עם אישור. נתונים: `listChildren`, `addChild`, `deleteChild`.
- **הוספת תזכורת (reminders.js -> renderAdd)** — בחירת ילד, תאריך (**ברירת מחדל: מחר**), טקסט ווצאפ אופציונלי, כפתור "חלץ עם AI" אופציונלי, ורשימת פריטים נערכת (chips, דרך `chipEditor` משותף). ה-AI ממלא מראש את הפריטים ומעדכן את התאריך אם זוהה בהודעה. שמירה ב-`saveMerged`: מאחדת לשורה אחת לכל (ילד, תאריך) - אם כבר קיימת תזכורת לאותו ילד ויום, הפריטים מתמזגים אליה (ללא כפילויות).
- **מה צריך להביא (reminders.js -> renderToday)** — בורר תאריך (ברירת מחדל היום) + כרטיס לכל ילד, **מאוחד**: כל התזכורות של אותו ילד באותו יום מוצגות יחד. בכל כרטיס: אווטאר, שם, ו**כפתורי עריכה ומחיקה**. עריכה פותחת `chipEditor` בתוך הכרטיס (שמירה -> `updateReminder` + איחוד לשורה אחת; רשימה ריקה -> מחיקה). מחיקה מוחקת את כל שורות הקבוצה (`deleteReminders`). נתונים: `listByDate` (join לשם הילד).
- **הגדרות (settings.js)** — שם תצוגה ושעת התראה יומית (שעון ישראל) ב-profiles, מקטע חיבור טלגרם, ומקטע התראות דפדפן (Web Push).
- **עזרה (help.js)** — מסך הסבר מלא בעברית: מה האפליקציה עושה, כל לשונית, איך מוסיפים תזכורת, חיבור התראות, התקנה למסך הבית, וטיפים. `renderHelp(container, { onBack })` - נגיש כלשונית בתוך האפליקציה, וגם ממסך ההתחברות דרך קישור "איך זה עובד?" (עם כפתור חזרה), כך שאפשר לקרוא הכל עוד לפני הרשמה.

## שמירת סשן (זכירת המכשיר)
`supabaseClient.js` יוצר את הלקוח עם `persistSession`, `autoRefreshToken`, ו-`storageKey` ייעודי ב-localStorage. כך המשתמש נשאר מחובר אחרי סגירת האפליקציה, וכל מכשיר שומר סשן משלו - אותו משתמש יכול להתחבר בכמה מכשירים במקביל.

## חילוץ AI - ai.js
`extractItems(text, childrenNames)` קורא ל-Edge Function בשם `extract-items` ומחזיר `{ items, date }`. במקרה של בעיה זורק שגיאה עם `.code` (`quota` / `unauthorized` / `service_unavailable` / `ai_error`), ו-`renderAdd` ממפה אותו להודעה רלוונטית בעברית. ההזנה הידנית תמיד ממשיכה לעבוד. פירוט מלא ב-`AI.md`.

## PWA
`manifest.webmanifest` (RTL, עברית, standalone, theme סגול, אייקונים, ו-`share_target`) ו-`sw.js` (מטמון מעטפת ברשת-קודם, ומאזיני push/notificationclick). `index.html` כולל מטא של iOS להוספה למסך הבית, אייקונים, וגופן Rubik.

### שיתוף מווצאפ (Share Target)
`manifest` מגדיר `share_target` (GET, פרמטרים title/text/url). באנדרואיד, אחרי התקנה למסך הבית, "שתף" מווצאפ פותח את האפליקציה עם הטקסט ב-query string. `app.js` קורא אותו בטעינה (`setSharedText`), מנקה את ה-URL, ופותח את לשונית "הוספה"; `renderAdd` ממלא את שדה ההודעה ומריץ אוטומטית את חילוץ ה-AI. (לא נתמך ב-iOS.)

## תלות בקונפיגורציה
`supabaseClient.js` טוען דינמית את `config.js`; אם חסר, נזרק `CONFIG_MISSING` וה-app מציג מסך הגדרה.
