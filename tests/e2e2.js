/*
 * Phase 2 end to end: Formats (changed on VisionForgeX through the plugin, the platform's rules, nothing else in the
 * site's file touched), the preview, Ad Tags, the block, the shortcode and the widget, Where ads show and the per-post
 * setting, Site tools (real Autoptimize and LiteSpeed Cache from their GitHub sources; stand-ins named as such for
 * Ad Inserter and Site Kit), in a real WordPress and a real browser, against the platform's test server.
 *
 *   bash tests/setup.sh <WordPress folder> 8180 > /tmp/setup.log
 *   node tests/e2e2.js           (PLUGINS=/path/to/clones for autoptimize and lscache_wp; default /tmp/claude-0/wpplugins)
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
const PLUGINS = process.env.PLUGINS || '/tmp/claude-0/wpplugins';
const SHOTS = path.join(__dirname, 'shots');
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
const wp = (...args) => execFileSync('php', [WPCLI, '--path=' + WPDIR, '--allow-root', '--url=' + WP, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
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
const without = (o, keys) => {
	const c = JSON.parse(JSON.stringify(o));
	keys.forEach((k) => {
		const p = k.split('.');
		let x = c;
		for (let i = 0; i < p.length - 1; i++) x = x[p[i]] || {};
		delete x[p[p.length - 1]];
	});
	return c;
};

// A clean platform.
const before = siteFor('wpdemo-vfx.com');
if (before) fs.unlinkSync(before.file);
const keep = {};
for (const f of ['_wp-connector.json', '_ads-txt-default.json', '_ads-txt-status.json']) {
	const p = path.join(CONFIG, f);
	keep[p] = fs.existsSync(p) ? fs.readFileSync(p) : null;
}
fs.rmSync(path.join(CONFIG, '_wp-connector.json'), { force: true });
fs.writeFileSync(path.join(CONFIG, '_ads-txt-default.json'), JSON.stringify({ content: 'visionforgex.com, 1001, DIRECT\n', updatedAt: new Date().toISOString() }));

(async () => {
	const browser = await chromium.launch();
	const ctx = await browser.newContext({ viewport: { width: 1400, height: 950 } });
	const page = await ctx.newPage();
	const errors = [];
	page.on('pageerror', (e) => errors.push(e.message));
	const api = (route, data) => page.evaluate(([r, d]) => wp.apiFetch({ path: '/visionforgex/v1/' + r, method: 'POST', data: d }).then((x) => ({ ok: true, x }), (e) => ({ ok: false, message: e.message })), [route, data]);

	console.log('0. Connect, then VisionForgeX sets the site up (approved, network, ad units except native)');
	await page.goto(WP + '/wp-login.php');
	await page.fill('#user_login', 'admin');
	await page.fill('#user_pass', 'admin-test-pass');
	await page.click('#wp-submit');
	await page.waitForURL(/wp-admin/);
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
	cfg.customForTest = { untouched: true };
	writeJson(site.file, cfg);
	wp('eval', 'VisionForgeX_Api::sync();');
	await page.waitForFunction(() => !document.querySelector('.vfx-btn.is-busy'), null, { timeout: 30000 });
	await page.reload();
	await page.waitForSelector('.vfx-top');
	check('connected and live', (await page.locator('.vfx-status').innerText()).includes('Live'));

	console.log('1. Formats');
	await page.click('.vfx-tab:has-text("Formats")');
	await page.waitForSelector('[data-vfx-format="banner"]');
	check('five formats listed', (await page.locator('.vfx-format').count()) === 5);
	check('native not ready (no ad unit): its switch is disabled and says why', (await page.locator('[data-vfx-format="native"] .vfx-switch').isDisabled()) && (await page.locator('[data-vfx-format="native"]').innerText()).includes('ad unit'));
	check('no save bar before a change', !(await page.locator('.vfx-savebar.is-up').count()));
	await page.click('[data-vfx-format="banner"] .vfx-switch');
	await page.click('[data-vfx-format="banner"] .vfx-format-more');
	const sizesBefore = await page.locator('[data-vfx-format="banner"] .vfx-pick.is-on').allInnerTexts();
	for (const z of sizesBefore) if (z !== '300x250') await page.click('[data-vfx-format="banner"] .vfx-pick:text-is("' + z + '")');
	if (!sizesBefore.includes('300x250')) await page.click('[data-vfx-format="banner"] .vfx-pick:text-is("300x250")');
	await page.click('[data-vfx-format="banner"] .vfx-pick:text-is("728x90")');
	await page.click('[data-vfx-format="banner"] .vfx-line .vfx-switch');
	await page.click('[data-vfx-format="anchor"] .vfx-switch');
	await page.click('[data-vfx-format="anchor"] .vfx-format-more');
	await page.click('[data-vfx-format="anchor"] .vfx-seg button:has-text("Top")');
	await page.click('[data-vfx-format="rewarded"] .vfx-switch');
	await page.click('[data-vfx-format="rewarded"] .vfx-format-more');
	await page.fill('[data-vfx-format="rewarded"] input >> nth=0', 'Unlock the full recipe');
	await page.waitForSelector('.vfx-savebar.is-up');
	check('the save bar counts the changes', /\d+ changes, not saved yet/.test(await page.locator('.vfx-savebar').innerText()), await page.locator('.vfx-savebar').innerText());
	check('preview: the banner shows its first size', (await page.locator('.vfx-pv-ad').first().innerText()).includes('300x250'));
	check('preview: the anchor at the top', (await page.locator('.vfx-pv-anchor.is-top').count()) === 1);
	check('preview: sticky marked on the last banner', (await page.locator('.vfx-pv-ad.is-sticky').count()) === 1);
	await page.click('button:has-text("Show the rewarded prompt")');
	check('preview: the rewarded prompt with the new headline', (await page.locator('.vfx-pv-reward').innerText()).includes('Unlock the full recipe'));
	await sleep(700);
	await page.screenshot({ path: path.join(SHOTS, 'p2-1-formats.png') });
	await page.click('.vfx-pv-overlay');
	const beforeSave = readJson(site.file);
	await page.click('.vfx-savebar button:has-text("Save and publish")');
	await page.waitForSelector('.vfx-toast:has-text("Saved and published")');
	const after = readJson(site.file);
	const fb = after.formats.banner;
	check('saved on VisionForgeX: banner on, sizes 300x250 + 728x90, sticky', fb.enabled === true && JSON.stringify(fb.sizes) === JSON.stringify([[300, 250], [728, 90]]) && fb.sticky === true, JSON.stringify(fb));
	check('anchor on at the top, rewarded on with the new headline', after.formats.anchor.enabled === true && after.formats.anchor.position === 'top' && after.formats.rewarded.enabled === true && after.formats.rewarded.prompt.headline === 'Unlock the full recipe');
	const changedKeys = ['formats.banner.enabled', 'formats.banner.sizes', 'formats.banner.sticky', 'formats.anchor.enabled', 'formats.anchor.position', 'formats.rewarded.enabled', 'formats.rewarded.prompt.headline'];
	// Everything that was in the file before, other than what was changed, is exactly as it was.
	const flat = (o, pre, out) => {
		Object.keys(o).forEach((k) => {
			const v = o[k];
			if (v && typeof v === 'object' && !Array.isArray(v)) flat(v, pre + k + '.', out);
			else out[pre + k] = JSON.stringify(v);
		});
		return out;
	};
	const fB = flat(beforeSave, '', {});
	const fA = flat(after, '', {});
	const moved = Object.keys(fB).filter((k) => !changedKeys.includes(k) && fA[k] !== fB[k]);
	check('nothing else in the site\u2019s file changed (network code, ad unit paths, approval, a key of its own)', moved.length === 0 && fA['customForTest.untouched'] === 'true' && fA['networkCode'] === '"12345678"', moved.join(', '));
	check('the platform logged it as changed from WordPress, by name', JSON.stringify(readJson(path.join(CONFIG, '_wp-connector.json')).log).includes('changed from WordPress by admin: Banner on'));
	check('and the plugin’s own Recent changes too', wp('option', 'get', 'visionforgex_history', '--format=json').includes('Ad settings: Banner on'));
	check('the save bar went away', !(await page.locator('.vfx-savebar.is-up').count()));

	let r = await api('settings', { changes: { refresh: { seconds: 20 } } });
	check('refresh faster than 30 s refused, with the reason', !r.ok && /30 to 600/.test(r.message), r.message);
	r = await api('settings', { changes: { formats: { native: { enabled: true } } } });
	check('native refused until its ad unit is made', !r.ok && /ad unit is not made/.test(r.message), r.message);
	r = await api('settings', { changes: { formats: { banner: { sizes: ['999x999'] } } } });
	check('a size not on the list refused', !r.ok && /sizes from the list/.test(r.message), r.message);
	r = await api('settings', { changes: { networkCode: '999', approved: true, mode: 'manual' } });
	const nowCfg = readJson(site.file);
	check('only known settings change (network code and approval ignored), mode changed', r.ok && nowCfg.networkCode === '12345678' && nowCfg.mode === 'manual', JSON.stringify(r));
	await api('settings', { changes: { mode: 'auto' } });

	await page.click('.vfx-preview .vfx-seg button:has-text("Desktop")');
	await sleep(600);
	await page.screenshot({ path: path.join(SHOTS, 'p2-2-formats-desktop-preview.png') });

	console.log('2. Ad Tags, the shortcode, the block, the widget');
	await page.click('.vfx-tab:has-text("Placements")');
	await page.waitForSelector('[data-vfx-adtags] .vfx-empty');
	await page.fill('[data-vfx-adtags] .vfx-field input[type="text"]', 'Sidebar');
	await page.click('[data-vfx-adtags] .vfx-chips .vfx-pick:text-is("300x600")');
	await page.click('button:has-text("Add Ad Tag")');
	await page.waitForSelector('.vfx-tagrow');
	const tag = (readJson(site.file).adTags || []).find((t) => t.name === 'Sidebar');
	check('Ad Tag made on VisionForgeX with its sizes', tag && /^tag_[a-f0-9]{12}$/.test(tag.id) && JSON.stringify(tag.sizes) === JSON.stringify([[300, 250], [300, 600]]), JSON.stringify(tag));
	check('listed with its shortcode', (await page.locator('.vfx-tagrow code').innerText()) === '[visionforgex tag="' + tag.id + '"]');
	await sleep(500);
	await page.screenshot({ path: path.join(SHOTS, 'p2-3-adtags.png') });
	const pid = wp('post', 'create', '--post_status=publish', '--post_title=Spots test', '--post_name=spots-test', '--porcelain', '--post_content=<p>Intro.</p>[visionforgex tag="' + tag.id + '"][visionforgex format="native"][visionforgex tag="tag_000000000000"]<!-- wp:visionforgex/ad {"tag":"' + tag.id + '"} /--><!-- wp:visionforgex/ad {"format":"native"} /-->');
	let html = (await get(WP + '/spots-test/')).body;
	const spots = html.match(/<div data-adx-slot[^>]*><\/div>/g) || [];
	check('shortcode and block print the Ad Tag’s spot', spots.filter((x) => x.includes('data-adx-tag="' + tag.id + '"')).length === 2, spots.join(' | '));
	check('native spots by shortcode and block', spots.filter((x) => x === '<div data-adx-slot data-adx-format="native"></div>').length === 2, spots.join(' | '));
	check('an Ad Tag that does not exist prints nothing', !html.includes('tag_000000000000'));
	check('the spots sit in a wrapper the theme can style', (html.match(/class="visionforgex-spot visionforgex-spot--(shortcode|block)"/g) || []).length === 4);
	const widget = wp('eval', 'the_widget( "VisionForgeX_Widget", array( "tag" => "' + tag.id + '" ) );');
	check('the widget prints the same spot', widget.includes('data-adx-tag="' + tag.id + '"') && widget.includes('visionforgex-spot--widget'), widget);
	await page.goto(WP + '/wp-admin/post-new.php');
	await page.waitForFunction(() => window.wp && wp.blocks && wp.blocks.getBlockType && wp.blocks.getBlockType('visionforgex/ad'), null, { timeout: 30000 });
	const bt = await page.evaluate(() => {
		const t = wp.blocks.getBlockType('visionforgex/ad');
		return { title: t.title, tags: (window.visionforgexBlock || {}).tags };
	});
	check('the block is in the editor, with the Ad Tags to choose from', bt.title === 'VisionForgeX ad' && bt.tags.length === 1 && bt.tags[0].name === 'Sidebar', JSON.stringify(bt));
	check('the per-post box is on the edit screen', (await page.locator('#visionforgex-ads').count()) === 1);
	await page.goto(WP + '/wp-admin/admin.php?page=visionforgex#adtags');
	await page.waitForSelector('.vfx-tagrow');
	check('the old #adtags address opens Placements', (await page.locator('.vfx-tab.is-on').innerText()).includes('Placements'));
	await page.click('.vfx-tagrow button:has-text("Remove")');
	await page.click('.vfx-modal button.vfx-btn--danger');
	await page.waitForSelector('[data-vfx-adtags] .vfx-empty');
	check('Ad Tag removed on VisionForgeX', !(readJson(site.file).adTags || []).some((t) => t.id === tag.id));
	html = (await get(WP + '/spots-test/')).body;
	check('its shortcode and block now print nothing; the page is otherwise fine', !html.includes(tag.id) && html.includes('Intro.'));

	console.log('3. Where ads show');
	check('rules off by default: the tag on the article', hasTag((await get(WP + '/ten-weeknight-dinners/')).body));
	await page.click('.vfx-tab:has-text("Where ads show")');
	await page.waitForSelector('.vfx-master');
	check('off by default and the cards dimmed', (await page.locator('.vfx-master.is-on').count()) === 0 && (await page.locator('.vfx-card.is-dim').count()) === 2);
	await page.click('.vfx-master .vfx-switch');
	await page.click('.vfx-pick:text-is("Uncategorized")');
	await page.fill('.vfx-addrow input', '/spots-test');
	await page.click('.vfx-addrow button');
	await page.click('.vfx-line:has-text("Anyone logged in") .vfx-switch');
	await sleep(400);
	await page.screenshot({ path: path.join(SHOTS, 'p2-4-where.png'), fullPage: true });
	await page.click('.vfx-savebar button:has-text("Save")');
	await page.waitForSelector('.vfx-toast:has-text("Where ads show")');
	check('a post in an excluded category: no tag', !hasTag((await get(WP + '/ten-weeknight-dinners/')).body));
	check('an address that matches: no tag', !hasTag((await get(WP + '/spots-test/')).body));
	check('the home page still has it (for a visitor)', hasTag((await get(WP + '/')).body));
	const cookies = (await ctx.cookies()).filter((c) => c.domain.includes('wpdemo')).map((c) => c.name + '=' + c.value).join('; ');
	check('logged in: no tag', !hasTag((await get(WP + '/', { Cookie: cookies })).body));
	wp('post', 'meta', 'update', '1', '_visionforgex_ads', 'off');
	await api('rules', { rules: Object.assign({}, JSON.parse(wp('option', 'get', 'visionforgex_rules', '--format=json')), { on: false }) });
	check('rules off again: the article has the tag again', hasTag((await get(WP + '/ten-weeknight-dinners/')).body));
	check('…except a page set to "No ads on this page" (honoured even with the rules off)', !hasTag((await get(WP + '/?p=1')).body));
	wp('post', 'meta', 'delete', '1', '_visionforgex_ads');

	console.log('4. Site tools: real Autoptimize and LiteSpeed Cache');
	const plugdir = path.join(WPDIR, 'wp-content/plugins');
	let haveAO = fs.existsSync(path.join(PLUGINS, 'autoptimize/autoptimize.php'));
	let haveLS = fs.existsSync(path.join(PLUGINS, 'lscache_wp/litespeed-cache.php'));
	if (haveAO) {
		fs.cpSync(path.join(PLUGINS, 'autoptimize'), path.join(plugdir, 'autoptimize'), { recursive: true });
		wp('plugin', 'activate', 'autoptimize');
		wp('option', 'update', 'autoptimize_js', 'on');
		wp('option', 'update', 'autoptimize_js_aggregate', 'on');
		wp('option', 'update', 'autoptimize_js_include_inline', 'on');
		// A script of the site's own for Autoptimize to combine (this theme loads none).
		fs.mkdirSync(path.join(WPDIR, 'wp-content/mu-plugins'), { recursive: true });
		fs.writeFileSync(path.join(WPDIR, 'wp-content/uploads/vfx-own.js'), 'window.vfxOwn = 1;');
		fs.writeFileSync(path.join(WPDIR, 'wp-content/mu-plugins/own-script.php'), '<?php add_action( "wp_enqueue_scripts", function () { wp_enqueue_script( "own", content_url( "uploads/vfx-own.js" ), array(), "1" ); } );');
	}
	if (haveAO) {
		html = (await get(WP + '/')).body;
		const ours = (html.match(/<script[^>]*data-vfx-plugin[^>]*>/g) || []);
		check('with Autoptimize combining scripts, both our scripts are still there, async, untouched', ours.length === 2 && ours.every((t) => /\sasync/.test(t) && !/\sdefer[\s>=]/.test(t) && !/autoptimize/.test(t)), ours.join(' | '));
		check("…and Autoptimize really is combining (its own file in the page)", /cache\/autoptimize\/autoptimize_[a-f0-9]+\.(js|php)/.test(html) && !html.includes("vfx-own.js"), (html.match(/<script[^>]*src="[^"]*"/g) || []).join(" | "));
	}
	if (haveLS) {
		fs.cpSync(path.join(PLUGINS, 'lscache_wp'), path.join(plugdir, 'litespeed-cache'), { recursive: true });
		try {
			wp('plugin', 'activate', 'litespeed-cache');
		} catch (e) {
			haveLS = false;
			console.log('  (LiteSpeed Cache would not activate here: ' + String(e.stderr || e.message).slice(0, 160) + ')');
		}
		if (haveLS) {
			wp('option', 'update', 'litespeed.conf.optm-js_defer', '2');
			wp('option', 'update', 'litespeed.conf.optm-js_comb', '1');
			const lsHtml = (await get(WP + '/?ls=' + Date.now())).body;
			check('…and LiteSpeed really is delaying the site\u2019s other scripts', /type="litespeed\/javascript"/.test(lsHtml));
		}
	}
	await page.goto(WP + '/wp-admin/admin.php?page=visionforgex#tools');
	await page.waitForSelector('.vfx-tab.is-on:has-text("Site tools")');
	await page.click('button:has-text("Check again")');
	await page.waitForFunction(() => !document.querySelector('.vfx-btn.is-busy'), null, { timeout: 40000 });
	if (haveAO) {
		check('Autoptimize found, "Kept off the tag"', (await page.locator('[data-vfx-speed="autoptimize"]').innerText()).includes('Kept off the tag'));
	} else check('Autoptimize source not available at ' + PLUGINS, false);
	if (haveLS) {
		check('LiteSpeed Cache found', (await page.locator('[data-vfx-speed="litespeed"]').count()) === 1);
		html = (await get(WP + '/?ls=' + Date.now())).body;
		const lsOurs = (html.match(/<script[^>]*(data-vfx-plugin|wrapper2\.php)[^>]*>/g) || []);
		check('with LiteSpeed delaying scripts, ours are not delayed (no litespeed/javascript type)', lsOurs.length >= 2 && lsOurs.every((t) => !/litespeed\/javascript|data-litespeed-src/.test(t)), lsOurs.join(' | '));
	}
	const tagCheck = JSON.parse(wp('option', 'get', 'visionforgex_health', '--format=json')).checks.find((c) => c.key === 'tag');
	check('the site check: the tag loads straight away with these plugins on', tagCheck && tagCheck.state === 'ok', JSON.stringify(tagCheck));
	if (haveAO) {
		await page.click('[data-vfx-speed="autoptimize"] .vfx-switch');
		await page.waitForSelector('[data-vfx-speed="autoptimize"]:has-text("Not kept off")');
		check('the undo: switched off, saved', wp('option', 'get', 'visionforgex_speed', '--format=json').includes('"autoptimize":false'));
		await page.click('[data-vfx-speed="autoptimize"] .vfx-switch');
		await page.waitForSelector('[data-vfx-speed="autoptimize"]:has-text("Kept off the tag")');
		check('and back on', !wp('option', 'get', 'visionforgex_speed', '--format=json').includes('autoptimize'));
	}
	await sleep(400);
	await page.screenshot({ path: path.join(SHOTS, 'p2-5-tools.png'), fullPage: true });
	if (haveAO) {
		wp('plugin', 'deactivate', 'autoptimize');
		fs.rmSync(path.join(WPDIR, 'wp-content/mu-plugins/own-script.php'), { force: true });
	}
	if (haveLS) wp('plugin', 'deactivate', 'litespeed-cache');

	console.log('5. Other ad code (stand-ins for Ad Inserter and Site Kit; a script for AdSense)');
	const mk = (folder, file, name) => {
		fs.mkdirSync(path.join(plugdir, folder), { recursive: true });
		fs.writeFileSync(path.join(plugdir, folder, file), '<?php\n/**\n * Plugin Name: ' + name + ' (test stand-in)\n */\n');
	};
	mk('ad-inserter', 'ad-inserter.php', 'Ad Inserter');
	mk('google-site-kit', 'google-site-kit.php', 'Site Kit by Google');
	fs.mkdirSync(path.join(WPDIR, 'wp-content/mu-plugins'), { recursive: true });
	fs.writeFileSync(path.join(WPDIR, 'wp-content/mu-plugins/adsense-test.php'), '<?php add_action( "wp_head", function () { echo \'<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-0000000000000000"></script>\'; } );');
	wp('plugin', 'activate', 'ad-inserter');
	wp('plugin', 'activate', 'google-site-kit');
	wp('option', 'update', 'googlesitekit_adsense_settings', '{"useSnippet":true,"accountID":"pub-0"}', '--format=json');
	await page.reload();
	await page.waitForSelector('.vfx-tab.is-on:has-text("Site tools")');
	await page.click('button:has-text("Check again")');
	await page.waitForFunction(() => !document.querySelector('.vfx-btn.is-busy'), null, { timeout: 40000 });
	await page.waitForSelector('[data-vfx-other="page:adsense"]');
	check('AdSense found in the home page, to remove by hand', (await page.locator('[data-vfx-other="page:adsense"]').innerText()).includes('Remove it from your theme'));
	await page.click('[data-vfx-other="adinserter"] button:has-text("Deactivate")');
	await page.click('.vfx-modal button.vfx-btn--danger');
	await page.waitForSelector('[data-vfx-other="adinserter"] button:has-text("Undo")');
	check('Ad Inserter deactivated after the confirmation', !wp('plugin', 'list', '--status=active', '--field=name').split('\n').includes('ad-inserter'));
	await page.click('[data-vfx-other="adinserter"] button:has-text("Undo")');
	await page.waitForSelector('[data-vfx-other="adinserter"] button:has-text("Deactivate")');
	check('…and back on with Undo', wp('plugin', 'list', '--status=active', '--field=name').split('\n').includes('ad-inserter'));
	await page.click('[data-vfx-other="sitekit"] button:has-text("Switch it off")');
	await page.waitForSelector('[data-vfx-other="sitekit"] button:has-text("Undo")');
	check('Site Kit’s AdSense code switched off (its own setting)', JSON.parse(wp('option', 'get', 'googlesitekit_adsense_settings', '--format=json')).useSnippet === false);
	await page.click('[data-vfx-other="sitekit"] button:has-text("Undo")');
	await page.waitForSelector('[data-vfx-other="sitekit"] button:has-text("Switch it off")');
	check('…and back with Undo, its other settings untouched', JSON.stringify(JSON.parse(wp('option', 'get', 'googlesitekit_adsense_settings', '--format=json'))) === '{"useSnippet":true,"accountID":"pub-0"}');
	fs.rmSync(path.join(WPDIR, 'wp-content/mu-plugins/adsense-test.php'));
	wp('plugin', 'deactivate', 'ad-inserter', 'google-site-kit');

	console.log('6. Dark, a phone, and the console');
	await page.evaluate(() => document.getElementById('visionforgex-app').setAttribute('data-theme', 'dark'));
	await page.click('.vfx-tab:has-text("Formats")');
	await sleep(700);
	await page.screenshot({ path: path.join(SHOTS, 'p2-6-formats-dark.png') });
	await page.setViewportSize({ width: 390, height: 844 });
	for (const t of ['Formats', 'Placements', 'Where ads show', 'Site tools']) {
		await page.click('.vfx-tab:has-text("' + t + '")');
		await sleep(500);
		const wide = await page.evaluate(() => document.documentElement.scrollWidth);
		check('390 px, ' + t + ': nothing pushes the page sideways', wide <= 390, wide);
	}
	await page.click('.vfx-tab:has-text("Formats")');
	await sleep(500);
	await page.screenshot({ path: path.join(SHOTS, 'p2-7-formats-phone-dark.png'), fullPage: true });
	check('no JavaScript error', errors.length === 0, errors.join(' | '));
	const debug = path.join(WPDIR, 'debug.log');
	const dbg = fs.existsSync(debug) ? fs.readFileSync(debug, 'utf8').split('\n').filter((l) => /plugins\/visionforgex\//.test(l)) : [];
	check('no PHP notice or warning from the plugin', dbg.length === 0, dbg.slice(0, 3).join(' | '));

	await browser.close();
	wp('post', 'delete', pid, '--force');
	const s2 = siteFor('wpdemo-vfx.com');
	if (s2) fs.unlinkSync(s2.file);
	for (const p of Object.keys(keep)) {
		if (keep[p] === null) fs.rmSync(p, { force: true });
		else fs.writeFileSync(p, keep[p]);
	}
	console.log('\n' + pass + ' passed, ' + fail + ' failed');
	process.exit(fail ? 1 : 0);
})().catch((e) => {
	console.error(e);
	process.exit(2);
});
