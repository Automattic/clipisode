<?php

use PHPUnit\Framework\TestCase;

class SocialMetaTest extends TestCase {

	public function test_social_tags_are_removed_from_wp_head_markup(): void {
		$markup = <<<'HTML'
<meta charset="UTF-8">
<meta property="og:title" content="Theme title">
<meta content="Theme image" property='og:image'/>
<meta name="twitter:card" content="summary_large_image">
<meta content="Theme description" name='twitter:description' />
<meta name="description" content="Keep me">
<script src="example.js"></script>
HTML;

		$filtered = Clipisode_Social_Meta::strip_social_tags( $markup );

		$this->assertStringNotContainsString( 'og:title', $filtered );
		$this->assertStringNotContainsString( 'og:image', $filtered );
		$this->assertStringNotContainsString( 'twitter:card', $filtered );
		$this->assertStringNotContainsString( 'twitter:description', $filtered );
		$this->assertStringContainsString( 'name="description"', $filtered );
		$this->assertStringContainsString( '<script src="example.js"></script>', $filtered );
	}

	public function test_platforms_receive_their_preferred_image_first(): void {
		$variants = [
			'wide'     => [ 'id' => 1, 'url' => 'wide.png', 'width' => 1200, 'height' => 630, 'type' => 'image/png' ],
			'square'   => [ 'id' => 2, 'url' => 'square.png', 'width' => 1200, 'height' => 1200, 'type' => 'image/png' ],
			'portrait' => [ 'id' => 3, 'url' => 'portrait.png', 'width' => 1000, 'height' => 1500, 'type' => 'image/png' ],
		];

		$this->assertSame( 'square.png', Clipisode_Social_Meta::ordered_images( $variants, 'Slackbot-LinkExpanding 1.0' )[0]['url'] );
		$this->assertSame( 'square.png', Clipisode_Social_Meta::ordered_images( $variants, 'Mozilla/5.0 AppleWebKit/605.1.15' )[0]['url'] );
		$this->assertSame( 'portrait.png', Clipisode_Social_Meta::ordered_images( $variants, 'Pinterestbot/1.0' )[0]['url'] );
		$this->assertSame( 'wide.png', Clipisode_Social_Meta::ordered_images( $variants, 'facebookexternalhit/1.1' )[0]['url'] );
		$this->assertSame( 'wide.png', Clipisode_Social_Meta::ordered_images( $variants, 'LinkedInBot/1.0' )[0]['url'] );
	}

	public function test_missing_preferred_format_falls_back_without_duplicates(): void {
		$variants = [
			'wide' => [ 'id' => 1, 'url' => 'wide.png', 'width' => 1200, 'height' => 630, 'type' => 'image/png' ],
		];
		$ordered = Clipisode_Social_Meta::ordered_images( $variants, 'Slackbot-LinkExpanding 1.0' );

		$this->assertCount( 1, $ordered );
		$this->assertSame( 'wide.png', $ordered[0]['url'] );
	}
}
