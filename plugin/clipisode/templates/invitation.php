<?php
/**
 * Template for /c/{slug} — guest-facing invitation flow.
 *
 * Looks up the invitation link, resolves the topic's invitation CPT post,
 * injects the slug, and renders via do_blocks().
 */

defined( 'ABSPATH' ) || exit;

global $wpdb;

$slug = sanitize_text_field( get_query_var( 'clipisode_invite' ) );

// Look up invitation link.
$links_table = $wpdb->prefix . 'clipisode_invitation_links';
$link = $wpdb->get_row( $wpdb->prepare(
	"SELECT * FROM $links_table WHERE slug = %s", $slug
) );

if ( ! $link ) {
	status_header( 404 );
	echo '<!DOCTYPE html><html><head><title>Not Found</title></head><body><h1>Invitation not found.</h1></body></html>';
	exit;
}

if ( $link->status !== 'open' ) {
	echo '<!DOCTYPE html><html><head><title>Closed</title></head><body><h1>This invitation is no longer accepting replies.</h1></body></html>';
	exit;
}

// Fetch topic.
$topics_table = $wpdb->prefix . 'clipisode_topics';
$topic = $wpdb->get_row( $wpdb->prepare(
	"SELECT * FROM $topics_table WHERE id = %d", $link->topic_id
) );

if ( ! $topic || ! $topic->invitation_id ) {
	status_header( 404 );
	echo '<!DOCTYPE html><html><head><title>Not Found</title></head><body><h1>Topic not found.</h1></body></html>';
	exit;
}

// Track click.
$wpdb->query( $wpdb->prepare(
	"UPDATE $links_table SET clicks = clicks + 1 WHERE id = %d", $link->id
) );

// Load the invitation CPT post.
$invitation = get_post( (int) $topic->invitation_id );
if ( ! $invitation ) {
	status_header( 404 );
	echo '<!DOCTYPE html><html><head><title>Not Found</title></head><body><h1>Invitation layout not found.</h1></body></html>';
	exit;
}

// Inject the current slug into the flow block's attributes.
$content   = $invitation->post_content;
$safe_slug = esc_attr( $slug );

if ( preg_match( '/<!-- wp:clipisode\/invitation-flow \{.*?"slug"/', $content ) ) {
	$content = preg_replace(
		'/("slug"\s*:\s*)"[^"]*"/',
		'$1"' . $safe_slug . '"',
		$content,
		1
	);
} elseif ( preg_match( '/<!-- wp:clipisode\/invitation-flow \{/', $content ) ) {
	$content = preg_replace(
		'/(<!-- wp:clipisode\/invitation-flow \{)/',
		'$1"slug":"' . $safe_slug . '",',
		$content,
		1
	);
} else {
	$content = preg_replace(
		'/<!-- wp:clipisode\/invitation-flow -->/',
		'<!-- wp:clipisode/invitation-flow {"slug":"' . $safe_slug . '"} -->',
		$content,
		1
	);
}

// Render.
$rendered = do_blocks( $content );

?>
<!DOCTYPE html>
<html <?php language_attributes(); ?>>
<head>
	<meta charset="<?php bloginfo( 'charset' ); ?>">
	<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
	<meta name="robots" content="noindex, nofollow">
	<title><?php echo esc_html( $topic->title ); ?> — <?php bloginfo( 'name' ); ?></title>
	<?php wp_head(); ?>
</head>
<body>
<?php echo $rendered; ?>
<?php wp_footer(); ?>
</body>
</html>
