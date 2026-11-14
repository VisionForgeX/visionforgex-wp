<?php
/**
 * Multisite: each site of a network connects on its own (its own VisionForgeX site, key and settings), and the network
 * administrator gets one page listing every site with its state and a link to its dashboard. A site made after the
 * plugin was activated for the network gets its background jobs at once.
 *
 * @package VisionForgeX
 */

defined( 'ABSPATH' ) || exit;

/**
 * Network.
 */
class VisionForgeX_Network {

	/** Hooks. */
	public static function init() {
		if ( ! is_multisite() ) {
			return;
		}
		add_action( 'network_admin_menu', array( __CLASS__, 'menu' ) );
		add_action( 'wp_initialize_site', array( __CLASS__, 'new_site' ), 20 );
	}

	/**
	 * A new site of the network, with the plugin active for the network: its jobs.
	 *
	 * @param WP_Site $site The site.
	 */
	public static function new_site( $site ) {
		if ( ! function_exists( 'is_plugin_active_for_network' ) ) {
			require_once ABSPATH . 'wp-admin/includes/plugin.php';
		}
		if ( is_plugin_active_for_network( plugin_basename( VISIONFORGEX_FILE ) ) ) {
			switch_to_blog( (int) $site->blog_id );
			VisionForgeX_Store::activate( false );
			restore_current_blog();
		}
	}

	/** Network Admin → VisionForgeX. */
	public static function menu() {
		add_menu_page( __( 'VisionForgeX', 'visionforgex' ), __( 'VisionForgeX', 'visionforgex' ), 'manage_network_options', 'visionforgex-network', array( __CLASS__, 'render' ), VisionForgeX_Admin::menu_icon(), 58 );
	}

	/** @return array Every site of the network with its VisionForgeX state. */
	public static function rows() {
		$rows = array();
		foreach ( get_sites( array( 'number' => 500 ) ) as $site ) {
			switch_to_blog( (int) $site->blog_id );
			$c      = VisionForgeX_Store::connection();
			$snap   = VisionForgeX_Store::snapshot();
			$set    = VisionForgeX_Store::settings();
			$rows[] = array(
				'id'        => (int) $site->blog_id,
				'home'      => home_url( '/' ),
				'name'      => get_bloginfo( 'name' ),
				'connected' => (bool) $c,
				'domain'    => $c ? $c['domain'] : '',
				'state'     => ! $c ? __( 'Not connected', 'visionforgex' ) : ( $set['paused'] ? __( 'Paused', 'visionforgex' ) : ( $snap && ! empty( $snap['site']['approved'] ) ? __( 'Live', 'visionforgex' ) : __( 'In review', 'visionforgex' ) ) ),
				'lastSync'  => $c ? (string) $c['lastSync'] : '',
				'dashboard' => admin_url( 'admin.php?page=visionforgex' ),
			);
			restore_current_blog();
		}
		return $rows;
	}

	/** The page. */
	public static function render() {
		if ( ! current_user_can( 'manage_network_options' ) ) {
			return;
		}
		$rows = self::rows();
		$on   = count( array_filter( $rows, fn( $r ) => $r['connected'] ) );
		echo '<div class="wrap vfx-net"><style>.vfx-net h1{display:flex;align-items:center;gap:10px}.vfx-net table{border-collapse:separate;border-spacing:0;width:100%;max-width:1100px;background:#fff;border:1px solid #e7e2f0;border-radius:14px;overflow:hidden}.vfx-net th,.vfx-net td{text-align:left;padding:12px 14px;border-top:1px solid #f0ecf6}.vfx-net th{background:#faf9fc;border-top:0;font-weight:600}.vfx-net .s{display:inline-block;padding:2px 10px;border-radius:999px;font-weight:600;font-size:12px;border:1px solid #d6cbec;color:#6b647a}.vfx-net .s-live{border-color:#17803f;color:#17803f}.vfx-net .s-paused,.vfx-net .s-in-review{border-color:#a8590a;color:#a8590a}.vfx-net .lede{color:#6b647a;max-width:760px}</style>';
		echo '<h1><img src="' . esc_url( VISIONFORGEX_URL . 'assets/logo.svg' ) . '" width="28" height="28" alt=""> ' . esc_html__( 'VisionForgeX on this network', 'visionforgex' ) . '</h1>';
		/* translators: 1: connected sites, 2: all sites */
		echo '<p class="lede">' . esc_html( sprintf( __( '%1$d of %2$d sites are connected. Each site connects on its own, from its own dashboard, to its own VisionForgeX site; its ads.txt lines go into the network\'s file from the main site.', 'visionforgex' ), $on, count( $rows ) ) ) . '</p>';
		echo '<table><thead><tr><th>' . esc_html__( 'Site', 'visionforgex' ) . '</th><th>' . esc_html__( 'VisionForgeX', 'visionforgex' ) . '</th><th>' . esc_html__( 'Last sync', 'visionforgex' ) . '</th><th></th></tr></thead><tbody>';
		foreach ( $rows as $r ) {
			$cls = 's s-' . sanitize_html_class( strtolower( str_replace( ' ', '-', $r['state'] ) ) );
			echo '<tr data-vfx-net-site="' . esc_attr( (string) $r['id'] ) . '"><td><strong>' . esc_html( $r['name'] ) . '</strong><br><span class="description">' . esc_html( $r['home'] ) . '</span></td>';
			echo '<td><span class="' . esc_attr( $cls ) . '">' . esc_html( $r['state'] ) . '</span>' . ( $r['domain'] ? ' ' . esc_html( $r['domain'] ) : '' ) . '</td>';
			echo '<td>' . esc_html( $r['lastSync'] ? human_time_diff( (int) strtotime( $r['lastSync'] ) ) . ' ' . __( 'ago', 'visionforgex' ) : '—' ) . '</td>';
			echo '<td><a class="button" href="' . esc_url( $r['dashboard'] ) . '">' . esc_html( $r['connected'] ? __( 'Open', 'visionforgex' ) : __( 'Connect', 'visionforgex' ) ) . '</a></td></tr>';
		}
		echo '</tbody></table></div>';
	}
}
