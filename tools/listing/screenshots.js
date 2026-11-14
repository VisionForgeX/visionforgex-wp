/**
 * The WordPress.org screenshots (.wordpress-org/screenshot-1…9.png, in readme.txt's order) and the walkthrough video
 * (tests/shots/walkthrough.mp4, needs ffmpeg; not part of the listing: upload it to YouTube and link it in readme.txt), taken from a real WordPress connected to the platform's test server.
 *
 *     bash tests/setup.sh <WordPress> 8180 > /tmp/setup.log && node tools/listing/screenshots.js
 *
 * Same needs as tests/e2e3.js (the platform's test servers, MariaDB, wpdemo-vfx.com in /etc/hosts). It writes a small
 * recipe site first, so the pictures show something real; the test site is thrown away afterwards (setup.sh again).
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { execFileSync, execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '../..');
const OUT = path.join(ROOT, '.wordpress-org');
const PORT = '8180';
const WP = 'http://wpdemo-vfx.com:' + PORT;
const VFX = 'http://127.0.0.1:8097';
const CONFIG = process.env.PLATFORM_DIR ? path.join(process.env.PLATFORM_DIR, 'config') : path.resolve(ROOT, '../visionforgex/tests/site/public_html/config');
const WPDIR = path.join(ROOT, 'tests', '.wp', PORT);
const WPCLI = process.env.WP_CLI || '/tmp/claude-0/wpdl/wp-cli.phar';
const VIDEO_DIR = path.join(ROOT, 'tests', 'shots', 'video');
fs.mkdirSync(OUT, { recursive: true });
fs.rmSync(VIDEO_DIR, { recursive: true, force: true });

const wp = (...a) => execFileSync('php', [WPCLI, '--path=' + WPDIR, '--allow-root', '--url=' + WP, ...a], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const readJson = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const siteFile = () => {
	for (const f of fs.readdirSync(CONFIG)) if (/^\d+\.json$/.test(f) && readJson(path.join(CONFIG, f)).siteUrl === 'wpdemo-vfx.com') return path.join(CONFIG, f);
	return null;
};

// A small recipe site.
const old = siteFile();
if (old) fs.unlinkSync(old);
fs.rmSync(path.join(CONFIG, '_wp-connector.json'), { force: true });
wp('option', 'update', 'blogname', 'Weeknight Kitchen');
wp('option', 'update', 'blogdescription', 'Simple recipes for busy evenings');
const cats = {};
for (const [n, s] of [['Dinners', 'dinners'], ['Baking', 'baking'], ['Quick meals', 'quick-meals']]) cats[s] = wp('term', 'create', 'category', n, '--slug=' + s, '--porcelain');
const para = [
	'There is a moment, about twenty minutes in, when the onions turn from sharp to sweet. Everything good about this dish starts there, so give them the time.',
	'Use a wide pan. A crowded pan steams instead of browning, and browning is where the flavour comes from.',
	'Season in layers: a pinch with the onions, another with the tomatoes, and a last taste before serving.',
	'If the sauce looks thin, let it bubble for five more minutes with the lid off. If it looks thick, a splash of the pasta water brings it back.',
	'Fresh herbs go in at the very end. Basil turns dark and bitter if it cooks for long.',
	'Leftovers keep for three days in the fridge and are, honestly, better on the second day.',
];
let body = '';
for (let i = 0; i < 12; i++) {
	body += '<!-- wp:paragraph --><p>' + para[i % para.length] + '</p><!-- /wp:paragraph -->';
	if (i === 3) body += '<!-- wp:heading --><h2>Making the sauce</h2><!-- /wp:heading -->';
	if (i === 7) body += '<!-- wp:heading --><h2>To serve</h2><!-- /wp:heading -->';
}
for (const [t, c] of [['Lemon garlic pasta in 20 minutes', 'quick-meals'], ['Brown butter banana bread', 'baking'], ['One-pan chicken with tomatoes and olives', 'dinners'], ['Slow-cooker chickpea curry', 'dinners']]) {
	wp('post', 'create', '--post_status=publish', '--post_author=1', '--post_title=' + t, '--post_category=' + cats[c], '--tags_input=weeknight', '--post_content=' + body);
}
const POST = WP + '/one-pan-chicken-with-tomatoes-and-olives/';

(async () => {
	const browser = await chromium.launch();
	const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, recordVideo: { dir: VIDEO_DIR, size: { width: 1440, height: 900 } } });
	const page = await ctx.newPage();
	const shots = [];
	const shot = async (n, opts) => {
		await sleep(700);
		// Toasts hidden for the picture only (React owns them, so they are not removed).
		await page.evaluate(() => {
			const st = document.createElement('style');
			st.id = 'vfx-shot';
			st.textContent = '.vfx-toasts{visibility:hidden!important}';
			document.head.appendChild(st);
		});
		await page.screenshot(Object.assign({ path: path.join(OUT, 'screenshot-' + n + '.png') }, opts || {}));
		await page.evaluate(() => document.getElementById('vfx-shot').remove());
		shots.push(n);
	};
	// The video's captions: a pill at the bottom of the page.
	const caption = (text) =>
		page.evaluate((t) => {
			let c = document.getElementById('vfx-caption');
			if (!c) {
				c = document.createElement('div');
				c.id = 'vfx-caption';
				c.style.cssText = 'position:fixed;left:50%;bottom:28px;transform:translateX(-50%);z-index:999999;padding:12px 22px;border-radius:999px;background:rgba(18,10,34,.9);color:#fff;font:600 17px/1.3 Inter,system-ui,sans-serif;box-shadow:0 12px 30px rgba(0,0,0,.35);border:1px solid rgba(167,139,250,.5);transition:opacity .3s;pointer-events:none';
				document.body.appendChild(c);
			}
			c.textContent = t;
			c.style.opacity = t ? '1' : '0';
		}, text);
	const hideCaption = async () => {
		await page.evaluate(() => {
			const c = document.getElementById('vfx-caption');
			if (c) c.remove();
		});
	};
	const tab = async (name) => {
		await page.click('.vfx-tab:has-text("' + name + '")');
		await sleep(900);
	};

	await page.goto(WP + '/wp-login.php');
	await page.fill('#user_login', 'admin');
	await page.fill('#user_pass', 'admin-test-pass');
	await page.click('#wp-submit');
	await page.waitForURL(/wp-admin/, { timeout: 120000 });
	await page.goto(VFX + '/publisher/_testlogin.php?id=u_pub4&to=/publisher/');
	await page.goto(WP + '/wp-admin/admin.php?page=visionforgex');
	await caption('1 · Connect your site to VisionForgeX in one click');
	await sleep(2500);
	await page.click('button:has-text("Connect with VisionForgeX")');
	await page.waitForURL(/publisher\/connect/);
	await caption('Sign in, allow the site, and you are back in WordPress');
	await sleep(2200);
	await page.click('[data-wpc-go]');
	await page.waitForURL(/page=visionforgex/);
	await page.waitForSelector('.vfx-top');
	const f = siteFile();
	const cfg = readJson(f);
	cfg.approved = true;
	cfg.networkCode = '12345678';
	cfg.formats = cfg.formats || {};
	for (const k of ['banner', 'anchor', 'interstitial', 'rewarded']) cfg.formats[k] = Object.assign(cfg.formats[k] || {}, { adUnitPath: '/12345678/kitchen_' + k });
	cfg.formats.banner.sizes = [[300, 250], [336, 280], [728, 90]];
	fs.writeFileSync(f, JSON.stringify(cfg, null, 2));
	wp('eval', 'VisionForgeX_Api::sync(); VisionForgeX_Health::run(true);');
	await page.reload();
	await page.waitForSelector('.vfx-top');
	await caption('2 · Your tag and ads.txt are in place by themselves');
	await sleep(2500);
	await hideCaption();
	await shot(1);

	await tab('Formats');
	await caption('3 · Your ad formats, with a live preview');
	await page.click('[data-vfx-format="anchor"] .vfx-switch');
	await sleep(900);
	await page.click('[data-vfx-format="banner"] .vfx-format-more');
	await sleep(1800);
	await hideCaption();
	await shot(2);
	await page.click('.vfx-savebar.is-up button:has-text("Save and publish")');
	await sleep(1500);

	await tab('Placements');
	await caption('4 · In-content ads, placed by WordPress, with their space kept');
	await page.click('[data-vfx-incontent] .vfx-switch');
	await sleep(700);
	await page.fill('.vfx-field:has-text("Then every") input', '3');
	await sleep(1200);
	await page.click('.vfx-savebar.is-up button:has-text("Save")');
	await sleep(1200);
	const warn = page.locator('[data-vfx-modewarn] button:has-text("These spots, then automatic below")');
	if (await warn.count()) {
		await warn.click();
		await sleep(1500);
	}
	const themeCard = page.locator('.vfx-card:has-text("Theme spots")');
	await themeCard.locator('select.vfx-select--small').selectOption('afterContent');
	await themeCard.locator('button:has-text("Add")').first().click();
	await sleep(600);
	await page.click('.vfx-savebar.is-up button:has-text("Save")');
	await sleep(1200);
	await hideCaption();
	await page.evaluate(() => window.scrollTo(0, 0));
	await shot(3);

	await caption('5 · Or click any part of your page where an ad should go');
	await page.click('button:has-text("Open the visual editor")');
	await page.waitForSelector('.vfx-editor-frame');
	await page.locator('.vfx-editor-bar select').selectOption(POST);
	await page.waitForFunction(() => /Click any part/.test(document.querySelector('.vfx-editor-hint').textContent), null, { timeout: 30000 });
	const frame = page.frameLocator('.vfx-editor-frame');
	await sleep(1200);
	await frame.locator('h1.wp-block-post-title').hover();
	await sleep(1200);
	await frame.locator('h1.wp-block-post-title').click();
	await page.waitForSelector('[data-vfx-pickpanel]');
	await sleep(800);
	await page.click('[data-vfx-pickpanel] button:has-text("After it")');
	await sleep(1200);
	await hideCaption();
	await shot(4);
	await page.click('[data-vfx-pickpanel] button:has-text("Add this spot")');
	await sleep(1800);
	await page.click('.vfx-editor-bar button:has-text("Done")');
	await sleep(600);
	await page.click('.vfx-savebar.is-up button:has-text("Save")');
	await sleep(1200);

	await tab('Privacy');
	await caption('6 · Your consent banner decides personalised ads');
	await page.click('[data-vfx-flag="consent"] .vfx-switch');
	await page.waitForSelector('[data-vfx-flag="consent"].is-on', { timeout: 20000 });
	await sleep(900);
	await page.click('[data-vfx-flag="signals"] .vfx-switch');
	await page.waitForSelector('[data-vfx-flag="signals"].is-on', { timeout: 20000 });
	await sleep(1400);
	await hideCaption();
	await shot(5);

	await tab('Where ads show');
	await caption('7 · Choose where ads never show');
	await page.click('.vfx-master .vfx-switch');
	await sleep(500);
	await page.click('.vfx-chips[aria-label="Categories"] .vfx-pick:has-text("Baking")');
	await sleep(1500);
	await hideCaption();
	await shot(6);
	await page.click('.vfx-savebar.is-up button:has-text("Discard")');

	await tab('Go live');
	await caption('8 · The checklist the plugin runs itself');
	await sleep(2200);
	await hideCaption();
	await shot(7);

	await tab('Site tools');
	await caption('9 · Speed plugins and other ad code, handled');
	await sleep(2200);
	await hideCaption();
	await shot(8);

	// Dark, and on a phone: the desktop and the phone side by side.
	await tab('Home');
	await page.evaluate(() => document.getElementById('visionforgex-app').setAttribute('data-theme', 'dark'));
	await caption('Light or dark, on a desktop or a phone');
	await sleep(2200);
	await hideCaption();
	const darkDesk = path.join(VIDEO_DIR, 'dark-desk.png');
	await page.evaluate(() => {
		const st = document.createElement('style');
		st.textContent = '.vfx-toasts{visibility:hidden!important}';
		document.head.appendChild(st);
	});
	await page.screenshot({ path: darkDesk });
	await page.close();
	await ctx.close();
	const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, storageState: undefined });
	const pp = await phone.newPage();
	await pp.goto(WP + '/wp-login.php');
	await pp.fill('#user_login', 'admin');
	await pp.fill('#user_pass', 'admin-test-pass');
	await pp.click('#wp-submit');
	await pp.waitForURL(/wp-admin/);
	await pp.goto(WP + '/wp-admin/admin.php?page=visionforgex#placements');
	await pp.waitForSelector('[data-vfx-incontent]');
	await pp.evaluate(() => document.getElementById('visionforgex-app').setAttribute('data-theme', 'dark'));
	await sleep(900);
	const darkPhone = path.join(VIDEO_DIR, 'dark-phone.png');
	await pp.screenshot({ path: darkPhone });
	await phone.close();
	const comp = await browser.newPage({ viewport: { width: 1440, height: 900 } });
	const b64 = (p) => 'data:image/png;base64,' + fs.readFileSync(p).toString('base64');
	await comp.setContent('<body style="margin:0;width:1440px;height:900px;background:radial-gradient(60% 80% at 75% 40%,#3b2470,#120a22);position:relative;overflow:hidden"><img src="' + b64(darkDesk) + '" style="position:absolute;left:44px;top:137px;width:1000px;border-radius:14px;box-shadow:0 30px 60px rgba(0,0,0,.5)"><img src="' + b64(darkPhone) + '" style="position:absolute;left:1076px;top:83px;width:320px;border-radius:38px;border:10px solid #0b0716;box-shadow:0 30px 60px rgba(0,0,0,.6)"></body>');
	await sleep(400);
	await comp.screenshot({ path: path.join(OUT, 'screenshot-9.png') });
	shots.push(9);
	await browser.close();

	const vids = fs.readdirSync(VIDEO_DIR).filter((x) => x.endsWith('.webm'));
	if (vids.length) {
		try {
			execSync('ffmpeg -y -loglevel error -i ' + JSON.stringify(path.join(VIDEO_DIR, vids[0])) + ' -vf "scale=1280:-2" -c:v libx264 -preset veryfast -crf 26 -pix_fmt yuv420p -movflags +faststart ' + JSON.stringify(path.join(ROOT, 'tests', 'shots', 'walkthrough.mp4')));
			console.log('  walkthrough.mp4');
		} catch (e) {
			console.log('  no video: ' + e.message);
		}
	}
	console.log('  screenshots ' + shots.join(', '));
})().catch((e) => {
	console.error(e);
	process.exit(1);
});
