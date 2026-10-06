import {
	getBrowserRenderSupport,
	renderBrowserComposition,
} from '../../src/lib/browser-renderer';
import { createDefaultSettings } from '../../src/remotion/themes';
import type { ClipisodeCompositionProps } from '../../src/remotion/types';

const mockCanRender = jest.fn();
const mockRender = jest.fn();

jest.mock(
	'@remotion/web-renderer',
	() => ( {
		canRenderMediaOnWeb: ( ...args ) => mockCanRender( ...args ),
		renderMediaOnWeb: ( ...args ) => mockRender( ...args ),
	} ),
	{ virtual: true }
);
jest.mock( '../../src/remotion/ClipisodeComposition', () => ( {
	__esModule: true,
	default: () => null,
} ) );

const composition = (): ClipisodeCompositionProps => ( {
	settings: {
		...createDefaultSettings( 'none' ),
		format: 'landscape',
	},
	clips: [
		{
			id: 'one',
			mediaId: 1,
			role: 'reply',
			name: 'Avery',
			url: 'http://localhost/video.mp4',
			duration: 4,
			trimStart: 1,
			trimEnd: 3,
			included: true,
		},
	],
} );

beforeEach( () => {
	jest.clearAllMocks();
	delete window.clipisodeAdmin;
	mockCanRender.mockResolvedValue( {
		canRender: true,
		issues: [],
		resolvedVideoCodec: 'h264',
		resolvedAudioCodec: 'aac',
	} );
} );

it( 'checks both video and audio encoding support at the chosen dimensions', async () => {
	await expect( getBrowserRenderSupport( composition() ) ).resolves.toEqual( {
		supported: true,
	} );
	expect( mockCanRender ).toHaveBeenCalledWith( {
		width: 1920,
		height: 1080,
		container: 'mp4',
		videoCodec: 'h264',
		audioCodec: 'aac',
	} );
} );

it( 'reports codec failures and does not silently change the export codec', async () => {
	mockCanRender.mockResolvedValueOnce( {
		canRender: false,
		issues: [
			{ severity: 'error', message: 'H.264 encoding is unavailable.' },
		],
	} );
	await expect( getBrowserRenderSupport( composition() ) ).resolves.toEqual( {
		supported: false,
		message: 'H.264 encoding is unavailable.',
	} );
	mockCanRender.mockResolvedValueOnce( {
		canRender: true,
		issues: [],
		resolvedVideoCodec: 'h264',
		resolvedAudioCodec: 'opus',
	} );
	expect( ( await getBrowserRenderSupport( composition() ) ).supported ).toBe(
		false
	);
} );

it( 'rejects an empty timeline before loading the encoder', async () => {
	const props = composition();
	props.clips[ 0 ].included = false;
	await expect( getBrowserRenderSupport( props ) ).resolves.toEqual( {
		supported: false,
		message: 'Include at least one video clip before rendering.',
	} );
	expect( mockCanRender ).not.toHaveBeenCalled();
} );

it( 'rejects background-only input without cards before loading the encoder', async () => {
	const props = composition();
	props.settings = {
		...createDefaultSettings(),
		showTitle: false,
		showEnding: false,
	};
	props.clips[ 0 ].tags = [ 'background' ];
	await expect( getBrowserRenderSupport( props ) ).resolves.toEqual( {
		supported: false,
		message: 'Include a sequence clip or enable a title or ending card.',
	} );
	expect( mockCanRender ).not.toHaveBeenCalled();
} );

it( 'renders the saved trim duration with audio, progress, and cancellation', async () => {
	const props = composition();
	const blob = new Blob( [ 'encoded-video' ], { type: 'video/mp4' } );
	const progress = jest.fn();
	const controller = new AbortController();
	mockRender.mockImplementation( async ( options ) => {
		options.onProgress( { progress: 0.6 } );
		return { getBlob: async () => blob };
	} );
	await expect(
		renderBrowserComposition( props, {
			signal: controller.signal,
			onProgress: progress,
		} )
	).resolves.toBe( blob );
	expect( mockRender ).toHaveBeenCalledWith(
		expect.objectContaining( {
			composition: expect.objectContaining( {
				width: 1920,
				height: 1080,
				durationInFrames: 60,
				fps: 30,
			} ),
			inputProps: props,
			videoCodec: 'h264',
			audioCodec: 'aac',
			signal: controller.signal,
			licenseKey: null,
		} )
	);
	expect( progress ).toHaveBeenCalledWith( 0.6 );
} );

it( 'does not start an export that has already been cancelled', async () => {
	const controller = new AbortController();
	controller.abort();
	await expect(
		renderBrowserComposition( composition(), {
			signal: controller.signal,
			onProgress: jest.fn(),
		} )
	).rejects.toBeDefined();
	expect( mockRender ).not.toHaveBeenCalled();
} );
