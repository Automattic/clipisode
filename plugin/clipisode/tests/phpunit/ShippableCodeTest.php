<?php

use PHPUnit\Framework\TestCase;

/**
 * Guards against development-only code reaching a customer install.
 *
 * A disposable IAPI spike (plugin/clipisode/spike/) shipped in every build for
 * months because its `require_once` was added to clipisode.php during
 * development and never removed, despite the spike's own docblock documenting
 * the teardown step. It registered a public /clipisode-spike rewrite on every
 * site that installed the plugin.
 *
 * These tests fail the build rather than relying on anyone remembering.
 */
class ShippableCodeTest extends TestCase {

	private const DEV_ONLY_DIRS = [ 'spike', 'z_screenshots', 'scratch', 'tmp' ];

	private static function plugin_dir(): string {
		return dirname( __DIR__, 2 ) . '/';
	}

	private static function bootstrap_source(): string {
		return (string) file_get_contents( self::plugin_dir() . 'clipisode.php' );
	}

	/**
	 * The plugin bootstrap must not load anything from a dev-only directory.
	 *
	 * Matches require/require_once/include/include_once against the known
	 * dev directory names, whether referenced via CLIPISODE_PLUGIN_DIR,
	 * __DIR__, or a bare relative path.
	 */
	public function test_bootstrap_does_not_load_dev_only_directories(): void {
		$source = self::bootstrap_source();

		foreach ( self::DEV_ONLY_DIRS as $dir ) {
			$pattern = '/\b(?:require|include)(?:_once)?\b[^;]*[\'"\/]'
				. preg_quote( $dir, '/' ) . '\//i';

			$this->assertSame(
				0,
				preg_match( $pattern, $source ),
				"clipisode.php loads code from the dev-only directory '{$dir}/'. "
					. 'Remove the require before shipping.'
			);
		}
	}

	/**
	 * Dev-only directories must not exist inside the plugin at all, so they
	 * cannot be swept into a release zip by `npm run plugin`.
	 */
	public function test_dev_only_directories_are_absent(): void {
		foreach ( self::DEV_ONLY_DIRS as $dir ) {
			$this->assertDirectoryDoesNotExist(
				self::plugin_dir() . $dir,
				"The dev-only directory '{$dir}/' is present in the plugin and "
					. 'would be included in a release build.'
			);
		}
	}

	/**
	 * Every file the bootstrap requires must actually exist.
	 *
	 * Catches the inverse failure: deleting a dev directory (or renaming an
	 * includes/ file) while leaving a require behind, which fatals on load.
	 */
	public function test_every_bootstrap_require_resolves(): void {
		$source = self::bootstrap_source();

		preg_match_all(
			'/\b(?:require|include)(?:_once)?\s*\(?\s*CLIPISODE_PLUGIN_DIR\s*\.\s*[\'"]([^\'"]+)[\'"]/',
			$source,
			$matches
		);

		$this->assertNotEmpty(
			$matches[1],
			'Expected clipisode.php to require its includes/ classes; found none. '
				. 'Has the bootstrap been restructured?'
		);

		foreach ( $matches[1] as $relative_path ) {
			$this->assertFileExists(
				self::plugin_dir() . $relative_path,
				"clipisode.php requires '{$relative_path}', which does not exist."
			);
		}
	}
}
