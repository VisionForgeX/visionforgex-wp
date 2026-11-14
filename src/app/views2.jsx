/**
 * Phase 2 screens: Formats (with a live preview), Ad Tags, Where ads show, Site tools. Formats and Ad Tags change the
 * site's settings on VisionForgeX (the platform decides what may change and checks every value); Where ads show and
 * Site tools live in WordPress.
 */
import { Icon, Light, Chip, Switch, Button, Card, Modal, CopyButton } from './ui.jsx';
import { __, sprintf, _n } from './i18n.js';

const { useState, useEffect, useMemo } = wp.element;

const FORMAT_INFO = {
	banner: ['layers', __('Banner', 'visionforgex'), __('Display ads in your content, in the sizes you choose.', 'visionforgex')],
	native: ['file', __('Native', 'visionforgex'), __('Ads that look like your own article cards.', 'visionforgex')],
	anchor: ['phone', __('Anchor', 'visionforgex'), __('A slim ad fixed to the top or bottom of the screen.', 'visionforgex')],
	interstitial: ['desktop', __('Interstitial', 'visionforgex'), __('A full-screen ad at natural pauses, the way Google allows.', 'visionforgex')],
	rewarded: ['spark', __('Rewarded', 'visionforgex'), __('Visitors choose to watch an ad to unlock more of your content.', 'visionforgex')],
};
const TRIGGERS = {
	unhideWindow: __('When the visitor comes back to your page', 'visionforgex'),
	navBar: __('When the visitor uses the browser’s navigation bar', 'visionforgex'),
	endOfArticle: __('At the end of an article', 'visionforgex'),
	inactivity: __('After a while without scrolling', 'visionforgex'),
};
const MODES = [
	['auto', __('Automatic', 'visionforgex'), __('VisionForgeX finds the spots in your content.', 'visionforgex')],
	['manual', __('Your own spots', 'visionforgex'), __('Only where you put an Ad Tag, block, shortcode or widget.', 'visionforgex')],
	['hybrid', __('Both', 'visionforgex'), __('Your own spots, then automatic ads below the last one.', 'visionforgex')],
];

const clone = (o) => JSON.parse(JSON.stringify(o));

/** The changes between two settings objects, in the shape the platform takes. */
function diff(a, b) {
	const out = {};
	['mode', 'maxAdsPerPage', 'minPixelsBetweenAds'].forEach((k) => {
		if (a[k] !== b[k]) out[k] = b[k];
	});
	Object.keys(b.formats).forEach((f) => {
		const x = a.formats[f];
		const y = b.formats[f];
		const d = {};
		Object.keys(y).forEach((k) => {
			if (k === 'hasUnit') return;
			if (JSON.stringify(x[k]) !== JSON.stringify(y[k])) d[k] = y[k];
		});
		if (Object.keys(d).length) {
			out.formats = out.formats || {};
			out.formats[f] = d;
		}
	});
	['refresh', 'labeling'].forEach((g) => {
		const d = {};
		Object.keys(b[g]).forEach((k) => {
			if (a[g][k] !== b[g][k]) d[k] = b[g][k];
		});
		if (Object.keys(d).length) out[g] = d;
	});
	return out;
}
function countChanges(d) {
	let n = 0;
	Object.keys(d).forEach((k) => {
		if (k === 'formats') Object.keys(d.formats).forEach((f) => (n += Object.keys(d.formats[f]).length));
		else if (typeof d[k] === 'object') n += Object.keys(d[k]).length;
		else n += 1;
	});
	return n;
}

function NotConnectedYet() {
	return (
		<Card title={__('Waiting for VisionForgeX', 'visionforgex')} icon="sync" className="vfx-span">
			<p className="vfx-muted">{__('Your ad settings show here after the next sync. Open Settings and click Sync now.', 'visionforgex')}</p>
		</Card>
	);
}

/* ------------------------------------------------------------------ Formats */

export function Formats({ s, act, busy }) {
	const saved = s.ads;
	const [draft, setDraft] = useState(saved ? clone(saved) : null);
	const [open, setOpen] = useState('');
	const [device, setDevice] = useState('phone');
	const [overlay, setOverlay] = useState('');
	useEffect(() => setDraft(saved ? clone(saved) : null), [JSON.stringify(saved)]);
	if (!saved || !draft) return <NotConnectedYet />;
	const changes = diff(saved, draft);
	const n = countChanges(changes);
	const set = (fn) => {
		const d = clone(draft);
		fn(d);
		setDraft(d);
	};
	const canSwitchOn = (f) => draft.ready.networkCode && saved.formats[f].hasUnit;
	const why = (f) => (!draft.ready.networkCode ? __('Ready once VisionForgeX has set this site up in Google Ad Manager.', 'visionforgex') : __('Ready once VisionForgeX has made this format’s ad unit. Ask support@visionforgex.com.', 'visionforgex'));
	const save = () =>
		act('settings', { changes }).then((r) => {
			if (r && r.state) setDraft(clone(r.state.ads));
		});
	return (
		<div className="vfx-formats">
			<div className="vfx-formats-main">
				<Card title={__('How ads are placed', 'visionforgex')} icon="layers">
					<div className="vfx-modes" role="radiogroup" aria-label={__('Placement', 'visionforgex')}>
						{MODES.map((m) => (
							<button key={m[0]} type="button" role="radio" aria-checked={draft.mode === m[0] ? 'true' : 'false'} className={'vfx-mode-card' + (draft.mode === m[0] ? ' is-on' : '')} onClick={() => set((d) => (d.mode = m[0]))}>
								<b>{m[1]}</b>
								<span>{m[2]}</span>
							</button>
						))}
					</div>
					<div className="vfx-fields">
						<label className="vfx-field">
							<span>{__('At most, ads on a page', 'visionforgex')}</span>
							<input type="number" min="0" max="30" value={draft.maxAdsPerPage} onChange={(e) => set((d) => (d.maxAdsPerPage = parseInt(e.target.value || '0', 10)))} />
						</label>
						<label className="vfx-field">
							<span>{sprintf(__('Space between ads: %d px', 'visionforgex'), draft.minPixelsBetweenAds)}</span>
							<input type="range" min="200" max="3000" step="50" value={draft.minPixelsBetweenAds} onChange={(e) => set((d) => (d.minPixelsBetweenAds = parseInt(e.target.value, 10)))} />
						</label>
						<label className="vfx-field">
							<span>{__('Label above ads', 'visionforgex')}</span>
							<input type="text" maxLength="40" value={draft.labeling.text} onChange={(e) => set((d) => (d.labeling.text = e.target.value))} />
						</label>
					</div>
				</Card>

				{['banner', 'native', 'anchor', 'interstitial', 'rewarded'].map((f, i) => {
					const fm = draft.formats[f];
					const info = FORMAT_INFO[f];
					const ready = canSwitchOn(f) || saved.formats[f].enabled;
					const isOpen = open === f;
					return (
						<section key={f} className={'vfx-format' + (fm.enabled ? ' is-on' : '') + (isOpen ? ' is-open' : '')} style={{ '--vfx-delay': 40 + i * 50 + 'ms' }} data-vfx-format={f}>
							<div className="vfx-format-head">
								<span className="vfx-format-icon">
									<Icon name={info[0]} size={18} />
								</span>
								<div className="vfx-format-title">
									<b>{info[1]}</b>
									<span>{ready ? info[2] : why(f)}</span>
								</div>
								{f !== 'native' ? (
									<button type="button" className="vfx-format-more" aria-expanded={isOpen ? 'true' : 'false'} onClick={() => setOpen(isOpen ? '' : f)}>
										{__('Settings', 'visionforgex')}
									</button>
								) : null}
								<Switch checked={fm.enabled} disabled={!ready} label={info[1]} onChange={(v) => set((d) => (d.formats[f].enabled = v))} />
							</div>
							{isOpen ? (
								<div className="vfx-format-body">
									{f === 'banner' ? (
										<>
											<span className="vfx-label">{__('Sizes', 'visionforgex')}</span>
											<div className="vfx-chips">
												{draft.sizeOptions.map((z) => {
													const on = fm.sizes.indexOf(z) >= 0;
													return (
														<button key={z} type="button" className={'vfx-pick' + (on ? ' is-on' : '')} aria-pressed={on ? 'true' : 'false'} onClick={() => set((d) => (d.formats.banner.sizes = on ? d.formats.banner.sizes.filter((x) => x !== z) : d.formats.banner.sizes.concat(z)))}>
															{z}
														</button>
													);
												})}
											</div>
											<div className="vfx-line">
												<span>{__('Sticky: the last banner follows the reader down the page', 'visionforgex')}</span>
												<Switch checked={fm.sticky} label={__('Sticky banner', 'visionforgex')} onChange={(v) => set((d) => (d.formats.banner.sticky = v))} />
											</div>
										</>
									) : null}
									{f === 'anchor' ? (
										<div className="vfx-seg" role="radiogroup" aria-label={__('Anchor position', 'visionforgex')}>
											{['top', 'bottom'].map((p) => (
												<button key={p} type="button" role="radio" aria-checked={fm.position === p ? 'true' : 'false'} className={fm.position === p ? 'is-on' : ''} onClick={() => set((d) => (d.formats.anchor.position = p))}>
													{p === 'top' ? __('Top of the screen', 'visionforgex') : __('Bottom of the screen', 'visionforgex')}
												</button>
											))}
										</div>
									) : null}
									{f === 'interstitial'
										? Object.keys(TRIGGERS).map((t) => (
												<div className="vfx-line" key={t}>
													<span>{TRIGGERS[t]}</span>
													<Switch checked={!!fm.triggers[t]} label={TRIGGERS[t]} onChange={(v) => set((d) => (d.formats.interstitial.triggers[t] = v))} />
												</div>
											))
										: null}
									{f === 'rewarded' ? (
										<div className="vfx-fields">
											<label className="vfx-field">
												<span>{__('Headline', 'visionforgex')}</span>
												<input type="text" maxLength="80" value={fm.headline} onChange={(e) => set((d) => (d.formats.rewarded.headline = e.target.value))} />
											</label>
											<label className="vfx-field">
												<span>{__('Line under it', 'visionforgex')}</span>
												<input type="text" maxLength="160" value={fm.subheading} onChange={(e) => set((d) => (d.formats.rewarded.subheading = e.target.value))} />
											</label>
											<label className="vfx-field">
												<span>{__('Button', 'visionforgex')}</span>
												<input type="text" maxLength="40" value={fm.buttonText} onChange={(e) => set((d) => (d.formats.rewarded.buttonText = e.target.value))} />
											</label>
											<label className="vfx-field">
												<span>{__('At most once every … hours', 'visionforgex')}</span>
												<input type="number" min="0" max="720" value={fm.frequencyCapHours} onChange={(e) => set((d) => (d.formats.rewarded.frequencyCapHours = parseInt(e.target.value || '0', 10)))} />
											</label>
											<div className="vfx-line">
												<span>{__('Visitors can close the prompt', 'visionforgex')}</span>
												<Switch checked={fm.dismissible} label={__('Can be closed', 'visionforgex')} onChange={(v) => set((d) => (d.formats.rewarded.dismissible = v))} />
											</div>
										</div>
									) : null}
								</div>
							) : null}
						</section>
					);
				})}

				<Card title={__('Refresh', 'visionforgex')} icon="sync">
					<div className="vfx-line">
						<span>{__('Show a new ad in a spot the reader is still looking at', 'visionforgex')}</span>
						<Switch checked={draft.refresh.enabled} label={__('Refresh', 'visionforgex')} onChange={(v) => set((d) => (d.refresh.enabled = v))} />
					</div>
					{draft.refresh.enabled ? (
						<div className="vfx-fields">
							<label className="vfx-field">
								<span>{sprintf(__('Every %d seconds (Google allows no faster than 30)', 'visionforgex'), draft.refresh.seconds)}</span>
								<input type="range" min="30" max="300" step="5" value={draft.refresh.seconds} onChange={(e) => set((d) => (d.refresh.seconds = parseInt(e.target.value, 10)))} />
							</label>
							<label className="vfx-field">
								<span>{__('At most, refreshes per ad', 'visionforgex')}</span>
								<input type="number" min="0" max="100" value={draft.refresh.maxRefreshesPerSlot} onChange={(e) => set((d) => (d.refresh.maxRefreshesPerSlot = parseInt(e.target.value || '0', 10)))} />
							</label>
						</div>
					) : null}
				</Card>
			</div>

			<aside className="vfx-preview-col">
				<Preview s={s} d={draft} device={device} setDevice={setDevice} overlay={overlay} setOverlay={setOverlay} />
			</aside>

			<div className={'vfx-savebar' + (n ? ' is-up' : '')} aria-hidden={n ? 'false' : 'true'}>
				<span>{sprintf(_n('%d change, not saved yet', '%d changes, not saved yet', n, 'visionforgex'), n)}</span>
				<Button small onClick={() => setDraft(clone(saved))} disabled={!n}>
					{__('Discard', 'visionforgex')}
				</Button>
				<Button small kind="primary" icon="check" busy={busy.settings} onClick={save} disabled={!n}>
					{__('Save and publish', 'visionforgex')}
				</Button>
			</div>
		</div>
	);
}

/** A drawing of a page of this site with the formats switched on: not the real page, a guide to what goes where. */
function Preview({ s, d, device, setDevice, overlay, setOverlay }) {
	const f = d.formats;
	const banners = f.banner.enabled ? Math.min(3, Math.max(1, d.maxAdsPerPage || 1)) : 0;
	const size = (f.banner.sizes[0] || '300x250').split('x').map(Number);
	const phone = device === 'phone';
	const w = phone ? Math.min(size[0], 300) : size[0];
	const h = Math.round((size[1] * w) / size[0]);
	const para = (k) => (
		<div className="vfx-pv-text" key={k}>
			<i style={{ width: '96%' }} />
			<i style={{ width: '88%' }} />
			<i style={{ width: '92%' }} />
			<i style={{ width: '60%' }} />
		</div>
	);
	const body = [];
	for (let i = 0; i < 4; i++) {
		body.push(para('p' + i));
		if (d.mode !== 'manual' && i < banners) {
			body.push(
				<div key={'b' + i} className={'vfx-pv-ad' + (f.banner.sticky && i === banners - 1 ? ' is-sticky' : '')} style={{ width: w * (phone ? 0.78 : 0.62) + 'px', height: Math.max(36, h * (phone ? 0.78 : 0.62)) + 'px' }}>
					<em>{d.labeling.text}</em>
					<b>{f.banner.sizes[0] || '300x250'}</b>
				</div>
			);
		}
		if (d.mode !== 'manual' && i === 1 && f.native.enabled) {
			body.push(
				<div key="n" className="vfx-pv-native">
					<span />
					<div>
						<i style={{ width: '80%' }} />
						<i style={{ width: '55%' }} />
					</div>
					<em>{d.labeling.text}</em>
				</div>
			);
		}
	}
	const rw = f.rewarded;
	return (
		<div className="vfx-preview">
			<div className="vfx-preview-head">
				<b>
					<Icon name="eye" size={16} /> {__('Preview', 'visionforgex')}
				</b>
				<div className="vfx-seg vfx-seg--small" role="radiogroup" aria-label={__('Device', 'visionforgex')}>
					<button type="button" role="radio" aria-checked={phone ? 'true' : 'false'} className={phone ? 'is-on' : ''} onClick={() => setDevice('phone')}>
						<Icon name="phone" size={14} />
						{__('Phone', 'visionforgex')}
					</button>
					<button type="button" role="radio" aria-checked={!phone ? 'true' : 'false'} className={!phone ? 'is-on' : ''} onClick={() => setDevice('desktop')}>
						<Icon name="desktop" size={14} />
						{__('Desktop', 'visionforgex')}
					</button>
				</div>
			</div>
			<div className={'vfx-device vfx-device--' + device}>
				<div className="vfx-pv-screen">
					{f.anchor.enabled && f.anchor.position === 'top' ? <div className="vfx-pv-anchor is-top">{__('Anchor ad', 'visionforgex')}</div> : null}
					<div className="vfx-pv-site">{s.siteName || s.domain}</div>
					<div className="vfx-pv-title">
						<i style={{ width: '82%' }} />
						<i style={{ width: '54%' }} />
					</div>
					{body}
					{d.mode === 'manual' ? <div className="vfx-pv-note">{__('Ads show only where you placed an Ad Tag, block, shortcode or widget.', 'visionforgex')}</div> : null}
					{f.anchor.enabled && f.anchor.position !== 'top' ? <div className="vfx-pv-anchor">{__('Anchor ad', 'visionforgex')}</div> : null}
					{overlay === 'interstitial' ? (
						<div className="vfx-pv-overlay" onClick={() => setOverlay('')}>
							<div className="vfx-pv-inter">
								<em>{d.labeling.text}</em>
								<b>{__('Full-screen ad', 'visionforgex')}</b>
								<span>{__('Shown by Google at the moments you chose', 'visionforgex')}</span>
							</div>
						</div>
					) : null}
					{overlay === 'rewarded' ? (
						<div className="vfx-pv-overlay" onClick={() => setOverlay('')}>
							<div className="vfx-pv-reward">
								<b>{rw.headline || __('Unlock more content', 'visionforgex')}</b>
								<span>{rw.subheading}</span>
								<i style={{ background: rw.accentColor || '#2563eb' }}>{rw.buttonText || __('Watch ad', 'visionforgex')}</i>
								{rw.dismissible ? <small>{__('No thanks', 'visionforgex')}</small> : null}
							</div>
						</div>
					) : null}
				</div>
			</div>
			<div className="vfx-row vfx-row--center">
				<Button small disabled={!f.interstitial.enabled} onClick={() => setOverlay(overlay === 'interstitial' ? '' : 'interstitial')}>
					{__('Show the interstitial', 'visionforgex')}
				</Button>
				<Button small disabled={!f.rewarded.enabled} onClick={() => setOverlay(overlay === 'rewarded' ? '' : 'rewarded')}>
					{__('Show the rewarded prompt', 'visionforgex')}
				</Button>
			</div>
			<p className="vfx-foot">{__('A drawing to show what goes where, not your real page. Real ads depend on what buyers bid.', 'visionforgex')}</p>
		</div>
	);
}

/* ------------------------------------------------------------------ Ad Tags */

export function AdTags({ s, act, busy }) {
	const a = s.ads;
	const [name, setName] = useState('');
	const [format, setFormat] = useState('banner');
	const [sizes, setSizes] = useState(['300x250']);
	const [ask, setAsk] = useState(null);
	if (!a) return <NotConnectedYet />;
	const add = () =>
		act('adtag', { name, format, sizes }).then((r) => {
			if (r && r.state) setName('');
		});
	return (
		<div className="vfx-grid" data-vfx-adtags>
			<Card title={__('Ad Tags', 'visionforgex')} icon="tag" className="vfx-span">
				<p className="vfx-muted">{__('Named ad spots you place yourself, each with its own sizes. Put one in a post with the VisionForgeX ad block or its shortcode, or in a sidebar with the VisionForgeX ad widget (Appearance → Widgets). They are the same Ad Tags as on your VisionForgeX dashboard.', 'visionforgex')}</p>
				{a.adTags.length ? (
					<ul className="vfx-tags">
						{a.adTags.map((t, i) => {
							const sc = '[visionforgex tag="' + t.id + '"]';
							return (
								<li key={t.id} className="vfx-tagrow" style={{ '--vfx-delay': i * 40 + 'ms' }} data-vfx-tag={t.id}>
									<div className="vfx-tagrow-main">
										<b>{t.name}</b>
										<span>{t.format === 'native' ? __('Native', 'visionforgex') : (t.sizes.length ? t.sizes.join(', ') : __('Banner, the site’s sizes', 'visionforgex'))}</span>
										<code>{sc}</code>
									</div>
									<div className="vfx-row">
										<CopyButton text={sc} label={__('Copy shortcode', 'visionforgex')} />
										<Button small kind="danger" icon="trash" onClick={() => setAsk(t)}>
											{__('Remove', 'visionforgex')}
										</Button>
									</div>
								</li>
							);
						})}
					</ul>
				) : (
					<div className="vfx-empty">
						<Icon name="tag" size={22} />
						<p>{__('No Ad Tags yet. Add the first one below.', 'visionforgex')}</p>
					</div>
				)}
			</Card>
			<Card title={__('Add an Ad Tag', 'visionforgex')} icon="plus" className="vfx-span">
				<div className="vfx-fields vfx-fields--row">
					<label className="vfx-field">
						<span>{__('Name', 'visionforgex')}</span>
						<input type="text" maxLength="60" value={name} placeholder={__('Sidebar, after the title…', 'visionforgex')} onChange={(e) => setName(e.target.value)} />
					</label>
					<div className="vfx-field">
						<span>{__('Format', 'visionforgex')}</span>
						<div className="vfx-seg" role="radiogroup" aria-label={__('Format', 'visionforgex')}>
							{['banner', 'native'].map((f) => (
								<button key={f} type="button" role="radio" aria-checked={format === f ? 'true' : 'false'} className={format === f ? 'is-on' : ''} onClick={() => setFormat(f)}>
									{f === 'banner' ? __('Banner', 'visionforgex') : __('Native', 'visionforgex')}
								</button>
							))}
						</div>
					</div>
				</div>
				{format === 'banner' ? (
					<>
						<span className="vfx-label">{__('Sizes', 'visionforgex')}</span>
						<div className="vfx-chips">
							{a.sizeOptions.map((z) => {
								const on = sizes.indexOf(z) >= 0;
								return (
									<button key={z} type="button" className={'vfx-pick' + (on ? ' is-on' : '')} aria-pressed={on ? 'true' : 'false'} onClick={() => setSizes(on ? sizes.filter((x) => x !== z) : sizes.concat(z))}>
										{z}
									</button>
								);
							})}
						</div>
					</>
				) : null}
				<div className="vfx-row vfx-row--end">
					<Button kind="primary" icon="plus" busy={busy.adtag} disabled={!name.trim()} onClick={add}>
						{__('Add Ad Tag', 'visionforgex')}
					</Button>
				</div>
			</Card>
			{ask ? (
				<Modal
					title={sprintf(__('Remove "%s"?', 'visionforgex'), ask.name)}
					onClose={() => setAsk(null)}
					actions={
						<>
							<Button onClick={() => setAsk(null)}>{__('Keep it', 'visionforgex')}</Button>
							<Button kind="danger" busy={busy['adtag-del']} onClick={() => act('adtag-del', { id: ask.id }).then(() => setAsk(null))}>
								{__('Remove', 'visionforgex')}
							</Button>
						</>
					}
				>
					<p>{__('Any block, shortcode or widget still using it simply shows nothing. Nothing else breaks.', 'visionforgex')}</p>
				</Modal>
			) : null}
		</div>
	);
}

/* ------------------------------------------------------------------ Where ads show */

export function Picks({ items, value, onChange, label }) {
	return (
		<div className="vfx-chips" role="group" aria-label={label}>
			{items.map((it) => {
				const on = value.indexOf(it.id) >= 0;
				return (
					<button key={it.id} type="button" className={'vfx-pick' + (on ? ' is-on' : '')} aria-pressed={on ? 'true' : 'false'} onClick={() => onChange(on ? value.filter((x) => x !== it.id) : value.concat(it.id))}>
						{on ? <Icon name="x" size={12} /> : null}
						{it.name}
					</button>
				);
			})}
		</div>
	);
}

export function Where({ s, act, busy }) {
	const w = s.where;
	const [r, setR] = useState(clone(w.rules));
	const [url, setUrl] = useState('');
	const [find, setFind] = useState('');
	useEffect(() => setR(clone(w.rules)), [JSON.stringify(w.rules)]);
	const dirty = JSON.stringify(r) !== JSON.stringify(w.rules);
	const up = (k, v) => setR(Object.assign({}, r, { [k]: v }));
	const cats = useMemo(() => w.categories.filter((c) => !find || c.name.toLowerCase().indexOf(find.toLowerCase()) >= 0).slice(0, 60), [find, w.categories]);
	const members = Object.values(w.members || {});
	return (
		<div className="vfx-grid">
			<section className={'vfx-master vfx-span' + (r.on ? ' is-on' : '')}>
				<div>
					<b>{__('Use these rules', 'visionforgex')}</b>
					<span>{r.on ? __('Pages that match a rule get no VisionForgeX tag at all.', 'visionforgex') : __('Off: ads show wherever VisionForgeX places them. Nothing below applies until you switch this on.', 'visionforgex')}</span>
				</div>
				<Switch big checked={r.on} label={__('Use these rules', 'visionforgex')} onChange={(v) => up('on', v)} />
			</section>

			<Card title={__('Content without ads', 'visionforgex')} icon="file" className={r.on ? '' : 'is-dim'}>
				<span className="vfx-label">{__('Post types', 'visionforgex')}</span>
				<Picks items={w.postTypes} value={r.postTypes} onChange={(v) => up('postTypes', v)} label={__('Post types', 'visionforgex')} />
				<span className="vfx-label">{__('Categories', 'visionforgex')}</span>
				{w.categories.length > 12 ? <input className="vfx-input" type="search" placeholder={__('Find a category', 'visionforgex')} value={find} onChange={(e) => setFind(e.target.value)} /> : null}
				<Picks items={cats} value={r.categories} onChange={(v) => up('categories', v)} label={__('Categories', 'visionforgex')} />
				{w.tags.length ? (
					<>
						<span className="vfx-label">{__('Tags', 'visionforgex')}</span>
						<Picks items={w.tags.slice(0, 60)} value={r.tags} onChange={(v) => up('tags', v)} label={__('Tags', 'visionforgex')} />
					</>
				) : null}
				<span className="vfx-label">{__('Authors', 'visionforgex')}</span>
				<Picks items={w.authors} value={r.authors} onChange={(v) => up('authors', v)} label={__('Authors', 'visionforgex')} />
				{w.templates.length ? (
					<>
						<span className="vfx-label">{__('Page templates', 'visionforgex')}</span>
						<Picks items={w.templates} value={r.templates} onChange={(v) => up('templates', v)} label={__('Page templates', 'visionforgex')} />
					</>
				) : null}
				<span className="vfx-label">{__('Addresses containing', 'visionforgex')}</span>
				<div className="vfx-addrow">
					<input className="vfx-input" type="text" value={url} placeholder="/sponsored/" onChange={(e) => setUrl(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && url.trim()) { up('urls', r.urls.concat(url.trim())); setUrl(''); } }} />
					<Button small icon="plus" disabled={!url.trim()} onClick={() => { up('urls', r.urls.concat(url.trim())); setUrl(''); }}>
						{__('Add', 'visionforgex')}
					</Button>
				</div>
				<Picks items={r.urls.map((u) => ({ id: u, name: u }))} value={r.urls} onChange={(v) => up('urls', v)} label={__('Addresses', 'visionforgex')} />
				<p className="vfx-foot">{sprintf(_n('%d page is set to "No ads on this page" in its own edit screen ("VisionForgeX ads" box).', '%d pages are set to "No ads on this page" in their own edit screens ("VisionForgeX ads" box).', w.postsOff, 'visionforgex'), w.postsOff)}</p>
			</Card>

			<Card title={__('Visitors who see no ads', 'visionforgex')} icon="filter" className={r.on ? '' : 'is-dim'}>
				<div className="vfx-line">
					<span>{__('Anyone logged in', 'visionforgex')}</span>
					<Switch checked={r.loggedIn} label={__('Anyone logged in', 'visionforgex')} onChange={(v) => up('loggedIn', v)} />
				</div>
				<span className="vfx-label">{__('Or only these roles', 'visionforgex')}</span>
				<Picks items={w.roles} value={r.roles} onChange={(v) => up('roles', v)} label={__('Roles', 'visionforgex')} />
				<div className="vfx-line">
					<span>
						{__('Paying members', 'visionforgex')}
						<small>{members.length ? sprintf(__('Found: %s', 'visionforgex'), members.join(', ')) : __('No membership plugin found (MemberPress, Paid Memberships Pro, Restrict Content Pro, WooCommerce Memberships).', 'visionforgex')}</small>
					</span>
					<Switch checked={r.members} disabled={!members.length && !r.members} label={__('Paying members', 'visionforgex')} onChange={(v) => up('members', v)} />
				</div>
				{w.woo ? (
					<>
						<div className="vfx-line">
							<span>{__('WooCommerce: never on the cart, checkout or account pages', 'visionforgex')}</span>
							<Switch checked={r.woo} label={__('WooCommerce pages', 'visionforgex')} onChange={(v) => up('woo', v)} />
						</div>
						<div className="vfx-line">
							<span>{__('WooCommerce: not on product pages either', 'visionforgex')}</span>
							<Switch checked={r.wooProduct} disabled={!r.woo} label={__('Product pages', 'visionforgex')} onChange={(v) => up('wooProduct', v)} />
						</div>
					</>
				) : null}
				<p className="vfx-foot">{__('Page caches serve logged-in visitors fresh pages, so these rules work with every common cache.', 'visionforgex')}</p>
			</Card>

			<div className={'vfx-savebar' + (dirty ? ' is-up' : '')} aria-hidden={dirty ? 'false' : 'true'}>
				<span>{__('Rules changed, not saved yet', 'visionforgex')}</span>
				<Button small onClick={() => setR(clone(w.rules))} disabled={!dirty}>
					{__('Discard', 'visionforgex')}
				</Button>
				<Button small kind="primary" icon="check" busy={busy.rules} disabled={!dirty} onClick={() => act('rules', { rules: r })}>
					{__('Save', 'visionforgex')}
				</Button>
			</div>
		</div>
	);
}

/* ------------------------------------------------------------------ Site tools */

export function Tools({ s, act, busy }) {
	const [ask, setAsk] = useState(null);
	return (
		<div className="vfx-grid">
			<Card title={__('Speed and cache plugins', 'visionforgex')} icon="rocket" className="vfx-span" aside={<Button small icon="sync" busy={busy.health} onClick={() => act('health')}>{__('Check again', 'visionforgex')}</Button>}>
				{s.speed.length ? (
					<ul className="vfx-tools">
						{s.speed.map((p) => (
							<li key={p.key} className="vfx-toolrow" data-vfx-speed={p.key}>
								<div>
									<b>{p.name}</b>
									<span>
										{p.delayed ? (
											<Chip state="bad">{__('Delaying the tag (last check)', 'visionforgex')}</Chip>
										) : p.filters || p.key === 'autoptimize' ? (
											p.excluded ? <Chip state="ok">{__('Kept off the tag', 'visionforgex')}</Chip> : <Chip state="warn">{__('Not kept off (you switched it off)', 'visionforgex')}</Chip>
										) : (
											<Chip state="info">{__('Honours the tag’s own "leave me alone" marks', 'visionforgex')}</Chip>
										)}
									</span>
								</div>
								<div className="vfx-row">
									{p.canClear ? (
										<Button small busy={busy['speed-clear']} onClick={() => act('speed-clear', { key: p.key })}>
											{__('Clear its cache', 'visionforgex')}
										</Button>
									) : null}
									{p.filters || p.key === 'autoptimize' ? <Switch checked={p.excluded} label={sprintf(__('Keep the tag out of %s', 'visionforgex'), p.name)} onChange={(v) => act('speed', { key: p.key, on: v })} /> : null}
								</div>
							</li>
						))}
					</ul>
				) : (
					<div className="vfx-empty">
						<Icon name="rocket" size={22} />
						<p>{__('No speed or cache plugin found. Nothing to fix.', 'visionforgex')}</p>
					</div>
				)}
			</Card>
			<Card title={__('Other ad code on your site', 'visionforgex')} icon="alert" className="vfx-span">
				<p className="vfx-muted">{__('Two ad set-ups on one page fight over the same spots and buyers, and both earn less. Switch the other one off here; each has an undo.', 'visionforgex')}</p>
				{s.others.length ? (
					<ul className="vfx-tools">
						{s.others.map((o) => (
							<li key={o.key} className="vfx-toolrow" data-vfx-other={o.key}>
								<div>
									<b>{o.name}</b>
									<span>{o.kind === 'page' ? __('Found in your home page. Remove it from your theme or header code.', 'visionforgex') : o.kind === 'setting' ? __('A setting in that plugin.', 'visionforgex') : __('An active plugin.', 'visionforgex')}</span>
								</div>
								<div className="vfx-row">
									{o.undo ? (
										<Button small icon="sync" busy={busy['other-undo']} onClick={() => act('other-undo', { key: o.key })}>
											{__('Undo', 'visionforgex')}
										</Button>
									) : null}
									{o.action === 'off' ? (
										<Button small kind="danger" busy={busy['other-off']} onClick={() => act('other-off', { key: o.key })}>
											{__('Switch it off', 'visionforgex')}
										</Button>
									) : null}
									{o.action === 'deactivate' ? (
										<Button small kind="danger" onClick={() => setAsk(o)}>
											{__('Deactivate', 'visionforgex')}
										</Button>
									) : null}
								</div>
							</li>
						))}
					</ul>
				) : (
					<div className="vfx-empty">
						<Icon name="check" size={22} />
						<p>{s.health ? __('No other ad code found.', 'visionforgex') : __('Run the check to look at your home page.', 'visionforgex')}</p>
					</div>
				)}
			</Card>
			{ask ? (
				<Modal
					title={sprintf(__('Deactivate %s?', 'visionforgex'), ask.name)}
					onClose={() => setAsk(null)}
					actions={
						<>
							<Button onClick={() => setAsk(null)}>{__('Keep it', 'visionforgex')}</Button>
							<Button kind="danger" busy={busy['other-off']} onClick={() => act('other-off', { key: ask.key }).then(() => setAsk(null))}>
								{__('Deactivate', 'visionforgex')}
							</Button>
						</>
					}
				>
					<p>{__('The plugin stops running; its settings stay, and Undo turns it back on exactly as it was.', 'visionforgex')}</p>
				</Modal>
			) : null}
		</div>
	);
}
