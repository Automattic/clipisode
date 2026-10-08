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
}
