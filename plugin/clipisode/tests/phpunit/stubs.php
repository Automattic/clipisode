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

