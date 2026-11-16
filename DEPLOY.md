# Deploy Class Funds (free)

## A. Supabase (backend)
1. supabase.com > Dashboard. Free plan allows 2 active projects per organization (as far as I know; the New project page tells you if you're blocked). Click **New project**, name it `class-funds`, set a database password, pick the nearest region (Singapore), plan Free. If you're blocked, reuse your existing project: the tables are all prefixed `cf_`, so nothing collides.
2. **Authentication > Sign In / Providers**: turn on **Allow anonymous sign-ins**. Save.
3. **Authentication > Rate Limits**: raise "Anonymous sign-ins" from the default (30 per hour per IP) to 200, since classmates may share one campus IP.
4. Open `setup.sql`, change `CHANGE-ME` to your class code, copy everything above the final comment lines, paste in **SQL Editor > New query**, click **Run**. Expect "Success".
5. **Authentication > Users > Add user > Create new user**: your email + a strong password, tick **Auto Confirm User**.
6. New SQL query, run (with your email):
   `insert into cf_profiles(user_id,name,sid,role) select id,'Treasurer','000000','admin' from auth.users where email='YOUR-EMAIL@gmail.com';`
7. **Project Settings > API**: copy **Project URL** and the **anon public** key. Paste them into the top of `app.js`. Never use the `service_role` key.

## B. GitHub Pages (PowerShell, in the class-funds folder)
1. github.com > New repository: name `class-funds`, **Public** (free Pages needs public), no README. Create.
2. Run:
```
git init
git add .
git commit -m "Class Funds v1"
git branch -M main
git remote add origin https://github.com/profspirit-god/class-funds.git
git push -u origin main
```
3. Repo **Settings > Pages**: Source = **Deploy from a branch**, Branch = `main`, folder `/ (root)`, Save. After ~1 minute the site is at `https://profspirit-god.github.io/class-funds/`.
4. Don't commit the Excel file or DEPLOY.md secrets; the repo is public.

## C. First run
1. Open the link, enter name, ID and the class code. You are a visitor.
2. Settings > Treasurer sign-in with the email/password from A5. Page reloads as admin; an Admin tab appears.
3. Admin > Update data > pick `V3-ENTREP-3_Class_Funds_Tracker.xlsx`. It reports how many students loaded and who was skipped for having no ID.
4. Share the link and class code. After classmates register, Admin > Users > **Make all visitors students** to unlock Chat.

## Known limits
- Free Supabase projects pause after about a week without activity. If the app errors, open the project and click Restore.
- Roles are per device. A student on a new phone or cleared browser starts as a visitor again; promote them again.
- Do not share the anon key as a secret; do guard the class code and the admin password.
