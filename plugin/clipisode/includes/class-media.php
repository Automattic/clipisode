<?php

defined( 'ABSPATH' ) || exit;

class Clipisode_Media {

	const META_KEY = '_clipisode_managed';

	const ALLOWED_EXTENSIONS = [ 'mp4', 'mov', 'webm', 'm4v' ];

	const ALLOWED_MIME_TYPES = [
		'video/mp4',
		'video/quicktime',
		'video/webm',
		'video/x-m4v',
	];

	const MAX_FILE_SIZE = 83886080; // 80 MB

	public function register_hooks(): void {
		add_filter( 'ajax_query_attachments_args', [ $this, 'hide_from_media_grid' ] );
		add_action( 'pre_get_posts', [ $this, 'hide_from_media_list' ] );
	}

	public function hide_from_media_grid( array $query ): array {
		$query['meta_query']   = $query['meta_query'] ?? [];
		$query['meta_query'][] = [
			'key'     => self::META_KEY,
			'compare' => 'NOT EXISTS',
		];
		return $query;
	}

	public function hide_from_media_list( WP_Query $query ): void {
		global $pagenow;
		if ( 'upload.php' !== $pagenow ) {
			return;
		}
		if ( 'attachment' !== $query->get( 'post_type' ) ) {
			return;
		}

		$meta_query   = $query->get( 'meta_query' ) ?: [];
		$meta_query[] = [
			'key'     => self::META_KEY,
			'compare' => 'NOT EXISTS',
		];
		$query->set( 'meta_query', $meta_query );
	}
}
