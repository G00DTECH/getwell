# Get Well Soon 💛

A warm, single-page get-well site with three parts:

1. **GoFundMe spotlight** — big donate card with a progress bar (or paste GoFundMe's own embed).
2. **About section** — his story + a photo gallery.
3. **The Get-Well Wall** — friends & family post wishes that appear **instantly** for everyone, powered by [Supabase](https://supabase.com) (free tier).

You can open `index.html` right now and it works in **preview mode** (wishes save in your own browser only). Do the two steps below to make it real.

---

## Step 1 — Add your content

Search `index.html` for these placeholders and replace them:

- `[FRIEND'S NAME]` — his name (appears several times).
- The About paragraphs.
- The GoFundMe link: `https://www.gofundme.com/YOUR-CAMPAIGN`.
- The progress numbers: `data-raised="8250" data-goal="20000"` and the matching `$8,250 raised` / `$20,000 goal` text.

Drop photos into the `photos/` folder named:
`hero.jpg`, `about-1.jpg`, `gallery-1.jpg` … `gallery-4.jpg`.
(Until you do, friendly placeholders show up automatically.)

> Prefer GoFundMe's official widget? On your campaign page: **Share → Add to your website**, copy the embed code, and paste it into the marked spot in the Donate section (you can delete the custom card).

---

## Step 2 — Turn on the live Wishes Wall (Supabase)

1. Create a free account at **supabase.com** → **New project**. Pick any name & password.
2. In the left sidebar go to **SQL Editor**, paste the block below, and click **Run**:

```sql
-- Table to hold get-well wishes
create table public.wishes (
  id          bigint generated always as identity primary key,
  name        text not null check (char_length(name) between 1 and 60),
  message     text not null check (char_length(message) between 1 and 600),
  created_at  timestamptz not null default now()
);

-- Lock it down, then allow exactly what the public page needs
alter table public.wishes enable row level security;

-- Anyone can READ wishes
create policy "wishes are public to read"
  on public.wishes for select
  to anon using (true);

-- Anyone can ADD a wish (but not edit or delete)
create policy "anyone can post a wish"
  on public.wishes for insert
  to anon with check (true);
```

3. Turn on live updates: **Database → Publications → `supabase_realtime`** → toggle the **`wishes`** table on.
4. Get your keys: **Project Settings → API**. Copy the **Project URL** and the **anon / public** key.
5. Paste them into `config.js`:

```js
window.GETWELL_CONFIG = {
  SUPABASE_URL: "https://xxxx.supabase.co",
  SUPABASE_ANON_KEY: "eyJhbGciOi...",
};
```

That's it — reload the page and wishes are now permanent, shared, and live.

> **Is it safe to put the anon key in the code?** Yes. It's designed to be public. The Row Level Security policies above are what actually control access: the public can only read wishes and add new ones — nothing else.

### Deleting spam / bad posts
Open your Supabase project → **Table Editor → wishes** → select a row → delete. It disappears from the wall.

---

## Step 3 — Publish

This is a plain static site, so any host works. Easiest: drag this folder onto **netlify.com/drop**, or push to GitHub and connect it to Netlify. No build step, no `netlify.toml` needed.

---

## Files

| File | What it is |
|------|-----------|
| `index.html` | The page + all content placeholders |
| `styles.css` | All styling |
| `app.js` | Progress bar + wishes wall logic |
| `config.js` | Your Supabase keys (safe to commit) |
| `photos/` | Drop his photos here |
