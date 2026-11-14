<?php
/**
 * The site's ads.txt, with every line VisionForgeX needs, never removing anyone else's.
 *
 * Three ways:
 *   served  No ads.txt file on the server: WordPress answers /ads.txt itself with the publisher's own lines (kept in
 *           the dashboard, and those of the Ads.txt Manager plugin when it is there) and ours.
 *   file    A real ads.txt file is there: our lines are written into it between two marker comments, once, and kept
 *           up to date; the rest of the file is never touched. Uninstalling takes our block out.
 *   manual  Neither works (WordPress lives in a sub-folder, or the file cannot be written): the dashboard shows the
 *           lines to add by hand.
 *
 * @package VisionForgeX
 */

defined( 'ABSPATH' ) || exit;

/**
 * The ads.txt file or answer.
 */
class VisionForgeX_Adstxt {

	const BEGIN = '# VisionForgeX: begin (added by the VisionForgeX plugin; it keeps this part up to date)';
	const END   = '# VisionForgeX: end';

	/** Hooks. */
	public static function init() {
		add_action( 'init', array( __CLASS__, 'maybe_serve' ), 0 );
	}

	/** @return string The real file's path (at the web root, which is WordPress's own folder when it is at the root). */
	public static function path() {
		return trailingslashit( ABSPATH ) . 'ads.txt';
	}

	/** @return bool WordPress answers at the root of its domain (ads.txt must be at /ads.txt). */
	public static function at_root() {
		$p = (string) wp_parse_url( home_url( '/' ), PHP_URL_PATH );
		return '' === trim( $p, '/' );
	}

	/** @return string[] The lines VisionForgeX needs on this site. */
	public static function lines() {
		$snap  = VisionForgeX_Store::snapshot();
		$lines = array();
		if ( VisionForgeX_Store::connected() && $snap && ! empty( $snap['adsTxt']['lines'] ) ) {
			foreach ( (array) $snap['adsTxt']['lines'] as $l ) {
				$l = trim( preg_replace( '/[\r\n]+/', ' ', (string) $l ) );
				if ( '' !== $l ) {
					$lines[] = $l;
				}
			}
		}
		/**
		 * The lines the plugin adds to ads.txt.
		 *
		 * @param string[] $lines From VisionForgeX.
		 */
		return array_values( array_unique( (array) apply_filters( 'visionforgex_adstxt_lines', $lines ) ) );
	}

	/**
	 * How this site's ads.txt is kept.
	 *
	 * @return array ['mode' => served|file|manual, 'reason', 'path', 'exists', 'writable']
	 */
	public static function status() {
		$path     = self::path();
		$exists   = file_exists( $path );
		$writable = $exists ? wp_is_writable( $path ) : wp_is_writable( dirname( $path ) );
		$direct   = self::filesystem() !== null;
		$mode     = VisionForgeX_Store::settings()['adstxtMode'];
		$reason   = '';
		if ( ! self::at_root() ) {
			$out    = 'manual';
			$reason = __( 'WordPress runs in a sub-folder, so it cannot answer for /ads.txt at the root of your domain. Add the lines to the ads.txt file at the root by hand.', 'visionforgex' );
		} elseif ( $exists || 'file' === $mode ) {
			if ( $writable && $direct ) {
				$out = 'file';
			} else {
				$out    = 'manual';
				$reason = __( 'Your ads.txt file cannot be written by WordPress. Add the lines below to it by hand, or let your host make it writable.', 'visionforgex' );
			}
		} else {
			$out = 'served';
		}
		return array(
			'mode'     => $out,
			'chosen'   => $mode,
			'reason'   => $reason,
			'exists'   => $exists,
			'writable' => $writable && $direct,
			'canFile'  => self::at_root() && $writable && $direct,
		);
	}

	/** /ads.txt, answered by WordPress when there is no file. */
	public static function maybe_serve() {
		if ( empty( $_SERVER['REQUEST_URI'] ) || ! self::at_root() ) {
			return;
		}
		$path = (string) wp_parse_url( esc_url_raw( wp_unslash( $_SERVER['REQUEST_URI'] ) ), PHP_URL_PATH );
		if ( '/ads.txt' !== $path || 'served' !== self::status()['mode'] ) {
			return;
		}
		$body = self::served_body();
		if ( '' === trim( $body ) ) {
			return; // Nothing to say: let WordPress answer as before (a 404, or another plugin).
		}
		status_header( 200 );
		header( 'Content-Type: text/plain; charset=utf-8' );
		header( 'Cache-Control: public, max-age=300' );
		header( 'X-Robots-Tag: noindex' );
		echo $body; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- plain text, not HTML.
		exit;
	}

	/** @return string The whole served ads.txt: the publisher's own lines, then ours. */
	public static function served_body() {
		$own = trim( str_replace( "\r", '', (string) VisionForgeX_Store::settings()['adstxtExtra'] ) );
		$mgr = self::other_plugin_lines();
		if ( '' !== $mgr ) {
			$own = trim( $own . "\n" . $mgr );
		}
		$ours = self::lines();
		if ( ! $ours && '' === $own ) {
			return '';
		}
		return self::merge( $own, $ours );
	}

	/** @return string The content kept by the Ads.txt Manager plugin, which our answer would otherwise hide. */
	public static function other_plugin_lines() {
		$id = (int) get_option( 'adstxt_post' );
		if ( ! $id ) {
			return '';
		}
		$p = get_post( $id );
		return $p && 'adstxt' === $p->post_type ? trim( str_replace( "\r", '', (string) $p->post_content ) ) : '';
	}

	/**
	 * Someone else's ads.txt with our block: their lines exactly as they are, our block (rebuilt) at the end. Lines of
	 * ours they already carry are not repeated.
	 *
	 * @param string   $content Existing content (may hold an old block of ours).
	 * @param string[] $ours    Our lines.
	 * @return string
	 */
	public static function merge( $content, array $ours ) {
		$theirs = rtrim( self::strip_block( str_replace( "\r\n", "\n", (string) $content ) ) );
		$have   = array();
		foreach ( explode( "\n", $theirs ) as $l ) {
			$k = self::key( $l );
			if ( '' !== $k ) {
				$have[ $k ] = true;
			}
		}
		$add = array();
		foreach ( $ours as $l ) {
			$k = self::key( $l );
			if ( '' === $k || ! isset( $have[ $k ] ) ) {
				$add[] = $l;
				if ( '' !== $k ) {
					$have[ $k ] = true;
				}
			}
		}
		$out = '' !== $theirs ? $theirs . "\n" : '';
		if ( $add ) {
			$out .= ( '' !== $theirs ? "\n" : '' ) . self::BEGIN . "\n" . implode( "\n", $add ) . "\n" . self::END . "\n";
		}
		return $out;
	}

	/**
	 * @param string $content ads.txt.
	 * @return string Without our block.
	 */
	public static function strip_block( $content ) {
		$b = preg_quote( '# VisionForgeX: begin', '#' );
		$e = preg_quote( self::END, '#' );
		return (string) preg_replace( '#\n?' . $b . '[^\n]*\n.*?' . $e . '[^\n]*(\n|$)#s', "\n", (string) $content );
	}

	/**
	 * What makes two ads.txt records the same: domain, account and type, ignoring case, spaces and comments.
	 *
	 * @param string $line A line.
	 * @return string '' for a comment, a blank or a variable line.
	 */
	public static function key( $line ) {
		$l = trim( preg_replace( '/#.*$/', '', (string) $line ) );
		if ( '' === $l || false === strpos( $l, ',' ) ) {
			return '';
		}
		$f = array_map( 'trim', explode( ',', $l ) );
		return strtolower( $f[0] ) . ',' . strtolower( isset( $f[1] ) ? $f[1] : '' ) . ',' . strtoupper( isset( $f[2] ) ? $f[2] : '' );
	}

	/**
	 * Brings the real file up to date when the plugin keeps one. Called after connecting, after a sync that changed the
	 * lines, and from the dashboard.
	 *
	 * @return array ['ok', 'mode', 'message']
	 */
	public static function apply() {
		$st = self::status();
		if ( 'file' !== $st['mode'] ) {
			return array(
				'ok'      => 'served' === $st['mode'],
				'mode'    => $st['mode'],
				'message' => $st['reason'],
			);
		}
		if ( '' !== VisionForgeX_Store::staging_reason() ) {
			return array(
				'ok'      => false,
				'mode'    => 'file',
				'message' => __( 'This is a staging or local copy, so the ads.txt file is left as it is.', 'visionforgex' ),
			);
		}
		$fs      = self::filesystem();
		$path    = self::path();
		$current = $st['exists'] ? (string) $fs->get_contents( $path ) : '';
		$next    = self::merge( $current, self::lines() );
		if ( $next === $current ) {
			return array(
				'ok'      => true,
				'mode'    => 'file',
				'message' => '',
			);
		}
		if ( ! $fs->put_contents( $path, $next, FS_CHMOD_FILE ) ) {
			return array(
				'ok'      => false,
				'mode'    => 'file',
				'message' => __( 'The ads.txt file could not be written.', 'visionforgex' ),
			);
		}
		update_option( 'visionforgex_adstxt_written', gmdate( 'c' ), false );
		return array(
			'ok'      => true,
			'mode'    => 'file',
			'message' => '',
		);
	}

	/** Takes our block out of the real file (disconnecting, uninstalling). Everyone else's lines stay. */
	public static function remove_from_file() {
		$path = self::path();
		$fs   = self::filesystem();
		if ( ! $fs || ! file_exists( $path ) ) {
			return;
		}
		$current = (string) $fs->get_contents( $path );
		if ( false === strpos( $current, '# VisionForgeX: begin' ) ) {
			return;
		}
		$next = rtrim( self::strip_block( $current ) );
		if ( '' === $next && get_option( 'visionforgex_adstxt_written' ) && 'file' === VisionForgeX_Store::settings()['adstxtMode'] ) {
			$fs->delete( $path ); // The plugin made this file and nothing else is in it.
		} else {
			$fs->put_contents( $path, '' === $next ? '' : $next . "\n", FS_CHMOD_FILE );
		}
		delete_option( 'visionforgex_adstxt_written' );
	}

	/** @return WP_Filesystem_Base|null The file system, only when WordPress can write directly (never asks for FTP details). */
	public static function filesystem() {
		require_once ABSPATH . 'wp-admin/includes/file.php';
		if ( 'direct' !== get_filesystem_method( array(), ABSPATH ) ) {
			return null;
		}
		global $wp_filesystem;
		if ( ! $wp_filesystem && ! WP_Filesystem() ) {
			return null;
		}
		return $wp_filesystem;
	}
}
