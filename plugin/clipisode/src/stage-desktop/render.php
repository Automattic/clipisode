<?php
defined( 'ABSPATH' ) || exit;

$wrapper = get_block_wrapper_attributes( [
	'class'     => 'ci-stage ci-stage-desktop',
	'data-step' => 'desktop',
] );

echo "<div $wrapper>$content</div>";
