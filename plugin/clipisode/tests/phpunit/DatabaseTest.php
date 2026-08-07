<?php

use PHPUnit\Framework\TestCase;

/**
 * Covers schema versioning and the upgrade lock.
 *
 * The lock is the subtle part. On a deploy many PHP workers pick up new code
 * within the same second, all see a stale clipisode_db_version, and would all
 * run ALTER TABLE against the same tables at once. These tests pin the
 * behaviour that prevents that.
 */
class DatabaseTest extends TestCase {

	protected function setUp(): void {
		parent::setUp();
		clipisode_test_reset_options();

		global $wpdb, $clipisode_test_dbdelta_calls;
		$clipisode_test_dbdelta_calls = [];
		$wpdb = new Clipisode_Test_WPDB();
	}

	private function dbdelta_call_count(): int {
		global $clipisode_test_dbdelta_calls;
		return count( $clipisode_test_dbdelta_calls );
	}

	public function test_fresh_site_creates_tables_and_records_version(): void {
		Clipisode_Database::maybe_upgrade();

		$this->assertGreaterThan(
			0,
			$this->dbdelta_call_count(),
			'A site with no recorded schema version should have its tables created.'
		);
		$this->assertSame(
			Clipisode_Database::DB_VERSION,
			get_option( Clipisode_Database::VERSION_OPTION )
		);
	}

	public function test_current_version_skips_the_upgrade(): void {
		update_option( Clipisode_Database::VERSION_OPTION, Clipisode_Database::DB_VERSION );

		Clipisode_Database::maybe_upgrade();

		$this->assertSame(
			0,
			$this->dbdelta_call_count(),
			'An up-to-date site must not run dbDelta on every request.'
		);
	}

	/**
	 * The case that was silently broken: activation hooks do not fire when a
	 * plugin is updated in place, so a stale version had no way to be noticed.
	 */
	public function test_stale_version_triggers_the_upgrade(): void {
		update_option( Clipisode_Database::VERSION_OPTION, '1' );

		Clipisode_Database::maybe_upgrade();

		$this->assertGreaterThan( 0, $this->dbdelta_call_count() );
		$this->assertSame(
			Clipisode_Database::DB_VERSION,
			get_option( Clipisode_Database::VERSION_OPTION )
		);
	}

	public function test_lock_is_released_after_a_successful_upgrade(): void {
		Clipisode_Database::maybe_upgrade();

		$this->assertFalse(
			get_option( Clipisode_Database::LOCK_OPTION ),
			'A held lock would block every later upgrade until it expired.'
		);
	}

	public function test_a_freshly_held_lock_blocks_a_concurrent_request(): void {
		add_option( Clipisode_Database::LOCK_OPTION, (string) time(), '', false );

		Clipisode_Database::maybe_upgrade();

		$this->assertSame(
			0,
			$this->dbdelta_call_count(),
			'A second worker must not run dbDelta while the first holds the lock.'
		);
		$this->assertFalse(
			get_option( Clipisode_Database::VERSION_OPTION ),
			'A blocked request must not claim the upgrade finished.'
		);
	}

	/**
	 * A request killed mid-dbDelta leaves its lock behind. Without takeover the
	 * site's schema would stay stale permanently.
	 */
	public function test_an_abandoned_lock_is_taken_over(): void {
		$stale = time() - ( Clipisode_Database::LOCK_TIMEOUT + 1 );
		add_option( Clipisode_Database::LOCK_OPTION, (string) $stale, '', false );

		Clipisode_Database::maybe_upgrade();

		$this->assertGreaterThan(
			0,
			$this->dbdelta_call_count(),
			'A lock older than LOCK_TIMEOUT should be treated as abandoned.'
		);
		$this->assertSame(
			Clipisode_Database::DB_VERSION,
			get_option( Clipisode_Database::VERSION_OPTION )
		);
	}

	/**
	 * The indexes added in DB_VERSION 2. Asserting on the emitted SQL keeps a
	 * later edit from dropping one without bumping DB_VERSION, which would
	 * leave existing sites unindexed with no signal.
	 */
	public function test_schema_declares_the_query_path_indexes(): void {
		Clipisode_Database::maybe_upgrade();

		global $clipisode_test_dbdelta_calls;
		$sql = implode( "\n", $clipisode_test_dbdelta_calls );

		$expected = [
			'KEY topic_status_created (topic_id,status,created_at)',
			'KEY topic_created (topic_id,created_at)',
			'KEY invitation_link_id (invitation_link_id)',
			'KEY invitation_id (invitation_id)',
		];

		foreach ( $expected as $index ) {
			$this->assertStringContainsString(
				$index,
				$sql,
				"Schema no longer declares: {$index}"
			);
		}
	}

	public function test_every_table_is_declared(): void {
		Clipisode_Database::maybe_upgrade();

		global $clipisode_test_dbdelta_calls;
		$sql = implode( "\n", $clipisode_test_dbdelta_calls );

		$tables = [
			'clipisode_media',
			'clipisode_topics',
			'clipisode_invitation_links',
			'clipisode_hosts',
			'clipisode_replies',
			'clipisode_outputs',
			'clipisode_contents',
		];

		foreach ( $tables as $table ) {
			$this->assertStringContainsString( "CREATE TABLE wp_{$table} (", $sql );
		}
	}
}

class Clipisode_Test_WPDB {

	public string $prefix = 'wp_';

	public function get_charset_collate(): string {
		return 'DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_520_ci';
	}
}
