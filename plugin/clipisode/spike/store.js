import * as interactivity from '@wordpress/interactivity';
import { actions as routerActions } from '@wordpress/interactivity-router';

const { store } = interactivity;

const SPIKE_MAIN = '/clipisode-spike';
const SPIKE_DONE = '/clipisode-spike/done';

const { state } = store( 'clipisode/spike', {
	state: {
		get isScreenA() {
			return state.screen === 'a';
		},
	},
	actions: {
		toggleScreen() {
			state.screen = state.screen === 'a' ? 'b' : 'a';
		},
		startFakeUpload() {
			if ( state.uploading ) {
				return;
			}
			state.uploading = true;
			state.uploadPct = 0;

			const tick = () => {
				if ( state.uploadPct >= 100 ) {
					state.uploading = false;
					return;
				}
				state.uploadPct = Math.min( 100, state.uploadPct + 1 );
				setTimeout( tick, 300 );
			};
			setTimeout( tick, 300 );
		},
		// Real XMLHttpRequest test. Sends a ~5 MB blob to a spike endpoint
		// that sleeps 5s before responding. Both halves of the lifecycle
		// (upload progress + final onload) need to keep firing across a
		// router navigation - that's the property the production refactor
		// depends on.
		startRealUpload() {
			if ( state.realUploading ) {
				return;
			}
			state.realUploading = true;
			state.realUploadPct = 0;
			state.realUploadDone = false;
			state.realUploadResponse = '';
			state.realUploadError = '';

			const oneMb = new Uint8Array( 1024 * 1024 );
			const blob = new Blob( Array( 5 ).fill( oneMb ), {
				type: 'application/octet-stream',
			} );

			const xhr = new XMLHttpRequest();
			xhr.open( 'POST', '/wp-json/clipisode-spike/v1/upload' );
			xhr.upload.onprogress = ( e ) => {
				if ( e.lengthComputable ) {
					state.realUploadPct = Math.round(
						( e.loaded / e.total ) * 100
					);
				}
			};
			xhr.onload = () => {
				state.realUploading = false;
				state.realUploadDone = true;
				state.realUploadPct = 100;
				state.realUploadResponse = xhr.responseText || '';
			};
			xhr.onerror = () => {
				state.realUploading = false;
				state.realUploadError = 'XHR network error';
			};
			xhr.send( blob );
		},
		*gotoDone() {
			yield routerActions.navigate( SPIKE_DONE );
		},
		*gotoMain() {
			yield routerActions.navigate( SPIKE_MAIN );
		},
		cleanUrl() {
			window.history.replaceState( {}, '', SPIKE_MAIN );
			state.path = window.location.pathname;
		},
	},
	callbacks: {
		init() {
			state.visited = ( state.visited || 0 ) + 1;
			state.path = window.location.pathname;
		},
	},
} );

// ----------------------------------------------------------------------------
// Workaround for a WP 6.9 IAPI <-> interactivity-router race.
//
// When the router module loads, its top-level code synchronously calls
// preparePage(..., document, { vdom: initialVdom }). Because initialVdom is
// empty at that point, preparePage walks every [data-wp-interactive]
// [data-wp-router-region] node and calls toVdom() on it, which adds the
// node to the runtime's internal `hydratedIslands` WeakSet.
//
// Then on DOMContentLoaded the runtime calls hydrateRegions(), which checks
// `hydratedIslands.has(node)` BEFORE deciding to hydrate. Our region is
// already in the set, so the runtime skips it - no preact.hydrate() is ever
// called, useInit() never fires, directives never bind, state stays at the
// server-rendered defaults, and buttons appear dead.
//
// To unstick it we use the runtime's own privateApis to manually rebuild
// the vdom and run preact's render against the region root fragment. That
// drives the same code path hydrateRegions() would have driven, just from
// our side.
// ----------------------------------------------------------------------------
const PRIVATE_API_CONSENT =
	'I acknowledge that using private APIs means my theme or plugin will inevitably break in the next version of WordPress.';

function manualHydrate() {
	try {
		const region = document.querySelector(
			'[data-wp-interactive="clipisode/spike"]'
		);
		if ( ! region ) {
			console.warn( '[clipisode/spike] no region found in DOM' );
			return;
		}

		const api =
			typeof interactivity.privateApis === 'function'
				? interactivity.privateApis( PRIVATE_API_CONSENT )
				: null;
		if ( ! api ) {
			console.warn( '[clipisode/spike] privateApis() not available' );
			return;
		}

		const { getRegionRootFragment, toVdom, initialVdom, render } = api;

		const fragment = getRegionRootFragment( region );
		const vdom = toVdom( region );
		initialVdom.set( region, vdom );
		render( vdom, fragment );

		console.info( '[clipisode/spike] manual hydrate ran' );
	} catch ( err ) {
		console.error( '[clipisode/spike] manual hydrate failed', err );
	}
}

if ( document.readyState === 'loading' ) {
	document.addEventListener( 'DOMContentLoaded', manualHydrate, {
		once: true,
	} );
} else {
	manualHydrate();
}
