/*
 * The plugin end to end, in a real WordPress and a real browser, against the platform's test server.
 *
 *   bash tests/setup.sh <WordPress folder> 8180 > /tmp/setup.log    (a fresh WordPress with the plugin active)
 *   node tests/e2e.js
 *
 * Needs the platform's test servers (visionforgex/tests/start-servers.sh, 8097) and its test site copy
 * (PLATFORM_DIR, default ../visionforgex/tests/site/public_html), Playwright with Chromium, and
 * "127.0.0.1 wpdemo-vfx.com" in /etc/hosts. Screenshots go to tests/shots/.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const PORT = process.env.WP_PORT || '8180';
const WP = 'http://wpdemo-vfx.com:' + PORT;
const VFX = 'http://127.0.0.1:8097';
const PLATFORM_DIR = process.env.PLATFORM_DIR || path.resolve(__dirname, '../../visionforgex/tests/site/public_html');
const CONFIG = path.join(PLATFORM_DIR, 'config');
const WPDIR = path.join(__dirname, '.wp', PORT);
const WPCLI = process.env.WP_CLI || '/tmp/claude-0/wpdl/wp-cli.phar';
const SHOTS = path.join(__dirname, 'shots');
fs.mkdirSync(SHOTS, { recursive: true });

let pass = 0;
let fail = 0;
// Every icon in the middle of its badge, every switch knob in the middle of its track, to the pixel (20 Nov 2026: a
// rule for the text beside a badge, ".vfx-step span", also caught the badge, a span too, and dropped its centring).
async function centred(page, boxSel, innerSel) {
	return page.evaluate(([b, i]) => [...document.querySelectorAll(b)].map((el) => {
		const inner = el.querySelector(i);
		if (!inner) return 'no ' + i + ' in ' + b;
		const o = el.getBoundingClientRect(), n = inner.getBoundingClientRect();
		const dx = Math.abs(o.left + o.width / 2 - (n.left + n.width / 2)), dy = Math.abs(o.top + o.height / 2 - (n.top + n.height / 2));
		return dx <= 1 && dy <= 1 ? '' : b + ' off by ' + dx.toFixed(1) + ', ' + dy.toFixed(1);
	}).filter(Boolean), [boxSel, innerSel]);
}
function check(name, ok, extra) {
	if (ok) {
		pass++;
		console.log('  ok   ' + name);
	} else {
		fail++;
		console.log('  FAIL ' + name + (extra !== undefined ? '  → ' + String(extra).slice(0, 400) : ''));
	}
}
const wp = (...args) => execFileSync('php', [WPCLI, '--path=' + WPDIR, '--allow-root', '--url=' + WP, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const get = async (url) => {
	const r = await fetch(url, { redirect: 'manual' });
	return { status: r.status, body: await r.text(), headers: r.headers };
};
const readJson = (f) => {
	try {
		return JSON.parse(fs.readFileSync(f, 'utf8'));
	} catch (e) {
		return null;
	}
};
const siteFor = (domain) => {
	for (const f of fs.readdirSync(CONFIG)) {
		if (!/^\d+\.json$/.test(f)) continue;
		const c = readJson(path.join(CONFIG, f));
		if (c && c.siteUrl === domain) return { id: f.replace('.json', ''), file: path.join(CONFIG, f), cfg: c };
	}
	return null;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// A clean platform: no site for the demo domain and no connection left from an earlier run.
const before = siteFor('wpdemo-vfx.com');
if (before) fs.unlinkSync(before.file);
const connFile = path.join(CONFIG, '_wp-connector.json');
const connBackup = fs.existsSync(connFile) ? fs.readFileSync(connFile) : null;
if (fs.existsSync(connFile)) fs.unlinkSync(connFile);
// The platform's default ads.txt lines (the test platform has none of its own).
const defFile = path.join(CONFIG, '_ads-txt-default.json');
const defBackup = fs.existsSync(defFile) ? fs.readFileSync(defFile) : null;
fs.writeFileSync(defFile, JSON.stringify({ content: 'google.com, pub-9999999999999999, RESELLER, f08c47fec0942fa0\nvisionforgex.com, 1001, DIRECT\n', updatedAt: new Date().toISOString() }));
const statusFile = path.join(CONFIG, '_ads-txt-status.json');
const statusBackup = fs.existsSync(statusFile) ? fs.readFileSync(statusFile) : null;
const realAds = path.join(WPDIR, 'ads.txt');
if (fs.existsSync(realAds)) fs.unlinkSync(realAds);

(async () => {
	const browser = await chromium.launch();
	const ctx = await browser.newContext({ viewport: { width: 1360, height: 900 }, deviceScaleFactor: 1 });
	const page = await ctx.newPage();
	const errors = [];
	page.on('pageerror', (e) => errors.push(e.message));
	page.on('console', (m) => {
		if (m.type() === 'error' && !/favicon|ERR_|net::/.test(m.text())) errors.push(m.text());
	});

	console.log('1. Before connecting');
	await page.goto(WP + '/wp-login.php');
	await page.fill('#user_login', 'admin');
	await page.fill('#user_pass', 'admin-test-pass');
	await page.click('#wp-submit');
	await page.waitForURL(/wp-admin/);
	await page.goto(WP + '/wp-admin/admin.php?page=visionforgex');
	await page.waitForSelector('.vfx-welcome');
	check('the menu item is there', (await page.locator('#toplevel_page_visionforgex').count()) === 1);
	check('Welcome: the Connect button', await page.locator('button:has-text("Connect with VisionForgeX")').isVisible());
	check('nothing printed on the site before connecting', !(await get(WP + '/')).body.includes('data-vfx-plugin'));
	check('no /ads.txt from the plugin before connecting', (await get(WP + '/ads.txt')).status === 404);
	await page.click('text=What is sent when you connect');
	check('what is sent is listed', await page.locator('.vfx-disclose-body').isVisible());
	await sleep(700);
	await page.screenshot({ path: path.join(SHOTS, '1-welcome.png') });
	let off = await centred(page, '.vfx-pill-icon', 'svg');
	check('Welcome: each point\'s icon in the middle of its badge', off.length === 0 && (await page.locator('.vfx-pill-icon').count()) >= 3, off.join(' | '));
	check('wp-admin outside the app untouched (the admin menu keeps its own colours)', (await page.evaluate(() => getComputedStyle(document.querySelector('#adminmenuback')).backgroundColor)) !== 'rgba(0, 0, 0, 0)');

	console.log('2. Connect: sign in on VisionForgeX, add and allow');
	await page.goto(VFX + '/publisher/_testlogin.php?id=u_pub4&to=/publisher/');
	await page.goto(WP + '/wp-admin/admin.php?page=visionforgex');
	await page.click('button:has-text("Connect with VisionForgeX")');
	await page.waitForURL(/127\.0\.0\.1:8097\/publisher\/connect/);
	const u = new URL(page.url());
	check('the connect link carries site, return, state and challenge', u.searchParams.get('site') === WP + '/' && /page=visionforgex/.test(u.searchParams.get('return') || '') && /^[A-Za-z0-9_-]{32}$/.test(u.searchParams.get('state') || '') && /^[A-Za-z0-9_-]{43}$/.test(u.searchParams.get('challenge') || ''));
	check('the connect page offers to add the site', (await page.locator('[data-wpc-go]').innerText()).includes('Add and allow'));
	await sleep(1200);
	await page.screenshot({ path: path.join(SHOTS, '2-connect-page.png') });
	await page.click('[data-wpc-go]');
	await page.waitForURL(/page=visionforgex/);
	await page.waitForSelector('.vfx-top');
	check('back in WordPress, connected (the code is gone from the address)', !/vfx_code|vfx=/.test(page.url()), page.url());
	const site = siteFor('wpdemo-vfx.com');
	check('the platform added the site, unapproved, from WordPress', site && site.cfg.approved === false && site.cfg.createdFrom === 'wordpress');
	const conn = readJson(connFile);
	check('the platform keeps the connection (key id, sealed secret)', conn && site && conn.sites[site.id] && /^wpk_[a-f0-9]{20}$/.test(conn.sites[site.id].keyId) && !/^[A-Za-z0-9_-]{43}$/.test(conn.sites[site.id].secret));
	const opt = JSON.parse(wp('option', 'get', 'visionforgex_connection', '--format=json'));
	check('WordPress keeps the key sealed, never in plain text', opt.secret.startsWith('s1:') && opt.keyId === conn.sites[site.id].keyId);
	check('the option holding the key is not autoloaded', wp('db', 'query', "SELECT autoload FROM wp_options WHERE option_name='visionforgex_connection'", '--skip-column-names').match(/^(no|off)$/) !== null);
	check('the status says In review', (await page.locator('.vfx-status').innerText()).includes('In review'));
	await page.waitForSelector('.vfx-step', { timeout: 15000 });
	await page.waitForFunction(() => !document.querySelector('.vfx-btn.is-busy'), null, { timeout: 30000 });
	check('the first site check ran by itself (Go live)', (await page.locator('.vfx-tab.is-on').innerText()).includes('Go live') && (await page.locator('.vfx-step--ok').count()) >= 2);
	await sleep(600);
	await page.screenshot({ path: path.join(SHOTS, '3-golive-review.png'), fullPage: true });
	off = await centred(page, '.vfx-step-dot', 'svg');
	check('Go live: every step\'s tick or icon in the middle of its round badge', off.length === 0 && (await page.locator('.vfx-step-dot').count()) >= 4, off.join(' | '));

	console.log('3. ads.txt while in review');
	let ads = await get(WP + '/ads.txt');
	check('/ads.txt served by WordPress (200, text/plain)', ads.status === 200 && /text\/plain/.test(ads.headers.get('content-type') || ''), ads.status);
	const snap = JSON.parse(wp('option', 'get', 'visionforgex_snapshot', '--format=json'));
	const lines = snap.adsTxt.lines;
	check('every line VisionForgeX gave is in it', lines.length > 0 && lines.every((l) => ads.body.includes(l)), lines.length);
	check('between the markers', /# VisionForgeX: begin[^\n]*\n[\s\S]*# VisionForgeX: end/.test(ads.body));
	const health = readJson(connFile).sites[site.id].health;
	check('the platform checked the live ads.txt itself and found it complete', health && health.adsTxt && health.adsTxt.ok === true, JSON.stringify(health && health.adsTxt));
	check('and recorded it for Getting started', (readJson(path.join(CONFIG, '_ads-txt-status.json')) || {})[site.id]?.ok === true);
	check('no tag while the site is in review', !(await get(WP + '/')).body.includes('data-vfx-plugin'));

	console.log('4. Approved on VisionForgeX: the tag goes on');
	const cfg = readJson(site.file);
	cfg.approved = true;
	fs.writeFileSync(site.file + '.tmp', JSON.stringify(cfg, null, 2));
	fs.renameSync(site.file + '.tmp', site.file);
	await page.click('.vfx-tab:has-text("Settings")');
	await page.click('button:has-text("Sync now")');
	await page.waitForSelector('.vfx-toast:has-text("Up to date")');
	await page.waitForFunction(() => document.querySelector('.vfx-status') && document.querySelector('.vfx-status').innerText.includes('Live'), null, { timeout: 15000 });
	check('the status says Live after Sync now', true);
	let home = (await get(WP + '/')).body;
	const tags = home.match(/<script[^>]*data-vfx-plugin[^>]*>/g) || [];
	check('both scripts on the home page (Google’s and the site’s)', tags.length === 2, tags.length);
	const siteTag = tags.find((t) => t.includes('data-site'));
	check('the site’s script carries its id and async', siteTag && siteTag.includes('data-site="' + site.id + '"') && /\sasync[\s>]/.test(siteTag), siteTag);
	check('kept off speed plugins (cfasync, no-optimize, nowprocket, no-defer)', siteTag && ['data-cfasync="false"', 'data-no-optimize="1"', 'nowprocket', 'data-no-defer="1"', 'data-noptimize="1"'].every((a) => siteTag.includes(a)));
	check('async printed once', siteTag && (siteTag.match(/\sasync/g) || []).length === 1, siteTag);
	check('the tag is in the head', home.indexOf('data-vfx-plugin') < home.indexOf('</head>'));
	check('Google’s script crossorigin', tags.some((t) => t.includes('gpt.js') && t.includes('crossorigin="anonymous"')));
	const post = (await get(WP + '/ten-weeknight-dinners/')).body;
	check('the tag on an article too', post.includes('data-site="' + site.id + '"'));
	check('not in the RSS feed', !(await get(WP + '/feed/')).body.includes('data-vfx-plugin'));
	await page.click('.vfx-tab:has-text("Go live")');
	await page.click('button:has-text("Run the check")');
	await page.waitForFunction(() => !document.querySelector('.vfx-btn.is-busy'), null, { timeout: 30000 });
	const okSteps = await page.locator('.vfx-step--ok').count();
	check('Go live: connected, approved, ads.txt and the tag green', okSteps === 4, okSteps + ' ' + (await page.locator('.vfx-steps').innerText()));
	check('HTTPS honestly flagged on this http test site, so not "live" yet', (await page.locator('.vfx-step--warn').innerText()).includes('not on HTTPS') && (await page.locator('.vfx-golive-head h2').innerText()) === 'Go live');
	await sleep(900);
	await page.screenshot({ path: path.join(SHOTS, '4-golive-live.png'), fullPage: true });

	console.log('5. Home and Pause all ads');
	await page.click('.vfx-tab:has-text("Home")');
	await sleep(700);
	await page.screenshot({ path: path.join(SHOTS, '5-home.png'), fullPage: true });
	const knob = await page.evaluate(() => { const t = document.querySelector('.vfx-pause .vfx-switch'), k = t && t.querySelector('.vfx-switch-knob'); if (!k) return 99; const a = t.getBoundingClientRect(), b = k.getBoundingClientRect(); return Math.abs(a.top + a.height / 2 - (b.top + b.height / 2)); });
	check('Home: Pause all ads\' knob in the middle of its track', knob <= 1, knob);
	check('Home: the reports link goes to the platform (no reporting in the plugin)', (await page.locator('a:has-text("Open your reports")').getAttribute('href')).startsWith(VFX + '/publisher/reports?site=' + site.id));
	check('Home: no money anywhere', !/\$\s?\d|revenue|eCPM|impressions/i.test(await page.locator('.vfx-view').innerText()));
	check('Home: features not on the account named in one line, not a wall of chips', (await page.locator('.vfx-feature').count()) === 0 && (await page.locator('.vfx-view').innerText()).includes('Also on VisionForgeX: Bad ads'));
	await page.click('.vfx-pause .vfx-switch');
	await page.waitForFunction(() => document.querySelector('.vfx-status').innerText.includes('Paused'));
	check('Pause all ads: the tag is off at once', !(await get(WP + '/')).body.includes('data-vfx-plugin'));
	check('ads.txt stays while paused', (await get(WP + '/ads.txt')).body.includes('# VisionForgeX: begin'));
	await sleep(500);
	await page.screenshot({ path: path.join(SHOTS, '6-paused.png') });
	await page.click('.vfx-pause .vfx-switch');
	await page.waitForFunction(() => document.querySelector('.vfx-status').innerText.includes('Live'));
	check('turned back on: the tag is back', (await get(WP + '/')).body.includes('data-vfx-plugin'));
	check('the changes are in Recent changes', (await (async () => {
		await page.click('.vfx-tab:has-text("Settings")');
		return page.locator('.vfx-history').innerText();
	})()).includes('Paused all ads'));
	check('the key is shown shortened only', /^wpk_[a-f0-9]{4}…[a-f0-9]{4}$/.test(await page.locator('.vfx-dl code').innerText()));

	console.log('6. ads.txt: the publisher’s own lines, then a real file');
	await page.click('.vfx-tab:has-text("ads.txt")');
	await page.fill('#vfx-extra', 'google.com, pub-1111111111111111, DIRECT, f08c47fec0942fa0\nother.example, 42, RESELLER');
	await page.click('button:has-text("Save")');
	await page.waitForSelector('.vfx-toast:has-text("ads.txt saved")');
	ads = await get(WP + '/ads.txt');
	check('their lines first, ours after', ads.body.indexOf('pub-1111111111111111') > -1 && ads.body.indexOf('pub-1111111111111111') < ads.body.indexOf('# VisionForgeX: begin'));
	await page.screenshot({ path: path.join(SHOTS, '7-adstxt.png'), fullPage: true });
	// A real file appears (the host, or another plugin): our block goes into it, theirs stays.
	fs.writeFileSync(realAds, '# their file\ngoogle.com, pub-2222222222222222, DIRECT, f08c47fec0942fa0\n' + lines[0] + '\n');
	await page.reload();
	await page.click('.vfx-tab:has-text("ads.txt")');
	check('the dashboard sees the real file', (await page.locator('.vfx-mode').innerText()).includes('Kept in your ads.txt file'));
	await page.evaluate(() => wp.apiFetch({ path: '/visionforgex/v1/adstxt', method: 'POST', data: {} }));
	let file = fs.readFileSync(realAds, 'utf8');
	check('their file keeps every line', file.startsWith('# their file\ngoogle.com, pub-2222222222222222, DIRECT, f08c47fec0942fa0\n' + lines[0] + '\n'));
	check('our block added once, without the line they already had', (file.match(/# VisionForgeX: begin/g) || []).length === 1 && file.split(lines[0]).length === 2 && lines.slice(1).every((l) => file.includes(l)), file);
	await page.evaluate(() => wp.apiFetch({ path: '/visionforgex/v1/adstxt', method: 'POST', data: {} }));
	check('written again: the same file (no second block)', fs.readFileSync(realAds, 'utf8') === file);
	ads = await get(WP + '/ads.txt');
	check('the real file is what the world sees', ads.body === file);

	console.log('7. Signed calls');
	const keyId = conn.sites[site.id].keyId;
	const bad = await fetch(VFX + '/api/v1/wordpress/?op=site', { headers: { 'X-VFX-Key': keyId, 'X-VFX-Time': String(Math.floor(Date.now() / 1000)), 'X-VFX-Nonce': 'nnnnnnnnnnnnnnnnnnnn', 'X-VFX-Signature': 'a'.repeat(64) } });
	check('a call with a wrong signature is refused', bad.status === 401 && (await bad.json()).error.code === 'bad_signature');
	const synced = JSON.parse(wp('eval', 'echo wp_json_encode( VisionForgeX_Api::sync() );'));
	check('a real signed call works (sync from WP-CLI)', synced.ok === true && synced.data.site.id === site.id);

	console.log('8. Dark, a phone, and the console');
	await page.click('.vfx-tab:has-text("Settings")');
	await page.click('.vfx-seg button:has-text("Dark")');
	check('dark theme applied', (await page.getAttribute('#visionforgex-app', 'data-theme')) === 'dark');
	await page.click('.vfx-tab:has-text("Home")');
	await sleep(700);
	await page.screenshot({ path: path.join(SHOTS, '8-home-dark.png'), fullPage: true });
	await page.setViewportSize({ width: 390, height: 844 });
	await sleep(500);
	const wide = await page.evaluate(() => document.documentElement.scrollWidth);
	check('a 390 px phone: nothing pushes the page sideways', wide <= 390, wide);
	await page.screenshot({ path: path.join(SHOTS, '9-phone-dark.png'), fullPage: true });
	await page.setViewportSize({ width: 1360, height: 900 });
	await page.click('.vfx-tab:has-text("Settings")');
	await page.click('.vfx-seg button:has-text("Light")');

	console.log('9. Disconnect');
	await page.click('button:has-text("Disconnect")');
	await page.waitForSelector('.vfx-modal');
	await sleep(400);
	await page.screenshot({ path: path.join(SHOTS, '10-disconnect.png') });
	await page.click('.vfx-modal button.vfx-btn--danger');
	await page.waitForSelector('.vfx-welcome');
	check('back to Welcome', true);
	check('the platform let go of the connection', !(readJson(connFile).sites || {})[site.id]);
	check('the platform logged it', JSON.stringify(readJson(connFile).log).includes('disconnected'));
	check('the tag is off', !(await get(WP + '/')).body.includes('data-vfx-plugin'));
	file = fs.readFileSync(realAds, 'utf8');
	check('our block is out of their file, their lines all there', !file.includes('VisionForgeX') && file === '# their file\ngoogle.com, pub-2222222222222222, DIRECT, f08c47fec0942fa0\n' + lines[0] + '\n', file);
	check('the old key no longer works', JSON.parse(wp('eval', 'echo wp_json_encode( VisionForgeX_Store::connected() );')) === false);

	console.log('10. Refused and odd returns');
	await page.goto(WP + '/wp-admin/admin.php?page=visionforgex&vfx_code=' + 'x'.repeat(43) + '&state=' + 'y'.repeat(32));
	await page.waitForSelector('.vfx-welcome');
	check('a made-up code with an unknown state does nothing (stale link message)', (await page.locator('.vfx-banner').innerText()).includes('too old'));
	await page.click('button:has-text("Connect with VisionForgeX")');
	await page.waitForURL(/publisher\/connect/);
	await page.click('button[value="deny"]');
	await page.waitForURL(/page=visionforgex/);
	await page.waitForSelector('.vfx-welcome');
	check('Cancel on VisionForgeX: "You chose not to connect"', (await page.locator('.vfx-banner').innerText()).includes('chose not to connect'));
	check('still not connected', JSON.parse(wp('eval', 'echo wp_json_encode( VisionForgeX_Store::connected() );')) === false);

	console.log('11. Uninstall puts the file back');
	fs.writeFileSync(realAds, 'a.example, 1, DIRECT\n\n# VisionForgeX: begin (added by the VisionForgeX plugin; it keeps this part up to date)\nb.example, 2, DIRECT\n# VisionForgeX: end\n');
	wp('plugin', 'deactivate', 'visionforgex');
	wp('plugin', 'uninstall', 'visionforgex');
	check('uninstall: only our block taken out', fs.readFileSync(realAds, 'utf8') === 'a.example, 1, DIRECT\n', fs.readFileSync(realAds, 'utf8'));
	check('uninstall: no option of ours left', wp('db', 'query', "SELECT COUNT(*) FROM wp_options WHERE option_name LIKE 'visionforgex%'", '--skip-column-names') === '0');
	check('uninstall: no job left', !wp('cron', 'event', 'list', '--fields=hook', '--format=csv').includes('visionforgex'));

	check('no JavaScript error on any screen', errors.length === 0, errors.join(' | '));
	const debug = path.join(WPDIR, 'debug.log');
	const dbg = fs.existsSync(debug) ? fs.readFileSync(debug, 'utf8').split('\n').filter((l) => /plugins\/visionforgex\//.test(l)) : [];
	check('no PHP notice or warning from the plugin', dbg.length === 0, dbg.slice(0, 3).join(' | '));

	await browser.close();
	// Put the platform back as it was.
	const s2 = siteFor('wpdemo-vfx.com');
	if (s2) fs.unlinkSync(s2.file);
	if (connBackup) fs.writeFileSync(connFile, connBackup);
	else if (fs.existsSync(connFile)) fs.unlinkSync(connFile);
	if (fs.existsSync(realAds)) fs.unlinkSync(realAds);
	if (defBackup) fs.writeFileSync(defFile, defBackup);
	else fs.unlinkSync(defFile);
	if (statusBackup) fs.writeFileSync(statusFile, statusBackup);
	else if (fs.existsSync(statusFile)) fs.unlinkSync(statusFile);
	console.log('\n' + pass + ' passed, ' + fail + ' failed');
	process.exit(fail ? 1 : 0);
})().catch((e) => {
	console.error(e);
	process.exit(2);
});
