# Changelog

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
