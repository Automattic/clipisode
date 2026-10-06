import assert from 'node:assert/strict';
import { test } from 'node:test';
import { once } from 'node:events';
import { createRenderServer } from '../../scripts/local-renderer.mjs';

const payload = ( outputId = 1 ) => ( {
	outputId,
	composition: { clips: [], settings: {} },
	callbackUrl: 'http://localhost/wp-json/clipisode/v1/outputs/1/upload?token=fixture',
} );

async function fixture( t, render ) {
	const server = createRenderServer( { token: 'test-secret', render } );
	server.listen( 0, '127.0.0.1' );
	await once( server, 'listening' );
	t.after( () => { server.closeAllConnections(); server.close(); } );
	return ( path, options = {} ) => fetch( `http://127.0.0.1:${ server.address().port }${ path }`, {
		...options,
		headers: { Authorization: 'Bearer test-secret', 'Content-Type': 'application/json', ...options.headers },
	} );
}

async function terminal( request, id ) {
	for ( let attempt = 0; attempt < 100; attempt++ ) {
		const status = await ( await request( `/renders/${ id }` ) ).json();
		if ( [ 'done', 'error' ].includes( status.status ) ) return status;
		await new Promise( resolve => setTimeout( resolve, 5 ) );
	}
	throw new Error( 'Job did not finish.' );
}

test( 'requires the configured bearer secret and reports missing jobs', async t => {
	const request = await fixture( t, async () => 'unused' );
	assert.equal( ( await request( '/health', { headers: { Authorization: '' } } ) ).status, 401 );
	assert.equal( ( await request( '/health' ) ).status, 200 );
	assert.equal( ( await request( '/renders/0000' ) ).status, 404 );
} );

test( 'serializes jobs, rejects duplicate active outputs, and reports uploaded URL', async t => {
	const started = [];
	let release;
	const gate = new Promise( resolve => { release = resolve; } );
	const request = await fixture( t, async ( data, update ) => {
		started.push( data.outputId );
		update( { status: 'rendering', progress: 0.5 } );
		await gate;
		return `http://localhost/clipisode-${ data.outputId }.mp4`;
	} );
	const start = async id => request( '/renders', { method: 'POST', body: JSON.stringify( payload( id ) ) } );
	const firstResponse = await start( 1 );
	assert.equal( firstResponse.status, 202 );
	const first = await firstResponse.json();
	assert.equal( ( await start( 1 ) ).status, 409 );
	const second = await ( await start( 2 ) ).json();
	assert.equal( ( await ( await request( `/renders/${ second.id }` ) ).json() ).status, 'queued' );
	assert.deepEqual( started, [ 1 ] );
	release();
	assert.equal( ( await terminal( request, first.id ) ).url, 'http://localhost/clipisode-1.mp4' );
	assert.equal( ( await terminal( request, second.id ) ).status, 'done' );
	assert.deepEqual( started, [ 1, 2 ] );
} );

test( 'failed renders release the output for a fresh attempt', async t => {
	let attempts = 0;
	const request = await fixture( t, async () => {
		if ( ++attempts === 1 ) throw new Error( 'Source video could not be loaded.' );
		return 'http://localhost/complete.mp4';
	} );
	const start = async () => ( await request( '/renders', { method: 'POST', body: JSON.stringify( payload() ) } ) ).json();
	const first = await start();
	assert.equal( ( await terminal( request, first.id ) ).error, 'Source video could not be loaded.' );
	const second = await start();
	assert.equal( ( await terminal( request, second.id ) ).status, 'done' );
} );

test( 'rejects malformed requests before enqueueing work', async t => {
	let started = false;
	const request = await fixture( t, async () => { started = true; return ''; } );
	assert.equal( ( await request( '/renders', { method: 'POST', body: '{' } ) ).status, 400 );
	assert.equal( ( await request( '/renders', { method: 'POST', body: JSON.stringify( { ...payload(), callbackUrl: 'file:///tmp/result' } ) } ) ).status, 400 );
	assert.equal( started, false );
} );
