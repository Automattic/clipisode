<?php

use PHPUnit\Framework\TestCase;

require_once __DIR__ . '/CompositionTest.php';

class CompositionSchemaTest extends TestCase {
	protected function setUp(): void {
		global $wpdb, $test_attachment_urls;
		$wpdb = new CompositionTestDatabase();
		$test_attachment_urls = [ 20 => 'https://example.com/source.mp4' ];
	}

	private function theme( string $id = 'wpvip' ): array {
		$schema = json_decode( file_get_contents( CLIPISODE_PLUGIN_DIR . 'assets/composition-themes.json' ), true );
		foreach ( $schema['themes'] as $theme ) {
			if ( $theme['id'] === $id ) {
				return $theme;
			}
		}
		throw new RuntimeException( 'Test theme is missing.' );
	}

	private function with_theme( array $composition, array $theme ): array|WP_Error {
		$method = new ReflectionMethod( Clipisode_Composition::class, 'sanitize_theme' );
		$method->setAccessible( true );
		return $method->invoke( null, $composition, $theme );
	}

	private function settings( array $theme ): array {
		$settings = [ 'themeId' => $theme['id'], 'format' => 'portrait' ];
		foreach ( $theme['groups'] as $group ) {
			if ( 'composition' === $group['scope'] ) {
				foreach ( $group['fields'] as $field ) {
					$settings[ $field['id'] ] = $field['default'];
				}
			}
		}
		return $settings;
	}

	public function test_public_catalog_exposes_all_shared_theme_definitions(): void {
		$schema = json_decode( file_get_contents( CLIPISODE_PLUGIN_DIR . 'assets/composition-themes.json' ), true );
		$this->assertSame( $schema['themes'], Clipisode_Composition::themes() );
		$this->assertContains( 'none', array_column( Clipisode_Composition::themes(), 'id' ) );
	}

	public function test_none_has_only_its_declared_settings(): void {
		$composition = CompositionTest::composition();
		$composition['settings'] = $this->settings( $this->theme( 'none' ) );
		$clean = Clipisode_Composition::sanitize( $composition );
		$this->assertSame( [ 'themeId' => 'none', 'format' => 'portrait', 'videoFit' => 'cover' ], $clean['settings'] );
		$composition['settings']['accentColor'] = '#ffffff';
		$this->assertInstanceOf( WP_Error::class, Clipisode_Composition::sanitize( $composition ) );
	}

	public function test_resolve_normalizes_declared_fields_without_rewriting_saved_data(): void {
		$composition = CompositionTest::composition();
		$composition['settings']['themeId'] = 'none';
		$json = wp_json_encode( $composition );
		$resolved = Clipisode_Composition::resolve( $json );
		$this->assertSame( [ 'themeId' => 'none', 'format' => 'portrait', 'videoFit' => 'cover' ], $resolved['settings'] );
		$this->assertSame( [], $resolved['clips'][0]['tags'] );
		$this->assertInstanceOf( stdClass::class, $resolved['clips'][0]['values'] );
		$this->assertArrayHasKey( 'accentColor', json_decode( $json, true )['settings'] );
	}

	public function test_optional_fields_default_on_resolve_and_accept_null(): void {
		$composition = CompositionTest::composition();
		$clean = Clipisode_Composition::sanitize( $composition );
		$this->assertArrayNotHasKey( 'backgroundClip', $clean['settings'] );
		$resolved = Clipisode_Composition::resolve( wp_json_encode( $clean ) );
		$this->assertNull( $resolved['settings']['backgroundClip'] );
		$this->assertNull( $resolved['clips'][0]['values']->caption );
		$this->assertNull( $resolved['clips'][0]['values']->favoriteMovie );
		$composition['clips'][0]['values'] = [ 'favoriteMovie' => null ];
		$this->assertIsArray( Clipisode_Composition::sanitize( $composition ) );
	}

	public function test_image_url_schemes_are_case_insensitive(): void {
		foreach ( [ 'HTTP', 'HtTpS' ] as $scheme ) {
			$composition = CompositionTest::composition();
			$composition['settings']['logoUrl'] = $scheme . '://example.com/Logo.png';
			$clean = Clipisode_Composition::sanitize( $composition );
			$this->assertIsArray( $clean );
			$this->assertSame( 'example.com', wp_parse_url( $clean['settings']['logoUrl'], PHP_URL_HOST ) );
			$this->assertSame( '/Logo.png', wp_parse_url( $clean['settings']['logoUrl'], PHP_URL_PATH ) );
		}
	}

	public function test_theme_specific_clip_values_are_sanitized_and_unknown_fields_rejected(): void {
		$composition = CompositionTest::composition();
		$composition['clips'][0]['values'] = [ 'favoriteMovie' => '<b>Arrival</b>', 'caption' => "First line\nSecond line" ];
		$clean = Clipisode_Composition::sanitize( $composition );
		$this->assertSame( 'Arrival', $clean['clips'][0]['values']->favoriteMovie );
		$this->assertSame( "First line\nSecond line", $clean['clips'][0]['values']->caption );
		$composition['settings'] = $this->settings( $this->theme( 'default' ) );
		$this->assertInstanceOf( WP_Error::class, Clipisode_Composition::sanitize( $composition ) );
		$composition['clips'][0]['values'] = [];
		$composition['settings']['unregisteredSetting'] = true;
		$this->assertInstanceOf( WP_Error::class, Clipisode_Composition::sanitize( $composition ) );
	}

	public function test_conditional_required_fields_and_hidden_values_are_checked_separately(): void {
		$composition = CompositionTest::composition();
		unset( $composition['settings']['title'] );
		$this->assertInstanceOf( WP_Error::class, Clipisode_Composition::sanitize( $composition ) );
		$composition['settings']['showTitle'] = false;
		$this->assertIsArray( Clipisode_Composition::sanitize( $composition ) );
		$composition['settings']['title'] = 123;
		$this->assertInstanceOf( WP_Error::class, Clipisode_Composition::sanitize( $composition ) );
	}

	public function test_selected_background_must_be_included_and_match_its_tag_filter(): void {
		$composition = CompositionTest::composition();
		$composition['settings']['backgroundClip'] = 'reply-1';
		$this->assertInstanceOf( WP_Error::class, Clipisode_Composition::sanitize( $composition ) );
		$composition['clips'][0]['tags'] = [ 'background' ];
		$this->assertIsArray( Clipisode_Composition::sanitize( $composition ) );
		$composition['clips'][0]['included'] = false;
		$this->assertInstanceOf( WP_Error::class, Clipisode_Composition::sanitize( $composition ) );
		$composition['clips'][0]['included'] = true;
		$composition['settings']['backgroundClip'] = 'deleted-clip';
		$this->assertInstanceOf( WP_Error::class, Clipisode_Composition::sanitize( $composition ) );
	}

	public function test_background_only_with_no_cards_is_an_empty_timeline(): void {
		$composition = CompositionTest::composition();
		$composition['clips'][0]['tags'] = [ 'background' ];
		$composition['settings']['showTitle'] = false;
		$composition['settings']['showEnding'] = false;
		$this->assertInstanceOf( WP_Error::class, Clipisode_Composition::sanitize( $composition ) );
	}

	public function test_unknown_duplicate_and_exclusive_tags_are_rejected(): void {
		foreach ( [ [ 'unknown' ], [ 'end', 'end' ], [ 'background', 'end' ] ] as $tags ) {
			$composition = CompositionTest::composition();
			$composition['clips'][0]['tags'] = $tags;
			$this->assertInstanceOf( WP_Error::class, Clipisode_Composition::sanitize( $composition ) );
		}
	}

	public function test_tag_role_and_maximum_constraints_come_from_schema(): void {
		$theme = $this->theme();
		$theme['tags'][] = [ 'id' => 'special', 'label' => 'Special', 'roles' => [ 'intro' ], 'maxClips' => 1 ];
		$composition = CompositionTest::composition();
		$composition['clips'][0]['tags'] = [ 'special' ];
		$this->assertInstanceOf( WP_Error::class, $this->with_theme( $composition, $theme ) );
		$composition['clips'][0]['role'] = 'intro';
		$this->assertIsArray( $this->with_theme( $composition, $theme ) );
		$composition['clips'][] = array_merge( $composition['clips'][0], [ 'id' => 'intro-2', 'included' => false ] );
		$this->assertInstanceOf( WP_Error::class, $this->with_theme( $composition, $theme ) );
	}

	public function test_new_number_and_multiselect_fields_need_no_php_allowlist(): void {
		$theme = $this->theme();
		$theme['groups'][] = [ 'id' => 'custom', 'label' => 'Custom', 'scope' => 'composition', 'fields' => [
			[ 'id' => 'rating', 'label' => 'Rating', 'type' => 'number', 'default' => 1, 'min' => 1, 'max' => 5, 'step' => 0.5 ],
			[ 'id' => 'interests', 'label' => 'Interests', 'type' => 'multiselect', 'default' => [], 'options' => [ [ 'label' => 'Movies', 'value' => 'movies' ], [ 'label' => 'Music', 'value' => 'music' ] ] ],
		] ];
		$composition = CompositionTest::composition();
		$composition['settings']['rating'] = 3.5;
		$composition['settings']['interests'] = [ 'movies', 'music' ];
		$clean = $this->with_theme( $composition, $theme );
		$this->assertSame( 3.5, $clean['settings']['rating'] );
		$this->assertSame( [ 'movies', 'music' ], $clean['settings']['interests'] );
		foreach ( [ 0, 6, 3.25, '3.5' ] as $rating ) {
			$composition['settings']['rating'] = $rating;
			$this->assertInstanceOf( WP_Error::class, $this->with_theme( $composition, $theme ) );
		}
		$composition['settings']['rating'] = 3.5;
		$composition['settings']['interests'] = [ 'unknown' ];
		$this->assertInstanceOf( WP_Error::class, $this->with_theme( $composition, $theme ) );
	}

	public function test_clip_requirements_follow_role_tag_and_condition_scopes(): void {
		$theme = $this->theme();
		$theme['groups'][] = [ 'id' => 'ending-reply', 'label' => 'Ending reply', 'scope' => 'clip', 'appliesTo' => [ 'roles' => [ 'reply' ], 'tags' => [ 'end' ] ], 'fields' => [
			[ 'id' => 'detail', 'label' => 'Detail', 'type' => 'text', 'default' => '', 'when' => [ 'scope' => 'composition', 'field' => 'showNames', 'equals' => true ] ],
			[ 'id' => 'featured', 'label' => 'Featured', 'type' => 'toggle', 'default' => false, 'optional' => true ],
			[ 'id' => 'featureText', 'label' => 'Feature', 'type' => 'text', 'default' => '', 'when' => [ 'field' => 'featured', 'equals' => true ] ],
		] ];
		$composition = CompositionTest::composition();
		$this->assertIsArray( $this->with_theme( $composition, $theme ) );
		$composition['clips'][0]['tags'] = [ 'end' ];
		$this->assertInstanceOf( WP_Error::class, $this->with_theme( $composition, $theme ) );
		$composition['clips'][0]['values'] = [ 'detail' => 'Hello', 'featured' => true ];
		$this->assertInstanceOf( WP_Error::class, $this->with_theme( $composition, $theme ) );
		$composition['clips'][0]['values']['featureText'] = 'Spotlight';
		$this->assertIsArray( $this->with_theme( $composition, $theme ) );
		$composition['clips'][0]['role'] = 'intro';
		$composition['clips'][0]['values'] = [];
		$this->assertIsArray( $this->with_theme( $composition, $theme ) );
		$composition['clips'][0]['values'] = [ 'detail' => false ];
		$this->assertInstanceOf( WP_Error::class, $this->with_theme( $composition, $theme ) );
	}

	public function test_dynamic_clip_multiselect_respects_roles_and_tags(): void {
		$theme = $this->theme();
		$theme['groups'][] = [ 'id' => 'selection', 'label' => 'Selection', 'scope' => 'composition', 'fields' => [
			[ 'id' => 'selectedReplies', 'label' => 'Replies', 'type' => 'multiselect', 'default' => [], 'source' => [ 'kind' => 'clips', 'filter' => [ 'roles' => [ 'reply' ], 'tags' => [ 'end' ] ] ] ],
		] ];
		$composition = CompositionTest::composition();
		$composition['settings']['selectedReplies'] = [ 'reply-1' ];
		$this->assertInstanceOf( WP_Error::class, $this->with_theme( $composition, $theme ) );
		$composition['clips'][0]['tags'] = [ 'end' ];
		$this->assertIsArray( $this->with_theme( $composition, $theme ) );
		$composition['clips'][0]['role'] = 'intro';
		$this->assertInstanceOf( WP_Error::class, $this->with_theme( $composition, $theme ) );
	}
}
