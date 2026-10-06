import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';
import { openAsBlob } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = fileURLToPath( new URL( '../', import.meta.url ) );

export async function renderComposition( { outputId, composition: inputProps, callbackUrl }, update ) {
	const workdir = await mkdtemp( path.join( tmpdir(), 'clipisode-render-' ) );
	try {
		update( { status: 'rendering', progress: 0 } );
		const serveUrl = await bundle( {
			entryPoint: path.join( projectRoot, 'src/remotion/render-entry.tsx' ),
			outDir: path.join( workdir, 'bundle' ),
			rootDir: projectRoot,
		} );
		const browserExecutable = process.env.REMOTION_BROWSER_EXECUTABLE;
		const composition = await selectComposition( {
			serveUrl,
			id: 'Clipisode',
			inputProps,
			browserExecutable,
		} );
		const outputLocation = path.join( workdir, 'clipisode.mp4' );
		await renderMedia( {
			serveUrl,
			composition,
			inputProps,
			outputLocation,
			codec: 'h264',
			audioCodec: 'aac',
			pixelFormat: 'yuv420p',
			concurrency: 2,
			browserExecutable,
			onProgress: ( { progress } ) => update( { progress } ),
		} );
		update( { status: 'uploading', progress: 1 } );
		const form = new FormData();
		form.append( 'video', await openAsBlob( outputLocation, { type: 'video/mp4' } ), `clipisode-${ outputId }.mp4` );
		const response = await fetch( callbackUrl, {
			method: 'POST',
			body: form,
			signal: AbortSignal.timeout( 120000 ),
		} );
		const result = await response.json();
		if ( ! response.ok ) {
			throw new Error( `WordPress could not store the rendered video (${ response.status }): ${ result.message }` );
		}
		if ( typeof result.url !== 'string' || ! result.url ) {
			throw new Error( 'WordPress did not return a URL for the rendered video.' );
		}
		return result.url;
	} finally {
		await rm( workdir, { recursive: true, force: true } );
	}
}
