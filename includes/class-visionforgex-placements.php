<?php
/**
 * Ad spots placed by the publisher: the "VisionForgeX ad" block, the [visionforgex] shortcode and the VisionForgeX ad
 * widget. Each prints the same spot the publisher dashboard's Ad Tags page gives to paste:
 *
 *   <div data-adx-slot data-adx-format="banner|native" data-adx-tag="tag_…"></div>
 *
 * An Ad Tag (named, sized, from the list on VisionForgeX) or a plain banner or native spot. Nothing is printed on a page
 * without the tag (paused, a rule, a staging copy), or for an Ad Tag that no longer exists.
 *
 * @package VisionForgeX
 */

defined( 'ABSPATH' ) || exit;

/**
 * Placements.
 */
class VisionForgeX_Placements {

	/** Hooks. */
	public static function init() {
		add_shortcode( 'visionforgex', array( __CLASS__, 'shortcode' ) );
		add_action( 'init', array( __CLASS__, 'block' ) );
		add_action( 'widgets_init', array( __CLASS__, 'widget' ) );
	}

	/** @return array The site's Ad Tags: [id => ['id', 'name', 'format', 'sizes']]. */
	public static function tags() {
		$snap = VisionForgeX_Store::snapshot();
		$out  = array();
		foreach ( (array) ( $snap && isset( $snap['settings']['adTags'] ) ? $snap['settings']['adTags'] : array() ) as $t ) {
			if ( is_array( $t ) && ! empty( $t['id'] ) && preg_match( '/^tag_[a-f0-9]{6,32}$/', (string) $t['id'] ) ) {
				$out[ (string) $t['id'] ] = $t;
			}
		}
		return $out;
	}

	/**
	 * One spot.
	 *
	 * @param string $tag    An Ad Tag's id, or ''.
	 * @param string $format banner or native (ignored for an Ad Tag, which has its own).
	 * @param string $where  block, shortcode or widget (a class on the wrapper, for the theme's styles).
	 * @return string
	 */
	public static function spot( $tag, $format, $where ) {
		if ( ! VisionForgeX_Frontend::should_serve() ) {
			return '';
		}
		$tag = (string) $tag;
		if ( '' !== $tag ) {
			$tags = self::tags();
			if ( ! isset( $tags[ $tag ] ) ) {
				return '';
			}
			$format = $tags[ $tag ]['format'];
		}
		$format = 'native' === $format ? 'native' : 'banner';
		$inner  = '<div data-adx-slot data-adx-format="' . esc_attr( $format ) . '"' . ( '' !== $tag ? ' data-adx-tag="' . esc_attr( $tag ) . '"' : '' ) . '></div>';
		return '<div class="visionforgex-spot visionforgex-spot--' . esc_attr( $where ) . '">' . $inner . '</div>';
	}

	/**
	 * [visionforgex tag="tag_…"] or [visionforgex format="native"].
	 *
	 * @param array|string $atts Attributes.
	 * @return string
	 */
	public static function shortcode( $atts ) {
		$a = shortcode_atts(
			array(
				'tag'    => '',
				'format' => 'banner',
			),
			$atts,
			'visionforgex'
		);
		return self::spot( sanitize_text_field( $a['tag'] ), sanitize_key( $a['format'] ), 'shortcode' );
	}

	/** The block (rendered on the server, so it follows every rule the tag follows). */
	public static function block() {
		wp_register_script( 'visionforgex-block', VISIONFORGEX_URL . 'assets/build/block.js', array( 'wp-blocks', 'wp-element', 'wp-block-editor', 'wp-components', 'wp-i18n' ), VISIONFORGEX_VERSION . '.' . (string) filemtime( VISIONFORGEX_DIR . 'assets/build/block.js' ), true );
		wp_set_script_translations( 'visionforgex-block', 'visionforgex', VISIONFORGEX_DIR . 'languages' );
		register_block_type(
			'visionforgex/ad',
			array(
				'api_version'     => 2,
				'title'           => __( 'VisionForgeX ad', 'visionforgex' ),
				'description'     => __( 'An ad spot: one of your Ad Tags, or a banner or native ad.', 'visionforgex' ),
				'category'        => 'widgets',
				'icon'            => 'megaphone',
				'keywords'        => array( 'ad', 'ads', 'advert', 'visionforgex' ),
				'attributes'      => array(
					'tag'    => array(
						'type'    => 'string',
						'default' => '',
					),
					'format' => array(
						'type'    => 'string',
						'default' => 'banner',
					),
				),
				'supports'        => array(
					'html'     => false,
					'align'    => array( 'wide', 'full', 'left', 'right', 'center' ),
					'multiple' => true,
				),
				'editor_script'   => 'visionforgex-block',
				'render_callback' => array( __CLASS__, 'render_block' ),
			)
		);
		if ( is_admin() ) {
			add_action( 'enqueue_block_editor_assets', array( __CLASS__, 'block_data' ) );
		}
	}

	/** What the editor shows: the Ad Tags and whether the site is connected. */
	public static function block_data() {
		$tags = array();
		foreach ( self::tags() as $t ) {
			$tags[] = array(
				'id'     => $t['id'],
				'name'   => (string) $t['name'],
				'format' => (string) $t['format'],
				'sizes'  => array_values( (array) $t['sizes'] ),
			);
		}
		wp_add_inline_script(
			'visionforgex-block',
			'window.visionforgexBlock = ' . wp_json_encode(
				array(
					'connected' => VisionForgeX_Store::connected(),
					'mode'      => ( function () {
						$snap = VisionForgeX_Store::snapshot();
						return $snap && isset( $snap['settings']['mode'] ) ? (string) $snap['settings']['mode'] : 'auto';
					} )(),
					'tags'      => $tags,
					'dashboard' => admin_url( 'admin.php?page=visionforgex#adtags' ),
				)
			) . ';',
			'before'
		);
	}

	/**
	 * @param array $attrs Block attributes.
	 * @return string
	 */
	public static function render_block( $attrs ) {
		return self::spot( isset( $attrs['tag'] ) ? (string) $attrs['tag'] : '', isset( $attrs['format'] ) ? (string) $attrs['format'] : 'banner', 'block' );
	}

	/** The widget. */
	public static function widget() {
		register_widget( 'VisionForgeX_Widget' );
	}
}
