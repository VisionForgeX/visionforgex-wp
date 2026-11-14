# Working on the VisionForgeX plugin for WordPress

"VisionForgeX – Ad Management & Yield" (slug `visionforgex`), published on WordPress.org. This repository is
**public**: it holds only what runs inside WordPress. Every decision (what to serve, floors, demand, ads.txt lines,
which features an account may manage) is made by the platform, in the private repository `VisionForgeX/visionforgex`
(`site/public_html/admin/wp-connector-lib.php`, `api/v1/wordpress/`, `publisher/connect.php`), and arrives as settings.
Never put a decision, a threshold chosen for revenue, a key, an account or a customer's name here. The plugin and its
listing never use any name but VisionForgeX.

## Read first
1. The platform's `docs/WP-PLUGIN-PLAN.md` — the plan, its phases and the owner's decisions.
2. `README.md` (layout, protocol) and `CHANGELOG.md`.
3. The platform's `docs/BLUEPRINT.md`, feature 57.

## Standing rules
- **Push after every change**, with a CHANGELOG line (and `readme.txt`'s changelog for a release). Bump `Version` in
  `visionforgex.php`, `VISIONFORGEX_VERSION`, `Stable tag` together.
- **Never break a live site.** No remote call on a visitor's page load; the front end prints from stored copies. Every
  new feature is off until switched on. A staging copy stays quiet.
- **The protocol is a contract**: a change to the string to sign, the calls or the snapshot is made on the platform too,
  in the same piece of work (the platform's `tests/wp-connector/engine.php` compares the string to sign with this file).
- **WordPress.org rules**: prefix `visionforgex_` / `VisionForgeX_` / `visionforgex/v1`; GPL; nothing sent before
  Connect (listed in `readme.txt` → External services); no admin ads or nags; WordPress's own React, not a copy;
  nothing locked in code; `phpcs` (WordPress standard, `phpcs.xml.dist`) clean.
- **Design**: same tokens as the platform (`#8d5dd9` → `#a78bfa`, 14 px radius, the spring easing), light and dark,
  phone, reduced motion; every rule scoped to `.vfx-app`.
- **Test what you change**: `bash tests/setup.sh <WordPress> 8180 > /tmp/setup.log` then `node tests/e2e.js`, against
  the platform's test servers. Never report a pass you did not watch. Rebuild (`npm run build`) after any `src/` change.
- Publisher-facing wording says VisionForgeX and support@visionforgex.com.
