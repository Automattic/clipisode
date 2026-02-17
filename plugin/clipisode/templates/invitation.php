<?php
/**
 * Template for /c/{slug} — guest-facing invitation flow.
 *
 * Outputs the same HTML structure the sub-blocks would produce, with
 * default content. The parent controller view script drives the flow.
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

if ( ! $topic ) {
	status_header( 404 );
	echo '<!DOCTYPE html><html><head><title>Not Found</title></head><body><h1>Topic not found.</h1></body></html>';
	exit;
}

// Track click.
$wpdb->query( $wpdb->prepare(
	"UPDATE $links_table SET clicks = clicks + 1 WHERE id = %d", $link->id
) );

// Resolve URLs.
$intro_video_url  = $topic->intro_video_id ? ( wp_get_attachment_url( (int) $topic->intro_video_id ) ?: '' ) : '';
$brand_terms_url  = $topic->brand_terms_id ? get_permalink( (int) $topic->brand_terms_id ) : '';
$custom_terms_url = $topic->custom_terms_id ? get_permalink( (int) $topic->custom_terms_id ) : '';
$rest_url         = esc_url_raw( rest_url() );
$nonce            = wp_create_nonce( 'wp_rest' );

// Enqueue the flow controller script + styles.
$asset_file = CLIPISODE_PLUGIN_DIR . 'build/flow/view.asset.php';
$asset      = file_exists( $asset_file ) ? include $asset_file : [ 'dependencies' => [], 'version' => CLIPISODE_VERSION ];

wp_enqueue_script( 'clipisode-flow-view', CLIPISODE_PLUGIN_URL . 'build/flow/view.js', $asset['dependencies'], $asset['version'], true );
wp_enqueue_style( 'clipisode-flow-view', CLIPISODE_PLUGIN_URL . 'build/flow/view.css', [], $asset['version'] );

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

<div class="ci-flow-root"
	data-slug="<?php echo esc_attr( $slug ); ?>"
	data-rest-url="<?php echo esc_attr( $rest_url ); ?>"
	data-nonce="<?php echo esc_attr( $nonce ); ?>">

	<!-- Stage: Landing -->
	<div class="ci-stage ci-stage-landing" data-step="landing">

		<?php if ( $intro_video_url ) : ?>
		<div class="ci-video-wrap">
			<video class="ci-video" src="<?php echo esc_attr( $intro_video_url ); ?>" playsinline preload="metadata"></video>
			<button class="ci-play-btn" onclick="const v=this.previousElementSibling;v.play();this.classList.add('ci-hidden');v.onpause=()=>{if(!v.ended)this.classList.remove('ci-hidden')};v.onended=()=>this.classList.remove('ci-hidden')">▶</button>
		</div>
		<?php endif; ?>

		<h1 style="color:#fff;font-size:24px;font-weight:700;margin:0 0 8px"><?php echo esc_html( $topic->title ); ?></h1>

		<?php if ( $topic->hosted_by ) : ?>
		<p style="color:rgba(255,255,255,0.7);font-size:15px;margin:0 0 32px">Hosted by <?php echo esc_html( $topic->hosted_by ); ?></p>
		<?php endif; ?>

		<button class="ci-cta" data-goto="record">Record Your Reply</button>

		<?php if ( $brand_terms_url ) : ?>
		<p class="ci-terms-link">
			By participating you agree to the <a href="<?php echo esc_url( $brand_terms_url ); ?>" target="_blank">terms</a><?php
			if ( $custom_terms_url ) {
				echo ' and <a href="' . esc_url( $custom_terms_url ) . '" target="_blank">additional terms</a>';
			}
			?>.
		</p>
		<?php endif; ?>

	</div>

	<!-- Stage: Record -->
	<div class="ci-stage ci-stage-record" data-step="record" style="display:none">

		<input type="file" class="ci-file-input" accept="video/*" capture="user">

		<div class="ci-progress-section">
			<h2 class="ci-status-text">Select a video</h2>
			<div class="ci-progress-bar">
				<div class="ci-progress-fill"></div>
			</div>
			<button type="button" class="ci-cta ci-cta-secondary ci-choose-btn">Choose Video</button>
		</div>

		<div class="ci-form-section">
			<label class="ci-label">Name</label>
			<input type="text" class="ci-input ci-name-input" placeholder="Your name" required>

			<label class="ci-label">Instagram handle</label>
			<input type="text" class="ci-input ci-handle-input" placeholder="@handle (optional)">

			<button type="button" class="ci-cta ci-submit" disabled>Save My Reply</button>

			<div class="ci-error"></div>
		</div>

	</div>

	<!-- Stage: Thanks -->
	<div class="ci-stage ci-stage-thanks" data-step="thanks" style="display:none">
		<h2 style="color:#fff;font-size:28px;font-weight:700;margin:0 0 12px">Awesome… all done!</h2>
		<p style="color:rgba(255,255,255,0.7);font-size:17px;margin:0 0 8px">Thanks for your reply.</p>
		<p style="color:#fff;font-size:20px;font-weight:600;margin:24px 0 0">Stay tuned!</p>
	</div>

</div>

<?php wp_footer(); ?>
</body>
</html>
