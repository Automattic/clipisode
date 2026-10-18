import { calculateCompositionMetadata } from '../../src/remotion/render-entry';
import { createDefaultSettings } from '../../src/remotion/themes';
import { createDefaultSettings as createThemeSettings, getThemeDefinition } from '../../src/remotion/theme-schema';
import type { ClipisodeCompositionProps } from '../../src/remotion/types';

jest.mock( 'remotion', () => ( {
	...jest.requireActual( 'remotion' ),
	registerRoot: jest.fn(),
} ) );

const input = (): ClipisodeCompositionProps => ( {
	settings: {
		...createDefaultSettings(),
		titleDuration: 2,
		endingDuration: 1,
	},
	clips: [
		{
			id: 'first',
			mediaId: 1,
			role: 'reply',
			name: 'Avery',
			url: 'https://example.com/avery.mp4',
			duration: 10,
			trimStart: 2,
			trimEnd: 5,
			included: true,
		},
	],
} );

const metadata = ( props: ClipisodeCompositionProps ) =>
	calculateCompositionMetadata( {
		props,
		defaultProps: props,
		abortSignal: new AbortController().signal,
		compositionId: 'Clipisode',
		isRendering: true,
	} );

describe( 'server render metadata', () => {
	it.each( [
		[ 'portrait', 1080, 1920 ],
		[ 'landscape', 1920, 1080 ],
		[ 'square', 1080, 1080 ],
	] as const )(
		'uses the same %s format and trimmed timeline as the player',
		( format, width, height ) => {
			const props = input();
			props.settings.format = format;
			expect( metadata( props ) ).toEqual( {
				width,
				height,
				durationInFrames: 180,
				fps: 30,
				defaultCodec: 'h264',
				defaultPixelFormat: 'yuv420p',
			} );
		}
	);

	it( 'renders raw video without title or ending when no theme is selected', () => {
		const props = input();
		props.settings.themeId = 'none';
		expect( metadata( props ) ).toMatchObject( { durationInFrames: 90 } );
	} );

	it( 'loads a plugin theme definition supplied with the render job', () => {
		const props = input();
		props.themeDefinition = {
			...getThemeDefinition( 'default' ),
			id: 'community-test',
			version: '1.0.0',
		};
		props.settings.themeId = 'community-test';
		props.settings.themeVersion = '1.0.0';
		expect( metadata( props ) ).toMatchObject( {
			durationInFrames: 180,
		} );
		expect( getThemeDefinition( 'community-test' ).label ).toBe(
			'Clipisode'
		);
		expect( createThemeSettings( 'community-test' ).themeVersion ).toBe(
			'1.0.0'
		);
	} );

	it( 'requires explicit input instead of generating a substitute composition', () => {
		expect( () => metadata( {} as ClipisodeCompositionProps ) ).toThrow(
			'requires composition clips and settings'
		);
	} );

	it( 'rejects cards-only renders when every video is excluded', () => {
		const props = input();
		props.clips[ 0 ].included = false;
		expect( () => metadata( props ) ).toThrow(
			'Include at least one video clip'
		);
	} );

	it( 'rejects invalid trims and unknown dimensions before rendering frames', () => {
		const props = input();
		props.clips[ 0 ].trimEnd = 11;
		expect( () => metadata( props ) ).toThrow(
			'must stay within its video'
		);
		props.settings.format = 'invalid' as typeof props.settings.format;
		expect( () => metadata( props ) ).toThrow(
			'Unknown composition format'
		);
	} );
} );
