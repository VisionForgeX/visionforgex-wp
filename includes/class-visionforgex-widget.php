<?php
/**
 * The VisionForgeX ad widget.
 *
 * @package VisionForgeX
 */

defined( 'ABSPATH' ) || exit;

/**
 * The VisionForgeX ad widget (sidebars and other widget areas).
 */
class VisionForgeX_Widget extends WP_Widget {

	/** Set up. */
	public function __construct() {
		parent::__construct(
			'visionforgex_ad',
			__( 'VisionForgeX ad', 'visionforgex' ),
			array(
				'description'                 => __( 'An ad spot: one of your Ad Tags, or a banner or native ad.', 'visionforgex' ),
				'customize_selective_refresh' => true,
			)
		);
	}

	/**
	 * @param array $args     Widget area.
	 * @param array $instance Settings.
	 */
	public function widget( $args, $instance ) {
		$html = VisionForgeX_Placements::spot( isset( $instance['tag'] ) ? (string) $instance['tag'] : '', isset( $instance['format'] ) ? (string) $instance['format'] : 'banner', 'widget' );
		if ( '' === $html ) {
			return;
		}
		echo $args['before_widget']; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- the theme's own wrapper.
		echo $html; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- built with esc_attr above.
		echo $args['after_widget']; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- the theme's own wrapper.
	}

	/**
	 * @param array $instance Settings.
	 * @return string
	 */
	public function form( $instance ) {
		$tag    = isset( $instance['tag'] ) ? (string) $instance['tag'] : '';
		$format = isset( $instance['format'] ) ? (string) $instance['format'] : 'banner';
		$value  = '' !== $tag ? $tag : 'format:' . $format;
		echo '<p><label for="' . esc_attr( $this->get_field_id( 'spot' ) ) . '">' . esc_html__( 'Ad', 'visionforgex' ) . '</label>';
		echo '<select class="widefat" id="' . esc_attr( $this->get_field_id( 'spot' ) ) . '" name="' . esc_attr( $this->get_field_name( 'spot' ) ) . '">';
		echo '<option value="format:banner"' . selected( $value, 'format:banner', false ) . '>' . esc_html__( 'Banner', 'visionforgex' ) . '</option>';
		echo '<option value="format:native"' . selected( $value, 'format:native', false ) . '>' . esc_html__( 'Native', 'visionforgex' ) . '</option>';
		foreach ( VisionForgeX_Placements::tags() as $t ) {
			/* translators: %s: an Ad Tag's name */
			echo '<option value="' . esc_attr( $t['id'] ) . '"' . selected( $value, $t['id'], false ) . '>' . esc_html( sprintf( __( 'Ad Tag: %s', 'visionforgex' ), $t['name'] ) ) . '</option>';
		}
		echo '</select></p>';
		return '';
	}

	/**
	 * @param array $new_instance New.
	 * @param array $old_instance Old.
	 * @return array
	 */
	public function update( $new_instance, $old_instance ) {
		$v = isset( $new_instance['spot'] ) ? sanitize_text_field( $new_instance['spot'] ) : 'format:banner';
		if ( 0 === strpos( $v, 'format:' ) ) {
			return array(
				'tag'    => '',
				'format' => 'format:native' === $v ? 'native' : 'banner',
			);
		}
		return array(
			'tag'    => preg_match( '/^tag_[a-f0-9]{6,32}$/', $v ) ? $v : '',
			'format' => 'banner',
		);
	}
}
