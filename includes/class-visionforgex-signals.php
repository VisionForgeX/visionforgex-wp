<?php
/**
 * What the page tells the tag, only where the publisher switched it on (the switches live on VisionForgeX, so the tag
 * reads these only for this site; see the platform's ZY_WPC_WP_FLAGS):
 *
 *   Consent bridge  window.vfxConsent = {decided, ads, by}: the visitor's choice read from the site's consent plugin
 *                   (WP Consent API, Complianz, CookieYes, Cookiebot, Borlabs Cookie, or Google consent mode such as
 *                   Site Kit's), so personalised ads follow it with no extra set-up.
 *   Page facts      window.vfxPage = {cat, tag, author, type, len, sens, fewer}: from WordPress itself, so targeting works
 *                   on a page's first visit; "sensitive" and "fewer ads" come from the box on each post.
 *   Test ads        window.vfxQa = true, only for the site's administrators: Google's test ads for them alone.
 *   Publish events  when a post is published, VisionForgeX hears it at once (Page targeting, Return Reader, Next Read).
 *
 * All printed in the head before the tag, from WordPress's own data: no remote call on a visitor's page load.
 *
 * @package VisionForgeX
 */

defined( 'ABSPATH' ) || exit;

/**
 * Signals.
 */
class VisionForgeX_Signals {

	const SENSITIVE = '_visionforgex_sensitive';

	/** Hooks. */
	public static function init() {
		add_action( 'wp_head', array( __CLASS__, 'head' ), 1 );
		add_action( 'transition_post_status', array( __CLASS__, 'transition' ), 10, 3 );
		add_action( 'visionforgex_published', array( __CLASS__, 'send_published' ) );
		add_action( 'init', array( __CLASS__, 'register_meta' ) );
	}

	/** The "sensitive" flag, for the block editor too. */
	public static function register_meta() {
		foreach ( array_keys( VisionForgeX_Rules::post_types() ) as $type ) {
			register_post_meta(
				$type,
				self::SENSITIVE,
				array(
					'type'              => 'string',
					'single'            => true,
					'show_in_rest'      => true,
					'sanitize_callback' => function ( $v ) {
						return '1' === (string) $v ? '1' : '';
					},
					'auth_callback'     => function () {
						return current_user_can( 'edit_posts' );
					},
				)
			);
		}
	}

	/** @return string The consent bridge (JavaScript). Reads cookies and the consent mode data layer; sends nothing. */
	public static function consent_js() {
		return '(function(){function ck(n){var m=document.cookie.match(new RegExp("(?:^|; )"+n.replace(/[.$?*|{}()\\[\\]\\\\\\/+^-]/g,"\\\\$&")+"=([^;]*)"));if(!m)return null;try{return decodeURIComponent(m[1]);}catch(e){return m[1];}}'
			. 'function r(){var v,a;'
			. 'v=ck("wp_consent_marketing");if(v==="allow")return{decided:true,ads:true,by:"wp-consent-api"};if(v==="deny")return{decided:true,ads:false,by:"wp-consent-api"};'
			. 'v=ck("cmplz_marketing");if(v==="allow")return{decided:true,ads:true,by:"complianz"};if(v==="deny")return{decided:true,ads:false,by:"complianz"};'
			. 'v=ck("cookieyes-consent");if(v){a=/(?:^|,)advertisement:(yes|no)/.exec(v);if(a&&/(?:^|,)action:yes/.test(v))return{decided:true,ads:a[1]==="yes",by:"cookieyes"};}'
			. 'v=ck("CookieConsent");if(v){if(v==="-1")return{decided:true,ads:true,by:"cookiebot"};a=/marketing:(true|false)/.exec(v);if(a)return{decided:true,ads:a[1]==="true",by:"cookiebot"};}'
			. 'v=ck("borlabs-cookie");if(v){try{a=JSON.parse(v);if(a&&a.consents)return{decided:true,ads:!!a.consents.marketing,by:"borlabs"};}catch(e){}}'
			. 'var d=window.dataLayer;if(d&&d.length){for(var i=d.length-1;i>=0;i--){var e=d[i];if(e&&e[0]==="consent"&&e[1]==="update"&&e[2]&&("ad_storage" in e[2]||"ad_personalization" in e[2]))return{decided:true,ads:e[2].ad_storage==="granted"&&e[2].ad_personalization!=="denied",by:"consent-mode"};}}'
			. 'return{decided:false,ads:false,by:""};}'
			. 'window.vfxConsent=r();function g(){window.vfxConsent=r();}'
			. '["wp_listen_for_consent_change","cmplz_status_change","cookieyes_consent_update","CookiebotOnConsentReady","borlabs-cookie-consent-saved"].forEach(function(n){document.addEventListener(n,g);window.addEventListener(n,g);});})();';
	}

	/** @return array|null The page's facts, or null on a page without any. */
	public static function page_facts() {
		$out = array();
		if ( is_singular() ) {
			$post = get_queried_object();
			if ( ! $post instanceof WP_Post ) {
				return null;
			}
			$cats = array();
			$tags = array();
			if ( is_object_in_taxonomy( $post->post_type, 'category' ) ) {
				foreach ( (array) get_the_category( $post->ID ) as $c ) {
					$cats[] = $c->slug;
				}
			}
			$t = get_the_tags( $post->ID );
			if ( is_array( $t ) ) {
				foreach ( $t as $x ) {
					$tags[] = $x->slug;
				}
			}
			$words  = str_word_count( wp_strip_all_tags( (string) $post->post_content ) );
			$out    = array(
				'cat'  => array_slice( $cats, 0, 5 ),
				'tag'  => array_slice( $tags, 0, 10 ),
				'type' => $post->post_type,
				'len'  => $words < 600 ? 'short' : ( $words < 1500 ? 'medium' : 'long' ),
			);
			$author = $post->post_author ? (string) get_the_author_meta( 'user_nicename', (int) $post->post_author ) : '';
			if ( '' !== $author ) {
				$out['author'] = $author;
			}
			if ( '1' === get_post_meta( $post->ID, self::SENSITIVE, true ) ) {
				$out['sens'] = true;
			}
			if ( 'fewer' === get_post_meta( $post->ID, VisionForgeX_Rules::META, true ) ) {
				$out['fewer'] = true;
			}
		} elseif ( is_category() || is_tag() ) {
			$term        = get_queried_object();
			$out['type'] = 'archive';
			if ( $term instanceof WP_Term ) {
				$out[ is_category() ? 'cat' : 'tag' ] = array( $term->slug );
			}
		} else {
			return null;
		}
		/**
		 * The page facts given to the tag (key-values for buyers).
		 *
		 * @param array $out cat, tag, author, type, len, sens, fewer.
		 */
		return (array) apply_filters( 'visionforgex_page_facts', $out );
	}

	/** The head: before the tag. */
	public static function head() {
		if ( ! VisionForgeX_Frontend::should_serve() ) {
			return;
		}
		$f  = VisionForgeX_Store::wp_flags();
		$js = '';
		if ( $f['consent'] ) {
			$js .= self::consent_js();
		}
		if ( $f['signals'] ) {
			$facts = self::page_facts();
			if ( $facts ) {
				$js .= 'window.vfxPage=' . wp_json_encode( $facts ) . ';';
			}
		}
		if ( $f['qa'] && current_user_can( 'manage_options' ) ) {
			$js .= 'window.vfxQa=true;';
		}
		if ( '' !== $js ) {
			echo '<script data-cfasync="false" data-no-optimize="1" data-no-defer="1" data-noptimize="1" id="visionforgex-page-js">' . $js . "</script>\n"; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- our own script; data through wp_json_encode.
		}
	}

	/**
	 * A post published: VisionForgeX hears it in the background (never slowing the editor).
	 *
	 * @param string  $new_status New status.
	 * @param string  $old_status Old status.
	 * @param WP_Post $post The post.
	 */
	public static function transition( $new_status, $old_status, $post ) {
		if ( 'publish' !== $new_status || 'publish' === $old_status || wp_is_post_revision( $post ) || ! is_post_type_viewable( $post->post_type ) ) {
			return;
		}
		if ( ! VisionForgeX_Store::connected() || ! VisionForgeX_Store::wp_flags()['signals'] || '' !== VisionForgeX_Store::staging_reason() ) {
			return;
		}
		if ( ! wp_next_scheduled( 'visionforgex_published', array( (int) $post->ID ) ) ) {
			wp_schedule_single_event( time(), 'visionforgex_published', array( (int) $post->ID ) );
		}
	}

	/**
	 * The background job: tells VisionForgeX.
	 *
	 * @param int $post_id The post.
	 * @return array The call's result.
	 */
	public static function send_published( $post_id ) {
		$post = get_post( (int) $post_id );
		if ( ! $post || 'publish' !== $post->post_status ) {
			return array( 'ok' => false );
		}
		$img = get_the_post_thumbnail_url( $post, 'large' );
		$r   = VisionForgeX_Api::call(
			'POST',
			'published',
			array(
				'url'     => get_permalink( $post ),
				'title'   => html_entity_decode( get_the_title( $post ), ENT_QUOTES, 'UTF-8' ),
				'type'    => $post->post_type,
				'excerpt' => wp_trim_words( wp_strip_all_tags( has_excerpt( $post ) ? $post->post_excerpt : $post->post_content ), 30, '…' ),
				'image'   => $img ? $img : '',
			)
		);
		if ( $r['ok'] ) {
			/* translators: %s: the post's title */
			VisionForgeX_Store::log( sprintf( __( 'VisionForgeX told of a new post: %s', 'visionforgex' ), get_the_title( $post ) ) );
		}
		return $r;
	}

	/** @return array The consent plugins found: [key => name]. */
	public static function consent_plugins() {
		$active = VisionForgeX_Tools::active_folders();
		$known  = array(
			'wp-consent-api'         => 'WP Consent API',
			'complianz-gdpr'         => 'Complianz',
			'complianz-gdpr-premium' => 'Complianz',
			'cookie-law-info'        => 'CookieYes',
			'cookieyes'              => 'CookieYes',
			'cookiebot'              => 'Cookiebot',
			'borlabs-cookie'         => 'Borlabs Cookie',
			'real-cookie-banner'     => 'Real Cookie Banner',
			'google-site-kit'        => 'Site Kit by Google (consent mode)',
		);
		$out    = array();
		foreach ( $known as $folder => $name ) {
			if ( isset( $active[ $folder ] ) ) {
				$out[ $folder ] = $name;
			}
		}
		return $out;
	}
}
