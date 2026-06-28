# DEPLOY - פריסה ל-GitHub Pages

הפרונטאנד הסטטי (תיקיית `src/`) מתפרסם ל-GitHub Pages דרך GitHub Actions.

## כתובת חיה
https://tzudbadichi.github.io/kids-reminders/

## איך זה עובד
- **Workflow:** `.github/workflows/deploy-pages.yml` - רץ על כל push ל-`main` (וגם ידנית, `workflow_dispatch`).
- **תוכן:** מעלה את תיקיית `src/` כשורש האתר (`upload-pages-artifact` עם `path: src`). הנתיבים היחסיים ב-`index.html` וה-service worker עובדים תחת תת-הנתיב `/kids-reminders/`.
- **Pages:** מוגדר ל-`build_type: workflow` (Settings -> Pages -> Source: GitHub Actions). הופעל דרך `gh api`.

## config.js בפריסה
`src/config.js` ב-`.gitignore` ואינו נדחף. ה-workflow **מייצר אותו בזמן הבנייה** משלושה Repository Variables:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY` (ה-publishable key - ציבורי ומוגן ב-RLS)
- `TELEGRAM_BOT_USERNAME`

המשתנים הוגדרו דרך `gh variable set ...` (או Settings -> Secrets and variables -> Actions -> Variables).

## עדכון ערכים או פריסה מחדש
- לשינוי ערך: עדכן את ה-Variable (UI או `gh variable set`), והפעל מחדש את ה-workflow (push, או Actions -> Run workflow).
- כל push ל-`main` פורס אוטומטית את הגרסה העדכנית.

## הערות
- ה-Edge Functions של טלגרם **אינן** חלק מפריסה זו - הן נפרסות בנפרד בדאשבורד של Supabase (ראה `TELEGRAM.md`).
- GitHub Pages מספק HTTPS, שנדרש ל-service worker ול-PWA.
- מהטלפון: פתיחת הכתובת בדפדפן, ואז "הוסף למסך הבית" מתקינה כקיצור (PWA).
