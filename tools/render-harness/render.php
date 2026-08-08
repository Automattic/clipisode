<?php
/**
 * Renders an invitation-flow screen from the CLI and writes the HTML to a file.
 *
 * Boots a real WordPress against a Studio site's SQLite database WITHOUT the
 * Studio app running — nothing listens on a port; PHP reads
 * wp-content/database/.ht.sqlite directly. That makes it the cheapest way to
 * regression-test the flow: render before a change, render after, `cmp` the two.
 *
 * WordPress requires the DB_* constants to be defined even though the SQLite
 * drop-in ignores them. Without these stubs you get "Error establishing a
 * database connection" and no hint as to why.
 *
 * Usage (see render.sh for a wrapper that does all the screens at once):
 *
 *   WPROOT=~/Studio/alvey-clipisode \
 *   TPL=plugin/clipisode/assets/templates/clipisode-flow.php \
 *   SLUG=18df67 SCREEN=name UA="$MOBILE_UA" OUT=/tmp/name.html \
 *   php tools/render-harness/render.php
 *
 * SCREEN is optional and maps to ?screen=<type>. Omit it to exercise the
 * wp_is_mobile() branch that picks intro vs intro_desktop — and note that a UA
 * string WITHOUT the "Mobile/" token does not trip wp_is_mobile(), so an
 * abbreviated iPhone UA silently tests the desktop branch twice.
 */

foreach ( [ 'WPROOT', 'TPL', 'SLUG', 'OUT' ] as $required ) {
	if ( ! getenv( $required ) ) {
		fwrite( STDERR, "Missing required env var: {$required}\n" );
		exit( 1 );
	}
}

define( 'DB_NAME', 'wordpress' );
define( 'DB_USER', 'root' );
define( 'DB_PASSWORD', '' );
define( 'DB_HOST', 'localhost' );
define( 'DB_CHARSET', 'utf8' );
define( 'DB_COLLATE', '' );
define( 'WP_USE_THEMES', false );

$slug   = getenv( 'SLUG' );
$screen = getenv( 'SCREEN' );

$_SERVER['HTTP_HOST']      = 'localhost';
$_SERVER['SERVER_NAME']    = 'localhost';
$_SERVER['REQUEST_METHOD'] = 'GET';
$_SERVER['REQUEST_URI']    = '/invitation/' . $slug . ( $screen ? '?screen=' . $screen : '' );
$_SERVER['HTTP_USER_AGENT'] = getenv( 'UA' ) ?: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

if ( $screen ) {
	$_GET['screen'] = $screen;
}

require getenv( 'WPROOT' ) . '/wp-load.php';

set_query_var( 'clipisode_invite', $slug );

ob_start();
require getenv( 'TPL' );
$html = ob_get_clean();

file_put_contents( getenv( 'OUT' ), $html );
fwrite( STDERR, sprintf( "%7d bytes  %s\n", strlen( $html ), basename( getenv( 'OUT' ) ) ) );
