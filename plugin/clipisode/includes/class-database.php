<?php

defined( 'ABSPATH' ) || exit;

class Clipisode_Database {

	public static function activate(): void {
		ob_start();
		self::create_tables();
		self::seed();
		Clipisode_Post_Types::ensure_default_invitation();
		ob_end_clean();
	}

	private static function create_tables(): void {
		global $wpdb;
		$charset = $wpdb->get_charset_collate();

		require_once ABSPATH . 'wp-admin/includes/upgrade.php';

		dbDelta(
			"CREATE TABLE {$wpdb->prefix}clipisode_topics (
id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
title VARCHAR(255) NOT NULL,
intro_video_id BIGINT UNSIGNED DEFAULT NULL,
hosted_by VARCHAR(255),
brand_terms_id BIGINT UNSIGNED NOT NULL,
custom_terms_id BIGINT UNSIGNED DEFAULT NULL,
invitation_id BIGINT UNSIGNED DEFAULT NULL,
status VARCHAR(20) NOT NULL DEFAULT 'active',
created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
PRIMARY KEY  (id)
) $charset;"
		);

		dbDelta(
			"CREATE TABLE {$wpdb->prefix}clipisode_invitation_links (
id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
topic_id BIGINT UNSIGNED NOT NULL,
slug VARCHAR(20) NOT NULL,
type VARCHAR(20) NOT NULL DEFAULT 'clip',
status VARCHAR(20) NOT NULL DEFAULT 'open',
clicks BIGINT UNSIGNED NOT NULL DEFAULT 0,
created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
PRIMARY KEY  (id),
UNIQUE KEY slug (slug),
KEY topic_id (topic_id)
) $charset;"
		);

		dbDelta(
			"CREATE TABLE {$wpdb->prefix}clipisode_hosts (
id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
name VARCHAR(255) NOT NULL,
created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
PRIMARY KEY  (id),
UNIQUE KEY name (name)
) $charset;"
		);

		dbDelta(
			"CREATE TABLE {$wpdb->prefix}clipisode_clips (
id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
topic_id BIGINT UNSIGNED NOT NULL,
invitation_link_id BIGINT UNSIGNED,
name VARCHAR(255) NOT NULL,
video_url TEXT,
transcript TEXT,
social_handle VARCHAR(255),
social_network VARCHAR(50),
tag VARCHAR(100),
status VARCHAR(20) NOT NULL DEFAULT 'unapproved',
email VARCHAR(255),
brand_terms_id BIGINT UNSIGNED DEFAULT NULL,
brand_terms_revision_id BIGINT UNSIGNED DEFAULT NULL,
custom_terms_id BIGINT UNSIGNED DEFAULT NULL,
custom_terms_revision_id BIGINT UNSIGNED DEFAULT NULL,
created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
PRIMARY KEY  (id),
KEY topic_id (topic_id),
KEY status (status)
) $charset;"
		);

		dbDelta(
			"CREATE TABLE {$wpdb->prefix}clipisode_outputs (
id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
topic_id BIGINT UNSIGNED DEFAULT NULL,
name VARCHAR(255) NOT NULL,
slug VARCHAR(255) NOT NULL,
attachment_id BIGINT UNSIGNED DEFAULT NULL,
created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
PRIMARY KEY  (id),
UNIQUE KEY slug (slug),
KEY topic_id (topic_id)
) $charset;"
		);
	}

	private static function seed(): void {
		global $wpdb;

		$topics_table = $wpdb->prefix . 'clipisode_topics';
		$count        = (int) $wpdb->get_var( "SELECT COUNT(*) FROM $topics_table" );
		if ( $count > 0 ) {
			return;
		}

		Clipisode_Post_Types::register();
		$brand_terms_id  = Clipisode_Post_Types::ensure_brand_terms();
		$invitation_id   = Clipisode_Post_Types::ensure_default_invitation();

		$custom_terms_id = wp_insert_post( [
			'post_type'    => 'clipisode_terms',
			'post_title'   => 'Nationwide UGC Legal Conditions',
			'post_content' => '<p>By submitting a video you grant Nationwide Social a perpetual, worldwide license to use your submission in marketing materials.</p>',
			'post_status'  => 'publish',
		] );
		update_post_meta( $custom_terms_id, Clipisode_Post_Types::TERMS_TYPE_META, 'custom' );

		$hosts_table = $wpdb->prefix . 'clipisode_hosts';
		$wpdb->insert( $hosts_table, [ 'name' => 'Nationwide Social' ] );
		$wpdb->insert( $hosts_table, [ 'name' => 'Acme Brand' ] );

		$wpdb->insert( $topics_table, [
			'title'           => 'Peyton and I need your help!',
			'hosted_by'       => 'Nationwide Social',
			'status'          => 'active',
			'brand_terms_id'  => $brand_terms_id,
			'custom_terms_id' => $custom_terms_id,
			'invitation_id'   => $invitation_id,
		] );
		$topic_1 = $wpdb->insert_id;

		$wpdb->insert( $topics_table, [
			'title'          => 'Fan Challenge 2026',
			'hosted_by'      => 'Acme Brand',
			'status'         => 'active',
			'brand_terms_id' => $brand_terms_id,
			'invitation_id'  => $invitation_id,
		] );
		$topic_2 = $wpdb->insert_id;

		$links_table = $wpdb->prefix . 'clipisode_invitation_links';

		$wpdb->insert( $links_table, [ 'topic_id' => $topic_1, 'slug' => 'd3137f', 'status' => 'open', 'clicks' => 2561 ] );
		$link_1 = $wpdb->insert_id;
		$wpdb->insert( $links_table, [ 'topic_id' => $topic_1, 'slug' => 'e2a2b1', 'status' => 'open', 'clicks' => 329 ] );
		$wpdb->insert( $links_table, [ 'topic_id' => $topic_1, 'slug' => 'fb1be3', 'status' => 'open', 'clicks' => 1092 ] );
		$wpdb->insert( $links_table, [ 'topic_id' => $topic_2, 'slug' => 'x9k4m2', 'status' => 'open', 'clicks' => 87 ] );

		$clips_table = $wpdb->prefix . 'clipisode_clips';

		$sample_clips = [
			[ 'topic_id' => $topic_1, 'invitation_link_id' => $link_1, 'name' => 'Ace Rice', 'transcript' => 'Mhm. Yeah. You\'re happy with your band on the road? No traveling with your team.', 'social_handle' => '@acerice', 'social_network' => 'instagram', 'tag' => 'funny', 'status' => 'approved', 'brand_terms_id' => $brand_terms_id, 'custom_terms_id' => $custom_terms_id ],
			[ 'topic_id' => $topic_1, 'invitation_link_id' => $link_1, 'name' => 'Maria Santos', 'transcript' => 'I just wanted to say thank you for everything you do for the community.', 'social_handle' => '@mariasantos', 'social_network' => 'tiktok', 'status' => 'unapproved', 'brand_terms_id' => $brand_terms_id, 'custom_terms_id' => $custom_terms_id ],
			[ 'topic_id' => $topic_1, 'invitation_link_id' => $link_1, 'name' => 'Jake Thompson', 'transcript' => 'Hey Peyton! Big fan here from Indiana. What\'s your favorite pre-game meal?', 'social_handle' => '@jakethompson', 'social_network' => 'x', 'tag' => 'question', 'status' => 'unapproved', 'brand_terms_id' => $brand_terms_id, 'custom_terms_id' => $custom_terms_id ],
			[ 'topic_id' => $topic_1, 'invitation_link_id' => $link_1, 'name' => 'Lisa Chen', 'transcript' => 'Our family watches every single game. You\'re an inspiration to my kids.', 'social_handle' => '@lisachen', 'social_network' => 'instagram', 'status' => 'on_hold', 'brand_terms_id' => $brand_terms_id, 'custom_terms_id' => $custom_terms_id ],
			[ 'topic_id' => $topic_2, 'invitation_link_id' => null, 'name' => 'Tom Baker', 'transcript' => 'This challenge was so much fun, I got my whole office involved!', 'social_handle' => '@tombaker', 'social_network' => 'tiktok', 'tag' => 'office', 'status' => 'approved', 'brand_terms_id' => $brand_terms_id ],
			[ 'topic_id' => $topic_2, 'invitation_link_id' => null, 'name' => 'Sarah Kim', 'transcript' => 'Check out our team\'s attempt. Nailed it on the third try!', 'social_handle' => '@sarahkim', 'social_network' => 'instagram', 'status' => 'rejected', 'brand_terms_id' => $brand_terms_id ],
		];

		foreach ( $sample_clips as $clip ) {
			$wpdb->insert( $clips_table, $clip );
		}
	}
}
