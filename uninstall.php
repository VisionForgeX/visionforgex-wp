<?php
/**
 * Uninstalling puts everything back: VisionForgeX is told the site let go of its key (when it can be reached), the
 * ads.txt lines the plugin added are taken out of the real file (everyone else's stay), and every setting, job and
 * copy the plugin kept is removed.
 *
 * @package VisionForgeX
 */

defined( 'WP_UNINSTALL_PLUGIN' ) || exit;

if ( ! defined( 'VISIONFORGEX_PLATFORM' ) ) {
	define( 'VISIONFORGEX_PLATFORM', 'https://visionforgex.com' );
}
if ( ! defined( 'VISIONFORGEX_VERSION' ) ) {
	define( 'VISIONFORGEX_VERSION', '1.2.0' );
}
require_once __DIR__ . '/includes/class-visionforgex-store.php';
require_once __DIR__ . '/includes/class-visionforgex-api.php';
require_once __DIR__ . '/includes/class-visionforgex-adstxt.php';

/** Puts one site back as it was. */
function visionforgex_uninstall_site() {
	if ( VisionForgeX_Store::connected() ) {
		VisionForgeX_Api::call( 'POST', 'disconnect', array() );
	}
	if ( ! is_multisite() || is_main_site() ) {
		VisionForgeX_Adstxt::remove_from_file(); // The network's one file: only through the main site.
	}
	foreach ( VisionForgeX_Store::all_options() as $visionforgex_option ) {
		delete_option( $visionforgex_option );
	}
	delete_post_meta_by_key( '_visionforgex_ads' );
	delete_post_meta_by_key( '_visionforgex_sensitive' );
	foreach ( array( 'visionforgex_sync', 'visionforgex_daily', 'visionforgex_check_now' ) as $visionforgex_hook ) {
		wp_clear_scheduled_hook( $visionforgex_hook );
	}
	wp_unschedule_hook( 'visionforgex_published' );
}

if ( is_multisite() ) {
	foreach ( get_sites(
		array(
			'number' => 1000,
			'fields' => 'ids',
		)
	) as $visionforgex_site ) {
		switch_to_blog( (int) $visionforgex_site );
		visionforgex_uninstall_site();
		restore_current_blog();
	}
} else {
	visionforgex_uninstall_site();
}
