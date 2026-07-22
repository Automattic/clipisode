<?php

use PHPUnit\Framework\TestCase;

class PostTypesTest extends TestCase {

	protected function setUp(): void {
		parent::setUp();
		global $wp_post_types;
		$wp_post_types = [];
		Clipisode_Post_Types::register();
	}

	protected function tearDown(): void {
		global $wp_post_types;
		$wp_post_types = [];
		parent::tearDown();
	}

	public function test_invite_post_type_is_registered(): void {
		$this->assertTrue( post_type_exists( 'clipisode_invite' ) );
	}

	public function test_terms_post_type_is_registered(): void {
		$this->assertTrue( post_type_exists( 'clipisode_terms' ) );
	}

	public function test_invite_post_type_not_public(): void {
		$post_type = get_post_type_object( 'clipisode_invite' );
		$this->assertFalse( $post_type->public );
	}

	public function test_terms_post_type_publicly_queryable(): void {
		$post_type = get_post_type_object( 'clipisode_terms' );
		$this->assertTrue( $post_type->publicly_queryable );
	}

	/**
	 * `clipisode_invite` is the Theme container CPT. After the v1
	 * stage-block tree was retired, the post type stopped supporting
	 * `editor` — the screens are the editable content, not the theme
	 * post itself. See docs/specs/shipped/kill-v1-invitation-flow.md.
	 */
	public function test_invite_does_not_support_editor(): void {
		$this->assertFalse( post_type_supports( 'clipisode_invite', 'editor' ) );
	}

	public function test_invite_supports_title(): void {
		$this->assertTrue( post_type_supports( 'clipisode_invite', 'title' ) );
	}

	public function test_terms_supports_revisions(): void {
		$this->assertTrue( post_type_supports( 'clipisode_terms', 'revisions' ) );
	}

	public function test_terms_slug_gets_prefixed(): void {
		$slug = Clipisode_Post_Types::prefix_terms_slug( 'my-terms', 1, 'publish', 'clipisode_terms' );
		$this->assertSame( 'clipisode-my-terms', $slug );
	}

	public function test_terms_slug_not_double_prefixed(): void {
		$slug = Clipisode_Post_Types::prefix_terms_slug( 'clipisode-existing', 1, 'publish', 'clipisode_terms' );
		$this->assertSame( 'clipisode-existing', $slug );
	}

	public function test_other_post_type_slug_unchanged(): void {
		$slug = Clipisode_Post_Types::prefix_terms_slug( 'my-post', 1, 'publish', 'post' );
		$this->assertSame( 'my-post', $slug );
	}

	public function test_terms_slug_empty_string(): void {
		$slug = Clipisode_Post_Types::prefix_terms_slug( '', 1, 'publish', 'clipisode_terms' );
		$this->assertSame( 'clipisode-', $slug );
	}

	public function test_terms_slug_with_special_characters(): void {
		$slug = Clipisode_Post_Types::prefix_terms_slug( 'my-terms-2024', 1, 'publish', 'clipisode_terms' );
		$this->assertSame( 'clipisode-my-terms-2024', $slug );
	}
}
