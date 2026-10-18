import { readFileSync } from 'node:fs';
import path from 'node:path';
import { act, render, screen } from '@testing-library/react';
import ClipisodeComposition from '../../src/remotion/ClipisodeComposition';
import type { ClipisodeCompositionProps, ThemeDefinition } from '../../src/remotion/types';

jest.mock( '@remotion/media', () => ( { Video: () => null } ) );
jest.mock( 'remotion', () => ( {
	AbsoluteFill: ( { children } ) => <div>{ children }</div>,
	Sequence: ( { children } ) => <>{ children }</>,
	Loop: ( { children } ) => <>{ children }</>,
	Html5Video: () => null,
	OffthreadVideo: () => null,
	useRemotionEnvironment: () => ( { isRendering: false, isClientSideRendering: false } ),
	useCurrentFrame: () => 15,
	useVideoConfig: () => ( { width: 1080, height: 1920, fps: 30 } ),
	delayRender: () => 1,
	continueRender: jest.fn(),
} ) );

it( 'loads a plugin renderer and draws its card and speaker overlay', async () => {
	const directory = path.resolve( __dirname, '../../../clipisode-studio-theme' );
	const theme = JSON.parse( readFileSync( path.join( directory, 'theme.json' ), 'utf8' ) ) as ThemeDefinition;
	theme.rendererUrl = 'https://example.com/renderer.js';
	const source = readFileSync( path.join( directory, 'renderer.js' ), 'utf8' );
	const append = jest.spyOn( document.head, 'appendChild' ).mockImplementation( ( node ) => {
		window.eval( source );
		queueMicrotask( () => ( node as HTMLScriptElement ).onload?.( new Event( 'load' ) ) );
		return node;
	} );
	const props: ClipisodeCompositionProps = {
		themeDefinition: theme,
		settings: {
			themeId: theme.id,
			themeVersion: theme.version,
			format: 'portrait',
			videoFit: 'cover',
			backgroundColor: '#142034',
			accentColor: '#ffd166',
			textColor: '#ffffff',
			showNames: true,
			showTitle: true,
			title: 'Our story',
			titleDuration: 2,
			showEnding: false,
			endingText: 'Thank you',
			endingDuration: 2,
		},
		clips: [ {
			id: 'first', mediaId: 1, role: 'reply', name: 'Avery',
			url: 'https://example.com/video.mp4', duration: 2,
			trimStart: 0, trimEnd: 2, included: true,
		} ],
	};
	try {
		render( <ClipisodeComposition { ...props } /> );
		await act( async () => {
			await Promise.resolve();
		} );
		expect( screen.getByText( 'Our story' ) ).toBeInTheDocument();
		expect( screen.getByText( 'Avery' ) ).toBeInTheDocument();
		expect( append ).toHaveBeenCalledTimes( 1 );
	} finally {
		append.mockRestore();
	}
} );
