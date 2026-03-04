<?php
/**
 * Template for /invitation/{slug} — guest-facing invitation flow.
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
show_admin_bar( false );
$rendered = do_blocks( $content );

?>
<!DOCTYPE html>
<html <?php language_attributes(); ?>>
<head>
	<meta charset="<?php bloginfo( 'charset' ); ?>">
	<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
	<meta name="robots" content="noindex, nofollow">
	<title><?php echo esc_html( $topic->title ); ?> — <?php bloginfo( 'name' ); ?></title>
<?php
$og_title       = esc_attr( $topic->title );
$og_description = esc_attr( sprintf( 'Record a video for %s, hosted by %s', $topic->title, $topic->hosted_by ?: get_bloginfo( 'name' ) ) );
$og_url         = esc_url( home_url( Clipisode_Invitation::get_prefix() . '/' . $slug ) );
$og_image       = '';
if ( ! empty( $topic->social_image_media_id ) ) {
	$og_image = Clipisode_Media::get_url( (int) $topic->social_image_media_id );
}
if ( ! $og_image ) {
	$og_image = plugins_url( 'assets/images/clipisode.png', CLIPISODE_PLUGIN_DIR . 'clipisode.php' );
}
$og_image = esc_url( $og_image );
?>
	<meta property="og:type" content="website">
	<meta property="og:title" content="<?php echo $og_title; ?>">
	<meta property="og:description" content="<?php echo $og_description; ?>">
	<meta property="og:url" content="<?php echo $og_url; ?>">
	<meta property="og:image" content="<?php echo $og_image; ?>">
	<meta name="twitter:card" content="summary_large_image">
	<meta name="twitter:title" content="<?php echo $og_title; ?>">
	<meta name="twitter:description" content="<?php echo $og_description; ?>">
	<meta name="twitter:image" content="<?php echo $og_image; ?>">
	<?php wp_head(); ?>
</head>
<body>
<?php echo $rendered; ?>
<?php wp_footer(); ?>
</body>
</html>
