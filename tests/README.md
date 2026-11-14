# Tests

A real WordPress, the real plugin, the platform's test server and a browser.

1. The platform's test servers: in `VisionForgeX/visionforgex`, `tests/sync-site.sh` then `tests/start-servers.sh`
   (8097), with MariaDB running.
2. `127.0.0.1 wpdemo-vfx.com www.wpdemo-vfx.com` in `/etc/hosts` (a made-up domain that does not look like staging).
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

Passed on WordPress 7.1.4, 6.8.3 and 6.3 with PHP 8.3 (14 Nov 2026). Not proven here: PHP 7.4 (not installed; the
code uses nothing newer and the coding-standards check is set to 7.4+), real hosts and caching plugins, HTTPS sites,
the "your site is live" moment (needs HTTPS), and WordPress.org's own Plugin Check (not reachable from the workspace;
`phpcs` with the WordPress standard is clean instead).
