<?php
/**
 * Plugin Name: Clipisode Invitation Block
 * Description: Multi-step invitation flow using parent + sub-blocks per stage.
 * Version: 0.1.0
 * Requires PHP: 8.1
 */

defined( 'ABSPATH' ) || exit;

define( 'CIB_DIR', plugin_dir_path( __FILE__ ) );
define( 'CIB_URL', plugin_dir_url( __FILE__ ) );

// ---------------------------------------------------------------------------
// Register all blocks
// ---------------------------------------------------------------------------
add_action( 'init', function (): void {
	register_block_type( CIB_DIR . 'build/flow' );
	register_block_type( CIB_DIR . 'build/stage-landing' );
	register_block_type( CIB_DIR . 'build/stage-record' );
	register_block_type( CIB_DIR . 'build/stage-thanks' );
	register_block_type( CIB_DIR . 'build/element' );
} );

// ---------------------------------------------------------------------------
// Rewrite: /c/{slug} → custom template
// ---------------------------------------------------------------------------
add_action( 'init', function (): void {
	add_rewrite_rule(
		'^c/([a-zA-Z0-9]+)/?$',
		'index.php?clipisode_invite=$matches[1]',
		'top'
	);
} );

add_filter( 'query_vars', function ( array $vars ): array {
	$vars[] = 'clipisode_invite';
	return $vars;
} );

add_filter( 'template_include', function ( string $template ): string {
	$slug = get_query_var( 'clipisode_invite' );
	if ( ! $slug ) {
		return $template;
	}
	return CIB_DIR . 'templates/invitation.php';
} );

register_activation_hook( __FILE__, function (): void {
	add_rewrite_rule(
		'^c/([a-zA-Z0-9]+)/?$',
		'index.php?clipisode_invite=$matches[1]',
		'top'
	);
	flush_rewrite_rules();
} );

register_deactivation_hook( __FILE__, function (): void {
	flush_rewrite_rules();
} );

// ---------------------------------------------------------------------------
// Public REST endpoints
// ---------------------------------------------------------------------------
add_action( 'rest_api_init', function (): void {

	register_rest_route( 'clipisode-invitation/v1', '/upload', [
		'methods'             => 'POST',
		'callback'            => 'cib_upload_video',
		'permission_callback' => '__return_true',
	] );

	register_rest_route( 'clipisode-invitation/v1', '/submit', [
		'methods'             => 'POST',
		'callback'            => 'cib_submit_clip',
		'permission_callback' => '__return_true',
	] );
} );

function cib_upload_video( WP_REST_Request $request ): WP_REST_Response {
	require_once ABSPATH . 'wp-admin/includes/image.php';
	require_once ABSPATH . 'wp-admin/includes/file.php';
	require_once ABSPATH . 'wp-admin/includes/media.php';

	$files = $request->get_file_params();
	if ( empty( $files['video'] ) ) {
		return new WP_REST_Response( [ 'message' => 'No video file provided.' ], 400 );
	}

	$file    = $files['video'];
	$ext     = strtolower( pathinfo( $file['name'], PATHINFO_EXTENSION ) );
	$allowed = [ 'mp4', 'mov', 'webm', 'm4v' ];

	if ( ! in_array( $ext, $allowed, true ) ) {
		return new WP_REST_Response( [ 'message' => 'Invalid video type. Allowed: MP4, MOV, WebM, M4V.' ], 400 );
	}

	if ( $file['size'] > 80 * 1024 * 1024 ) {
		return new WP_REST_Response( [ 'message' => 'File too large. Maximum 80 MB.' ], 400 );
	}

	$attachment_id = media_handle_upload( 'video', 0 );

	if ( is_wp_error( $attachment_id ) ) {
		return new WP_REST_Response( [ 'message' => $attachment_id->get_error_message() ], 400 );
	}

	update_post_meta( $attachment_id, '_clipisode_managed', '1' );

	return new WP_REST_Response( [
		'attachment_id' => $attachment_id,
		'url'           => wp_get_attachment_url( $attachment_id ),
	] );
}

function cib_submit_clip( WP_REST_Request $request ): WP_REST_Response {
	global $wpdb;

	$slug          = sanitize_text_field( $request->get_param( 'slug' ) );
	$name          = sanitize_text_field( $request->get_param( 'name' ) );
	$social_handle = sanitize_text_field( $request->get_param( 'social_handle' ) ?? '' );
	$attachment_id = (int) $request->get_param( 'attachment_id' );

	if ( ! $slug || ! $name ) {
		return new WP_REST_Response( [ 'message' => 'Slug and name are required.' ], 400 );
	}

	$links_table = $wpdb->prefix . 'clipisode_invitation_links';
	$link = $wpdb->get_row( $wpdb->prepare(
		"SELECT * FROM $links_table WHERE slug = %s", $slug
	) );

	if ( ! $link ) {
		return new WP_REST_Response( [ 'message' => 'Invitation link not found.' ], 404 );
	}

	if ( $link->status !== 'open' ) {
		return new WP_REST_Response( [ 'message' => 'This invitation is no longer accepting replies.' ], 403 );
	}

	$topics_table = $wpdb->prefix . 'clipisode_topics';
	$topic = $wpdb->get_row( $wpdb->prepare(
		"SELECT * FROM $topics_table WHERE id = %d", $link->topic_id
	) );

	if ( ! $topic ) {
		return new WP_REST_Response( [ 'message' => 'Topic not found.' ], 404 );
	}

	$video_url = $attachment_id ? wp_get_attachment_url( $attachment_id ) : null;

	$brand_revision_id  = null;
	$custom_revision_id = null;
	if ( $topic->brand_terms_id ) {
		$revisions = wp_get_post_revisions( (int) $topic->brand_terms_id, [ 'numberposts' => 1 ] );
		$brand_revision_id = $revisions ? array_key_first( $revisions ) : null;
	}
	if ( $topic->custom_terms_id ) {
		$revisions = wp_get_post_revisions( (int) $topic->custom_terms_id, [ 'numberposts' => 1 ] );
		$custom_revision_id = $revisions ? array_key_first( $revisions ) : null;
	}

	$wpdb->insert( $wpdb->prefix . 'clipisode_clips', [
		'topic_id'                 => $topic->id,
		'invitation_link_id'       => $link->id,
		'name'                     => $name,
		'video_url'                => $video_url,
		'social_handle'            => $social_handle ?: null,
		'social_network'           => 'instagram',
		'status'                   => 'unapproved',
		'brand_terms_id'           => $topic->brand_terms_id,
		'brand_terms_revision_id'  => $brand_revision_id,
		'custom_terms_id'          => $topic->custom_terms_id,
		'custom_terms_revision_id' => $custom_revision_id,
	] );

	return new WP_REST_Response( [ 'ok' => true, 'clip_id' => $wpdb->insert_id ] );
}
