<?php
defined( 'ABSPATH' ) || exit;

$wrapper = get_block_wrapper_attributes( [
	'class'     => 'ci-stage ci-stage-landing',
	'data-step' => 'landing',
] );

echo "<div $wrapper>$content</div>";
