<?php

use PHPUnit\Framework\TestCase;

/**
 * Covers the object-cache memoisation of invitation-flow screen rendering.
 *
 * The cache key is the whole risk surface here. Screen markup is per-theme but
 * token substitution ({topic_title}, {invitation_url}, {network}) happens inside
 * the render_block filter, so rendered output is per-topic and per-link. A key
 * that failed to vary on the topic context would serve one brand's rendered
 * screen on another brand's invitation — a cross-tenant content leak, not a
 * performance regression. These tests pin that behaviour.
 */
class FlowScreenRenderCacheTest extends TestCase {

	private const MARKUP = '<!-- wp:paragraph --><p>{topic_title}</p><!-- /wp:paragraph -->';

	protected function setUp(): void {
		parent::setUp();
		clipisode_test_reset_cache();
		Clipisode_Post_Types::reset_flow_topic_context();
		Clipisode_Post_Types::set_flow_intro_video_url( '' );
	}

	protected function tearDown(): void {
		Clipisode_Post_Types::reset_flow_topic_context();
		parent::tearDown();
	}

	private function do_blocks_calls(): int {
		global $clipisode_test_do_blocks_calls;
		return $clipisode_test_do_blocks_calls;
	}

	private function set_context( string $title, string $slug ): void {
		Clipisode_Post_Types::set_flow_topic_context( [
			'topic_title'     => $title,
			'invitation_slug' => $slug,
			'invitation_url'  => "https://example.com/invitation/{$slug}",
		] );
	}

	public function test_first_render_produces_output(): void {
		$this->set_context( 'Sunday Sauce Stories', 'abc123' );

		$html = Clipisode_Post_Types::render_flow_screen( 'intro', self::MARKUP );

		$this->assertStringContainsString( '<rendered>', $html );
		$this->assertSame( 1, $this->do_blocks_calls() );
	}

	public function test_repeat_render_is_served_from_cache(): void {
		$this->set_context( 'Sunday Sauce Stories', 'abc123' );

		$first  = Clipisode_Post_Types::render_flow_screen( 'intro', self::MARKUP );
		$second = Clipisode_Post_Types::render_flow_screen( 'intro', self::MARKUP );

		$this->assertSame( $first, $second );
		$this->assertSame(
			1,
			$this->do_blocks_calls(),
			'An unchanged screen with unchanged context should render once, not twice.'
		);
	}

	/**
	 * The leak case. Same screen markup, different topic — must not share a
	 * cache entry, because the rendered HTML contains the substituted title.
	 */
	public function test_a_different_topic_does_not_reuse_the_cached_render(): void {
		$this->set_context( 'Superhero Studio: Assemble Your Story', 'aaa111' );
		Clipisode_Post_Types::render_flow_screen( 'intro', self::MARKUP );

		$this->set_context( 'Music Magazine: First Concert', 'bbb222' );
		Clipisode_Post_Types::render_flow_screen( 'intro', self::MARKUP );

		$this->assertSame(
			2,
			$this->do_blocks_calls(),
			'Two topics sharing screen markup must not share a cache entry.'
		);
	}

	/**
	 * Two links to the same topic still differ, because {invitation_url} and
	 * {invitation_slug} resolve per link.
	 */
	public function test_a_different_invitation_link_does_not_reuse_the_cached_render(): void {
		$this->set_context( 'Same Topic', 'link-one' );
		Clipisode_Post_Types::render_flow_screen( 'intro', self::MARKUP );

		$this->set_context( 'Same Topic', 'link-two' );
		Clipisode_Post_Types::render_flow_screen( 'intro', self::MARKUP );

		$this->assertSame( 2, $this->do_blocks_calls() );
	}

	/**
	 * An author edit changes the markup, which must supersede the entry rather
	 * than serve the pre-edit render.
	 */
	public function test_edited_markup_is_re_rendered(): void {
		$this->set_context( 'Sunday Sauce Stories', 'abc123' );

		Clipisode_Post_Types::render_flow_screen( 'intro', self::MARKUP );
		$edited = Clipisode_Post_Types::render_flow_screen(
			'intro',
			'<!-- wp:paragraph --><p>Edited copy</p><!-- /wp:paragraph -->'
		);

		$this->assertSame( 2, $this->do_blocks_calls() );
		$this->assertStringContainsString( 'Edited copy', $edited );
	}

	/**
	 * The intro video URL is injected into rendered output, so it belongs in
	 * the key too.
	 */
	public function test_intro_video_url_is_part_of_the_key(): void {
		$this->set_context( 'Sunday Sauce Stories', 'abc123' );

		Clipisode_Post_Types::render_flow_screen( 'intro', self::MARKUP );
		Clipisode_Post_Types::set_flow_intro_video_url( 'https://example.com/intro.mp4' );
		Clipisode_Post_Types::render_flow_screen( 'intro', self::MARKUP );

		$this->assertSame( 2, $this->do_blocks_calls() );
	}

	/**
	 * Two screens in the same theme share a topic context but not their markup;
	 * they must not collide.
	 */
	public function test_different_screens_do_not_collide(): void {
		$this->set_context( 'Sunday Sauce Stories', 'abc123' );

		Clipisode_Post_Types::render_flow_screen( 'intro', self::MARKUP );
		Clipisode_Post_Types::render_flow_screen( 'success', '<!-- wp:paragraph --><p>Thanks</p><!-- /wp:paragraph -->' );

		$this->assertSame( 2, $this->do_blocks_calls() );
	}

	public function test_empty_markup_short_circuits(): void {
		$this->set_context( 'Sunday Sauce Stories', 'abc123' );

		$this->assertSame( '', Clipisode_Post_Types::render_flow_screen( 'closed', '' ) );
		$this->assertSame(
			0,
			$this->do_blocks_calls(),
			'A theme with no markup for a screen should not invoke the block parser.'
		);
	}
}
