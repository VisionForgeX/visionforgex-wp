<?php
/**
 * Site tools: the speed and cache plugins on this site, and other ad code that would fight with VisionForgeX.
 *
 * Speed plugins. Since 1.0 the tag is kept out of each known plugin's delay, defer and combine lists through the
 * plugin's own filters (and the attributes on the script). Here each plugin found is listed with that switch (on unless
 * the publisher turned it off: the undo), a button that clears its cache, and what the last site check saw.
 *
 * Other ad code. Found two ways: plugins that put ads on pages (active on this site), and ad scripts in the home page the
 * site check loaded (AdSense Auto ads, Ezoic, Mediavine, Raptive, Monumetric, another Ad Manager set-up). One click
 * switches a plugin off (deactivates it) or turns off Site Kit's AdSense code; each has an undo. Code in the theme is
 * only reported: the publisher removes it.
 *
 * @package VisionForgeX
 */

defined( 'ABSPATH' ) || exit;

/**
 * Tools.
 */
class VisionForgeX_Tools {

	const SPEED  = 'visionforgex_speed';  // [key => false] for plugins whose exclusion the publisher switched off.
	const FINDER = 'visionforgex_finder'; // ['undo' => [key => what to restore]].

	/**
	 * The speed and cache plugins the plugin knows: folder => [key, name, filters it uses].
	 *
	 * @return array
	 */
	public static function speed_catalog() {
		return array(
			'wp-rocket'               => array( 'rocket', 'WP Rocket' ),
			'litespeed-cache'         => array( 'litespeed', 'LiteSpeed Cache' ),
			'autoptimize'             => array( 'autoptimize', 'Autoptimize' ),
			'perfmatters'             => array( 'perfmatters', 'Perfmatters' ),
			'sg-cachepress'           => array( 'sgo', 'SiteGround Optimizer' ),
			'w3-total-cache'          => array( 'w3tc', 'W3 Total Cache' ),
			'wp-optimize'             => array( 'wpo', 'WP-Optimize' ),
			'flying-scripts'          => array( 'flying', 'Flying Scripts' ),
			'wp-super-cache'          => array( 'supercache', 'WP Super Cache' ),
			'wp-fastest-cache'        => array( 'fastest', 'WP Fastest Cache' ),
			'breeze'                  => array( 'breeze', 'Breeze' ),
			'nitropack'               => array( 'nitropack', 'NitroPack' ),
			'cloudflare'              => array( 'cloudflare', 'Cloudflare' ),
			'hummingbird-performance' => array( 'hummingbird', 'Hummingbird' ),
		);
	}

	/**
	 * Filters each speed plugin offers to keep a script out (the ones the tag is added to).
	 *
	 * @return array key => filter names
	 */
	public static function speed_filters() {
		return array(
			'rocket'      => array( 'rocket_delay_js_exclusions', 'rocket_exclude_js', 'rocket_exclude_defer_js', 'rocket_minify_excluded_external_js' ),
			'litespeed'   => array( 'litespeed_optimize_js_excludes', 'litespeed_optm_js_defer_exc', 'litespeed_optm_gm_js_exc' ),
			'perfmatters' => array( 'perfmatters_delay_js_exclusions' ),
			'sgo'         => array( 'sgo_javascript_combine_exclude', 'sgo_js_async_exclude', 'sgo_js_minify_exclude' ),
		);
	}

	/**
	 * Other plugins that put ads on pages: folder => [key, name, what the plugin does].
	 *
	 * @return array
	 */
	public static function ad_catalog() {
		return array(
			'ad-inserter'                => array( 'adinserter', 'Ad Inserter' ),
			'advanced-ads'               => array( 'advancedads', 'Advanced Ads' ),
			'quick-adsense-reloaded'     => array( 'quads', 'WP QUADS' ),
			'ezoic-integration'          => array( 'ezoicplugin', 'Ezoic' ),
			'mediavine-control-panel'    => array( 'mediavineplugin', 'Mediavine Control Panel' ),
			'adthrive-ads'               => array( 'adthriveplugin', 'Raptive Ads' ),
			'ads-txt'                    => array( 'adstxtmanager', 'Ads.txt Manager' ),
			'woocommerce-google-adsense' => array( 'wcadsense', 'Google AdSense for WooCommerce' ),
		);
	}

	/** Hooks. */
	public static function init() {
		// Nothing: the exclusions are added in VisionForgeX_Frontend, which asks excluded() for each plugin.
	}

	/** @return string[] Folder names of the active plugins (single site and network-wide). */
	public static function active_folders() {
		$files = (array) get_option( 'active_plugins', array() );
		if ( is_multisite() ) {
			$files = array_merge( $files, array_keys( (array) get_site_option( 'active_sitewide_plugins', array() ) ) );
		}
		$out = array();
		foreach ( $files as $f ) {
			$out[ strtok( (string) $f, '/' ) ] = (string) $f;
		}
		return $out;
	}

	/**
	 * Is the tag kept out of this plugin's lists? (On unless the publisher switched it off.)
	 *
	 * @param string $key Plugin key.
	 * @return bool
	 */
	public static function excluded( $key ) {
		$s = get_option( self::SPEED, array() );
		return ! ( is_array( $s ) && isset( $s[ $key ] ) && false === $s[ $key ] );
	}

	/**
	 * Switches the exclusion for a plugin.
	 *
	 * @param string $key Plugin key.
	 * @param bool   $on  Keep the tag out.
	 */
	public static function set_excluded( $key, $on ) {
		$s = get_option( self::SPEED, array() );
		$s = is_array( $s ) ? $s : array();
		if ( $on ) {
			unset( $s[ $key ] );
		} else {
			$s[ $key ] = false;
		}
		update_option( self::SPEED, $s, true );
	}

	/** @return array The speed plugins found, for the dashboard. */
	public static function speed() {
		$active  = self::active_folders();
		$filters = self::speed_filters();
		$last    = VisionForgeX_Health::last();
		$delayed = '';
		foreach ( (array) ( $last && isset( $last['checks'] ) ? $last['checks'] : array() ) as $c ) {
			if ( 'tag' === $c['key'] && 'bad' === $c['state'] ) {
				$delayed = (string) $c['text'];
			}
		}
		$out = array();
		foreach ( self::speed_catalog() as $folder => $info ) {
			if ( ! isset( $active[ $folder ] ) ) {
				continue;
			}
			$key   = $info[0];
			$out[] = array(
				'key'      => $key,
				'name'     => $info[1],
				'filters'  => isset( $filters[ $key ] ),
				'excluded' => self::excluded( $key ),
				'canClear' => self::can_clear( $key ),
				'delayed'  => '' !== $delayed && false !== stripos( $delayed, $info[1] ),
			);
		}
		return $out;
	}

	/**
	 * @param string $key Plugin key.
	 * @return bool
	 */
	public static function can_clear( $key ) {
		$map = array(
			'rocket'      => function_exists( 'rocket_clean_domain' ),
			'litespeed'   => defined( 'LSCWP_V' ),
			'autoptimize' => class_exists( 'autoptimizeCache' ),
			'w3tc'        => function_exists( 'w3tc_flush_all' ),
			'supercache'  => function_exists( 'wp_cache_clear_cache' ),
			'sgo'         => function_exists( 'sg_cachepress_purge_cache' ),
			'wpo'         => class_exists( 'WP_Optimize' ),
			'breeze'      => defined( 'BREEZE_VERSION' ),
			'fastest'     => class_exists( 'WpFastestCache' ),
		);
		return ! empty( $map[ $key ] );
	}

	/**
	 * Clears one plugin's cache.
	 *
	 * @param string $key Plugin key.
	 * @return bool It was asked.
	 */
	public static function clear( $key ) {
		// phpcs:disable WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedHooknameFound -- other plugins' own hooks.
		switch ( $key ) {
			case 'rocket':
				if ( function_exists( 'rocket_clean_domain' ) ) {
					rocket_clean_domain();
					return true;
				}
				break;
			case 'litespeed':
				do_action( 'litespeed_purge_all' );
				return defined( 'LSCWP_V' );
			case 'autoptimize':
				if ( class_exists( 'autoptimizeCache' ) && method_exists( 'autoptimizeCache', 'clearall' ) ) {
					autoptimizeCache::clearall();
					return true;
				}
				break;
			case 'w3tc':
				if ( function_exists( 'w3tc_flush_all' ) ) {
					w3tc_flush_all();
					return true;
				}
				break;
			case 'supercache':
				if ( function_exists( 'wp_cache_clear_cache' ) ) {
					wp_cache_clear_cache();
					return true;
				}
				break;
			case 'sgo':
				if ( function_exists( 'sg_cachepress_purge_cache' ) ) {
					sg_cachepress_purge_cache();
					return true;
				}
				break;
			case 'wpo':
				do_action( 'wpo_cache_flush' );
				return class_exists( 'WP_Optimize' );
			case 'breeze':
				do_action( 'breeze_clear_all_cache' );
				return defined( 'BREEZE_VERSION' );
			case 'fastest':
				do_action( 'wpfc_clear_all_cache' );
				return class_exists( 'WpFastestCache' );
		}
		// phpcs:enable
		return false;
	}

	/* ------------------------------------------------------------------ other ad code */

	/**
	 * Ad scripts in a page: [key => name]. Our own tag and Google's library it loads are not counted.
	 *
	 * @param string $html The page.
	 * @return array
	 */
	public static function scan_html( $html ) {
		$found = array();
		$sigs  = array(
			'adsense'    => array( 'Google AdSense (Auto ads or ad units)', '#pagead2\.googlesyndication\.com/pagead/js/adsbygoogle\.js#i' ),
			'ezoic'      => array( 'Ezoic', '#(ezojs\.com|ezoic\.net|ezoic\.com/ezoic)#i' ),
			'mediavine'  => array( 'Mediavine', '#scripts\.mediavine\.com#i' ),
			'raptive'    => array( 'Raptive (AdThrive)', '#(ads\.adthrive\.com|cafemedia\.com|raptive\.com/)#i' ),
			'monumetric' => array( 'Monumetric', '#monu\.delivery#i' ),
			'newor'      => array( 'Newor Media', '#newormedia\.com#i' ),
			'amazonads'  => array( 'Amazon Publisher Services', '#c\.amazon-adsystem\.com/aax2/apstag\.js#i' ),
		);
		foreach ( $sigs as $k => $s ) {
			if ( preg_match( $s[1], $html ) ) {
				$found[ $k ] = $s[0];
			}
		}
		// Another Ad Manager set-up: slots defined in the page's own code (our tag defines its slots from its file).
		if ( preg_match( '#googletag\.defineSlot\(|googletag\.defineOutOfPageSlot\(#', $html ) ) {
			$found['gpt'] = __( 'Another Google Ad Manager set-up (googletag.defineSlot in the page)', 'visionforgex' );
		}
		return $found;
	}

	/** @return array What the dashboard shows: plugins found, code found in the page, undo available. */
	public static function others() {
		$active = self::active_folders();
		$undo   = self::undo_list();
		$out    = array();
		foreach ( self::ad_catalog() as $folder => $info ) {
			$key = $info[0];
			if ( isset( $active[ $folder ] ) ) {
				$out[] = array(
					'key'    => $key,
					'name'   => $info[1],
					'kind'   => 'plugin',
					'action' => current_user_can( 'deactivate_plugin', $active[ $folder ] ) ? 'deactivate' : '',
					'undo'   => false,
				);
			} elseif ( isset( $undo[ $key ] ) ) {
				$out[] = array(
					'key'    => $key,
					'name'   => $info[1],
					'kind'   => 'plugin',
					'action' => '',
					'undo'   => true,
				);
			}
		}
		$sk = get_option( 'googlesitekit_adsense_settings' );
		if ( isset( $active['google-site-kit'] ) && is_array( $sk ) ) {
			if ( ! empty( $sk['useSnippet'] ) ) {
				$out[] = array(
					'key'    => 'sitekit',
					'name'   => __( 'Site Kit by Google: AdSense code', 'visionforgex' ),
					'kind'   => 'setting',
					'action' => 'off',
					'undo'   => false,
				);
			} elseif ( isset( $undo['sitekit'] ) ) {
				$out[] = array(
					'key'    => 'sitekit',
					'name'   => __( 'Site Kit by Google: AdSense code', 'visionforgex' ),
					'kind'   => 'setting',
					'action' => '',
					'undo'   => true,
				);
			}
		}
		$last = VisionForgeX_Health::last();
		foreach ( (array) ( $last && isset( $last['found'] ) ? $last['found'] : array() ) as $k => $name ) {
			$out[] = array(
				'key'    => 'page:' . sanitize_key( $k ),
				'name'   => (string) $name,
				'kind'   => 'page',
				'action' => '',
				'undo'   => false,
			);
		}
		return $out;
	}

	/** @return array What can be put back: [key => file or value]. */
	public static function undo_list() {
		$f = get_option( self::FINDER, array() );
		return is_array( $f ) && isset( $f['undo'] ) && is_array( $f['undo'] ) ? $f['undo'] : array();
	}

	/**
	 * @param array $undo New undo list.
	 */
	private static function save_undo( array $undo ) {
		update_option( self::FINDER, array( 'undo' => $undo ), false );
	}

	/**
	 * Switches one off.
	 *
	 * @param string $key From others().
	 * @return array ['ok', 'message']
	 */
	public static function switch_off( $key ) {
		$undo = self::undo_list();
		if ( 'sitekit' === $key ) {
			$sk = get_option( 'googlesitekit_adsense_settings' );
			if ( ! is_array( $sk ) || empty( $sk['useSnippet'] ) ) {
				return array(
					'ok'      => false,
					'message' => __( 'Site Kit is not placing AdSense code.', 'visionforgex' ),
				);
			}
			$sk['useSnippet'] = false;
			update_option( 'googlesitekit_adsense_settings', $sk );
			$undo['sitekit'] = true;
			self::save_undo( $undo );
			VisionForgeX_Store::log( __( 'Site Kit: AdSense code switched off', 'visionforgex' ) );
			VisionForgeX_Health::clear_caches();
			return array(
				'ok'      => true,
				'message' => __( 'Site Kit no longer places AdSense code on your pages.', 'visionforgex' ),
			);
		}
		$active = self::active_folders();
		foreach ( self::ad_catalog() as $folder => $info ) {
			if ( $info[0] !== $key ) {
				continue;
			}
			if ( ! isset( $active[ $folder ] ) ) {
				return array(
					'ok'      => false,
					'message' => __( 'That plugin is not active.', 'visionforgex' ),
				);
			}
			if ( ! current_user_can( 'deactivate_plugin', $active[ $folder ] ) ) {
				return array(
					'ok'      => false,
					'message' => __( 'You may not deactivate that plugin.', 'visionforgex' ),
				);
			}
			require_once ABSPATH . 'wp-admin/includes/plugin.php';
			deactivate_plugins( $active[ $folder ], false, is_plugin_active_for_network( $active[ $folder ] ) );
			$undo[ $key ] = $active[ $folder ];
			self::save_undo( $undo );
			/* translators: %s: a plugin's name */
			VisionForgeX_Store::log( sprintf( __( 'Deactivated %s (other ad code)', 'visionforgex' ), $info[1] ) );
			VisionForgeX_Health::clear_caches();
			return array(
				'ok'      => true,
				/* translators: %s: a plugin's name */
				'message' => sprintf( __( '%s is deactivated. Undo puts it back as it was.', 'visionforgex' ), $info[1] ),
			);
		}
		return array(
			'ok'      => false,
			'message' => __( 'Nothing to switch off.', 'visionforgex' ),
		);
	}

	/**
	 * Puts one back.
	 *
	 * @param string $key From others().
	 * @return array ['ok', 'message']
	 */
	public static function undo( $key ) {
		$undo = self::undo_list();
		if ( ! isset( $undo[ $key ] ) ) {
			return array(
				'ok'      => false,
				'message' => __( 'There is nothing to undo.', 'visionforgex' ),
			);
		}
		if ( 'sitekit' === $key ) {
			$sk = get_option( 'googlesitekit_adsense_settings' );
			if ( is_array( $sk ) ) {
				$sk['useSnippet'] = true;
				update_option( 'googlesitekit_adsense_settings', $sk );
			}
			unset( $undo['sitekit'] );
			self::save_undo( $undo );
			VisionForgeX_Store::log( __( 'Site Kit: AdSense code back on', 'visionforgex' ) );
			VisionForgeX_Health::clear_caches();
			return array(
				'ok'      => true,
				'message' => __( 'Site Kit places its AdSense code again.', 'visionforgex' ),
			);
		}
		$file = (string) $undo[ $key ];
		if ( ! current_user_can( 'activate_plugin', $file ) ) {
			return array(
				'ok'      => false,
				'message' => __( 'You may not activate that plugin.', 'visionforgex' ),
			);
		}
		require_once ABSPATH . 'wp-admin/includes/plugin.php';
		$r = activate_plugin( $file );
		if ( is_wp_error( $r ) ) {
			return array(
				'ok'      => false,
				'message' => $r->get_error_message(),
			);
		}
		unset( $undo[ $key ] );
		self::save_undo( $undo );
		/* translators: %s: a plugin's file */
		VisionForgeX_Store::log( sprintf( __( 'Activated %s again', 'visionforgex' ), $file ) );
		VisionForgeX_Health::clear_caches();
		return array(
			'ok'      => true,
			'message' => __( 'The plugin is active again.', 'visionforgex' ),
		);
	}
}
