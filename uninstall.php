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
	define( 'VISIONFORGEX_VERSION', '1.0.0' );
}
require_once __DIR__ . '/includes/class-visionforgex-store.php';
require_once __DIR__ . '/includes/class-visionforgex-api.php';
require_once __DIR__ . '/includes/class-visionforgex-adstxt.php';

if ( VisionForgeX_Store::connected() ) {
	VisionForgeX_Api::call( 'POST', 'disconnect', array() );
}
VisionForgeX_Adstxt::remove_from_file();
foreach ( VisionForgeX_Store::all_options() as $visionforgex_option ) {
	delete_option( $visionforgex_option );
}
wp_clear_scheduled_hook( 'visionforgex_sync' );
wp_clear_scheduled_hook( 'visionforgex_daily' );
