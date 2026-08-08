<?php
defined( 'ABSPATH' ) || exit;

$wrapper = get_block_wrapper_attributes( [
	'class' => 'cp-preview-root',
] );

// phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- $wrapper is pre-escaped by get_block_wrapper_attributes(); $content is this block's already-rendered inner block HTML.
echo "<div $wrapper>$content</div>";
