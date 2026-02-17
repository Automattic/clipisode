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

register_activation_hook( __FILE__, [ Clipisode_Database::class, 'activate' ] );

add_action( 'init', [ Clipisode_Post_Types::class, 'register' ] );
add_action( 'init', [ new Clipisode_Media(), 'register_hooks' ] );
add_action( 'admin_menu', [ new Clipisode_Admin(), 'register_menus' ] );
add_action( 'rest_api_init', [ new Clipisode_REST_API(), 'register_routes' ] );
