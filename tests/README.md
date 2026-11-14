# Tests

A real WordPress, the real plugin, the platform's test server and a browser.

1. The platform's test servers: in `VisionForgeX/visionforgex`, `tests/sync-site.sh` then `tests/start-servers.sh`
   (8097), with MariaDB running.
2. `127.0.0.1 wpdemo-vfx.com www.wpdemo-vfx.com wpnet-vfx.com` in `/etc/hosts` (a made-up domain that does not look like staging).
3. WordPress from the GitHub mirror (wordpress.org downloads are not reachable from Claude's workspace):
   `git clone --depth 1 --branch 7.1.4 https://github.com/WordPress/WordPress /tmp/wp-7.1.4`, and WP-CLI
   (`WP_CLI=/path/to/wp-cli.phar`).
4. `bash tests/setup.sh /tmp/wp-7.1.4 8180 > /tmp/setup.log` — a fresh site in `tests/.wp/8180` with the plugin copied
   in as a site gets it (`.distignore`), served by PHP's built-in server with 4 workers (the site check loads the site
   from itself). Send its output to a file: the server it starts keeps a pipe open.
5. `node tests/e2e.js` (`WP_PORT=8181` for another copy) — 64 checks: Welcome and what is sent; Connect through the
   platform's real connect page (Add and allow); the key sealed and not autoloaded; In review (ads.txt served, no tag);
   approved and synced (both scripts in the head with every attribute, async once, articles, not in feeds); the Go live
   checklist (HTTPS honestly flagged on this http site); Home without money; Pause all ads and back; the publisher's own
   ads.txt lines; a real ads.txt file merged once and kept; a wrong signature refused and a real signed call; dark and a
   390 px phone; Disconnect (the platform lets go, our block out of their file); a stale link and Cancel; uninstall.
   Screenshots in `tests/shots/`. It puts the platform's files back when it ends.

6. `node tests/e2e2.js` (after a fresh `setup.sh`) — 58 checks, phase 2: Formats changed on VisionForgeX through the
   plugin (the save bar, the preview with sizes, the anchor, sticky and the rewarded prompt; the platform's file changed
   only where asked; logged by name; refresh under 30 s, a format without its ad unit and a size not on the list refused;
   settings it does not offer ignored); Ad Tags (made, listed with the shortcode, removed); the shortcode, block and
   widget printing the spot (nothing for a removed or unknown Ad Tag); the block in the editor with the Ad Tags; the
   per-post box; Where ads show (off by default; category, address, logged in; "No ads on this page" with the rules off);
   Site tools with **real Autoptimize and LiteSpeed Cache** (cloned from GitHub into `PLUGINS`, default
   `/tmp/claude-0/wpplugins`): our scripts untouched while Autoptimize combines and LiteSpeed delays the site's own, the
   site check green, the switch and its undo; other ad code (an AdSense script in the page; stand-ins named as such for
   Ad Inserter and Site Kit): deactivate after a confirmation and Undo, Site Kit's AdSense setting off and back; 390 px on
   the four new screens; no JavaScript error or PHP notice.

7. `node tests/e2e3.js` (after a fresh `setup.sh`) — 147 checks, phases 3 and 4: in-content ads (placed after the right
   paragraphs, never in a table or quote, none in short posts or lists, the kept height) with **layout shift measured**
   (0 with the space kept, above 0.05 without) and the mode warning; theme spots (after the title, after the content on
   posts only); the visual editor (the page in a frame without the tag or admin bar, links inert, hover, a click gives a
   selector that finds exactly the element, the spot drawn, saved, in place for a visitor; the link useless to a visitor
   or with a wrong code); the consent bridge with each banner's real cookie format and consent mode, and a later answer;
   page facts, the post box, archives; publish events reaching the platform (not drafts, not updates); test ads for
   administrators only; **instant sync** through the platform's real cron job (`tests/helpers/platform.php`), then a
   captured signed push replayed, re-signed, altered, late, unsigned and with another key, all refused; staging
   addresses; tag, author and template rules; the Ad Inserter import in both storage formats, odd stored data included;
   WP-CLI; 390 px; disconnect. Then **a multisite network** of its own (`MULTISITE=1 tests/setup.sh`, at
   `http://wpnet-vfx.com` on port 80: add it to `/etc/hosts`; `NO_NETWORK=1` skips it): network activation, a new site's
   jobs, one ads.txt per network, Network Admin → VisionForgeX, network deactivation and uninstall on every site.

Phase 1 passed on WordPress 7.1.4, 6.8.3 and 6.3; phase 1, 2, 3 and 4 again on 7.1.4 and 6.3, with PHP 8.3 (14 Nov 2026).
Not proven here: WP Rocket, Perfmatters and SiteGround Optimizer running (WP Rocket's source needs Composer packages
this workspace cannot fetch; the other two are not public), the real Ad Inserter, Site Kit and membership plugins. Not proven here: PHP 7.4 (not installed; the
code uses nothing newer and the coding-standards check is set to 7.4+), real hosts and caching plugins, HTTPS sites,
the "your site is live" moment (needs HTTPS), real consent banners (their cookies are written by hand, in the formats
the plugins document), a sub-domain network, and a site whose page cache is not cleared by the plugins it knows, and WordPress.org's own Plugin Check (not reachable from the workspace;
`phpcs` with the WordPress standard is clean instead).
