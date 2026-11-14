# VisionForgeX – Ad Management & Yield (WordPress plugin)

The WordPress plugin that connects a publisher's site to [VisionForgeX](https://visionforgex.com) and runs its ads from
inside WordPress. Published on the WordPress.org plugin directory as **VisionForgeX – Ad Management & Yield**
(slug `visionforgex`). GPLv2 or later.

This repository is **public** and holds only what runs inside WordPress. Every decision (what to serve, floors, demand,
which ads.txt lines, which features an account has) is made by the VisionForgeX platform and arrives as settings.

## Layout

| Path | What |
|---|---|
| `visionforgex.php` | The plugin header and bootstrap |
| `includes/class-visionforgex-store.php` | Options, the sealed key, history, staging detection |
| `includes/class-visionforgex-api.php` | Calls to VisionForgeX, signed (the string to sign is the platform's, byte for byte) |
| `includes/class-visionforgex-connect.php` | Connect (PKCE-style) and Disconnect |
| `includes/class-visionforgex-frontend.php` | The tag on every page, speed-plugin attributes and exclusions |
| `includes/class-visionforgex-adstxt.php` | ads.txt: served, merged into a real file, or by hand |
| `includes/class-visionforgex-health.php` | The site check, the daily and twice-daily jobs, clearing page caches |
| `includes/class-visionforgex-rest.php` | `visionforgex/v1/*` for the dashboard (administrators only) |
| `includes/class-visionforgex-admin.php` | The menu item and the app's page |
| `includes/class-visionforgex-rules.php` | Where ads show, and the per-post "No ads on this page" box |
| `includes/class-visionforgex-placements.php` | The block, the `[visionforgex]` shortcode and the spots they print |
| `includes/class-visionforgex-widget.php` | The VisionForgeX ad widget |
| `includes/class-visionforgex-tools.php` | Site tools: speed and cache plugins, other ad code (switch-off and undo) |
| `src/app/*.jsx` | The dashboard (WordPress's own React, `wp.element`) |
| `src/block/index.jsx` | The block's editor side |
| `assets/build/app.js`, `block.js` | Their builds (`npm run build`), committed so the plugin works straight from a zip |
| `assets/admin.css` | The dashboard's styles, all scoped to `.vfx-app` |
| `uninstall.php` | Puts everything back |

## Build

    npm install
    npm run build          # src/app → assets/build/app.js (esbuild; identifiers kept so translation tools find __())

## Tests

See `tests/README.md`: a real WordPress (any version from the GitHub mirror), the platform's test servers, and a browser.

## The protocol with VisionForgeX

`POST /api/v1/wordpress/?op=exchange` (code + verifier → key), then signed `GET ?op=site`, `POST ?op=health`,
`POST ?op=disconnect`. Headers `X-VFX-Key`, `X-VFX-Time` (±5 minutes), `X-VFX-Nonce` (once only),
`X-VFX-Signature` = hex HMAC-SHA256(secret, `METHOD\nPATH?QUERY\nTIME\nNONCE\nsha256(body)`). Since 1.1:
`POST ?op=settings` `{changes, by}`, `POST ?op=adtag` `{name, format, sizes, by}`, `POST ?op=adtag-delete` `{id, by}`; the
snapshot carries `settings` (formats, refresh, placement, Ad Tags, the sizes on offer). The platform side is
`admin/wp-connector-lib.php` in the private platform repository; change both together.

Support: support@visionforgex.com
