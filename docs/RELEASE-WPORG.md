# Putting the plugin on WordPress.org

For the owner, step by step. No programming needed, but some steps happen in a terminal (the black window where you
type commands). Where a step says "type", type the line exactly and press Enter.

The plugin's name on WordPress.org: **VisionForgeX – Ad Management & Yield**, slug `visionforgex`
(its address becomes `https://wordpress.org/plugins/visionforgex/`).

## What you have

| File | What it is |
|---|---|
| `dist/visionforgex-<version>.zip` | The plugin, exactly as WordPress.org gets it. Made by `bash tools/build-zip.sh`. |
| `.wordpress-org/icon-128x128.png`, `icon-256x256.png`, `icon.svg` | The plugin's icon in the directory. |
| `.wordpress-org/banner-772x250.png`, `banner-1544x500.png` | The banner at the top of the plugin's page. |
| `.wordpress-org/screenshot-1.png` … `screenshot-9.png` | The screenshots, in the order of the captions in `readme.txt`. |
| `walkthrough.mp4` | A one-minute video of the plugin (sent to you separately; it is not part of the listing). |

## Step 1 — Submit the plugin for review (once)

1. Sign in at https://wordpress.org with the VisionForgeX account you created.
2. Open https://wordpress.org/plugins/developers/add/
3. Under "Plugin Name", nothing to type: WordPress.org reads it from the zip.
4. Click **Choose file**, pick `visionforgex-1.2.0.zip`, tick the boxes that you have read the guidelines and that the
   plugin is GPL, and click **Upload**.
5. The page says the plugin is in the queue. Reviews take from a few days to a few weeks. WordPress.org writes to
   the account's e-mail address. **Answer every e-mail from plugins@wordpress.org within 7 days**, or the submission
   is closed. If they ask for a change, forward the e-mail here (to Claude): the change is made, tested, and a new zip
   is built for you to reply with.
6. The slug they confirm should be `visionforgex`. If they suggest another, say that VisionForgeX is the trademark of
   the business and ask to keep it.

## Step 2 — When it is approved: put the code in WordPress.org's SVN

WordPress.org does not use GitHub; it uses its own storage called SVN. The approval e-mail gives the address:
`https://plugins.svn.wordpress.org/visionforgex`. You sign in to it with your WordPress.org username and an
**SVN password** that you set at https://profiles.wordpress.org/ → your profile → **Account & Security** →
"Generate password" under SVN.

On a computer with SVN (Mac: it comes with Xcode's tools; Windows: install TortoiseSVN, and do the same steps with its
right-click menu), type:

    svn checkout https://plugins.svn.wordpress.org/visionforgex vfx-svn
    cd vfx-svn

Then copy the files in:

1. Everything **inside** the zip's `visionforgex` folder goes into `vfx-svn/trunk/`.
2. Everything in `.wordpress-org/` goes into `vfx-svn/assets/`.
3. The release is also copied as a tag (WordPress.org gives visitors the version named "Stable tag" in `readme.txt`):

       svn copy trunk tags/1.2.0

4. Tell SVN about the new files and send them:

       svn add --force trunk assets tags
       svn propset svn:mime-type image/png assets/*.png
       svn propset svn:mime-type image/svg+xml assets/icon.svg
       svn commit -m "VisionForgeX – Ad Management & Yield 1.2.0" --username <your WordPress.org username>

   It asks for the SVN password from above. A few minutes later the plugin's page shows the new version.

## The first upload, on Windows with TortoiseSVN (1.2.2, 20 Nov 2026)

Approved on 20 Nov 2026. Claude sends `visionforgex-wordpress-org-1.2.2.zip`: the three folders already laid out
(`trunk` = the plugin, `tags/1.2.2` = the same files as the release, `assets` = banner, icon and screenshots).

1. SVN password: wordpress.org, signed in as `visionforgex` → Edit Profile → **Account & Security** → SVN password →
   Generate. Keep it private.
2. Install TortoiseSVN (tortoisesvn.net, free). It adds SVN to the right-click menu.
3. Make an empty folder (e.g. `visionforgex-svn`), right-click inside it → **SVN Checkout** → URL of repository
   `https://plugins.svn.wordpress.org/visionforgex` → OK. Three empty folders appear: assets, tags, trunk.
4. Unzip Claude's zip into that folder; when Windows asks, replace the folders.
5. Right-click inside the folder → **TortoiseSVN → Add…** → tick everything (Select all) → OK.
6. Right-click → **SVN Commit…** → message `VisionForgeX – Ad Management & Yield 1.2.2` → OK. Username
   `visionforgex` (case-sensitive), the SVN password from step 1. Wait for "Completed".
7. A few minutes later https://wordpress.org/plugins/visionforgex/ shows the plugin. Search can take up to 72 hours.

## Each later release

Claude builds the new zip and updates `readme.txt` (with the new "Stable tag"). You then: `svn update`, replace the
files in `trunk/` with the new ones, `svn copy trunk tags/<new version>`, `svn add --force trunk tags`, and
`svn commit -m "<new version>"`. Screenshots and banners change only when `assets/` is touched.

## The video

WordPress.org shows a video when `readme.txt` links one. Upload `walkthrough.mp4` to the VisionForgeX YouTube channel,
then add its address on its own line under `== Description ==` in `readme.txt` (Claude can do that: send the link).

## Things that stay true

- The plugin and its page use no name but **VisionForgeX**, and support@visionforgex.com for help.
- No ads or nags in the WordPress admin, nothing sent before Connect, everything off until switched on: these are
  WordPress.org's rules, and the reason the review should be smooth.
