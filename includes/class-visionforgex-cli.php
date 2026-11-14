<?php
/**
 * WP-CLI: `wp visionforgex …` for agencies and hosts who manage many sites from a terminal.
 *
 * Commands:
 *   wp visionforgex status              connection, serving, ads.txt, last check (add --format=json)
 *   wp visionforgex connect-url         the address to open in a browser to connect this site
 *   wp visionforgex sync                the latest settings from VisionForgeX
 *   wp visionforgex check               run the site check now and report it to VisionForgeX
 *   wp visionforgex pause | resume      Pause all ads, and back
 *   wp visionforgex adstxt [--write]    the lines VisionForgeX needs, and how ads.txt is kept (--write: bring the file up to date)
 *   wp visionforgex spots               the spots WordPress places (in-content, theme, selector)
 *   wp visionforgex import-adinserter [--yes]   Ad Inserter's blocks as VisionForgeX spots (a preview without --yes)
 *   wp visionforgex diagnostics         the support bundle (no key, no secret)
 *   wp visionforgex disconnect --yes
 *
 * @package VisionForgeX
 */

defined( 'ABSPATH' ) || exit;

/**
 * Manage the VisionForgeX plugin.
 */
class VisionForgeX_CLI {

	/**
	 * Connection, serving, ads.txt and the last check.
	 *
	 * ## OPTIONS
	 *
	 * [--format=<format>]
	 * : table or json.
	 * ---
	 * default: table
	 * ---
	 *
	 * @param array $args  Positional.
	 * @param array $assoc Named.
	 */
	public function status( $args, $assoc ) {
		$s    = VisionForgeX_Rest::snapshot_for_app();
		$rows = array(
			'connected'  => $s['connected'] ? 'yes' : 'no',
			'site'       => $s['connection'] ? $s['connection']['domain'] . ' (' . $s['connection']['siteId'] . ')' : '',
			'serving'    => $s['tag']['serving'] ? 'yes' : 'no',
			'paused'     => $s['settings']['paused'] ? 'yes' : 'no',
			'approved'   => $s['site'] && ! empty( $s['site']['approved'] ) ? 'yes' : 'no',
			'staging'    => $s['staging'],
			'adstxt'     => $s['adsTxt']['mode'] . ( $s['adsTxt']['check'] ? ( $s['adsTxt']['check']['ok'] ? ', complete' : ', ' . count( $s['adsTxt']['check']['missing'] ) . ' missing' ) : '' ),
			'last_sync'  => $s['connection'] ? (string) $s['connection']['lastSync'] : '',
			'last_check' => $s['health'] ? (string) $s['health']['at'] : '',
			'plugin'     => $s['plugin'],
		);
		if ( isset( $assoc['format'] ) && 'json' === $assoc['format'] ) {
			WP_CLI::line( (string) wp_json_encode( $rows ) );
			return;
		}
		$table = array();
		foreach ( $rows as $k => $v ) {
			$table[] = array(
				'field' => $k,
				'value' => $v,
			);
		}
		WP_CLI\Utils\format_items( 'table', $table, array( 'field', 'value' ) );
	}

	/**
	 * The address to open in a browser (as an administrator) to connect this site.
	 *
	 * @subcommand connect-url
	 */
	public function connect_url() {
		$users = get_users(
			array(
				'role'   => 'administrator',
				'number' => 1,
			)
		);
		if ( $users ) {
			wp_set_current_user( $users[0]->ID );
		}
		WP_CLI::line( admin_url( 'admin.php?page=visionforgex' ) );
		WP_CLI::log( 'Open it signed in as an administrator and click "Connect with VisionForgeX".' );
	}

	/** The latest settings from VisionForgeX. */
	public function sync() {
		$r = VisionForgeX_Api::sync();
		$r['ok'] ? WP_CLI::success( 'Up to date with VisionForgeX.' ) : WP_CLI::error( (string) $r['message'] );
	}

	/** Runs the site check now and reports it to VisionForgeX. */
	public function check() {
		$h = VisionForgeX_Health::run( true );
		foreach ( $h['checks'] as $c ) {
			WP_CLI::line( str_pad( strtoupper( $c['state'] ), 6 ) . ' ' . $c['key'] . ': ' . $c['text'] );
		}
		if ( ! empty( $h['found'] ) ) {
			WP_CLI::warning( 'Other ad code on the home page: ' . implode( ', ', $h['found'] ) );
		}
		WP_CLI::success( 'Checked.' );
	}

	/** Pause all ads. */
	public function pause() {
		VisionForgeX_Store::save_settings(
			array(
				'paused'   => true,
				'pausedAt' => gmdate( 'c' ),
			)
		);
		VisionForgeX_Store::log( 'Paused all ads (WP-CLI)' );
		VisionForgeX_Health::clear_caches();
		WP_CLI::success( 'All ads paused. The tag is off every page.' );
	}

	/** Turn ads back on. */
	public function resume() {
		VisionForgeX_Store::save_settings(
			array(
				'paused'   => false,
				'pausedAt' => '',
			)
		);
		VisionForgeX_Store::log( 'Turned ads back on (WP-CLI)' );
		VisionForgeX_Health::clear_caches();
		WP_CLI::success( 'Ads are back on.' );
	}

	/**
	 * The lines VisionForgeX needs, and how ads.txt is kept.
	 *
	 * ## OPTIONS
	 *
	 * [--write]
	 * : Bring the real ads.txt file up to date (when the plugin keeps one).
	 *
	 * @param array $args  Positional.
	 * @param array $assoc Named.
	 */
	public function adstxt( $args, $assoc ) {
		$st = VisionForgeX_Adstxt::status();
		WP_CLI::line( 'Kept: ' . $st['mode'] . ( $st['reason'] ? ' (' . $st['reason'] . ')' : '' ) );
		foreach ( VisionForgeX_Adstxt::lines() as $l ) {
			WP_CLI::line( $l );
		}
		if ( ! empty( $assoc['write'] ) ) {
			$r = VisionForgeX_Adstxt::apply();
			$r['ok'] ? WP_CLI::success( 'ads.txt is up to date.' ) : WP_CLI::error( (string) $r['message'] );
		}
	}

	/** The spots WordPress places. */
	public function spots() {
		$ic   = VisionForgeX_Spots::incontent();
		$rows = array(
			array(
				'kind'  => 'in-content',
				'where' => $ic['beforeHeadings'] ? 'before headings' : 'after paragraph ' . $ic['first'] . ', every ' . $ic['every'] . ', at most ' . $ic['max'],
				'ad'    => '' !== $ic['tag'] ? $ic['tag'] : $ic['format'],
				'on'    => $ic['on'] ? 'yes' : 'no',
			),
		);
		foreach ( VisionForgeX_Spots::spots() as $s ) {
			$rows[] = array(
				'kind'  => $s['kind'],
				'where' => 'hook' === $s['kind'] ? $s['where'] : $s['position'] . ' ' . $s['selector'],
				'ad'    => '' !== $s['tag'] ? $s['tag'] : $s['format'],
				'on'    => $s['on'] ? 'yes' : 'no',
			);
		}
		WP_CLI\Utils\format_items( 'table', $rows, array( 'kind', 'where', 'ad', 'on' ) );
	}

	/**
	 * Ad Inserter's blocks as VisionForgeX spots (switched off, to check first).
	 *
	 * ## OPTIONS
	 *
	 * [--yes]
	 * : Make the spots. Without it, only shows what would be made.
	 *
	 * @subcommand import-adinserter
	 * @param array $args  Positional.
	 * @param array $assoc Named.
	 */
	public function import_adinserter( $args, $assoc ) {
		$plan = VisionForgeX_Import::plan();
		if ( ! $plan['found'] ) {
			WP_CLI::error( 'No Ad Inserter settings on this site.' );
		}
		foreach ( $plan['items'] as $it ) {
			WP_CLI::line( ( $it['spot'] || $it['incontent'] ? 'MAKE  ' : 'SKIP  ' ) . 'Block ' . $it['block'] . ' "' . $it['name'] . '": ' . $it['note'] );
		}
		if ( empty( $assoc['yes'] ) ) {
			WP_CLI::log( 'Nothing changed. Run again with --yes to make these spots (switched off, to check first).' );
			return;
		}
		$r = VisionForgeX_Import::run();
		WP_CLI::success( $r['made'] . ' spot(s) made, switched off. Check them in VisionForgeX → Placements.' );
	}

	/** The support bundle (no key, no secret). */
	public function diagnostics() {
		$s = VisionForgeX_Rest::snapshot_for_app();
		unset( $s['history'] );
		WP_CLI::line( (string) wp_json_encode( $s, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES ) );
	}

	/**
	 * Disconnect from VisionForgeX.
	 *
	 * ## OPTIONS
	 *
	 * [--yes]
	 * : Do it without asking.
	 *
	 * @param array $args  Positional.
	 * @param array $assoc Named.
	 */
	public function disconnect( $args, $assoc ) {
		WP_CLI::confirm( 'Disconnect from VisionForgeX? The tag comes off every page.', $assoc );
		VisionForgeX_Connect::disconnect();
		WP_CLI::success( 'Disconnected.' );
	}
}
