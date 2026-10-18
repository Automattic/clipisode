<?php
/**
 * Plugin Name: Clipisode Community Video Theme
 * Description: Community video theme for Clipisode.
 * Version: 1.0.0
 * Requires at least: 6.6
 * Requires PHP: 8.1
 * Requires Plugins: clipisode
 * Text Domain: clipisode-community-theme
 */

defined( 'ABSPATH' ) || exit;

add_filter( 'clipisode_composition_themes', function ( array $themes ): array {
	$path = __DIR__ . '/theme.json';
	$definition = json_decode( file_get_contents( $path ), true );
	if ( ! is_array( $definition ) ) {
		throw new RuntimeException( 'The Community video theme definition is invalid.' );
	}
	$themes[] = $definition;
	return $themes;
} );
