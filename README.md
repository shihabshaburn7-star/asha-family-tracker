# ASHA Family Tracker

A simple web app for recording households and family members in your ward:
house no, house name, address, area, and per-member details (name, role,
gender, age, phone, Aadhar, job, health condition). Includes search, sort,
filters, editing, and CSV export. Free to run — data is stored in a free
Supabase project, and the app itself is hosted free on GitHub Pages.

**⚠️ This app stores sensitive personal data (Aadhar numbers, phone numbers,
health information). Please read the "Keeping the data private" section
below before you start entering real family details.**

---

## Part 1 — Create your free Supabase project (the database)

1. Go to https://supabase.com and sign up for a free account.
2. Click **New project**. Give it a name (e.g. "asha-tracker") and a
   database password (save this password somewhere safe).
3. Once the project is ready, open **SQL Editor** in the left menu →
   **New query**. Open the file `supabase-schema.sql` from this folder,
   copy all of it, paste it into the editor, and click **Run**.
   This creates the two tables (`families`, `members`) and locks the data
   down so only a signed-in user can read or write it.
4. Create your login: go to **Authentication → Users → Add user**, and
   enter an email and password for yourself (this is what you'll use to
   sign in to the app — it does not need to be a real inbox).
   - Optional: under **Authentication → Providers → Email**, you can turn
     off "Confirm email" if you'd rather not deal with confirmation links.
5. Go to **Project Settings → API**. You'll need two values from this page:
   - **Project URL**
   - **anon public** key

## Part 2 — Connect the app to your project

1. Open `config.js` in this folder.
2. Replace the two placeholder lines with your **Project URL** and
   **anon public** key from step 5 above. Save the file.

## Part 3 — Host it free on GitHub Pages

1. Create a new **public** GitHub repository (e.g. `asha-family-tracker`).
2. Upload all the files from this folder (`index.html`, `style.css`,
   `app.js`, `config.js`) to that repository.
3. In the repository, go to **Settings → Pages**.
4. Under "Build and deployment", set **Source** to `Deploy from a branch`,
   choose the `main` branch and `/ (root)` folder, then **Save**.
5. After a minute, GitHub will show you a link like
   `https://your-username.github.io/asha-family-tracker/` — that's your
   app. Open it, sign in with the email/password you created in Part 1,
   and start adding families.

You can also just open `index.html` directly in a browser (double-click
it) to use it locally without GitHub — GitHub Pages is only needed if you
want a link you can open from your phone or share with a colleague.

---

## Keeping the data private

This app is protected by a login (Supabase Authentication), and the
database rules (Row Level Security) only allow **signed-in** users to see
or change any data — so simply knowing the website address isn't enough
to get in. Still, please keep in mind:

- **Only share the login (email/password) with people who should have
  full access** to Aadhar numbers, phone numbers, and health details for
  every family in your records — treat it like any other government
  data-collection credential.
- Because the repository is public, anyone can see the *app's code*, but
  not the data inside it (the data lives in Supabase, behind the login).
- If you ever suspect the login has been shared or leaked, go to
  Supabase → Authentication → Users, delete the user, and create a new
  one with a new password.
- Consider checking with your local health department / ASHA program
  supervisor about any additional data-handling rules that apply to
  patient or beneficiary records in your area.

## Using the app

- **Add family** — enter house details, then add one or more members
  (name, role, gender, age, phone, Aadhar, job, health condition).
- **View & manage** — search by name/house no/phone/area, sort by house
  name/no/area/newest, filter by area, filter by an age range (or use it
  alongside the disease filter), and edit or delete any household or
  member inline.
- **Export data** — download CSV files: alphabetical (A–Z or Z–A), by
  house no, grouped by (or filtered to) one area, by an age group (presets
  like 1–18, or a custom range), people with a health condition only, or
  the full dataset. CSV files open directly in Excel or Google Sheets.

## Troubleshooting

- **"Almost there" screen on load** → `config.js` still has the
  placeholder text; paste in your real Supabase URL and key.
- **Can't sign in** → double check the email/password created in
  Supabase → Authentication → Users, and that "Confirm email" isn't
  blocking you (see Part 1, step 4).
- **Data not saving / permission errors** → make sure you ran the full
  `supabase-schema.sql` script, and that you're signed in (not just on
  the login screen).
