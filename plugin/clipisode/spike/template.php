<?php
/**
 * Spike template — renders /clipisode-spike or /clipisode-spike/done.
 *
 * Both pages share IAPI namespace 'clipisode/spike'. wp_interactivity_state()
 * sets the initial state on each request; the IAPI runtime merges them so
 * state survives router navigation between the two pages.
 */

defined( 'ABSPATH' ) || exit;

$page = get_query_var( 'clipisode_spike' ); // 'main' or 'done'

wp_interactivity_state( 'clipisode/spike', [
    'uploadPct'         => 0,
    'uploading'         => false,
    'screen'            => 'a',
    'visited'           => 0,
    'path'              => '',
    'realUploading'     => false,
    'realUploadPct'     => 0,
    'realUploadDone'    => false,
    'realUploadResponse'=> '',
    'realUploadError'   => '',
] );

show_admin_bar( false );
?>
<!DOCTYPE html>
<html <?php language_attributes(); ?>>
<head>
    <meta charset="<?php bloginfo( 'charset' ); ?>">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="robots" content="noindex,nofollow">
    <title>Clipisode Spike — <?php echo esc_html( $page ); ?></title>
    <style>
        body { font: 16px/1.4 -apple-system, system-ui, sans-serif; padding: 24px; max-width: 480px; margin: 0 auto; }
        h1 { margin-top: 0; }
        button { padding: 10px 16px; margin: 4px 4px 4px 0; border: 1px solid #888; border-radius: 6px; background: #f7f7f7; cursor: pointer; font-size: 16px; }
        button.primary { background: #2d1b69; color: white; border-color: #2d1b69; }
        button:disabled { opacity: 0.5; }
        progress { width: 100%; height: 14px; }
        .row { margin: 16px 0; }
        .badge { display: inline-block; padding: 2px 10px; background: #eee; border-radius: 999px; font-size: 13px; }
        .stage { padding: 16px; border: 2px dashed #ccc; border-radius: 8px; margin: 16px 0; }
        [hidden] { display: none !important; }
        code { background: #f0f0f0; padding: 1px 6px; border-radius: 3px; }
    </style>
    <?php wp_head(); ?>
</head>
<body>
<div
    data-wp-interactive="clipisode/spike"
    data-wp-router-region="spike"
    data-wp-init="callbacks.init"
>
<?php if ( $page === 'main' ) : ?>

    <h1>Spike: <code>/clipisode-spike</code></h1>

    <p>
        Path seen by client: <code data-wp-text="state.path"></code><br>
        Page inits this session: <span class="badge" data-wp-text="state.visited"></span>
    </p>

    <div class="row">
        <strong>state.screen:</strong>
        <span class="badge" data-wp-text="state.screen"></span>
        <button data-wp-on--click="actions.toggleScreen">Toggle a ↔ b</button>
    </div>

    <div class="stage" data-wp-bind--hidden="!state.isScreenA">
        <h2>Screen A — "intro/record" stand-in</h2>
        <button
            class="primary"
            data-wp-on--click="actions.startFakeUpload"
            data-wp-bind--disabled="state.uploading"
        >
            Start fake "upload"
        </button>
        <div class="row">
            <progress max="100" data-wp-bind--value="state.uploadPct"></progress>
            <span data-wp-text="state.uploadPct"></span>%
        </div>
    </div>

    <div class="stage" data-wp-bind--hidden="state.isScreenA">
        <h2>Screen B — "name form" stand-in</h2>
        <p>Same store, same upload progress, no remount.</p>
        <progress max="100" data-wp-bind--value="state.uploadPct"></progress>
        <span data-wp-text="state.uploadPct"></span>%
    </div>

    <div class="stage">
        <h2>Real XHR upload (5 MB → server sleeps 5s)</h2>
        <p>Click start, then click "Navigate to /done" while it's running.
           The progress bar and final response should both arrive on the
           /done page without restarting.</p>
        <button
            class="primary"
            data-wp-on--click="actions.startRealUpload"
            data-wp-bind--disabled="state.realUploading"
        >
            Start real upload
        </button>
        <div class="row">
            <progress max="100" data-wp-bind--value="state.realUploadPct"></progress>
            <span data-wp-text="state.realUploadPct"></span>%
            &nbsp;<span class="badge" data-wp-bind--hidden="!state.realUploading">uploading…</span>
            <span class="badge" data-wp-bind--hidden="!state.realUploadDone">done</span>
        </div>
        <p data-wp-bind--hidden="!state.realUploadDone">
            <strong>Server response:</strong>
            <code data-wp-text="state.realUploadResponse"></code>
        </p>
        <p data-wp-bind--hidden="!state.realUploadError" style="color:#a00">
            <strong>Error:</strong>
            <span data-wp-text="state.realUploadError"></span>
        </p>
    </div>

    <div class="row">
        <button data-wp-on--click="actions.gotoDone">Navigate to /done</button>
    </div>

<?php else : // 'done' ?>

    <h1>Spike: <code>/clipisode-spike/done</code></h1>

    <p>
        Path seen by client: <code data-wp-text="state.path"></code><br>
        Page inits this session: <span class="badge" data-wp-text="state.visited"></span>
    </p>

    <p>If the IAPI router preserved store state, the bars below should
       match what you last saw on /main and continue updating without
       restarting.</p>

    <h3>Fake upload (setTimeout-driven)</h3>
    <progress max="100" data-wp-bind--value="state.uploadPct"></progress>
    <span data-wp-text="state.uploadPct"></span>%

    <h3>Real XHR upload</h3>
    <progress max="100" data-wp-bind--value="state.realUploadPct"></progress>
    <span data-wp-text="state.realUploadPct"></span>%
    &nbsp;<span class="badge" data-wp-bind--hidden="!state.realUploading">uploading…</span>
    <span class="badge" data-wp-bind--hidden="!state.realUploadDone">done</span>
    <p data-wp-bind--hidden="!state.realUploadDone">
        <strong>Server response (arrived on /done):</strong>
        <code data-wp-text="state.realUploadResponse"></code>
    </p>
    <p data-wp-bind--hidden="!state.realUploadError" style="color:#a00">
        <strong>Error:</strong>
        <span data-wp-text="state.realUploadError"></span>
    </p>

    <div class="row">
        <button data-wp-on--click="actions.gotoMain">Back to /main</button>
        <button data-wp-on--click="actions.cleanUrl">replaceState → /clipisode-spike (URL only)</button>
    </div>

<?php endif; ?>

</div>
<?php wp_footer(); ?>
</body>
</html>