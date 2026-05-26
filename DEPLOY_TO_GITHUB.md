# Deploy AOTR to GitHub Pages

This guide gets your game running on a public URL with **zero local
setup** — no Node, no PowerShell, no firewall issues. GitHub builds it
for you.

End result: a URL like `https://yourname.github.io/aotr/` that works on
phone and desktop.

---

## What You Need

- A free GitHub account ([sign up here](https://github.com/signup) if
  you don't have one)
- The `AOTR_v0_0_27.zip` file
- A web browser

That's it. No software to install.

---

## Step 1 — Create a New Repository

1. Go to <https://github.com/new>.
2. **Repository name**: `aotr` (or anything you like — your game URL
   will use this name).
3. Set it to **Public**.
4. **Do not** initialize with a README, .gitignore, or license — the
   zip already has those.
5. Click **Create repository**.

You should land on a page that says "Quick setup — if you've done this
kind of thing before". Leave it open in a tab.

---

## Step 2 — Upload the Code

1. Unzip `AOTR_v0_0_27.zip` somewhere on your computer.
2. Open the unzipped folder. You should see `index.html`,
   `package.json`, `public/`, `src/`, and so on at the top level. If
   instead you see another folder inside (like
   `aotr_v0.0.27/aotr_v0.0.27/index.html`), navigate into the inner
   folder.
3. Back on the GitHub repository page, click the **uploading an
   existing file** link.
4. Drag the **contents** of the unzipped folder (not the folder itself)
   into the upload area. All files and subfolders.
5. Wait for them to finish uploading (the audio file is the largest at
   ~1.4 MB; should take a few seconds on a normal connection).
6. Scroll down. In the commit-message box write something like
   `Initial AOTR upload`.
7. Click **Commit changes**.

---

## Step 3 — Enable GitHub Pages

1. In your repository, click **Settings** (top nav).
2. In the left sidebar, click **Pages**.
3. Under **Build and deployment**, set **Source** to **GitHub Actions**.

The repo's `.github/workflows/deploy.yml` will now run automatically on
every push to `main`. It runs `npm install`, `npm run build`, and
deploys the contents of `dist/` to Pages.

---

## Step 4 — Watch the Build

1. Click **Actions** in the top nav of your repository.
2. You should see a workflow named **Deploy AOTR to GitHub Pages**
   running (yellow circle). It takes about a minute.
3. When it turns into a green check, your site is live.
4. Click the workflow run, then click the **deploy** step at the
   bottom. The URL appears under "Deployments" — something like
   `https://yourname.github.io/aotr/`.

Open that URL on any phone or desktop browser and tap **CLICK TO
START**.

---

## Updating the Game

Whenever you change a file on GitHub (or push a commit from a local
clone), the Actions workflow re-runs and Pages updates within a minute.
No manual rebuild needed.

To edit a file:

1. Navigate to the file in your repo.
2. Click the pencil icon (top-right).
3. Make the change, scroll down, click **Commit changes**.

You can also edit the dev panel defaults in `src/config.js` — colors,
lane count, starting speed, etc. — and re-commit to publish.

---

## Troubleshooting

**"LOAD FAILED — TAP TO RETRY" on the loading screen**
Usually means GitHub Pages hasn't finished propagating yet, or the
deploy step failed. Wait two minutes and reload. If it persists, open
DevTools (`F12`) → Network tab and reload — look for a 404 on
`./songs/funky_fusion_bass.m4a`. If you see one, the audio file didn't
upload; re-upload it under `public/songs/`.

**Audio is silent on iPhone**
Tap **CLICK TO START** at least once per session. iOS requires audio
playback to be triggered by a direct user gesture; the click button
satisfies that requirement.

**The build action fails**
Open the Actions tab, click the failed run, click the failed step. The
most common cause is committing `node_modules/` by mistake — the
`.gitignore` excludes it, so just don't include it when you upload. If
you cloned the repo locally, you can `npm install` and `npm run build`
on your own machine to see the same error with more detail.

**Steering keys feel inverted**
They are — by design (see README, "Controls"). If you'd rather flip
them, edit `src/game/input.js`: change `this._emit('lane', +1)` on
ArrowLeft to `-1` and vice versa.
