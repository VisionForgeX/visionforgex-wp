<?php
/**
 * Connect with VisionForgeX: one button, no key to copy, no password typed into WordPress.
 *
 * 1. The publisher clicks Connect. The plugin keeps a random verifier for ten minutes and sends the browser to
 *    VisionForgeX's connect page with this site's address, a state and the verifier's SHA-256 (the "challenge").
 * 2. They sign in (or sign up) there and allow this site.
 * 3. VisionForgeX sends them back here with a one-time code. The plugin trades code + verifier for the site's own
 *    connector key; a code stolen on the way is useless without the verifier, which never left this server.
 *
 * @package VisionForgeX
 */

defined( 'ABSPATH' ) || exit;

/**
 * The connect flow.
 */
class VisionForgeX_Connect {

	const TTL = 900;

	/** Hooks. */
	public static function init() {
		add_action( 'admin_init', array( __CLASS__, 'handle_return' ) );
	}

	/** @return string Where VisionForgeX sends the publisher back to. */
	public static function return_url() {
		return admin_url( 'admin.php?page=visionforgex' );
	}

	/**
	 * Starts connecting: the address of VisionForgeX's connect page.
	 *
	 * @return array ['ok', 'url', 'message']
	 */
	public static function start() {
		$why = VisionForgeX_Store::staging_reason();
		if ( '' !== $why && ! VisionForgeX_Store::connected() ) {
			return array(
				'ok'      => false,
				'url'     => '',
				'message' => $why . ' ' . __( 'Install the plugin on the live site and connect from there.', 'visionforgex' ),
			);
		}
		$home  = home_url( '/' );
		$admin = self::return_url();
		if ( strtolower( (string) wp_parse_url( $home, PHP_URL_HOST ) ) !== strtolower( (string) wp_parse_url( $admin, PHP_URL_HOST ) ) ) {
			return array(
				'ok'      => false,
				'url'     => '',
				'message' => __( 'Your WordPress dashboard runs on a different address from your site, so VisionForgeX cannot send you back here. Write to support@visionforgex.com and we will connect it with you.', 'visionforgex' ),
			);
		}
		$verifier = VisionForgeX_Api::random( 48 );
		$state    = VisionForgeX_Api::random( 24 );
		set_transient(
			'visionforgex_connect_' . $state,
			array(
				'verifier' => $verifier,
				'user'     => get_current_user_id(),
			),
			self::TTL
		);
		$challenge = rtrim( strtr( base64_encode( hash( 'sha256', $verifier, true ) ), '+/', '-_' ), '=' ); // phpcs:ignore WordPress.PHP.DiscouragedPHPFunctions.obfuscation_base64_encode
		$url       = add_query_arg(
			array(
				'site'      => rawurlencode( $home ),
				'return'    => rawurlencode( $admin ),
				'state'     => $state,
				'challenge' => $challenge,
				'name'      => rawurlencode( wp_strip_all_tags( get_bloginfo( 'name' ) ) ),
				'wp'        => rawurlencode( get_bloginfo( 'version' ) ),
				'plugin'    => rawurlencode( VISIONFORGEX_VERSION ),
				'php'       => rawurlencode( PHP_VERSION ),
			),
			untrailingslashit( VISIONFORGEX_PLATFORM ) . '/publisher/connect'
		);
		return array(
			'ok'      => true,
			'url'     => $url,
			'message' => '',
		);
	}

	/** Back from VisionForgeX: ?page=visionforgex&vfx_code=…&state=… (or &vfx_error=denied). */
	public static function handle_return() {
		// phpcs:disable WordPress.Security.NonceVerification.Recommended -- the state, bound to this user and kept ten minutes, is the check.
		if ( ! isset( $_GET['page'] ) || 'visionforgex' !== $_GET['page'] || ! isset( $_GET['state'] ) ) {
			return;
		}
		if ( ! isset( $_GET['vfx_code'] ) && ! isset( $_GET['vfx_error'] ) ) {
			return;
		}
		if ( ! current_user_can( 'manage_options' ) ) {
			return;
		}
		$state = sanitize_text_field( wp_unslash( $_GET['state'] ) );
		$code  = isset( $_GET['vfx_code'] ) ? sanitize_text_field( wp_unslash( $_GET['vfx_code'] ) ) : '';
		$error = isset( $_GET['vfx_error'] ) ? sanitize_key( wp_unslash( $_GET['vfx_error'] ) ) : '';
		// phpcs:enable
		$key  = 'visionforgex_connect_' . preg_replace( '/[^A-Za-z0-9_-]/', '', $state );
		$kept = get_transient( $key );
		delete_transient( $key );
		$back = self::return_url();

		if ( ! is_array( $kept ) || get_current_user_id() !== (int) $kept['user'] ) {
			self::done( $back, 'stale' );
		}
		if ( '' !== $error ) {
			self::done( $back, 'denied' === $error ? 'denied' : 'failed' );
		}
		$r = VisionForgeX_Api::exchange( $code, (string) $kept['verifier'] );
		if ( ! $r['ok'] || empty( $r['data']['site']['id'] ) || empty( $r['data']['key']['secret'] ) ) {
			set_transient( 'visionforgex_connect_error_' . get_current_user_id(), (string) $r['message'], 120 );
			self::done( $back, 'failed' );
		}
		$u = wp_get_current_user();
		VisionForgeX_Store::save_connection( $r['data']['site'], $r['data']['key'], $u->display_name );
		if ( ! empty( $r['data']['snapshot'] ) && is_array( $r['data']['snapshot'] ) ) {
			VisionForgeX_Api::take_snapshot( $r['data']['snapshot'] );
		}
		VisionForgeX_Adstxt::apply();
		/* translators: %s: the site's domain */
		VisionForgeX_Store::log( sprintf( __( 'Connected to VisionForgeX as %s', 'visionforgex' ), $r['data']['site']['domain'] ) );
		self::done( $back, 'connected' );
	}

	/**
	 * Back to the dashboard, without the code in the address bar.
	 *
	 * @param string $back   Dashboard address.
	 * @param string $result connected, denied, failed or stale.
	 */
	private static function done( $back, $result ) {
		wp_safe_redirect( add_query_arg( 'vfx', $result, $back ) );
		exit;
	}

	/**
	 * Disconnects: tells VisionForgeX (when it can be reached), then forgets the key here. The tag stops and the
	 * ads.txt lines the plugin added are taken out.
	 *
	 * @return bool VisionForgeX was told.
	 */
	public static function disconnect() {
		$told = VisionForgeX_Store::connected() ? VisionForgeX_Api::call( 'POST', 'disconnect', array() ) : array( 'ok' => false );
		VisionForgeX_Adstxt::remove_from_file();
		VisionForgeX_Store::forget_connection();
		VisionForgeX_Store::log( __( 'Disconnected from VisionForgeX', 'visionforgex' ) );
		VisionForgeX_Health::clear_caches();
		return ! empty( $told['ok'] );
	}
}
