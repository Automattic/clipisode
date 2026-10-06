import { getVideoDuration } from '../../src/lib/video-metadata';

describe( 'video metadata loading', () => {
	let createElement: jest.SpyInstance;
	let load: jest.SpyInstance;
	beforeEach( () => {
		jest.useFakeTimers();
		createElement = jest.spyOn( document, 'createElement' );
		load = jest
			.spyOn( HTMLMediaElement.prototype, 'load' )
			.mockImplementation( () => {} );
	} );
	afterEach( () => {
		createElement.mockRestore();
		load.mockRestore();
		jest.useRealTimers();
	} );
	const createdVideo = (): HTMLVideoElement =>
		createElement.mock.results[ 0 ].value;
	const expectReleased = ( video: HTMLVideoElement ) => {
		expect( video.onloadedmetadata ).toBeNull();
		expect( video.onerror ).toBeNull();
		expect( video ).not.toHaveAttribute( 'src' );
		expect( load ).toHaveBeenCalledTimes( 1 );
		expect( jest.getTimerCount() ).toBe( 0 );
	};

	it( 'resolves the browser duration and releases the media source and timeout', async () => {
		const promise = getVideoDuration( 'https://example.com/video.mp4' );
		const video = createdVideo();
		expect( video.preload ).toBe( 'metadata' );
		Object.defineProperty( video, 'duration', { value: 12.34 } );
		video.dispatchEvent( new Event( 'loadedmetadata' ) );
		await expect( promise ).resolves.toBe( 12.34 );
		expectReleased( video );
	} );

	it( 'rejects a browser media error and releases the request', async () => {
		const promise = getVideoDuration( 'https://example.com/broken.mp4' );
		const result = expect( promise ).rejects.toThrow(
			'Video metadata could not be loaded'
		);
		const video = createdVideo();
		video.dispatchEvent( new Event( 'error' ) );
		await result;
		expectReleased( video );
	} );

	it( 'rejects a stalled metadata request after 30 seconds and releases it', async () => {
		const promise = getVideoDuration( 'https://example.com/stalled.mp4' );
		const result = expect( promise ).rejects.toThrow(
			'Video metadata could not be loaded'
		);
		const video = createdVideo();
		jest.advanceTimersByTime( 30000 );
		await result;
		expectReleased( video );
	} );

	it.each( [ NaN, Infinity, 0, -1 ] )(
		'rejects unusable duration %s without substituting footage length',
		async ( duration ) => {
			const promise = getVideoDuration( 'https://example.com/video.mp4' );
			const result = expect( promise ).rejects.toThrow(
				'Video metadata could not be loaded'
			);
			const video = createdVideo();
			Object.defineProperty( video, 'duration', { value: duration } );
			video.dispatchEvent( new Event( 'loadedmetadata' ) );
			await result;
			expectReleased( video );
		}
	);
} );
