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
		global $wpdb, $test_attachment_urls;
		$test_attachment_urls = [
			11 => 'https://example.com/topic.png',
			22 => 'https://example.com/invitation.png',
		];
		$wpdb = new class() {
			public string $prefix = 'wp_';
			public function prepare( string $query, int $id ): array {
				return [ $query, $id ];
			}
			public function get_row( array $prepared ): object {
				return (object) [
					'storage'       => 'local',
					'attachment_id' => $prepared[1],
				];
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
}
