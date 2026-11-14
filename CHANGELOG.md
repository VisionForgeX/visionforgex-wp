# Changelog

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
