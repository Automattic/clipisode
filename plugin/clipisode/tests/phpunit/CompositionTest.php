<?php

use PHPUnit\Framework\TestCase;

class CompositionTest extends TestCase {
	private Clipisode_REST_API $api;

	protected function setUp(): void {
		global $wpdb, $test_attachment_urls, $test_options;
		$test_options = [];
		$wpdb = new CompositionTestDatabase();
		$test_attachment_urls = [ 20 => 'https://example.com/source.mp4?token=first' ];
		$this->api = new Clipisode_REST_API();
	}

	public static function composition(): array {
		return [
			'settings' => [
				'themeId' => 'wpvip', 'format' => 'portrait', 'title' => 'Our story',
				'subtitle' => 'From the community', 'endingText' => 'Thank you',
				'accentColor' => '#AABBCC', 'backgroundColor' => '#112233', 'textColor' => '#ffffff',
				'fontFamily' => 'sans', 'logoUrl' => 'https://example.com/logo.png',
				'showNames' => true, 'showTitle' => true, 'showEnding' => false,
				'titleDuration' => 3, 'endingDuration' => 2, 'videoFit' => 'cover',
			],
			'clips' => [ [
				'id' => 'reply-1', 'mediaId' => 10, 'role' => 'reply', 'name' => '<b>Casey</b>',
				'url' => 'https://untrusted.example/other.mp4', 'duration' => 10,
				'trimStart' => 1.5, 'trimEnd' => 8.25, 'included' => true,
			] ],
		];
	}

	private function request( array $params ): WP_REST_Request {
		$request = new WP_REST_Request();
		foreach ( $params as $key => $value ) {
			$request->set_param( $key, $value );
		}
		return $request;
	}

	public function test_create_and_reload_preserve_edits_and_refresh_media_urls(): void {
		global $wpdb, $test_attachment_urls;
		$response = $this->api->create_output( $this->request( [
			'name' => '<b>Community video</b>', 'topic_id' => null, 'composition' => self::composition(),
		] ) );
		$this->assertSame( 201, $response->get_status() );
		$data = $response->get_data();
		$this->assertSame( 'Community video', $data['name'] );
		$this->assertSame( 'Casey', $data['composition']['clips'][0]['name'] );
		$this->assertSame( '#aabbcc', $data['composition']['settings']['accentColor'] );
		$this->assertSame( 1.5, $data['composition']['clips'][0]['trimStart'] );
		$this->assertSame( $test_attachment_urls[20], $data['composition']['clips'][0]['url'] );
		$stored = json_decode( $wpdb->outputs[ $data['id'] ]['composition'], true );
		$this->assertArrayNotHasKey( 'url', $stored['clips'][0] );
		$this->assertArrayNotHasKey( 'upload_token', $wpdb->outputs[ $data['id'] ] );
		$this->assertCount( 1, $wpdb->contents );
		$test_attachment_urls[20] = 'https://example.com/source.mp4?token=refreshed';
		$reloaded = $this->api->get_output( $this->request( [ 'id' => $data['id'] ] ) )->get_data();
		$this->assertSame( $test_attachment_urls[20], $reloaded['composition']['clips'][0]['url'] );
	}

	public function test_update_replaces_source_references_and_preserves_order_and_inclusion(): void {
		global $wpdb;
		$created = $this->api->create_output( $this->request( [ 'name' => 'First', 'composition' => self::composition() ] ) )->get_data();
		$composition = self::composition();
		$composition['clips'][] = array_merge( $composition['clips'][0], [ 'id' => 'intro-1', 'role' => 'intro', 'included' => false ] );
		$composition['clips'] = array_reverse( $composition['clips'] );
		$response = $this->api->update_output( $this->request( [ 'id' => $created['id'], 'name' => 'Edited', 'topic_id' => 3, 'composition' => $composition ] ) );
		$this->assertSame( 200, $response->get_status() );
		$data = $response->get_data();
		$this->assertSame( 'Edited', $data['name'] );
		$this->assertSame( 3, $data['topic_id'] );
		$this->assertSame( [ 'intro-1', 'reply-1' ], array_column( $data['composition']['clips'], 'id' ) );
		$this->assertFalse( $data['composition']['clips'][0]['included'] );
		$this->assertCount( 2, $wpdb->contents );
		$this->assertSame( [ 0, 1 ], array_column( $wpdb->contents, 'position' ) );
		$list = $this->api->list_outputs( $this->request( [] ) )->get_data();
		$this->assertSame( 1, $list[0]['clips_count'] );
		$this->assertTrue( $list[0]['has_composition'] );
	}

	/** @dataProvider invalid_compositions */
	public function test_invalid_composition_does_not_write_data( string $section, string $key, mixed $value ): void {
		global $wpdb;
		$composition = self::composition();
		if ( 'clip' === $section ) {
			$composition['clips'][0][ $key ] = $value;
		} else {
			$composition['settings'][ $key ] = $value;
		}
		$response = $this->api->create_output( $this->request( [ 'name' => 'Invalid', 'composition' => $composition ] ) );
		$this->assertSame( 400, $response->get_status() );
		$this->assertSame( [], $wpdb->outputs );
		$this->assertSame( [], $wpdb->contents );
	}

	public static function invalid_compositions(): array {
		return [
			'unknown theme' => [ 'settings', 'themeId', 'native' ],
			'invalid color' => [ 'settings', 'accentColor', 'red; color: black' ],
			'invalid boolean' => [ 'settings', 'showNames', 'false' ],
			'invalid logo scheme' => [ 'settings', 'logoUrl', 'javascript:alert(1)' ],
			'non-finite duration' => [ 'settings', 'titleDuration', INF ],
			'sub-frame card' => [ 'settings', 'titleDuration', 0.001 ],
			'sub-frame trim' => [ 'clip', 'trimEnd', 1.501 ],
			'missing media' => [ 'clip', 'mediaId', 999 ],
			'non-video media' => [ 'clip', 'mediaId', 11 ],
			'negative trim' => [ 'clip', 'trimStart', -1 ],
			'empty trim' => [ 'clip', 'trimEnd', 1.5 ],
			'trim past source' => [ 'clip', 'trimEnd', 20 ],
			'numeric string' => [ 'clip', 'duration', '10' ],
		];
	}

	public function test_missing_source_on_reload_reports_actionable_error(): void {
		global $test_attachment_urls;
		$created = $this->api->create_output( $this->request( [ 'name' => 'Saved', 'composition' => self::composition() ] ) )->get_data();
		$test_attachment_urls = [];
		$response = $this->api->get_output( $this->request( [ 'id' => $created['id'] ] ) );
		$this->assertSame( 409, $response->get_status() );
		$this->assertStringContainsString( 'no longer available', $response->get_data()['message'] );
	}

	public function test_failed_source_reference_write_rolls_back_composition_update(): void {
		global $wpdb;
		$created = $this->api->create_output( $this->request( [ 'name' => 'Original', 'composition' => self::composition() ] ) )->get_data();
		$original = $wpdb->outputs;
		$references = $wpdb->contents;
		$wpdb->fail_contents = true;
		$response = $this->api->update_output( $this->request( [ 'id' => $created['id'], 'name' => 'Changed', 'composition' => self::composition() ] ) );
		$this->assertSame( 500, $response->get_status() );
		$this->assertSame( $original, $wpdb->outputs );
		$this->assertSame( $references, $wpdb->contents );
	}

	/** @dataProvider failed_transaction_statements */
	public function test_failed_transaction_does_not_report_saved_or_leave_changes( string $statement ): void {
		global $wpdb;
		$created = $this->api->create_output( $this->request( [ 'name' => 'Original', 'composition' => self::composition() ] ) )->get_data();
		$original = $wpdb->outputs;
		$references = $wpdb->contents;
		$wpdb->fail_statement = $statement;
		$response = $this->api->update_output( $this->request( [ 'id' => $created['id'], 'name' => 'Changed', 'composition' => self::composition() ] ) );
		$this->assertSame( 500, $response->get_status() );
		$this->assertSame( $original, $wpdb->outputs );
		$this->assertSame( $references, $wpdb->contents );
	}

	public static function failed_transaction_statements(): array {
		return [ [ 'START TRANSACTION' ], [ 'COMMIT' ] ];
	}

	public function test_empty_timeline_is_rejected_but_title_only_composition_can_play(): void {
		$composition = self::composition();
		$composition['clips'] = [];
		$this->assertIsArray( Clipisode_Composition::sanitize( $composition ) );
		$composition['settings'] = [ 'themeId' => 'none', 'format' => 'portrait', 'videoFit' => 'cover' ];
		$this->assertInstanceOf( WP_Error::class, Clipisode_Composition::sanitize( $composition ) );
	}

	public function test_one_frame_trim_can_be_saved(): void {
		$composition = self::composition();
		$composition['clips'][0]['trimEnd'] = 1.5 + 1 / 30;
		$this->assertIsArray( Clipisode_Composition::sanitize( $composition ) );
	}

	public function test_excluded_clip_source_cannot_be_deleted_until_draft_is_deleted(): void {
		global $wpdb;
		$composition = self::composition();
		$composition['clips'][0]['included'] = false;
		$created = $this->api->create_output( $this->request( [ 'name' => 'Saved', 'composition' => $composition ] ) )->get_data();
		$this->assertSame( 409, $this->api->delete_video( $this->request( [ 'id' => 10 ] ) )->get_status() );
		$this->assertSame( 409, $this->api->delete_media_asset( $this->request( [ 'id' => 10 ] ) )->get_status() );
		$this->assertSame( 204, $this->api->delete_output( $this->request( [ 'id' => $created['id'] ] ) )->get_status() );
		$this->assertSame( [], $wpdb->contents );
		$this->assertSame( [], $wpdb->outputs );
	}

	public function test_composition_source_references_cannot_be_changed_through_contents_endpoint(): void {
		$created = $this->api->create_output( $this->request( [ 'name' => 'Saved', 'composition' => self::composition() ] ) )->get_data();
		$response = $this->api->create_output_contents( $this->request( [ 'id' => $created['id'], 'contents' => [] ] ) );
		$this->assertSame( 409, $response->get_status() );
	}

	public function test_duplicate_clip_ids_are_rejected(): void {
		$composition = self::composition();
		$composition['clips'][] = $composition['clips'][0];
		$this->assertInstanceOf( WP_Error::class, Clipisode_Composition::sanitize( $composition ) );
	}

	public function test_creation_requires_a_composition(): void {
		$response = $this->api->create_output( $this->request( [ 'name' => 'Video' ] ) );
		$this->assertSame( 400, $response->get_status() );
	}

	public function test_edit_routes_require_admin_permission(): void {
		global $wp_rest_routes;
		$this->api->register_routes();
		foreach ( [ '/outputs', '/outputs/(?P<id>\\d+)' ] as $route ) {
			foreach ( $wp_rest_routes['clipisode/v1'][ $route ] as $endpoint ) {
				$this->assertSame( [ $this->api, 'check_permission' ], $endpoint['permission_callback'] );
			}
		}
	}
}

class CompositionTestDatabase {
	public string $prefix = 'wp_';
	public int $insert_id = 0;
	public array $outputs = [];
	public array $contents = [];
	public bool $fail_contents = false;
	public string $fail_statement = '';
	private array $snapshot = [];

	public function prepare( string $sql, mixed ...$args ): string {
		return vsprintf( str_replace( '%s', "'%s'", $sql ), $args );
	}
	public function get_row( string $sql ): ?object {
		preg_match( '/WHERE id = (\d+)/', $sql, $matches );
		$id = (int) ( $matches[1] ?? 0 );
		if ( str_contains( $sql, 'clipisode_media' ) ) {
			return match ( $id ) {
				10 => (object) [ 'type' => 'video', 'mime_type' => 'video/mp4', 'storage' => 'local', 'attachment_id' => 20 ],
				11 => (object) [ 'type' => 'photo', 'mime_type' => 'image/png' ],
				default => null,
			};
		}
		return isset( $this->outputs[ $id ] ) ? (object) $this->outputs[ $id ] : null;
	}
	public function get_var( string $sql ): mixed {
		if ( str_contains( $sql, 'SELECT c.output_id' ) ) {
			preg_match( '/c.media_id = (\d+)/', $sql, $matches );
			foreach ( $this->contents as $row ) {
				if ( $row['media_id'] === (int) ( $matches[1] ?? 0 ) ) {
					return $row['output_id'];
				}
			}
		}
		if ( str_contains( $sql, 'clipisode_contents WHERE media_id' ) ) {
			preg_match( '/clipisode_contents WHERE media_id = (\d+)/', $sql, $matches );
			foreach ( $this->contents as $row ) {
				if ( $row['media_id'] === (int) ( $matches[1] ?? 0 ) ) {
					return $row['output_id'];
				}
			}
		}
		if ( str_contains( $sql, 'clipisode_outputs WHERE id' ) ) {
			preg_match( '/WHERE id = (\d+)/', $sql, $matches );
			return isset( $this->outputs[ (int) $matches[1] ] ) ? (int) $matches[1] : null;
		}
		return str_contains( $sql, 'clipisode_topics WHERE id = 3' ) ? 3 : null;
	}
	public function get_results( string $sql ): array {
		return array_map( fn( $row ) => (object) $row, array_values( $this->outputs ) );
	}
	public function insert( string $table, array $data ): int|false {
		if ( str_ends_with( $table, 'clipisode_outputs' ) ) {
			$this->insert_id++;
			$this->outputs[ $this->insert_id ] = array_merge( [ 'id' => $this->insert_id, 'created_at' => '2026-10-05 12:00:00', 'media_id' => null ], $data );
		} else {
			if ( $this->fail_contents ) {
				return false;
			}
			$this->contents[] = $data;
		}
		return 1;
	}
	public function update( string $table, array $data, array $where ): int {
		$this->outputs[ $where['id'] ] = array_merge( $this->outputs[ $where['id'] ], $data );
		return 1;
	}
	public function delete( string $table, array $where ): int {
		if ( str_ends_with( $table, 'clipisode_contents' ) ) {
			$this->contents = array_values( array_filter( $this->contents, fn( $row ) => $row['output_id'] !== $where['output_id'] ) );
		} else {
			unset( $this->outputs[ $where['id'] ] );
		}
		return 1;
	}
	public function query( string $sql ): int|false {
		if ( $this->fail_statement === $sql ) {
			return false;
		}
		if ( 'START TRANSACTION' === $sql ) {
			$this->snapshot = [ $this->outputs, $this->contents ];
		} elseif ( 'ROLLBACK' === $sql ) {
			[ $this->outputs, $this->contents ] = $this->snapshot;
		}
		return 1;
	}
}
