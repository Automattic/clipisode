<?php

defined( 'ABSPATH' ) || exit;

class Clipisode_Invitation {

	public function register_blocks(): void {
		register_block_type( CLIPISODE_PLUGIN_DIR . 'build/flow' );
		register_block_type( CLIPISODE_PLUGIN_DIR . 'build/stage-desktop' );
		register_block_type( CLIPISODE_PLUGIN_DIR . 'build/stage-landing' );
		register_block_type( CLIPISODE_PLUGIN_DIR . 'build/stage-record' );
		register_block_type( CLIPISODE_PLUGIN_DIR . 'build/stage-thanks' );
		register_block_type( CLIPISODE_PLUGIN_DIR . 'build/element' );
	}

	public function register_rewrite(): void {
		add_rewrite_rule(
			'^c/([a-zA-Z0-9]+)/?$',
			'index.php?clipisode_invite=$matches[1]',
			'top'
		);
	}

	public function add_query_vars( array $vars ): array {
		$vars[] = 'clipisode_invite';
		return $vars;
	}

	public function template_include( string $template ): string {
		$slug = get_query_var( 'clipisode_invite' );
		if ( ! $slug ) {
			return $template;
		}
		return CLIPISODE_PLUGIN_DIR . 'templates/invitation.php';
	}

	public function register_routes(): void {
		register_rest_route( 'clipisode/v1', '/invitation/upload', [
			'methods'             => 'POST',
			'callback'            => [ $this, 'upload_video' ],
			'permission_callback' => '__return_true',
		] );

		register_rest_route( 'clipisode/v1', '/invitation/submit', [
			'methods'             => 'POST',
			'callback'            => [ $this, 'submit_clip' ],
			'permission_callback' => '__return_true',
		] );
	}

	public function upload_video( WP_REST_Request $request ): WP_REST_Response {
		require_once ABSPATH . 'wp-admin/includes/image.php';
		require_once ABSPATH . 'wp-admin/includes/file.php';
		require_once ABSPATH . 'wp-admin/includes/media.php';

		$files = $request->get_file_params();
		if ( empty( $files['video'] ) ) {
			return new WP_REST_Response( [ 'message' => 'No video file provided.' ], 400 );
		}

		$file = $files['video'];
		$ext  = strtolower( pathinfo( $file['name'], PATHINFO_EXTENSION ) );

		if ( ! in_array( $ext, Clipisode_Media::ALLOWED_EXTENSIONS, true ) ) {
			return new WP_REST_Response( [
				'message' => 'Invalid video type. Allowed: MP4, MOV, WebM, M4V.',
			], 400 );
		}

		if ( $file['size'] > Clipisode_Media::MAX_FILE_SIZE ) {
			return new WP_REST_Response( [ 'message' => 'File too large. Maximum 80 MB.' ], 400 );
		}

		$attachment_id = media_handle_upload( 'video', 0 );

		if ( is_wp_error( $attachment_id ) ) {
			return new WP_REST_Response( [ 'message' => $attachment_id->get_error_message() ], 400 );
		}

		update_post_meta( $attachment_id, Clipisode_Media::META_KEY, '1' );

		return new WP_REST_Response( [
			'attachment_id' => $attachment_id,
			'url'           => wp_get_attachment_url( $attachment_id ),
		] );
	}

	public function submit_clip( WP_REST_Request $request ): WP_REST_Response {
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

	public static function flush_rewrites(): void {
		( new self() )->register_rewrite();
		flush_rewrite_rules();
	}
}
