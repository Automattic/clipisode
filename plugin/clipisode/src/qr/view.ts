/**
 * Vendored QR-code generator for the desktop intro screen.
 *
 * Why this file exists. The desktop layout shows a QR code so a user
 * who landed on a laptop can hand off to their phone. The first cut
 * pulled the QR image from api.qrserver.com — fast to wire up, but
 * adds a third-party network dependency (privacy + uptime + offline-
 * with-Studio risk) we don't want for a feature that's pure-deterministic
 * given a URL. The previous Clipisode iteration (legacy src/flow/view.ts)
 * already used the `qrcode` npm package for the same job, so we vendor
 * it through wp-scripts here and call it locally.
 *
 * Why a separate src/qr/ folder + placeholder block.json. wp-scripts'
 * auto-detected entries scan `**\/block.json` for viewScript/editorScript
 * fields. To produce build/qr/view.js without a custom webpack.config.js,
 * we drop a stub block.json next to this file (the block name is never
 * actually registered server-side — see src/qr/block.json comments).
 *
 * Why a window global instead of an ES module. The desktop QR mount
 * lives inside the IAPI region and is set up by an inline script tag
 * in clipisode-flow.php. Inline scripts can't `import` from another
 * module, so we expose a tiny, stable surface on window. The PHP side
 * enqueues this file with a `defer` script tag and the inline init
 * waits for the global to exist (see clipisode-flow.php desktop block).
 *
 * Library choice: soldair/node-qrcode (^1.5.4) was used in the legacy
 * code, is the most-maintained QR library on npm in 2026 (~7k stars,
 * actively shipping releases), supports canvas + SVG + data-URL out of
 * the box, and has zero direct browser dependencies once bundled.
 */
import QRCode from 'qrcode';

interface QrToCanvasOptions {
	width?: number;
	margin?: number;
	color?: { dark?: string; light?: string };
}

interface ClipisodeQrSurface {
	/**
	 * Render `text` as a QR code into `target`. `target` may be either
	 * an existing <canvas> (in which case we draw straight in) or any
	 * other element (in which case we create a fresh canvas, render,
	 * and append it). The latter is what the desktop slot uses so the
	 * inline init script can pass the wrapping <div> directly.
	 */
	toCanvas: (
		target: HTMLElement,
		text: string,
		opts?: QrToCanvasOptions
	) => void;
}

declare global {
	interface Window {
		clipisodeQr?: ClipisodeQrSurface;
	}
}

const surface: ClipisodeQrSurface = {
	toCanvas( target, text, opts ) {
		const options: QrToCanvasOptions = Object.assign(
			{
				width: 200,
				margin: 2,
				color: { dark: '#0a1d4a', light: '#ffffff' },
			},
			opts || {}
		);

		// Replace any prior QR (re-render on resize / URL change is fine).
		// We keep the host element's other children (e.g. label text)
		// untouched by only removing canvases we previously drew.
		target
			.querySelectorAll< HTMLCanvasElement >(
				'canvas[data-clipisode-qr]'
			)
			.forEach( ( c ) => c.remove() );

		const canvas =
			target instanceof HTMLCanvasElement
				? target
				: document.createElement( 'canvas' );
		canvas.setAttribute( 'data-clipisode-qr', '1' );

		// QRCode.toCanvas's callback signature is (err, canvas). We
		// ignore the returned canvas because we already control
		// placement above; we only care whether it succeeded.
		QRCode.toCanvas( canvas, text, options, ( err: Error | null ) => {
			if ( err ) {
				// Intentional diagnostic: surfaces QR encoding failures
				// (e.g. URL longer than the largest QR version can hold)
				// to the browser console so authors notice instead of
				// staring at an empty box.
				// eslint-disable-next-line no-console
				console.error( '[clipisodeQr] failed to render', err );
				return;
			}
			if ( target !== canvas && ! canvas.parentNode ) {
				target.appendChild( canvas );
			}
		} );
	},
};

if ( typeof window !== 'undefined' ) {
	window.clipisodeQr = surface;
	// Custom event so the inline init script can avoid a polling loop
	// when this module loads after the QR mount is in the DOM.
	try {
		window.dispatchEvent( new CustomEvent( 'clipisode-qr-ready' ) );
	} catch ( _e ) {
		// CustomEvent constructor unavailable on ancient browsers — the
		// PHP-side init falls back to a one-time microtask check.
	}
}
