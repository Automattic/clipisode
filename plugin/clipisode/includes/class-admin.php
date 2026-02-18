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
		add_submenu_page( 'clipisode', 'Replies', 'Replies', 'manage_options', 'clipisode-replies', [ $this, 'render_page' ] );
		add_submenu_page( 'clipisode', 'Clipisodes', 'Clipisodes', 'manage_options', 'clipisode-clipisodes', [ $this, 'render_page' ] );
		add_submenu_page( 'clipisode', 'Media', 'Media', 'manage_options', 'clipisode-media', [ $this, 'render_page' ] );
		add_submenu_page( 'clipisode', 'Themes', 'Themes', 'manage_options', 'clipisode-themes', [ $this, 'render_page' ] );
		add_submenu_page( 'clipisode', 'Settings', 'Settings', 'manage_options', 'clipisode-settings', [ $this, 'render_page' ] );

		add_action( "admin_print_styles-$hook", [ $this, 'enqueue_assets' ] );
		add_action( 'admin_enqueue_scripts', [ $this, 'maybe_enqueue' ] );
		add_action( 'admin_init', [ $this, 'redirect_cpt_list' ] );
	}

	public function redirect_cpt_list(): void {
		global $pagenow;
		if (
			$pagenow === 'edit.php' &&
			isset( $_GET['post_type'] ) &&
			$_GET['post_type'] === 'clipisode_invite'
		) {
			wp_safe_redirect( admin_url( 'admin.php?page=clipisode-themes' ) );
			exit;
		}
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
			'page'      => isset( $_GET['page'] ) ? sanitize_text_field( $_GET['page'] ) : 'clipisode',
			'rest_root' => esc_url_raw( rest_url() ),
			'nonce'     => wp_create_nonce( 'wp_rest' ),
		] );
	}

	public function render_page(): void {
		echo '<div id="clipisode-root"></div>';
	}
}
