<?php
/**
 * The platform's side of the phase 3 tests, run against the platform's test copy (PLATFORM_DIR):
 *   php platform.php <dir> change <siteId> <json>     a change saved on VisionForgeX (as an admin would): queues a push
 *   php platform.php <dir> queue <siteId> <action>    "Check now" (health) or "Clear its cache" (clear) from Admin → WordPress sites
 *   php platform.php <dir> capture <siteId> <file>    signs the waiting push as the cron would, writes it to <file>, does not send it
 *   php platform.php <dir> run                       the cron job itself (cron-wp-push.php)
 *   php platform.php <dir> state <siteId>            the connector's record of the site (no key, no secret)
 */
$dir = $argv[1];
$cmd = $argv[2];
chdir($dir . '/admin');
require $dir . '/admin/default-config.php';
require_once $dir . '/admin/wp-connector-lib.php';
$id = $argv[3] ?? '';
switch ($cmd) {
	case 'change':
		echo json_encode(zy_wpc_change_settings($id, json_decode($argv[4], true), 'admin')), "\n";
		break;
	case 'queue':
		echo json_encode(['ok' => zy_wpc_queue_push($id, $argv[4])]), "\n";
		break;
	case 'capture':
		$out = $argv[4];
		$r = zy_wpc_send_push($id, function ($url, $headers, $body) use ($out) {
			file_put_contents($out, json_encode(['url' => $url, 'headers' => $headers, 'body' => $body]));
			return [200, '{"ok":true}'];
		});
		echo json_encode($r), "\n";
		break;
	case 'run':
		passthru('php ' . escapeshellarg($dir . '/admin/cron-wp-push.php'));
		break;
	case 'state':
		$d = zy_wpc_load();
		$s = $d['sites'][$id] ?? null;
		if ($s) unset($s['secret']);
		echo json_encode(['site' => $s, 'push' => $d['push'][$id] ?? null]), "\n";
		break;
}
