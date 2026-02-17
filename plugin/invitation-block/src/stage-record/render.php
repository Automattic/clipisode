<?php
defined( 'ABSPATH' ) || exit;

$wrapper = get_block_wrapper_attributes( [
	'class'     => 'ci-stage ci-stage-record',
	'data-step' => 'record',
] );

echo "<div $wrapper>$content</div>";
