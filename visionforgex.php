<?php
/**
 * Plugin Name:       VisionForgeX – Ad Management & Yield
 * Plugin URI:        https://visionforgex.com/
 * Description:       Connects your site to VisionForgeX in one click: your ad tag and ads.txt lines go on the site by themselves, speed plugins are kept off the tag, and your ads are managed from WordPress.
 * Version:           1.0.0
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

define( 'VISIONFORGEX_VERSION', '1.0.0' );
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

VisionForgeX_Frontend::init();
VisionForgeX_Adstxt::init();
VisionForgeX_Rest::init();
VisionForgeX_Admin::init();
VisionForgeX_Connect::init();
VisionForgeX_Health::init();

register_activation_hook( __FILE__, array( 'VisionForgeX_Store', 'activate' ) );
register_deactivation_hook( __FILE__, array( 'VisionForgeX_Store', 'deactivate' ) );
