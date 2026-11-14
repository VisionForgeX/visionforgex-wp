=== VisionForgeX – Ad Management & Yield ===
Contributors: visionforgex
Tags: ads, ad manager, ads.txt, header bidding, adsense alternative
Requires at least: 6.3
Tested up to: 7.1
Requires PHP: 7.4
Stable tag: 1.0.0
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Connect your site to VisionForgeX in one click: your ad tag and ads.txt lines go in place by themselves, and you manage your ads from WordPress.

== Description ==

VisionForgeX runs ads for publishers through Google Ad Exchange, Prebid and its own exchange. This plugin connects your WordPress site to your VisionForgeX account and does the setup for you:

* **Your tag on every page.** No theme editing, no copy and paste. It survives theme changes and updates.
* **Speed plugins handled.** The tag carries the attributes WP Rocket, LiteSpeed Cache, Autoptimize, Perfmatters, SiteGround Optimizer and Cloudflare honour, so it is never delayed or combined.
* **ads.txt kept right.** Every line VisionForgeX needs is added next to your own lines, never removing anyone else's. With no ads.txt file on your server, WordPress answers /ads.txt itself; with a real file, the plugin keeps its lines in a marked block at the end.
* **Go live checklist.** The plugin loads your home page and ads.txt the way a visitor does and tells you what it found: the tag there and not delayed, ads.txt complete, HTTPS. VisionForgeX checks your ads.txt at the same moment, so your account turns green in seconds.
* **Pause all ads** in one click, for emergencies. It works even when VisionForgeX cannot be reached.
* **Safe by design.** Nothing is fetched while visitors load your pages: the plugin prints your tag from a copy kept in WordPress. A staging or local copy of your site stays quiet. Uninstalling puts everything back.

There is no reporting in the plugin: your earnings and reports stay on your VisionForgeX dashboard, one click away.

You need a VisionForgeX account. If you do not have one, you can sign up when you click Connect; new sites are reviewed by VisionForgeX before ads show.

The readable source of the dashboard (React, built with esbuild) is in the plugin's `src/` folder and at https://github.com/VisionForgeX/visionforgex-wp.

== External services ==

This plugin connects your site to **VisionForgeX** (https://visionforgex.com), the ad service it is made for. Nothing is sent before you click **Connect with VisionForgeX**.

* **When you click Connect**, your browser goes to visionforgex.com with this site's address and name, and the WordPress, PHP and plugin versions. After you sign in and allow the site, the plugin receives a key for this site only.
* **Twice a day**, the plugin asks VisionForgeX for this site's tag and ads.txt lines.
* **Once a day and when you run the check**, the plugin sends the result of its site check (tag found, ads.txt complete, HTTPS) and the WordPress, PHP and plugin versions. VisionForgeX then loads your site's /ads.txt to check it.
* **On every page of your site** (once VisionForgeX has approved it), the plugin loads your VisionForgeX tag from VisionForgeX's content delivery network and Google's Publisher Tag (securepubads.g.doubleclick.net), which show the ads.

No posts, users, visitors or personal data are sent by the plugin. Your visitors' browsers talk to VisionForgeX and Google when the ads load, as with any ad tag.

VisionForgeX: [Terms](https://visionforgex.com/terms) · [Privacy policy](https://visionforgex.com/privacy/). Google: [Terms](https://policies.google.com/terms) · [Privacy policy](https://policies.google.com/privacy).

== Installation ==

1. Install and activate the plugin from Plugins → Add New.
2. Open **VisionForgeX** in the WordPress menu and click **Connect with VisionForgeX**.
3. Sign in (or sign up), allow the site, and you are back in WordPress, connected. The Go live checklist shows what is left.

== Frequently Asked Questions ==

= Do I need a VisionForgeX account? =

Yes. You can create one when you click Connect. New sites are reviewed before ads show, usually within a day.

= Will it remove my AdSense or other lines from ads.txt? =

No. Your lines stay exactly as they are. The plugin only adds and updates its own lines, in their own marked block.

= What happens if VisionForgeX is down? =

Your site and its ads carry on: the plugin never calls VisionForgeX while a visitor loads a page. The dashboard says it cannot reach VisionForgeX and that nothing has changed on your site.

= What happens on a staging copy of my site? =

The plugin recognises staging and local copies (and WordPress's environment type) and keeps the tag and ads.txt changes off there.

= What does uninstalling do? =

It tells VisionForgeX the site let go of its key, takes the plugin's lines out of a real ads.txt file (everyone else's stay), and removes every setting and scheduled job the plugin kept.

= Where are my earnings? =

On your VisionForgeX dashboard. The plugin's Home screen has an "Open your reports" button.

== Screenshots ==

1. Connect with VisionForgeX in one click.
2. Home: status, Pause all ads, and the site at a glance.
3. Go live: the checklist the plugin runs itself.
4. ads.txt: VisionForgeX's lines next to yours.
5. Dark mode, and on a phone.

== Changelog ==

= 1.0.0 =
* First release: Connect with VisionForgeX (sign-in or sign-up, no keys to copy), the tag on every page kept off speed plugins, ads.txt served or merged, the Go live checklist and daily site check, Pause all ads, light and dark dashboard, clean uninstall.
