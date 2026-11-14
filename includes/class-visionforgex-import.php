<?php
/**
 * Import from Ad Inserter: its blocks' insertion points become VisionForgeX spots, so a site moving over keeps its layout.
 * The ad code inside the blocks is not copied (VisionForgeX serves the ads); each spot is made as a banner spot,
 * switched off, to check and switch on in Placements. Ad Inserter itself is left as it is.
 *
 *   Before/after paragraph N    → the in-content rule (one per site: the first such block; the others are listed)
 *   Before/after the content    → theme spots
 *   Before the comments, footer, above the header → theme spots
 *   Before/inside/after an HTML element (a CSS selector) → selector spots
 *
 * Reads Ad Inserter's settings as both its older (an array) and newer (encoded) versions store them. The preview says
 * what will be made, and what is skipped and why, before anything changes.
 *
 * @package VisionForgeX
 */

defined( 'ABSPATH' ) || exit;

/**
 * Import.
 */
class VisionForgeX_Import {

	/**
	 * A stored value as text: anything that is not plain text or a number (an object left over from the stored data,
	 * a list) counts as empty.
	 *
	 * @param array  $b   A block.
	 * @param string $key Its setting.
	 * @param string $def When it is not there.
	 * @return string
	 */
	private static function text( array $b, $key, $def = '' ) {
		return isset( $b[ $key ] ) && is_scalar( $b[ $key ] ) ? trim( (string) $b[ $key ] ) : $def;
	}

	/** @return array|null Ad Inserter's blocks: [number => block], or null when it has none. */
	public static function blocks() {
		$raw = get_option( 'ad_inserter' );
		if ( is_string( $raw ) && '' !== $raw ) {
			$dec = base64_decode( $raw, true ); // phpcs:ignore WordPress.PHP.DiscouragedPHPFunctions.obfuscation_base64_decode -- Ad Inserter's own storage.
			$raw = false !== $dec && is_serialized( $dec ) ? @unserialize( $dec, array( 'allowed_classes' => false ) ) : ( is_serialized( $raw ) ? @unserialize( $raw, array( 'allowed_classes' => false ) ) : null ); // phpcs:ignore WordPress.PHP.DiscouragedPHPFunctions.serialize_unserialize, WordPress.PHP.NoSilencedErrors.Discouraged -- Ad Inserter's own storage, no objects allowed.
		}
		if ( ! is_array( $raw ) ) {
			return null;
		}
		$out = array();
		foreach ( $raw as $k => $b ) {
			if ( is_numeric( $k ) && is_array( $b ) ) {
				$out[ (int) $k ] = $b;
			}
		}
		return $out ? $out : null;
	}

	/**
	 * What Ad Inserter's insertion setting means: one of before_paragraph, after_paragraph, before_content, after_content,
	 * before_comments, footer, top, before_element, inside_element, after_element; or '' (manual, widget, disabled…).
	 *
	 * @param mixed $t The block's display_type (text in older versions, a number in newer ones).
	 * @return string
	 */
	public static function kind( $t ) {
		$text = array(
			'before paragraph'    => 'before_paragraph',
			'after paragraph'     => 'after_paragraph',
			'before content'      => 'before_content',
			'after content'       => 'after_content',
			'before post'         => 'before_content',
			'after post'          => 'after_content',
			'before comments'     => 'before_comments',
			'footer'              => 'footer',
			'above header'        => 'top',
			'before html element' => 'before_element',
			'inside html element' => 'inside_element',
			'after html element'  => 'after_element',
		);
		$num  = array(
			1  => 'before_content',
			2  => 'after_content',
			3  => 'before_content',
			4  => 'after_content',
			5  => 'before_paragraph',
			6  => 'after_paragraph',
			10 => 'before_comments',
			13 => 'footer',
			14 => 'top',
			15 => 'before_element',
			16 => 'inside_element',
			17 => 'after_element',
		);
		if ( is_numeric( $t ) ) {
			return isset( $num[ (int) $t ] ) ? $num[ (int) $t ] : '';
		}
		$t = strtolower( trim( (string) $t ) );
		return isset( $text[ $t ] ) ? $text[ $t ] : '';
	}

	/** @return array ['found', 'items' => [['block', 'name', 'spot' (or null), 'incontent' (or null), 'note']]] */
	public static function plan() {
		$blocks = self::blocks();
		if ( ! $blocks ) {
			return array(
				'found' => false,
				'items' => array(),
			);
		}
		$items   = array();
		$have_ic = false;
		foreach ( $blocks as $n => $b ) {
			$name = '' !== self::text( $b, 'name' ) ? sanitize_text_field( self::text( $b, 'name' ) ) : 'Block ' . $n;
			$code = self::text( $b, 'code' );
			$kind = self::kind( self::text( $b, 'display_type' ) );
			$it   = array(
				'block'     => $n,
				'name'      => $name,
				'spot'      => null,
				'incontent' => null,
				'note'      => '',
			);
			if ( '' === $code ) {
				$it['note'] = __( 'empty, skipped', 'visionforgex' );
			} elseif ( '' === $kind ) {
				$it['note'] = __( 'not placed automatically by Ad Inserter (manual, widget or switched off), skipped: place it with the block, shortcode or widget', 'visionforgex' );
			} elseif ( 'before_paragraph' === $kind || 'after_paragraph' === $kind ) {
				$nums = array_values( array_filter( array_map( 'intval', preg_split( '/[^0-9]+/', self::text( $b, 'paragraph_number', '1' ) ) ) ) );
				$nums = $nums ? $nums : array( 1 );
				if ( $have_ic ) {
					$it['note'] = __( 'another in-content block, skipped (one in-content rule per site: change its numbers in Placements)', 'visionforgex' );
				} else {
					$have_ic         = true;
					$first           = 'before_paragraph' === $kind ? max( 1, $nums[0] - 1 ) : $nums[0];
					$every           = count( $nums ) > 1 ? max( 1, $nums[1] - $nums[0] ) : 4;
					$it['incontent'] = array(
						'first' => $first,
						'every' => $every,
						'max'   => max( 1, min( 10, count( $nums ) > 1 ? count( $nums ) : 3 ) ),
					);
					/* translators: 1: paragraph number, 2: every how many */
					$it['note'] = sprintf( __( 'in-content: after paragraph %1$d, then every %2$d', 'visionforgex' ), $first, $every );
				}
			} elseif ( in_array( $kind, array( 'before_element', 'inside_element', 'after_element' ), true ) ) {
				$sel = self::text( $b, 'html_selector' );
				if ( '' === $sel ) {
					$it['note'] = __( 'no HTML element given, skipped', 'visionforgex' );
				} else {
					$it['spot'] = array(
						'kind'     => 'selector',
						'selector' => $sel,
						'position' => 'before_element' === $kind ? 'before' : ( 'inside_element' === $kind ? 'append' : 'after' ),
					);
					/* translators: %s: a CSS selector */
					$it['note'] = sprintf( __( 'your own spot at %s', 'visionforgex' ), $sel );
				}
			} else {
				$map        = array(
					'before_content'  => 'beforeContent',
					'after_content'   => 'afterContent',
					'before_comments' => 'beforeComments',
					'footer'          => 'footer',
					'top'             => 'top',
				);
				$it['spot'] = array(
					'kind'  => 'hook',
					'where' => $map[ $kind ],
				);
				/* translators: %s: where on the page */
				$it['note'] = sprintf( __( 'theme spot: %s', 'visionforgex' ), $map[ $kind ] );
			}
			if ( $it['spot'] ) {
				$it['spot'] += array(
					'on'     => false,
					'format' => 'banner',
					'pages'  => 'all',
					/* translators: %s: the Ad Inserter block's name */
					'label'  => sprintf( __( 'From Ad Inserter: %s', 'visionforgex' ), $name ),
				);
			}
			$items[] = $it;
		}
		return array(
			'found' => true,
			'items' => $items,
		);
	}

	/** Makes the spots of the plan (switched off). ['made'] */
	public static function run() {
		$plan  = self::plan();
		$spots = VisionForgeX_Spots::spots();
		$made  = 0;
		foreach ( $plan['items'] as $it ) {
			if ( $it['spot'] ) {
				$s = VisionForgeX_Spots::clean_spot( $it['spot'] );
				if ( $s ) {
					$spots[ $s['id'] ] = $s;
					++$made;
				}
			}
			if ( $it['incontent'] ) {
				VisionForgeX_Spots::save_incontent( $it['incontent'] + array( 'on' => false ) );
				++$made;
			}
		}
		VisionForgeX_Spots::save_spots( array_values( $spots ) );
		/* translators: %d: how many */
		VisionForgeX_Store::log( sprintf( __( 'Imported %d spot(s) from Ad Inserter, switched off', 'visionforgex' ), $made ) );
		return array( 'made' => $made );
	}
}
