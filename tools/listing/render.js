/**
 * Draws the WordPress.org listing art into .wordpress-org/ (icon-128x128.png, icon-256x256.png, icon.svg,
 * banner-772x250.png, banner-1544x500.png) from art.html. Needs Playwright with Chromium and the Inter font.
 *     node tools/listing/render.js
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const OUT = path.resolve(__dirname, '../../.wordpress-org');
fs.mkdirSync(OUT, { recursive: true });
const ART = 'file://' + path.join(__dirname, 'art.html');
(async () => {
	const b = await chromium.launch();
	const shot = async (art, w, h, scale, file) => {
		const p = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: scale });
		await p.goto(ART + '?art=' + art);
		await p.evaluate(() => document.fonts.ready);
		await p.locator('.' + art).screenshot({ path: path.join(OUT, file), omitBackground: art === 'icon' });
		await p.close();
		console.log('  ' + file);
	};
	await shot('icon', 128, 128, 1, 'icon-128x128.png');
	await shot('icon', 128, 128, 2, 'icon-256x256.png');
	await shot('banner', 772, 250, 1, 'banner-772x250.png');
	await shot('banner', 772, 250, 2, 'banner-1544x500.png');
	await b.close();
	// The icon as a vector too (WordPress.org prefers it where it can).
	fs.writeFileSync(path.join(OUT, 'icon.svg'), '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><defs><linearGradient id="b" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#8d5dd9"/><stop offset=".55" stop-color="#7a48d1"/><stop offset="1" stop-color="#5b2fb8"/></linearGradient><radialGradient id="h" cx=".85" cy="0" r=".7"><stop offset="0" stop-color="#c4b1fd"/><stop offset="1" stop-color="#c4b1fd" stop-opacity="0"/></radialGradient><linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".18"/><stop offset=".42" stop-color="#fff" stop-opacity="0"/></linearGradient></defs><rect width="256" height="256" fill="url(#b)"/><rect width="256" height="256" fill="url(#h)"/><rect width="256" height="256" fill="url(#s)"/><g transform="translate(48 48) scale(4)" fill="#fff"><rect x="16.4" y="1.6" width="7.2" height="36.8" rx="3.2" transform="rotate(-45 20 20)"/><path d="M20,0.8 L26.4,11.2 L23.2,11.2 L23.2,39.2 L16.8,39.2 L16.8,11.2 L13.6,11.2 Z" transform="rotate(45 20 20)"/></g></svg>\n');
	console.log('  icon.svg');
})();
