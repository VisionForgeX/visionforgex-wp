<?php
/**
 * Plugin Name:       VisionForgeX – Ad Management & Yield
 * Description:       Connects your site to VisionForgeX in one click: your ad tag and ads.txt lines go on the site by themselves, speed plugins are kept off the tag, and your ad formats, placements, consent and where ads show are managed from WordPress.
 * Version:           1.2.0
 * Requires at least: 6.3
 * Requires PHP:      7.4
 * Author:            VisionForgeX
 * Author URI:        https://visionforgex.com/
 * License:           GPLv2 or later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:       visionforgex
 * Domain Path:       /languages
 *
 * @package VisionForgeX
 */

defined( 'ABSPATH' ) || exit;

define( 'VISIONFORGEX_VERSION', '1.2.0' );
define( 'VISIONFORGEX_FILE', __FILE__ );
define( 'VISIONFORGEX_DIR', plugin_dir_path( __FILE__ ) );
define( 'VISIONFORGEX_URL', plugin_dir_url( __FILE__ ) );
// The VisionForgeX platform. A developer may point a test site elsewhere by defining it in wp-config.php.
if ( ! defined( 'VISIONFORGEX_PLATFORM' ) ) {
	define( 'VISIONFORGEX_PLATFORM', 'https://visionforgex.com' );
}

require_once VISIONFORGEX_DIR . 'includes/class-visionforgex-store.php';
require_once VISIONFORGEX_DIR . 'includes/class-visionforgex-api.php';
require_once VISIONFORGEX_DIR . 'includes/class-visionforgex-connect.php';
require_once VISIONFORGEX_DIR . 'includes/class-visionforgex-frontend.php';
require_once VISIONFORGEX_DIR . 'includes/class-visionforgex-adstxt.php';
require_once VISIONFORGEX_DIR . 'includes/class-visionforgex-health.php';
require_once VISIONFORGEX_DIR . 'includes/class-visionforgex-rest.php';
require_once VISIONFORGEX_DIR . 'includes/class-visionforgex-admin.php';
require_once VISIONFORGEX_DIR . 'includes/class-visionforgex-rules.php';
require_once VISIONFORGEX_DIR . 'includes/class-visionforgex-placements.php';
require_once VISIONFORGEX_DIR . 'includes/class-visionforgex-widget.php';
require_once VISIONFORGEX_DIR . 'includes/class-visionforgex-tools.php';
require_once VISIONFORGEX_DIR . 'includes/class-visionforgex-spots.php';
require_once VISIONFORGEX_DIR . 'includes/class-visionforgex-signals.php';
require_once VISIONFORGEX_DIR . 'includes/class-visionforgex-push.php';
require_once VISIONFORGEX_DIR . 'includes/class-visionforgex-picker.php';
require_once VISIONFORGEX_DIR . 'includes/class-visionforgex-import.php';
require_once VISIONFORGEX_DIR . 'includes/class-visionforgex-network.php';

VisionForgeX_Frontend::init();
VisionForgeX_Adstxt::init();
VisionForgeX_Rest::init();
VisionForgeX_Admin::init();
VisionForgeX_Connect::init();
VisionForgeX_Health::init();
VisionForgeX_Rules::init();
VisionForgeX_Placements::init();
VisionForgeX_Tools::init();
VisionForgeX_Spots::init();
VisionForgeX_Signals::init();
VisionForgeX_Push::init();
VisionForgeX_Picker::init();
VisionForgeX_Network::init();

if ( defined( 'WP_CLI' ) && WP_CLI ) {
	require_once VISIONFORGEX_DIR . 'includes/class-visionforgex-cli.php';
	WP_CLI::add_command( 'visionforgex', 'VisionForgeX_CLI' );
}

register_activation_hook( __FILE__, array( 'VisionForgeX_Store', 'activate' ) );
register_deactivation_hook( __FILE__, array( 'VisionForgeX_Store', 'deactivate' ) );
