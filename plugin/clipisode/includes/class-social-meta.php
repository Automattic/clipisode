<?php

defined( 'ABSPATH' ) || exit;

final class Clipisode_Social_Meta {

	/**
	 * Remove Open Graph and Twitter Card tags emitted by themes or SEO plugins.
	 * Clipisode templates print their own resource-specific tags before wp_head().
	 */
	public static function strip_social_tags( string $markup ): string {
		$filtered = preg_replace(
			'/<meta\b(?=[^>]*(?:name|property)\s*=\s*["\'](?:og:|twitter:))[^>]*>\s*/i',
			'',
			$markup
		);

		return is_string( $filtered ) ? $filtered : $markup;
	}

	/**
	 * Run wp_head() while keeping Clipisode's social metadata authoritative.
	 */
	public static function print_filtered_wp_head(): void {
		ob_start();
		wp_head();
		$markup = (string) ob_get_clean();

		// wp_head() output is trusted WordPress/plugin markup and must remain intact.
		// phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
		echo self::strip_social_tags( $markup );
	}
}
