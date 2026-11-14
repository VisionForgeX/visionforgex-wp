/**
 * The "VisionForgeX ad" block in the editor: pick one of the site's Ad Tags, or a banner or native spot. The page shows
 * the real spot (rendered on the server by VisionForgeX_Placements); the editor shows a placeholder card.
 */
import { __, sprintf } from '../app/i18n.js';

const { registerBlockType } = wp.blocks;
const { useBlockProps, InspectorControls } = wp.blockEditor;
const { PanelBody, SelectControl, Notice } = wp.components;
const data = window.visionforgexBlock || { connected: false, tags: [], dashboard: '' };

const mark = (
	<svg viewBox="0 0 40 40" width="28" height="28" aria-hidden="true">
		<defs>
			<linearGradient id="vfxBlockGrad" x1="0" y1="0" x2="1" y2="1">
				<stop offset="0" stopColor="#8d5dd9" />
				<stop offset="1" stopColor="#a78bfa" />
			</linearGradient>
		</defs>
		<rect x="16.4" y="1.6" width="7.2" height="36.8" rx="3.2" fill="url(#vfxBlockGrad)" transform="rotate(-45 20 20)" />
		<path d="M20,0.8 L26.4,11.2 L23.2,11.2 L23.2,39.2 L16.8,39.2 L16.8,11.2 L13.6,11.2 Z" fill="url(#vfxBlockGrad)" transform="rotate(45 20 20)" />
	</svg>
);

function options() {
	const out = [
		{ value: 'format:banner', label: __('Banner', 'visionforgex') },
		{ value: 'format:native', label: __('Native', 'visionforgex') },
	];
	data.tags.forEach((t) => out.push({ value: t.id, label: sprintf(__('Ad Tag: %s', 'visionforgex'), t.name) }));
	return out;
}

function Edit({ attributes, setAttributes }) {
	const props = useBlockProps({ className: 'visionforgex-block-edit' });
	const value = attributes.tag ? attributes.tag : 'format:' + (attributes.format || 'banner');
	const tag = data.tags.find((t) => t.id === attributes.tag);
	const choose = (v) => (v.indexOf('format:') === 0 ? setAttributes({ tag: '', format: v.slice(7) }) : setAttributes({ tag: v, format: 'banner' }));
	const what = tag ? tag.name : attributes.format === 'native' ? __('Native ad', 'visionforgex') : __('Banner ad', 'visionforgex');
	const detail = tag ? (tag.format === 'native' ? __('Native', 'visionforgex') : (tag.sizes || []).join(', ') || __('Banner', 'visionforgex')) : __('Sizes chosen by VisionForgeX', 'visionforgex');
	return (
		<>
			<InspectorControls>
				<PanelBody title={__('Ad', 'visionforgex')}>
					<SelectControl label={__('Which ad', 'visionforgex')} value={value} options={options()} onChange={choose} />
					{!attributes.tag && data.mode === 'auto' ? <Notice status="info" isDismissible={false}>{__('VisionForgeX places your ads automatically right now, and in that mode only spots with an Ad Tag load. Choose an Ad Tag, or switch placement in VisionForgeX → Placements.', 'visionforgex')}</Notice> : null}
					{attributes.tag && !tag ? <Notice status="warning" isDismissible={false}>{__('This Ad Tag is no longer on VisionForgeX, so nothing shows here.', 'visionforgex')}</Notice> : null}
					<p>
						<a href={data.dashboard}>{__('Manage Ad Tags', 'visionforgex')}</a>
					</p>
				</PanelBody>
			</InspectorControls>
			<div {...props}>
				<div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '16px 18px', border: '1px dashed #c4b5fd', borderRadius: '14px', background: 'linear-gradient(135deg, rgba(141,93,217,.07), rgba(167,139,250,.05))', fontFamily: 'inherit' }}>
					{mark}
					<div style={{ lineHeight: 1.4 }}>
						<strong style={{ display: 'block' }}>{sprintf(__('VisionForgeX: %s', 'visionforgex'), what)}</strong>
						<span style={{ fontSize: '12px', opacity: 0.75 }}>{data.connected ? detail : __('Connect the site in VisionForgeX first.', 'visionforgex')}</span>
					</div>
				</div>
			</div>
		</>
	);
}

registerBlockType('visionforgex/ad', {
	icon: mark,
	edit: Edit,
	save: () => null,
});
