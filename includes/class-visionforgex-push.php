<?php
/**
 * Instant sync from VisionForgeX: when the site's settings change on visionforgex.com (or support asks the site to run
 * its check, or clear its cache), VisionForgeX sends a signed POST to this site's ?rest_route=/visionforgex/v1/push.
 *
 * It is signed the same way as the plugin's own calls, with the site's own key (only VisionForgeX and this site know it):
 * X-VFX-Key, X-VFX-Time (within five minutes), X-VFX-Nonce (used once) and X-VFX-Signature over
 * "POST\nPATH?QUERY\nTIME\nNONCE\nsha256(body)". Anything else is refused and nothing changes.
 *
 * What it does: keeps the new copy of the site's settings (which puts new ads.txt lines in place and clears the page
 * cache when the tag changed), clears the page cache when asked, and runs the site check in the background when asked.
 *
 * @package VisionForgeX
 */

defined( 'ABSPATH' ) || exit;

/**
 * Push.
 */
class VisionForgeX_Push {

	const NONCES = 'visionforgex_push_nonces';
	const SKEW   = 300;

	/** Hooks. */
	public static function init() {
		add_action( 'rest_api_init', array( __CLASS__, 'route' ) );
		add_action( 'visionforgex_check_now', array( __CLASS__, 'check_now' ) );
	}

	/** The route: open to VisionForgeX, checked by its signature. */
	public static function route() {
		register_rest_route(
			'visionforgex/v1',
			'/push',
			array(
				'methods'             => 'POST',
				'callback'            => array( __CLASS__, 'receive' ),
				'permission_callback' => '__return_true', // The signature below is the check: only VisionForgeX holds this site's key.
			)
		);
	}

	/**
	 * Checks a push. Returns '' when it is genuine, or why not.
	 *
	 * @param array  $h      Headers: key, time, nonce, signature.
	 * @param string $path   The request's path and query.
	 * @param string $body   Raw body.
	 * @param int    $now    Now.
	 * @return string
	 */
	public static function verify( array $h, $path, $body, $now ) {
		$c      = VisionForgeX_Store::connection();
		$secret = VisionForgeX_Store::secret();
		if ( ! $c || null === $secret ) {
			return 'not_connected';
		}
		if ( '' === $h['key'] || '' === $h['signature'] || '' === $h['nonce'] || '' === $h['time'] ) {
			return 'unsigned';
		}
		if ( ! hash_equals( (string) $c['keyId'], $h['key'] ) ) {
			return 'unknown_key';
		}
		if ( ! ctype_digit( $h['time'] ) || abs( $now - (int) $h['time'] ) > self::SKEW ) {
			return 'clock';
		}
		if ( ! preg_match( '/^[A-Za-z0-9_-]{16,64}$/', $h['nonce'] ) ) {
			return 'unsigned';
		}
		$want = hash_hmac( 'sha256', VisionForgeX_Api::string_to_sign( 'POST', $path, $h['time'], $h['nonce'], $body ), $secret );
		if ( ! hash_equals( $want, strtolower( $h['signature'] ) ) ) {
			return 'bad_signature';
		}
		$seen = get_option( self::NONCES, array() );
		$seen = is_array( $seen ) ? $seen : array();
		if ( isset( $seen[ $h['nonce'] ] ) ) {
			return 'replay';
		}
		foreach ( $seen as $n => $t ) {
			if ( $t < $now - 2 * self::SKEW ) {
				unset( $seen[ $n ] );
			}
		}
		$seen[ $h['nonce'] ] = $now;
		update_option( self::NONCES, array_slice( $seen, -200, null, true ), false );
		return '';
	}

	/**
	 * POST push.
	 *
	 * @param WP_REST_Request $req Request.
	 * @return WP_REST_Response
	 */
	public static function receive( $req ) {
		$path = isset( $_SERVER['REQUEST_URI'] ) ? (string) wp_unslash( $_SERVER['REQUEST_URI'] ) : ''; // phpcs:ignore WordPress.Security.ValidatedSanitizedInput.InputNotSanitized -- compared byte for byte in the signature, never printed.
		$h    = array(
			'key'       => (string) $req->get_header( 'x_vfx_key' ),
			'time'      => (string) $req->get_header( 'x_vfx_time' ),
			'nonce'     => (string) $req->get_header( 'x_vfx_nonce' ),
			'signature' => (string) $req->get_header( 'x_vfx_signature' ),
		);
		$body = (string) $req->get_body();
		$why  = self::verify( $h, $path, $body, time() );
		if ( '' !== $why ) {
			return new WP_REST_Response(
				array(
					'ok'      => false,
					'message' => $why,
				),
				'not_connected' === $why ? 409 : 401
			);
		}
		$j    = json_decode( $body, true );
		$acts = is_array( $j ) && isset( $j['actions'] ) ? array_intersect( (array) $j['actions'], array( 'sync', 'health', 'clear' ) ) : array();
		$done = array();
		if ( in_array( 'sync', $acts, true ) && ! empty( $j['snapshot'] ) && is_array( $j['snapshot'] ) ) {
			VisionForgeX_Api::take_snapshot( $j['snapshot'] );
			$done[] = 'sync';
		}
		if ( in_array( 'clear', $acts, true ) ) {
			VisionForgeX_Health::clear_caches();
			$done[] = 'clear';
		}
		if ( in_array( 'health', $acts, true ) ) {
			if ( ! wp_next_scheduled( 'visionforgex_check_now' ) ) {
				wp_schedule_single_event( time(), 'visionforgex_check_now' );
			}
			$done[] = 'health';
		}
		if ( $done ) {
			/* translators: %s: what VisionForgeX asked for */
			VisionForgeX_Store::log( sprintf( __( 'From VisionForgeX: %s', 'visionforgex' ), implode( ', ', $done ) ) );
		}
		return new WP_REST_Response(
			array(
				'ok'   => true,
				'done' => $done,
			),
			200
		);
	}

	/** The site check asked for by VisionForgeX, in the background. */
	public static function check_now() {
		if ( VisionForgeX_Store::connected() && '' === VisionForgeX_Store::staging_reason() ) {
			VisionForgeX_Health::run( true );
		}
	}
}
