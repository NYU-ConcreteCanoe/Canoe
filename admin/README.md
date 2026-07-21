# Admin panel — setup and workflow

The admin panel lets team members edit site content through a form at
`/admin/`. Every save opens a **pull request**. Nothing reaches the live site
until someone with merge rights approves it.

There is no server and no database. The GitHub repo is the database, and
GitHub Pages redeploys automatically when a PR is merged.

---

## What editors can change

| Section | File it writes | Includes |
|---|---|---|
| Announcements | `assets/data/announcements.json` | Text, optional image, optional link, pinning |
| Canoe Timeline | `assets/data/canoes.json` | Year, name, description, tags, photos |
| Team Roster | `assets/data/team.json` | Names, roles, headshots |

Nothing else is reachable. An editor **cannot** touch HTML, CSS, JS, page
layout, or the navigation through this interface — those files are simply not
declared in `config.yml`, so the panel has no way to open them.

---

## One-time setup

One value in `config.yml` is still a placeholder: `base_url`.

The repo is already set to `nyu-concretecanoe/Canoe`, which is what GitHub
Pages serves. A local clone's `origin` may point at a personal fork — that does
not matter, the panel targets the repo named in `config.yml`.

### 1. Deploy the OAuth worker

GitHub's token exchange requires a client secret, which cannot live in a
browser. A ~30-line Cloudflare Worker handles the handshake. It is free and
you do not need a credit card.

1. Deploy https://github.com/sveltia/sveltia-cms-auth (has a one-click button).
2. On GitHub: **Settings → Developer settings → OAuth Apps → New OAuth App**.
   - Homepage URL: your site URL
   - Authorization callback URL: `https://<your-worker>.workers.dev/callback`
3. In the Worker's settings, add environment variables:
   - `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` from step 2
   - `ALLOWED_DOMAINS` — the hostname serving the site
4. Put the Worker URL in `config.yml` as `base_url`.

> **Note on `ALLOWED_DOMAINS`:** it matches on hostname only. On a project site
> the host is `<org>.github.io`, which is shared with every other repo under
> that account — it cannot be scoped to `/Canoe`. A custom domain avoids this.

### 2. Set permissions

This is where the "who can do what" rules live. Use GitHub's own roles rather
than building anything custom.

| Role | GitHub access | Can do |
|---|---|---|
| Editor (students, advisor) | **Write** | Log in, edit, open PRs. Cannot merge. |
| Maintainer (you) | **Admin** | Review and merge PRs. |

Then turn on branch protection so Write access alone cannot publish:

**Settings → Branches → Add rule** for `main`:
- Require a pull request before merging
- Require approvals: **1**

Without this rule, anyone with Write access can merge their own PR and the
review step is advisory only.

---

## Day-to-day workflow

Adding photos, from the professor's point of view:

1. Go to `/admin/`, click **Log in with GitHub**.
2. Open **Canoe Timeline**, find the year, click it.
3. Under **Photos**, click **Add** and select images. They are resized and
   converted to WebP in the browser before upload.
4. Click **Save**, then set status to **In Review**.
5. A PR appears in the repo. Someone with Admin merges it.
6. GitHub Pages rebuilds. The photos are live in a minute or two.

Nobody involved touches code, and step 5 is the safety gate.

---

## Known rough edges

**Uploads do not automatically land in per-year folders.** Existing photos live
in `assets/img/canoes/<year>/`. New uploads through the panel go to the
collection root, `assets/img/canoes/`, because the upload destination is fixed
per collection and cannot be derived from the year field being edited.

This does not break anything — `canoes.json` stores explicit paths, so photos
work from either location. But the tidy per-year convention will erode over
time. Three options:

1. Accept it. Least effort, some untidiness.
2. A maintainer moves files into year folders periodically and updates the
   paths. Tidy, but manual.
3. Split into one collection per year in `config.yml`, each with its own
   `media_folder`. Fully automatic, but the panel then shows ~18 entries and
   adding a new season means editing `config.yml`.

**Images are permanent.** Git history cannot be pruned casually. A deleted
photo still occupies space forever, and GitHub Pages caps a published site at
1 GB. The browser-side resizing in `config.yml` (WebP, max 2000px, 8 MB
rejection ceiling) is what keeps this sustainable — do not remove it.

**Pages rate limit.** Branch-deploy Pages allows ~10 builds/hour. Merging many
PRs quickly can hit that and delay deploys. Batching merges avoids it.

**Sveltia CMS is pre-1.0** and has a single maintainer. It is config-compatible
with Decap CMS, so the exit path is swapping the `<script>` tag in
`admin/index.html` — the same `config.yml` works with both.
