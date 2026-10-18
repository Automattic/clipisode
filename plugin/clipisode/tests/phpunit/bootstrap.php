<?php
/**
 * PHPUnit bootstrap file.
 */

require_once dirname( __DIR__, 2 ) . '/vendor/autoload.php';
require_once __DIR__ . '/stubs.php';

define( 'ABSPATH', sys_get_temp_dir() . '/wordpress/' );
define( 'CLIPISODE_PLUGIN_DIR', dirname( __DIR__, 2 ) . '/' );
define( 'CLIPISODE_PLUGIN_URL', 'https://example.com/wp-content/plugins/clipisode/' );
define( 'CLIPISODE_VERSION', '0.1.0' );

require_once CLIPISODE_PLUGIN_DIR . 'includes/class-post-types.php';
require_once CLIPISODE_PLUGIN_DIR . 'includes/class-media.php';
require_once CLIPISODE_PLUGIN_DIR . 'includes/class-composition.php';
require_once CLIPISODE_PLUGIN_DIR . 'includes/class-renderer.php';
require_once CLIPISODE_PLUGIN_DIR . 'includes/class-social-meta.php';
require_once CLIPISODE_PLUGIN_DIR . 'includes/class-rest-api.php';
require_once CLIPISODE_PLUGIN_DIR . 'includes/class-database.php';

/**
 * Clipisode_Database::create_tables() requires WordPress's upgrade.php for
 * dbDelta(). Stand up a minimal stand-in inside the fake ABSPATH so the schema
 * and upgrade-lock logic are testable without a WordPress install.
 */
$clipisode_upgrade_stub_dir = ABSPATH . 'wp-admin/includes';
if ( ! is_dir( $clipisode_upgrade_stub_dir ) ) {
	mkdir( $clipisode_upgrade_stub_dir, 0777, true );
}
file_put_contents(
	$clipisode_upgrade_stub_dir . '/upgrade.php',
	'<?php' . PHP_EOL
	. 'function dbDelta( $queries = "", $execute = true ) {' . PHP_EOL
	. '	global $clipisode_test_dbdelta_calls;' . PHP_EOL
	. '	$clipisode_test_dbdelta_calls[] = $queries;' . PHP_EOL
	. '	return [];' . PHP_EOL
	. '}' . PHP_EOL
);
unset( $clipisode_upgrade_stub_dir );
