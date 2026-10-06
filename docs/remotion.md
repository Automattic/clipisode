# Remotion previews

The wp-admin composer uses `@remotion/player` to play a React composition directly in the browser. Its inputs are an ordered list of source clips and theme settings. Saving stores an editable composition in WordPress. **Render in browser** creates an MP4 in the current browser tab and uploads it to WordPress. When an external renderer is configured, **Render with service** sends the same saved composition to that service.

## Preview workflow

1. Select approved replies on a topic and choose **Create Clipisode**, or select videos in the media library and create a clipisode from them.
2. Arrange the clips, adjust their trims and names, and select which clips to include.
3. Choose a theme and customize its format, colors, typography, logo, title, ending, and name cards. The player previews the current settings.
4. Save the preview. Reopen it using **Edit preview** in the Clipisodes list or the topic's Clipisodes section.
5. Choose **Render in browser**, keep the tab open through rendering and upload, then choose **Download MP4**. A configured renderer also provides **Render with service**.

Saved previews open at `admin.php?page=clipisode#/compose/{outputId}`. The Clipisodes list also displays existing rendered video files separately.

The preview loads source media through `Clipisode_Media` URLs and plays their original audio. Video URLs must be playable by the browser. No desktop transcoder, WebSocket connection, or AVFoundation theme manifest is involved in the composition.

## Implementation

| File in `plugin/clipisode/` | Responsibility |
| --- | --- |
| `src/pages/CreateClipisode.tsx` | Composer controls, source selection, player, and save/load requests |
| `src/components/CompositionControls.tsx` | Editable theme settings and preset selection |
| `src/components/CompositionPreview.tsx` | Player controls, error state, and chapter navigation |
| `src/components/CompositionExport.tsx` | Browser rendering, upload retry, service status polling, and MP4 download |
| `src/lib/browser-renderer.ts` | Browser capability check and Remotion MP4 export |
| `src/lib/video-metadata.ts` | Browser source duration loading |
| `src/remotion/types.ts` | Composition clip and settings contracts |
| `src/remotion/timeline.ts` | Frame calculation, clip trimming, card placement, and canvas sizes |
| `src/remotion/ClipisodeComposition.tsx` | Remotion sequences, media playback, and theme layers |
| `src/remotion/themes.tsx` | Theme presets, title/ending cards, and video overlays |
| `includes/class-composition.php` | Saved-input validation and resolution of current media URLs |
| `includes/class-rest-api.php` | Composition output endpoints |
| `includes/class-database.php` | Output composition storage |
| `includes/class-renderer.php` | Local renderer communication and persisted job status |
| `scripts/local-renderer.mjs` | Authenticated local service and serial render queue |
| `scripts/render-composition.mjs` | Remotion bundle, MP4 rendering, and WordPress upload |

## Composition contract

`ClipisodeCompositionProps` contains `clips` and `settings`. Each clip has a unique instance `id`, a WordPress `mediaId`, a `role` (`intro` or `reply`), a display `name`, its source `duration`, `trimStart`, `trimEnd`, and an `included` flag. Source times and card durations are measured in seconds. The API supplies the current source `url` when loading a saved composition; source URLs are not persisted in the composition JSON.

The array order is the playback order. Duplicated source videos have separate clip instance IDs and can have different trims and names. Excluded clips remain saved so they can be included again later.

The timeline runs at 30 frames per second. Trim start and end are rounded to integer source-frame boundaries, with the end boundary exclusive. The selected range must produce at least one frame. Included clips run consecutively between any enabled title and ending cards. Animations use the current sequence frame, so seeking and replaying show the same composition state.

Canvas formats are portrait (1080 × 1920), square (1080 × 1080), and landscape (1920 × 1080). `videoFit` selects a crop that fills the canvas (`cover`) or displays the complete source within it (`contain`).

The initial presets are:

- **Clipisode** (`default`): colored shapes and bold name cards.
- **Editorial** (`wpvip`): fine rules and serif typography.
- **No theme** (`none`): source video and audio, without title/ending cards, logo, or name overlays.

Settings include `themeId`, `format`, `title`, `subtitle`, `endingText`, three six-digit hex colors (`accentColor`, `backgroundColor`, `textColor`), `fontFamily` (`sans` or `serif`), `logoUrl`, `showNames`, `showTitle`, `showEnding`, `titleDuration`, `endingDuration`, and `videoFit`.

## Saving and loading

All routes use the `clipisode/v1` REST namespace and require the plugin's admin permission check.

| Request | Result |
| --- | --- |
| `POST /outputs` with `{ name, topic_id, composition }` | Creates a saved preview; returns its ID and resolved composition |
| `PUT /outputs/{id}` with `{ name, topic_id, composition }` | Updates an existing saved preview |
| `GET /outputs/{id}` | Loads the saved composition with current source URLs |
| `GET /outputs` | Lists saved preview summaries, including `has_composition` and included clip count |
| `DELETE /outputs/{id}` | Removes the output and its source references |
| `POST /outputs/{id}/render` | Starts a service MP4 render of the saved composition |
| `POST /outputs/{id}/browser-render` with multipart `video` and `composition_hash` | Stores a browser-rendered MP4 if the saved composition still matches |
| `GET /outputs/{id}/render` | Reports idle, queued, rendering, uploading, done, or error status |

Save and load responses include `composition_hash`, an opaque version of the saved composition used when uploading a browser export. Render status includes `external_available`, which indicates whether a service URL and token are configured.

`topic_id` is a topic ID or `null` for a composition created without a topic. Composition JSON is stored in `clipisode_outputs.composition`. The corresponding `clipisode_contents` references are updated in the same database transaction so media usage reflects the saved composition, including excluded clips that remain available for editing.

Invalid settings or unavailable source media produce explicit errors. A saved preview whose source video is no longer available cannot be loaded until its source is restored. Existing rendered outputs have no editable composition unless one was explicitly saved.

## Extending themes

To add a preset:

1. Add its ID to `ThemeId` in `src/remotion/types.ts`.
2. Add an entry with a label, description, and complete defaults to `themePresets` in `src/remotion/themes.tsx`.
3. Implement its card and overlay appearance in `ThemeCard` and `ThemeOverlay`. Keep animation state derived from `useCurrentFrame()` and sizing derived from `useVideoConfig()`.
4. Add the ID to the `themeId` allow-list in `Clipisode_Composition::sanitize()`.
5. Verify cards, names, logos, trimming, and seeking in all three canvas formats, then save and reopen the preview.

For a new customizable setting, update `CompositionSettings`, each preset's defaults, `CompositionControls`, its theme consumer, and PHP validation together. A saved composition should contain everything required to reproduce its appearance.

Invitation page designs and public layouts remain separate WordPress block-based concerns. The React composition is the extension point for video appearance; browser previews and local MP4 rendering consume the same composition inputs.

## Browser MP4 rendering

**Render in browser** fetches the saved composition with fresh media URLs, checks whether the browser can encode the requested MP4, and renders H.264 video with AAC audio. It then uploads the video to WordPress using the saved composition hash. WordPress rejects an upload if another session changed the saved composition or started a service render in the meantime.

Keep the tab open until the upload finishes. **Cancel render** stops the browser render. Reloading or closing the page stops browser work; browser progress is not a persistent service job. If rendering completes but uploading fails, **Download MP4** preserves the result locally and **Retry upload** sends the same file again without rendering it a second time. Saving a changed preview before retrying can invalidate that upload; download the completed file or discard it and render the new saved version.

Browser encoding depends on WebCodecs and the device's available H.264/AAC encoders. The support check reports an unavailable encoder before starting. Source videos and logos must be same-origin or served with CORS headers allowing the WordPress origin. Browser media decoding must support the input files. Large compositions also depend on the device's available memory and storage.

The compatible renderer supports the existing themes' text, solid colors, borders, layout, transforms, opacity, and images. Use `Video` from `@remotion/media` for source clips and keep new theme elements within [Remotion's supported HTML and CSS](https://www.remotion.dev/docs/client-side-rendering/limitations). Browser export emulates HTML/CSS on a canvas; it does not capture every CSS feature supported by server rendering.

In the pinned Remotion 4.0.499 release, native HTML-in-canvas capture is selected automatically when the browser exposes it. There is no capture-mode selector in this version. Remotion currently documents the experimental Chromium `chrome://flags/#canvas-draw-element` flag for native capture. The existing themes also support the ordinary canvas renderer, so this flag is not required for their export. See [Remotion's HTML-in-canvas documentation](https://www.remotion.dev/docs/client-side-rendering/html-in-canvas) for browser requirements and changes in newer releases. Themes requiring richer CSS need native-capture capability checks or service rendering; enabling an option alone does not guarantee native capture.

Sites using a Remotion license key can set `CLIPISODE_REMOTION_LICENSE_KEY` in `wp-config.php`. The plugin passes it to the browser renderer, along with whether WordPress reports a production environment. Configure this according to the site's Remotion license; the browser key is visible to authenticated plugin administrators.

## Service MP4 rendering

Use Node.js 22.17 or later. From `plugin/clipisode/`, install dependencies with `npm install`, build the wp-admin bundle with `npm run build`, and start the local service:

```bash
CLIPISODE_RENDERER_TOKEN='replace-with-a-shared-local-secret' npm run render:server
```

Add the same secret and the service URL to this local WordPress site's `wp-config.php`:

```php
define( 'CLIPISODE_RENDERER_URL', 'http://127.0.0.1:63483' );
define( 'CLIPISODE_RENDERER_TOKEN', 'replace-with-a-shared-local-secret' );
```

For WordPress running in Docker while the renderer runs on the host, use `http://host.docker.internal:63483` as the WordPress renderer URL. The renderer must also be able to fetch the site's source video and logo URLs and reach its REST upload callback.

The service listens on `127.0.0.1:63483` by default. `CLIPISODE_RENDERER_HOST` and `CLIPISODE_RENDERER_PORT` set its listen address and port. Set `REMOTION_BROWSER_EXECUTABLE` to an existing Chrome executable to use it; otherwise Remotion manages its headless browser. This workflow uses local rendering and requires no Lambda configuration.

The worker renders H.264 video with AAC audio in an MP4 container, using the saved dimensions and 30 fps timeline. It uploads the result through a one-use WordPress callback token and removes its temporary bundle and MP4 afterward. WordPress stores the resulting video through `Clipisode_Media`; the completed output is also available in the rendered-video list.

Only a saved preview without unsaved changes can start a render. You can edit the browser preview while its saved version renders, but saving is disabled during rendering or upload. A service job also prevents deletion of its output until it finishes. The editor resumes service status polling when reopened. **Retry status** checks an existing job after a connection failure; **Render with service** starts a new job after a confirmed render failure.

The local queue processes one job at a time and keeps pending jobs in memory. Restarting the service loses unfinished jobs; WordPress reports that the job is missing so it can be rendered again. Successful uploaded videos and their completed status remain in WordPress.

## Runtime requirements

The admin bundle requires WordPress 6.6 or later for its React JSX runtime. `remotion`, `@remotion/player`, `@remotion/media`, `@remotion/web-renderer`, `@remotion/bundler`, and `@remotion/renderer` are pinned together to 4.0.499, which supports WordPress’s React 18. Keep their versions aligned and verify against WordPress’s React version before upgrading.

## Development checks

From `plugin/clipisode/`, run `npm run build`, `npm run test:js -- --runInBand`, `npm run test:renderer`, and `composer test`. Timeline and editor/export tests are in `tests/js/`; composition persistence and renderer API tests are in `tests/phpunit/`.

For a browser check, create a preview with multiple clips, play through the clip boundaries, seek into a trimmed clip, change the theme and canvas format, and save. Reload its Edit preview URL and confirm the saved order, trims, names, and settings.

For an export check, render that saved preview in the browser and with the configured service, then play each downloaded MP4. Check its dimensions, duration, source audio, trimmed clip boundaries, and customized cards against the browser preview.
