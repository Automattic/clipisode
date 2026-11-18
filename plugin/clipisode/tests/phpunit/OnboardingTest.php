<?php

use PHPUnit\Framework\TestCase;

require_once CLIPISODE_PLUGIN_DIR . 'includes/class-onboarding.php';
require_once CLIPISODE_PLUGIN_DIR . 'includes/class-preview.php';

function get_current_user_id(): int { global $onboarding_user; return $onboarding_user; }
function get_user_meta( int $user, string $key, bool $single = false ) { global $onboarding_meta; return $onboarding_meta[$user][$key] ?? ''; }
function update_user_option( int $user, string $key, $value, bool $global = false ): bool {
	global $wpdb, $onboarding_meta, $onboarding_fail_write;
	if ( $onboarding_fail_write ) { return false; }
	$onboarding_meta[$user][$wpdb->get_blog_prefix() . $key] = $value;
	return true;
}

class OnboardingTestDatabase {
	public string $prefix = 'wp_';
	public array $topics = [];
	public array $outputs = [];
	public int $approved = 0;
	public function get_blog_prefix(): string { return $this->prefix; }
	public function prepare( string $sql, mixed ...$args ): string { return vsprintf( strtr( $sql, [ '%i' => '`%s`', '%s' => "'%s'" ] ), $args ); }
	public function get_row( string $sql ): ?object {
		if ( str_contains( $sql, 'clipisode_media' ) ) { return (object) [ 'storage' => 'local', 'attachment_id' => 20 ]; }
		if ( str_contains( $sql, 'clipisode_replies' ) ) { return (object) [ 'replies' => 1, 'approved' => $this->approved ]; }
		preg_match( '/WHERE id = (\d+)/', $sql, $match );
		$id = (int) ( $match[1] ?? 0 );
		$row = str_contains( $sql, 'clipisode_topics' ) ? ( $this->topics[$id] ?? null ) : ( $this->outputs[$id] ?? null );
		if ( $row && preg_match( '/AND topic_id = (\d+)/', $sql, $topic ) && $row['topic_id'] !== (int) $topic[1] ) { return null; }
		return $row ? (object) $row : null;
	}
	public function get_results( string $sql ): array { return []; }
	public function get_var( string $sql ): ?int { return $this->get_row( $sql )?->id; }
}

class OnboardingTest extends TestCase {
	protected function setUp(): void {
		global $wpdb, $onboarding_meta, $onboarding_user, $onboarding_fail_write, $clipisode_test_options;
		$wpdb = new OnboardingTestDatabase();
		$wpdb->topics[7] = [ 'id' => 7, 'title' => 'Our community' ];
		$wpdb->outputs[42] = [ 'id' => 42, 'topic_id' => 7, 'composition' => '{"clips":[]}', 'media_id' => null, 'slug' => 'our-community' ];
		$onboarding_meta = [];
		$onboarding_user = 1;
		$onboarding_fail_write = false;
		$clipisode_test_options = [];
	}
	private function act( array $data ): WP_REST_Response {
		$request = new WP_REST_Request();
		foreach ( $data as $key => $value ) { $request->set_param( $key, $value ); }
		return ( new Clipisode_Onboarding() )->update_state( $request );
	}
	public function test_topic_ids_are_numeric_at_the_rest_boundary(): void {
		$method = new ReflectionMethod( Clipisode_REST_API::class, 'enrich_topic' );
		$topic = $method->invoke( new Clipisode_REST_API(), (object) [ 'id' => '7' ] );
		$this->assertSame( 7, $topic->id );
	}
	public function test_intent_is_user_and_site_scoped_and_dismiss_never_deletes_content(): void {
		global $wpdb, $onboarding_user;
		$this->act( [ 'action' => 'select', 'topic_id' => 7 ] );
		$this->assertSame( 7, Clipisode_Onboarding::state()['topic_id'] );
		$this->act( [ 'action' => 'dismiss' ] );
		$this->assertTrue( Clipisode_Onboarding::state()['dismissed'] );
		$this->act( [ 'action' => 'select', 'topic_id' => 7, 'output_id' => 42 ] );
		$this->assertTrue( Clipisode_Onboarding::state()['dismissed'] );
		$this->assertCount( 1, $wpdb->topics );
		$onboarding_user = 2;
		$this->assertNull( Clipisode_Onboarding::state()['topic_id'] );
		$this->assertFalse( Clipisode_Onboarding::state()['dismissed'] );
		$onboarding_user = 1;
		$wpdb->prefix = 'wp_2_';
		$this->assertNull( Clipisode_Onboarding::state()['topic_id'] );
		$wpdb->prefix = 'wp_';
		$this->act( [ 'action' => 'resume' ] );
		$this->assertFalse( Clipisode_Onboarding::state()['dismissed'] );
		$this->act( [ 'action' => 'start' ] );
		$this->assertNull( Clipisode_Onboarding::state()['topic_id'] );
		$this->assertCount( 1, $wpdb->topics );
	}
	public function test_milestones_come_from_saved_work_not_client_completion_flags(): void {
		global $wpdb, $clipisode_test_options, $test_attachment_urls;
		$test_attachment_urls = [ 20 => 'https://example.com/render.mp4' ];
		$this->assertSame( 1, Clipisode_Onboarding::state()['stage'] );
		$this->act( [ 'action' => 'select', 'topic_id' => 7, 'complete' => true, 'stage' => 5 ] );
		$this->assertSame( 2, Clipisode_Onboarding::state()['stage'] );
		$wpdb->approved = 1;
		$this->assertSame( 3, Clipisode_Onboarding::state()['stage'] );
		$this->act( [ 'action' => 'select', 'topic_id' => 7, 'output_id' => 42 ] );
		$this->assertSame( 4, Clipisode_Onboarding::state()['stage'] );
		$wpdb->outputs[42]['media_id'] = 20;
		$clipisode_test_options['clipisode_render_42'] = [ 'status' => 'done', 'composition_hash' => hash( 'sha256', $wpdb->outputs[42]['composition'] ) ];
		$this->assertTrue( Clipisode_Renderer::has_current_export( (object) $wpdb->outputs[42] ) );
		$this->assertSame( 5, Clipisode_Onboarding::state()['stage'] );
		$this->assertStringContainsString( '/42/20/our-community', Clipisode_Onboarding::state()['watch_url'] );
		$wpdb->outputs[42]['composition'] = '{"clips":[1]}';
		$this->assertFalse( Clipisode_Renderer::has_current_export( (object) $wpdb->outputs[42] ) );
		$this->assertSame( 4, Clipisode_Onboarding::state()['stage'] );
	}
	public function test_rejects_missing_topics_and_outputs_from_another_topic(): void {
		global $wpdb;
		$this->assertSame( 400, $this->act( [ 'action' => 'select', 'topic_id' => 999 ] )->get_status() );
		$wpdb->outputs[42]['topic_id'] = 8;
		$this->assertSame( 400, $this->act( [ 'action' => 'select', 'topic_id' => 7, 'output_id' => 42 ] )->get_status() );
		$this->assertSame( 400, $this->act( [ 'action' => 'complete' ] )->get_status() );
	}
	public function test_deleted_selection_and_failed_preference_write_are_recoverable(): void {
		global $wpdb, $onboarding_fail_write;
		$this->act( [ 'action' => 'select', 'topic_id' => 7, 'output_id' => 42 ] );
		unset( $wpdb->outputs[42] );
		$this->assertTrue( Clipisode_Onboarding::state()['missing_output'] );
		unset( $wpdb->topics[7] );
		$this->assertTrue( Clipisode_Onboarding::state()['missing_topic'] );
		$this->assertSame( 1, Clipisode_Onboarding::state()['stage'] );
		$onboarding_fail_write = true;
		$this->assertSame( 500, $this->act( [ 'action' => 'start' ] )->get_status() );
	}
	public function test_read_and_write_routes_require_admin_capability(): void {
		global $wp_rest_routes, $current_user_can_result;
		$api = new Clipisode_Onboarding();
		$api->register_routes();
		$current_user_can_result = false;
		foreach ( $wp_rest_routes['clipisode/v1']['/onboarding'] as $endpoint ) { $this->assertSame( [ $api, 'check_permission' ], $endpoint['permission_callback'] ); $this->assertFalse( call_user_func( $endpoint['permission_callback'] ) ); }
		$current_user_can_result = true;
		$this->assertTrue( $api->check_permission() );
		$current_user_can_result = false;
	}
}
