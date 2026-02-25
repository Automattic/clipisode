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
require_once CLIPISODE_PLUGIN_DIR . 'includes/class-rest-api.php';
