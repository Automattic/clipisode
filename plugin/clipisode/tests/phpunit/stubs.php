<?php
/**
 * WordPress function stubs for unit testing.
 */

$current_user_can_result = false;

if ( ! function_exists( 'register_post_type' ) ) {
	function register_post_type( string $post_type, array $args = [] ): WP_Post_Type {
		global $wp_post_types;
		if ( ! isset( $wp_post_types ) ) {
			$wp_post_types = [];
		}
		$post_type_object = new WP_Post_Type( $post_type, $args );
		$wp_post_types[ $post_type ] = $post_type_object;
		return $post_type_object;
	}
}

if ( ! function_exists( 'register_post_meta' ) ) {
	function register_post_meta( string $post_type, string $meta_key, array $args ): bool {
		return true;
	}
}

if ( ! function_exists( 'register_rest_route' ) ) {
	function register_rest_route( string $namespace, string $route, array $args ): bool {
		global $wp_rest_routes;
		if ( ! isset( $wp_rest_routes ) ) {
			$wp_rest_routes = [];
		}
		$wp_rest_routes[ $namespace ][ $route ] = $args;
		return true;
	}
}

if ( ! function_exists( 'add_filter' ) ) {
	function add_filter( string $hook, callable $callback, int $priority = 10, int $args = 1 ): bool {
		return true;
	}
}

if ( ! function_exists( 'add_action' ) ) {
	function add_action( string $hook, callable $callback, int $priority = 10, int $args = 1 ): bool {
		return true;
	}
}

if ( ! function_exists( 'post_type_exists' ) ) {
	function post_type_exists( string $post_type ): bool {
		global $wp_post_types;
		return isset( $wp_post_types[ $post_type ] );
	}
}

if ( ! function_exists( 'get_post_type_object' ) ) {
	function get_post_type_object( string $post_type ): ?WP_Post_Type {
		global $wp_post_types;
		return $wp_post_types[ $post_type ] ?? null;
	}
}

if ( ! function_exists( 'post_type_supports' ) ) {
	function post_type_supports( string $post_type, string $feature ): bool {
		global $wp_post_types;
		if ( ! isset( $wp_post_types[ $post_type ] ) ) {
			return false;
		}
		$supports = $wp_post_types[ $post_type ]->supports ?? [];
		return in_array( $feature, $supports, true );
	}
}

if ( ! function_exists( 'current_user_can' ) ) {
	function current_user_can( string $capability ): bool {
		global $current_user_can_result;
		return $current_user_can_result ?? false;
	}
}

if ( ! class_exists( 'WP_Post_Type' ) ) {
	class WP_Post_Type {
		public string $name;
		public bool $public = false;
		public bool $publicly_queryable = false;
		public array $supports = [];

		public function __construct( string $post_type, array $args = [] ) {
			$this->name = $post_type;
			foreach ( $args as $key => $value ) {
				if ( property_exists( $this, $key ) ) {
					$this->$key = $value;
				}
			}
			if ( isset( $args['supports'] ) ) {
				$this->supports = $args['supports'];
			}
		}
	}
}


class WP_Error {
	public function __construct( private string $code, private string $message ) {}
	public function get_error_code(): string {
		return $this->code;
	}
	public function get_error_message(): string {
		return $this->message;
	}
}

function is_wp_error( mixed $value ): bool {
	return $value instanceof WP_Error;
}

class WP_REST_Request implements ArrayAccess {
	private array $params = [];
	private array $files = [];
	public function set_file_params( array $files ): void {
		$this->files = $files;
	}
	public function get_file_params(): array {
		return $this->files;
	}
	public function set_param( string $key, mixed $value ): void {
		$this->params[ $key ] = $value;
	}
	public function get_param( string $key ): mixed {
		return $this->params[ $key ] ?? null;
	}
	public function offsetExists( mixed $offset ): bool {
		return isset( $this->params[ $offset ] );
	}
	public function offsetGet( mixed $offset ): mixed {
		return $this->get_param( $offset );
	}
	public function offsetSet( mixed $offset, mixed $value ): void {
		$this->params[ $offset ] = $value;
	}
	public function offsetUnset( mixed $offset ): void {
		unset( $this->params[ $offset ] );
	}
}

class WP_REST_Response {
	public function __construct( private mixed $data = null, private int $status = 200 ) {}
	public function get_data(): mixed {
		return $this->data;
	}
	public function get_status(): int {
		return $this->status;
	}
}

function sanitize_text_field( mixed $value ): string {
	return trim( preg_replace( '/[\r\n\t ]+/', ' ', strip_tags( (string) $value ) ) );
}

function sanitize_textarea_field( string $value ): string {
	return trim( strip_tags( $value ) );
}

function sanitize_title( string $value ): string {
	return trim( preg_replace( '/[^a-z0-9]+/', '-', strtolower( $value ) ), '-' );
}

function esc_url_raw( string $value, array $protocols = [ 'http', 'https' ] ): string {
	return in_array( parse_url( $value, PHP_URL_SCHEME ), $protocols, true ) ? $value : '';
}

function wp_parse_url( string $url, int $component = -1 ): mixed {
	return parse_url( $url, $component );
}

function wp_json_encode( mixed $value ): string|false {
	return json_encode( $value );
}

function wp_get_attachment_url( int $id ): string|false {
	global $test_attachment_urls;
	return $test_attachment_urls[ $id ] ?? false;
}

function get_option( string $key, mixed $default = false ): mixed {
	global $test_options;
	return $test_options[ $key ] ?? $default;
}
function update_option( string $key, mixed $value, mixed $autoload = null ): bool {
	global $test_options;
	if ( isset( $test_options[ $key ] ) && $test_options[ $key ] === $value ) {
		return false;
	}
	$test_options[ $key ] = $value;
	return true;
}
function delete_option( string $key ): bool {
	global $test_options;
	unset( $test_options[ $key ] );
	return true;
}
function wp_cache_delete( string $key, string $group = '' ): bool {
	return true;
}
function wp_generate_password( int $length = 12, bool $special = true ): string {
	return substr( bin2hex( random_bytes( $length ) ), 0, $length );
}
function rest_url( string $path = '' ): string {
	return 'https://example.com/wp-json/' . $path;
}
function add_query_arg( string $key, string $value, string $url ): string {
	return $url . '?' . http_build_query( [ $key => $value ] );
}
function wp_remote_request( string $url, array $args ): array|WP_Error {
	global $test_http_response, $test_http_requests;
	$test_http_requests[] = [ 'url' => $url, 'args' => $args ];
	return is_callable( $test_http_response ) ? $test_http_response( $url, $args ) : $test_http_response;
}
function wp_remote_retrieve_response_code( array $response ): int {
	return $response['response']['code'];
}
function wp_remote_retrieve_body( array $response ): string {
	return $response['body'];
}
function media_handle_upload( string $key, int $post_id ): int|WP_Error {
	global $test_upload_result;
	return $test_upload_result;
}
function update_post_meta( int $id, string $key, mixed $value ): bool {
	return true;
}
function get_post_meta( int $id, string $key, bool $single = false ): string {
	return '2026/10/render.mp4';
}
function get_post( int $id ): object {
	return (object) [ 'post_mime_type' => 'video/mp4' ];
}
function get_attached_file( int $id ): string|false {
	return false;
}
function wp_delete_attachment( int $id, bool $force = false ): bool {
	global $test_deleted_attachments;
	$test_deleted_attachments[] = $id;
	return true;
}

function wp_enqueue_script( string $handle, string $src, array $dependencies, string $version, bool $in_footer ): void {}
function wp_enqueue_style( string $handle, string $src, array $dependencies, string $version ): void {}
function wp_add_inline_script( string $handle, string $script, string $position = 'after' ): bool {
	global $test_inline_scripts;
	$test_inline_scripts[] = [ 'handle' => $handle, 'script' => $script, 'position' => $position ];
	return true;
}
function wp_get_environment_type(): string {
	global $test_environment_type;
	return $test_environment_type ?? 'production';
}
function wp_create_nonce( string $action ): string {
	return 'test-rest-nonce';
}
