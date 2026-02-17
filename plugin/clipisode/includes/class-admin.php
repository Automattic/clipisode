<?php

defined( 'ABSPATH' ) || exit;

class Clipisode_Admin {

	public function register_menus(): void {
		$hook = add_menu_page(
			'Clipisode',
			'Clipisode',
			'manage_options',
			'clipisode',
			[ $this, 'render_page' ],
			'dashicons-video-alt3',
			30
		);

		add_submenu_page( 'clipisode', 'Topics', 'Topics', 'manage_options', 'clipisode', [ $this, 'render_page' ] );
		add_submenu_page( 'clipisode', 'Clips', 'Clips', 'manage_options', 'clipisode-clips', [ $this, 'render_page' ] );
		add_submenu_page( 'clipisode', 'Settings', 'Settings', 'manage_options', 'clipisode-settings', [ $this, 'render_page' ] );

		add_action( "admin_print_styles-$hook", [ $this, 'enqueue_assets' ] );
		add_action( 'admin_enqueue_scripts', [ $this, 'maybe_enqueue' ] );
	}

	public function maybe_enqueue( string $hook_suffix ): void {
		$screen = get_current_screen();
		if ( ! $screen || strpos( $screen->id, 'clipisode' ) === false ) {
			return;
		}
		$this->enqueue_assets();
	}

	public function enqueue_assets(): void {
		static $enqueued = false;
		if ( $enqueued ) {
			return;
		}
		$enqueued = true;

		$asset_file = CLIPISODE_PLUGIN_DIR . 'build/index.asset.php';
		if ( ! file_exists( $asset_file ) ) {
			return;
		}

		$asset = require $asset_file;

		wp_enqueue_script(
			'clipisode-admin',
			CLIPISODE_PLUGIN_URL . 'build/index.js',
			$asset['dependencies'],
			$asset['version'],
			true
		);

		wp_enqueue_style(
			'clipisode-admin',
			CLIPISODE_PLUGIN_URL . 'build/index.css',
			[ 'wp-components' ],
			$asset['version']
		);

		wp_localize_script( 'clipisode-admin', 'clipisodeAdmin', [
			'page' => isset( $_GET['page'] ) ? sanitize_text_field( $_GET['page'] ) : 'clipisode',
		] );
	}

	public function render_page(): void {
		echo '<div id="clipisode-root"></div>';
	}
}
