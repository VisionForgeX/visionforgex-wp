<?php
/**
 * The dashboard's calls: visionforgex/v1/…, administrators only (manage_options), with WordPress's REST nonce.
 *
 * @package VisionForgeX
 */

defined( 'ABSPATH' ) || exit;

/**
 * REST routes.
 */
class VisionForgeX_Rest {

	const NS = 'visionforgex/v1';

	/** Hooks. */
	public static function init() {
		add_action( 'rest_api_init', array( __CLASS__, 'routes' ) );
	}

	/** @return bool */
	public static function allowed() {
		return current_user_can( 'manage_options' );
	}

	/** The routes. */
	public static function routes() {
		$r = array(
			'state'      => array( 'GET', 'state' ),
			'connect'    => array( 'POST', 'connect' ),
			'sync'       => array( 'POST', 'sync' ),
			'health'     => array( 'POST', 'health' ),
			'pause'      => array( 'POST', 'pause' ),
			'adstxt'     => array( 'POST', 'adstxt' ),
			'disconnect' => array( 'POST', 'disconnect' ),
		);
		foreach ( $r as $path => $def ) {
			register_rest_route(
				self::NS,
				'/' . $path,
				array(
					'methods'             => $def[0],
					'callback'            => array( __CLASS__, $def[1] ),
					'permission_callback' => array( __CLASS__, 'allowed' ),
				)
			);
		}
	}

	/**
	 * Everything the dashboard shows. Never the key's secret.
	 *
	 * @return array
	 */
	public static function snapshot_for_app() {
		$c    = VisionForgeX_Store::connection();
		$snap = VisionForgeX_Store::snapshot();
		$set  = VisionForgeX_Store::settings();
		$err  = get_transient( 'visionforgex_connect_error_' . get_current_user_id() );
		if ( false !== $err ) {
			delete_transient( 'visionforgex_connect_error_' . get_current_user_id() );
		}
		$features = array();
		if ( $snap && ! empty( $snap['features'] ) && is_array( $snap['features'] ) ) {
			foreach ( $snap['features'] as $k => $v ) {
				$features[ sanitize_key( $k ) ] = in_array( $v, array( 'off', 'view', 'manage' ), true ) ? $v : 'off';
			}
		}
		$scripts = array();
		foreach ( VisionForgeX_Frontend::scripts() as $s ) {
			$scripts[] = array(
				'src'  => $s['src'],
				'site' => ! empty( $s['site'] ),
			);
		}
		return array(
			'plugin'     => VISIONFORGEX_VERSION,
			'platform'   => untrailingslashit( VISIONFORGEX_PLATFORM ),
			'home'       => home_url( '/' ),
			'domain'     => VisionForgeX_Store::domain( home_url() ),
			'siteName'   => wp_strip_all_tags( get_bloginfo( 'name' ) ),
			'wp'         => get_bloginfo( 'version' ),
			'php'        => PHP_VERSION,
			'staging'    => VisionForgeX_Store::staging_reason(),
			'connected'  => (bool) $c,
			'connection' => $c ? array(
				'siteId'      => $c['siteId'],
				'domain'      => $c['domain'],
				'key'         => substr( $c['keyId'], 0, 8 ) . '…' . substr( $c['keyId'], -4 ),
				'connectedAt' => $c['connectedAt'],
				'by'          => $c['by'],
				'lastSync'    => $c['lastSync'],
				'lost'        => $c['lost'],
				'lastError'   => $c['lastError'],
				'sealed'      => null !== VisionForgeX_Store::secret(),
			) : null,
			'site'       => $snap && isset( $snap['site'] ) ? $snap['site'] : null,
			'account'    => $snap && isset( $snap['account'] ) ? $snap['account'] : null,
			'links'      => $snap && isset( $snap['links'] ) ? $snap['links'] : null,
			'features'   => $features,
			'tag'        => array(
				'scripts' => $scripts,
				'serving' => VisionForgeX_Store::connected() && VisionForgeX_Frontend::scripts() && $snap && ! empty( $snap['site']['approved'] ) && ! empty( $snap['site']['enabled'] ) && ! $set['paused'] && '' === VisionForgeX_Store::staging_reason(),
			),
			'adsTxt'     => array_merge(
				VisionForgeX_Adstxt::status(),
				array(
					'lines' => VisionForgeX_Adstxt::lines(),
					'extra' => (string) $set['adstxtExtra'],
					'other' => '' !== VisionForgeX_Adstxt::other_plugin_lines(),
					'check' => $snap && isset( $snap['adsTxt']['check'] ) ? $snap['adsTxt']['check'] : null,
					'url'   => home_url( '/ads.txt' ),
				)
			),
			'settings'   => array(
				'paused'   => (bool) $set['paused'],
				'pausedAt' => (string) $set['pausedAt'],
			),
			'health'     => VisionForgeX_Health::last(),
			'history'    => array_slice( VisionForgeX_Store::history(), 0, 20 ),
			'error'      => false !== $err ? (string) $err : '',
		);
	}

	/**
	 * @param array $data Extra.
	 * @return WP_REST_Response
	 */
	private static function ok( array $data = array() ) {
		return rest_ensure_response( array_merge( array( 'state' => self::snapshot_for_app() ), $data ) );
	}

	/**
	 * @param string $message Plain words.
	 * @param int    $status  HTTP status.
	 * @return WP_Error
	 */
	private static function fail( $message, $status = 400 ) {
		return new WP_Error( 'visionforgex', $message, array( 'status' => $status ) );
	}

	/** GET state. */
	public static function state() {
		return self::ok();
	}

	/** POST connect: where to send the browser. */
	public static function connect() {
		$r = VisionForgeX_Connect::start();
		return $r['ok'] ? rest_ensure_response( array( 'url' => $r['url'] ) ) : self::fail( $r['message'] );
	}

	/** POST sync. */
	public static function sync() {
		if ( ! VisionForgeX_Store::connected() ) {
			return self::fail( __( 'Connect the site first.', 'visionforgex' ) );
		}
		$r = VisionForgeX_Api::sync();
		return $r['ok'] ? self::ok() : self::fail( (string) $r['message'], 502 );
	}

	/** POST health. */
	public static function health() {
		$h = VisionForgeX_Health::run( true );
		return self::ok( array( 'health' => $h ) );
	}

	/**
	 * POST pause {paused}: works without VisionForgeX.
	 *
	 * @param WP_REST_Request $req Request.
	 */
	public static function pause( $req ) {
		$p = rest_sanitize_boolean( $req->get_param( 'paused' ) );
		VisionForgeX_Store::save_settings(
			array(
				'paused'   => $p,
				'pausedAt' => $p ? gmdate( 'c' ) : '',
			)
		);
		VisionForgeX_Store::log( $p ? __( 'Paused all ads', 'visionforgex' ) : __( 'Turned ads back on', 'visionforgex' ) );
		VisionForgeX_Health::clear_caches();
		return self::ok();
	}

	/**
	 * POST adstxt {mode?: auto|file, extra?: string, write?: bool}.
	 *
	 * @param WP_REST_Request $req Request.
	 */
	public static function adstxt( $req ) {
		$changes = array();
		$mode    = $req->get_param( 'mode' );
		if ( null !== $mode ) {
			if ( ! in_array( $mode, array( 'auto', 'file' ), true ) ) {
				return self::fail( __( 'Unknown ads.txt mode.', 'visionforgex' ) );
			}
			$changes['adstxtMode'] = $mode;
		}
		$extra = $req->get_param( 'extra' );
		if ( null !== $extra ) {
			$clean = array();
			foreach ( explode( "\n", str_replace( "\r", '', (string) $extra ) ) as $l ) {
				$l = trim( wp_strip_all_tags( $l ) );
				if ( strlen( $l ) <= 500 ) {
					$clean[] = $l;
				}
			}
			$changes['adstxtExtra'] = trim( implode( "\n", array_slice( $clean, 0, 2000 ) ) );
		}
		if ( $changes ) {
			VisionForgeX_Store::save_settings( $changes );
			VisionForgeX_Store::log( isset( $changes['adstxtMode'] ) ? ( 'file' === $changes['adstxtMode'] ? __( 'ads.txt: kept in a real file', 'visionforgex' ) : __( 'ads.txt: served by WordPress', 'visionforgex' ) ) : __( 'ads.txt: your own lines changed', 'visionforgex' ) );
		}
		$r = VisionForgeX_Adstxt::apply();
		return self::ok( array( 'result' => $r ) );
	}

	/** POST disconnect. */
	public static function disconnect() {
		$told = VisionForgeX_Connect::disconnect();
		return self::ok( array( 'told' => $told ) );
	}
}
