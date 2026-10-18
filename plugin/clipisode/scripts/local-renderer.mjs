import { createServer } from 'node:http';
import { randomUUID, timingSafeEqual } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { renderComposition } from './render-composition.mjs';

class RequestError extends Error {
	constructor( status, message ) {
		super( message );
		this.status = status;
	}
}

async function readPayload( request ) {
	const chunks = [];
	let size = 0;
	for await ( const chunk of request ) {
		size += chunk.length;
		if ( size > 2 * 1024 * 1024 ) {
			throw new RequestError( 413, 'Composition request exceeds 2 MB.' );
		}
		chunks.push( chunk );
	}
	let payload;
	try {
		payload = JSON.parse( Buffer.concat( chunks ).toString() );
	} catch {
		throw new RequestError( 400, 'A JSON composition request is required.' );
	}
	if ( ! payload || ! Number.isSafeInteger( payload.outputId ) || payload.outputId <= 0 || ! payload.composition?.settings || ! Array.isArray( payload.composition.clips ) ) {
		throw new RequestError( 400, 'An output ID and composition are required.' );
	}
	let callback;
	try {
		callback = new URL( payload.callbackUrl );
	} catch {
		throw new RequestError( 400, 'A WordPress upload callback URL is required.' );
	}
	if ( ! [ 'http:', 'https:' ].includes( callback.protocol ) ) {
		throw new RequestError( 400, 'The upload callback must use HTTP or HTTPS.' );
	}
	return payload;
}

export function createRenderServer( { token, render = renderComposition } ) {
	if ( ! token ) {
		throw new Error( 'Set CLIPISODE_RENDERER_TOKEN to the same secret configured in WordPress.' );
	}
	const authorization = Buffer.from( `Bearer ${ token }` );
	const jobs = new Map();
	const activeOutputs = new Set();
	let queue = Promise.resolve();
	const send = ( response, status, body ) => {
		response.writeHead( status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } );
		response.end( JSON.stringify( body ) );
	};
	const server = createServer( async ( request, response ) => {
		try {
			const provided = Buffer.from( request.headers.authorization || '' );
			if ( provided.length !== authorization.length || ! timingSafeEqual( provided, authorization ) ) {
				throw new RequestError( 401, 'Renderer authentication failed.' );
			}
			const pathname = new URL( request.url, 'http://localhost' ).pathname;
			if ( request.method === 'GET' && pathname === '/health' ) {
				send( response, 200, { status: 'ready' } );
				return;
			}
			if ( request.method === 'POST' && pathname === '/renders' ) {
				const payload = await readPayload( request );
				if ( activeOutputs.has( payload.outputId ) ) {
					throw new RequestError( 409, 'This output is already being rendered.' );
				}
				const job = { id: randomUUID(), status: 'queued', progress: 0, error: null };
				jobs.set( job.id, job );
				activeOutputs.add( payload.outputId );
				send( response, 202, job );
				queue = queue.then( async () => {
					try {
						const url = await render( payload, ( update ) => Object.assign( job, update ) );
						Object.assign( job, { status: 'done', progress: 1, url } );
					} catch ( error ) {
						Object.assign( job, { status: 'error', error: error.message } );
					} finally {
						activeOutputs.delete( payload.outputId );
					}
				} );
				return;
			}
			const match = pathname.match( /^\/renders\/([a-f\d-]+)$/ );
			if ( request.method === 'GET' && match ) {
				const job = jobs.get( match[ 1 ] );
				if ( ! job ) {
					throw new RequestError( 404, 'Render job not found. The local renderer may have restarted; start a new render.' );
				}
				send( response, 200, job );
				return;
			}
			throw new RequestError( 404, 'Renderer endpoint not found.' );
		} catch ( error ) {
			send( response, error.status || 500, { message: error.message } );
		}
	} );
	return server;
}

if ( process.argv[ 1 ] === fileURLToPath( import.meta.url ) ) {
	const host = process.env.CLIPISODE_RENDERER_HOST || '127.0.0.1';
	const port = Number( process.env.CLIPISODE_RENDERER_PORT || 63483 );
	const server = createRenderServer( { token: process.env.CLIPISODE_RENDERER_TOKEN } );
	server.listen( port, host, () => {
		process.stdout.write( `Clipisode local renderer listening on http://${ host }:${ port }\n` );
	} );
}
