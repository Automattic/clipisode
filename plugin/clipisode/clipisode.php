<?php
/**
 * Plugin Name: Clipisode
 * Description: Collect, curate, and publish user-generated video content.
 * Version: 0.1.0
 * Author: Clipisode
 * Text Domain: clipisode
 * Requires at least: 6.5
 * Requires PHP: 8.1
 */

defined( 'ABSPATH' ) || exit;

define( 'CLIPISODE_VERSION', '0.1.0' );
define( 'CLIPISODE_PLUGIN_DIR', plugin_dir_path( __FILE__ ) );
define( 'CLIPISODE_PLUGIN_URL', plugin_dir_url( __FILE__ ) );

require_once CLIPISODE_PLUGIN_DIR . 'includes/class-database.php';
require_once CLIPISODE_PLUGIN_DIR . 'includes/class-post-types.php';
require_once CLIPISODE_PLUGIN_DIR . 'includes/class-media.php';
require_once CLIPISODE_PLUGIN_DIR . 'includes/class-admin.php';
require_once CLIPISODE_PLUGIN_DIR . 'includes/class-rest-api.php';
require_once CLIPISODE_PLUGIN_DIR . 'includes/class-invitation.php';

register_activation_hook( __FILE__, [ Clipisode_Database::class, 'activate' ] );
register_activation_hook( __FILE__, [ Clipisode_Invitation::class, 'flush_rewrites' ] );
register_deactivation_hook( __FILE__, 'flush_rewrite_rules' );

add_action( 'init', [ Clipisode_Post_Types::class, 'register' ] );
add_action( 'init', [ new Clipisode_Media(), 'register_hooks' ] );
add_action( 'admin_menu', [ new Clipisode_Admin(), 'register_menus' ] );
add_action( 'rest_api_init', [ new Clipisode_REST_API(), 'register_routes' ] );

add_filter( 'clipisode_themes', function ( array $themes ): array {
	$themes['standard'] = [
		'label'     => 'Standard',
		'asset_url' => CLIPISODE_PLUGIN_URL . 'assets/themes/standard/',
		'asset_dir' => CLIPISODE_PLUGIN_DIR . 'assets/themes/standard/',
	];
	$themes['wpvip'] = [
		'label'     => 'WP VIP',
		'asset_url' => CLIPISODE_PLUGIN_URL . 'assets/themes/wpvip/',
		'asset_dir' => CLIPISODE_PLUGIN_DIR . 'assets/themes/wpvip/',
	];
	return $themes;
} );

add_action( 'enqueue_block_editor_assets', function (): void {
	$screen = get_current_screen();
	if ( ! $screen || $screen->post_type !== 'clipisode_invite' ) {
		return;
	}
	wp_add_inline_script(
		'wp-edit-post',
		'wp.domReady(function(){wp.data.dispatch("core/edit-post").__experimentalSetPreviewDeviceType("Mobile");});'
	);
} );

$clipisode_invitation = new Clipisode_Invitation();
add_action( 'init', [ $clipisode_invitation, 'register_blocks' ] );
add_action( 'init', [ $clipisode_invitation, 'register_rewrite' ] );
add_filter( 'query_vars', [ $clipisode_invitation, 'add_query_vars' ] );
add_filter( 'template_include', [ $clipisode_invitation, 'template_include' ] );
add_action( 'rest_api_init', [ $clipisode_invitation, 'register_routes' ] );
