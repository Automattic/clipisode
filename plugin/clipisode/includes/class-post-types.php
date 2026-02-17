<?php

defined( 'ABSPATH' ) || exit;

class Clipisode_Post_Types {

	const TERMS_TYPE_META = '_clipisode_terms_type';

	public static function register(): void {
		register_post_type( 'clipisode_terms', [
			'labels'              => [
				'name'               => 'Terms',
				'singular_name'      => 'Terms',
				'add_new_item'       => 'Add New Terms',
				'edit_item'          => 'Edit Terms',
				'new_item'           => 'New Terms',
				'view_item'          => 'View Terms',
				'search_items'       => 'Search Terms',
				'not_found'          => 'No terms found.',
				'not_found_in_trash' => 'No terms found in Trash.',
				'menu_name'          => 'Terms',
			],
			'public'              => false,
			'publicly_queryable'  => true,
			'exclude_from_search' => true,
			'show_in_nav_menus'   => false,
			'show_ui'             => true,
			'show_in_menu'        => false,
			'show_in_rest'        => true,
			'rest_base'           => 'clipisode-terms',
			'supports'            => [ 'title', 'editor', 'revisions' ],
			'capability_type'     => 'post',
			'has_archive'         => false,
			'rewrite'             => false,
		] );

		register_post_meta( 'clipisode_terms', self::TERMS_TYPE_META, [
			'type'         => 'string',
			'single'       => true,
			'show_in_rest' => true,
			'default'      => 'custom',
		] );

		add_filter( 'wp_unique_post_slug', [ __CLASS__, 'prefix_terms_slug' ], 10, 4 );
		add_action( 'save_post_clipisode_terms', [ __CLASS__, 'ensure_terms_type_meta' ] );
		add_filter( 'template_include', [ __CLASS__, 'terms_template' ] );
	}

	public static function ensure_terms_type_meta( int $post_id ): void {
		if ( ! metadata_exists( 'post', $post_id, self::TERMS_TYPE_META ) ) {
			update_post_meta( $post_id, self::TERMS_TYPE_META, 'custom' );
		}
	}

	public static function prefix_terms_slug( string $slug, int $post_id, string $post_status, string $post_type ): string {
		if ( 'clipisode_terms' === $post_type && 0 !== strpos( $slug, 'clipisode-' ) ) {
			return 'clipisode-' . $slug;
		}
		return $slug;
	}

	public static function terms_template( string $template ): string {
		if ( is_singular( 'clipisode_terms' ) ) {
			return CLIPISODE_PLUGIN_DIR . 'templates/terms-single.php';
		}
		return $template;
	}

	public static function get_brand_terms_id(): ?int {
		$posts = get_posts( [
			'post_type'   => 'clipisode_terms',
			'post_status' => 'publish',
			'numberposts' => 1,
			'meta_key'    => self::TERMS_TYPE_META,
			'meta_value'  => 'brand',
		] );

		return $posts ? (int) $posts[0]->ID : null;
	}

	public static function ensure_brand_terms(): int {
		$existing = self::get_brand_terms_id();
		if ( $existing ) {
			return $existing;
		}

		$template_path = CLIPISODE_PLUGIN_DIR . 'templates/default-brand-terms.html';
		$content       = file_exists( $template_path )
			? file_get_contents( $template_path )
			: '<p>By submitting a video you grant the brand a perpetual, worldwide license to use your submission.</p>';

		$brand_name = get_bloginfo( 'name' ) ?: 'the Company';
		$content    = str_replace( '{{BRAND}}', esc_html( $brand_name ), $content );

		$post_id = wp_insert_post( [
			'post_type'    => 'clipisode_terms',
			'post_title'   => 'Brand Terms',
			'post_content' => $content,
			'post_status'  => 'publish',
		] );

		update_post_meta( $post_id, self::TERMS_TYPE_META, 'brand' );

		return $post_id;
	}
}
