# Editing the website

For NYU Concrete Canoe team members. No coding needed.

Everything happens at **/admin/** on the website. Sign in with GitHub.

Nothing you do goes live immediately. Every change becomes a **pull request**
that someone on the team merges. If you get something wrong, it can be fixed
before anyone sees it, and undone afterwards.

---

## The four things you can edit

| | What it controls |
|---|---|
| **Announcements** | The news strip on the front page |
| **Awards** | Competition results on the Timeline page |
| **Canoe Timeline** | Each year's canoe: name, description, tags |
| **Team Roster** | Names, roles and headshots on the About page |

You cannot break the site's layout or design from here. Those files are not
reachable through the panel.

---

## Posting an announcement

1. Go to **/admin/**, sign in.
2. Click **Announcements**, then **Front Page Announcements**.
3. Under **Posts**, click **Add Post**.
4. Fill in:
   - **Internal ID** - lowercase, no spaces, e.g. `spring-2027-recruiting`.
     Only used behind the scenes, but it must be unique.
   - **Date** - controls the order. Newest appears first.
   - **Category** - news, competition, or recruitment.
   - **Title** and **Body** - two or three sentences is right.
   - **Button link** - optional. Either another page (`contact.html`) or a full
     `https://` address.
   - **Image** - optional.
   - **Pin to top** - keeps it first regardless of date. Use sparingly.
5. Click **Save**, then set the status to **In Review**.
6. Tell someone with merge rights. Once merged, it is live in a couple of
   minutes.

**Deleting a post:** open the same screen, click the bin icon next to the post,
save, and submit for review as above.

The front page shows the most recent posts up to the limit in **Display
Settings**. Old posts stop showing automatically once they fall past it, so
there is no need to delete them for tidiness.

---

## Headshots and the team roster

Headshots are the simplest thing to change, because they all live in one folder.

1. **Team Roster** in the sidebar.
2. **Add Member**, or click an existing one to edit.
3. Fill in **Name** and **Role**.
4. For **Headshot**, click the image field, then **Upload**. Pick the photo
   from your computer.
5. Save and submit for review.

Leave the headshot empty and a placeholder image is used, so it is fine to add
someone before you have their photo.

**Removing someone:** click the bin icon next to their entry. This removes them
from the page. Their photo file stays in the repo, which is harmless; a
maintainer can clear it out later.

**Photo tips:** roughly square works best. Do not worry about file size, the
panel shrinks images automatically before uploading.

---

## Canoe photos

**Read this bit carefully, it is the one awkward part.**

Photos for each canoe live in a folder named after the year, for example
`assets/img/canoes/2015/`. The site finds them automatically: whatever is in
the folder shows up on the timeline. Nobody has to list filenames anywhere.

The catch is that **the admin panel cannot choose which year folder to upload
into.** Anything you upload through the panel lands in
`assets/img/canoes/` instead of the year folder, and the site will not show it.

Nothing is lost when that happens. The build reports those files as `unsorted`,
so they are easy to find. But someone has to move them into the right folder
afterwards.

**So, two ways to add canoe photos:**

**A. Through the panel (easy, needs a follow-up)**
Upload as normal, then ask a maintainer to move the files into the year folder.
Fine for a handful of photos.

**B. Directly on GitHub (no follow-up needed)**
1. Go to the repo, open `assets/img/canoes/`.
2. Click into the year folder, e.g. `2015`. If it does not exist, use **Add
   file > Upload files** and type `2015/` at the start of the filename box to
   create it.
3. **Add file > Upload files**, drag the photos in.
4. Choose **Create a new branch and start a pull request**, then submit.

Option B has no follow-up step, which is why it is worth learning if you are
adding a lot of photos. Resize large photos first; phone photos are often 5 MB
or more, and unlike the panel, GitHub will not shrink them for you.

**Deleting a canoe photo:** open the file on GitHub and use the bin icon, then
open a pull request. Removing the file is enough; the timeline updates itself.

---

## Editing a canoe's text

**Canoe Timeline** in the sidebar. Each entry has a year, name, description and
tags. The description allows basic formatting such as `<strong>bold</strong>`.

To add a new season, click **Add Canoe** and give it the new year. Photos come
from `assets/img/canoes/<year>/` as described above, so a new canoe shows the
year on a plain background until photos are added.

---

## If something looks wrong

- **Change did not appear:** check the pull request was merged. After merging,
  allow a couple of minutes for the site to rebuild.
- **A photo is missing:** it is probably sitting loose in
  `assets/img/canoes/` rather than in a year folder. See above.
- **You cannot sign in:** your GitHub account needs to be added to the repo.
  Ask a maintainer.

When in doubt, submit it for review anyway. Someone checks before it goes live.
