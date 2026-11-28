# GVG Body Map

The home screen for GVG Brain. It shows a clickable body where each part opens an area of your life and glows when something needs you. This app is the front end. Todoist and Notion store the data underneath.

| Part | What it shows | Where it lives |
| --- | --- | --- |
| Brain | Inbox tasks, reviews, and ideas left quiet | Todoist (Inbox or `@brain`), Notion Ideas |
| Eyes | Things to watch and read, the Sunday briefing | Todoist `@eyes` |
| Hands | Projects and work | Todoist project tasks or `@hands`, Notion project pages |
| Heart | People and follow-ups | Todoist `@heart` (a follow-up without a date glows after 3 days) |
| Muscles | The gym | Notion Workout log |
| Feet | Admin: documents and vehicles | Notion Expiry Dates, Todoist `@feet` |

**Glow colours.** Red means overdue or lapsed. Amber means due today or tomorrow, waiting on you, untouched for weeks, or expiring within 30 days.

## What you can do in the app

- **Tasks:** add, edit, reschedule and complete them. You can type dates in plain words, like "friday 5pm". Every change goes straight to Todoist.
- **Documents:** when you renew one, set its new expiry date. That updates the Expiry Dates database in Notion.
- **Photos on items:** add a photo to a task (it's attached as a Todoist comment) or to a document (it goes on the Notion page).
- **Gym:** a 10-second check-in (sleep, energy, time, sore muscles) comes first. The coach then plans today's workout from recovery, the sets each muscle still needs this week, and what you lifted last time. After each set, tap how many more reps you could have done, and the next set adapts. Finish with a short review per muscle, which adjusts next week's sets. Your goal (muscle mass, strength or both) can be changed at any time. A set only counts once you tick it. If you did a different amount, tap the amount first, change it, then confirm. Each confirmed set becomes a row in the Notion Workout log, and you can undo it.
- **Progress photos:** there's a camera with a 10-second timer and a faint overlay of last month's photo, so you stand in the same spot. Photos are compressed to under 1 MB and saved in the private Progress photos database in Notion, together with a summary of your lifts.

## 3D body

The body is a simplified export of the [Z-Anatomy](https://github.com/Z-Anatomy/The-blend) atlas (CC BY-SA 4.0, based on BodyParts3D by DBCLS). `tools/export-body-model.py` rebuilds `public/models/body.glb` from Z-Anatomy's `Startup.blend` with Blender's Python module: it merges the skin regions into one glass skin and the muscles into the 11 gym groups. The model file stays under CC BY-SA 4.0 (see `public/models/CREDITS.txt`). If WebGL or the model fails to load, the app falls back to the flat body.

Sounds are synthesized in the browser (`lib/sound.ts`); the footer has a Sound on/off switch.

## Privacy

- The whole app sits behind a passcode. Without the login cookie, every page and API route refuses.
- The Todoist and Notion keys stay on the server and never reach the browser.
- Progress photos are passed through the app behind the passcode, so Notion's file links never reach the browser.
- The app sets `noindex`, so search engines won't list it.

## Deploy on Vercel (about 10 minutes)

1. **Get a Todoist token.** In Todoist go to Settings, then Integrations, then Developer, and copy your API token.
2. **Get a Notion token.**
   - Go to https://www.notion.so/profile/integrations, click **New integration**, choose type *Internal* and name it *Body Map*. Copy the secret.
   - Open the **GVG Brain** page in Notion, click **⋯**, then **Connections**, and add *Body Map*. Its pages, including Expiry Dates, Workout log and Progress photos, become available to the app.
3. **Import the repo into Vercel.** Go to https://vercel.com/new, sign in with GitHub, import `GVG-body-brain`, and keep the defaults (Next.js).
4. **Add the environment variables** before the first deploy. See `.env.example` for the list.
   - `APP_PASSCODE`: the code you'll type to unlock the app.
   - `AUTH_SECRET` (optional): a long random string. If you leave it out, the app signs logins with a key built from your tokens and passcode.
   - `TODOIST_TOKEN` and `NOTION_TOKEN`: the tokens from steps 1 and 2.
5. **Deploy.** Open the URL on your phone and unlock it. On iPhone, choose Share and then *Add to Home Screen*; on Android, choose *Install app*.
6. **Embed it in Notion.** On a Notion page, type `/embed` and paste the URL. Some phones block logins inside embeds. If the embed keeps showing the passcode screen, use the home-screen app on your phone and keep the embed for your laptop.

## Run locally

```bash
cp .env.example .env.local   # fill it in
npm install
npm run dev
```

## Where to change things

- `lib/config.ts`: Notion page and database ids, which Todoist projects map to which body part, and your week schedule.
- `lib/gym.ts`: the exercise library, recovery thresholds, levels, quests and the photo day (first Sunday of the month).
- `lib/today.ts`: what makes a body part glow.
- `lib/coach.ts`: the gym coach. It sets recovery per muscle, weekly set targets through a 6-week block (week 6 is a deload), rep ranges per goal, double progression, and adjusts the next set to how hard the last one felt.

## Google (Gmail and the money sheet)

Read-only. Heart shows mail waiting on your reply (2+ days amber, 7+ red) and mail you sent with no answer after 4 days. Belly shows unfilled months in the Maandtracker and loan repayments that are close or late.

1. [Google Cloud console](https://console.cloud.google.com): create a project, then enable **Gmail API** and **Google Sheets API**.
2. OAuth consent screen: External, add yourself as a test user, then set publishing status to **In production** (in Testing, Google expires the sign-in every 7 days). Signing in will warn that the app is unverified; that's expected for a personal app.
3. Credentials → Create OAuth client ID → Web application. Authorized redirect URI: `https://gvg-body-brain.vercel.app/api/google/callback`.
4. In Vercel add `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` and `GOOGLE_MONEY_SHEET_ID` (the part of the sheet link between `/d/` and `/edit`), redeploy.
5. Unlock the app and tap **Connect Google** in the footer. Copy the token it shows into Vercel as `GOOGLE_REFRESH_TOKEN`, redeploy.
6. Optional: tap **Add second Google account**, sign in with the other account and save its token as `GOOGLE_REFRESH_TOKEN_2`. Heart then shows mail from both inboxes.
