/**
 * The VisionForgeX dashboard inside WordPress. Built on WordPress's own React (wp.element) and wp.apiFetch; the build
 * (esbuild, see package.json) writes assets/build/app.js. Readable source: this folder.
 */
import { Mark, Icon, Light, Toasts } from './ui.jsx';
import { Welcome, Home, GoLive, AdsTxt, Settings, siteStatus } from './views.jsx';
import { Formats, AdTags, Where, Tools } from './views2.jsx';

const { useState, useEffect, useCallback, render, createRoot } = wp.element;
import { __ } from './i18n.js';
const apiFetch = wp.apiFetch;

const boot = window.visionforgexBoot || {};
const TABS = [
	['home', 'home', __('Home', 'visionforgex')],
	['golive', 'rocket', __('Go live', 'visionforgex')],
	['formats', 'layers', __('Formats', 'visionforgex')],
	['adtags', 'tag', __('Ad Tags', 'visionforgex')],
	['where', 'filter', __('Where ads show', 'visionforgex')],
	['tools', 'wrench', __('Site tools', 'visionforgex')],
	['adstxt', 'file', 'ads.txt'],
	['settings', 'gear', __('Settings', 'visionforgex')],
];

function readStore(key, fallback) {
	try {
		const v = window.localStorage.getItem(key);
		return v === null ? fallback : v;
	} catch (e) {
		return fallback;
	}
}
function writeStore(key, value) {
	try {
		window.localStorage.setItem(key, value);
	} catch (e) {}
}

function App() {
	const [s, setS] = useState(boot.state);
	const [busy, setBusy] = useState({});
	const [toasts, setToasts] = useState([]);
	const [theme, setThemeState] = useState(readStore('visionforgex-theme', 'auto'));
	const first = (window.location.hash || '').replace('#', '');
	const [tab, setTab] = useState(TABS.some((t) => t[0] === first) ? first : boot.came === 'connected' ? 'golive' : 'home');
	const [came] = useState(boot.came);

	const toast = useCallback((text, kind = 'ok') => {
		const id = Date.now() + Math.random();
		setToasts((t) => t.concat({ id, text, kind }).slice(-3));
		setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === 'bad' ? 9000 : 4200);
	}, []);

	const setTheme = (t) => {
		setThemeState(t);
		writeStore('visionforgex-theme', t);
	};
	useEffect(() => {
		const el = document.getElementById('visionforgex-app');
		if (el) el.setAttribute('data-theme', theme);
	}, [theme]);

	// Clean the address bar after coming back from VisionForgeX.
	useEffect(() => {
		if (boot.came && window.history && window.history.replaceState) {
			window.history.replaceState(null, '', boot.page + (window.location.hash || ''));
		}
		if (boot.came === 'connected') {
			toast(__('Connected. Checking your site now…', 'visionforgex'));
			act('health', null, true);
		}
	}, []);

	// A link to another section of the dashboard (…#adtags) opens it without reloading.
	useEffect(() => {
		const on = () => {
			const h = (window.location.hash || '').replace('#', '');
			if (TABS.some((t) => t[0] === h)) setTab(h);
		};
		window.addEventListener('hashchange', on);
		return () => window.removeEventListener('hashchange', on);
	}, []);

	const go = (t) => {
		setTab(t);
		if (window.history && window.history.replaceState) window.history.replaceState(null, '', '#' + t);
		const top = document.getElementById('visionforgex-app');
		if (top && top.getBoundingClientRect().top < 0) top.scrollIntoView({ behavior: 'smooth', block: 'start' });
	};

	const DONE = {
		sync: __('Up to date with VisionForgeX.', 'visionforgex'),
		health: __('Site check finished.', 'visionforgex'),
		adstxt: __('ads.txt saved.', 'visionforgex'),
		disconnect: __('Disconnected. The tag is off your pages.', 'visionforgex'),
		adtag: __('Ad Tag added. Its shortcode is ready to copy.', 'visionforgex'),
		'adtag-del': __('Ad Tag removed.', 'visionforgex'),
		rules: __('Where ads show: saved. It applies from the next page view.', 'visionforgex'),
		speed: __('Saved, and that plugin\u2019s cache cleared.', 'visionforgex'),
		'speed-clear': __('Cache cleared.', 'visionforgex'),
	};

	function act(name, data, quiet) {
		setBusy((b) => Object.assign({}, b, { [name]: true }));
		return apiFetch({ path: '/visionforgex/v1/' + name, method: 'POST', data: data || {} })
			.then((r) => {
				if (name === 'connect' && r.url) {
					window.location.assign(r.url);
					return r;
				}
				if (r.state) setS(r.state);
				if (name === 'pause') toast(data && data.paused ? __('All ads paused. The tag is off every page.', 'visionforgex') : __('Ads are back on.', 'visionforgex'));
				else if (name === 'adstxt' && r.result && !r.result.ok && r.result.message) toast(r.result.message, 'bad');
				else if (name === 'settings') toast(r.changed && r.changed.length ? __('Saved and published to your site.', 'visionforgex') : __('Nothing changed.', 'visionforgex'));
				else if ((name === 'other-off' || name === 'other-undo') && r.message) toast(r.message);
				else if (DONE[name] && !quiet) toast(DONE[name]);
				if (name === 'disconnect') setTab('home');
				return r;
			})
			.catch((e) => {
				toast((e && e.message) || __('Something went wrong. Nothing has changed on your site.', 'visionforgex'), 'bad');
			})
			.finally(() => {
				if (name !== 'connect') setBusy((b) => Object.assign({}, b, { [name]: false }));
			});
	}

	if (!s) return null;
	if (!s.connected) {
		return (
			<>
				<Welcome s={s} act={act} busy={busy} came={came} />
				<Toasts items={toasts} dismiss={(id) => setToasts((t) => t.filter((x) => x.id !== id))} />
			</>
		);
	}

	const [state, title] = siteStatus(s);
	const View = { home: Home, golive: GoLive, formats: Formats, adtags: AdTags, where: Where, tools: Tools, adstxt: AdsTxt, settings: Settings }[tab] || Home;
	return (
		<>
			<header className="vfx-top">
				<div className="vfx-brand">
					<Mark size={30} animate />
					<span className="vfx-word">
						Vision<b>ForgeX</b>
					</span>
				</div>
				<div className="vfx-site">
					<Icon name="globe" size={15} />
					<span>{s.connection.domain}</span>
				</div>
				<div className={'vfx-status vfx-status--' + state}>
					<Light state={state} pulse={state === 'ok'} />
					<span>{title}</span>
				</div>
			</header>
			<nav className="vfx-tabs" aria-label={__('VisionForgeX sections', 'visionforgex')}>
				{TABS.map((t) => (
					<button key={t[0]} type="button" className={'vfx-tab' + (tab === t[0] ? ' is-on' : '')} aria-current={tab === t[0] ? 'page' : undefined} onClick={() => go(t[0])}>
						<Icon name={t[1]} size={16} />
						<span>{t[2]}</span>
					</button>
				))}
			</nav>
			{s.staging ? <div className="vfx-banner vfx-banner--warn vfx-banner--page">{s.staging + ' ' + __('The tag and ads.txt changes stay off on this copy.', 'visionforgex')}</div> : null}
			<main className="vfx-view" key={tab}>
				<View s={s} act={act} busy={busy} go={go} theme={theme} setTheme={setTheme} />
			</main>
			<footer className="vfx-footer">
				<span>
					VisionForgeX – Ad Management &amp; Yield {s.plugin}
				</span>
				<a href="mailto:support@visionforgex.com">support@visionforgex.com</a>
			</footer>
			<Toasts items={toasts} dismiss={(id) => setToasts((t) => t.filter((x) => x.id !== id))} />
		</>
	);
}

function mount() {
	const el = document.getElementById('visionforgex-app');
	if (!el) return;
	el.setAttribute('data-theme', readStore('visionforgex-theme', 'auto'));
	if (createRoot) createRoot(el).render(<App />);
	else render(<App />, el);
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
else mount();
