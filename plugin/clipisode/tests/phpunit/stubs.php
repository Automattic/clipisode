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

/**
 * In-memory options table.
 *
 * Faithful on the one behaviour Clipisode_Database depends on for correctness:
 * add_option() must fail when the option already exists, because that INSERT
 * against a UNIQUE option_name is what makes the schema-upgrade lock atomic.
 */
$clipisode_test_options = [];

if ( ! function_exists( 'clipisode_test_reset_options' ) ) {
	function clipisode_test_reset_options(): void {
		global $clipisode_test_options;
		$clipisode_test_options = [];
	}
}

if ( ! function_exists( 'get_option' ) ) {
	function get_option( string $option, $default_value = false ) {
		global $clipisode_test_options;
		return array_key_exists( $option, $clipisode_test_options )
			? $clipisode_test_options[ $option ]
			: $default_value;
	}
}

if ( ! function_exists( 'add_option' ) ) {
	function add_option( string $option, $value = '', string $deprecated = '', $autoload = true ): bool {
		global $clipisode_test_options;
		if ( array_key_exists( $option, $clipisode_test_options ) ) {
			return false;
		}
		$clipisode_test_options[ $option ] = $value;
		return true;
	}
}

if ( ! function_exists( 'update_option' ) ) {
	function update_option( string $option, $value, $autoload = null ): bool {
		global $clipisode_test_options;
		$clipisode_test_options[ $option ] = $value;
		return true;
	}
}

if ( ! function_exists( 'delete_option' ) ) {
	function delete_option( string $option ): bool {
		global $clipisode_test_options;
		if ( ! array_key_exists( $option, $clipisode_test_options ) ) {
			return false;
		}
		unset( $clipisode_test_options[ $option ] );
		return true;
	}
}

if ( ! defined( 'HOUR_IN_SECONDS' ) ) {
	define( 'HOUR_IN_SECONDS', 3600 );
}

if ( ! function_exists( 'wp_json_encode' ) ) {
	function wp_json_encode( $data, int $flags = 0, int $depth = 512 ) {
		return json_encode( $data, $flags, $depth );
	}
}

/**
 * In-memory object cache, plus a counter for how many times do_blocks() ran.
 *
 * The counter is what makes cache-key correctness testable: a key that failed
 * to vary on the topic context would show as a cache hit across two different
 * topics, which is a cross-tenant content leak rather than a mere perf bug.
 */
$clipisode_test_cache = [];

$clipisode_test_do_blocks_calls = 0;

if ( ! function_exists( 'clipisode_test_reset_cache' ) ) {
	function clipisode_test_reset_cache(): void {
		global $clipisode_test_cache, $clipisode_test_do_blocks_calls;
		$clipisode_test_cache           = [];
		$clipisode_test_do_blocks_calls = 0;
	}
}

if ( ! function_exists( 'wp_cache_get' ) ) {
	function wp_cache_get( $key, string $group = '', bool $force = false, &$found = null ) {
		global $clipisode_test_cache;
		$found = isset( $clipisode_test_cache[ $group ][ $key ] );
		return $found ? $clipisode_test_cache[ $group ][ $key ] : false;
	}
}

if ( ! function_exists( 'wp_cache_set' ) ) {
	function wp_cache_set( $key, $data, string $group = '', int $expire = 0 ): bool {
		global $clipisode_test_cache;
		$clipisode_test_cache[ $group ][ $key ] = $data;
		return true;
	}
}

if ( ! function_exists( 'do_blocks' ) ) {
	function do_blocks( string $content ): string {
		global $clipisode_test_do_blocks_calls;
		++$clipisode_test_do_blocks_calls;
		return '<rendered>' . $content . '</rendered>';
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

