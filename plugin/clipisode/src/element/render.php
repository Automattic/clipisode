<?php
/**
 * Element render — type-driven.
 *
 * Each element type pulls its content from the DB via the parent's slug
 * context. Block wrapper attributes apply editor-chosen styles.
 */

defined( 'ABSPATH' ) || exit;

$type = $attributes['type'] ?? '';
$slug = $block->context['clipisode/slug'] ?? '';

$topic = null;
if ( $slug ) {
	global $wpdb;
	$link = $wpdb->get_row( $wpdb->prepare(
		"SELECT * FROM {$wpdb->prefix}clipisode_invitation_links WHERE slug = %s", $slug
	) );
	if ( $link ) {
		$topic = $wpdb->get_row( $wpdb->prepare(
			"SELECT * FROM {$wpdb->prefix}clipisode_topics WHERE id = %d", $link->topic_id
		) );
	}
}

$wrapper = get_block_wrapper_attributes( [
	'class' => 'ci-el ci-el-' . esc_attr( $type ),
] );

switch ( $type ) {

	case 'video':
		$url = '';
		if ( $topic && $topic->intro_video_id ) {
			$url = wp_get_attachment_url( (int) $topic->intro_video_id ) ?: '';
		}
		if ( $url ) {
			echo "<div $wrapper>";
			echo '<div class="ci-video-wrap">';
			echo '<video class="ci-video" src="' . esc_attr( $url ) . '" playsinline preload="metadata"></video>';
			echo '<button class="ci-play-btn">▶</button>';
			echo '</div></div>';
		}
		break;

	case 'title':
		$title = $topic ? esc_html( $topic->title ) : 'Topic Title';
		echo "<div $wrapper><h1 class=\"ci-title\">$title</h1></div>";
		break;

	case 'hosted':
		$hosted = $topic ? esc_html( $topic->hosted_by ) : '';
		if ( $hosted ) {
			echo "<div $wrapper><p class=\"ci-hosted\">Hosted by $hosted</p></div>";
		}
		break;

	case 'cta':
		echo "<div $wrapper>";
		echo '<button class="ci-cta" data-goto="record">Record Your Reply</button>';
		echo '</div>';
		break;

	case 'terms':
		$brand_url  = ( $topic && $topic->brand_terms_id ) ? get_permalink( (int) $topic->brand_terms_id ) : '';
		$custom_url = ( $topic && $topic->custom_terms_id ) ? get_permalink( (int) $topic->custom_terms_id ) : '';
		if ( $brand_url ) {
			echo "<div $wrapper><p class=\"ci-terms-link\">";
			echo 'By participating you agree to the <a href="' . esc_url( $brand_url ) . '" class="ci-terms-open" data-terms-url="' . esc_url( $brand_url ) . '">terms</a>';
			if ( $custom_url ) {
				$custom_title = get_the_title( (int) $topic->custom_terms_id ) ?: 'additional terms';
				echo ' and <a href="' . esc_url( $custom_url ) . '" class="ci-terms-open" data-terms-url="' . esc_url( $custom_url ) . '">' . esc_html( strtolower( $custom_title ) ) . '</a>';
			}
			echo '.</p>';
			echo '<div class="ci-terms-modal" hidden>';
			echo '<button class="ci-terms-close">&times;</button>';
			echo '<div class="ci-terms-content"></div>';
			echo '</div>';
			echo '</div>';
		}
		break;

	case 'upload-form':
		echo "<div $wrapper>";
		echo '<input type="file" class="ci-file-input" accept="video/*" capture="user">';
		echo '<div class="ci-progress-section">';
		echo '<h2 class="ci-status-text">Select a video</h2>';
		echo '<div class="ci-progress-bar"><div class="ci-progress-fill"></div></div>';
		echo '<button type="button" class="ci-cta ci-cta-secondary ci-choose-btn">Choose Video</button>';
		echo '</div>';
		echo '<div class="ci-form-section">';
		echo '<label class="ci-label">Name</label>';
		echo '<input type="text" class="ci-input ci-name-input" placeholder="Your name" required>';
		echo '<label class="ci-label">Instagram handle</label>';
		echo '<input type="text" class="ci-input ci-handle-input" placeholder="@handle (optional)">';
		echo '<button type="button" class="ci-cta ci-submit" disabled>Save My Reply</button>';
		echo '<div class="ci-error"></div>';
		echo '</div></div>';
		break;

	case 'thanks-heading':
		echo "<div $wrapper><h2 class=\"ci-thanks-heading\">Awesome… all done!</h2></div>";
		break;

	case 'thanks-body':
		echo "<div $wrapper><p class=\"ci-thanks-body\">Thanks for your reply.</p></div>";
		break;

	case 'thanks-cta':
		echo "<div $wrapper><p class=\"ci-thanks-stay\">Stay tuned!</p></div>";
		break;

	case 'qr-code':
		echo "<div $wrapper>";
		echo '<div class="ci-qr-wrap">';
		echo '<div class="ci-qr-canvas"></div>';
		echo '<p class="ci-qr-label">Scan with your phone to record a reply</p>';
		echo '</div>';
		echo '</div>';
		break;
}
