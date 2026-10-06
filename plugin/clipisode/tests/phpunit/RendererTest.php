<?php

use PHPUnit\Framework\TestCase;

require_once __DIR__ . '/CompositionTest.php';

class RendererTest extends TestCase {
	private Clipisode_REST_API $api;

	protected function setUp(): void {
		global $wpdb, $test_options, $test_attachment_urls, $test_http_requests, $test_http_response, $test_upload_result, $test_deleted_attachments;
		if ( 'test_browser_export_works_without_external_renderer_configuration' !== $this->getName( false ) && ! defined( 'CLIPISODE_RENDERER_URL' ) ) {
			define( 'CLIPISODE_RENDERER_URL', 'http://127.0.0.1:63483' );
			define( 'CLIPISODE_RENDERER_TOKEN', 'unit-test-renderer-token' );
		}
		$wpdb = new RendererTestDatabase();
		$test_options = [];
		$test_attachment_urls = [ 20 => 'https://example.com/source.mp4?fresh=1', 51 => 'https://example.com/previous.mp4', 1001 => 'https://example.com/render.mp4' ];
		$test_http_requests = [];
		$test_http_response = self::remote( 'queued' );
		$test_upload_result = 1001;
		$test_deleted_attachments = [];
		$wpdb->outputs[1] = [
			'id' => 1, 'name' => 'Saved output', 'slug' => 'saved-output', 'topic_id' => null,
			'created_at' => '2026-10-06 12:00:00', 'media_id' => 50, 'upload_token' => null,
			'composition' => wp_json_encode( Clipisode_Composition::sanitize( CompositionTest::composition() ) ),
		];
		$this->api = new Clipisode_REST_API();
		$directory = ABSPATH . 'wp-admin/includes';
		if ( ! is_dir( $directory ) ) {
			mkdir( $directory, 0777, true );
		}
		foreach ( [ 'image', 'file', 'media' ] as $file ) {
			if ( ! file_exists( "$directory/$file.php" ) ) {
				file_put_contents( "$directory/$file.php", '<?php' );
			}
		}
	}

	private static function remote( string $status, float $progress = 0 ): array {
		return [ 'response' => [ 'code' => 200 ], 'body' => json_encode( [ 'id' => 'render-1', 'status' => $status, 'progress' => $progress, 'error' => null ] ) ];
	}

	private function request( array $params = [] ): WP_REST_Request {
		$request = new WP_REST_Request();
		foreach ( array_merge( [ 'id' => 1 ], $params ) as $key => $value ) {
			$request->set_param( $key, $value );
		}
		return $request;
	}

	private function upload_request(): WP_REST_Request {
		global $wpdb;
		$request = $this->request( [ 'token' => $wpdb->outputs[1]['upload_token'] ] );
		$request->set_file_params( [ 'video' => [ 'name' => 'render.mp4' ] ] );
		return $request;
	}

	public function test_render_dispatches_saved_composition_with_authorized_callback_and_fresh_urls(): void {
		global $wpdb, $test_http_requests;
		$response = $this->api->render_output( $this->request( [ 'composition' => [ 'untrusted' => true ] ] ) );
		$this->assertSame( 202, $response->get_status() );
		$this->assertSame( 'queued', $response->get_data()['status'] );
		$request = $test_http_requests[0];
		$this->assertSame( 'Bearer unit-test-renderer-token', $request['args']['headers']['Authorization'] );
		$body = json_decode( $request['args']['body'], true );
		$this->assertSame( 1, $body['outputId'] );
		$this->assertSame( 'https://example.com/source.mp4?fresh=1', $body['composition']['clips'][0]['url'] );
		$this->assertStringContainsString( '/outputs/1/upload?token=' . $wpdb->outputs[1]['upload_token'], $body['callbackUrl'] );
		$this->assertSame( 50, $wpdb->outputs[1]['media_id'] );
		$this->assertArrayNotHasKey( 'composition_hash', $response->get_data() );
	}

	public function test_unreachable_renderer_rolls_back_upload_authorization(): void {
		global $wpdb, $test_http_response;
		$test_http_response = new WP_Error( 'http_error', 'Connection refused' );
		$response = $this->api->render_output( $this->request() );
		$this->assertSame( 503, $response->get_status() );
		$this->assertNull( $wpdb->outputs[1]['upload_token'] );
		$this->assertNull( Clipisode_Renderer::job( 1 ) );
		$this->assertSame( 50, $wpdb->outputs[1]['media_id'] );
	}

	public function test_active_render_blocks_duplicate_render_save_and_delete(): void {
		$this->api->render_output( $this->request() );
		$this->assertSame( 409, $this->api->render_output( $this->request() )->get_status() );
		$this->assertSame( 409, $this->api->update_output( $this->request( [ 'name' => 'Changed', 'composition' => CompositionTest::composition() ] ) )->get_status() );
		$this->assertSame( 409, $this->api->delete_output( $this->request() )->get_status() );
	}

	public function test_idle_status_retains_previous_render_url(): void {
		$data = $this->api->get_output_render( $this->request() )->get_data();
		$this->assertSame( 'idle', $data['status'] );
		$this->assertNull( $data['id'] );
		$this->assertSame( 'https://example.com/previous.mp4', $data['url'] );
	}

	public function test_status_tracks_progress_and_worker_restart_reports_missing_job(): void {
		global $test_http_response;
		$this->api->render_output( $this->request() );
		$test_http_response = self::remote( 'rendering', 0.45 );
		$this->assertSame( 0.45, $this->api->get_output_render( $this->request() )->get_data()['progress'] );
		$test_http_response = [ 'response' => [ 'code' => 404 ], 'body' => '{}' ];
		$data = $this->api->get_output_render( $this->request() )->get_data();
		$this->assertSame( 'error', $data['status'] );
		$this->assertStringContainsString( 'no longer has this job', $data['error'] );
		$this->assertFalse( Clipisode_Renderer::is_active( 1 ) );
	}

	public function test_failed_status_poll_keeps_active_job_and_does_not_start_another(): void {
		global $test_http_response, $test_http_requests;
		$this->api->render_output( $this->request() );
		$test_http_response = new WP_Error( 'http_error', 'Temporary disconnect' );
		$this->assertSame( 503, $this->api->get_output_render( $this->request() )->get_status() );
		$this->assertTrue( Clipisode_Renderer::is_active( 1 ) );
		$this->assertCount( 2, $test_http_requests );
		$this->assertSame( 'GET', $test_http_requests[1]['args']['method'] );
	}

	public function test_upload_rejects_changed_composition_without_replacing_existing_video(): void {
		global $wpdb, $test_deleted_attachments;
		$this->api->render_output( $this->request() );
		$composition = json_decode( $wpdb->outputs[1]['composition'], true );
		$composition['settings']['title'] = 'Changed by another writer';
		$wpdb->outputs[1]['composition'] = wp_json_encode( $composition );
		$response = $this->api->upload_output( $this->upload_request() );
		$this->assertSame( 409, $response->get_status() );
		$this->assertSame( 50, $wpdb->outputs[1]['media_id'] );
		$this->assertSame( [], $test_deleted_attachments );
	}

	public function test_failed_upload_keeps_previous_video_and_authorization(): void {
		global $wpdb, $test_upload_result, $test_deleted_attachments;
		$this->api->render_output( $this->request() );
		$test_upload_result = new WP_Error( 'upload_failed', 'Storage full' );
		$response = $this->api->upload_output( $this->upload_request() );
		$this->assertSame( 400, $response->get_status() );
		$this->assertSame( 50, $wpdb->outputs[1]['media_id'] );
		$this->assertNotNull( $wpdb->outputs[1]['upload_token'] );
		$this->assertSame( [], $test_deleted_attachments );
	}

	public function test_successful_upload_replaces_video_and_persists_completion_without_worker(): void {
		global $wpdb, $test_http_requests, $test_deleted_attachments;
		$this->api->render_output( $this->request() );
		$request = $this->upload_request();
		$response = $this->api->upload_output( $request );
		$this->assertSame( 200, $response->get_status() );
		$this->assertSame( 1000, $wpdb->outputs[1]['media_id'] );
		$this->assertNull( $wpdb->outputs[1]['upload_token'] );
		$this->assertSame( [ 51 ], $test_deleted_attachments );
		$status = $this->api->get_output_render( $this->request() )->get_data();
		$this->assertSame( 'done', $status['status'] );
		$this->assertSame( 'https://example.com/render.mp4', $status['url'] );
		$this->assertCount( 1, $test_http_requests );
		$this->assertSame( 403, $this->api->upload_output( $request )->get_status() );
	}

	public function test_replacing_render_preserves_previous_media_if_used_elsewhere(): void {
		global $wpdb, $test_deleted_attachments;
		$wpdb->referenced_media = [ 50 ];
		$this->api->render_output( $this->request() );
		$this->assertSame( 200, $this->api->upload_output( $this->upload_request() )->get_status() );
		$this->assertSame( [], $test_deleted_attachments );
		$this->assertArrayHasKey( 50, $wpdb->media );
	}

	public function test_failed_commit_keeps_old_video_and_job_state(): void {
		global $wpdb, $test_deleted_attachments;
		$this->api->render_output( $this->request() );
		$wpdb->fail_statement = 'COMMIT';
		$response = $this->api->upload_output( $this->upload_request() );
		$this->assertSame( 500, $response->get_status() );
		$this->assertSame( 50, $wpdb->outputs[1]['media_id'] );
		$this->assertNotContains( 51, $test_deleted_attachments );
		$this->assertSame( 'queued', Clipisode_Renderer::job( 1 )['status'] );
	}

	public function test_callback_completion_wins_over_in_flight_status(): void {
		global $test_http_response;
		$this->api->render_output( $this->request() );
		$test_http_response = function () {
			$this->api->upload_output( $this->upload_request() );
			return self::remote( 'uploading', 0.99 );
		};
		$data = $this->api->get_output_render( $this->request() )->get_data();
		$this->assertSame( 'done', $data['status'] );
	}

	public function test_invalid_worker_response_cannot_authorize_an_upload(): void {
		global $wpdb, $test_http_response;
		$test_http_response = [ 'response' => [ 'code' => 202 ], 'body' => '{"id":"job","status":"queued","progress":2,"error":null}' ];
		$this->assertSame( 503, $this->api->render_output( $this->request() )->get_status() );
		$this->assertNull( $wpdb->outputs[1]['upload_token'] );
		$this->assertNull( Clipisode_Renderer::job( 1 ) );
	}

	public function test_start_commit_failure_does_not_leave_an_authorized_or_active_job(): void {
		global $wpdb;
		$wpdb->fail_statement = 'COMMIT';
		$this->assertSame( 500, $this->api->render_output( $this->request() )->get_status() );
		$this->assertNull( $wpdb->outputs[1]['upload_token'] );
		$this->assertFalse( Clipisode_Renderer::is_active( 1 ) );
	}

	public function test_worker_done_without_upload_is_not_reported_as_success(): void {
		global $test_http_response, $wpdb;
		$this->api->render_output( $this->request() );
		$test_http_response = self::remote( 'done', 1 );
		$this->assertSame( 502, $this->api->get_output_render( $this->request() )->get_status() );
		$this->assertSame( 50, $wpdb->outputs[1]['media_id'] );
	}

	public function test_wrong_upload_token_preserves_previous_render(): void {
		global $wpdb, $test_deleted_attachments;
		$this->api->render_output( $this->request() );
		$request = $this->upload_request();
		$request->set_param( 'token', 'wrong-token' );
		$this->assertSame( 403, $this->api->upload_output( $request )->get_status() );
		$this->assertSame( 50, $wpdb->outputs[1]['media_id'] );
		$this->assertSame( [], $test_deleted_attachments );
	}

	public function test_completion_between_status_reads_returns_new_video_url(): void {
		global $wpdb;
		$this->api->render_output( $this->request() );
		$wpdb->after_output_read = function () {
			$this->api->upload_output( $this->upload_request() );
		};
		$data = $this->api->get_output_render( $this->request() )->get_data();
		$this->assertSame( 'done', $data['status'] );
		$this->assertSame( 'https://example.com/render.mp4', $data['url'] );
	}

	public function test_topic_with_active_render_cannot_delete_render_sources(): void {
		global $wpdb, $test_deleted_attachments;
		$wpdb->outputs[1]['topic_id'] = 3;
		$this->api->render_output( $this->request() );
		$this->assertSame( 409, $this->api->delete_topic( $this->request( [ 'id' => 3 ] ) )->get_status() );
		$this->assertSame( [], $test_deleted_attachments );
		$this->assertArrayHasKey( 1, $wpdb->outputs );
	}

	private function browser_upload_request(): WP_REST_Request {
		global $wpdb;
		$request = $this->request( [ 'composition_hash' => hash( 'sha256', $wpdb->outputs[1]['composition'] ) ] );
		$request->set_file_params( [ 'video' => [ 'name' => 'browser-export.mp4' ] ] );
		return $request;
	}

	public function test_output_response_exposes_exact_saved_composition_hash(): void {
		global $wpdb;
		$data = $this->api->get_output( $this->request() )->get_data();
		$this->assertSame( hash( 'sha256', $wpdb->outputs[1]['composition'] ), $data['composition_hash'] );
	}

	public function test_browser_upload_publishes_video_without_starting_server_render(): void {
		global $wpdb, $test_http_requests;
		$response = $this->api->upload_browser_output( $this->browser_upload_request() );
		$this->assertSame( 200, $response->get_status() );
		$this->assertSame( [ 'id' => 1000, 'url' => 'https://example.com/render.mp4' ], $response->get_data() );
		$this->assertSame( 1000, $wpdb->outputs[1]['media_id'] );
		$this->assertFalse( Clipisode_Renderer::is_active( 1 ) );
		$status = $this->api->get_output_render( $this->request() )->get_data();
		$this->assertSame( 'done', $status['status'] );
		$this->assertSame( 'https://example.com/render.mp4', $status['url'] );
		$this->assertTrue( $status['external_available'] );
		$this->assertSame( [], $test_http_requests );
	}

	/**
	 * @runInSeparateProcess
	 * @preserveGlobalState disabled
	 */
	public function test_browser_export_works_without_external_renderer_configuration(): void {
		global $test_http_requests;
		$this->assertFalse( defined( 'CLIPISODE_RENDERER_URL' ) );
		$this->assertFalse( $this->api->get_output_render( $this->request() )->get_data()['external_available'] );
		$this->assertSame( 200, $this->api->upload_browser_output( $this->browser_upload_request() )->get_status() );
		$status = $this->api->get_output_render( $this->request() )->get_data();
		$this->assertSame( 'done', $status['status'] );
		$this->assertFalse( $status['external_available'] );
		$this->assertSame( [], $test_http_requests );
	}

	public function test_browser_upload_rejects_stale_saved_composition(): void {
		global $wpdb, $test_deleted_attachments;
		$request = $this->browser_upload_request();
		$composition = json_decode( $wpdb->outputs[1]['composition'], true );
		$composition['settings']['title'] = 'A newer save';
		$wpdb->outputs[1]['composition'] = wp_json_encode( $composition );
		$this->assertSame( 409, $this->api->upload_browser_output( $request )->get_status() );
		$this->assertSame( 50, $wpdb->outputs[1]['media_id'] );
		$this->assertSame( [], $test_deleted_attachments );
		$this->assertNull( Clipisode_Renderer::job( 1 ) );
	}

	public function test_browser_upload_rejects_active_server_render_without_changing_it(): void {
		global $wpdb;
		$this->api->render_output( $this->request() );
		$job = Clipisode_Renderer::job( 1 );
		$this->assertSame( 409, $this->api->upload_browser_output( $this->browser_upload_request() )->get_status() );
		$this->assertSame( $job, Clipisode_Renderer::job( 1 ) );
		$this->assertSame( 50, $wpdb->outputs[1]['media_id'] );
	}

	public function test_browser_upload_requires_saved_hash_and_file(): void {
		$this->assertSame( 400, $this->api->upload_browser_output( $this->request() )->get_status() );
		$request = $this->browser_upload_request();
		$request->set_file_params( [] );
		$this->assertSame( 400, $this->api->upload_browser_output( $request )->get_status() );
		$this->assertFalse( Clipisode_Renderer::is_active( 1 ) );
	}

	public function test_browser_upload_failure_preserves_previous_render_without_active_job(): void {
		global $wpdb, $test_upload_result, $test_deleted_attachments;
		$test_upload_result = new WP_Error( 'upload_failed', 'Storage full' );
		$this->assertSame( 400, $this->api->upload_browser_output( $this->browser_upload_request() )->get_status() );
		$this->assertSame( 50, $wpdb->outputs[1]['media_id'] );
		$this->assertSame( [], $test_deleted_attachments );
		$this->assertNull( Clipisode_Renderer::job( 1 ) );
	}

	public function test_browser_media_insert_failure_keeps_old_output_and_deletes_new_attachment(): void {
		global $wpdb, $test_deleted_attachments;
		$original_output = $wpdb->outputs[1];
		$wpdb->fail_media_insert = true;
		$response = $this->api->upload_browser_output( $this->browser_upload_request() );
		$this->assertSame( 400, $response->get_status() );
		$this->assertSame( 'The uploaded media could not be saved.', $response->get_data()['message'] );
		$this->assertSame( $original_output, $wpdb->outputs[1] );
		$this->assertSame( [ 1001 ], $test_deleted_attachments );
		$this->assertArrayHasKey( 50, $wpdb->media );
		$this->assertNull( Clipisode_Renderer::job( 1 ) );
	}

	public function test_browser_upload_commit_failure_preserves_previous_render_and_status(): void {
		global $wpdb, $test_deleted_attachments;
		$wpdb->fail_statement = 'COMMIT';
		$this->assertSame( 500, $this->api->upload_browser_output( $this->browser_upload_request() )->get_status() );
		$this->assertSame( 50, $wpdb->outputs[1]['media_id'] );
		$this->assertNotContains( 51, $test_deleted_attachments );
		$this->assertNull( Clipisode_Renderer::job( 1 ) );
	}

	public function test_browser_replacement_preserves_media_referenced_by_another_composition(): void {
		global $wpdb, $test_deleted_attachments;
		$wpdb->referenced_media = [ 50 ];
		$this->assertSame( 200, $this->api->upload_browser_output( $this->browser_upload_request() )->get_status() );
		$this->assertSame( [], $test_deleted_attachments );
	}

	public function test_browser_export_route_requires_administrator_permissions(): void {
		global $wp_rest_routes;
		$this->api->register_routes();
		$route = $wp_rest_routes['clipisode/v1']['/outputs/(?P<id>\d+)/browser-render'];
		$this->assertSame( 'POST', $route[0]['methods'] );
		$this->assertSame( [ $this->api, 'check_permission' ], $route[0]['permission_callback'] );
	}

	public function test_render_routes_require_administrator_permissions(): void {
		global $wp_rest_routes;
		$this->api->register_routes();
		foreach ( $wp_rest_routes['clipisode/v1']['/outputs/(?P<id>\d+)/render'] as $endpoint ) {
			$this->assertSame( [ $this->api, 'check_permission' ], $endpoint['permission_callback'] );
		}
	}
}

class RendererTestDatabase extends CompositionTestDatabase {
	public array $media = [ 50 => [ 'id' => 50, 'type' => 'video', 'mime_type' => 'video/mp4', 'storage' => 'local', 'attachment_id' => 51 ] ];
	public array $referenced_media = [];
	public bool $fail_media_insert = false;
	public $after_output_read = null;
	private array $render_snapshot = [];

	public function get_row( string $sql ): ?object {
		if ( str_contains( $sql, 'clipisode_media' ) ) {
			preg_match( '/WHERE id = (\d+)/', $sql, $matches );
			$id = (int) ( $matches[1] ?? 0 );
			if ( isset( $this->media[ $id ] ) ) {
				return (object) $this->media[ $id ];
			}
		}
		$result = parent::get_row( $sql );
		if ( $this->after_output_read && str_contains( $sql, 'clipisode_outputs' ) ) {
			$callback = $this->after_output_read;
			$this->after_output_read = null;
			$callback();
		}
		return $result;
	}
	public function get_var( string $sql ): mixed {
		if ( str_contains( $sql, 'UNION SELECT' ) ) {
			preg_match( '/media_id = (\d+)/', $sql, $matches );
			return in_array( (int) $matches[1], $this->referenced_media, true ) ? 2 : null;
		}
		return parent::get_var( $sql );
	}
	public function get_col( string $sql ): array {
		if ( str_contains( $sql, 'SELECT id FROM wp_clipisode_outputs WHERE topic_id = 3' ) ) {
			return [ 1 ];
		}
		return [];
	}
	public function insert( string $table, array $data ): int|false {
		if ( str_ends_with( $table, 'clipisode_media' ) ) {
			if ( $this->fail_media_insert ) {
				$this->insert_id = 0;
				return false;
			}
			$this->insert_id = 1000;
			$this->media[1000] = array_merge( $data, [ 'id' => 1000, 'storage' => 'local' ] );
			return 1;
		}
		return parent::insert( $table, $data );
	}
	public function delete( string $table, array $where ): int {
		if ( str_ends_with( $table, 'clipisode_media' ) ) {
			unset( $this->media[ $where['id'] ] );
			return 1;
		}
		return parent::delete( $table, $where );
	}
	public function query( string $sql ): int|false {
		global $test_options;
		if ( 'START TRANSACTION' === $sql ) {
			$this->render_snapshot = [ $this->media, $test_options ];
		} elseif ( 'ROLLBACK' === $sql ) {
			[ $this->media, $test_options ] = $this->render_snapshot;
		}
		return parent::query( $sql );
	}
}
