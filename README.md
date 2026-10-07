# Clipisode

A WordPress plugin and companion transcoding service for collecting, curating, and publishing user-generated video content.

## Try Clipisode

[Open Clipisode in WordPress Playground](https://playground.wordpress.net/#%7B%22%24schema%22%3A%22https%3A%2F%2Fplayground.wordpress.net%2Fblueprint-schema.json%22%2C%22preferredVersions%22%3A%7B%22php%22%3A%228.3%22%2C%22wp%22%3A%22latest%22%7D%2C%22landingPage%22%3A%22%2Fwp-admin%2Fadmin.php%3Fpage%3Dclipisode%22%2C%22steps%22%3A%5B%7B%22step%22%3A%22installPlugin%22%2C%22pluginData%22%3A%7B%22resource%22%3A%22url%22%2C%22url%22%3A%22https%3A%2F%2Fraw.githubusercontent.com%2FAutomattic%2Fclipisode%2Ftrunk%2Fplugin%2Fclipisode%2Fclipisode.zip%22%7D%2C%22options%22%3A%7B%22activate%22%3Atrue%7D%7D%2C%7B%22step%22%3A%22login%22%2C%22username%22%3A%22admin%22%2C%22password%22%3A%22password%22%7D%5D%7D)

The link installs the packaged plugin from `trunk` in a browser-based WordPress site and opens the Clipisode admin screen.
To try a reply, create a topic, choose **Open** on its invitation link, then **Reply on this device**. Playground stores each site in your browser, so invitation links and QR codes cannot collect replies from other devices.

## Structure

- `plugin/` — WordPress plugin (PHP + React admin UI)
- `transcoding/` — Video transcoding services (macOS native, web, WASM)
- `docs/` — Project documentation (PRD, media schema, transcode protocol)
- `tools/` — Development utilities (WebSocket test server)
