<?php
/**
 * Where ads show: rules kept in WordPress and applied before the page is built, so a page without ads carries no tag at
 * all. Off until the publisher switches them on; a site that never touched them behaves exactly as before.
 *
 *   By content    post types and categories without ads, and addresses containing a piece of text.
 *   By visitor    no ads for chosen roles, for anyone logged in, or for paying members (MemberPress, Paid Memberships
 *                 Pro, Restrict Content Pro, WooCommerce Memberships).
 *   WooCommerce   never on the cart, checkout or account pages; optionally not on product pages.
 *   Each post     a box on the edit screen: "No ads on this page" (honoured whether or not the rules are on).
 *
 * Page caches: rules about logged-in visitors and members depend on caches not serving logged-in visitors a cached
 * page, which is how every common page cache works by default.
 *
 * @package VisionForgeX
 */

defined( 'ABSPATH' ) || exit;

/**
 * The rules.
 */
class VisionForgeX_Rules {

	const OPTION = 'visionforgex_rules';
	const META   = '_visionforgex_ads';

	/** Hooks. */
	public static function init() {
		add_filter( 'visionforgex_should_serve', array( __CLASS__, 'filter' ), 5 );
		add_action( 'init', array( __CLASS__, 'register_meta' ) );
		add_action( 'add_meta_boxes', array( __CLASS__, 'meta_box' ) );
		add_action( 'save_post', array( __CLASS__, 'save_post' ), 10, 2 );
	}

	/** @return array */
	public static function defaults() {
		return array(
			'on'         => false,
			'postTypes'  => array(),
			'categories' => array(),
			'urls'       => array(),
			'roles'      => array(),
			'loggedIn'   => false,
			'members'    => false,
			'woo'        => false,
			'wooProduct' => false,
		);
	}

	/** @return array */
	public static function get() {
		$r = get_option( self::OPTION, array() );
		return array_merge( self::defaults(), is_array( $r ) ? $r : array() );
	}

	/**
	 * Saves the rules, cleaned. Returns them.
	 *
	 * @param array $in From the dashboard.
	 * @return array
	 */
	public static function save( array $in ) {
		$r               = self::get();
		$public_types    = array_keys( self::post_types() );
		$r['on']         = ! empty( $in['on'] );
		$r['postTypes']  = array_values( array_intersect( array_map( 'sanitize_key', (array) ( isset( $in['postTypes'] ) ? $in['postTypes'] : array() ) ), $public_types ) );
		$r['categories'] = array_values( array_filter( array_map( 'absint', (array) ( isset( $in['categories'] ) ? $in['categories'] : array() ) ) ) );
		$r['roles']      = array_values( array_intersect( array_map( 'sanitize_key', (array) ( isset( $in['roles'] ) ? $in['roles'] : array() ) ), array_keys( wp_roles()->get_names() ) ) );
		$r['loggedIn']   = ! empty( $in['loggedIn'] );
		$r['members']    = ! empty( $in['members'] );
		$r['woo']        = ! empty( $in['woo'] );
		$r['wooProduct'] = ! empty( $in['wooProduct'] );
		$urls            = array();
		foreach ( (array) ( isset( $in['urls'] ) ? $in['urls'] : array() ) as $u ) {
			$u = trim( wp_strip_all_tags( (string) $u ) );
			if ( '' !== $u && strlen( $u ) <= 200 ) {
				$urls[] = $u;
			}
		}
		$r['urls'] = array_values( array_unique( array_slice( $urls, 0, 100 ) ) );
		update_option( self::OPTION, $r, true );
		return $r;
	}

	/** @return array Public post types: [name => label]. */
	public static function post_types() {
		$out = array();
		foreach ( get_post_types( array( 'public' => true ), 'objects' ) as $t ) {
			if ( 'attachment' !== $t->name ) {
				$out[ $t->name ] = $t->labels->name;
			}
		}
		return $out;
	}

	/** @return array The membership plugins found: [key => name]. */
	public static function membership_plugins() {
		$out = array();
		if ( defined( 'MEPR_VERSION' ) || class_exists( 'MeprUser' ) ) {
			$out['memberpress'] = 'MemberPress';
		}
		if ( function_exists( 'pmpro_hasMembershipLevel' ) ) {
			$out['pmpro'] = 'Paid Memberships Pro';
		}
		if ( function_exists( 'rcp_user_has_active_membership' ) ) {
			$out['rcp'] = 'Restrict Content Pro';
		}
		if ( function_exists( 'wc_memberships_get_user_active_memberships' ) ) {
			$out['wcm'] = 'WooCommerce Memberships';
		}
		return $out;
	}

	/**
	 * Is the current visitor a paying member in one of the membership plugins?
	 *
	 * @return bool
	 */
	public static function is_member() {
		$uid = get_current_user_id();
		if ( ! $uid ) {
			return false;
		}
		// phpcs:disable WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedHooknameFound -- other plugins' own functions.
		if ( class_exists( 'MeprUser' ) ) {
			$u = new MeprUser( $uid );
			if ( method_exists( $u, 'active_product_subscriptions' ) && $u->active_product_subscriptions( 'ids' ) ) {
				return true;
			}
		}
		if ( function_exists( 'pmpro_hasMembershipLevel' ) && pmpro_hasMembershipLevel( null, $uid ) ) {
			return true;
		}
		if ( function_exists( 'rcp_user_has_active_membership' ) && rcp_user_has_active_membership( $uid ) ) {
			return true;
		}
		if ( function_exists( 'wc_memberships_get_user_active_memberships' ) && wc_memberships_get_user_active_memberships( $uid ) ) {
			return true;
		}
		// phpcs:enable
		/**
		 * Whether the visitor counts as a paying member (no ads when the rule is on).
		 *
		 * @param bool $member From the membership plugins found.
		 * @param int  $uid    The user.
		 */
		return (bool) apply_filters( 'visionforgex_is_member', false, $uid );
	}

	/**
	 * Why this page must not carry ads, or ''.
	 *
	 * @return string
	 */
	public static function reason() {
		if ( is_singular() ) {
			$id = get_queried_object_id();
			if ( $id && 'off' === get_post_meta( $id, self::META, true ) ) {
				return 'post';
			}
		}
		$r = self::get();
		if ( ! $r['on'] ) {
			return '';
		}
		if ( $r['postTypes'] && is_singular( $r['postTypes'] ) ) {
			return 'postType';
		}
		if ( $r['categories'] && ( is_category( $r['categories'] ) || ( is_singular( 'post' ) && has_category( $r['categories'], get_queried_object_id() ) ) ) ) {
			return 'category';
		}
		if ( $r['urls'] && isset( $_SERVER['REQUEST_URI'] ) ) {
			$uri = strtolower( esc_url_raw( wp_unslash( $_SERVER['REQUEST_URI'] ) ) );
			foreach ( $r['urls'] as $u ) {
				if ( false !== strpos( $uri, strtolower( $u ) ) ) {
					return 'url';
				}
			}
		}
		if ( $r['loggedIn'] && is_user_logged_in() ) {
			return 'loggedIn';
		}
		if ( $r['roles'] && is_user_logged_in() && array_intersect( $r['roles'], (array) wp_get_current_user()->roles ) ) {
			return 'role';
		}
		if ( $r['members'] && self::is_member() ) {
			return 'member';
		}
		if ( $r['woo'] && function_exists( 'is_woocommerce' ) ) {
			if ( ( function_exists( 'is_cart' ) && is_cart() ) || ( function_exists( 'is_checkout' ) && is_checkout() ) || ( function_exists( 'is_account_page' ) && is_account_page() ) ) {
				return 'woo';
			}
			if ( $r['wooProduct'] && function_exists( 'is_product' ) && is_product() ) {
				return 'wooProduct';
			}
		}
		return '';
	}

	/**
	 * Plugged into should_serve().
	 *
	 * @param bool $ok So far.
	 * @return bool
	 */
	public static function filter( $ok ) {
		return $ok && '' === self::reason();
	}

	/** The per-post setting, also for the block editor. */
	public static function register_meta() {
		foreach ( array_keys( self::post_types() ) as $type ) {
			register_post_meta(
				$type,
				self::META,
				array(
					'type'              => 'string',
					'single'            => true,
					'show_in_rest'      => true,
					'sanitize_callback' => array( __CLASS__, 'clean_meta' ),
					'auth_callback'     => function () {
						return current_user_can( 'edit_posts' );
					},
				)
			);
		}
	}

	/**
	 * @param mixed $v Value.
	 * @return string 'off' or ''.
	 */
	public static function clean_meta( $v ) {
		return 'off' === $v ? 'off' : '';
	}

	/** The box on the edit screen (only once the site is connected). */
	public static function meta_box() {
		if ( ! VisionForgeX_Store::connected() ) {
			return;
		}
		add_meta_box( 'visionforgex-ads', __( 'VisionForgeX ads', 'visionforgex' ), array( __CLASS__, 'render_box' ), array_keys( self::post_types() ), 'side', 'default' );
	}

	/**
	 * @param WP_Post $post The post.
	 */
	public static function render_box( $post ) {
		wp_nonce_field( 'visionforgex_ads_box', 'visionforgex_ads_nonce' );
		$off = 'off' === get_post_meta( $post->ID, self::META, true );
		echo '<p><label><input type="checkbox" name="visionforgex_ads_off" value="1"' . checked( $off, true, false ) . '> ' . esc_html__( 'No ads on this page', 'visionforgex' ) . '</label></p>';
		echo '<p class="description">' . esc_html__( 'The VisionForgeX tag is left off this page entirely.', 'visionforgex' ) . '</p>';
	}

	/**
	 * @param int     $post_id Post.
	 * @param WP_Post $post    Post.
	 */
	public static function save_post( $post_id, $post ) {
		if ( ! isset( $_POST['visionforgex_ads_nonce'] ) || ! wp_verify_nonce( sanitize_text_field( wp_unslash( $_POST['visionforgex_ads_nonce'] ) ), 'visionforgex_ads_box' ) ) {
			return;
		}
		if ( ( defined( 'DOING_AUTOSAVE' ) && DOING_AUTOSAVE ) || wp_is_post_revision( $post_id ) || ! current_user_can( 'edit_post', $post_id ) ) {
			return;
		}
		$off = ! empty( $_POST['visionforgex_ads_off'] );
		$was = 'off' === get_post_meta( $post_id, self::META, true );
		if ( $off ) {
			update_post_meta( $post_id, self::META, 'off' );
		} else {
			delete_post_meta( $post_id, self::META );
		}
		if ( $off !== $was ) {
			/* translators: %s: the post's title */
			VisionForgeX_Store::log( sprintf( $off ? __( 'No ads on "%s"', 'visionforgex' ) : __( 'Ads back on "%s"', 'visionforgex' ), get_the_title( $post ) ) );
		}
	}

	/** @return array What the dashboard needs. */
	public static function for_app() {
		$cats = array();
		foreach ( get_categories(
			array(
				'hide_empty' => false,
				'number'     => 200,
			)
		) as $c ) {
			$cats[] = array(
				'id'   => (int) $c->term_id,
				'name' => $c->name,
			);
		}
		$roles = array();
		foreach ( wp_roles()->get_names() as $k => $n ) {
			$roles[] = array(
				'id'   => $k,
				'name' => translate_user_role( $n ),
			);
		}
		$types = array();
		foreach ( self::post_types() as $k => $n ) {
			$types[] = array(
				'id'   => $k,
				'name' => $n,
			);
		}
		global $wpdb;
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- a count for the dashboard.
		$off = (int) $wpdb->get_var( $wpdb->prepare( "SELECT COUNT(*) FROM {$wpdb->postmeta} WHERE meta_key = %s AND meta_value = 'off'", self::META ) );
		return array(
			'rules'      => self::get(),
			'postTypes'  => $types,
			'categories' => $cats,
			'roles'      => $roles,
			'members'    => self::membership_plugins(),
			'woo'        => class_exists( 'WooCommerce' ),
			'postsOff'   => $off,
		);
	}
}
