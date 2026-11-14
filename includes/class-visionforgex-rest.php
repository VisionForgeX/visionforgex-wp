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
			'state'       => array( 'GET', 'state' ),
			'connect'     => array( 'POST', 'connect' ),
			'sync'        => array( 'POST', 'sync' ),
			'health'      => array( 'POST', 'health' ),
			'pause'       => array( 'POST', 'pause' ),
			'adstxt'      => array( 'POST', 'adstxt' ),
			'disconnect'  => array( 'POST', 'disconnect' ),
			'settings'    => array( 'POST', 'settings' ),
			'adtag'       => array( 'POST', 'adtag' ),
			'adtag-del'   => array( 'POST', 'adtag_delete' ),
			'rules'       => array( 'POST', 'rules' ),
			'speed'       => array( 'POST', 'speed' ),
			'speed-clear' => array( 'POST', 'speed_clear' ),
			'other-off'   => array( 'POST', 'other_off' ),
			'other-undo'  => array( 'POST', 'other_undo' ),
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
			'ads'        => $snap && isset( $snap['settings'] ) && is_array( $snap['settings'] ) ? $snap['settings'] : null,
			'where'      => VisionForgeX_Rules::for_app(),
			'speed'      => VisionForgeX_Tools::speed(),
			'others'     => VisionForgeX_Tools::others(),
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

	/**
	 * A signed call that changes something on VisionForgeX, then the new copy of the site.
	 *
	 * @param string $op   settings, adtag or adtag-delete.
	 * @param array  $body What to send.
	 * @return WP_REST_Response|WP_Error
	 */
	private static function platform_change( $op, array $body ) {
		if ( ! VisionForgeX_Store::connected() ) {
			return self::fail( __( 'Connect the site first.', 'visionforgex' ) );
		}
		$u          = wp_get_current_user();
		$body['by'] = $u->display_name;
		$r          = VisionForgeX_Api::call( 'POST', $op, $body );
		if ( ! $r['ok'] ) {
			return self::fail( (string) $r['message'], 422 === $r['status'] || 404 === $r['status'] ? 400 : 502 );
		}
		if ( ! empty( $r['data']['snapshot'] ) && is_array( $r['data']['snapshot'] ) ) {
			VisionForgeX_Api::take_snapshot( $r['data']['snapshot'] );
		}
		return self::ok( array( 'changed' => isset( $r['data']['changed'] ) ? $r['data']['changed'] : array() ) );
	}

	/**
	 * POST settings {changes}: ad settings on VisionForgeX (the platform decides what may change).
	 *
	 * @param WP_REST_Request $req Request.
	 */
	public static function settings( $req ) {
		$changes = $req->get_param( 'changes' );
		$r       = self::platform_change( 'settings', array( 'changes' => is_array( $changes ) ? $changes : array() ) );
		if ( ! is_wp_error( $r ) ) {
			$d = $r->get_data();
			if ( ! empty( $d['changed'] ) ) {
				/* translators: %s: what changed, in plain words */
				VisionForgeX_Store::log( sprintf( __( 'Ad settings: %s', 'visionforgex' ), implode( ', ', (array) $d['changed'] ) ) );
				$r = self::ok( array( 'changed' => $d['changed'] ) );
			}
		}
		return $r;
	}

	/**
	 * POST adtag {name, format, sizes}.
	 *
	 * @param WP_REST_Request $req Request.
	 */
	public static function adtag( $req ) {
		$r = self::platform_change(
			'adtag',
			array(
				'name'   => sanitize_text_field( (string) $req->get_param( 'name' ) ),
				'format' => 'native' === $req->get_param( 'format' ) ? 'native' : 'banner',
				'sizes'  => array_map( 'sanitize_text_field', (array) $req->get_param( 'sizes' ) ),
			)
		);
		if ( ! is_wp_error( $r ) ) {
			/* translators: %s: an Ad Tag's name */
			VisionForgeX_Store::log( sprintf( __( 'Ad Tag added: %s', 'visionforgex' ), sanitize_text_field( (string) $req->get_param( 'name' ) ) ) );
			$r = self::ok();
		}
		return $r;
	}

	/**
	 * POST adtag-del {id}.
	 *
	 * @param WP_REST_Request $req Request.
	 */
	public static function adtag_delete( $req ) {
		$id = sanitize_text_field( (string) $req->get_param( 'id' ) );
		$r  = self::platform_change( 'adtag-delete', array( 'id' => $id ) );
		if ( ! is_wp_error( $r ) ) {
			/* translators: %s: an Ad Tag's id */
			VisionForgeX_Store::log( sprintf( __( 'Ad Tag removed: %s', 'visionforgex' ), $id ) );
			$r = self::ok();
		}
		return $r;
	}

	/**
	 * POST rules {rules}: where ads show (kept in WordPress).
	 *
	 * @param WP_REST_Request $req Request.
	 */
	public static function rules( $req ) {
		$in = $req->get_param( 'rules' );
		VisionForgeX_Rules::save( is_array( $in ) ? $in : array() );
		VisionForgeX_Store::log( VisionForgeX_Rules::get()['on'] ? __( 'Where ads show: rules saved (on)', 'visionforgex' ) : __( 'Where ads show: rules off', 'visionforgex' ) );
		VisionForgeX_Health::clear_caches();
		return self::ok();
	}

	/**
	 * POST speed {key, on}: keep the tag out of a speed plugin's lists, or stop (the undo).
	 *
	 * @param WP_REST_Request $req Request.
	 */
	public static function speed( $req ) {
		$key = sanitize_key( (string) $req->get_param( 'key' ) );
		$ok  = false;
		foreach ( VisionForgeX_Tools::speed_catalog() as $info ) {
			$ok = $ok || $info[0] === $key;
		}
		if ( ! $ok ) {
			return self::fail( __( 'Unknown plugin.', 'visionforgex' ) );
		}
		$on = rest_sanitize_boolean( $req->get_param( 'on' ) );
		VisionForgeX_Tools::set_excluded( $key, $on );
		/* translators: %s: a plugin key */
		VisionForgeX_Store::log( sprintf( $on ? __( 'Tag kept out of %s again', 'visionforgex' ) : __( 'Tag no longer kept out of %s', 'visionforgex' ), $key ) );
		VisionForgeX_Tools::clear( $key );
		return self::ok();
	}

	/**
	 * POST speed-clear {key}.
	 *
	 * @param WP_REST_Request $req Request.
	 */
	public static function speed_clear( $req ) {
		$ok = VisionForgeX_Tools::clear( sanitize_key( (string) $req->get_param( 'key' ) ) );
		return $ok ? self::ok() : self::fail( __( 'That plugin\'s cache could not be cleared from here.', 'visionforgex' ) );
	}

	/**
	 * POST other-off {key}.
	 *
	 * @param WP_REST_Request $req Request.
	 */
	public static function other_off( $req ) {
		$r = VisionForgeX_Tools::switch_off( sanitize_key( (string) $req->get_param( 'key' ) ) );
		return $r['ok'] ? self::ok( array( 'message' => $r['message'] ) ) : self::fail( $r['message'] );
	}

	/**
	 * POST other-undo {key}.
	 *
	 * @param WP_REST_Request $req Request.
	 */
	public static function other_undo( $req ) {
		$r = VisionForgeX_Tools::undo( sanitize_key( (string) $req->get_param( 'key' ) ) );
		return $r['ok'] ? self::ok( array( 'message' => $r['message'] ) ) : self::fail( $r['message'] );
	}
}
