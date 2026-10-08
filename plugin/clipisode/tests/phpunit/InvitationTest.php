<?php

use PHPUnit\Framework\TestCase;

require_once CLIPISODE_PLUGIN_DIR . 'includes/class-invitation.php';

if ( ! function_exists( 'add_rewrite_rule' ) ) {
	function add_rewrite_rule( string $regex, string $query, string $after = 'bottom' ): void {
		global $test_rewrite_rules;
		$test_rewrite_rules[] = [ $regex, $query, $after ];
	}
}

class InvitationTest extends TestCase {
	protected function setUp(): void {
		global $test_options, $test_rewrite_rules;
		$test_options = [];
		$test_rewrite_rules = [];
	}

	public function test_default_path_is_preserved(): void {
		$this->assertSame( 'invitation', Clipisode_Invitation::get_prefix() );
		( new Clipisode_Invitation() )->register_rewrite();
		global $test_rewrite_rules;
		$this->assertSame( '^invitation/([a-zA-Z0-9]+)/?$', $test_rewrite_rules[0][0] );
	}

	public function test_nested_path_is_sanitized_and_routed(): void {
		global $test_options, $test_rewrite_rules;
		$path = Clipisode_Invitation::sanitize_prefix( '/Clipisode//My Invitation/' );
		$this->assertSame( 'clipisode/my-invitation', $path );
		$test_options['clipisode_invitation_prefix'] = $path;
		( new Clipisode_Invitation() )->register_rewrite();
		$this->assertSame( [
			'^clipisode\\/my\\-invitation/([a-zA-Z0-9]+)/?$',
			'index.php?clipisode_invite=$matches[1]',
			'top',
		], $test_rewrite_rules[0] );
		$this->assertSame( 1, preg_match( '#' . $test_rewrite_rules[0][0] . '#', 'clipisode/my-invitation/ABC123/' ) );
		$this->assertSame( 0, preg_match( '#' . $test_rewrite_rules[0][0] . '#', 'invitation/ABC123/' ) );
	}

	public function test_invitation_social_image_overrides_topic_image(): void {
		global $wpdb, $test_attachment_urls, $test_social_media_rows;
		$test_attachment_urls = [
			11 => 'https://example.com/topic.png',
			22 => 'https://example.com/invitation.png',
			23 => 'https://example.com/invitation-square.png',
			24 => 'https://example.com/invitation-portrait.png',
		];
		$test_social_media_rows = [
			11 => [ (object) [ 'id' => 11, 'label' => 'asset', 'storage' => 'local', 'attachment_id' => 11, 'mime_type' => 'image/png' ] ],
			22 => [
				(object) [ 'id' => 22, 'label' => 'social-wide', 'storage' => 'local', 'attachment_id' => 22, 'mime_type' => 'image/png' ],
				(object) [ 'id' => 23, 'label' => 'social-square', 'storage' => 'local', 'attachment_id' => 23, 'mime_type' => 'image/png' ],
				(object) [ 'id' => 24, 'label' => 'social-portrait', 'storage' => 'local', 'attachment_id' => 24, 'mime_type' => 'image/png' ],
			],
		];
		$wpdb = new class() {
			public string $prefix = 'wp_';
			public function prepare( string $query, mixed ...$values ): array {
				return [ $query, ...$values ];
			}
			public function get_row( array $prepared ): object {
				return (object) [
					'storage'       => 'local',
					'attachment_id' => $prepared[1],
				];
			}
			public function get_results( array $prepared ): array {
				global $test_social_media_rows;
				return $test_social_media_rows[ $prepared[1] ] ?? [];
			}
		};

		$topic = (object) [ 'social_image_media_id' => 11 ];
		$this->assertSame(
			'https://example.com/topic.png',
			Clipisode_Invitation::get_social_image_url( (object) [], $topic )
		);
		$this->assertSame(
			'https://example.com/invitation.png',
			Clipisode_Invitation::get_social_image_url(
				(object) [ 'social_image_media_id' => 22 ],
				$topic
			)
		);
		$images = Clipisode_Invitation::get_social_images(
			(object) [ 'social_image_media_id' => 22 ],
			$topic
		);
		$this->assertSame( 'https://example.com/invitation-square.png', $images['variants']['square']['url'] );
		$this->assertSame( 1200, $images['variants']['square']['width'] );
		$this->assertSame( 'https://example.com/invitation-portrait.png', $images['variants']['portrait']['url'] );
		$this->assertSame( 1500, $images['variants']['portrait']['height'] );
	}

	public function test_social_description_names_the_host_when_available(): void {
		$this->assertSame(
			'Share a video reply with Max.',
			Clipisode_Invitation::get_social_description( (object) [ 'hosted_by' => 'Max' ] )
		);
		$this->assertSame(
			'Share a video reply.',
			Clipisode_Invitation::get_social_description( (object) [] )
		);
	}

	public function test_share_url_changes_when_the_social_image_changes(): void {
		$this->assertSame(
			'https://example.com/site/invitation/ABC123/',
			Clipisode_Invitation::get_share_url( 'ABC123' )
		);
		$this->assertSame(
			'https://example.com/site/invitation/ABC123/?v=42',
			Clipisode_Invitation::get_share_url( 'ABC123', 42 )
		);
	}
}
