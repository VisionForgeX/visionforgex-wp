/**
 * The dashboard's screens: Welcome (not connected), Home, Go live, ads.txt, Settings. No reporting here: money,
 * impressions and charts stay on visionforgex.com ("Open your reports").
 */
import { Mark, Icon, Light, Chip, Switch, Button, Card, Skeleton, Modal, CopyButton, Ring, Burst, ago, when } from './ui.jsx';

const { useState, useEffect } = wp.element;
import { __, sprintf, _n } from './i18n.js';

const FEATURE_NAMES = {
	badads: __('Bad ads', 'visionforgex'),
	layoutguard: __('Layout guard', 'visionforgex'),
	humancheck: __('Human check', 'visionforgex'),
	privacy: __('Privacy & messaging', 'visionforgex'),
	intents: __('Intent ads', 'visionforgex'),
	pagetargeting: __('Page targeting', 'visionforgex'),
	reward: __('Rewarded ads', 'visionforgex'),
};
const LEVEL = {
	manage: [__('Manage', 'visionforgex'), 'ok'],
	view: [__('View', 'visionforgex'), 'info'],
	off: [__('Not on your account', 'visionforgex'), 'mute'],
};

/** What the site is doing now: [state, title, text]. */
export function siteStatus(s) {
	if (s.staging) return ['warn', __('Staging copy', 'visionforgex'), s.staging];
	if (s.settings.paused) return ['warn', __('Paused', 'visionforgex'), __('You paused all ads from WordPress. The tag is off on every page until you turn ads back on.', 'visionforgex')];
	if (!s.site) return ['wait', __('Waiting for VisionForgeX', 'visionforgex'), __('The plugin has not heard from VisionForgeX yet. Sync now from Settings.', 'visionforgex')];
	if (!s.site.approved) return ['wait', __('In review', 'visionforgex'), __('VisionForgeX reviews every new site before it serves ads, usually within a day. The tag goes on your pages by itself once it is approved; ads.txt is already being served.', 'visionforgex')];
	if (!s.site.enabled) return ['warn', __('Off on VisionForgeX', 'visionforgex'), __('Ads for this site are switched off on VisionForgeX. Write to support@visionforgex.com if you did not expect this.', 'visionforgex')];
	if (!s.tag.serving) return ['warn', __('Not serving', 'visionforgex'), __('The tag is not on your pages yet. Sync now from Settings.', 'visionforgex')];
	return ['ok', __('Live', 'visionforgex'), __('Your VisionForgeX tag is on every page, kept off speed plugins’ delay lists. Ads are managed by VisionForgeX.', 'visionforgex')];
}

function healthCheck(s, key) {
	const h = s.health;
	if (!h || !h.checks) return null;
	return h.checks.find((c) => c.key === key) || null;
}

/* ------------------------------------------------------------------ Welcome */

export function Welcome({ s, act, busy, came }) {
	const [why, setWhy] = useState(false);
	const pills = [
		['tag', __('Your tag on every page', 'visionforgex'), __('No theme editing. It survives theme changes and updates.', 'visionforgex')],
		['file', __('ads.txt kept right', 'visionforgex'), __('Every line VisionForgeX needs, next to yours, never removing anyone else’s.', 'visionforgex')],
		['rocket', __('Speed plugins handled', 'visionforgex'), __('The tag is kept out of WP Rocket, LiteSpeed and others’ delay lists.', 'visionforgex')],
		['shield', __('Safe by design', 'visionforgex'), __('Nothing is fetched while visitors load your pages. Pause all ads in one click.', 'visionforgex')],
	];
	return (
		<div className="vfx-welcome">
			<div className="vfx-orbs" aria-hidden="true">
				<span />
				<span />
				<span />
			</div>
			<div className="vfx-welcome-in">
				<div className="vfx-welcome-mark">
					<Mark size={64} animate id="vfxWelcomeGrad" />
				</div>
				<p className="vfx-eyebrow">{__('VisionForgeX – Ad Management & Yield', 'visionforgex')}</p>
				<h1 className="vfx-hero-title">
					{__('Your ads, run from', 'visionforgex')} <span className="vfx-grad-text">{__('WordPress', 'visionforgex')}</span>
				</h1>
				<p className="vfx-hero-lede">{__('Connect this site to VisionForgeX in one click. The plugin puts your tag and ads.txt lines in place by itself, checks the site, and gives you the controls here.', 'visionforgex')}</p>

				{came === 'denied' ? <div className="vfx-banner vfx-banner--warn">{__('You chose not to connect. Nothing was changed.', 'visionforgex')}</div> : null}
				{came === 'failed' ? <div className="vfx-banner vfx-banner--bad">{s.error || __('Connecting did not finish. Try again.', 'visionforgex')}</div> : null}
				{came === 'stale' ? <div className="vfx-banner vfx-banner--warn">{__('That connect link was too old or was started by someone else. Click Connect again.', 'visionforgex')}</div> : null}
				{s.staging ? <div className="vfx-banner vfx-banner--warn">{s.staging + ' ' + __('Install the plugin on the live site and connect from there.', 'visionforgex')}</div> : null}

				<div className="vfx-hero-actions">
					<Button kind="primary" icon="plug" busy={busy.connect} onClick={() => act('connect')} disabled={!!s.staging}>
						{__('Connect with VisionForgeX', 'visionforgex')}
					</Button>
					<span className="vfx-hero-note">{__('New to VisionForgeX? You can sign up on the next page.', 'visionforgex')}</span>
				</div>

				<div className="vfx-pills">
					{pills.map((p, i) => (
						<div className="vfx-pill" key={p[0]} style={{ '--vfx-delay': 120 + i * 70 + 'ms' }}>
							<span className="vfx-pill-icon">
								<Icon name={p[0]} size={18} />
							</span>
							<div>
								<b>{p[1]}</b>
								<span>{p[2]}</span>
							</div>
						</div>
					))}
				</div>

				<button type="button" className="vfx-disclose" aria-expanded={why ? 'true' : 'false'} onClick={() => setWhy(!why)}>
					<Icon name="lock" size={15} />
					{__('What is sent when you connect', 'visionforgex')}
				</button>
				{why ? (
					<div className="vfx-disclose-body">
						<p>{__('Nothing leaves this site until you click Connect. Then VisionForgeX receives:', 'visionforgex')}</p>
						<ul>
							<li>{sprintf(__('this site’s address (%s) and name', 'visionforgex'), s.domain)}</li>
							<li>{__('the WordPress, PHP and plugin versions', 'visionforgex')}</li>
							<li>{__('once a day, the result of the site check (tag found, ads.txt complete, HTTPS)', 'visionforgex')}</li>
						</ul>
						<p>{__('No posts, users, visitors or personal data are sent. You can disconnect at any time.', 'visionforgex')}</p>
					</div>
				) : null}
			</div>
		</div>
	);
}

/* ------------------------------------------------------------------ Home */

export function Home({ s, act, busy, go }) {
	const [state, title, text] = siteStatus(s);
	const tag = healthCheck(s, 'tag');
	const ad = s.adsTxt;
	const check = ad.check;
	const adState = check ? (check.ok ? 'ok' : 'bad') : 'info';
	const links = s.links || {};
	const feats = Object.keys(s.features || {});
	const on = feats.filter((k) => s.features[k] !== 'off');
	const off = feats.filter((k) => s.features[k] === 'off');
	return (
		<div className="vfx-grid">
			<section className={'vfx-hero-card vfx-hero-card--' + state} style={{ '--vfx-delay': '0ms' }}>
				<div className="vfx-hero-card-main">
					<div className="vfx-status-big">
						<Light state={state} pulse={state === 'ok'} />
						<span>{title}</span>
					</div>
					<p>{text}</p>
					<div className="vfx-row">
						{links.reports ? (
							<Button kind="primary" icon="report" href={links.reports}>
								{__('Open your reports', 'visionforgex')}
							</Button>
						) : null}
						{links.site ? (
							<Button icon="gear" href={links.site}>
								{__('Site settings on VisionForgeX', 'visionforgex')}
							</Button>
						) : null}
					</div>
				</div>
				<div className="vfx-pause">
					<div>
						<b>{__('Pause all ads', 'visionforgex')}</b>
						<span>{s.settings.paused ? sprintf(__('Paused %s', 'visionforgex'), ago(s.settings.pausedAt)) : __('For emergencies. Works even when VisionForgeX cannot be reached.', 'visionforgex')}</span>
					</div>
					<Switch big checked={s.settings.paused} disabled={busy.pause} label={__('Pause all ads', 'visionforgex')} onChange={(v) => act('pause', { paused: v })} />
				</div>
			</section>

			<div className="vfx-tiles">
				<Tile delay={60} icon="tag" title={__('Tag', 'visionforgex')} state={s.tag.serving ? (tag ? tag.state : 'ok') : 'wait'} busy={busy.health} onClick={() => go('golive')}>
					{s.tag.serving ? (tag ? tag.text : __('On every page.', 'visionforgex')) : __('Not on your pages right now.', 'visionforgex')}
				</Tile>
				<Tile delay={120} icon="file" title="ads.txt" state={adState} busy={busy.health} onClick={() => go('adstxt')}>
					{check
						? check.ok
							? __('Complete, checked by VisionForgeX.', 'visionforgex')
							: sprintf(_n('%d line missing.', '%d lines missing.', check.missing.length, 'visionforgex'), check.missing.length)
						: ad.mode === 'served'
							? __('Served by WordPress.', 'visionforgex')
							: ad.mode === 'file'
								? __('Kept in your ads.txt file.', 'visionforgex')
								: __('Needs adding by hand.', 'visionforgex')}
				</Tile>
				<Tile delay={180} icon="sync" title={__('Last sync', 'visionforgex')} state={s.connection.lost ? 'bad' : s.connection.lastError ? 'warn' : 'ok'} busy={busy.sync} onClick={() => act('sync')}>
					{s.connection.lost ? __('VisionForgeX no longer knows this site’s key.', 'visionforgex') : ago(s.connection.lastSync)}
				</Tile>
				<Tile delay={240} icon="shield" title={__('Site check', 'visionforgex')} state={summaryState(s)} busy={busy.health} onClick={() => act('health')}>
					{s.health ? sprintf(__('Ran %s.', 'visionforgex'), ago(s.health.at)) : __('Not run yet.', 'visionforgex')}
				</Tile>
			</div>

			<Card title={__('Your features on VisionForgeX', 'visionforgex')} icon="spark" delay={200}>
				{on.length ? (
					<ul className="vfx-features">
						{on.map((k) => {
							const lv = LEVEL[s.features[k]] || LEVEL.off;
							return (
								<li key={k} className={'vfx-feature vfx-feature--' + s.features[k]}>
									<span>{FEATURE_NAMES[k] || k}</span>
									<Chip state={lv[1]}>{lv[0]}</Chip>
								</li>
							);
						})}
					</ul>
				) : (
					<p className="vfx-muted">{feats.length ? __('No extra features are switched on for your account yet.', 'visionforgex') : __('Your account\u2019s features show here after the next sync.', 'visionforgex')}</p>
				)}
				{off.length ? (
					<p className="vfx-foot">
						{sprintf(__('Also on VisionForgeX: %s. Ask support@visionforgex.com to switch one on.', 'visionforgex'), off.map((k) => FEATURE_NAMES[k] || k).join(', '))}
					</p>
				) : null}
				<p className="vfx-foot">{__('What your account may manage is set on VisionForgeX; change these features on your VisionForgeX dashboard.', 'visionforgex')}</p>
			</Card>

			<Card title={__('Help', 'visionforgex')} icon="mail" delay={260}>
				<p className="vfx-muted">{__('Questions about your ads, payments or this plugin: write to us and a person answers.', 'visionforgex')}</p>
				<div className="vfx-row">
					<Button icon="mail" href="mailto:support@visionforgex.com">
						support@visionforgex.com
					</Button>
					{links.dashboard ? <Button href={links.dashboard}>{__('VisionForgeX dashboard', 'visionforgex')}</Button> : null}
				</div>
			</Card>
		</div>
	);
}

function summaryState(s) {
	if (!s.health || !s.health.checks) return 'info';
	const st = s.health.checks.map((c) => c.state);
	if (st.includes('bad')) return 'bad';
	if (st.includes('warn')) return 'warn';
	return 'ok';
}

function Tile({ icon, title, state, children, busy, onClick, delay }) {
	return (
		<button type="button" className={'vfx-tile vfx-tile--' + state} onClick={onClick} style={{ '--vfx-delay': delay + 'ms' }}>
			<span className="vfx-tile-top">
				<span className="vfx-tile-icon">
					<Icon name={icon} size={17} />
				</span>
				<Light state={state} />
			</span>
			<b>{title}</b>
			{busy ? <Skeleton lines={1} /> : <span className="vfx-tile-text">{children}</span>}
		</button>
	);
}

/* ------------------------------------------------------------------ Go live */

export function GoLive({ s, act, busy }) {
	const tag = healthCheck(s, 'tag');
	const https = healthCheck(s, 'https');
	const ad = s.adsTxt.check;
	const steps = [
		{ key: 'connect', icon: 'plug', title: __('Connected to VisionForgeX', 'visionforgex'), state: 'ok', text: sprintf(__('As %1$s, %2$s.', 'visionforgex'), s.connection.domain, ago(s.connection.connectedAt)) },
		{
			key: 'review',
			icon: 'shield',
			title: __('Site approved', 'visionforgex'),
			state: s.site && s.site.approved ? 'ok' : 'wait',
			text: s.site && s.site.approved ? __('VisionForgeX approved this site.', 'visionforgex') : __('VisionForgeX reviews every new site, usually within a day. Nothing for you to do.', 'visionforgex'),
		},
		{
			key: 'adstxt',
			icon: 'file',
			title: __('ads.txt complete', 'visionforgex'),
			state: ad ? (ad.ok ? 'ok' : 'bad') : 'wait',
			text: ad ? (ad.ok ? __('VisionForgeX found every line on your live ads.txt.', 'visionforgex') : sprintf(_n('%d line is still missing on your live ads.txt.', '%d lines are still missing on your live ads.txt.', ad.missing.length, 'visionforgex'), ad.missing.length)) : __('Run the check and VisionForgeX looks at your ads.txt at once.', 'visionforgex'),
		},
		{
			key: 'tag',
			icon: 'tag',
			title: __('Tag on every page, not delayed', 'visionforgex'),
			state: tag ? (tag.state === 'info' ? 'wait' : tag.state) : 'wait',
			text: tag ? tag.text : __('Run the check: the plugin loads your home page the way a visitor does.', 'visionforgex'),
		},
		{
			key: 'https',
			icon: 'lock',
			title: 'HTTPS',
			state: https ? https.state : 'wait',
			text: https ? https.text : __('Checked with the rest.', 'visionforgex'),
		},
	];
	const done = steps.filter((x) => x.state === 'ok').length;
	const all = done === steps.length;
	const [celebrate, setCelebrate] = useState(false);
	useEffect(() => {
		if (!all) return;
		let seen = false;
		try {
			seen = window.localStorage.getItem('visionforgex-live-' + s.connection.siteId) === '1';
			window.localStorage.setItem('visionforgex-live-' + s.connection.siteId, '1');
		} catch (e) {}
		if (!seen) setCelebrate(true);
	}, [all]);
	const others = s.health && s.health.checks ? s.health.checks.filter((c) => !['tag', 'https', 'adstxt'].includes(c.key)) : [];
	return (
		<div className="vfx-grid">
			<section className="vfx-golive-head vfx-span" style={{ '--vfx-delay': '0ms' }}>
				<Ring value={done / steps.length}>
					<b>{done}</b>
					<span>/ {steps.length}</span>
				</Ring>
				<div>
					<h2>{all ? __('Your site is live', 'visionforgex') : __('Go live', 'visionforgex')}</h2>
					<p>{all ? __('Everything is in place. VisionForgeX takes it from here; the plugin re-checks once a day.', 'visionforgex') : __('The plugin does these steps itself. Run the check after changing a cache or theme.', 'visionforgex')}</p>
					<Button kind="primary" icon="sync" busy={busy.health} onClick={() => act('health')}>
						{busy.health ? __('Checking your site…', 'visionforgex') : __('Run the check', 'visionforgex')}
					</Button>
				</div>
				{celebrate ? <Burst /> : null}
			</section>
			<ol className="vfx-steps vfx-span">
				{steps.map((x, i) => (
					<li key={x.key} className={'vfx-step vfx-step--' + x.state + (busy.health && x.key !== 'connect' && x.key !== 'review' ? ' is-checking' : '')} style={{ '--vfx-delay': 60 + i * 70 + 'ms' }}>
						<span className="vfx-step-dot">{x.state === 'ok' ? <Icon name="check" size={16} /> : x.state === 'bad' ? <Icon name="alert" size={15} /> : <Icon name={x.icon} size={15} />}</span>
						<div>
							<b>{x.title}</b>
							{busy.health && x.key !== 'connect' && x.key !== 'review' ? <Skeleton lines={1} /> : <span>{x.text}</span>}
						</div>
					</li>
				))}
			</ol>
			{others.length ? (
				<Card title={__('Also noticed', 'visionforgex')} icon="alert" className="vfx-span">
					<ul className="vfx-notes">
						{others.map((c) => (
							<li key={c.key}>
								<Light state={c.state} />
								<span>{c.text}</span>
							</li>
						))}
					</ul>
				</Card>
			) : null}
		</div>
	);
}

/* ------------------------------------------------------------------ ads.txt */

export function AdsTxt({ s, act, busy }) {
	const a = s.adsTxt;
	const [extra, setExtra] = useState(a.extra);
	useEffect(() => setExtra(a.extra), [a.extra]);
	const modes = {
		served: [__('Served by WordPress', 'visionforgex'), __('There is no ads.txt file on your server, so WordPress answers /ads.txt itself: your own lines below, then VisionForgeX’s.', 'visionforgex')],
		file: [__('Kept in your ads.txt file', 'visionforgex'), __('Your real ads.txt file keeps every line it had. VisionForgeX’s lines sit in their own marked block at the end, kept up to date.', 'visionforgex')],
		manual: [__('Add the lines by hand', 'visionforgex'), a.reason],
	};
	const m = modes[a.mode] || modes.manual;
	const lines = a.lines.join('\n');
	const ck = a.check;
	return (
		<div className="vfx-grid">
			<Card title="ads.txt" icon="file" className="vfx-span" aside={<Button small href={a.url}>{__('Open your ads.txt', 'visionforgex')}</Button>}>
				<div className={'vfx-mode vfx-mode--' + a.mode}>
					<Light state={a.mode === 'manual' ? 'warn' : 'ok'} />
					<div>
						<b>{m[0]}</b>
						<span>{m[1]}</span>
					</div>
				</div>
				{ck ? (
					<div className={'vfx-banner vfx-banner--' + (ck.ok ? 'ok' : 'bad')}>
						{ck.ok ? sprintf(__('VisionForgeX checked your live ads.txt %s: every line is there.', 'visionforgex'), ago(ck.at)) : sprintf(_n('VisionForgeX checked your live ads.txt %1$s: %2$d line is missing.', 'VisionForgeX checked your live ads.txt %1$s: %2$d lines are missing.', ck.missing.length, 'visionforgex'), ago(ck.at), ck.missing.length)}
					</div>
				) : null}
				<div className="vfx-row vfx-row--end">
					<Button kind="primary" icon="sync" busy={busy.health} onClick={() => act('health')}>
						{__('Check it now', 'visionforgex')}
					</Button>
					{a.mode === 'served' && a.canFile ? (
						<Button busy={busy.adstxt} onClick={() => act('adstxt', { mode: 'file' })}>
							{__('Keep a real file instead', 'visionforgex')}
						</Button>
					) : null}
					{a.chosen === 'file' && !a.exists ? (
						<Button busy={busy.adstxt} onClick={() => act('adstxt', { mode: 'auto' })}>
							{__('Let WordPress serve it', 'visionforgex')}
						</Button>
					) : null}
				</div>
			</Card>
			<Card title={__('VisionForgeX’s lines', 'visionforgex')} icon="lock" aside={<CopyButton text={lines} />}>
				{a.lines.length ? <pre className="vfx-code">{lines}</pre> : <p className="vfx-muted">{__('The lines arrive with the next sync.', 'visionforgex')}</p>}
				<p className="vfx-foot">{__('Set by VisionForgeX for this site. They change by themselves when a new partner joins.', 'visionforgex')}</p>
			</Card>
			<Card title={__('Your own lines', 'visionforgex')} icon="file">
				{a.mode === 'served' ? (
					<>
						<label className="vfx-label" htmlFor="vfx-extra">
							{__('Other partners’ lines (AdSense and others), one per line. They are served before VisionForgeX’s.', 'visionforgex')}
						</label>
						<textarea id="vfx-extra" className="vfx-textarea" rows={8} spellCheck="false" value={extra} onChange={(e) => setExtra(e.target.value)} placeholder="google.com, pub-0000000000000000, DIRECT, f08c47fec0942fa0" />
						{a.other ? <p className="vfx-foot">{__('The lines kept by the Ads.txt Manager plugin are served too.', 'visionforgex')}</p> : null}
						<div className="vfx-row vfx-row--end">
							<Button kind="primary" busy={busy.adstxt} disabled={extra === a.extra} onClick={() => act('adstxt', { extra })}>
								{__('Save', 'visionforgex')}
							</Button>
						</div>
					</>
				) : (
					<p className="vfx-muted">{a.mode === 'file' ? __('Your file’s own lines stay exactly as they are; edit them in the file as before.', 'visionforgex') : __('Add VisionForgeX’s lines to your ads.txt by hand, then click Check it now.', 'visionforgex')}</p>
				)}
			</Card>
		</div>
	);
}

/* ------------------------------------------------------------------ Settings */

export function Settings({ s, act, busy, theme, setTheme }) {
	const [ask, setAsk] = useState(false);
	const c = s.connection;
	const diag = JSON.stringify(
		{
			plugin: s.plugin,
			wp: s.wp,
			php: s.php,
			home: s.home,
			site: c.siteId,
			key: c.key,
			sealed: c.sealed,
			connectedAt: c.connectedAt,
			lastSync: c.lastSync,
			lastError: c.lastError,
			lost: c.lost,
			staging: s.staging,
			paused: s.settings.paused,
			tag: s.tag,
			adsTxt: { mode: s.adsTxt.mode, reason: s.adsTxt.reason, lines: s.adsTxt.lines.length, check: s.adsTxt.check },
			health: s.health,
		},
		null,
		2
	);
	const themes = [
		['auto', 'auto', __('Auto', 'visionforgex')],
		['light', 'sun', __('Light', 'visionforgex')],
		['dark', 'moon', __('Dark', 'visionforgex')],
	];
	return (
		<div className="vfx-grid">
			<Card title={__('Connection', 'visionforgex')} icon="plug" className="vfx-span">
				{c.lost ? <div className="vfx-banner vfx-banner--bad">{__('VisionForgeX no longer knows this site’s key (it was disconnected there). Your tag keeps serving from the last copy. Disconnect and connect again.', 'visionforgex')}</div> : null}
				{!c.sealed ? <div className="vfx-banner vfx-banner--bad">{__('The connection key cannot be read any more (this site’s security keys changed). Disconnect and connect again.', 'visionforgex')}</div> : null}
				<dl className="vfx-dl">
					<dt>{__('Site', 'visionforgex')}</dt>
					<dd>{c.domain}</dd>
					<dt>{__('Account', 'visionforgex')}</dt>
					<dd>{s.account && s.account.email ? s.account.email : '—'}</dd>
					<dt>{__('Connected', 'visionforgex')}</dt>
					<dd>{sprintf(__('%1$s by %2$s', 'visionforgex'), when(c.connectedAt), c.by)}</dd>
					<dt>{__('Last sync', 'visionforgex')}</dt>
					<dd>{ago(c.lastSync)}</dd>
					<dt>{__('Key', 'visionforgex')}</dt>
					<dd>
						<code>{c.key}</code>
					</dd>
				</dl>
				{c.lastError && !c.lost ? <p className="vfx-foot">{sprintf(__('Last problem: %s', 'visionforgex'), c.lastError)}</p> : null}
				<div className="vfx-row">
					<Button kind="primary" icon="sync" busy={busy.sync} onClick={() => act('sync')}>
						{__('Sync now', 'visionforgex')}
					</Button>
					<Button kind="danger" icon="x" onClick={() => setAsk(true)}>
						{__('Disconnect', 'visionforgex')}
					</Button>
				</div>
			</Card>

			<Card title={__('Appearance', 'visionforgex')} icon="sun">
				<div className="vfx-seg" role="radiogroup" aria-label={__('Theme', 'visionforgex')}>
					{themes.map((t) => (
						<button key={t[0]} type="button" role="radio" aria-checked={theme === t[0] ? 'true' : 'false'} className={theme === t[0] ? 'is-on' : ''} onClick={() => setTheme(t[0])}>
							<Icon name={t[1]} size={15} />
							{t[2]}
						</button>
					))}
				</div>
				<p className="vfx-foot">{__('Auto follows your computer’s setting.', 'visionforgex')}</p>
			</Card>

			<Card title={__('What the plugin sends', 'visionforgex')} icon="lock">
				<ul className="vfx-list">
					<li>{__('Twice a day: asks VisionForgeX for this site’s tag and ads.txt lines.', 'visionforgex')}</li>
					<li>{__('Once a day: the site check (tag found, ads.txt, HTTPS) and the WordPress, PHP and plugin versions.', 'visionforgex')}</li>
					<li>{__('Never: posts, users, visitors or personal data.', 'visionforgex')}</li>
				</ul>
			</Card>

			<Card title={__('Recent changes', 'visionforgex')} icon="clock">
				{s.history.length ? (
					<ul className="vfx-history">
						{s.history.map((h, i) => (
							<li key={i}>
								<span>{h.what}</span>
								<em>{sprintf(__('%1$s · %2$s', 'visionforgex'), h.by, ago(h.at))}</em>
							</li>
						))}
					</ul>
				) : (
					<p className="vfx-muted">{__('Nothing yet.', 'visionforgex')}</p>
				)}
			</Card>

			<Card title={__('Diagnostics', 'visionforgex')} icon="gear" aside={<CopyButton text={diag} label={__('Copy for support', 'visionforgex')} />}>
				<p className="vfx-muted">{__('If support@visionforgex.com asks for it, copy this and paste it into your email. It holds no key or password.', 'visionforgex')}</p>
			</Card>

			{ask ? (
				<Modal
					title={__('Disconnect from VisionForgeX?', 'visionforgex')}
					onClose={() => setAsk(false)}
					actions={
						<>
							<Button onClick={() => setAsk(false)}>{__('Keep connected', 'visionforgex')}</Button>
							<Button
								kind="danger"
								busy={busy.disconnect}
								onClick={() => {
									act('disconnect').then(() => setAsk(false));
								}}
							>
								{__('Disconnect', 'visionforgex')}
							</Button>
						</>
					}
				>
					<p>{__('The tag comes off your pages straight away and the plugin takes its ads.txt lines out. Your other ads.txt lines stay. You can connect again at any time.', 'visionforgex')}</p>
				</Modal>
			) : null}
		</div>
	);
}
