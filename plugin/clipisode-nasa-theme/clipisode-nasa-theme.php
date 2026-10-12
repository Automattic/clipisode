<?php
/**
 * Plugin Name: Clipisode NASA Mission Control Video Theme
 * Description: A cinematic, spaceflight-inspired showcase theme for Clipisode.
 * Version: 1.0.0
 * Requires at least: 6.6
 * Requires PHP: 8.1
 * Requires Plugins: clipisode
 * Text Domain: clipisode-nasa-theme
 */

defined( 'ABSPATH' ) || exit;

add_filter( 'clipisode_composition_themes', function ( array $themes ): array {
	$definition = json_decode( file_get_contents( __DIR__ . '/theme.json' ), true, 512, JSON_THROW_ON_ERROR );
	$definition['rendererUrl'] = plugins_url( 'renderer.js', __FILE__ ) . '?ver=1.0.0';
	$themes[] = $definition;
	return $themes;
} );
