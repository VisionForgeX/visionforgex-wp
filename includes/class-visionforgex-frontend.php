<?php
/**
 * The site's own VisionForgeX tag on every page, printed from the stored copy (no remote call on a visitor's page
 * load), with the attributes that keep speed plugins from delaying, combining or minifying it.
 *
 * @package VisionForgeX
 */

defined( 'ABSPATH' ) || exit;

/**
 * Front end.
 */
class VisionForgeX_Frontend {

	const HANDLE = 'visionforgex-tag-';

	/** Hooks. */
	public static function init() {
		add_action( 'wp_enqueue_scripts', array( __CLASS__, 'enqueue' ), 1 );
		add_filter( 'script_loader_tag', array( __CLASS__, 'script_tag' ), 20, 3 );
		add_action( 'wp_head', array( __CLASS__, 'preconnect' ), 1 );

		// The best-known speed plugins: keep the tag out of delaying, deferring and combining through each plugin's own
		// filters (the attributes on the script cover the rest). Each can be switched off in Site tools (the undo).
		foreach ( VisionForgeX_Tools::speed_filters() as $key => $filters ) {
			foreach ( $filters as $f ) {
				add_filter(
					$f,
					function ( $items ) use ( $key ) {
						return VisionForgeX_Tools::excluded( $key ) ? self::exclude_list( $items ) : $items;
					}
				);
			}
		}
		add_filter(
			'autoptimize_filter_js_exclude',
			function ( $items ) {
				return VisionForgeX_Tools::excluded( 'autoptimize' ) ? self::exclude_string( $items ) : $items;
			}
		);
	}

	/**
	 * Should this page carry the tag?
	 *
	 * @return bool
	 */
	public static function should_serve() {
		static $done = null;
		if ( null !== $done && did_action( 'wp' ) ) {
			return $done;
		}
		$snap = VisionForgeX_Store::snapshot();
		$ok   = VisionForgeX_Store::connected() && $snap && ! empty( $snap['tag']['scripts'] )
			&& ! empty( $snap['site']['approved'] ) && ! empty( $snap['site']['enabled'] )
			&& ! VisionForgeX_Store::settings()['paused']
			&& '' === VisionForgeX_Store::staging_reason()
			&& ! is_admin() && ! is_feed() && ! is_robots() && ! is_trackback()
			&& ! ( function_exists( 'amp_is_request' ) && amp_is_request() )
			&& ! ( defined( 'REST_REQUEST' ) && REST_REQUEST );
		/**
		 * Lets a developer keep the tag off a page (or force it on).
		 *
		 * @param bool $ok Whether the VisionForgeX tag is printed on this page.
		 */
		$ok = (bool) apply_filters( 'visionforgex_should_serve', $ok );
		if ( did_action( 'wp' ) ) {
			$done = $ok; // Decided once per page, after WordPress knows what the page is.
		}
		return $ok;
	}

	/** @return array The tag's scripts: [['src', 'site', 'crossorigin']]. */
	public static function scripts() {
		$snap = VisionForgeX_Store::snapshot();
		$out  = array();
		// HTTPS only; plain HTTP only from the platform's own address when a developer pointed the plugin at one.
		$dev = 0 === strpos( VISIONFORGEX_PLATFORM, 'http://' ) ? untrailingslashit( VISIONFORGEX_PLATFORM ) . '/' : null;
		foreach ( (array) ( $snap && isset( $snap['tag']['scripts'] ) ? $snap['tag']['scripts'] : array() ) as $s ) {
			if ( is_array( $s ) && ! empty( $s['src'] ) && ( 0 === strpos( (string) $s['src'], 'https://' ) || ( $dev && 0 === strpos( (string) $s['src'], $dev ) ) ) ) {
				$out[] = $s;
			}
		}
		return $out;
	}

	/** Prints nothing itself: the scripts go through WordPress so caching plugins see them the normal way. */
	public static function enqueue() {
		if ( ! self::should_serve() ) {
			return;
		}
		foreach ( self::scripts() as $i => $s ) {
			wp_enqueue_script(
				self::HANDLE . $i,
				esc_url_raw( $s['src'] ),
				array(),
				null, // phpcs:ignore WordPress.WP.EnqueuedResourceParameters.MissingVersion -- the address is the site's own tag, exactly; a ?ver= would bypass its CDN cache.
				array(
					'strategy'  => 'async',
					'in_footer' => false,
				)
			);
		}
	}

	/** Opens the connection to the tag's host early. */
	public static function preconnect() {
		if ( ! self::should_serve() ) {
			return;
		}
		$hosts = array();
		foreach ( self::scripts() as $s ) {
			$p = wp_parse_url( $s['src'] );
			if ( ! empty( $p['host'] ) ) {
				$hosts[ 'https://' . $p['host'] ] = true;
			}
		}
		foreach ( array_keys( $hosts ) as $h ) {
			echo '<link rel="preconnect" href="' . esc_url( $h ) . '" crossorigin>' . "\n";
		}
	}

	/**
	 * Our script tags: async, the site's id, and the "leave me alone" attributes the common speed plugins honour.
	 *
	 * @param string $tag    The script tag.
	 * @param string $handle Its handle.
	 * @param string $src    Its address.
	 * @return string
	 */
	public static function script_tag( $tag, $handle, $src ) {
		if ( 0 !== strpos( $handle, self::HANDLE ) ) {
			return $tag;
		}
		$i = (int) substr( $handle, strlen( self::HANDLE ) );
		$s = self::scripts();
		if ( ! isset( $s[ $i ] ) ) {
			return $tag;
		}
		$attrs = ' async data-cfasync="false" data-no-optimize="1" data-noptimize="1" data-no-minify="1" data-no-defer="1" data-pagespeed-no-defer nowprocket data-vfx-plugin="' . esc_attr( VISIONFORGEX_VERSION ) . '"';
		if ( ! empty( $s[ $i ]['site'] ) ) {
			$attrs .= ' data-site="' . esc_attr( $s[ $i ]['site'] ) . '"';
		}
		if ( ! empty( $s[ $i ]['crossorigin'] ) ) {
			$attrs .= ' crossorigin="anonymous"';
		}
		// WordPress has already added async for the strategy; do not print it twice.
		$tag = preg_replace( '#\sasync(?:=(["\'])async\1)?(?=[\s>])#', '', $tag );
		return preg_replace( '#<script\b#', '<script' . $attrs, $tag, 1 );
	}

	/** @return string[] What identifies the tag to speed plugins. */
	public static function patterns() {
		$p = array( 'securepubads.g.doubleclick.net', 'data-vfx-plugin' );
		foreach ( self::scripts() as $s ) {
			$u = wp_parse_url( $s['src'] );
			if ( ! empty( $u['path'] ) ) {
				$p[] = basename( $u['path'] );
			}
		}
		return array_values( array_unique( $p ) );
	}

	/**
	 * @param mixed $items A speed plugin's exclusion list.
	 * @return mixed
	 */
	public static function exclude_list( $items ) {
		if ( ! VisionForgeX_Store::connected() ) {
			return $items;
		}
		return is_array( $items ) ? array_values( array_unique( array_merge( $items, self::patterns() ) ) ) : $items;
	}

	/**
	 * @param mixed $items Autoptimize's comma list.
	 * @return mixed
	 */
	public static function exclude_string( $items ) {
		if ( ! VisionForgeX_Store::connected() || ! is_string( $items ) ) {
			return $items;
		}
		return rtrim( $items, ", \t" ) . ', ' . implode( ', ', self::patterns() );
	}
}
