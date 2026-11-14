<?php
/**
 * Talking to VisionForgeX. Every call after connecting is signed with the site's connector key:
 *
 *   X-VFX-Key        the key's id
 *   X-VFX-Time       Unix time (VisionForgeX refuses a call more than 5 minutes off)
 *   X-VFX-Nonce      random, used once
 *   X-VFX-Signature  hex HMAC-SHA256 of "METHOD\nPATH?QUERY\nTIME\nNONCE\nsha256(body)" with the key's secret
 *
 * Nothing here runs while a visitor's page loads.
 *
 * @package VisionForgeX
 */

defined( 'ABSPATH' ) || exit;

/**
 * The client.
 */
class VisionForgeX_Api {

	/**
	 * The platform's address for a call.
	 *
	 * @param string $op Call name.
	 * @return string
	 */
	public static function url( $op ) {
		return untrailingslashit( VISIONFORGEX_PLATFORM ) . '/api/v1/wordpress/?op=' . rawurlencode( $op );
	}

	/**
	 * The string a call signs (VisionForgeX checks the same string).
	 *
	 * @param string $method GET or POST.
	 * @param string $path   Path and query, as the request line carries them.
	 * @param string $time   Unix time.
	 * @param string $nonce  Random.
	 * @param string $body   Raw body.
	 * @return string
	 */
	public static function string_to_sign( $method, $path, $time, $nonce, $body ) {
		return strtoupper( $method ) . "\n" . $path . "\n" . $time . "\n" . $nonce . "\n" . hash( 'sha256', $body );
	}

	/**
	 * A random URL-safe string.
	 *
	 * @param int $bytes How many random bytes.
	 * @return string
	 */
	public static function random( $bytes ) {
		return rtrim( strtr( base64_encode( random_bytes( $bytes ) ), '+/', '-_' ), '=' ); // phpcs:ignore WordPress.PHP.DiscouragedPHPFunctions.obfuscation_base64_encode
	}

	/**
	 * Trades the one-time code from the connect page for the site's key. Not signed: the verifier proves it.
	 *
	 * @param string $code     From VisionForgeX.
	 * @param string $verifier Kept by this site since the publisher clicked Connect.
	 * @return array ['ok', 'status', 'data', 'code', 'message']
	 */
	public static function exchange( $code, $verifier ) {
		return self::send(
			'POST',
			'exchange',
			array(
				'code'     => $code,
				'verifier' => $verifier,
				'home'     => home_url( '/' ),
			),
			false
		);
	}

	/**
	 * A signed call.
	 *
	 * @param string     $method GET or POST.
	 * @param string     $op     site, health or disconnect.
	 * @param array|null $body   JSON body for POST.
	 * @return array ['ok', 'status', 'data', 'code', 'message']
	 */
	public static function call( $method, $op, $body = null ) {
		return self::send( $method, $op, $body, true );
	}

	/**
	 * @param string     $method GET or POST.
	 * @param string     $op     Call name.
	 * @param array|null $body   Body.
	 * @param bool       $sign   Sign with the connector key.
	 * @return array
	 */
	private static function send( $method, $op, $body, $sign ) {
		$url     = self::url( $op );
		$raw     = null === $body ? '' : wp_json_encode( $body );
		$headers = array(
			'Accept'     => 'application/json',
			'User-Agent' => 'VisionForgeX-WordPress/' . VISIONFORGEX_VERSION . '; ' . home_url( '/' ),
		);
		if ( '' !== $raw ) {
			$headers['Content-Type'] = 'application/json';
		}
		if ( $sign ) {
			$c      = VisionForgeX_Store::connection();
			$secret = VisionForgeX_Store::secret();
			if ( ! $c || null === $secret ) {
				return self::result( false, 0, null, 'not_connected', __( 'This site is not connected to VisionForgeX.', 'visionforgex' ) );
			}
			$parts = wp_parse_url( $url );
			$path  = ( isset( $parts['path'] ) ? $parts['path'] : '/' ) . ( isset( $parts['query'] ) ? '?' . $parts['query'] : '' );
			$time  = (string) time();
			$nonce = self::random( 18 );

			$headers['X-VFX-Key']       = $c['keyId'];
			$headers['X-VFX-Time']      = $time;
			$headers['X-VFX-Nonce']     = $nonce;
			$headers['X-VFX-Signature'] = hash_hmac( 'sha256', self::string_to_sign( $method, $path, $time, $nonce, $raw ), $secret );
		}
		$res = wp_remote_request(
			$url,
			array(
				'method'      => $method,
				'timeout'     => 20,
				'redirection' => 0,
				'headers'     => $headers,
				'body'        => '' === $raw ? null : $raw,
			)
		);
		if ( is_wp_error( $res ) ) {
			$out = self::result( false, 0, null, 'unreachable', __( 'VisionForgeX could not be reached. Nothing has changed on your site.', 'visionforgex' ) );
		} else {
			$status = (int) wp_remote_retrieve_response_code( $res );
			$json   = json_decode( (string) wp_remote_retrieve_body( $res ), true );
			if ( $status >= 200 && $status < 300 && is_array( $json ) && array_key_exists( 'data', $json ) ) {
				$out = self::result( true, $status, $json['data'], null, null );
			} elseif ( is_array( $json ) && isset( $json['error']['code'] ) ) {
				$out = self::result( false, $status, null, (string) $json['error']['code'], (string) ( isset( $json['error']['message'] ) ? $json['error']['message'] : '' ) );
			} else {
				/* translators: %d: HTTP status */
				$out = self::result( false, $status, null, 'bad_answer', sprintf( __( 'VisionForgeX gave an answer the plugin did not understand (HTTP %d). Nothing has changed on your site.', 'visionforgex' ), $status ) );
			}
		}
		if ( $sign ) {
			if ( $out['ok'] ) {
				VisionForgeX_Store::touch_connection(
					array(
						'lost'      => '',
						'lastError' => '',
					)
				);
			} elseif ( 'unknown_key' === $out['code'] ) {
				// VisionForgeX no longer knows this key (disconnected there): say so, keep serving from the last copy.
				VisionForgeX_Store::touch_connection(
					array(
						'lost'      => gmdate( 'c' ),
						'lastError' => $out['message'],
					)
				);
			} else {
				VisionForgeX_Store::touch_connection( array( 'lastError' => (string) $out['message'] ) );
			}
		}
		return $out;
	}

	/**
	 * @param bool        $ok      Worked.
	 * @param int         $status  HTTP status.
	 * @param mixed       $data    The answer.
	 * @param string|null $code    Error code.
	 * @param string|null $message Error in plain words.
	 * @return array
	 */
	private static function result( $ok, $status, $data, $code, $message ) {
		return array(
			'ok'      => $ok,
			'status'  => $status,
			'data'    => $data,
			'code'    => $code,
			'message' => $message,
		);
	}

	/**
	 * Fetches the site's settings from VisionForgeX and keeps the copy. Writes the ads.txt file again if its lines changed.
	 *
	 * @return array The call's result.
	 */
	public static function sync() {
		$r = self::call( 'GET', 'site' );
		if ( $r['ok'] && is_array( $r['data'] ) ) {
			self::take_snapshot( $r['data'] );
		}
		return $r;
	}

	/**
	 * Keeps a snapshot from VisionForgeX and acts on it.
	 *
	 * @param array $snapshot From the platform.
	 */
	public static function take_snapshot( array $snapshot ) {
		$before = VisionForgeX_Store::snapshot();
		VisionForgeX_Store::save_snapshot( $snapshot );
		VisionForgeX_Store::touch_connection( array( 'lastSync' => gmdate( 'c' ) ) );
		$old = $before && isset( $before['adsTxt']['lines'] ) ? (array) $before['adsTxt']['lines'] : array();
		$new = isset( $snapshot['adsTxt']['lines'] ) ? (array) $snapshot['adsTxt']['lines'] : array();
		if ( $old !== $new ) {
			VisionForgeX_Adstxt::apply();
		}
		if ( ! $before || wp_json_encode( isset( $before['tag'] ) ? $before['tag'] : null ) !== wp_json_encode( isset( $snapshot['tag'] ) ? $snapshot['tag'] : null ) ) {
			VisionForgeX_Health::clear_caches();
		}
	}
}
