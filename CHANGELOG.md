# Changelog

## 1.2.2 — 20 Nov 2026

The first release on WordPress.org (approved 20 Nov 2026), with the review's last note.

- **ads.txt**: `get_filesystem_method()` and `WP_Filesystem()` are given the folder ads.txt goes in (the root of the
  site's address) as their context, not `ABSPATH`: when WordPress's files are in a sub-folder the two folders can have
  different owners and permissions. With no such folder known, the plugin does not write (as before: the lines are
  shown to add by hand).

## 1.2.1 — 19 Nov 2026

The WordPress.org review's three points.

- **The description** said nothing is fetched while visitors load pages, and also that visitors' browsers load the tag:
  now it says the server makes no remote call on a page load, and the browser loads the tag from VisionForgeX's CDN
  and Google's ad scripts (readme.txt, and the dashboard's "Safe by design" line).
- **ads.txt at the root of the site's address**, not WordPress's own folder (`ABSPATH`): when WordPress's files are in
  a sub-folder (two addresses in Settings → General), the folder above them; `VISIONFORGEX_ADSTXT_DIR` in wp-config.php
  (or the `visionforgex_adstxt_dir` filter) names it; when it cannot be told, nothing is written and the dashboard shows
  the lines to add by hand.
- **No `<style>` or `<script>` printed by the plugin any more**: the page facts and consent bridge, the kept-space CSS,
  the selector spots, the visual editor's picker and the Network Admin page all go through `wp_register_*` +
  `wp_add_inline_script` / `wp_add_inline_style` (the page facts still come before the tag; the speed-plugin attributes
  through `wp_inline_script_attributes`).

## 1.2.0 — 14 Nov 2026

Phases 3, 4 and 5 of the plan: placement by WordPress, signals, the tools for many sites, and the listing.

- **In-content ads placed by WordPress** (off until switched on): after paragraph N, then every N, at most N per post,
  only in posts of at least N paragraphs, or before headings; chosen post types; a banner, native or an Ad Tag. Top-level
  paragraphs only: never inside a table, list, quote, figure, code, embed or form. Each spot keeps the height of its ad
  (CSS variables from the sizes it can show, phone and wider), so the page does not move when the ad arrives: layout
  shift measured at 0 with it, and above 0.05 without, in the tests.
- **Theme spots** through WordPress's hooks (top, after the title in block themes, before and after the content,
  before the comments, footer), each on chosen pages. **Your own spots** on any CSS selector, before, after or inside
  it, placed by a few lines at the end of the page.
- **The visual editor**: the site's own page inside the dashboard (`?vfx_pick=`, administrators with a valid code only,
  tag off, links inert); hover outlines, a click gives the element's selector, the spot is drawn at once.
- **A warning when spots would not load** (VisionForgeX placing ads automatically), with one-click switches.
- **Privacy & signals**, each off until switched on, the switches kept on VisionForgeX: the **consent bridge**
  (`window.vfxConsent` from WP Consent API, Complianz, CookieYes, Cookiebot, Borlabs Cookie or Google consent mode,
  following later answers), **page facts** (`window.vfxPage`: categories, tags, author, type, length; "Sensitive
  content" and "Fewer ads" from each post's box), **test ads for administrators** (`window.vfxQa`). Tag 1.48.0 reads
  them (platform).
- **Publish events**: a post published reaches VisionForgeX in the background (Page targeting, Return Reader, Next Read).
- **Instant sync**: `POST visionforgex/v1/push`, signed by VisionForgeX with the site's key (time, nonce used once,
  body hash): sync, clear the caches, run the site check.
- **WP-CLI** (`wp visionforgex status|connect-url|sync|check|pause|resume|adstxt|spots|import-adinserter|diagnostics|
  disconnect`), **Multisite** (network activation, new sites get their jobs, Network Admin → VisionForgeX, one ads.txt
  per network kept by the main site, uninstall on every site), **staging addresses** (Settings, `*.example.com`),
  **import from Ad Inserter** (both storage formats; spots made switched off; ad code never copied).
- **Where ads show**: tags, authors and page templates.
- **Fixed** in testing before release: the four new dashboard routes were not registered; the tag, author and template
  rules were not saved; a post with no author gave an empty author fact.
- **Listing**: icon, banners and screenshots (`tools/listing/`), the release zip (`tools/build-zip.sh`).

## 1.1.0 — 14 Nov 2026

Phase 2 of the plan: the controls.

- **Formats**: banner (sizes, sticky), native, anchor (top or bottom), interstitial (its moments), rewarded (the prompt's
  words, how often, can it be closed), refresh (every 30–600 s, how many times), how ads are placed (automatic, your own
  spots, both), ads per page, space between ads, the ad label. Changed on VisionForgeX through a signed call: the
  platform decides what may change and checks every value (the same rules as the publisher's own dashboard); a format
  is switched on only once VisionForgeX has made its ad unit. A save bar counts the changes; Save and publish.
- **Live preview**: a drawing of a page of the site on a phone or a desktop with the formats switched on, the
  interstitial and the rewarded prompt (with its own words) on demand.
- **Ad Tags**: list, add (name, banner or native, sizes), remove; the same Ad Tags as on the VisionForgeX dashboard.
- **The "VisionForgeX ad" block, the `[visionforgex]` shortcode and the VisionForgeX ad widget**, each an Ad Tag or a
  plain banner or native spot, rendered on the server: nothing on a page without the tag, nothing for a removed Ad Tag.
- **Where ads show** (off until switched on): post types, categories, addresses containing a text, anyone logged in,
  chosen roles, paying members (MemberPress, Paid Memberships Pro, Restrict Content Pro, WooCommerce Memberships),
  WooCommerce cart, checkout and account pages (and product pages if chosen). A page matching a rule gets no tag at all.
- **"No ads on this page"**: a box on each post's edit screen, honoured whether or not the rules are on.
- **Site tools**: the speed and cache plugins found, each with the tag kept out of its lists (a switch, the undo) and
  "Clear its cache"; other ad code (Ad Inserter, Advanced Ads, WP QUADS, Ezoic, Mediavine, Raptive, Ads.txt Manager
  plugins; Site Kit's AdSense code; AdSense, Ezoic, Mediavine, Raptive, Monumetric, Amazon or another Ad Manager set-up
  in the home page) with one-click switch-off and Undo; code in the theme reported to remove by hand.
- Sections open from the address (`#formats`, `#adtags`, …). Uninstall also removes the per-post setting.

## 1.0.0 — 14 Nov 2026

First release (phase 1 of the plan: the foundation).

- **Connect with VisionForgeX**: one button; sign in or sign up on visionforgex.com, allow the site, back in WordPress
  connected. A one-time code plus a verifier that never leaves the server (PKCE-style); a key for this site only,
  sealed in the database with the site's own salts.
- **Signed calls** to VisionForgeX (HMAC-SHA256 over method, path, time, nonce and body).
- **The tag** on every page from the stored copy (no remote call on page load), `async`, with the attributes the common
  speed plugins honour, and their exclusion filters; never in feeds, AMP, admin or the REST API; off on staging copies.
- **ads.txt**: served by WordPress when there is no file (with the publisher's own lines and Ads.txt Manager's),
  merged into a real file between markers when there is one, shown to add by hand otherwise.
- **Site check** (loopback): tag found and not delayed (WP Rocket, LiteSpeed, Perfmatters, Flying Scripts), a stale
  page cache, ads.txt complete, HTTPS; reported to VisionForgeX, which checks ads.txt itself.
- **Dashboard** on WordPress's own React: Welcome, Home, Go live, ads.txt, Settings; light and dark; phone; reduced motion.
- **Pause all ads**, Disconnect, Recent changes, Diagnostics; uninstall puts everything back.
