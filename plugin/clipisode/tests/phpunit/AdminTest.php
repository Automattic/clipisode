<?php

use PHPUnit\Framework\TestCase;

require_once CLIPISODE_PLUGIN_DIR . 'includes/class-admin.php';
require_once CLIPISODE_PLUGIN_DIR . 'includes/class-invitation.php';
require_once CLIPISODE_PLUGIN_DIR . 'includes/class-preview.php';

class AdminTest extends TestCase {
	/**
	 * @dataProvider environments
	 * @runInSeparateProcess
	 * @preserveGlobalState disabled
	 */
	public function test_admin_configuration_preserves_json_types( string $environment, bool $production, ?string $license ): void {
		global $test_environment_type, $test_inline_scripts, $test_options;
		$test_environment_type = $environment;
		$test_inline_scripts = [];
		$test_options = [ 'clipisode_debug_mode' => '1', 'clipisode_invitation_prefix' => 'join', 'clipisode_preview_prefix' => 'watch' ];
		$_GET['page'] = 'clipisode-media';
		if ( null !== $license ) {
			define( 'CLIPISODE_REMOTION_LICENSE_KEY', $license );
		}
		$directory = CLIPISODE_PLUGIN_DIR . 'build';
		$asset_file = $directory . '/index.asset.php';
		$created_directory = ! is_dir( $directory );
		$created_asset = ! file_exists( $asset_file );
		if ( $created_directory ) {
			mkdir( $directory );
		}
		if ( $created_asset ) {
			file_put_contents( $asset_file, '<?php return [ "dependencies" => [], "version" => "test" ];' );
		}
		try {
			( new Clipisode_Admin() )->enqueue_assets();
		} finally {
			if ( $created_asset ) {
				unlink( $asset_file );
			}
			if ( $created_directory ) {
				rmdir( $directory );
			}
		}
		$this->assertCount( 1, $test_inline_scripts );
		$inline = $test_inline_scripts[0];
		$this->assertSame( 'clipisode-admin', $inline['handle'] );
		$this->assertSame( 'before', $inline['position'] );
		$this->assertStringStartsWith( 'window.clipisodeAdmin = ', $inline['script'] );
		$config = json_decode( substr( $inline['script'], strlen( 'window.clipisodeAdmin = ' ), -1 ), true, 512, JSON_THROW_ON_ERROR );
		$this->assertSame( [
			'page' => 'clipisode-media',
			'home_url' => 'https://example.com/site/',
			'rest_root' => 'https://example.com/wp-json/',
			'nonce' => 'test-rest-nonce',
			'invitation_prefix' => 'join',
			'preview_prefix' => 'watch',
			'debug_mode' => true,
			'remotion_license_key' => $license,
			'remotion_is_production' => $production,
		], $config );
	}

	public static function environments(): array {
		return [
			'local without license' => [ 'local', false, null ],
			'production with license' => [ 'production', true, 'test-license' ],
		];
	}
}
