/**
 * Phase 3 and 4 screens: Placements (in-content ads placed by WordPress with their space kept, theme spots, your own
 * spots picked on a live preview of the site, Ad Tags, import from Ad Inserter) and Privacy & signals (the consent
 * bridge, page facts, test ads for administrators, protection features).
 */
import { Icon, Light, Chip, Switch, Button, Card, Modal } from './ui.jsx';
import { AdTags } from './views2.jsx';
import { __, sprintf, _n } from './i18n.js';

const { useState, useEffect, useRef } = wp.element;
const clone = (o) => JSON.parse(JSON.stringify(o));

const HOOKS = {
	top: __('Top of every page', 'visionforgex'),
	afterTitle: __('After the title', 'visionforgex'),
	beforeContent: __('Before the content', 'visionforgex'),
	afterContent: __('After the content', 'visionforgex'),
	beforeComments: __('Before the comments', 'visionforgex'),
	footer: __('In the footer', 'visionforgex'),
};
const PAGES = {
	all: __('Every page', 'visionforgex'),
	singular: __('Posts and pages', 'visionforgex'),
	posts: __('Posts only', 'visionforgex'),
	pages: __('Pages only', 'visionforgex'),
	home: __('Home page', 'visionforgex'),
	archive: __('Lists (categories, search)', 'visionforgex'),
};
const POSITIONS = {
	before: __('Before it', 'visionforgex'),
	after: __('After it', 'visionforgex'),
	prepend: __('Inside, at the top', 'visionforgex'),
	append: __('Inside, at the bottom', 'visionforgex'),
};

/** The ad a spot shows: "format:banner", "format:native" or an Ad Tag id. */
function AdSelect({ s, tag, format, onChange, label }) {
	const tags = (s.ads && s.ads.adTags) || [];
	const value = tag ? tag : 'format:' + (format || 'banner');
	return (
		<label className="vfx-field">
			<span>{label || __('Ad', 'visionforgex')}</span>
			<select className="vfx-select" value={value} onChange={(e) => (e.target.value.indexOf('format:') === 0 ? onChange('', e.target.value.slice(7)) : onChange(e.target.value, 'banner'))}>
				<option value="format:banner">{__('Banner', 'visionforgex')}</option>
				<option value="format:native">{__('Native', 'visionforgex')}</option>
				{tags.map((t) => (
					<option key={t.id} value={t.id}>
						{sprintf(__('Ad Tag: %s', 'visionforgex'), t.name)}
					</option>
				))}
			</select>
		</label>
	);
}

/** A drawing of an article with the in-content ads where the rule puts them. */
function ArticleDrawing({ ic }) {
	const paras = 12;
	const at = [];
	if (ic.on && !ic.beforeHeadings) for (let p = ic.first; p < paras && at.length < ic.max; p += ic.every) at.push(p);
	const rows = [];
	for (let i = 1; i <= paras; i++) {
		if (ic.on && ic.beforeHeadings && i % 4 === 1 && i > 1 && at.length < ic.max) {
			at.push(i);
			rows.push(<div key={'a' + i} className="vfx-art-ad">{__('Ad', 'visionforgex')}</div>);
		}
		if (ic.beforeHeadings && i % 4 === 1 && i > 1) rows.push(<i key={'h' + i} className="vfx-art-h" />);
		rows.push(<i key={'p' + i} className="vfx-art-p" style={{ width: 70 + ((i * 37) % 28) + '%' }} />);
		if (ic.on && !ic.beforeHeadings && at.indexOf(i) >= 0) rows.push(<div key={'a' + i} className="vfx-art-ad">{__('Ad', 'visionforgex')}</div>);
	}
	return (
		<div className="vfx-art" aria-hidden="true">
			<i className="vfx-art-t" />
			{rows}
		</div>
	);
}

/* ------------------------------------------------------------------ Placements */

export function Placements({ s, act, busy }) {
	const P = s.placements;
	const [ic, setIc] = useState(clone(P.incontent));
	const [spots, setSpots] = useState(clone(P.spots));
	const [editor, setEditor] = useState(false);
	const [newHook, setNewHook] = useState('afterContent');
	useEffect(() => setIc(clone(P.incontent)), [JSON.stringify(P.incontent)]);
	useEffect(() => setSpots(clone(P.spots)), [JSON.stringify(P.spots)]);
	const icDirty = JSON.stringify(ic) !== JSON.stringify(P.incontent);
	const spDirty = JSON.stringify(spots) !== JSON.stringify(P.spots);
	const up = (k, v) => setIc(Object.assign({}, ic, { [k]: v }));
	const mode = s.ads ? s.ads.mode : 'auto';
	const plainUsed = (ic.on && !ic.tag) || spots.some((x) => x.on && !x.tag);
	const setSpot = (i, k, v) => setSpots(spots.map((x, j) => (j === i ? Object.assign({}, x, { [k]: v }) : x)));
	const hooks = spots.map((x, i) => [x, i]).filter((p) => p[0].kind === 'hook');
	const sels = spots.map((x, i) => [x, i]).filter((p) => p[0].kind === 'selector');
	const [kept] = (function () {
		const tags = (s.ads && s.ads.adTags) || [];
		const t = tags.find((x) => x.id === ic.tag);
		const sizes = t ? t.sizes : (s.ads && s.ads.formats.banner.sizes) || [];
		let ph = 0, wd = 0;
		sizes.forEach((z) => {
			const m = /^(\d+)x(\d+)$/.exec(z);
			if (!m) return;
			if (+m[1] <= 360) ph = Math.max(ph, +m[2]);
			wd = Math.max(wd, +m[2]);
		});
		return [(t && t.format === 'native') || (!t && ic.format === 'native') ? null : [ph || wd, wd || ph]];
	})();
	return (
		<div className="vfx-grid">
			{mode === 'auto' && plainUsed ? (
				<div className="vfx-banner vfx-banner--warn vfx-span" data-vfx-modewarn>
					<div>
						<b>{__('VisionForgeX places your ads automatically right now.', 'visionforgex')}</b> {__('In that mode only spots with an Ad Tag load. Let VisionForgeX use the spots WordPress places:', 'visionforgex')}
						<div className="vfx-row">
							<Button small kind="primary" busy={busy.settings} onClick={() => act('settings', { changes: { mode: 'manual' } })}>
								{__('Use only these spots', 'visionforgex')}
							</Button>
							<Button small busy={busy.settings} onClick={() => act('settings', { changes: { mode: 'hybrid' } })}>
								{__('These spots, then automatic below', 'visionforgex')}
							</Button>
						</div>
					</div>
				</div>
			) : null}

			<section className={'vfx-master vfx-span' + (ic.on ? ' is-on' : '')} data-vfx-incontent>
				<div>
					<b>{__('In-content ads, placed by WordPress', 'visionforgex')}</b>
					<span>{__('Put in the page before it is cached, never inside tables, lists, quotes or embeds. Each keeps its height, so the page does not jump when the ad arrives.', 'visionforgex')}</span>
				</div>
				<Switch big checked={ic.on} label={__('In-content ads', 'visionforgex')} onChange={(v) => up('on', v)} />
			</section>
			<Card title={__('Where in the article', 'visionforgex')} icon="layers" className={ic.on ? '' : 'is-dim'}>
				<div className="vfx-line">
					<span>{__('Before headings instead of after paragraphs', 'visionforgex')}</span>
					<Switch checked={ic.beforeHeadings} label={__('Before headings', 'visionforgex')} onChange={(v) => up('beforeHeadings', v)} />
				</div>
				<div className="vfx-fields vfx-fields--grid">
					{!ic.beforeHeadings ? (
						<label className="vfx-field">
							<span>{__('After paragraph', 'visionforgex')}</span>
							<input type="number" min="1" max="20" value={ic.first} onChange={(e) => up('first', parseInt(e.target.value || '1', 10))} />
						</label>
					) : null}
					<label className="vfx-field">
						<span>{ic.beforeHeadings ? __('Then before every … headings', 'visionforgex') : __('Then every … paragraphs', 'visionforgex')}</span>
						<input type="number" min="1" max="20" value={ic.every} onChange={(e) => up('every', parseInt(e.target.value || '1', 10))} />
					</label>
					<label className="vfx-field">
						<span>{__('At most per post', 'visionforgex')}</span>
						<input type="number" min="1" max="10" value={ic.max} onChange={(e) => up('max', parseInt(e.target.value || '1', 10))} />
					</label>
					<label className="vfx-field">
						<span>{__('Only in posts with at least … paragraphs', 'visionforgex')}</span>
						<input type="number" min="1" max="50" value={ic.minParagraphs} onChange={(e) => up('minParagraphs', parseInt(e.target.value || '1', 10))} />
					</label>
				</div>
				<div className="vfx-fields">
					<AdSelect s={s} tag={ic.tag} format={ic.format} onChange={(t, f) => setIc(Object.assign({}, ic, { tag: t, format: f }))} />
				</div>
				<div className="vfx-line">
					<span>
						{__('Keep the ad’s space (no page jump)', 'visionforgex')}
						<small>{kept ? sprintf(__('%1$d px on phones, %2$d px on wider screens, plus the label', 'visionforgex'), kept[0], kept[1]) : __('Native ads take the height of your own cards, so no space is kept.', 'visionforgex')}</small>
					</span>
					<Switch checked={ic.reserve} label={__('Keep the space', 'visionforgex')} onChange={(v) => up('reserve', v)} />
				</div>
				<span className="vfx-label">{__('In', 'visionforgex')}</span>
				<div className="vfx-chips">
					{s.where.postTypes.map((t) => {
						const on = ic.postTypes.indexOf(t.id) >= 0;
						return (
							<button key={t.id} type="button" className={'vfx-pick' + (on ? ' is-on' : '')} aria-pressed={on ? 'true' : 'false'} onClick={() => up('postTypes', on ? ic.postTypes.filter((x) => x !== t.id) : ic.postTypes.concat(t.id))}>
								{t.name}
							</button>
						);
					})}
				</div>
			</Card>
			<Card title={__('How it looks', 'visionforgex')} icon="eye" className={ic.on ? '' : 'is-dim'}>
				<ArticleDrawing ic={ic} />
			</Card>

			<Card title={__('Theme spots', 'visionforgex')} icon="desktop" className="vfx-span" aside={
				<div className="vfx-row vfx-row--tight">
					<select className="vfx-select vfx-select--small" value={newHook} onChange={(e) => setNewHook(e.target.value)} aria-label={__('Where', 'visionforgex')}>
						{Object.keys(HOOKS).map((k) => (
							<option key={k} value={k}>
								{HOOKS[k]}
							</option>
						))}
					</select>
					<Button small icon="plus" onClick={() => setSpots(spots.concat({ kind: 'hook', where: newHook, on: true, tag: '', format: 'banner', pages: 'all', label: '' }))}>
						{__('Add', 'visionforgex')}
					</Button>
				</div>
			}>
				<p className="vfx-muted">{__('Through WordPress’s own hooks, so they follow your theme.', 'visionforgex')} {P.blockTheme ? '' : __('"After the title" needs a block theme; in your theme, "Before the content" sits right under the title.', 'visionforgex')}</p>
				{hooks.length ? (
					<ul className="vfx-spots">
						{hooks.map(([x, i]) => (
							<li key={x.id || 'n' + i} className={'vfx-spotrow' + (x.on ? ' is-on' : '')} data-vfx-spot={x.where}>
								<div className="vfx-spotrow-main">
									<b>{HOOKS[x.where]}</b>
									<div className="vfx-fields vfx-fields--grid">
										<AdSelect s={s} tag={x.tag} format={x.format} onChange={(t, f) => setSpots(spots.map((y, j) => (j === i ? Object.assign({}, y, { tag: t, format: f }) : y)))} />
										<label className="vfx-field">
											<span>{__('On', 'visionforgex')}</span>
											<select className="vfx-select" value={x.pages} onChange={(e) => setSpot(i, 'pages', e.target.value)}>
												{Object.keys(PAGES).map((k) => (
													<option key={k} value={k}>
														{PAGES[k]}
													</option>
												))}
											</select>
										</label>
									</div>
								</div>
								<div className="vfx-row vfx-row--tight">
									<Switch checked={x.on} label={HOOKS[x.where]} onChange={(v) => setSpot(i, 'on', v)} />
									<button type="button" className="vfx-iconbtn" aria-label={__('Remove', 'visionforgex')} onClick={() => setSpots(spots.filter((_, j) => j !== i))}>
										<Icon name="trash" size={16} />
									</button>
								</div>
							</li>
						))}
					</ul>
				) : (
					<div className="vfx-empty">
						<Icon name="desktop" size={22} />
						<p>{__('No theme spots yet. Choose where and click Add.', 'visionforgex')}</p>
					</div>
				)}
			</Card>

			<Card title={__('Your own spots', 'visionforgex')} icon="spark" className="vfx-span" aside={
				<Button small kind="primary" icon="eye" onClick={() => setEditor(true)}>
					{__('Open the visual editor', 'visionforgex')}
				</Button>
			}>
				<p className="vfx-muted">{__('Any part of your theme can hold an ad: open your page in the visual editor, click where the ad goes, choose before or after it.', 'visionforgex')}</p>
				{sels.length ? (
					<ul className="vfx-spots">
						{sels.map(([x, i]) => (
							<li key={x.id || 's' + i} className={'vfx-spotrow' + (x.on ? ' is-on' : '')} data-vfx-sel={x.selector}>
								<div className="vfx-spotrow-main">
									<b>{x.label || POSITIONS[x.position]}</b>
									<code>{x.selector}</code>
									<div className="vfx-fields vfx-fields--grid">
										<label className="vfx-field">
											<span>{__('Where', 'visionforgex')}</span>
											<select className="vfx-select" value={x.position} onChange={(e) => setSpot(i, 'position', e.target.value)}>
												{Object.keys(POSITIONS).map((k) => (
													<option key={k} value={k}>
														{POSITIONS[k]}
													</option>
												))}
											</select>
										</label>
										<AdSelect s={s} tag={x.tag} format={x.format} onChange={(t, f) => setSpots(spots.map((y, j) => (j === i ? Object.assign({}, y, { tag: t, format: f }) : y)))} />
										<label className="vfx-field">
											<span>{__('On', 'visionforgex')}</span>
											<select className="vfx-select" value={x.pages} onChange={(e) => setSpot(i, 'pages', e.target.value)}>
												{Object.keys(PAGES).map((k) => (
													<option key={k} value={k}>
														{PAGES[k]}
													</option>
												))}
											</select>
										</label>
									</div>
								</div>
								<div className="vfx-row vfx-row--tight">
									<Switch checked={x.on} label={x.selector} onChange={(v) => setSpot(i, 'on', v)} />
									<button type="button" className="vfx-iconbtn" aria-label={__('Remove', 'visionforgex')} onClick={() => setSpots(spots.filter((_, j) => j !== i))}>
										<Icon name="trash" size={16} />
									</button>
								</div>
							</li>
						))}
					</ul>
				) : (
					<div className="vfx-empty">
						<Icon name="spark" size={22} />
						<p>{__('None yet. Open the visual editor and click where an ad should go.', 'visionforgex')}</p>
					</div>
				)}
			</Card>

			{P.import && P.import.found ? <ImportCard s={s} act={act} busy={busy} /> : null}

			<div className="vfx-span">
				<AdTags s={s} act={act} busy={busy} />
			</div>

			<div className={'vfx-savebar' + (icDirty || spDirty ? ' is-up' : '')} aria-hidden={icDirty || spDirty ? 'false' : 'true'}>
				<span>{__('Placements changed, not saved yet', 'visionforgex')}</span>
				<Button small onClick={() => { setIc(clone(P.incontent)); setSpots(clone(P.spots)); }} disabled={!icDirty && !spDirty}>
					{__('Discard', 'visionforgex')}
				</Button>
				<Button
					small
					kind="primary"
					icon="check"
					busy={busy.incontent || busy.spots}
					disabled={!icDirty && !spDirty}
					onClick={() => {
						const a = icDirty ? act('incontent', { incontent: ic }) : Promise.resolve();
						a.then(() => (spDirty ? act('spots', { spots }) : null));
					}}
				>
					{__('Save', 'visionforgex')}
				</Button>
			</div>

			{editor ? <VisualEditor s={s} spots={spots} onClose={() => setEditor(false)} onAdd={(spot) => { setSpots(spots.concat(spot)); }} /> : null}
		</div>
	);
}

function ImportCard({ s, act, busy }) {
	const plan = s.placements.import;
	const make = plan.items.filter((x) => x.spot || x.incontent).length;
	return (
		<Card title={__('Move over from Ad Inserter', 'visionforgex')} icon="sync" className="vfx-span">
			<p className="vfx-muted">{__('Ad Inserter’s blocks become VisionForgeX spots in the same places. Their ad code is not copied (VisionForgeX serves the ads), and each spot is made switched off, so you check it first. Ad Inserter itself is left as it is.', 'visionforgex')}</p>
			<ul className="vfx-tools">
				{plan.items.map((x) => (
					<li key={x.block} className="vfx-toolrow" data-vfx-import={x.block}>
						<div>
							<b>{x.name}</b>
							<span>{x.note}</span>
						</div>
						<Chip state={x.spot || x.incontent ? 'ok' : 'mute'}>{x.spot || x.incontent ? __('Will be made', 'visionforgex') : __('Skipped', 'visionforgex')}</Chip>
					</li>
				))}
			</ul>
			<div className="vfx-row vfx-row--end">
				<Button kind="primary" icon="plus" busy={busy.import} disabled={!make} onClick={() => act('import', {})}>
					{sprintf(_n('Make %d spot (switched off)', 'Make %d spots (switched off)', make, 'visionforgex'), make)}
				</Button>
			</div>
		</Card>
	);
}

/** The site's own page in a frame: click where an ad goes. */
function VisualEditor({ s, spots, onClose, onAdd }) {
	const P = s.placements;
	const [url, setUrl] = useState(P.pages[0] ? P.pages[0].url : s.home);
	const [pick, setPick] = useState(null);
	const [ready, setReady] = useState(false);
	const [pos, setPos] = useState('after');
	const [ad, setAd] = useState({ tag: '', format: 'banner' });
	const [pages, setPages] = useState('all');
	const [added, setAdded] = useState(0);
	const frame = useRef(null);
	const src = url + (url.indexOf('?') >= 0 ? '&' : '?') + 'vfx_pick=' + encodeURIComponent(P.pick);
	useEffect(() => {
		const on = (e) => {
			if (e.origin !== window.location.origin || !e.data) return;
			if (e.data.type === 'vfx-pick-ready') setReady(true);
			if (e.data.type === 'vfx-pick') setPick(e.data);
		};
		window.addEventListener('message', on);
		return () => window.removeEventListener('message', on);
	}, []);
	const add = () => {
		const spot = { kind: 'selector', selector: pick.selector, position: pos, on: true, tag: ad.tag, format: ad.format, pages, label: '' };
		onAdd(spot);
		try {
			frame.current.contentWindow.postMessage({ type: 'vfx-preview', spot: { selector: pick.selector, position: pos, label: __('New ad spot', 'visionforgex'), on: true } }, window.location.origin);
		} catch (e) {}
		setPick(null);
		setAdded(added + 1);
	};
	const sameOrigin = (() => {
		try {
			return new URL(url).origin === window.location.origin;
		} catch (e) {
			return false;
		}
	})();
	return (
		<div className="vfx-editor" role="dialog" aria-modal="true" aria-label={__('Visual editor', 'visionforgex')}>
			<div className="vfx-editor-bar">
				<b>
					<Icon name="eye" size={16} /> {__('Visual editor', 'visionforgex')}
				</b>
				<select className="vfx-select vfx-select--small" value={url} onChange={(e) => { setUrl(e.target.value); setReady(false); setPick(null); }} aria-label={__('Page', 'visionforgex')}>
					{P.pages.map((p) => (
						<option key={p.url} value={p.url}>
							{p.title}
						</option>
					))}
				</select>
				<span className="vfx-editor-hint">{ready ? __('Click any part of the page where an ad should go.', 'visionforgex') : __('Opening your page…', 'visionforgex')}</span>
				{added ? <Chip state="ok">{sprintf(_n('%d spot added', '%d spots added', added, 'visionforgex'), added)}</Chip> : null}
				<Button small kind="primary" icon="check" onClick={onClose}>
					{added ? __('Done: save it in Placements', 'visionforgex') : __('Close', 'visionforgex')}
				</Button>
			</div>
			<div className="vfx-editor-body">
				{sameOrigin ? <iframe ref={frame} src={src} title={__('Your page', 'visionforgex')} className="vfx-editor-frame" /> : <div className="vfx-empty"><p>{__('Your dashboard and your site are on different addresses, so the page cannot open here.', 'visionforgex')}</p></div>}
				{pick ? (
					<div className="vfx-editor-panel" data-vfx-pickpanel>
						<b>{sprintf(__('An ad by this <%s>', 'visionforgex'), pick.tag)}</b>
						{pick.text ? <span className="vfx-muted">“{pick.text}”</span> : null}
						<code>{pick.selector}</code>
						{pick.count > 1 ? <span className="vfx-chip vfx-chip--warn">{sprintf(__('%d parts of this page match; the first one gets the ad.', 'visionforgex'), pick.count)}</span> : null}
						<div className="vfx-seg" role="radiogroup" aria-label={__('Where', 'visionforgex')}>
							{Object.keys(POSITIONS).map((k) => (
								<button key={k} type="button" role="radio" aria-checked={pos === k ? 'true' : 'false'} className={pos === k ? 'is-on' : ''} onClick={() => setPos(k)}>
									{POSITIONS[k]}
								</button>
							))}
						</div>
						<AdSelect s={s} tag={ad.tag} format={ad.format} onChange={(t, f) => setAd({ tag: t, format: f })} />
						<label className="vfx-field">
							<span>{__('On', 'visionforgex')}</span>
							<select className="vfx-select" value={pages} onChange={(e) => setPages(e.target.value)}>
								{Object.keys(PAGES).map((k) => (
									<option key={k} value={k}>
										{PAGES[k]}
									</option>
								))}
							</select>
						</label>
						<div className="vfx-row vfx-row--end">
							<Button small onClick={() => setPick(null)}>
								{__('Cancel', 'visionforgex')}
							</Button>
							<Button small kind="primary" icon="plus" onClick={add}>
								{__('Add this spot', 'visionforgex')}
							</Button>
						</div>
					</div>
				) : null}
			</div>
		</div>
	);
}

/* ------------------------------------------------------------------ Privacy & signals */

const FEATURES = {
	badads: [__('Bad ads', 'visionforgex'), __('Blocked advertisers and categories.', 'visionforgex')],
	layoutguard: [__('Layout guard', 'visionforgex'), __('Stops ads that push your page around.', 'visionforgex')],
	humancheck: [__('Human check', 'visionforgex'), __('Keeps bots from seeing ads, so buyers pay more.', 'visionforgex')],
	privacy: [__('Privacy & messaging', 'visionforgex'), __('US privacy notice and the ad-blocking message.', 'visionforgex')],
};

export function Privacy({ s, act, busy }) {
	const f = s.privacy.flags;
	const set = (k, v) => act('settings', { changes: { wordpress: { [k]: v } } });
	const cmps = s.privacy.consentPlugins;
	const links = s.links || {};
	return (
		<div className="vfx-grid">
			<section className={'vfx-master vfx-span' + (f.consent ? ' is-on' : '')} data-vfx-flag="consent">
				<div>
					<b>{__('Consent bridge', 'visionforgex')}</b>
					<span>{__('Your consent banner’s answer decides personalised ads, with no extra set-up. Yes: personalised ads. No, or no answer yet: non-personalised ads.', 'visionforgex')}</span>
					<div className="vfx-chips vfx-chips--gap">
						{cmps.length ? cmps.map((n) => <Chip key={n} state="ok">{n}</Chip>) : <Chip state="mute">{__('No consent plugin found', 'visionforgex')}</Chip>}
					</div>
				</div>
				<Switch big checked={f.consent} disabled={busy.settings} label={__('Consent bridge', 'visionforgex')} onChange={(v) => set('consent', v)} />
			</section>
			<Card title={__('Which banners it understands', 'visionforgex')} icon="lock">
				<ul className="vfx-list">
					<li>{__('WP Consent API (Complianz, CookieYes, Cookiebot and others feed it)', 'visionforgex')}</li>
					<li>{__('Complianz, CookieYes, Cookiebot and Borlabs Cookie directly', 'visionforgex')}</li>
					<li>{__('Google consent mode (Site Kit and others)', 'visionforgex')}</li>
				</ul>
				<p className="vfx-foot">{__('A banner that speaks the IAB TCF standard talks to Google directly; then the bridge stands aside.', 'visionforgex')}</p>
			</Card>
			<Card title={__('Without the bridge', 'visionforgex')} icon="alert">
				<p className="vfx-muted">{__('Without a TCF banner on the page, every visitor gets non-personalised ads, which usually earn less. The bridge lets visitors who said yes see personalised ads.', 'visionforgex')}</p>
			</Card>

			<section className={'vfx-master vfx-span' + (f.signals ? ' is-on' : '')} data-vfx-flag="signals">
				<div>
					<b>{__('Page facts from WordPress', 'visionforgex')}</b>
					<span>{__('Each page tells buyers its categories, tags, author, type and length, from WordPress itself, so targeting works on its very first visit. VisionForgeX also hears at once when you publish a post.', 'visionforgex')}</span>
				</div>
				<Switch big checked={f.signals} disabled={busy.settings} label={__('Page facts', 'visionforgex')} onChange={(v) => set('signals', v)} />
			</section>
			<Card title={__('What a page says', 'visionforgex')} icon="file">
				<ul className="vfx-list">
					<li>{__('Categories and tags (their short names), author, post type, short / medium / long', 'visionforgex')}</li>
					<li>{__('"Sensitive content" and "Fewer ads on this page", from the box on each post', 'visionforgex')}</li>
					<li>{__('Never: visitors, users, comments or anything private', 'visionforgex')}</li>
				</ul>
			</Card>
			<Card title={__('When you publish', 'visionforgex')} icon="spark">
				<p className="vfx-muted">{__('The new post’s address, title, excerpt and picture go to VisionForgeX in the background: Page targeting reads it first, Return Reader puts it in your approval queue, Next Read adds it to its list. Each only where you use it.', 'visionforgex')}</p>
			</Card>

			<section className={'vfx-master vfx-span' + (f.qa ? ' is-on' : '')} data-vfx-flag="qa">
				<div>
					<b>{__('Test ads for administrators', 'visionforgex')}</b>
					<span>{__('While you are signed in as an administrator, your pages show Google’s test ads, so you can check placements without clicking real ads. Visitors see real ads as always.', 'visionforgex')}</span>
				</div>
				<Switch big checked={f.qa} disabled={busy.settings} label={__('Test ads for administrators', 'visionforgex')} onChange={(v) => set('qa', v)} />
			</section>

			<Card title={__('Protection', 'visionforgex')} icon="shield" className="vfx-span" aside={links.site ? <Button small href={links.site}>{__('Manage on VisionForgeX', 'visionforgex')}</Button> : null}>
				<ul className="vfx-features">
					{Object.keys(FEATURES).map((k) => {
						const lv = (s.features || {})[k] || 'off';
						return (
							<li key={k} className={'vfx-feature vfx-feature--' + lv}>
								<span>
									{FEATURES[k][0]}
									<small>{FEATURES[k][1]}</small>
								</span>
								<Chip state={lv === 'manage' ? 'ok' : lv === 'view' ? 'info' : 'mute'}>{lv === 'manage' ? __('On your account', 'visionforgex') : lv === 'view' ? __('View only', 'visionforgex') : __('Ask us', 'visionforgex')}</Chip>
							</li>
						);
					})}
				</ul>
			</Card>
		</div>
	);
}

/** Settings: the publisher's own staging addresses. */
export function StagingCard({ s, act, busy }) {
	const [hosts, setHosts] = useState(s.stagingHosts || []);
	const [h, setH] = useState('');
	useEffect(() => setHosts(s.stagingHosts || []), [JSON.stringify(s.stagingHosts)]);
	const dirty = JSON.stringify(hosts) !== JSON.stringify(s.stagingHosts || []);
	return (
		<Card title={__('Staging addresses', 'visionforgex')} icon="shield">
			<p className="vfx-muted">{__('Copies of this site at these addresses stay quiet: no tag, no ads.txt changes. Common staging hosts are known already.', 'visionforgex')}</p>
			<div className="vfx-addrow">
				<input className="vfx-input" type="text" value={h} placeholder="staging.example.com, *.mystagingsite.com" onChange={(e) => setH(e.target.value)} />
				<Button small icon="plus" disabled={!h.trim()} onClick={() => { setHosts(hosts.concat(h.trim())); setH(''); }}>
					{__('Add', 'visionforgex')}
				</Button>
			</div>
			<div className="vfx-chips">
				{hosts.map((x) => (
					<button key={x} type="button" className="vfx-pick is-on" onClick={() => setHosts(hosts.filter((y) => y !== x))}>
						<Icon name="x" size={12} />
						{x}
					</button>
				))}
			</div>
			<div className="vfx-row vfx-row--end">
				<Button small kind="primary" busy={busy.staging} disabled={!dirty} onClick={() => act('staging', { hosts })}>
					{__('Save', 'visionforgex')}
				</Button>
			</div>
		</Card>
	);
}
