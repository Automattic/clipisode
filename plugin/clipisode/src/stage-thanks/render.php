<?php
defined( 'ABSPATH' ) || exit;

$wrapper = get_block_wrapper_attributes( [
	'class'     => 'ci-stage ci-stage-thanks',
	'data-step' => 'thanks',
] );

echo "<div $wrapper>$content</div>";
