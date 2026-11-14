/**
 * Phases 3 and 4 in a real WordPress against the platform's test server:
 *   in-content ads with their space kept (layout shift measured), theme spots, the visual editor and your own spots,
 *   the consent bridge, page facts, test ads for administrators, publish events, instant sync from VisionForgeX
 *   (signed pushes, replays refused), staging addresses, the extra rules, the Ad Inserter import, WP-CLI, and a
 *   multisite network.
 *
 *   bash tests/setup.sh <WordPress> 8180 > /tmp/setup.log && node tests/e2e3.js
 *
 * Needs the platform's test servers (visionforgex/tests/start-servers.sh), MariaDB, and in /etc/hosts:
 *   127.0.0.1 wpdemo-vfx.com www.wpdemo-vfx.com wpnet-vfx.com
 * The network part makes its own WordPress (MULTISITE=1 tests/setup.sh, port 80); NO_NETWORK=1 skips it.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { execFileSync, execSync } = require('child_process');

const PORT = process.env.WP_PORT || '8180';
const WP = 'http://wpdemo-vfx.com:' + PORT;
const VFX = 'http://127.0.0.1:8097';
const PLATFORM_DIR = process.env.PLATFORM_DIR || path.resolve(__dirname, '../../visionforgex/tests/site/public_html');
const CONFIG = path.join(PLATFORM_DIR, 'config');
const WPDIR = path.join(__dirname, '.wp', PORT);
const WPCLI = process.env.WP_CLI || '/tmp/claude-0/wpdl/wp-cli.phar';
const SHOTS = path.join(__dirname, 'shots');
const WPSRC = process.env.WP_SRC || '/tmp/claude-0/wpdl/wp-7.1.4';
fs.mkdirSync(SHOTS, { recursive: true });

let pass = 0;
let fail = 0;
function check(name, ok, extra) {
	if (ok) {
		pass++;
		console.log('  ok   ' + name);
	} else {
		fail++;
		console.log('  FAIL ' + name + (extra !== undefined ? '  → ' + String(extra).slice(0, 500) : ''));
	}
}
const cli = (dir, url, args) => {
	try {
		return execFileSync('php', [WPCLI, '--path=' + dir, '--allow-root', '--url=' + url, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
	} catch (e) {
		return 'ERROR ' + String(e.stdout || '') + String(e.stderr || '');
	}
};
const wp = (...args) => cli(WPDIR, WP, args);
const php = (code) => wp('eval', code);
const platform = (...args) => execFileSync('php', [path.join(__dirname, 'helpers', 'platform.php'), PLATFORM_DIR, ...args], { encoding: 'utf8' }).trim();
const state = (id) => JSON.parse(platform('state', id));
const get = async (url, headers) => {
	const r = await fetch(url, { redirect: 'manual', headers: headers || {} });
	return { status: r.status, body: await r.text() };
};
const readJson = (f) => {
	try {
		return JSON.parse(fs.readFileSync(f, 'utf8'));
	} catch (e) {
		return null;
	}
};
const writeJson = (f, d) => {
	fs.writeFileSync(f + '.tmp', JSON.stringify(d, null, 2));
	fs.renameSync(f + '.tmp', f);
};
const siteFor = (domain) => {
	for (const f of fs.readdirSync(CONFIG)) {
		if (!/^\d+\.json$/.test(f)) continue;
		const c = readJson(path.join(CONFIG, f));
		if (c && c.siteUrl === domain) return { id: f.replace('.json', ''), file: path.join(CONFIG, f) };
	}
	return null;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const hasTag = (html) => html.includes('data-vfx-plugin');
const fresh = (u) => u + (u.includes('?') ? '&' : '?') + 'n=' + Date.now() + Math.random().toString(36).slice(2, 6);

// A clean platform.
const before = siteFor('wpdemo-vfx.com');
if (before) fs.unlinkSync(before.file);
fs.rmSync(path.join(CONFIG, '_wp-connector.json'), { force: true });
fs.writeFileSync(path.join(CONFIG, '_ads-txt-default.json'), JSON.stringify({ content: 'visionforgex.com, 1001, DIRECT\n', updatedAt: new Date().toISOString() }));

// The posts: a long one (12 paragraphs, with a table, a quote and headings in between), the short one from setup.
const catId = wp('term', 'create', 'category', 'Dinners', '--slug=dinners', '--porcelain');
let body = '';
for (let i = 1; i <= 12; i++) {
	body += '<p>Para ' + i + ': stir, taste, and season again.</p>';
	if (i === 2) body += '<table><tbody><tr><td><p>Inside a table</p></td></tr></tbody></table>';
	if (i === 3) body += '<h2>The sauce</h2>';
	if (i === 5) body += '<blockquote><p>A quote with a paragraph</p></blockquote>';
	if (i === 8) body += '<h2>Serving</h2>';
}
const longId = wp('post', 'create', '--post_type=post', '--post_status=publish', '--post_title=Slow cooker guide', '--post_name=slow-cooker-guide', '--post_author=1', '--post_category=' + catId, '--tags_input=quick', '--post_content=' + body, '--porcelain');
const LONG = WP + '/slow-cooker-guide/';
const SHORT = WP + '/ten-weeknight-dinners/';

(async () => {
	const browser = await chromium.launch();
	const ctx = await browser.newContext({ viewport: { width: 1400, height: 950 } });
	const page = await ctx.newPage();
	const errors = [];
	page.on('pageerror', (e) => errors.push(e.message));
	// A visitor, with every script from elsewhere held back (the tag and Google's library), so the page is measured alone.
	const anon = await browser.newContext({ viewport: { width: 1280, height: 900 } });
	await anon.route('**/*', (r) => (r.request().resourceType() === 'script' && !r.request().url().startsWith(WP) ? r.abort() : r.continue()));
	const visit = async (url, fn, arg) => {
		const p = await anon.newPage();
		await p.goto(fresh(url));
		const out = fn ? await p.evaluate(fn, arg) : null;
		await p.close();
		return out;
	};
	const api = (route, data) => page.evaluate(([r, d]) => wp.apiFetch({ path: '/visionforgex/v1/' + r, method: 'POST', data: d }).then((x) => ({ ok: true, x }), (e) => ({ ok: false, message: e.message })), [route, data]);
	const tab = async (name, sel) => {
		await page.click('.vfx-tab:has-text("' + name + '")');
		if (sel) await page.waitForSelector(sel);
		await sleep(400);
	};
	const saveBar = async () => {
		await page.waitForSelector('.vfx-savebar.is-up');
		await page.click('.vfx-savebar.is-up button:has-text("Save")');
		await page.waitForFunction(() => !document.querySelector('.vfx-savebar.is-up'), null, { timeout: 20000 });
		await sleep(300);
	};

	console.log('0. Connect, then VisionForgeX sets the site up');
	await page.goto(WP + '/wp-login.php');
	await page.fill('#user_login', 'admin');
	await page.fill('#user_pass', 'admin-test-pass');
	await page.click('#wp-submit');
	await page.waitForURL(/wp-admin/, { timeout: 120000 });
	await page.goto(VFX + '/publisher/_testlogin.php?id=u_pub4&to=/publisher/');
	await page.goto(WP + '/wp-admin/admin.php?page=visionforgex');
	await page.click('button:has-text("Connect with VisionForgeX")');
	await page.waitForURL(/publisher\/connect/);
	await page.click('[data-wpc-go]');
	await page.waitForURL(/page=visionforgex/);
	await page.waitForSelector('.vfx-top');
	const site = siteFor('wpdemo-vfx.com');
	const cfg = readJson(site.file);
	cfg.approved = true;
	cfg.networkCode = '12345678';
	cfg.formats = cfg.formats || {};
	for (const f of ['banner', 'anchor', 'interstitial', 'rewarded']) cfg.formats[f] = Object.assign(cfg.formats[f] || {}, { adUnitPath: '/12345678/demo_' + f });
	cfg.formats.banner.sizes = [[300, 250], [728, 90]];
	writeJson(site.file, cfg);
	wp('eval', 'VisionForgeX_Api::sync();');
	await page.reload();
	await page.waitForSelector('.vfx-top');
	check('connected and live', (await page.locator('.vfx-status').innerText()).includes('Live'));
	const plain = await get(fresh(LONG));
	check('untouched site: no spot, no page script, no kept-space CSS', hasTag(plain.body) && !plain.body.includes('visionforgex-spot') && !plain.body.includes('visionforgex-page-js') && !plain.body.includes('id="visionforgex-spots"'));
	check('untouched site: nothing waits to be pushed', !state(site.id).push);

	console.log('1. In-content ads, placed by WordPress');
	await tab('Placements', '[data-vfx-incontent]');
	check('in-content is off at first', !(await page.locator('[data-vfx-incontent].is-on').count()));
	await page.click('[data-vfx-incontent] .vfx-switch');
	await page.fill('.vfx-field:has-text("After paragraph") input', '2');
	await page.fill('.vfx-field:has-text("Then every") input', '3');
	await page.fill('.vfx-field:has-text("At most per post") input', '3');
	check('the drawing shows three ads', (await page.locator('.vfx-art-ad').count()) === 3);
	check('the kept space is spelled out (250 px)', (await page.locator('.vfx-line:has-text("Keep the ad")').innerText()).includes('250 px on phones, 250 px'));
	check('mode warning: VisionForgeX places ads automatically, plain spots would not load', await page.locator('[data-vfx-modewarn]').isVisible());
	await page.screenshot({ path: path.join(SHOTS, 'p3-1-incontent.png') });
	await saveBar();
	const ic = JSON.parse(php('echo wp_json_encode(VisionForgeX_Spots::incontent());'));
	check('saved: on, after 2, every 3, at most 3', ic.on && ic.first === 2 && ic.every === 3 && ic.max === 3, JSON.stringify(ic));
	await page.click('[data-vfx-modewarn] button:has-text("Use only these spots")');
	await page.waitForFunction(() => !document.querySelector('[data-vfx-modewarn]'), null, { timeout: 20000 });
	check('one click: VisionForgeX uses only these spots (mode manual on the platform)', readJson(site.file).mode === 'manual', readJson(site.file).mode);
	check('a change made in WordPress is not pushed back to it', !state(site.id).push);

	const placed = await visit(LONG, () => Array.from(document.querySelectorAll('.visionforgex-spot--content')).map((s) => ({ after: (s.previousElementSibling || {}).textContent || '', style: s.getAttribute('style') || '', slot: !!s.querySelector('[data-adx-slot][data-adx-format="banner"]'), inside: !!s.closest('table,blockquote,ul,ol,figure') })));
	check('three spots in the long post', placed.length === 3, JSON.stringify(placed));
	check('after paragraphs 2, 5 and 8 (the table and the quote are not counted)', placed.map((p) => p.after.slice(0, 7)).join() === 'Para 2:,Para 5:,Para 8:', placed.map((p) => p.after).join(' | '));
	check('never inside a table or a quote', placed.every((p) => !p.inside));
	check('each keeps 250 px (phones and wider)', placed.every((p) => p.style.includes('--vfx-h:250px') && p.style.includes('--vfx-hw:250px')), placed[0] && placed[0].style);
	check('each is a plain banner spot the tag picks up', placed.every((p) => p.slot));
	const shortHtml = (await get(fresh(SHORT))).body;
	check('a post shorter than 4 paragraphs gets none', !shortHtml.includes('visionforgex-spot--content'));
	const homeHtml = (await get(fresh(WP + '/'))).body;
	check('the home page list gets none', !homeHtml.includes('visionforgex-spot--content'));
	check('the kept-space CSS is in the head', (await get(fresh(LONG))).body.includes('<style id="visionforgex-spots">'));

	// Layout shift: an ad of 300x250 with its label arrives in every spot after the page has settled.
	const measure = () =>
		new Promise((done) => {
			let total = 0;
			new PerformanceObserver((l) => {
				for (const e of l.getEntries()) if (!e.hadRecentInput) total += e.value;
			}).observe({ type: 'layout-shift', buffered: false });
			setTimeout(() => {
				document.querySelectorAll('.visionforgex-spot--content [data-adx-slot]').forEach((s) => {
					s.innerHTML = '<div style="height:18px;font:11px sans-serif">Advertisement</div><div style="width:300px;height:250px;margin:0 auto;background:#ccc"></div>';
				});
				setTimeout(() => done(Math.round(total * 1000) / 1000), 900);
			}, 400);
		});
	const clsKept = await visit(LONG, measure);
	check('space kept: the page does not move when the ads arrive (layout shift 0)', clsKept === 0, clsKept);
	check('the kept spot is as tall as the ad and its label', (await visit(LONG, () => document.querySelector('.visionforgex-spot--content').getBoundingClientRect().height)) === 274);
	await api('incontent', { incontent: { reserve: false } });
	const clsLoose = await visit(LONG, measure);
	check('space not kept: the same ads push the page (layout shift ' + clsLoose + ')', clsLoose > 0.05, clsLoose);
	check('without kept space: no kept-space CSS, no height on the spots', !(await get(fresh(LONG))).body.includes('visionforgex-spot--kept'));
	await api('incontent', { incontent: { reserve: true } });
	await page.setViewportSize({ width: 390, height: 844 });
	await page.reload();
	await page.waitForSelector('[data-vfx-incontent]');
	check('390 px, Placements: nothing pushes the page sideways', (await page.evaluate(() => document.documentElement.scrollWidth)) <= 390);
	await page.setViewportSize({ width: 1400, height: 950 });

	console.log('2. Theme spots');
	await page.reload();
	await page.waitForSelector('[data-vfx-incontent]');
	const themeCard = page.locator('.vfx-card:has-text("Theme spots")');
	await themeCard.locator('select.vfx-select--small').selectOption('afterContent');
	await themeCard.locator('button:has-text("Add")').first().click();
	await themeCard.locator('select.vfx-select--small').selectOption('afterTitle');
	await themeCard.locator('button:has-text("Add")').first().click();
	check('two theme spots listed, on', (await page.locator('[data-vfx-spot].is-on').count()) === 2);
	await page.locator('[data-vfx-spot="afterContent"] .vfx-field:has-text("On") select').selectOption('posts');
	await saveBar();
	const spots1 = JSON.parse(php('echo wp_json_encode(array_values(VisionForgeX_Spots::spots()));'));
	check('saved: after the content (posts only), after the title', spots1.length === 2 && spots1.find((s) => s.where === 'afterContent').pages === 'posts' && spots1.find((s) => s.where === 'afterTitle').pages === 'all', JSON.stringify(spots1));
	const theme = await visit(LONG, () => ({
		title: !!document.querySelector('.wp-block-post-title + .visionforgex-spot--theme-aftertitle'),
		after: document.querySelectorAll('.visionforgex-spot--theme-aftercontent').length,
		lastIsAfter: (() => {
			const s = document.querySelector('.visionforgex-spot--theme-aftercontent');
			return !!s && !s.nextElementSibling;
		})(),
	}));
	check('after the title: right under the post title (block theme)', theme.title, JSON.stringify(theme));
	check('after the content: once, at the end of the post', theme.after === 1 && theme.lastIsAfter, JSON.stringify(theme));
	const homeThemes = (await get(fresh(WP + '/'))).body;
	check('"posts only" and "after the title" stay off the home page', !homeThemes.includes('theme-aftercontent') && !homeThemes.includes('theme-aftertitle'));

	console.log('3. The visual editor and your own spots');
	await page.click('button:has-text("Open the visual editor")');
	await page.waitForSelector('.vfx-editor-frame');
	await page.locator('.vfx-editor-bar select').selectOption(LONG);
	await page.waitForFunction(() => /Click any part/.test(document.querySelector('.vfx-editor-hint').textContent), null, { timeout: 20000 });
	const frame = page.frameLocator('.vfx-editor-frame');
	const fr = page.frames().find((f) => f.url().includes('vfx_pick='));
	check('the page opens inside the dashboard, signed in', !!fr && fr.url().startsWith(LONG), fr && fr.url());
	check('in the editor: no tag, no admin bar', await fr.evaluate(() => !document.querySelector('script[data-vfx-plugin]') && !document.getElementById('wpadminbar')));
	check('the theme spots already there are not drawn as ads in the editor (tag off)', await fr.evaluate(() => !document.querySelector('.visionforgex-spot')));
	await frame.locator('.wp-block-site-title a').first().click();
	await page.waitForSelector('[data-vfx-pickpanel]');
	check('a link clicked in the editor goes nowhere', fr.url().startsWith(LONG) && (await fr.evaluate(() => location.href)).startsWith(LONG));
	check('the panel names what was clicked', (await page.locator('[data-vfx-pickpanel]').innerText()).includes('<a>'));
	await page.click('[data-vfx-pickpanel] button:has-text("Cancel")');
	await frame.locator('h1.wp-block-post-title').hover();
	check('the element under the pointer is outlined', (await frame.locator('.vfx-pk-hover').count()) === 1);
	await frame.locator('h1.wp-block-post-title').click();
	await page.waitForSelector('[data-vfx-pickpanel]');
	const pickSel = await page.locator('[data-vfx-pickpanel] code').innerText();
	check('a selector that finds exactly the title', (await fr.evaluate((s) => document.querySelectorAll(s).length === 1 && document.querySelector(s).matches('h1.wp-block-post-title'), pickSel)), pickSel);
	await page.click('[data-vfx-pickpanel] button:has-text("Before it")');
	await page.locator('[data-vfx-pickpanel] .vfx-field:has-text("On") select').selectOption('posts');
	await page.screenshot({ path: path.join(SHOTS, 'p4-1-visual-editor.png') });
	await page.click('[data-vfx-pickpanel] button:has-text("Add this spot")');
	await sleep(500);
	check('the new spot is drawn on the page at once', await fr.evaluate(() => {
		const m = document.querySelector('.vfx-pk-mark.is-new');
		return !!m && m.nextElementSibling && m.nextElementSibling.matches('h1.wp-block-post-title');
	}));
	check('"1 spot added"', (await page.locator('.vfx-editor-bar').innerText()).includes('1 spot added'));
	await page.click('.vfx-editor-bar button:has-text("Done")');
	check('the spot is listed, waiting to be saved', (await page.locator('[data-vfx-sel]').count()) === 1 && (await page.locator('.vfx-savebar.is-up').count()) === 1);
	await saveBar();
	const sel = JSON.parse(php('echo wp_json_encode(array_values(array_filter(VisionForgeX_Spots::spots(), function($s){return "selector"===$s["kind"];})));'));
	check('saved: before the title, posts only', sel.length === 1 && sel[0].selector === pickSel && sel[0].position === 'before' && sel[0].pages === 'posts', JSON.stringify(sel));
	const live = await visit(LONG, () => {
		const s = document.querySelector('.visionforgex-spot--selector');
		return { placed: !!s && !!s.nextElementSibling && s.nextElementSibling.matches('h1.wp-block-post-title'), slot: !!(s && s.querySelector('[data-adx-slot]')) };
	});
	check('a visitor: the spot is in place before the title', live.placed && live.slot, JSON.stringify(live));
	check('not on the home page (posts only)', !(await get(fresh(WP + '/'))).body.includes('visionforgex-spots-js'));
	const reopen = await page.evaluate(() => wp.apiFetch({ path: '/visionforgex/v1/state' }).then((s) => (s.state || s).placements.pick));
	const noNonce = await visit(WP + '/slow-cooker-guide/?vfx_pick=' + reopen, () => ({ picker: !!document.getElementById('visionforgex-picker-js'), tag: !!document.querySelector('script[data-vfx-plugin]') }));
	check('the editor link does nothing for a visitor (no picker, the tag as usual)', !noNonce.picker && noNonce.tag, JSON.stringify(noNonce));
	const badNonce = await page.evaluate((u) => fetch(u).then((r) => r.text()), LONG + '?vfx_pick=nope');
	check('nor for an administrator with a wrong code', !badNonce.includes('visionforgex-picker-js'));
	await page.click('.vfx-tab:has-text("Placements")');
	await sleep(300);
	await page.screenshot({ path: path.join(SHOTS, 'p3-2-placements.png'), fullPage: true });

	console.log('4. Privacy & signals: off until switched on');
	await tab('Privacy', '[data-vfx-flag="consent"]');
	check('three switches, all off', (await page.locator('[data-vfx-flag]').count()) === 3 && !(await page.locator('[data-vfx-flag].is-on').count()));
	const off = (await get(fresh(LONG))).body;
	check('all off: no page script', !off.includes('visionforgex-page-js'));
	wp('post', 'create', '--post_status=publish', '--post_title=Before signals');
	check('page facts off: publishing tells VisionForgeX nothing', !wp('cron', 'event', 'list', '--fields=hook', '--format=csv').includes('visionforgex_published'));

	console.log('5. Consent bridge');
	await page.click('[data-vfx-flag="consent"] .vfx-switch');
	await page.waitForSelector('[data-vfx-flag="consent"].is-on', { timeout: 20000 });
	check('on: saved on VisionForgeX (wordpress.consent)', readJson(site.file).wordpress && readJson(site.file).wordpress.consent === true, JSON.stringify(readJson(site.file).wordpress));
	check('only that switch', !readJson(site.file).wordpress.signals && !readJson(site.file).wordpress.qa);
	const consentFor = async (cookies, init) => {
		const c = await browser.newContext();
		await c.route('**/*', (r) => (r.request().resourceType() === 'script' && !r.request().url().startsWith(WP) ? r.abort() : r.continue()));
		if (cookies) await c.addCookies(cookies.map(([name, value]) => ({ name, value, url: WP })));
		if (init) await c.addInitScript(init);
		const p = await c.newPage();
		await p.goto(fresh(LONG));
		const v = await p.evaluate(() => window.vfxConsent);
		await c.close();
		return v;
	};
	const none = await consentFor(null);
	check('no answer yet: not decided, no personalised ads', none && none.decided === false && none.ads === false, JSON.stringify(none));
	const c1 = await consentFor([['cmplz_marketing', 'allow']]);
	check('Complianz yes → personalised', c1.decided && c1.ads && c1.by === 'complianz', JSON.stringify(c1));
	const c2 = await consentFor([['wp_consent_marketing', 'deny'], ['cmplz_marketing', 'allow']]);
	check('WP Consent API no wins over the rest', c2.decided && !c2.ads && c2.by === 'wp-consent-api', JSON.stringify(c2));
	const c3 = await consentFor([['cookieyes-consent', 'consentid:abc,consent:yes,action:yes,necessary:yes,functional:no,analytics:no,performance:no,advertisement:yes']]);
	check('CookieYes advertisement yes → personalised', c3.decided && c3.ads && c3.by === 'cookieyes', JSON.stringify(c3));
	const c4 = await consentFor([['CookieConsent', "{stamp:'x',necessary:true,preferences:true,statistics:true,marketing:false,method:'explicit',ver:1}"]]);
	check('Cookiebot marketing false → not personalised', c4.decided && !c4.ads && c4.by === 'cookiebot', JSON.stringify(c4));
	const c5 = await consentFor([['borlabs-cookie', encodeURIComponent(JSON.stringify({ consents: { essential: ['borlabs-cookie'], marketing: ['google-ads'] } }))]]);
	check('Borlabs marketing → personalised', c5.decided && c5.ads && c5.by === 'borlabs', JSON.stringify(c5));
	const c6 = await consentFor(null, () => {
		window.dataLayer = [['consent', 'default', { ad_storage: 'denied' }], ['consent', 'update', { ad_storage: 'granted', ad_personalization: 'granted' }]];
	});
	check('Google consent mode update granted → personalised', c6.decided && c6.ads && c6.by === 'consent-mode', JSON.stringify(c6));
	const c7 = await consentFor(null, () => {
		window.dataLayer = [['consent', 'update', { ad_storage: 'granted', ad_personalization: 'denied' }]];
	});
	check('consent mode with personalisation denied → not personalised', c7.decided && !c7.ads, JSON.stringify(c7));
	const changed = await visit(LONG, () => {
		const a = window.vfxConsent.decided;
		document.cookie = 'cmplz_marketing=allow; path=/';
		document.dispatchEvent(new Event('cmplz_status_change'));
		return [a, window.vfxConsent.decided, window.vfxConsent.ads];
	});
	check('the banner answers later: the bridge follows at once', changed.join() === 'false,true,true', changed.join());
	check('the bridge sends nothing anywhere (no request from it)', !(await get(fresh(LONG))).body.match(/visionforgex-page-js[^<]*(fetch|XMLHttpRequest|sendBeacon)/));

	console.log('6. Page facts and publish events');
	await page.click('[data-vfx-flag="signals"] .vfx-switch');
	await page.waitForSelector('[data-vfx-flag="signals"].is-on', { timeout: 20000 });
	const facts = await visit(LONG, () => window.vfxPage);
	check('the post says its category, tag, author, type and length', facts && facts.cat.join() === 'dinners' && facts.tag.join() === 'quick' && facts.author === 'admin' && facts.type === 'post' && facts.len === 'short', JSON.stringify(facts));
	check('not sensitive, not fewer, unless set', facts && !facts.sens && !facts.fewer);
	wp('post', 'meta', 'update', longId, '_visionforgex_sensitive', '1');
	wp('post', 'meta', 'update', longId, '_visionforgex_ads', 'fewer');
	const facts2 = await visit(LONG, () => window.vfxPage);
	check('"Sensitive content" and "Fewer ads" from the post\'s box', facts2.sens === true && facts2.fewer === true, JSON.stringify(facts2));
	check('a "fewer ads" post still carries the tag (the tag halves its ads)', hasTag((await get(fresh(LONG))).body));
	const box = php('ob_start(); VisionForgeX_Rules::render_box(get_post(' + longId + ')); echo ob_get_clean();');
	check('the box on the post shows both, chosen', /value="fewer"\s+checked/.test(box) && /name="visionforgex_sensitive" value="1"\s+checked/.test(box), box.slice(0, 300));
	wp('post', 'meta', 'delete', longId, '_visionforgex_ads');
	const arch = await visit(WP + '/category/dinners/', () => window.vfxPage);
	check('a category page says its category', arch && arch.type === 'archive' && arch.cat.join() === 'dinners', JSON.stringify(arch));
	const home = await visit(WP + '/', () => window.vfxPage);
	check('the home page says nothing (no facts to give)', home === undefined || home === null, JSON.stringify(home));
	check('nothing private: no user id, e-mail or comment in the facts', !JSON.stringify(facts2).match(/@|user_|comment/));
	wp('post', 'create', '--post_status=publish', '--post_title=Lemon pasta', '--post_name=lemon-pasta');
	check('a post published: VisionForgeX will hear it in the background', wp('cron', 'event', 'list', '--fields=hook', '--format=csv').includes('visionforgex_published'));
	wp('post', 'create', '--post_status=draft', '--post_title=Draft only');
	wp('cron', 'event', 'run', '--due-now');
	const pub = state(site.id).site.published || [];
	check('VisionForgeX heard the new post', pub.some((p) => p.url === WP + '/lemon-pasta/' && p.title === 'Lemon pasta'), JSON.stringify(pub));
	check('only that one (not the draft)', pub.length === 1, pub.length);
	check('the plugin logged it', php('echo wp_json_encode(VisionForgeX_Store::history());').includes('told of a new post'));
	wp('post', 'update', String(pub.length && JSON.parse(wp('post', 'list', '--name=lemon-pasta', '--field=ID', '--format=json'))[0]), '--post_title=Lemon pasta, again');
	check('an update to a published post is not a new post', !wp('cron', 'event', 'list', '--fields=hook', '--format=csv').includes('visionforgex_published'));

	console.log('7. Test ads for administrators');
	await page.click('[data-vfx-flag="qa"] .vfx-switch');
	await page.waitForSelector('[data-vfx-flag="qa"].is-on', { timeout: 20000 });
	check('the administrator gets test ads', await page.evaluate((u) => fetch(u).then((r) => r.text()).then((t) => t.includes('window.vfxQa=true')), fresh(LONG)));
	check('a visitor does not', !(await get(fresh(LONG))).body.includes('vfxQa'));
	await page.screenshot({ path: path.join(SHOTS, 'p3-3-privacy.png'), fullPage: true });
	check('the switches came from WordPress: nothing pushed back', !state(site.id).push);

	console.log('8. Instant sync from VisionForgeX');
	const ch = JSON.parse(platform('change', site.id, JSON.stringify({ mode: 'hybrid' })));
	check('a change saved on VisionForgeX', ch.ok !== false, JSON.stringify(ch));
	check('… waits to be pushed to WordPress', JSON.stringify((state(site.id).push || {}).actions) === '["sync"]', JSON.stringify(state(site.id).push));
	const run1 = platform('run');
	check('the job sends it', run1.includes('"sent":1'), run1);
	check('WordPress has the new settings at once', php('echo VisionForgeX_Store::snapshot()["settings"]["mode"];') === 'hybrid');
	const st1 = state(site.id);
	check('VisionForgeX: pushed, nothing waiting', !st1.push && !!st1.site.pushedAt && !st1.site.pushError, JSON.stringify(st1.push));
	check('the plugin logged it', php('echo wp_json_encode(VisionForgeX_Store::history());').includes('From VisionForgeX: sync'));
	platform('queue', site.id, 'health');
	platform('queue', site.id, 'clear');
	const run2 = platform('run');
	check('"Check now" and "Clear its cache" in one push', run2.includes('"sent":1'), run2);
	check('the site check is on its way', wp('cron', 'event', 'list', '--fields=hook', '--format=csv').includes('visionforgex_check_now'));
	check('logged: clear, health', php('echo wp_json_encode(VisionForgeX_Store::history());').includes('From VisionForgeX: clear, health'));
	wp('cron', 'event', 'run', 'visionforgex_check_now');
	platform('change', site.id, JSON.stringify({ mode: 'manual' }));
	const capFile = path.join(SHOTS, '..', '.push-capture.json');
	platform('capture', site.id, capFile);
	const cap = readJson(capFile);
	fs.rmSync(capFile, { force: true });
	const send = (h, b) => fetch(cap.url, { method: 'POST', headers: h, body: b === undefined ? cap.body : b }).then(async (r) => ({ status: r.status, j: await r.json().catch(() => ({})) }));
	const p1 = await send(cap.headers);
	check('a signed push is taken', p1.status === 200 && p1.j.ok && p1.j.done.join() === 'sync', JSON.stringify(p1));
	check('… and its settings kept', php('echo VisionForgeX_Store::snapshot()["settings"]["mode"];') === 'manual');
	const p2 = await send(cap.headers);
	check('the same push again: refused (replay)', p2.status === 401 && p2.j.message === 'replay', JSON.stringify(p2));
	const p3 = await send(Object.assign({}, cap.headers, { 'X-VFX-Nonce': 'AAAAAAAAAAAAAAAAAAAAAAAA' }));
	check('a changed nonce: refused (signature)', p3.status === 401 && p3.j.message === 'bad_signature', JSON.stringify(p3));
	const p4 = await send(Object.assign({}, cap.headers, { 'X-VFX-Nonce': 'BBBBBBBBBBBBBBBBBBBBBBBB' }), cap.body.replace('"manual"', '"auto"'));
	check('a changed body: refused', p4.status === 401 && p4.j.message === 'bad_signature', JSON.stringify(p4));
	const p5 = await send(Object.assign({}, cap.headers, { 'X-VFX-Time': String(Math.floor(Date.now() / 1000) - 900) }));
	check('an old push: refused (clock)', p5.status === 401 && p5.j.message === 'clock', JSON.stringify(p5));
	const p6 = await send({ 'Content-Type': 'application/json' });
	check('unsigned: refused', p6.status === 401 && p6.j.message === 'unsigned', JSON.stringify(p6));
	const p7 = await send(Object.assign({}, cap.headers, { 'X-VFX-Key': 'k_someoneelse' }));
	check('another key: refused', p7.status === 401 && p7.j.message === 'unknown_key', JSON.stringify(p7));
	check('none of the refused pushes changed anything', php('echo VisionForgeX_Store::snapshot()["settings"]["mode"];') === 'manual');

	console.log('9. Staging addresses');
	await tab('Settings', '.vfx-card:has-text("Staging addresses")');
	const stg = page.locator('.vfx-card:has-text("Staging addresses")');
	await stg.locator('input').fill('wpdemo-vfx.com');
	await stg.locator('button:has-text("Add")').click();
	await stg.locator('button:has-text("Save")').click();
	await page.waitForFunction(() => document.querySelector('.vfx-status') && /stag|quiet|copy/i.test(document.querySelector('.vfx-top').innerText), null, { timeout: 20000 }).catch(() => {});
	check('this address on the list: the site goes quiet (no tag)', !hasTag((await get(fresh(WP + '/'))).body));
	check('… and says why', php('echo VisionForgeX_Store::staging_reason();').includes('list of staging addresses'));
	await stg.locator('.vfx-pick:has-text("wpdemo-vfx.com")').click();
	await stg.locator('button:has-text("Save")').click();
	await sleep(800);
	check('taken off the list: the tag is back', hasTag((await get(fresh(WP + '/'))).body));
	const wild = php('update_option("visionforgex_staging_hosts", array("*.wpdemo-vfx.com")); $a = VisionForgeX_Store::staging_reason(); add_filter("option_home", function(){ return "http://shop.wpdemo-vfx.com"; }); $b = VisionForgeX_Store::staging_reason(); update_option("visionforgex_staging_hosts", array()); echo wp_json_encode(array($a, $b));');
	const w = JSON.parse(wild);
	check('*.wpdemo-vfx.com covers its sub-domains, not the site itself', w[0] === '' && w[1].includes('shop.wpdemo-vfx.com'), wild);
	check('staging hosts are cleaned: no paths, no junk', php('echo wp_json_encode(VisionForgeX_Store::save_staging_hosts(array("https://Stage.Example.com/x", "*.dev.example.com", "not a host!", "")));') === '["stage.example.com","*.dev.example.com"]');
	php('VisionForgeX_Store::save_staging_hosts(array());');

	console.log('10. More rules: tags and authors');
	await tab('Where ads show');
	await page.click('.vfx-master .vfx-switch');
	await page.click('.vfx-chips[aria-label="Tags"] .vfx-pick:has-text("quick")');
	await saveBar();
	check('a post tagged "quick": no tag', !hasTag((await get(fresh(LONG))).body));
	check('a post without it: the tag as usual', hasTag((await get(fresh(SHORT))).body));
	check('the tag\'s own page: no tag', !hasTag((await get(fresh(WP + '/tag/quick/'))).body));
	await page.click('.vfx-chips[aria-label="Tags"] .vfx-pick:has-text("quick")');
	await page.click('.vfx-chips[aria-label="Authors"] .vfx-pick:has-text("admin")');
	await saveBar();
	check('posts by that author: no tag', !hasTag((await get(fresh(LONG))).body));
	check('a post by no one in particular: the tag as usual', hasTag((await get(fresh(SHORT))).body));
	await page.click('.vfx-chips[aria-label="Authors"] .vfx-pick:has-text("admin")');
	await page.click('.vfx-master .vfx-switch');
	await saveBar();
	const tpl = JSON.parse(php('$t = array_keys(VisionForgeX_Rules::templates()); $r = VisionForgeX_Rules::save(array("on" => false, "templates" => array_merge(array_slice($t, 0, 1), array("not-a-template")), "tags" => array("3", "x"), "authors" => array(1))); echo wp_json_encode(array($t, $r["templates"], $r["tags"], $r["authors"]));'));
	check('templates: only the theme\'s own are kept; tags and authors as numbers', tpl[0].length > 0 && JSON.stringify(tpl[1]) === JSON.stringify(tpl[0].slice(0, 1)) && JSON.stringify(tpl[2]) === '[3]' && JSON.stringify(tpl[3]) === '[1]', JSON.stringify(tpl));
	php('VisionForgeX_Rules::save(array("on" => false));');
	check('rules off: the tag everywhere again', hasTag((await get(fresh(LONG))).body));

	console.log('11. Move over from Ad Inserter');
	php('update_option("ad_inserter", array(1 => array("name" => "In article", "code" => "<ins>x</ins>", "display_type" => "after paragraph", "paragraph_number" => "3, 6"), 2 => array("name" => "Top of post", "code" => "<ins>x</ins>", "display_type" => "before post"), 3 => array("name" => "By the title", "code" => "<ins>x</ins>", "display_type" => 17, "html_selector" => ".wp-block-post-title"), 4 => array("name" => "Sidebar", "code" => "<ins>x</ins>", "display_type" => 0), 5 => array("name" => "Empty", "code" => "", "display_type" => "footer"), "global" => array("x" => 1)));');
	await page.reload();
	await tab('Placements', '[data-vfx-import]');
	check('five blocks in the preview', (await page.locator('[data-vfx-import]').count()) === 5);
	check('three will be made, two skipped (why is said)', (await page.locator('[data-vfx-import]:has-text("Will be made")').count()) === 3 && (await page.locator('[data-vfx-import="4"]').innerText()).includes('manual') && (await page.locator('[data-vfx-import="5"]').innerText()).includes('empty'));
	check('the in-content block: after paragraph 3, then every 3', (await page.locator('[data-vfx-import="1"]').innerText()).includes('after paragraph 3, then every 3'));
	await page.click('button:has-text("Make 3 spots (switched off)")');
	await page.waitForFunction(() => document.querySelectorAll('[data-vfx-sel]').length === 2, null, { timeout: 20000 });
	const after = JSON.parse(php('echo wp_json_encode(array("spots" => array_values(VisionForgeX_Spots::spots()), "ic" => VisionForgeX_Spots::incontent()));'));
	const made = after.spots.filter((s) => /From Ad Inserter/.test(s.label));
	check('made: before the content and after the title selector, both off', made.length === 2 && made.every((s) => !s.on) && made.some((s) => s.kind === 'hook' && s.where === 'beforeContent') && made.some((s) => s.kind === 'selector' && s.selector === '.wp-block-post-title' && s.position === 'after'), JSON.stringify(made));
	check('the in-content rule: 3, every 3, at most 2, off to check first', after.ic.first === 3 && after.ic.every === 3 && after.ic.max === 2 && !after.ic.on, JSON.stringify(after.ic));
	check('the spots there before are kept', after.spots.length === 5, after.spots.length);
	check('Ad Inserter itself is left as it is', php('echo count(get_option("ad_inserter"));') === '6');
	check('no ad code was copied', !JSON.stringify(after).includes('<ins>'));
	php('update_option("ad_inserter", base64_encode(serialize(array(7 => array("name" => "Footer", "code" => "x", "display_type" => 13), 8 => array("name" => new ArrayObject(array()), "code" => "x", "display_type" => "after html element", "html_selector" => array("x")), "o" => new ArrayObject(array())))));');
	const preview = wp('visionforgex', 'import-adinserter');
	check('WP-CLI: the newer (encoded) storage is read too', preview.includes('MAKE  Block 7 "Footer": theme spot: footer') && preview.includes('SKIP  Block 8'), preview);
	check('WP-CLI: a preview changes nothing', preview.includes('Nothing changed') && JSON.parse(php('echo wp_json_encode(array_values(VisionForgeX_Spots::spots()));')).length === 5);
	check('objects in the stored data are never built, and odd values are read as empty', !preview.includes('ERROR') && preview.includes('SKIP  Block 8 "Block 8": no HTML element given') && php('$b = VisionForgeX_Import::blocks(); echo get_class($b[8]["name"]);') === '__PHP_Incomplete_Class');
	const doIt = wp('visionforgex', 'import-adinserter', '--yes');
	check('WP-CLI --yes: made, switched off', doIt.includes('1 spot(s) made') && JSON.parse(php('echo wp_json_encode(array_values(VisionForgeX_Spots::spots()));')).length === 6, doIt);
	php('delete_option("ad_inserter");');
	await page.reload();
	await tab('Placements', '[data-vfx-incontent]');
	check('no Ad Inserter settings: no import card', !(await page.locator('[data-vfx-import]').count()));

	console.log('12. WP-CLI');
	const help = wp('help', 'visionforgex');
	check('wp help visionforgex lists the commands', ['status', 'sync', 'check', 'pause', 'resume', 'adstxt', 'spots', 'import-adinserter', 'diagnostics', 'disconnect', 'connect-url'].every((c) => help.includes(c)), help);
	const st = JSON.parse(wp('visionforgex', 'status', '--format=json'));
	check('status: connected, serving, approved', st.connected === 'yes' && st.serving === 'yes' && st.approved === 'yes' && st.site.includes('wpdemo-vfx.com'), JSON.stringify(st));
	check('status as a table', wp('visionforgex', 'status').includes('connected'));
	const sp = wp('visionforgex', 'spots');
	check('spots: in-content, theme and selector spots', sp.includes('in-content') && sp.includes('hook') && sp.includes('selector') && sp.includes('beforeContent'), sp);
	check('sync', wp('visionforgex', 'sync').includes('Up to date'));
	const chk = wp('visionforgex', 'check');
	check('check', chk.includes('Checked.') && /OK|WARN|BAD/.test(chk), chk);
	check('pause: the tag is off every page', wp('visionforgex', 'pause').includes('paused') && !hasTag((await get(fresh(WP + '/'))).body));
	check('resume: back', wp('visionforgex', 'resume').includes('back on') && hasTag((await get(fresh(WP + '/'))).body));
	const at = wp('visionforgex', 'adstxt');
	check('adstxt: how it is kept and the lines', at.includes('Kept: served') && at.includes('visionforgex.com, 1001, DIRECT'), at);
	const diag = wp('visionforgex', 'diagnostics');
	const secretSeen = php('echo (int) (false !== strpos(' + JSON.stringify(diag).replace(/\$/g, '\\$') + ', (string) VisionForgeX_Store::secret()));');
	check('diagnostics: the support bundle, without the key', diag.startsWith('{') && secretSeen === '0' && !/"secret"/.test(diag), secretSeen);
	check('connect-url', wp('visionforgex', 'connect-url').includes('/wp-admin/admin.php?page=visionforgex'));

	console.log('13. Admin dashboard: no errors, phones, dark');
	await page.evaluate(() => document.getElementById('visionforgex-app').setAttribute('data-theme', 'dark'));
	await tab('Privacy');
	await page.screenshot({ path: path.join(SHOTS, 'p3-4-privacy-dark.png') });
	await page.setViewportSize({ width: 390, height: 844 });
	for (const t of ['Placements', 'Privacy', 'Settings']) {
		await page.click('.vfx-tab:has-text("' + t + '")');
		await sleep(500);
		const wide = await page.evaluate(() => document.documentElement.scrollWidth);
		check('390 px, ' + t + ': nothing pushes the page sideways', wide <= 390, wide);
	}
	await page.setViewportSize({ width: 1400, height: 950 });
	check('no script errors in the dashboard', !errors.length, errors.join(' | '));
	const dbg = path.join(WPDIR, 'debug.log');
	const log = fs.existsSync(dbg) ? fs.readFileSync(dbg, 'utf8').split('\n').filter((l) => /plugins\/visionforgex\//.test(l)) : [];
	check('no PHP notice from the plugin', !log.length, log.slice(0, 3).join(' | '));

	console.log('14. Disconnect');
	check('disconnect --yes', wp('visionforgex', 'disconnect', '--yes').includes('Disconnected'));
	const gone = state(site.id);
	check('VisionForgeX forgot the site and its pushes', !gone.site && !gone.push, JSON.stringify(gone));
	check('nothing printed any more: no tag, no spots, no page script', !(await get(fresh(LONG))).body.match(/data-vfx-plugin|visionforgex-spot|visionforgex-page-js/));
	await browser.close();

	if (process.env.NO_NETWORK !== '1') {
		console.log('15. A multisite network');
		execSync('MULTISITE=1 bash ' + path.join(__dirname, 'setup.sh') + ' ' + WPSRC + ' > /tmp/claude-0/setup-net.log 2>&1');
		const NET = 'http://wpnet-vfx.com';
		const NDIR = path.join(__dirname, '.wp', 'net');
		const n = (url, ...a) => cli(NDIR, url, a);
		check('network-activated', n(NET, 'plugin', 'list', '--status=active-network', '--field=name').includes('visionforgex'));
		check('the main site has its jobs', n(NET, 'cron', 'event', 'list', '--fields=hook', '--format=csv').includes('visionforgex_sync'));
		n(NET, 'site', 'create', '--slug=second', '--title=Second');
		check('a site made later gets its jobs too', n(NET + '/second/', 'cron', 'event', 'list', '--fields=hook', '--format=csv').includes('visionforgex_daily'));
		const s2 = JSON.parse(n(NET + '/second/', 'eval', 'echo wp_json_encode(VisionForgeX_Rest::snapshot_for_app()["multisite"]);'));
		check('the second site knows it is not the main one, and where the network page is', s2 && s2.main === false && s2.network.includes('/wp-admin/network/admin.php?page=visionforgex-network'), JSON.stringify(s2));
		const a0 = JSON.parse(n(NET + '/second/', 'eval', 'echo wp_json_encode(VisionForgeX_Adstxt::status());'));
		check('a second site in a sub-folder: /ads.txt is the main site\'s, so lines by hand', a0.mode === 'manual' && /shared by all its sites/.test(a0.reason), JSON.stringify(a0));
		fs.writeFileSync(path.join(NDIR, 'ads.txt'), 'google.com, pub-1, DIRECT\n');
		const a1 = JSON.parse(n(NET, 'eval', 'echo wp_json_encode(VisionForgeX_Adstxt::status());'));
		const a2 = JSON.parse(n(NET + '/second/', 'eval', 'echo wp_json_encode(VisionForgeX_Adstxt::status());'));
		check('one ads.txt file for the network: the main site keeps it', a1.mode === 'file', a1.mode);
		check('… a second site never writes into it (lines by hand, it says why)', a2.mode === 'manual' && /shared by all its sites/.test(a2.reason), JSON.stringify(a2));
		const nb = await chromium.launch();
		const np = await (await nb.newContext({ viewport: { width: 1300, height: 900 } })).newPage();
		const nerr = [];
		np.on('pageerror', (e) => nerr.push(e.message));
		await np.goto(NET + '/wp-login.php');
		await np.fill('#user_login', 'admin');
		await np.fill('#user_pass', 'admin-test-pass');
		await np.click('#wp-submit');
		await np.waitForURL(/wp-admin/);
		await np.goto(NET + '/wp-admin/network/admin.php?page=visionforgex-network');
		await np.waitForSelector('[data-vfx-net-site]');
		check('Network Admin → VisionForgeX: every site, its state', (await np.locator('[data-vfx-net-site]').count()) === 2 && (await np.locator('body').innerText()).includes('Not connected'));
		await np.screenshot({ path: path.join(SHOTS, 'p4-2-network.png') });
		await np.goto(NET + '/wp-admin/admin.php?page=visionforgex');
		await np.waitForSelector('button:has-text("Connect with VisionForgeX")');
		check('the main site\'s dashboard opens on a network', !nerr.length, nerr.join(' | '));
		await nb.close();
		n(NET + '/second/', 'option', 'update', 'visionforgex_spots', '{"x":1}', '--format=json');
		n(NET, 'plugin', 'deactivate', 'visionforgex', '--network');
		check('deactivated for the network: every site\'s jobs stop', !n(NET + '/second/', 'cron', 'event', 'list', '--fields=hook', '--format=csv').includes('visionforgex'));
		n(NET, 'plugin', 'uninstall', 'visionforgex');
		check('removed: every site\'s settings go', n(NET + '/second/', 'option', 'get', 'visionforgex_spots').startsWith('ERROR') && n(NET, 'option', 'get', 'visionforgex_settings').startsWith('ERROR'));
		for (const pid of execSync("ss -ltnp | grep ':80 ' | grep -o 'pid=[0-9]*' | cut -d= -f2 | sort -u || true", { encoding: 'utf8' }).split('\n').filter(Boolean)) process.kill(Number(pid));
	}

	console.log('\n' + pass + ' passed, ' + fail + ' failed');
	process.exit(fail ? 1 : 0);
})().catch((e) => {
	console.error(e);
	process.exit(1);
});
