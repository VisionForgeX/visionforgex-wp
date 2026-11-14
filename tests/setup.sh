#!/bin/bash
# A real WordPress for the plugin's tests, in tests/.wp/<port>/ (never committed).
#   bash tests/setup.sh <WordPress folder> <port> [platform]
# WordPress itself: git clone --depth 1 --branch <version> https://github.com/WordPress/WordPress
# The site answers as http://wpdemo-vfx.com:<port> (add "127.0.0.1 wpdemo-vfx.com www.wpdemo-vfx.com" to /etc/hosts),
# a made-up domain that does not look like a staging copy. The plugin talks to [platform] (default the platform's
# test server, http://127.0.0.1:8097). Needs MariaDB (root over the socket), PHP with mysqli, and WP-CLI
# ($WP_CLI, default /tmp/claude-0/wpdl/wp-cli.phar).
set -e
cd "$(dirname "$0")"
SRC="$1"; PORT="${2:-8180}"; PLATFORM="${3:-http://127.0.0.1:8097}"
WPCLI="${WP_CLI:-/tmp/claude-0/wpdl/wp-cli.phar}"
[ -f "$SRC/wp-includes/version.php" ] || { echo "No WordPress in $SRC"; exit 1; }
DIR="$PWD/.wp/$PORT"; DB="vfx_wp_$PORT"; URL="http://wpdemo-vfx.com:$PORT"
for pid in $(ss -ltnp 2>/dev/null | grep ":$PORT " | grep -o "pid=[0-9]*" | cut -d= -f2 | sort -u); do kill "$pid"; done
rm -rf "$DIR"; mkdir -p "$DIR"
cp -a "$SRC/." "$DIR/"; rm -rf "$DIR/.git"
mysql -uroot -e "DROP DATABASE IF EXISTS $DB; CREATE DATABASE $DB CHARACTER SET utf8mb4"
cat > "$DIR/wp-config.php" <<CFG
<?php
define('DB_NAME', '$DB'); define('DB_USER', 'root'); define('DB_PASSWORD', ''); define('DB_HOST', 'localhost');
define('DB_CHARSET', 'utf8mb4'); define('DB_COLLATE', '');
\$table_prefix = 'wp_';
define('AUTH_KEY', '$(openssl rand -hex 24)'); define('SECURE_AUTH_KEY', '$(openssl rand -hex 24)');
define('LOGGED_IN_KEY', '$(openssl rand -hex 24)'); define('NONCE_KEY', '$(openssl rand -hex 24)');
define('AUTH_SALT', '$(openssl rand -hex 24)'); define('SECURE_AUTH_SALT', '$(openssl rand -hex 24)');
define('LOGGED_IN_SALT', '$(openssl rand -hex 24)'); define('NONCE_SALT', '$(openssl rand -hex 24)');
define('WP_DEBUG', true); define('WP_DEBUG_LOG', __DIR__ . '/debug.log'); define('WP_DEBUG_DISPLAY', false);
define('WP_ENVIRONMENT_TYPE', 'production');
define('FS_METHOD', 'direct');
define('DISABLE_WP_CRON', true);
define('WP_HTTP_BLOCK_EXTERNAL', true); define('WP_ACCESSIBLE_HOSTS', 'wpdemo-vfx.com,www.wpdemo-vfx.com,127.0.0.1'); // WordPress.org is out of reach here
define('AUTOMATIC_UPDATER_DISABLED', true);
define('VISIONFORGEX_PLATFORM', '$PLATFORM');
if (!defined('ABSPATH')) define('ABSPATH', __DIR__ . '/');
require_once ABSPATH . 'wp-settings.php';
CFG
WP="php $WPCLI --path=$DIR --allow-root --url=$URL"
$WP core install --title="Demo Recipes" --admin_user=admin --admin_password=admin-test-pass --admin_email=admin@wpdemo-vfx.com --skip-email >/dev/null
$WP rewrite structure '/%postname%/' >/dev/null
$WP post create --post_type=post --post_status=publish --post_title="Ten weeknight dinners" --post_content="<p>One.</p><p>Two.</p><p>Three.</p>" >/dev/null
# The plugin, copied the way a site gets it (no tests, no node_modules).
mkdir -p "$DIR/wp-content/plugins/visionforgex"
rsync -a --exclude-from=../.distignore ../ "$DIR/wp-content/plugins/visionforgex/"
$WP plugin activate visionforgex >/dev/null
( cd "$DIR" && setsid nohup env PHP_CLI_SERVER_WORKERS=4 php -S 127.0.0.1:$PORT "$PWD/../../router.php" </dev/null >"$DIR/server.log" 2>&1 & )
sleep 1
echo "WordPress $(grep "wp_version =" "$DIR/wp-includes/version.php" | cut -d"'" -f2) at $URL (admin / admin-test-pass), plugin active"
