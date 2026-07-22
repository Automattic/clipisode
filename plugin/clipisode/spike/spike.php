<?php
/**
 * Clipisode IAPI + upload-survival spike.
 *
 * Disposable. Verifies:
 *   - Two URLs (/clipisode-spike and /clipisode-spike/done) can register
 *     IAPI regions in the same namespace.
 *   - Router navigation between them preserves store state.
 *   - A long-running task (setInterval-backed fake upload) keeps mutating
 *     store state across that navigation.
 *   - state.screen=a|b swap inside a single region works via
 *     data-wp-bind--hidden.
 *
 * Setup:
 *   1. Add this line to the bottom of clipisode.php:
 *        require_once CLIPISODE_PLUGIN_DIR . 'spike/spike.php';
 *   2. Settings → Permalinks → Save Changes (flushes rewrite rules).
 *   3. Visit /clipisode-spike on your dev site.
 *
 * Teardown:
 *   - Remove the require_once line, delete the spike/ folder, save permalinks again.
 */

defined( 'ABSPATH' ) || exit;

add_action( 'init', function () {
    add_rewrite_rule(
        '^clipisode-spike/?$',
        'index.php?clipisode_spike=main',
        'top'
    );
    add_rewrite_rule(
        '^clipisode-spike/done/?$',
        'index.php?clipisode_spike=done',
        'top'
    );
} );

add_filter( 'query_vars', function ( $vars ) {
    $vars[] = 'clipisode_spike';
    return $vars;
} );

add_filter( 'template_include', function ( $template ) {
    if ( ! get_query_var( 'clipisode_spike' ) ) {
        return $template;
    }
    return __DIR__ . '/template.php';
} );

/**
 * REST endpoint for the real-XHR upload-survival test.
 *
 * Sinks the request body and then sleeps for 5 seconds before responding.
 * The 5s delay is intentional: on localhost the actual upload finishes in
 * tens of milliseconds, so without server-side delay there's no window in
 * which to test "router navigation while the XHR is still in flight." The
 * sleep keeps the response pending long enough that we can navigate from
 * /clipisode-spike to /clipisode-spike/done and observe xhr.onload fire on
 * the new page.
 *
 * No auth: this is a disposable spike route gated by ?clipisode_spike.
 */
add_action( 'rest_api_init', function () {
    register_rest_route( 'clipisode-spike/v1', '/upload', [
        'methods'             => 'POST',
        'permission_callback' => '__return_true',
        'callback'            => function ( WP_REST_Request $request ) {
            $bytes = strlen( $request->get_body() );
            sleep( 5 );
            return new WP_REST_Response( [
                'ok'         => true,
                'bytes'      => $bytes,
                'received_at' => gmdate( 'c' ),
            ], 200 );
        },
    ] );
} );

add_action( 'wp_enqueue_scripts', function () {
    if ( ! get_query_var( 'clipisode_spike' ) ) {
        return;
    }

    // Explicitly enqueue the IAPI runtime + router so each gets its own
    // <script type="module"> tag rather than being pulled in only as a side
    // effect of import statements in store.js. This is good hygiene; the
    // actual hydration race is handled inside store.js (see comment there).
    wp_enqueue_script_module( '@wordpress/interactivity' );
    wp_enqueue_script_module( '@wordpress/interactivity-router' );

    wp_register_script_module(
        'clipisode/spike',
        plugins_url( 'spike/store.js', CLIPISODE_PLUGIN_DIR . 'clipisode.php' ),
        [ '@wordpress/interactivity', '@wordpress/interactivity-router' ],
        '0.1.0'
    );
    wp_enqueue_script_module( 'clipisode/spike' );
} );