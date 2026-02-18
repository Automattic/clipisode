<?php

defined( 'ABSPATH' ) || exit;

class Clipisode_REST_API {

	private const NAMESPACE = 'clipisode/v1';

	public function register_routes(): void {
		// Terms.
		register_rest_route( self::NAMESPACE, '/terms/brand', [
			[
				'methods'             => 'GET',
				'callback'            => [ $this, 'get_brand_terms' ],
				'permission_callback' => [ $this, 'check_permission' ],
			],
		] );

		register_rest_route( self::NAMESPACE, '/terms/custom', [
			[
				'methods'             => 'GET',
				'callback'            => [ $this, 'list_custom_terms' ],
				'permission_callback' => [ $this, 'check_permission' ],
			],
		] );

		// Hosts.
		register_rest_route( self::NAMESPACE, '/hosts', [
			[
				'methods'             => 'GET',
				'callback'            => [ $this, 'list_hosts' ],
				'permission_callback' => [ $this, 'check_permission' ],
			],
			[
				'methods'             => 'POST',
				'callback'            => [ $this, 'create_host' ],
				'permission_callback' => [ $this, 'check_permission' ],
			],
		] );

		register_rest_route( self::NAMESPACE, '/hosts/(?P<id>\d+)', [
			[
				'methods'             => 'DELETE',
				'callback'            => [ $this, 'delete_host' ],
				'permission_callback' => [ $this, 'check_permission' ],
			],
		] );

		// Topics.
		register_rest_route( self::NAMESPACE, '/topics', [
			[
				'methods'             => 'GET',
				'callback'            => [ $this, 'list_topics' ],
				'permission_callback' => [ $this, 'check_permission' ],
			],
			[
				'methods'             => 'POST',
				'callback'            => [ $this, 'create_topic' ],
				'permission_callback' => [ $this, 'check_permission' ],
			],
		] );

		register_rest_route( self::NAMESPACE, '/topics/(?P<id>\d+)', [
			[
				'methods'             => 'GET',
				'callback'            => [ $this, 'get_topic' ],
				'permission_callback' => [ $this, 'check_permission' ],
			],
			[
				'methods'             => 'PUT',
				'callback'            => [ $this, 'update_topic' ],
				'permission_callback' => [ $this, 'check_permission' ],
			],
			[
				'methods'             => 'DELETE',
				'callback'            => [ $this, 'delete_topic' ],
				'permission_callback' => [ $this, 'check_permission' ],
			],
		] );

		// Invitation links.
		register_rest_route( self::NAMESPACE, '/topics/(?P<topic_id>\d+)/invitation-links', [
			[
				'methods'             => 'GET',
				'callback'            => [ $this, 'list_invitation_links' ],
				'permission_callback' => [ $this, 'check_permission' ],
			],
			[
				'methods'             => 'POST',
				'callback'            => [ $this, 'create_invitation_link' ],
				'permission_callback' => [ $this, 'check_permission' ],
			],
		] );

		register_rest_route( self::NAMESPACE, '/invitation-links/(?P<id>\d+)', [
			[
				'methods'             => 'PUT',
				'callback'            => [ $this, 'update_invitation_link' ],
				'permission_callback' => [ $this, 'check_permission' ],
			],
			[
				'methods'             => 'DELETE',
				'callback'            => [ $this, 'delete_invitation_link' ],
				'permission_callback' => [ $this, 'check_permission' ],
			],
		] );

		// Videos (upload / sideload / delete).
		register_rest_route( self::NAMESPACE, '/videos/upload', [
			[
				'methods'             => 'POST',
				'callback'            => [ $this, 'upload_video' ],
				'permission_callback' => [ $this, 'check_permission' ],
			],
		] );

		register_rest_route( self::NAMESPACE, '/videos/sideload', [
			[
				'methods'             => 'POST',
				'callback'            => [ $this, 'sideload_video' ],
				'permission_callback' => [ $this, 'check_permission' ],
			],
		] );

		register_rest_route( self::NAMESPACE, '/videos/(?P<id>\d+)', [
			[
				'methods'             => 'DELETE',
				'callback'            => [ $this, 'delete_video' ],
				'permission_callback' => [ $this, 'check_permission' ],
			],
		] );

		// Themes (CPT-based invitation designs).
		register_rest_route( self::NAMESPACE, '/themes', [
			[
				'methods'             => 'GET',
				'callback'            => [ $this, 'list_themes' ],
				'permission_callback' => [ $this, 'check_permission' ],
			],
			[
				'methods'             => 'POST',
				'callback'            => [ $this, 'clone_theme' ],
				'permission_callback' => [ $this, 'check_permission' ],
			],
		] );

		register_rest_route( self::NAMESPACE, '/themes/(?P<id>\d+)', [
			[
				'methods'             => 'DELETE',
				'callback'            => [ $this, 'delete_theme' ],
				'permission_callback' => [ $this, 'check_permission' ],
			],
		] );

		// Outputs.
		register_rest_route( self::NAMESPACE, '/outputs', [
			[
				'methods'             => 'POST',
				'callback'            => [ $this, 'create_output' ],
				'permission_callback' => [ $this, 'check_permission' ],
			],
		] );

		register_rest_route( self::NAMESPACE, '/outputs/(?P<id>\d+)', [
			[
				'methods'             => 'DELETE',
				'callback'            => [ $this, 'delete_output' ],
				'permission_callback' => [ $this, 'check_permission' ],
			],
		] );

		register_rest_route( self::NAMESPACE, '/outputs/(?P<id>\d+)/upload', [
			[
				'methods'             => 'POST',
				'callback'            => [ $this, 'upload_output' ],
				'permission_callback' => '__return_true',
			],
		] );

		// Clips.
		register_rest_route( self::NAMESPACE, '/clips', [
			[
				'methods'             => 'GET',
				'callback'            => [ $this, 'list_clips' ],
				'permission_callback' => [ $this, 'check_permission' ],
			],
		] );

		register_rest_route( self::NAMESPACE, '/clips/(?P<id>\d+)', [
			[
				'methods'             => 'GET',
				'callback'            => [ $this, 'get_clip' ],
				'permission_callback' => [ $this, 'check_permission' ],
			],
			[
				'methods'             => 'PUT',
				'callback'            => [ $this, 'update_clip' ],
				'permission_callback' => [ $this, 'check_permission' ],
			],
		] );
	}

	public function check_permission(): bool {
		return current_user_can( 'manage_options' );
	}

	// --- Terms ---

	public function get_brand_terms( WP_REST_Request $request ): WP_REST_Response {
		$brand_id = Clipisode_Post_Types::get_brand_terms_id();
		if ( ! $brand_id ) {
			$brand_id = Clipisode_Post_Types::ensure_brand_terms();
		}

		$post = get_post( $brand_id );

		return new WP_REST_Response( [
			'id'          => $post->ID,
			'title'       => $post->post_title,
			'modified'    => $post->post_modified,
			'edit_url'    => get_edit_post_link( $post->ID, 'raw' ),
			'preview_url' => get_permalink( $post->ID ),
		] );
	}

	public function list_custom_terms( WP_REST_Request $request ): WP_REST_Response {
		$posts = get_posts( [
			'post_type'   => 'clipisode_terms',
			'post_status' => 'publish',
			'numberposts' => -1,
			'orderby'     => 'title',
			'order'       => 'ASC',
			'meta_key'    => Clipisode_Post_Types::TERMS_TYPE_META,
			'meta_value'  => 'custom',
		] );

		$terms = array_map( fn( $p ) => [
			'id'          => $p->ID,
			'title'       => $p->post_title,
			'modified'    => $p->post_modified,
			'edit_url'    => get_edit_post_link( $p->ID, 'raw' ),
			'preview_url' => get_permalink( $p->ID ),
		], $posts );

		return new WP_REST_Response( $terms );
	}

	// --- Hosts ---

	public function list_hosts( WP_REST_Request $request ): WP_REST_Response {
		global $wpdb;
		$table = $wpdb->prefix . 'clipisode_hosts';
		$hosts = $wpdb->get_results( "SELECT * FROM $table ORDER BY name ASC" );
		return new WP_REST_Response( $hosts );
	}

	public function create_host( WP_REST_Request $request ): WP_REST_Response {
		global $wpdb;
		$table = $wpdb->prefix . 'clipisode_hosts';
		$name  = sanitize_text_field( $request->get_param( 'name' ) );

		if ( ! $name ) {
			return new WP_REST_Response( [ 'message' => 'Name is required.' ], 400 );
		}

		$existing = $wpdb->get_var( $wpdb->prepare(
			"SELECT id FROM $table WHERE name = %s",
			$name
		) );

		if ( $existing ) {
			return new WP_REST_Response( [
				'id'   => (int) $existing,
				'name' => $name,
			] );
		}

		$wpdb->insert( $table, [ 'name' => $name ] );

		return new WP_REST_Response( [
			'id'   => $wpdb->insert_id,
			'name' => $name,
		], 201 );
	}

	public function delete_host( WP_REST_Request $request ): WP_REST_Response {
		global $wpdb;
		$wpdb->delete( $wpdb->prefix . 'clipisode_hosts', [ 'id' => (int) $request['id'] ] );
		return new WP_REST_Response( null, 204 );
	}

	// --- Topics ---

	private function enrich_topic( object $topic ): object {
		global $wpdb;

		if ( ! empty( $topic->brand_terms_id ) ) {
			$brand_post = get_post( (int) $topic->brand_terms_id );
			$topic->brand_terms_title = $brand_post ? $brand_post->post_title : null;
			$topic->brand_terms_url   = $brand_post ? get_permalink( $brand_post->ID ) : null;
		} else {
			$topic->brand_terms_title = null;
			$topic->brand_terms_url   = null;
		}

		if ( ! empty( $topic->custom_terms_id ) ) {
			$custom_post = get_post( (int) $topic->custom_terms_id );
			$topic->custom_terms_title = $custom_post ? $custom_post->post_title : null;
			$topic->custom_terms_url   = $custom_post ? get_permalink( $custom_post->ID ) : null;
		} else {
			$topic->custom_terms_title = null;
			$topic->custom_terms_url   = null;
		}

		if ( ! empty( $topic->intro_video_id ) ) {
			$topic->intro_video_url = wp_get_attachment_url( (int) $topic->intro_video_id );
		} else {
			$topic->intro_video_url = null;
		}

		if ( ! empty( $topic->invitation_id ) ) {
			$inv_post = get_post( (int) $topic->invitation_id );
			$topic->invitation_title    = $inv_post ? $inv_post->post_title : null;
			$topic->invitation_edit_url = $inv_post ? get_edit_post_link( $inv_post->ID, 'raw' ) : null;
		} else {
			$topic->invitation_title    = null;
			$topic->invitation_edit_url = null;
		}

		$outputs_table = $wpdb->prefix . 'clipisode_outputs';
		$raw_outputs   = $wpdb->get_results( $wpdb->prepare(
			"SELECT * FROM $outputs_table WHERE topic_id = %d ORDER BY created_at DESC",
			(int) $topic->id
		) );

		$topic->outputs = array_map( function ( $o ) {
			return (object) [
				'id'         => (int) $o->id,
				'name'       => $o->name,
				'slug'       => $o->slug,
				'url'        => $o->attachment_id ? wp_get_attachment_url( (int) $o->attachment_id ) : null,
				'created_at' => $o->created_at,
			];
		}, $raw_outputs );

		return $topic;
	}

	public function list_topics( WP_REST_Request $request ): WP_REST_Response {
		global $wpdb;
		$table     = $wpdb->prefix . 'clipisode_topics';
		$clips_tbl = $wpdb->prefix . 'clipisode_clips';
		$links_tbl = $wpdb->prefix . 'clipisode_invitation_links';

		$topics = $wpdb->get_results( "
			SELECT t.*,
				COALESCE(cl.clips_count, 0) AS clips_count,
				COALESCE(lk.links_count, 0) AS links_count,
				COALESCE(lk.clicks, 0) AS clicks
			FROM $table t
			LEFT JOIN (SELECT topic_id, COUNT(*) AS clips_count FROM $clips_tbl GROUP BY topic_id) cl ON cl.topic_id = t.id
			LEFT JOIN (SELECT topic_id, COUNT(*) AS links_count, SUM(clicks) AS clicks FROM $links_tbl GROUP BY topic_id) lk ON lk.topic_id = t.id
			ORDER BY t.created_at DESC
		" );

		$topics = array_map( [ $this, 'enrich_topic' ], $topics );

		return new WP_REST_Response( $topics );
	}

	public function get_topic( WP_REST_Request $request ): WP_REST_Response {
		global $wpdb;
		$table     = $wpdb->prefix . 'clipisode_topics';
		$clips_tbl = $wpdb->prefix . 'clipisode_clips';
		$links_tbl = $wpdb->prefix . 'clipisode_invitation_links';

		$id    = (int) $request['id'];
		$topic = $wpdb->get_row( $wpdb->prepare( "
			SELECT t.*,
				COALESCE(cl.clips_count, 0) AS clips_count,
				COALESCE(lk.links_count, 0) AS links_count,
				COALESCE(lk.clicks, 0) AS clicks
			FROM $table t
			LEFT JOIN (SELECT topic_id, COUNT(*) AS clips_count FROM $clips_tbl GROUP BY topic_id) cl ON cl.topic_id = t.id
			LEFT JOIN (SELECT topic_id, COUNT(*) AS links_count, SUM(clicks) AS clicks FROM $links_tbl GROUP BY topic_id) lk ON lk.topic_id = t.id
			WHERE t.id = %d
		", $id ) );

		if ( ! $topic ) {
			return new WP_REST_Response( [ 'message' => 'Topic not found.' ], 404 );
		}

		return new WP_REST_Response( $this->enrich_topic( $topic ) );
	}

	public function create_topic( WP_REST_Request $request ): WP_REST_Response {
		global $wpdb;
		$table = $wpdb->prefix . 'clipisode_topics';

		$custom_terms_id = $request->get_param( 'custom_terms_id' );
		$intro_video_id  = $request->get_param( 'intro_video_id' );
		$invitation_id   = $request->get_param( 'invitation_id' );
		$brand_terms_id  = Clipisode_Post_Types::ensure_brand_terms();

		$data = [
			'title'           => sanitize_text_field( $request->get_param( 'title' ) ),
			'intro_video_id'  => $intro_video_id ? (int) $intro_video_id : null,
			'hosted_by'       => sanitize_text_field( $request->get_param( 'hosted_by' ) ?? '' ),
			'brand_terms_id'  => $brand_terms_id,
			'custom_terms_id' => $custom_terms_id ? (int) $custom_terms_id : null,
			'invitation_id'   => $invitation_id ? (int) $invitation_id : Clipisode_Post_Types::ensure_default_invitation(),
			'status'          => 'active',
		];

		$wpdb->insert( $table, $data );
		$topic_id = $wpdb->insert_id;

		$this->ensure_host( $data['hosted_by'] );

		$wpdb->insert( $wpdb->prefix . 'clipisode_invitation_links', [
			'topic_id' => $topic_id,
			'slug'     => substr( bin2hex( random_bytes( 3 ) ), 0, 6 ),
			'status'   => 'open',
		] );

		$get_request = new WP_REST_Request( 'GET' );
		$get_request->set_url_params( [ 'id' => $topic_id ] );
		return $this->get_topic( $get_request );
	}

	public function update_topic( WP_REST_Request $request ): WP_REST_Response {
		global $wpdb;
		$table = $wpdb->prefix . 'clipisode_topics';
		$id    = (int) $request['id'];

		$fields = [];
		foreach ( [ 'title', 'hosted_by', 'status' ] as $field ) {
			$val = $request->get_param( $field );
			if ( $val !== null ) {
				$fields[ $field ] = sanitize_text_field( $val );
			}
		}
		if ( $request->has_param( 'intro_video_id' ) ) {
			$new_video_id = $request->get_param( 'intro_video_id' );
			$new_video_id = $new_video_id ? (int) $new_video_id : null;

			$old_video_id = (int) $wpdb->get_var( $wpdb->prepare(
				"SELECT intro_video_id FROM $table WHERE id = %d",
				$id
			) );

			if ( $old_video_id && $old_video_id !== $new_video_id ) {
				$meta = get_post_meta( $old_video_id, Clipisode_Media::META_KEY, true );
				if ( $meta ) {
					wp_delete_attachment( $old_video_id, true );
				}
			}

			$fields['intro_video_id'] = $new_video_id;
		}
		if ( $request->has_param( 'custom_terms_id' ) ) {
			$custom_terms_id = $request->get_param( 'custom_terms_id' );
			$fields['custom_terms_id'] = $custom_terms_id ? (int) $custom_terms_id : null;
		}
		if ( $request->has_param( 'invitation_id' ) ) {
			$invitation_id = $request->get_param( 'invitation_id' );
			$fields['invitation_id'] = $invitation_id ? (int) $invitation_id : null;
		}

		$wpdb->update( $table, $fields, [ 'id' => $id ] );

		if ( ! empty( $fields['hosted_by'] ) ) {
			$this->ensure_host( $fields['hosted_by'] );
		}

		return $this->get_topic( $request );
	}

	private function ensure_host( string $name ): void {
		if ( ! $name ) {
			return;
		}
		global $wpdb;
		$table = $wpdb->prefix . 'clipisode_hosts';
		$exists = $wpdb->get_var( $wpdb->prepare( "SELECT id FROM $table WHERE name = %s", $name ) );
		if ( ! $exists ) {
			$wpdb->insert( $table, [ 'name' => $name ] );
		}
	}

	public function delete_topic( WP_REST_Request $request ): WP_REST_Response {
		global $wpdb;
		$id = (int) $request['id'];

		$video_id = (int) $wpdb->get_var( $wpdb->prepare(
			"SELECT intro_video_id FROM {$wpdb->prefix}clipisode_topics WHERE id = %d",
			$id
		) );
		if ( $video_id ) {
			wp_delete_attachment( $video_id, true );
		}

		$output_attachments = $wpdb->get_col( $wpdb->prepare(
			"SELECT attachment_id FROM {$wpdb->prefix}clipisode_outputs WHERE topic_id = %d AND attachment_id IS NOT NULL",
			$id
		) );
		foreach ( $output_attachments as $att_id ) {
			wp_delete_attachment( (int) $att_id, true );
		}

		$wpdb->delete( $wpdb->prefix . 'clipisode_outputs', [ 'topic_id' => $id ] );
		$wpdb->delete( $wpdb->prefix . 'clipisode_clips', [ 'topic_id' => $id ] );
		$wpdb->delete( $wpdb->prefix . 'clipisode_invitation_links', [ 'topic_id' => $id ] );
		$wpdb->delete( $wpdb->prefix . 'clipisode_topics', [ 'id' => $id ] );

		return new WP_REST_Response( null, 204 );
	}

	// --- Outputs ---

	private function generate_unique_slug( string $base ): string {
		global $wpdb;
		$table = $wpdb->prefix . 'clipisode_outputs';
		$slug  = sanitize_title( $base );

		if ( ! $slug ) {
			$slug = 'output';
		}

		$existing = $wpdb->get_var( $wpdb->prepare(
			"SELECT id FROM $table WHERE slug = %s",
			$slug
		) );

		if ( ! $existing ) {
			return $slug;
		}

		$i = 1;
		while ( $wpdb->get_var( $wpdb->prepare(
			"SELECT id FROM $table WHERE slug = %s",
			$slug . '-' . $i
		) ) ) {
			$i++;
		}

		return $slug . '-' . $i;
	}

	public function create_output( WP_REST_Request $request ): WP_REST_Response {
		global $wpdb;
		$table = $wpdb->prefix . 'clipisode_outputs';

		$name     = sanitize_text_field( $request->get_param( 'name' ) );
		$topic_id = $request->get_param( 'topic_id' );

		if ( ! $name ) {
			return new WP_REST_Response( [ 'message' => 'Name is required.' ], 400 );
		}

		$slug         = $this->generate_unique_slug( $name );
		$upload_token = wp_generate_password( 32, false );

		$wpdb->insert( $table, [
			'topic_id'     => $topic_id ? (int) $topic_id : null,
			'name'         => $name,
			'slug'         => $slug,
			'upload_token' => $upload_token,
		] );

		return new WP_REST_Response( [
			'id'           => $wpdb->insert_id,
			'name'         => $name,
			'slug'         => $slug,
			'upload_token' => $upload_token,
		], 201 );
	}

	public function delete_output( WP_REST_Request $request ): WP_REST_Response {
		global $wpdb;
		$table = $wpdb->prefix . 'clipisode_outputs';
		$id    = (int) $request['id'];

		$output = $wpdb->get_row( $wpdb->prepare( "SELECT * FROM $table WHERE id = %d", $id ) );
		if ( ! $output ) {
			return new WP_REST_Response( [ 'message' => 'Output not found.' ], 404 );
		}

		if ( $output->attachment_id ) {
			wp_delete_attachment( (int) $output->attachment_id, true );
		}

		$wpdb->delete( $table, [ 'id' => $id ] );

		return new WP_REST_Response( null, 204 );
	}

	public function upload_output( WP_REST_Request $request ): WP_REST_Response {
		global $wpdb;
		$table = $wpdb->prefix . 'clipisode_outputs';
		$id    = (int) $request['id'];
		$token = sanitize_text_field( $request->get_param( 'token' ) );

		$output = $wpdb->get_row( $wpdb->prepare( "SELECT * FROM $table WHERE id = %d", $id ) );
		if ( ! $output ) {
			return new WP_REST_Response( [ 'message' => 'Output not found.' ], 404 );
		}

		if ( ! $token || ! $output->upload_token || ! hash_equals( $output->upload_token, $token ) ) {
			return new WP_REST_Response( [ 'message' => 'Invalid upload token.' ], 403 );
		}

		require_once ABSPATH . 'wp-admin/includes/image.php';
		require_once ABSPATH . 'wp-admin/includes/file.php';
		require_once ABSPATH . 'wp-admin/includes/media.php';

		$files = $request->get_file_params();
		if ( empty( $files['video'] ) ) {
			return new WP_REST_Response( [ 'message' => 'No video file provided.' ], 400 );
		}

		if ( $output->attachment_id ) {
			wp_delete_attachment( (int) $output->attachment_id, true );
		}

		$attachment_id = media_handle_upload( 'video', 0 );
		if ( is_wp_error( $attachment_id ) ) {
			return new WP_REST_Response( [ 'message' => $attachment_id->get_error_message() ], 400 );
		}

		update_post_meta( $attachment_id, Clipisode_Media::META_KEY, '1' );

		$wpdb->update( $table, [
			'attachment_id' => $attachment_id,
			'upload_token'  => null,
		], [ 'id' => $id ] );

		return new WP_REST_Response( [
			'attachment_id' => $attachment_id,
			'url'           => wp_get_attachment_url( $attachment_id ),
		] );
	}

	// --- Invitation Links ---

	public function list_invitation_links( WP_REST_Request $request ): WP_REST_Response {
		global $wpdb;
		$table     = $wpdb->prefix . 'clipisode_invitation_links';
		$clips_tbl = $wpdb->prefix . 'clipisode_clips';
		$topic_id  = (int) $request['topic_id'];

		$links = $wpdb->get_results( $wpdb->prepare( "
			SELECT l.*, COALESCE(cl.clips_count, 0) AS clips_count
			FROM $table l
			LEFT JOIN (SELECT invitation_link_id, COUNT(*) AS clips_count FROM $clips_tbl GROUP BY invitation_link_id) cl ON cl.invitation_link_id = l.id
			WHERE l.topic_id = %d
			ORDER BY l.created_at DESC
		", $topic_id ) );

		return new WP_REST_Response( $links );
	}

	public function create_invitation_link( WP_REST_Request $request ): WP_REST_Response {
		global $wpdb;
		$table = $wpdb->prefix . 'clipisode_invitation_links';

		$slug = $request->get_param( 'slug' );
		if ( ! $slug ) {
			$slug = substr( bin2hex( random_bytes( 3 ) ), 0, 6 );
		}

		$wpdb->insert( $table, [
			'topic_id' => (int) $request['topic_id'],
			'slug'     => sanitize_text_field( $slug ),
			'status'   => 'open',
		] );

		$link = $wpdb->get_row( $wpdb->prepare( "SELECT * FROM $table WHERE id = %d", $wpdb->insert_id ) );
		$link->clips_count = 0;
		return new WP_REST_Response( $link, 201 );
	}

	public function update_invitation_link( WP_REST_Request $request ): WP_REST_Response {
		global $wpdb;
		$table = $wpdb->prefix . 'clipisode_invitation_links';
		$id    = (int) $request['id'];

		$fields = [];
		if ( $request->get_param( 'status' ) !== null ) {
			$fields['status'] = sanitize_text_field( $request->get_param( 'status' ) );
		}

		$wpdb->update( $table, $fields, [ 'id' => $id ] );

		$link = $wpdb->get_row( $wpdb->prepare( "SELECT * FROM $table WHERE id = %d", $id ) );
		return new WP_REST_Response( $link );
	}

	public function delete_invitation_link( WP_REST_Request $request ): WP_REST_Response {
		global $wpdb;
		$id = (int) $request['id'];
		$wpdb->delete( $wpdb->prefix . 'clipisode_invitation_links', [ 'id' => $id ] );
		return new WP_REST_Response( null, 204 );
	}

	// --- Clips ---

	public function list_clips( WP_REST_Request $request ): WP_REST_Response {
		global $wpdb;
		$table     = $wpdb->prefix . 'clipisode_clips';
		$topic_tbl = $wpdb->prefix . 'clipisode_topics';

		$where  = [];
		$values = [];

		$topic_id = $request->get_param( 'topic_id' );
		if ( $topic_id ) {
			$where[]  = 'cl.topic_id = %d';
			$values[] = (int) $topic_id;
		}

		$status = $request->get_param( 'status' );
		if ( $status ) {
			$where[]  = 'cl.status = %s';
			$values[] = sanitize_text_field( $status );
		}

		$tag = $request->get_param( 'tag' );
		if ( $tag ) {
			$where[]  = 'cl.tag = %s';
			$values[] = sanitize_text_field( $tag );
		}

		$where_sql = $where ? 'WHERE ' . implode( ' AND ', $where ) : '';

		$order = $request->get_param( 'order' ) === 'asc' ? 'ASC' : 'DESC';

		$query = "
			SELECT cl.*, t.title AS topic_title
			FROM $table cl
			LEFT JOIN $topic_tbl t ON t.id = cl.topic_id
			$where_sql
			ORDER BY cl.created_at $order
		";

		if ( $values ) {
			$query = $wpdb->prepare( $query, ...$values );
		}

		return new WP_REST_Response( $wpdb->get_results( $query ) );
	}

	public function get_clip( WP_REST_Request $request ): WP_REST_Response {
		global $wpdb;
		$table     = $wpdb->prefix . 'clipisode_clips';
		$topic_tbl = $wpdb->prefix . 'clipisode_topics';
		$id        = (int) $request['id'];

		$clip = $wpdb->get_row( $wpdb->prepare( "
			SELECT cl.*, t.title AS topic_title
			FROM $table cl
			LEFT JOIN $topic_tbl t ON t.id = cl.topic_id
			WHERE cl.id = %d
		", $id ) );

		if ( ! $clip ) {
			return new WP_REST_Response( [ 'message' => 'Clip not found.' ], 404 );
		}

		return new WP_REST_Response( $clip );
	}

	public function update_clip( WP_REST_Request $request ): WP_REST_Response {
		global $wpdb;
		$table = $wpdb->prefix . 'clipisode_clips';
		$id    = (int) $request['id'];

		$fields = [];
		foreach ( [ 'name', 'social_handle', 'social_network', 'tag', 'status' ] as $field ) {
			$val = $request->get_param( $field );
			if ( $val !== null ) {
				$fields[ $field ] = sanitize_text_field( $val );
			}
		}

		$wpdb->update( $table, $fields, [ 'id' => $id ] );

		return $this->get_clip( $request );
	}

	// --- Videos ---

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
			'id'  => $attachment_id,
			'url' => wp_get_attachment_url( $attachment_id ),
		] );
	}

	public function sideload_video( WP_REST_Request $request ): WP_REST_Response {
		require_once ABSPATH . 'wp-admin/includes/image.php';
		require_once ABSPATH . 'wp-admin/includes/file.php';
		require_once ABSPATH . 'wp-admin/includes/media.php';

		$url = esc_url_raw( $request->get_param( 'url' ) );
		if ( ! $url ) {
			return new WP_REST_Response( [ 'message' => 'No URL provided.' ], 400 );
		}

		$tmp = download_url( $url );
		if ( is_wp_error( $tmp ) ) {
			return new WP_REST_Response( [
				'message' => 'Failed to download video: ' . $tmp->get_error_message(),
			], 400 );
		}

		$file_array = [
			'name'     => basename( wp_parse_url( $url, PHP_URL_PATH ) ) ?: 'video.mp4',
			'tmp_name' => $tmp,
		];

		$attachment_id = media_handle_sideload( $file_array, 0 );

		if ( is_wp_error( $attachment_id ) ) {
			@unlink( $tmp );
			return new WP_REST_Response( [ 'message' => $attachment_id->get_error_message() ], 400 );
		}

		update_post_meta( $attachment_id, Clipisode_Media::META_KEY, '1' );

		return new WP_REST_Response( [
			'id'  => $attachment_id,
			'url' => wp_get_attachment_url( $attachment_id ),
		] );
	}

	public function delete_video( WP_REST_Request $request ): WP_REST_Response {
		$id   = (int) $request['id'];
		$meta = get_post_meta( $id, Clipisode_Media::META_KEY, true );

		if ( ! $meta ) {
			return new WP_REST_Response( [ 'message' => 'Not a Clipisode-managed video.' ], 403 );
		}

		wp_delete_attachment( $id, true );

		return new WP_REST_Response( null, 204 );
	}

	// --- Themes (CPT) ---

	public function list_themes( WP_REST_Request $request ): WP_REST_Response {
		global $wpdb;
		$topics_table = $wpdb->prefix . 'clipisode_topics';

		Clipisode_Post_Types::ensure_default_invitation();

		$posts = get_posts( [
			'post_type'   => 'clipisode_invite',
			'post_status' => 'publish',
			'numberposts' => -1,
			'orderby'     => 'date',
			'order'       => 'ASC',
		] );

		$invitations = array_map( function ( $post ) use ( $wpdb, $topics_table ) {
			$topic_count = (int) $wpdb->get_var( $wpdb->prepare(
				"SELECT COUNT(*) FROM $topics_table WHERE invitation_id = %d",
				$post->ID
			) );
			$is_default = (bool) get_post_meta( $post->ID, Clipisode_Post_Types::DEFAULT_INVITATION_META, true );

			return [
				'id'          => $post->ID,
				'title'       => $post->post_title,
				'edit_url'    => get_edit_post_link( $post->ID, 'raw' ),
				'topic_count' => $topic_count,
				'is_default'  => $is_default,
				'created_at'  => $post->post_date,
			];
		}, $posts );

		return new WP_REST_Response( $invitations );
	}

	public function clone_theme( WP_REST_Request $request ): WP_REST_Response {
		$source_id = $request->get_param( 'source_id' );
		$title     = sanitize_text_field( $request->get_param( 'title' ) );

		if ( ! $source_id ) {
			$source_id = Clipisode_Post_Types::ensure_default_invitation();
		}

		$source = get_post( (int) $source_id );
		if ( ! $source || $source->post_type !== 'clipisode_invite' ) {
			return new WP_REST_Response( [ 'message' => 'Source theme not found.' ], 404 );
		}

		$new_id = wp_insert_post( [
			'post_type'    => 'clipisode_invite',
			'post_title'   => $title ?: $source->post_title . ' (Copy)',
			'post_content' => $source->post_content,
			'post_status'  => 'publish',
		] );

		if ( is_wp_error( $new_id ) ) {
			return new WP_REST_Response( [ 'message' => $new_id->get_error_message() ], 400 );
		}

		return new WP_REST_Response( [
			'id'       => $new_id,
			'title'    => get_the_title( $new_id ),
			'edit_url' => get_edit_post_link( $new_id, 'raw' ),
		], 201 );
	}

	public function delete_theme( WP_REST_Request $request ): WP_REST_Response {
		global $wpdb;
		$id = (int) $request['id'];

		$is_default = get_post_meta( $id, Clipisode_Post_Types::DEFAULT_INVITATION_META, true );
		if ( $is_default ) {
			return new WP_REST_Response( [ 'message' => 'Cannot delete the default theme.' ], 403 );
		}

		$topics_table = $wpdb->prefix . 'clipisode_topics';
		$in_use = (int) $wpdb->get_var( $wpdb->prepare(
			"SELECT COUNT(*) FROM $topics_table WHERE invitation_id = %d",
			$id
		) );

		if ( $in_use > 0 ) {
			return new WP_REST_Response( [
				'message' => "Cannot delete: $in_use topic(s) still use this theme.",
			], 409 );
		}

		wp_delete_post( $id, true );

		return new WP_REST_Response( null, 204 );
	}
}
