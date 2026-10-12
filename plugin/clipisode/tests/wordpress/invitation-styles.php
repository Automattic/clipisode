<?php
/**
 * Run with wp eval-file tests/wordpress/invitation-styles.php on a test site
 * with Clipisode active. No posts, options, or theme files are changed.
 */

$assert = static function ( bool $condition, string $message ): void {
	if ( ! $condition ) {
		throw new RuntimeException( $message );
	}
};
$theme_data = static function ( WP_Theme_JSON_Data $data ): WP_Theme_JSON_Data {
	return $data->update_with( [
		'version'  => 2,
		'settings' => [ 'custom' => [ 'clipisode' => [ 'invitation' => [ 'border' => '#987654' ] ] ] ],
		'styles'   => [
			'color'    => [ 'background' => '#123456', 'text' => '#fedcba' ],
			'elements' => [
				'link'   => [ 'color' => [ 'text' => '#abcdef' ] ],
				'button' => [ 'color' => [ 'background' => '#112233' ], 'border' => [ 'radius' => '12px' ] ],
			],
			'blocks' => [ 'core/button' => [ 'color' => [ 'background' => '#223344' ] ] ],
		],
	] );
};
add_filter( 'wp_theme_json_data_theme', $theme_data );
WP_Theme_JSON_Resolver::clean_cached_data();
try {
	$tokens = Clipisode_Invitation_Styles::tokens( 123 );
	$assert( '#123456' === $tokens['background'], 'Site background is inherited.' );
	$assert( '#fedcba' === $tokens['text'], 'Site text is inherited.' );
	$assert( '#abcdef' === $tokens['link'], 'Site link is inherited.' );
	$assert( '#223344' === $tokens['accent'], 'Button block style takes precedence over button element style.' );
	$assert( '12px' === $tokens['radius'], 'Site button radius is inherited.' );
	$assert( '#987654' === $tokens['border'], 'Invitation custom settings override automatic tokens.' );

	$override = static function ( array $tokens, int $theme_id ): array {
		if ( 123 === $theme_id ) {
			$tokens['accent'] = '#aabbcc';
		}
		return $tokens;
	};
	add_filter( 'clipisode_invitation_style_tokens', $override, 10, 2 );
	$assert( '#aabbcc' === Clipisode_Invitation_Styles::tokens( 123 )['accent'], 'Clipisode theme overrides its accent.' );
	$assert( '#223344' === Clipisode_Invitation_Styles::tokens( 124 )['accent'], 'Clipisode theme overrides are isolated.' );
	$assert( str_contains( Clipisode_Invitation_Styles::css_variables( 123 ), '--clipisode-invitation-accent:#aabbcc;' ), 'Theme override reaches CSS.' );
	remove_filter( 'clipisode_invitation_style_tokens', $override );

	$user_data = static function ( WP_Theme_JSON_Data $data ): WP_Theme_JSON_Data {
		return $data->update_with( [ 'version' => 2, 'styles' => [ 'color' => [ 'background' => '#445566' ] ] ] );
	};
	add_filter( 'wp_theme_json_data_user', $user_data );
	WP_Theme_JSON_Resolver::clean_cached_data();
	$assert( '#445566' === Clipisode_Invitation_Styles::tokens( 123 )['background'], 'Site Editor overrides are included.' );
	remove_filter( 'wp_theme_json_data_user', $user_data );
} finally {
	remove_filter( 'wp_theme_json_data_theme', $theme_data );
	WP_Theme_JSON_Resolver::clean_cached_data();
}

$assert( str_contains( Clipisode_Invitation_Styles::css_variables( 0 ), '--clipisode-invitation-border:' ), 'Absent custom settings do not replace tokens with the full settings tree.' );
$sizes = [ [ 'slug' => 'medium', 'size' => '1.75rem', 'name' => 'Site body' ] ];
$context = (object) [ 'post' => new WP_Post( (object) [ 'post_type' => 'clipisode_screen' ] ) ];
$settings = Clipisode_Post_Types::filter_screen_editor_font_settings( [
	'typography' => [ 'fontSizes' => $sizes ],
	'__experimentalFeatures' => [ 'typography' => [ 'fontSizes' => $sizes ] ],
], $context );
$assert( $sizes === $settings['typography']['fontSizes'], 'The editor retains the site font-size presets.' );
$assert( $sizes === $settings['__experimentalFeatures']['typography']['fontSizes'], 'The editor feature settings retain the site font-size presets.' );
echo "Invitation styling integration checks passed.\n";
