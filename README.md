# Get Well Soon, Sean 💛

A warm, single-page site with three parts:

1. **GoFundMe spotlight** — donate card linking to Sean's campaign.
2. **Sean's Story** — his bio + a photo gallery.
3. **The Wall** — a giant collaborative mosaic. Anyone can claim a 400×400 tile, **paint** on it (a mini MS-Paint) or **upload a photo**, and it drops into place. Hundreds of tiles form one chaotic, beautiful piece. Powered by [Supabase](https://supabase.com) (free tier).

Open `index.html` right now and it works in **preview mode** (your tiles save to your own browser only). Do the setup below to make the wall real and shared.

---

## Content — already filled in

Sean's name, story, the GoFundMe link, and photos are all in place. To swap or add photos, drop files in `photos/` named `hero.jpg`, `about-1.jpg`, and `gallery-1.jpg` … `gallery-4.jpg`.

---

## Setup — turn on the live Wall (about 10 min)

The wall needs a place to store tile images and a table to track them. Both live in one free Supabase project.

### 1. Create the project
Sign up at **supabase.com** → **New project** (any name & password).

### 2. Create the table
Left sidebar → **SQL Editor** → paste and **Run**:

```sql
create table public.tiles (
  id          bigint generated always as identity primary key,
  name        text not null check (char_length(name) between 1 and 60),
  message     text check (char_length(message) <= 200),
  image_url   text not null,
  created_at  timestamptz not null default now()
);

alter table public.tiles enable row level security;

create policy "tiles are public to read"
  on public.tiles for select to anon using (true);

create policy "anyone can add a tile"
  on public.tiles for insert to anon with check (true);
```

### 3. Create the image storage bucket
Left sidebar → **Storage** → **New bucket** → name it exactly **`tiles`** → toggle **Public bucket ON** → save.

Then let visitors upload into it: **SQL Editor** → paste and **Run**:

```sql
-- anyone can upload a tile image
create policy "anyone can upload a tile image"
  on storage.objects for insert to anon
  with check (bucket_id = 'tiles');

-- anyone can view tile images
create policy "tile images are public"
  on storage.objects for select to anon
  using (bucket_id = 'tiles');
```

### 4. Turn on live updates
**Database → Publications → `supabase_realtime`** → toggle the **`tiles`** table on. (New tiles then appear for everyone without a refresh.)

### 5. Add your keys
**Project Settings → API** → copy the **Project URL** and **anon / public** key into `config.js`:

```js
window.GETWELL_CONFIG = {
  SUPABASE_URL: "https://xxxx.supabase.co",
  SUPABASE_ANON_KEY: "eyJhbGciOi...",
};
```

Reload the page — the wall is now live and shared. 🎉

> **Is the anon key safe to publish?** Yes, it's meant to be public. The policies above are the real guardrails: visitors can only read tiles and add new ones — nothing else.

---

## Moderating the wall

Because tiles appear instantly on a public link, keep the dashboard handy:

- **Remove a bad tile:** Supabase → **Table Editor → tiles** → delete the row. (Optionally also delete the file under **Storage → tiles**.)
- Want tiles to require your approval *before* showing instead? Tell Claude and it'll switch the wall to approval-first.

---

## Publish

Already connected to Netlify via the `G00DTECH/getwell` GitHub repo — every push auto-deploys. No build step needed.

---

## Files

| File | What it is |
|------|-----------|
| `index.html` | The page + all content |
| `styles.css` | All styling |
| `app.js` | Paint tool, photo upload, mosaic wall, lightbox |
| `config.js` | Your Supabase keys (safe to commit) |
| `photos/` | Sean's photos |
