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
- **Gym:** the app plans today's workout from the muscles that have recovered. A set only counts once you tick it. If you did a different amount, tap the amount first, change it, then confirm. Each confirmed set becomes a row in the Notion Workout log, and you can undo it.
- **Progress photos:** there's a camera with a 10-second timer and a faint overlay of last month's photo, so you stand in the same spot. Photos are compressed to under 1 MB and saved in the private Progress photos database in Notion, together with a summary of your lifts.

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
   - `AUTH_SECRET`: a long random string. Run `openssl rand -hex 32`, or mash the keyboard for 40+ characters.
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
