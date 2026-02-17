<?php
/**
 * Server-side render for the parent Invitation Flow block.
 *
 * Wraps the rendered child blocks (stages) in a controller container
 * with data attributes the view script hooks into.
 */

defined( 'ABSPATH' ) || exit;

$slug = $attributes['slug'] ?? '';

$wrapper = get_block_wrapper_attributes( [
	'class'     => 'ci-flow-root',
	'data-slug' => esc_attr( $slug ),
	'data-rest-url' => esc_attr( esc_url_raw( rest_url() ) ),
	'data-nonce'    => esc_attr( wp_create_nonce( 'wp_rest' ) ),
] );

echo "<div $wrapper>$content</div>";
