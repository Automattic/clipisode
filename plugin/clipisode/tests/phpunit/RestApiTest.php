<?php

use PHPUnit\Framework\TestCase;

class RestApiTest extends TestCase {

	private Clipisode_REST_API $api;

	protected function setUp(): void {
		parent::setUp();
		global $wp_rest_routes, $current_user_can_result;
		$wp_rest_routes = [];
		$current_user_can_result = false;
		$this->api = new Clipisode_REST_API();
	}

	protected function tearDown(): void {
		global $wp_rest_routes, $current_user_can_result;
		$wp_rest_routes = [];
		$current_user_can_result = false;
		parent::tearDown();
	}

	public function test_check_permission_returns_false_when_not_logged_in(): void {
		$this->assertFalse( $this->api->check_permission() );
	}

	public function test_check_permission_returns_true_for_admin(): void {
		global $current_user_can_result;
		$current_user_can_result = true;

		$this->assertTrue( $this->api->check_permission() );
	}

	public function test_namespace_constant_value(): void {
		$reflection = new ReflectionClass( Clipisode_REST_API::class );
		$namespace  = $reflection->getConstant( 'NAMESPACE' );

		$this->assertSame( 'clipisode/v1', $namespace );
	}

	public function test_register_routes_creates_topics_endpoint(): void {
		global $wp_rest_routes;

		$this->api->register_routes();

		$this->assertArrayHasKey( 'clipisode/v1', $wp_rest_routes );
		$this->assertArrayHasKey( '/topics', $wp_rest_routes['clipisode/v1'] );
	}

	public function test_register_routes_creates_replies_endpoint(): void {
		global $wp_rest_routes;

		$this->api->register_routes();

		$this->assertArrayHasKey( '/replies', $wp_rest_routes['clipisode/v1'] );
	}

	public function test_register_routes_creates_hosts_endpoint(): void {
		global $wp_rest_routes;

		$this->api->register_routes();

		$this->assertArrayHasKey( '/hosts', $wp_rest_routes['clipisode/v1'] );
	}

	public function test_register_routes_creates_settings_endpoint(): void {
		global $wp_rest_routes;

		$this->api->register_routes();

		$this->assertArrayHasKey( '/settings', $wp_rest_routes['clipisode/v1'] );
	}

	public function test_register_routes_creates_outputs_endpoint(): void {
		global $wp_rest_routes;

		$this->api->register_routes();

		$this->assertArrayHasKey( '/outputs', $wp_rest_routes['clipisode/v1'] );
	}

	public function test_register_routes_creates_media_endpoint(): void {
		global $wp_rest_routes;

		$this->api->register_routes();

		$this->assertArrayHasKey( '/media', $wp_rest_routes['clipisode/v1'] );
	}

	public function test_register_routes_creates_themes_endpoint(): void {
		global $wp_rest_routes;

		$this->api->register_routes();

		$this->assertArrayHasKey( '/themes', $wp_rest_routes['clipisode/v1'] );
	}

	public function test_register_routes_creates_videos_upload_endpoint(): void {
		global $wp_rest_routes;

		$this->api->register_routes();

		$this->assertArrayHasKey( '/videos/upload', $wp_rest_routes['clipisode/v1'] );
	}

	public function test_register_routes_creates_brand_terms_endpoint(): void {
		global $wp_rest_routes;

		$this->api->register_routes();

		$this->assertArrayHasKey( '/terms/brand', $wp_rest_routes['clipisode/v1'] );
	}

	public function test_output_upload_endpoint_is_public(): void {
		global $wp_rest_routes;

		$this->api->register_routes();

		$route = $wp_rest_routes['clipisode/v1']['/outputs/(?P<id>\d+)/upload'];
		$this->assertSame( '__return_true', $route[0]['permission_callback'] );
	}
}
