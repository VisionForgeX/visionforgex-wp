<?php
/**
 * The site check: the plugin loads its own home page and /ads.txt the way a visitor gets them and says what it found
 * (tag there, not delayed by a speed plugin, ads.txt complete, HTTPS). Then it tells VisionForgeX, which checks the
 * ads.txt itself, so the Getting started step turns green in seconds instead of on the next daily check.
 *
 * Runs from the dashboard and once a day. Also: the twice-daily sync, and clearing the common page caches when the tag
 * changes.
 *
 * @package VisionForgeX
 */

defined( 'ABSPATH' ) || exit;

/**
 * Health.
 */
class VisionForgeX_Health {

	/** Hooks. */
	public static function init() {
		add_action( 'visionforgex_sync', array( __CLASS__, 'cron_sync' ) );
		add_action( 'visionforgex_daily', array( __CLASS__, 'cron_daily' ) );
	}

	/** Twice a day: the latest settings from VisionForgeX. */
	public static function cron_sync() {
		if ( VisionForgeX_Store::connected() && '' === VisionForgeX_Store::staging_reason() ) {
			VisionForgeX_Api::sync();
		}
	}

	/** Once a day: the site check, reported to VisionForgeX. */
	public static function cron_daily() {
		if ( VisionForgeX_Store::connected() && '' === VisionForgeX_Store::staging_reason() ) {
			self::run( true );
		}
	}

	/**
	 * Fetches a page of this site the way a visitor would.
	 *
	 * @param string $url Address.
	 * @return array ['ok', 'status', 'body', 'error']
	 */
	private static function fetch( $url ) {
		$r = wp_remote_get(
			$url,
			array(
				'timeout'     => 15,
				'redirection' => 3,
				/** This filter is documented in wp-includes/class-wp-http-streams.php */
				'sslverify'   => apply_filters( 'https_local_ssl_verify', false ), // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedHooknameFound -- WordPress's own filter.
				'user-agent'  => 'Mozilla/5.0 (compatible; VisionForgeX-site-check/' . VISIONFORGEX_VERSION . '; +https://visionforgex.com)',
				'cookies'     => array(),
				'headers'     => array( 'Accept' => 'text/html,text/plain,*/*' ),
			)
		);
		if ( is_wp_error( $r ) ) {
			return array(
				'ok'     => false,
				'status' => 0,
				'body'   => '',
				'error'  => $r->get_error_message(),
			);
		}
		$st = (int) wp_remote_retrieve_response_code( $r );
		return array(
			'ok'     => $st >= 200 && $st < 300,
			'status' => $st,
			'body'   => substr( (string) wp_remote_retrieve_body( $r ), 0, 3000000 ),
			'error'  => '',
		);
	}

	/**
	 * Looks for the tag in a page. 'ok' | 'missing' | the name of what is delaying it.
	 *
	 * @param string $html The page.
	 * @return string
	 */
	public static function tag_state( $html ) {
		$scripts = VisionForgeX_Frontend::scripts();
		$site    = null;
		foreach ( $scripts as $s ) {
			if ( ! empty( $s['site'] ) ) {
				$site = $s;
			}
		}
		if ( ! $site ) {
			return 'missing';
		}
		$file = basename( (string) wp_parse_url( $site['src'], PHP_URL_PATH ) );
		if ( ! preg_match_all( '#<script\b[^>]*>#i', $html, $m ) ) {
			return 'missing';
		}
		foreach ( $m[0] as $tag ) {
			if ( false === strpos( $tag, $file ) ) {
				continue;
			}
			if ( preg_match( '#type=["\']?rocketlazyloadscript|data-rocket-src#i', $tag ) ) {
				return 'WP Rocket';
			}
			if ( preg_match( '#type=["\']?text/litespeed|data-litespeed-src#i', $tag ) ) {
				return 'LiteSpeed Cache';
			}
			if ( preg_match( '#type=["\']?pmdelayedscript|data-perfmatters#i', $tag ) ) {
				return 'Perfmatters';
			}
			if ( preg_match( '#data-type=["\']?lazy|data-flying-scripts|flying-scripts#i', $tag ) ) {
				return 'Flying Scripts';
			}
			if ( preg_match( '#type=["\']?text/plain#i', $tag ) ) {
				return __( 'a consent or speed plugin', 'visionforgex' );
			}
			if ( preg_match( '#\bsrc=#i', $tag ) ) {
				return 'ok';
			}
		}
		return 'missing';
	}

	/**
	 * The check, and (when $report) the report to VisionForgeX.
	 *
	 * @param bool $report Tell VisionForgeX.
	 * @return array ['at', 'checks' => [['key', 'state' => ok|warn|bad|info, 'text']], 'platform' => …]
	 */
	public static function run( $report = true ) {
		$checks = array();
		$add    = function ( $key, $state, $text ) use ( &$checks ) {
			$checks[] = array(
				'key'   => $key,
				'state' => $state,
				'text'  => $text,
			);
		};
		$snap   = VisionForgeX_Store::snapshot();
		$set    = VisionForgeX_Store::settings();
		$stage  = VisionForgeX_Store::staging_reason();

		if ( '' !== $stage ) {
			$add( 'staging', 'warn', $stage . ' ' . __( 'Ads and ads.txt changes stay off here.', 'visionforgex' ) );
		}
		$add( 'https', 0 === strpos( home_url(), 'https://' ) ? 'ok' : 'warn', 0 === strpos( home_url(), 'https://' ) ? __( 'Your site uses HTTPS.', 'visionforgex' ) : __( 'Your site is not on HTTPS. Most buyers pay less, or nothing, on pages without it.', 'visionforgex' ) );

		// The tag on the home page.
		$serving = $snap && ! empty( $snap['site']['approved'] ) && ! empty( $snap['site']['enabled'] );
		$page    = self::fetch( home_url( '/' ) ); // Once: for the tag, and for other ad code in the page.
		if ( $set['paused'] ) {
			$add( 'tag', 'info', __( 'Ads are paused from WordPress, so the tag is off on purpose.', 'visionforgex' ) );
		} elseif ( ! $serving ) {
			$add( 'tag', 'info', __( 'The tag goes on your pages by itself once VisionForgeX has approved the site.', 'visionforgex' ) );
		} elseif ( ! $page['ok'] ) {
				/* translators: %s: an error or an HTTP status */
				$add( 'tag', 'info', sprintf( __( 'The plugin could not load your home page from your own server (%s), so it could not look for the tag. Many hosts block this; it does not mean visitors cannot see your site.', 'visionforgex' ), $page['error'] ? $page['error'] : 'HTTP ' . $page['status'] ) );
		} else {
			$t = self::tag_state( $page['body'] );
			if ( 'missing' === $t ) {
				$fresh = self::fetch( add_query_arg( 'vfx_check', wp_rand( 100000, 999999 ), home_url( '/' ) ) );
				$t2    = $fresh['ok'] ? self::tag_state( $fresh['body'] ) : 'missing';
				if ( 'ok' === $t2 ) {
					$add( 'tag', 'warn', __( 'The tag is on your pages, but a page cache is still serving an older copy of the home page. Clear your cache.', 'visionforgex' ) );
				} else {
					$add( 'tag', 'bad', __( 'The tag is not on your home page. Your theme may not call wp_head(), or another plugin removes scripts.', 'visionforgex' ) );
				}
			} elseif ( 'ok' === $t ) {
				$add( 'tag', 'ok', __( 'The tag is on your pages and loads straight away.', 'visionforgex' ) );
			} else {
				/* translators: %s: the plugin that delays scripts */
				$add( 'tag', 'bad', sprintf( __( '%s is delaying the tag, which loses most of the ads. Exclude it from delaying in that plugin\'s settings.', 'visionforgex' ), $t ) );
			}
		}

		// ads.txt, as the world sees it.
		$lines = VisionForgeX_Adstxt::lines();
		if ( $lines ) {
			$root = wp_parse_url( home_url() );
			$url  = $root['scheme'] . '://' . $root['host'] . ( isset( $root['port'] ) ? ':' . $root['port'] : '' ) . '/ads.txt';
			$got  = self::fetch( $url );
			if ( ! $got['ok'] ) {
				$add( 'adstxt', $got['status'] ? 'bad' : 'info', $got['status'] ? sprintf( /* translators: %d: HTTP status */ __( 'Your /ads.txt answers HTTP %d.', 'visionforgex' ), $got['status'] ) : __( 'The plugin could not load your /ads.txt from your own server. VisionForgeX checks it from outside too.', 'visionforgex' ) );
			} else {
				$have = array();
				foreach ( explode( "\n", str_replace( "\r", '', $got['body'] ) ) as $l ) {
					$k = VisionForgeX_Adstxt::key( $l );
					if ( '' !== $k ) {
						$have[ $k ] = true;
					}
				}
				$missing = 0;
				foreach ( $lines as $l ) {
					$k = VisionForgeX_Adstxt::key( $l );
					if ( '' !== $k && ! isset( $have[ $k ] ) ) {
						++$missing;
					}
				}
				if ( 0 === $missing ) {
					$add( 'adstxt', 'ok', __( 'Your ads.txt has every line VisionForgeX needs.', 'visionforgex' ) );
				} else {
					/* translators: %d: how many lines */
					$add( 'adstxt', 'bad', sprintf( _n( 'Your ads.txt is missing %d line VisionForgeX needs.', 'Your ads.txt is missing %d lines VisionForgeX needs.', $missing, 'visionforgex' ), $missing ) );
				}
			}
		}

		$out = array(
			'at'       => gmdate( 'c' ),
			'checks'   => $checks,
			'platform' => null,
			'found'    => $page['ok'] ? VisionForgeX_Tools::scan_html( $page['body'] ) : array(),
		);
		if ( $report && VisionForgeX_Store::connected() && '' === $stage ) {
			$r = VisionForgeX_Api::call(
				'POST',
				'health',
				array(
					'plugin' => VISIONFORGEX_VERSION,
					'wp'     => get_bloginfo( 'version' ),
					'php'    => PHP_VERSION,
					'checks' => $checks,
				)
			);
			if ( $r['ok'] && is_array( $r['data'] ) ) {
				$out['platform'] = array( 'adsTxt' => isset( $r['data']['adsTxt'] ) ? $r['data']['adsTxt'] : null );
				if ( ! empty( $r['data']['snapshot'] ) && is_array( $r['data']['snapshot'] ) ) {
					VisionForgeX_Api::take_snapshot( $r['data']['snapshot'] );
				}
			} else {
				$out['platform'] = array( 'error' => $r['message'] );
			}
		}
		update_option( VisionForgeX_Store::HEALTH, $out, false );
		return $out;
	}

	/** @return array|null The last check. */
	public static function last() {
		$h = get_option( VisionForgeX_Store::HEALTH );
		return is_array( $h ) ? $h : null;
	}

	/** Clears the common page caches, so a change to the tag (or Pause) shows on the next visit. */
	public static function clear_caches() {
		// phpcs:disable WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedHooknameFound -- other plugins' own hooks.
		if ( function_exists( 'rocket_clean_domain' ) ) {
			rocket_clean_domain();
		}
		do_action( 'litespeed_purge_all' );
		if ( function_exists( 'w3tc_flush_all' ) ) {
			w3tc_flush_all();
		}
		if ( function_exists( 'wp_cache_clear_cache' ) ) {
			wp_cache_clear_cache();
		}
		if ( function_exists( 'sg_cachepress_purge_cache' ) ) {
			sg_cachepress_purge_cache();
		}
		if ( class_exists( 'autoptimizeCache' ) && method_exists( 'autoptimizeCache', 'clearall' ) ) {
			autoptimizeCache::clearall();
		}
		do_action( 'breeze_clear_all_cache' );
		do_action( 'wpo_cache_flush' );
		// phpcs:enable
		/** After the plugin asked the page caches to clear. */
		do_action( 'visionforgex_caches_cleared' );
	}
}
