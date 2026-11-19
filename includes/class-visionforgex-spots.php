<?php
/**
 * Ad spots placed by WordPress itself, before the page is cached:
 *
 *   In-content  after paragraph N, then every N paragraphs, up to a number per post (or before headings instead); never
 *               inside a table, list, quote, figure, code block, embed or form. Each spot keeps its height in the HTML
 *               (the size it will show), so the page does not jump when the ad arrives.
 *   Theme spots top of the page, after the title (block themes), before and after the content, before the comments, in
 *               the footer: through WordPress's own hooks.
 *   Your spots  any element of the theme, by its CSS selector (picked on a live preview in the dashboard): the spot is
 *               put in place by a few lines at the end of the page, and the tag picks it up as it appears.
 *
 * Every spot is the same <div data-adx-slot …> the Ad Tags page gives. A spot with an Ad Tag loads in every placement
 * mode; a plain banner or native spot loads when VisionForgeX places "your own spots" (or both). All of it is off until
 * the publisher switches it on, and none of it prints on a page without the tag.
 *
 * @package VisionForgeX
 */

defined( 'ABSPATH' ) || exit;

/**
 * Spots.
 */
class VisionForgeX_Spots {

	const INCONTENT = 'visionforgex_incontent';
	const SPOTS     = 'visionforgex_spots';
	const HOOKS     = array( 'top', 'afterTitle', 'beforeContent', 'afterContent', 'beforeComments', 'footer' );
	const PAGES     = array( 'all', 'singular', 'posts', 'pages', 'home', 'archive' );
	const POSITIONS = array( 'before', 'after', 'prepend', 'append' );
	// Containers whose paragraphs are never counted, and never get an ad inside them.
	const SKIP = array( 'table', 'ul', 'ol', 'dl', 'blockquote', 'figure', 'pre', 'iframe', 'script', 'style', 'form', 'details', 'aside', 'nav', 'noscript', 'object', 'video', 'audio', 'textarea', 'select' );

	/** @var int Spots printed on this page so far (in-content). */
	private static $printed = 0;

	/** Hooks. */
	public static function init() {
		add_filter( 'the_content', array( __CLASS__, 'content' ), 30 );
		add_action( 'wp_body_open', array( __CLASS__, 'hook_top' ), 20 );
		add_action( 'comment_form_before', array( __CLASS__, 'hook_comments' ) );
		add_action( 'wp_footer', array( __CLASS__, 'hook_footer' ), 5 );
		add_action( 'wp_enqueue_scripts', array( __CLASS__, 'selector_script' ), 20 );
		add_filter( 'render_block_core/post-title', array( __CLASS__, 'after_title' ), 10, 2 );
		add_action( 'wp_enqueue_scripts', array( __CLASS__, 'reserve_css' ), 20 );
	}

	/* ------------------------------------------------------------------ settings */

	/** @return array In-content settings. */
	public static function incontent_defaults() {
		return array(
			'on'             => false,
			'first'          => 2,      // After this paragraph.
			'every'          => 4,      // Then every this many.
			'max'            => 3,      // At most per post.
			'minParagraphs'  => 4,      // Posts shorter than this get none.
			'beforeHeadings' => false,  // Before H2/H3 headings instead of after paragraphs.
			'tag'            => '',
			'format'         => 'banner',
			'reserve'        => true,
			'postTypes'      => array( 'post' ),
		);
	}

	/** @return array */
	public static function incontent() {
		$o = get_option( self::INCONTENT, array() );
		return array_merge( self::incontent_defaults(), is_array( $o ) ? $o : array() );
	}

	/**
	 * @param array $in From the dashboard.
	 * @return array Saved.
	 */
	public static function save_incontent( array $in ) {
		$d   = self::incontent_defaults();
		$cur = self::incontent();
		$int = function ( $k, $lo, $hi ) use ( $in, $cur ) {
			return isset( $in[ $k ] ) ? max( $lo, min( $hi, (int) $in[ $k ] ) ) : $cur[ $k ];
		};
		$o   = array(
			'on'             => isset( $in['on'] ) ? ! empty( $in['on'] ) : $cur['on'],
			'first'          => $int( 'first', 1, 20 ),
			'every'          => $int( 'every', 1, 20 ),
			'max'            => $int( 'max', 1, 10 ),
			'minParagraphs'  => $int( 'minParagraphs', 1, 50 ),
			'beforeHeadings' => isset( $in['beforeHeadings'] ) ? ! empty( $in['beforeHeadings'] ) : $cur['beforeHeadings'],
			'tag'            => isset( $in['tag'] ) && preg_match( '/^tag_[a-f0-9]{6,32}$/', (string) $in['tag'] ) ? (string) $in['tag'] : ( isset( $in['tag'] ) ? '' : $cur['tag'] ),
			'format'         => isset( $in['format'] ) ? ( 'native' === $in['format'] ? 'native' : 'banner' ) : $cur['format'],
			'reserve'        => isset( $in['reserve'] ) ? ! empty( $in['reserve'] ) : $cur['reserve'],
			'postTypes'      => isset( $in['postTypes'] ) ? array_values( array_intersect( array_map( 'sanitize_key', (array) $in['postTypes'] ), array_keys( VisionForgeX_Rules::post_types() ) ) ) : $cur['postTypes'],
		);
		if ( ! $o['postTypes'] ) {
			$o['postTypes'] = $d['postTypes'];
		}
		update_option( self::INCONTENT, $o, true );
		return $o;
	}

	/** @return array Theme spots and selector spots: [id => spot]. */
	public static function spots() {
		$s = get_option( self::SPOTS, array() );
		return is_array( $s ) ? $s : array();
	}

	/**
	 * Cleans one spot from the dashboard.
	 *
	 * @param array $in Spot.
	 * @return array|null
	 */
	public static function clean_spot( array $in ) {
		$kind = isset( $in['kind'] ) && 'selector' === $in['kind'] ? 'selector' : 'hook';
		$out  = array(
			'id'     => isset( $in['id'] ) && preg_match( '/^s_[a-z0-9]{6,20}$/', (string) $in['id'] ) ? (string) $in['id'] : 's_' . strtolower( wp_generate_password( 10, false, false ) ),
			'kind'   => $kind,
			'on'     => ! empty( $in['on'] ),
			'tag'    => isset( $in['tag'] ) && preg_match( '/^tag_[a-f0-9]{6,32}$/', (string) $in['tag'] ) ? (string) $in['tag'] : '',
			'format' => isset( $in['format'] ) && 'native' === $in['format'] ? 'native' : 'banner',
			'pages'  => isset( $in['pages'] ) && in_array( $in['pages'], self::PAGES, true ) ? $in['pages'] : 'all',
			'label'  => isset( $in['label'] ) ? sanitize_text_field( mb_substr( (string) $in['label'], 0, 60 ) ) : '',
		);
		if ( 'hook' === $kind ) {
			if ( ! isset( $in['where'] ) || ! in_array( $in['where'], self::HOOKS, true ) ) {
				return null;
			}
			$out['where'] = $in['where'];
		} else {
			$sel = trim( wp_strip_all_tags( isset( $in['selector'] ) ? (string) $in['selector'] : '' ) );
			if ( '' === $sel || strlen( $sel ) > 300 || preg_match( '/[{}<>]|javascript:/i', $sel ) ) {
				return null;
			}
			$out['selector'] = $sel;
			$out['position'] = isset( $in['position'] ) && in_array( $in['position'], self::POSITIONS, true ) ? $in['position'] : 'after';
		}
		return $out;
	}

	/**
	 * Replaces the list of spots.
	 *
	 * @param array $items From the dashboard.
	 * @return array Saved.
	 */
	public static function save_spots( array $items ) {
		$out = array();
		foreach ( array_slice( $items, 0, 50 ) as $in ) {
			$s = is_array( $in ) ? self::clean_spot( $in ) : null;
			if ( $s ) {
				$out[ $s['id'] ] = $s;
			}
		}
		update_option( self::SPOTS, $out, true );
		return $out;
	}

	/* ------------------------------------------------------------------ printing */

	/**
	 * Does a spot's page choice match this page?
	 *
	 * @param string $pages all, singular, posts, pages, home, archive.
	 * @return bool
	 */
	public static function page_matches( $pages ) {
		switch ( $pages ) {
			case 'singular':
				return is_singular();
			case 'posts':
				return is_singular( 'post' );
			case 'pages':
				return is_page();
			case 'home':
				return is_front_page() || is_home();
			case 'archive':
				return is_archive() || is_search() || is_home();
		}
		return true;
	}

	/**
	 * The height a spot keeps for its ad: [phone, wider] in pixels (0: none), from the sizes it can show.
	 *
	 * @param string $tag    Ad Tag id or ''.
	 * @param string $format banner or native.
	 * @return int[]
	 */
	public static function reserve_for( $tag, $format ) {
		$sizes = array();
		$snap  = VisionForgeX_Store::snapshot();
		if ( '' !== $tag ) {
			$tags = VisionForgeX_Placements::tags();
			if ( isset( $tags[ $tag ] ) ) {
				$format = $tags[ $tag ]['format'];
				$sizes  = (array) $tags[ $tag ]['sizes'];
			}
		}
		if ( 'native' === $format ) {
			return array( 0, 0 );
		}
		if ( ! $sizes && $snap && isset( $snap['settings']['formats']['banner']['sizes'] ) ) {
			$sizes = (array) $snap['settings']['formats']['banner']['sizes'];
		}
		$phone = 0;
		$wide  = 0;
		foreach ( $sizes as $z ) {
			if ( ! preg_match( '/^(\d+)x(\d+)$/', (string) $z, $m ) ) {
				continue;
			}
			$w = (int) $m[1];
			$h = (int) $m[2];
			if ( $w <= 360 ) {
				$phone = max( $phone, $h );
			}
			$wide = max( $wide, $h );
		}
		return array( $phone, $wide );
	}

	/**
	 * One spot's HTML.
	 *
	 * @param string $tag     Ad Tag id or ''.
	 * @param string $format  banner or native.
	 * @param string $where   A class suffix.
	 * @param bool   $reserve Keep its height.
	 * @return string
	 */
	public static function html( $tag, $format, $where, $reserve = false ) {
		$inner = VisionForgeX_Placements::spot( $tag, $format, $where );
		if ( '' === $inner || ! $reserve ) {
			return $inner;
		}
		list( $phone, $wide ) = self::reserve_for( $tag, $format );
		if ( ! $phone && ! $wide ) {
			return $inner;
		}
		// The height is kept by CSS variables on the wrapper; the label the tag adds sits inside the same box.
		$style = '--vfx-h:' . ( $phone ? $phone : $wide ) . 'px;--vfx-hw:' . ( $wide ? $wide : $phone ) . 'px';
		return str_replace( 'class="visionforgex-spot visionforgex-spot--' . esc_attr( $where ) . '"', 'class="visionforgex-spot visionforgex-spot--' . esc_attr( $where ) . ' visionforgex-spot--kept" style="' . esc_attr( $style ) . '"', $inner );
	}

	/** The few lines of CSS that keep a spot's height (only when a spot with kept height can appear). */
	public static function reserve_css() {
		$ic = self::incontent();
		if ( ! $ic['on'] || ! $ic['reserve'] || ! VisionForgeX_Frontend::should_serve() ) {
			return;
		}
		VisionForgeX_Frontend::inline_style( 'visionforgex-spots', '.visionforgex-spot--kept{min-height:calc(var(--vfx-h) + 24px);margin:24px auto;text-align:center;box-sizing:border-box}@media (min-width:768px){.visionforgex-spot--kept{min-height:calc(var(--vfx-hw) + 24px)}}' );
	}

	/**
	 * Where the in-content spots go: byte offsets in the content, after top-level paragraphs (or before headings).
	 *
	 * @param string $html The post's content.
	 * @param array  $o    In-content settings.
	 * @return int[]
	 */
	public static function positions( $html, array $o ) {
		$skip = array_flip( self::SKIP );
		if ( ! preg_match_all( '#<(/?)([a-z][a-z0-9-]*)\b[^>]*?(/?)>#i', $html, $m, PREG_SET_ORDER | PREG_OFFSET_CAPTURE ) ) {
			return array();
		}
		$depth = 0;
		$paras = array();
		$heads = array();
		foreach ( $m as $t ) {
			$close = '/' === $t[1][0];
			$name  = strtolower( $t[2][0] );
			$self  = '/' === $t[3][0];
			if ( isset( $skip[ $name ] ) && ! $self ) {
				$depth += $close ? -1 : 1;
				$depth  = max( 0, $depth );
				continue;
			}
			if ( $depth > 0 ) {
				continue;
			}
			if ( $close && 'p' === $name ) {
				$paras[] = $t[0][1] + strlen( $t[0][0] );
			} elseif ( ! $close && ( 'h2' === $name || 'h3' === $name ) ) {
				$heads[] = $t[0][1];
			}
		}
		if ( count( $paras ) < $o['minParagraphs'] ) {
			return array();
		}
		$out = array();
		if ( $o['beforeHeadings'] ) {
			foreach ( $heads as $i => $at ) {
				// Not before the first heading if it comes before the first paragraph; then every Nth heading.
				if ( $paras && $at < $paras[0] ) {
					continue;
				}
				if ( 0 === count( $out ) || 0 === ( $i % max( 1, (int) ceil( $o['every'] / 2 ) ) ) ) {
					$out[] = $at;
				}
			}
		} else {
			$n = count( $paras );
			for ( $p = $o['first']; $p < $n; $p += $o['every'] ) { // Never after the last paragraph.
				$out[] = $paras[ $p - 1 ];
			}
		}
		return array_slice( $out, 0, $o['max'] );
	}

	/**
	 * The content filter: the in-content spots, and the "before/after the content" theme spots.
	 *
	 * @param string $html The post's content.
	 * @return string
	 */
	public static function content( $html ) {
		if ( ! is_singular() || ! in_the_loop() || ! is_main_query() || is_feed() || ! VisionForgeX_Frontend::should_serve() ) {
			return $html;
		}
		$ic = self::incontent();
		if ( $ic['on'] && is_singular( $ic['postTypes'] ) ) {
			$at = self::positions( $html, $ic );
			foreach ( array_reverse( $at ) as $pos ) {
				$spot = self::html( $ic['tag'], $ic['format'], 'content', $ic['reserve'] );
				if ( '' === $spot ) {
					break;
				}
				$html = substr( $html, 0, $pos ) . $spot . substr( $html, $pos );
				++self::$printed;
			}
		}
		return self::hook_html( 'beforeContent' ) . $html . self::hook_html( 'afterContent' );
	}

	/**
	 * The spots set for a hook, on this page.
	 *
	 * @param string $where One of HOOKS.
	 * @return string
	 */
	public static function hook_html( $where ) {
		$out = '';
		foreach ( self::spots() as $s ) {
			if ( 'hook' === $s['kind'] && ! empty( $s['on'] ) && $where === $s['where'] && self::page_matches( $s['pages'] ) ) {
				$out .= VisionForgeX_Placements::spot( $s['tag'], $s['format'], 'theme-' . strtolower( $where ) );
			}
		}
		return $out;
	}

	/** Top of the page. */
	public static function hook_top() {
		if ( VisionForgeX_Frontend::should_serve() ) {
			echo self::hook_html( 'top' ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- built with esc_attr.
		}
	}

	/** Before the comments. */
	public static function hook_comments() {
		if ( VisionForgeX_Frontend::should_serve() ) {
			echo self::hook_html( 'beforeComments' ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- built with esc_attr.
		}
	}

	/** The footer. */
	public static function hook_footer() {
		if ( VisionForgeX_Frontend::should_serve() ) {
			echo self::hook_html( 'footer' ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- built with esc_attr.
		}
	}

	/**
	 * After the post's title (block themes: the Title block of the main post).
	 *
	 * @param string $html  The block.
	 * @param array  $block The block's data.
	 * @return string
	 */
	public static function after_title( $html, $block ) {
		static $done = false;
		if ( $done || ! is_singular() || ! VisionForgeX_Frontend::should_serve() ) {
			return $html;
		}
		$extra = self::hook_html( 'afterTitle' );
		if ( '' === $extra ) {
			return $html;
		}
		$done = true;
		return $html . $extra;
	}

	/** The selector spots: put in place by a few lines at the end of the page (in the footer); the tag picks them up as they appear. */
	public static function selector_script() {
		if ( ! VisionForgeX_Frontend::should_serve() ) {
			return;
		}
		$list = array();
		foreach ( self::spots() as $s ) {
			if ( 'selector' !== $s['kind'] || empty( $s['on'] ) || ! self::page_matches( $s['pages'] ) ) {
				continue;
			}
			$html = VisionForgeX_Placements::spot( $s['tag'], $s['format'], 'selector' );
			if ( '' !== $html ) {
				$list[] = array(
					's' => $s['selector'],
					'p' => $s['position'],
					'h' => $html,
				);
			}
		}
		if ( ! $list ) {
			return;
		}
		// Each selector's first match on the page gets its spot; a selector that matches nothing places nothing.
		$js = '(function(L){var M={before:"beforebegin",after:"afterend",prepend:"afterbegin",append:"beforeend"};'
			. 'for(var i=0;i<L.length;i++){try{var e=document.querySelector(L[i].s);if(e&&!e.closest("[data-adx-slot]"))e.insertAdjacentHTML(M[L[i].p]||"afterend",L[i].h);}catch(x){}}})('
			. wp_json_encode( $list ) . ');';
		VisionForgeX_Frontend::inline_script( 'visionforgex-spots', $js, true );
	}

	/** @return array What the dashboard needs. */
	public static function for_app() {
		return array(
			'incontent'  => self::incontent(),
			'spots'      => array_values( self::spots() ),
			'blockTheme' => function_exists( 'wp_is_block_theme' ) && wp_is_block_theme(),
		);
	}
}
