<?php
/**
 * The VisionForgeX dashboard inside WordPress: one menu item, one app (built on WordPress's own React), scoped so it
 * never changes how the rest of wp-admin looks. No notices elsewhere, no ads.
 *
 * @package VisionForgeX
 */

defined( 'ABSPATH' ) || exit;

/**
 * Admin.
 */
class VisionForgeX_Admin {

	const SLUG = 'visionforgex';

	/** @var string */
	private static $hook = '';

	/** Hooks. */
	public static function init() {
		add_action( 'admin_menu', array( __CLASS__, 'menu' ) );
		add_action( 'admin_enqueue_scripts', array( __CLASS__, 'assets' ) );
		add_filter( 'plugin_action_links_' . plugin_basename( VISIONFORGEX_FILE ), array( __CLASS__, 'action_links' ) );
		add_filter( 'admin_body_class', array( __CLASS__, 'body_class' ) );
	}

	/** @return string The VisionForgeX mark as a menu icon (WordPress recolours it). */
	public static function menu_icon() {
		$svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><rect x="16.4" y="1.6" width="7.2" height="36.8" rx="3.2" fill="black" transform="rotate(-45 20 20)"/><path d="M20,0.8 L26.4,11.2 L23.2,11.2 L23.2,39.2 L16.8,39.2 L16.8,11.2 L13.6,11.2 Z" fill="black" transform="rotate(45 20 20)"/></svg>';
		return 'data:image/svg+xml;base64,' . base64_encode( $svg ); // phpcs:ignore WordPress.PHP.DiscouragedPHPFunctions.obfuscation_base64_encode
	}

	/** The menu item. */
	public static function menu() {
		self::$hook = add_menu_page(
			__( 'VisionForgeX', 'visionforgex' ),
			__( 'VisionForgeX', 'visionforgex' ),
			'manage_options',
			self::SLUG,
			array( __CLASS__, 'render' ),
			self::menu_icon(),
			58
		);
	}

	/**
	 * @param string $classes Body classes.
	 * @return string
	 */
	public static function body_class( $classes ) {
		$s = get_current_screen();
		return $s && self::$hook && $s->id === self::$hook ? $classes . ' visionforgex-screen' : $classes;
	}

	/**
	 * @param string[] $links Plugin row links.
	 * @return string[]
	 */
	public static function action_links( $links ) {
		$label = VisionForgeX_Store::connected() ? __( 'Dashboard', 'visionforgex' ) : __( 'Connect', 'visionforgex' );
		array_unshift( $links, '<a href="' . esc_url( admin_url( 'admin.php?page=' . self::SLUG ) ) . '">' . esc_html( $label ) . '</a>' );
		return $links;
	}

	/**
	 * Our page only: the app, its styles, and the state it starts from (so it paints at once, no spinner).
	 *
	 * @param string $hook The screen.
	 */
	public static function assets( $hook ) {
		if ( $hook !== self::$hook ) {
			return;
		}
		$ver = VISIONFORGEX_VERSION . '.' . (string) filemtime( VISIONFORGEX_DIR . 'assets/build/app.js' );
		wp_enqueue_style( 'visionforgex-admin', VISIONFORGEX_URL . 'assets/admin.css', array(), $ver );
		wp_enqueue_script( 'visionforgex-admin', VISIONFORGEX_URL . 'assets/build/app.js', array( 'wp-element', 'wp-api-fetch', 'wp-i18n' ), $ver, true );
		wp_set_script_translations( 'visionforgex-admin', 'visionforgex', VISIONFORGEX_DIR . 'languages' );
		// phpcs:ignore WordPress.Security.NonceVerification.Recommended -- only shown: which way the connect page sent the publisher back.
		$came = isset( $_GET['vfx'] ) ? sanitize_key( wp_unslash( $_GET['vfx'] ) ) : '';
		wp_add_inline_script(
			'visionforgex-admin',
			'window.visionforgexBoot = ' . wp_json_encode(
				array(
					'state' => VisionForgeX_Rest::snapshot_for_app(),
					'came'  => in_array( $came, array( 'connected', 'denied', 'failed', 'stale' ), true ) ? $came : '',
					'page'  => admin_url( 'admin.php?page=' . self::SLUG ),
					'logo'  => VISIONFORGEX_URL . 'assets/logo.svg',
				)
			) . ';',
			'before'
		);
	}

	/** The page: the app mounts here. */
	public static function render() {
		echo '<div class="vfx-root"><div id="visionforgex-app" class="vfx-app" data-theme="auto"><div class="vfx-boot" aria-hidden="true"><span class="vfx-boot-mark"></span></div></div>';
		echo '<noscript><p>' . esc_html__( 'The VisionForgeX dashboard needs JavaScript.', 'visionforgex' ) . '</p></noscript></div>';
	}
}
