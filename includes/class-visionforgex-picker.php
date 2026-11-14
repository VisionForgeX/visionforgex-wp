<?php
/**
 * The visual placement editor's other half: the site's own page, opened inside the dashboard with ?vfx_pick=<nonce>,
 * for an administrator only. On that page the tag stays off, links do nothing, and the element under the pointer is
 * outlined; a click sends its CSS selector to the dashboard, which asks where around it the ad goes and saves the spot.
 * The spots already there are drawn on the page, so the publisher sees the whole layout.
 *
 * @package VisionForgeX
 */

defined( 'ABSPATH' ) || exit;

/**
 * Picker.
 */
class VisionForgeX_Picker {

	/** @var bool This page is the picker. */
	private static $on = false;

	/** Hooks. */
	public static function init() {
		add_action( 'template_redirect', array( __CLASS__, 'maybe_start' ), 0 );
	}

	/** @return bool */
	public static function active() {
		return self::$on;
	}

	/** The picker page: only with a valid nonce, for an administrator. */
	public static function maybe_start() {
		if ( ! isset( $_GET['vfx_pick'] ) ) { // phpcs:ignore WordPress.Security.NonceVerification.Recommended -- checked just below.
			return;
		}
		$nonce = sanitize_text_field( wp_unslash( $_GET['vfx_pick'] ) ); // phpcs:ignore WordPress.Security.NonceVerification.Recommended -- this is the nonce.
		if ( ! current_user_can( 'manage_options' ) || ! wp_verify_nonce( $nonce, 'visionforgex_pick' ) ) {
			return;
		}
		self::$on = true;
		add_filter( 'visionforgex_should_serve', '__return_false', 100 );
		add_filter( 'show_admin_bar', '__return_false' );
		add_action( 'wp_footer', array( __CLASS__, 'script' ), 100 );
		nocache_headers();
	}

	/** The picker's own script and look (only on the picker page). */
	public static function script() {
		$spots = array();
		foreach ( VisionForgeX_Spots::spots() as $s ) {
			if ( 'selector' === $s['kind'] ) {
				$spots[] = array(
					'selector' => $s['selector'],
					'position' => $s['position'],
					'label'    => '' !== $s['label'] ? $s['label'] : __( 'Ad spot', 'visionforgex' ),
					'on'       => ! empty( $s['on'] ),
				);
			}
		}
		$css = '.vfx-pk-hover{outline:2px dashed #8d5dd9!important;outline-offset:2px!important;cursor:crosshair!important;background-color:rgba(141,93,217,.06)!important}'
			. '.vfx-pk-mark{display:flex;align-items:center;justify-content:center;gap:8px;margin:10px auto;padding:14px;min-height:60px;max-width:100%;box-sizing:border-box;border:2px dashed #8d5dd9;border-radius:12px;background:repeating-linear-gradient(45deg,rgba(141,93,217,.12) 0 10px,rgba(141,93,217,.05) 10px 20px);color:#6d3fc4;font:600 13px/1.3 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;pointer-events:none}'
			. '.vfx-pk-mark.is-off{opacity:.5}.vfx-pk-mark.is-new{animation:vfxPkPop .5s cubic-bezier(.34,1.56,.64,1) both}@keyframes vfxPkPop{from{transform:scale(.8);opacity:0}to{transform:none;opacity:1}}';
		$js  = '(function(S){var origin=location.origin,cur=null,MAP={before:"beforebegin",after:"afterend",prepend:"afterbegin",append:"beforeend"};'
			. 'function bad(e){return !e||e===document.body||e===document.documentElement||(e.closest&&e.closest(".vfx-pk-mark"));}'
			. 'function esc(s){return window.CSS&&CSS.escape?CSS.escape(s):s.replace(/[^a-zA-Z0-9_-]/g,"\\\\$&");}'
			. 'function step(e){var t=e.tagName.toLowerCase();if(e.id&&!/\\d{3,}/.test(e.id))return"#"+esc(e.id);var c=Array.prototype.filter.call(e.classList||[],function(x){return !/\\d{2,}|^vfx-pk|^is-|^has-|active|hover|focus/.test(x);}).slice(0,2);var s=t+(c.length?"."+c.map(esc).join("."):"");var p=e.parentElement;if(p){var same=Array.prototype.filter.call(p.children,function(x){return x.tagName===e.tagName;});if(same.length>1)s+=":nth-of-type("+(same.indexOf(e)+1)+")";}return s;}'
			. 'function sel(e){var parts=[],x=e;while(x&&x!==document.body&&x.nodeType===1){var s=step(x);parts.unshift(s);var full=parts.join(" > ");try{if(document.querySelector(full)===e)return full;}catch(z){}if(s.charAt(0)==="#")break;x=x.parentElement;}return parts.join(" > ");}'
			. 'function mark(s,isNew){try{var e=document.querySelector(s.selector);if(!e)return;var d=document.createElement("div");d.className="vfx-pk-mark"+(s.on===false?" is-off":"")+(isNew?" is-new":"");d.textContent=s.label||"Ad spot";e.insertAdjacentElement(MAP[s.position]||"afterend",d);}catch(z){}}'
			. 'S.forEach(function(s){mark(s,false);});'
			. 'document.addEventListener("mouseover",function(ev){var e=ev.target;if(bad(e))return;if(cur)cur.classList.remove("vfx-pk-hover");cur=e;e.classList.add("vfx-pk-hover");},true);'
			. 'document.addEventListener("click",function(ev){ev.preventDefault();ev.stopPropagation();var e=ev.target;if(bad(e))return;if(cur)cur.classList.remove("vfx-pk-hover");var s=sel(e);parent.postMessage({type:"vfx-pick",selector:s,tag:e.tagName.toLowerCase(),text:(e.textContent||"").trim().slice(0,80),count:document.querySelectorAll(s).length},origin);},true);'
			. 'document.addEventListener("submit",function(ev){ev.preventDefault();},true);'
			. 'window.addEventListener("message",function(ev){if(ev.origin!==origin||!ev.data||ev.data.type!=="vfx-preview")return;mark(ev.data.spot,true);});'
			. 'parent.postMessage({type:"vfx-pick-ready",title:document.title},origin);})(' . wp_json_encode( $spots ) . ');';
		echo '<style id="visionforgex-picker-css">' . $css . "</style>\n"; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- our own CSS.
		echo '<script id="visionforgex-picker-js">' . $js . "</script>\n"; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- our own script; data through wp_json_encode.
	}
}
