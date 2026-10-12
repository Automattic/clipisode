<?php
/**
 * Plugin Name: Clipisode NASA Mission Control Video Theme
 * Description: A cinematic, spaceflight-inspired showcase theme for Clipisode.
 * Version: 1.1.0
 * Requires at least: 6.6
 * Requires PHP: 8.1
 * Requires Plugins: clipisode
 * Text Domain: clipisode-nasa-theme
 */

defined( 'ABSPATH' ) || exit;

add_filter( 'clipisode_composition_themes', function ( array $themes ): array {
	$definition = json_decode( file_get_contents( __DIR__ . '/theme.json' ), true, 512, JSON_THROW_ON_ERROR );
	$definition['rendererUrl'] = plugins_url( 'renderer.js', __FILE__ ) . '?ver=1.1.0';
	$legacy = $definition;
	$legacy['id'] = 'nasa-mission-control';
	$legacy['version'] = '1.0.0';
	$legacy['label'] = 'NASA · Mission Control (Legacy)';
	$legacy['description'] = 'The original NASA Mission Control theme, retained for saved composition compatibility.';
	$legacy['renderer'] = 'nasa-mission-control';
	foreach ( $legacy['groups'] as &$group ) {
		if ( 'opening' === $group['id'] ) {
			$group['fields'] = array_values( array_filter( $group['fields'], static fn( array $field ): bool => ! in_array( $field['id'], [ 'posterHoldDuration', 'countdownStyle', 'countdownScale' ], true ) ) );
			foreach ( $group['fields'] as &$field ) {
				if ( 'titleDuration' === $field['id'] ) {
					$field['default'] = 4;
				}
			}
			unset( $field );
		}
		if ( in_array( $group['id'], [ 'motion', 'clip' ], true ) ) {
			foreach ( $group['fields'] as &$field ) {
				if ( in_array( $field['id'], [ 'transitionType', 'transitionOverride' ], true ) ) {
					$field['options'] = array_values( array_filter( $field['options'], static fn( array $option ): bool => in_array( $option['value'], [ 'theme', 'orbital-iris', 'launch-wipe', 'signal-scan', 'clean-fade', 'none' ], true ) ) );
				}
				if ( 'transitionDuration' === $field['id'] ) {
					$field['default'] = 0.45;
					$field['max'] = 0.8;
					$field['step'] = 0.05;
					unset( $field['help'] );
				}
			}
			unset( $field );
		}
	}
	unset( $group );
	$themes[] = $legacy;
	$themes[] = $definition;
	return $themes;
} );
