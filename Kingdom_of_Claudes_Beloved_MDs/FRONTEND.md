# FRONTEND - הפרונטאנד (PWA)

פרונטאנד סטטי בעברית (RTL), ללא שלב build. JavaScript מודולרי (ES modules), עיצוב מובייל-פירסט. לקוח Supabase נטען מ-esm.sh.

## בקר ראשי - app.js
- `boot()` בודק קונפיגורציה וסשן. אם חסר `config.js` -> מסך הגדרה. אם אין סשן -> מסך התחברות. אחרת -> מעטפת האפליקציה.
- `renderShell()` בונה כותרת (כולל התנתקות), לשוניות (היום / הוספה / ילדים / הגדרות), ואזור תוכן, ומנתב בין המסכים.
- רושם את ה-service worker.

## עזרי DOM - ui.js
`el(tag, props, ...children)` ליצירת אלמנטים (תומך class / html / מאזיני on<Event> / מאפיינים), `clear(node)`, ו-`toast(message, type)`.

## מסכים
- **התחברות (auth.js)** — אימייל + סיסמה דרך Supabase Auth. תומך הרשמה (כולל מקרה של אישור אימייל) והתחברות.
- **ילדים (children.js)** — רשימה, הוספה (Enter או כפתור), ומחיקה עם אישור. נתונים: `listChildren`, `addChild`, `deleteChild`.
- **הוספת תזכורת (reminders.js -> renderAdd)** — בחירת ילד, תאריך (ברירת מחדל היום), טקסט ווצאפ אופציונלי, כפתור "חלץ עם AI" אופציונלי, ורשימת פריטים נערכת (chips). ההזנה הידנית היא ברירת המחדל; ה-AI רק ממלא מראש את אותה רשימה. שמירה ב-`addReminder`.
- **מה צריך להביא (reminders.js -> renderToday)** — בורר תאריך + רשימת תזכורות מקובצת לפי ילד. נתונים: `listByDate` (כולל שם הילד דרך join).
- **הגדרות (settings.js)** — שם תצוגה ושעת התראה יומית (שעון ישראל), נשמרים ב-profiles.

## חילוץ AI - ai.js
`extractItems(text, childrenNames)` קורא ל-Edge Function בשם `extract-items`. עד שהפונקציה תיפרס, הקריאה נכשלת וה-UI מציג הודעה ידידותית וממשיך בהזנה ידנית. `normalizeAi` משטח את התשובה למערך מחרוזות.

## PWA
`manifest.webmanifest` (RTL, עברית, standalone) ו-`sw.js` (מטמון מעטפת ברשת-קודם, ומאזיני push/notificationclick מוכנים לשלב ההתראות). אייקונים יתווספו בשלב הליטוש.

## תלות בקונפיגורציה
`supabaseClient.js` טוען דינמית את `config.js`; אם חסר, נזרק `CONFIG_MISSING` וה-app מציג מסך הגדרה.
