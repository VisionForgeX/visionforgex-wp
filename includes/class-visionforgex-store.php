<?php
/**
 * What the plugin keeps in WordPress's own database: the connection (its key sealed with this site's salts), the last
 * copy of the site's settings from VisionForgeX, the local switches (Pause all ads), the last site check and a short
 * history of changes. Nothing here is fetched while a visitor's page loads.
 *
 * @package VisionForgeX
 */

defined( 'ABSPATH' ) || exit;

/**
 * Options and their shapes.
 */
class VisionForgeX_Store {

	const CONNECTION  = 'visionforgex_connection'; // Not autoloaded: only the admin and background jobs need it.
	const SNAPSHOT    = 'visionforgex_snapshot';   // Autoloaded: the front end prints the tag from it.
	const SETTINGS    = 'visionforgex_settings';   // Autoloaded: Pause all ads, ads.txt mode.
	const HEALTH      = 'visionforgex_health';
	const HISTORY     = 'visionforgex_history';
	const HISTORY_MAX = 60;

	/**
	 * Every option the plugin owns, for uninstalling.
	 *
	 * @return string[]
	 */
	public static function all_options() {
		return array( self::CONNECTION, self::SNAPSHOT, self::SETTINGS, self::HEALTH, self::HISTORY, 'visionforgex_adstxt_written', 'visionforgex_rules', 'visionforgex_speed', 'visionforgex_finder', 'visionforgex_incontent', 'visionforgex_spots', 'visionforgex_staging_hosts', 'visionforgex_push_nonces' );
	}

	/**
	 * Plugin activated: the background jobs. Nothing is sent anywhere until the publisher clicks Connect.
	 *
	 * @param bool $network_wide Activated for a whole network.
	 */
	public static function activate( $network_wide = false ) {
		if ( $network_wide && is_multisite() ) {
			// Activated for the whole network: every site gets its jobs (new sites get them as they are made: VisionForgeX_Network).
			foreach ( get_sites(
				array(
					'number' => 1000,
					'fields' => 'ids',
				)
			) as $id ) {
				switch_to_blog( (int) $id );
				self::activate( false );
				restore_current_blog();
			}
			return;
		}
		if ( ! wp_next_scheduled( 'visionforgex_sync' ) ) {
			wp_schedule_event( time() + 600, 'twicedaily', 'visionforgex_sync' );
		}
		if ( ! wp_next_scheduled( 'visionforgex_daily' ) ) {
			wp_schedule_event( time() + 1800, 'daily', 'visionforgex_daily' );
		}
		add_option( self::SETTINGS, self::default_settings() );
	}

	/**
	 * Plugin deactivated: the jobs stop. The tag and the served ads.txt stop with the plugin by themselves.
	 *
	 * @param bool $network_wide Deactivated for a whole network.
	 */
	public static function deactivate( $network_wide = false ) {
		if ( $network_wide && is_multisite() ) {
			foreach ( get_sites(
				array(
					'number' => 1000,
					'fields' => 'ids',
				)
			) as $id ) {
				switch_to_blog( (int) $id );
				self::deactivate( false );
				restore_current_blog();
			}
			return;
		}
		wp_clear_scheduled_hook( 'visionforgex_sync' );
		wp_clear_scheduled_hook( 'visionforgex_daily' );
	}

	/**
	 * The local switches.
	 *
	 * @return array
	 */
	public static function default_settings() {
		return array(
			'paused'      => false, // Pause all ads: works even when VisionForgeX cannot be reached.
			'pausedAt'    => '',
			'adstxtMode'  => 'auto', // auto: served by WordPress when there is no file; file: merged into the real file.
			'adstxtExtra' => '',     // The publisher's own ads.txt lines (other partners), kept next to ours.
		);
	}

	/** @return array */
	public static function settings() {
		$s = get_option( self::SETTINGS, array() );
		return array_merge( self::default_settings(), is_array( $s ) ? $s : array() );
	}

	/**
	 * @param array $changes Keys of default_settings().
	 * @return array The settings after the change.
	 */
	public static function save_settings( array $changes ) {
		$s = array_merge( self::settings(), array_intersect_key( $changes, self::default_settings() ) );
		update_option( self::SETTINGS, $s, true );
		return $s;
	}

	/* ---------------------------------------------------------------- connection */

	/**
	 * The connection without its secret, or null.
	 *
	 * @return array|null
	 */
	public static function connection() {
		$c = get_option( self::CONNECTION );
		if ( ! is_array( $c ) || empty( $c['siteId'] ) || empty( $c['keyId'] ) ) {
			return null;
		}
		unset( $c['secret'] );
		return $c;
	}

	/** @return bool */
	public static function connected() {
		return null !== self::connection();
	}

	/**
	 * Saves a new connection.
	 *
	 * @param array  $site   ['id', 'domain'] from VisionForgeX.
	 * @param array  $key    ['id', 'secret'].
	 * @param string $by     Who connected it (the WordPress user).
	 */
	public static function save_connection( array $site, array $key, $by ) {
		update_option(
			self::CONNECTION,
			array(
				'siteId'      => (string) $site['id'],
				'domain'      => (string) $site['domain'],
				'keyId'       => (string) $key['id'],
				'secret'      => self::seal( (string) $key['secret'] ),
				'connectedAt' => gmdate( 'c' ),
				'by'          => (string) $by,
				'home'        => home_url( '/' ),
				'lost'        => '',
				'lastSync'    => '',
				'lastError'   => '',
			),
			false
		);
	}

	/**
	 * Changes fields of the connection (not its key).
	 *
	 * @param array $changes Fields.
	 */
	public static function touch_connection( array $changes ) {
		$c = get_option( self::CONNECTION );
		if ( ! is_array( $c ) ) {
			return;
		}
		unset( $changes['secret'], $changes['keyId'], $changes['siteId'] );
		update_option( self::CONNECTION, array_merge( $c, $changes ), false );
	}

	/** @return string|null The connector key's secret. */
	public static function secret() {
		$c = get_option( self::CONNECTION );
		return is_array( $c ) && ! empty( $c['secret'] ) ? self::unseal( (string) $c['secret'] ) : null;
	}

	/** Forgets the connection and the copy of the site's settings. */
	public static function forget_connection() {
		delete_option( self::CONNECTION );
		delete_option( self::SNAPSHOT );
		delete_option( self::HEALTH );
	}

	/* ---------------------------------------------------------------- snapshot */

	/** @return array|null What VisionForgeX last said about this site. */
	public static function snapshot() {
		$s = get_option( self::SNAPSHOT );
		return is_array( $s ) ? $s : null;
	}

	/** @param array $snapshot From the platform. */
	public static function save_snapshot( array $snapshot ) {
		update_option( self::SNAPSHOT, $snapshot, true );
	}

	/* ---------------------------------------------------------------- history */

	/**
	 * Notes a change made from WordPress.
	 *
	 * @param string $what Plain words.
	 */
	public static function log( $what ) {
		$h   = get_option( self::HISTORY, array() );
		$h   = is_array( $h ) ? $h : array();
		$u   = wp_get_current_user();
		$h[] = array(
			'at'   => gmdate( 'c' ),
			'what' => (string) $what,
			'by'   => $u && $u->exists() ? $u->display_name : __( 'WordPress', 'visionforgex' ),
		);
		update_option( self::HISTORY, array_slice( $h, -self::HISTORY_MAX ), false );
	}

	/** @return array Newest first. */
	public static function history() {
		$h = get_option( self::HISTORY, array() );
		return is_array( $h ) ? array_reverse( $h ) : array();
	}

	/* ---------------------------------------------------------------- sealing */

	/** @return string 32 bytes from this site's own salts. */
	private static function seal_key() {
		return hash( 'sha256', wp_salt( 'auth' ) . '|visionforgex-connector', true );
	}

	/**
	 * Seals the connector secret with this site's salts, so a copy of the database alone does not carry it.
	 *
	 * @param string $plain Secret.
	 * @return string
	 */
	public static function seal( $plain ) {
		if ( function_exists( 'sodium_crypto_secretbox' ) ) {
			$nonce = random_bytes( SODIUM_CRYPTO_SECRETBOX_NONCEBYTES );
			return 's1:' . base64_encode( $nonce . sodium_crypto_secretbox( $plain, $nonce, self::seal_key() ) ); // phpcs:ignore WordPress.PHP.DiscouragedPHPFunctions.obfuscation_base64_encode
		}
		return 'p0:' . base64_encode( $plain ); // phpcs:ignore WordPress.PHP.DiscouragedPHPFunctions.obfuscation_base64_encode
	}

	/**
	 * @param string $sealed From seal().
	 * @return string|null Null when it cannot be read (the salts changed): connect again.
	 */
	public static function unseal( $sealed ) {
		$raw = base64_decode( substr( $sealed, 3 ), true ); // phpcs:ignore WordPress.PHP.DiscouragedPHPFunctions.obfuscation_base64_decode
		if ( false === $raw ) {
			return null;
		}
		if ( 0 === strpos( $sealed, 'p0:' ) ) {
			return $raw;
		}
		if ( 0 !== strpos( $sealed, 's1:' ) || ! function_exists( 'sodium_crypto_secretbox_open' ) || strlen( $raw ) <= SODIUM_CRYPTO_SECRETBOX_NONCEBYTES ) {
			return null;
		}
		$plain = sodium_crypto_secretbox_open( substr( $raw, SODIUM_CRYPTO_SECRETBOX_NONCEBYTES ), substr( $raw, 0, SODIUM_CRYPTO_SECRETBOX_NONCEBYTES ), self::seal_key() );
		return false === $plain ? null : $plain;
	}

	/* ---------------------------------------------------------------- where this copy runs */

	/**
	 * Why this copy of the site must not serve or change anything, or '' when it may. A staging or local copy (or a
	 * copy of the database moved to another address) keeps its settings but stays quiet.
	 *
	 * @return string
	 */
	public static function staging_reason() {
		$host = strtolower( (string) wp_parse_url( home_url(), PHP_URL_HOST ) );
		if ( '' === $host ) {
			return __( 'This site has no address.', 'visionforgex' );
		}
		$env = function_exists( 'wp_get_environment_type' ) ? wp_get_environment_type() : 'production';
		if ( in_array( $env, array( 'local', 'development', 'staging' ), true ) ) {
			/* translators: %s: local, development or staging */
			return sprintf( __( 'WordPress says this is a %s site.', 'visionforgex' ), $env );
		}
		if ( self::looks_like_staging( $host ) ) {
			/* translators: %s: the site's host name */
			return sprintf( __( '%s looks like a staging or local copy.', 'visionforgex' ), $host );
		}
		foreach ( self::staging_hosts() as $h ) {
			if ( $host === $h || ( 0 === strpos( $h, '*.' ) && substr( $host, -strlen( $h ) + 1 ) === substr( $h, 1 ) ) ) {
				/* translators: %s: the site's host name */
				return sprintf( __( '%s is on your list of staging addresses.', 'visionforgex' ), $host );
			}
		}
		$c = self::connection();
		if ( $c && self::domain( home_url() ) !== $c['domain'] ) {
			/* translators: 1: this copy's address, 2: the connected site's domain */
			return sprintf( __( 'This copy runs at %1$s, but the connected site is %2$s.', 'visionforgex' ), self::domain( home_url() ), $c['domain'] );
		}
		return '';
	}

	/** @return string[] The publisher's own staging addresses (Settings): host names, or *.example.com. */
	public static function staging_hosts() {
		$h = get_option( 'visionforgex_staging_hosts', array() );
		return is_array( $h ) ? $h : array();
	}

	/**
	 * Saves the staging addresses, cleaned.
	 *
	 * @param array $in Host names (or addresses).
	 * @return string[]
	 */
	public static function save_staging_hosts( array $in ) {
		$out = array();
		foreach ( $in as $h ) {
			$h = strtolower( trim( (string) $h ) );
			if ( preg_match( '#^https?://#', $h ) ) {
				$h = (string) wp_parse_url( $h, PHP_URL_HOST );
			}
			if ( preg_match( '/^(\*\.)?[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/', $h ) && strlen( $h ) <= 200 ) {
				$out[] = $h;
			}
		}
		$out = array_values( array_unique( array_slice( $out, 0, 50 ) ) );
		update_option( 'visionforgex_staging_hosts', $out, true );
		return $out;
	}

	/**
	 * The plugin's switches on VisionForgeX for the tag (consent, signals, qa), from the last copy of the site.
	 *
	 * @return array
	 */
	public static function wp_flags() {
		$s = self::snapshot();
		$w = $s && isset( $s['settings']['wordpress'] ) && is_array( $s['settings']['wordpress'] ) ? $s['settings']['wordpress'] : array();
		return array(
			'consent' => ! empty( $w['consent'] ),
			'signals' => ! empty( $w['signals'] ),
			'qa'      => ! empty( $w['qa'] ),
		);
	}

	/**
	 * @param string $host Host name.
	 * @return bool
	 */
	public static function looks_like_staging( $host ) {
		if ( 'localhost' === $host || false !== filter_var( $host, FILTER_VALIDATE_IP ) ) {
			return true;
		}
		return (bool) preg_match( '/(^|\.)(staging|stage|dev|test|local|localhost)\.|\.(local|test|localhost|invalid|example)$|(^|\.)wpengine(powered)?\.com$|\.kinsta\.cloud$|\.instawp\.(xyz|co)$|\.tastewp\.com$|\.flywheelsites\.com$|\.pantheonsite\.io$/', $host );
	}

	/**
	 * The domain of an address the way VisionForgeX writes it: lower case, no www.
	 *
	 * @param string $url Address.
	 * @return string
	 */
	public static function domain( $url ) {
		$host = strtolower( (string) wp_parse_url( $url, PHP_URL_HOST ) );
		return 0 === strpos( $host, 'www.' ) ? substr( $host, 4 ) : $host;
	}
}
