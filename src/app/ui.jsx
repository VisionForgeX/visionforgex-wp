/**
 * Small building blocks of the VisionForgeX dashboard: the mark, icons, switch, status lights, toasts, modal.
 * Everything renders inside .vfx-app, so nothing here touches the rest of wp-admin.
 */
const { useEffect, useRef, useState } = wp.element;
import { __, sprintf } from './i18n.js';

export function Mark({ size = 34, animate = false, id = 'vfxMarkGrad' }) {
	return (
		<svg className={'vfx-mark' + (animate ? ' vfx-mark--in' : '')} width={size} height={size} viewBox="0 0 40 40" fill="none" aria-hidden="true" focusable="false">
			<defs>
				<linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
					<stop offset="0" stopColor="#8d5dd9" />
					<stop offset="1" stopColor="#a78bfa" />
				</linearGradient>
			</defs>
			<rect className="vfx-mark-a" x="16.4" y="1.6" width="7.2" height="36.8" rx="3.2" fill={'url(#' + id + ')'} transform="rotate(-45 20 20)" />
			<path className="vfx-mark-b" d="M20,0.8 L26.4,11.2 L23.2,11.2 L23.2,39.2 L16.8,39.2 L16.8,11.2 L13.6,11.2 Z" fill={'url(#' + id + ')'} transform="rotate(45 20 20)" />
		</svg>
	);
}

const PATHS = {
	check: 'M5 10.5l3.2 3.2L15 7',
	alert: 'M10 6v4.5M10 13.6v.1M3.2 16h13.6L10 3.6z',
	clock: 'M10 5.5V10l3 2M10 17a7 7 0 1 0 0-14 7 7 0 0 0 0 14z',
	pause: 'M7.5 5v10M12.5 5v10',
	play: 'M7 5l8 5-8 5z',
	sync: 'M15.5 8A6 6 0 0 0 4.6 6.5M4.5 12a6 6 0 0 0 10.9 1.5M15.8 3.8V8h-4.2M4.2 16.2V12h4.2',
	tag: 'M3.5 10.3V4.5a1 1 0 0 1 1-1h5.8l6.2 6.2-6.8 6.8zM7.2 7.2h.1',
	file: 'M5.5 2.8h6l3.5 3.5v10.9H5.5zM11.5 2.8v3.5H15M8 10.5h4.5M8 13.5h4.5',
	globe: 'M10 17a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM3 10h14M10 3c2 2.2 2.8 4.5 2.8 7s-.8 4.8-2.8 7c-2-2.2-2.8-4.5-2.8-7S8 5.2 10 3z',
	plug: 'M7 2.5v4M13 2.5v4M5 6.5h10v2.5a5 5 0 0 1-10 0zM10 14v3.5',
	shield: 'M10 2.8l6 2.4v4.3c0 3.7-2.6 6.5-6 7.7-3.4-1.2-6-4-6-7.7V5.2z',
	out: 'M11.5 3.5h5v5M16.5 3.5l-7 7M14 11.5v4.5H4V6h4.5',
	copy: 'M7 7h9v9.5H7zM4 13V3.5h9',
	sun: 'M10 13.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM10 1.8v1.8M10 16.4v1.8M1.8 10h1.8M16.4 10h1.8M4.2 4.2l1.3 1.3M14.5 14.5l1.3 1.3M4.2 15.8l1.3-1.3M14.5 5.5l1.3-1.3',
	moon: 'M16 12.2A6.6 6.6 0 0 1 7.8 4a6.6 6.6 0 1 0 8.2 8.2z',
	auto: 'M10 17a7 7 0 1 0 0-14zM10 3a7 7 0 0 0 0 14',
	home: 'M3.5 9.2L10 3.8l6.5 5.4M5.3 8v8.2h9.4V8',
	rocket: 'M11.8 3.2c2.6-.6 4.4-.6 5 0 .6.6.6 2.4 0 5L11 14l-5-5zM6 9L3.5 9.5 3 12l3.2.8M11 14l-.5 2.5-2.5.5-.8-3.2M12.6 6.4h.1',
	gear: 'M10 12.6a2.6 2.6 0 1 0 0-5.2 2.6 2.6 0 0 0 0 5.2zM16.2 11.2l1.3 1-1.6 2.8-1.6-.6a6 6 0 0 1-1.8 1l-.3 1.6H8.9l-.3-1.6a6 6 0 0 1-1.8-1l-1.6.6-1.6-2.8 1.3-1a6 6 0 0 1 0-2.1l-1.3-1L5.2 4l1.6.6a6 6 0 0 1 1.8-1l.3-1.6h3.2l.3 1.6a6 6 0 0 1 1.8 1l1.6-.6 1.6 2.8-1.3 1a6 6 0 0 1 0 2.2z',
	x: 'M5.5 5.5l9 9M14.5 5.5l-9 9',
	report: 'M4 16.5V9M8.7 16.5V4.5M13.3 16.5v-6M3 16.5h14',
	mail: 'M3 5.5h14v9H3zM3.5 6l6.5 5 6.5-5',
	lock: 'M5.5 9h9v7.5h-9zM7.5 9V6.6a2.5 2.5 0 0 1 5 0V9',
	spark: 'M10 2.5l1.6 4.4 4.4 1.6-4.4 1.6L10 14.5l-1.6-4.4L4 8.5l4.4-1.6z',
	layers: 'M10 3l7 3.8-7 3.8-7-3.8zM3 10.2l7 3.8 7-3.8M3 13.6l7 3.8 7-3.8',
	filter: 'M3.5 4.5h13l-5 6v5l-3 1.5v-6.5z',
	wrench: 'M12.6 3.4a4 4 0 0 0-4.9 5.3l-4.5 4.5a1.6 1.6 0 0 0 2.3 2.3l4.5-4.5a4 4 0 0 0 5.3-4.9l-2.4 2.4-2.1-.6-.6-2.1z',
	plus: 'M10 4.5v11M4.5 10h11',
	trash: 'M4.5 6h11M8 6V4h4v2M6 6l.7 10.5h6.6L14 6',
	phone: 'M6.5 2.5h7v15h-7zM9.2 15h1.6',
	desktop: 'M2.5 4h15v9.5h-15zM7.5 16.5h5M10 13.5v3',
	eye: 'M2 10s3-5.5 8-5.5S18 10 18 10s-3 5.5-8 5.5S2 10 2 10zM10 12.3a2.3 2.3 0 1 0 0-4.6 2.3 2.3 0 0 0 0 4.6z',
};

export function Icon({ name, size = 18 }) {
	return (
		<svg className="vfx-icon" width={size} height={size} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
			<path d={PATHS[name] || ''} />
		</svg>
	);
}

/** ok | warn | bad | info | wait */
export function Light({ state, pulse = false }) {
	return <span className={'vfx-light vfx-light--' + (state || 'info') + (pulse ? ' vfx-light--pulse' : '')} aria-hidden="true" />;
}

export function Chip({ state = 'info', children }) {
	return <span className={'vfx-chip vfx-chip--' + state}>{children}</span>;
}

export function Switch({ checked, onChange, label, disabled, big = false }) {
	return (
		<button
			type="button"
			role="switch"
			aria-checked={checked ? 'true' : 'false'}
			aria-label={label}
			disabled={disabled}
			className={'vfx-switch' + (checked ? ' is-on' : '') + (big ? ' vfx-switch--big' : '')}
			onClick={() => onChange(!checked)}
		>
			<span className="vfx-switch-knob" />
		</button>
	);
}

export function Button({ children, kind = 'ghost', icon, busy, onClick, href, disabled, type = 'button', small = false }) {
	const cls = 'vfx-btn vfx-btn--' + kind + (busy ? ' is-busy' : '') + (small ? ' vfx-btn--small' : '');
	const inner = (
		<>
			{icon ? <Icon name={icon} size={small ? 15 : 17} /> : null}
			<span>{children}</span>
			{href && /^https?:|^mailto:/.test(href) ? <Icon name="out" size={13} /> : null}
		</>
	);
	if (href) {
		const external = /^https?:/.test(href);
		return (
			<a className={cls} href={href} target={external ? '_blank' : undefined} rel={external ? 'noopener noreferrer' : undefined}>
				{inner}
			</a>
		);
	}
	return (
		<button type={type} className={cls} onClick={onClick} disabled={disabled || busy} aria-busy={busy ? 'true' : undefined}>
			{inner}
		</button>
	);
}

export function Card({ title, icon, aside, children, className = '', delay = 0 }) {
	return (
		<section className={'vfx-card ' + className} style={{ '--vfx-delay': delay + 'ms' }}>
			{title ? (
				<header className="vfx-card-head">
					<h2>
						{icon ? (
							<span className="vfx-card-icon">
								<Icon name={icon} size={16} />
							</span>
						) : null}
						{title}
					</h2>
					{aside}
				</header>
			) : null}
			<div className="vfx-card-body">{children}</div>
		</section>
	);
}

export function Skeleton({ lines = 2 }) {
	const out = [];
	for (let i = 0; i < lines; i++) out.push(<span key={i} className="vfx-skel" style={{ width: 100 - i * 22 + '%' }} />);
	return <div className="vfx-skel-wrap" aria-hidden="true">{out}</div>;
}

export function Toasts({ items, dismiss }) {
	return (
		<div className="vfx-toasts" role="status" aria-live="polite">
			{items.map((t) => (
				<div key={t.id} className={'vfx-toast vfx-toast--' + t.kind}>
					<Icon name={t.kind === 'bad' ? 'alert' : 'check'} size={16} />
					<span>{t.text}</span>
					<button type="button" className="vfx-toast-x" onClick={() => dismiss(t.id)} aria-label={__('Dismiss', 'visionforgex')}>
						<Icon name="x" size={14} />
					</button>
				</div>
			))}
		</div>
	);
}

export function Modal({ title, children, onClose, actions }) {
	const box = useRef(null);
	useEffect(() => {
		const prev = document.activeElement;
		const f = box.current && box.current.querySelector('button, [href], textarea, input');
		if (f) f.focus();
		const key = (e) => {
			if (e.key === 'Escape') onClose();
		};
		document.addEventListener('keydown', key);
		return () => {
			document.removeEventListener('keydown', key);
			if (prev && prev.focus) prev.focus();
		};
	}, []);
	return (
		<div className="vfx-modal-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
			<div className="vfx-modal" role="dialog" aria-modal="true" aria-labelledby="vfx-modal-title" ref={box}>
				<h2 id="vfx-modal-title">{title}</h2>
				<div className="vfx-modal-body">{children}</div>
				<div className="vfx-modal-actions">{actions}</div>
			</div>
		</div>
	);
}

/** "3 min ago" */
export function ago(iso) {
	if (!iso) return __('never', 'visionforgex');
	const t = Date.parse(iso);
	if (!t) return __('never', 'visionforgex');
	const s = Math.max(0, (Date.now() - t) / 1000);
	if (s < 60) return __('just now', 'visionforgex');
	/* translators: %d: minutes */
	if (s < 3600) return sprintf(__('%d min ago', 'visionforgex'), Math.round(s / 60));
	/* translators: %d: hours */
	if (s < 86400 * 1.5) return sprintf(__('%d h ago', 'visionforgex'), Math.round(s / 3600));
	/* translators: %d: days */
	return sprintf(__('%d days ago', 'visionforgex'), Math.round(s / 86400));
}

export function when(iso) {
	const t = Date.parse(iso || '');
	return t ? new Date(t).toLocaleString() : '—';
}

export function CopyButton({ text, label }) {
	const [done, setDone] = useState(false);
	const copy = () => {
		const finish = () => {
			setDone(true);
			setTimeout(() => setDone(false), 1600);
		};
		if (navigator.clipboard && window.isSecureContext) {
			navigator.clipboard.writeText(text).then(finish, () => {});
		} else {
			const ta = document.createElement('textarea');
			ta.value = text;
			ta.setAttribute('readonly', '');
			ta.style.position = 'absolute';
			ta.style.left = '-9999px';
			document.body.appendChild(ta);
			ta.select();
			try {
				document.execCommand('copy');
				finish();
			} catch (e) {}
			document.body.removeChild(ta);
		}
	};
	return (
		<Button small icon={done ? 'check' : 'copy'} onClick={copy}>
			{done ? __('Copied', 'visionforgex') : label || __('Copy', 'visionforgex')}
		</Button>
	);
}

/** A ring that fills to `value` (0..1). */
export function Ring({ value, size = 92, children }) {
	const r = 40;
	const c = 2 * Math.PI * r;
	return (
		<div className="vfx-ring" style={{ width: size, height: size }}>
			<svg viewBox="0 0 100 100" width={size} height={size} aria-hidden="true">
				<defs>
					<linearGradient id="vfxRingGrad" x1="0" y1="0" x2="1" y2="1">
						<stop offset="0" stopColor="#8d5dd9" />
						<stop offset="1" stopColor="#a78bfa" />
					</linearGradient>
				</defs>
				<circle cx="50" cy="50" r={r} className="vfx-ring-track" />
				<circle cx="50" cy="50" r={r} className="vfx-ring-fill" stroke="url(#vfxRingGrad)" strokeDasharray={c} strokeDashoffset={c * (1 - Math.max(0, Math.min(1, value)))} />
			</svg>
			<div className="vfx-ring-in">{children}</div>
		</div>
	);
}

/** A short burst when the site goes live (skipped under "reduce motion"). */
export function Burst() {
	const bits = [];
	for (let i = 0; i < 18; i++) {
		bits.push(<i key={i} style={{ '--a': i * 20 + 'deg', '--d': 60 + (i % 3) * 22 + 'px', '--h': (i % 2 ? 268 : 252) + '' }} />);
	}
	return <div className="vfx-burst" aria-hidden="true">{bits}</div>;
}
