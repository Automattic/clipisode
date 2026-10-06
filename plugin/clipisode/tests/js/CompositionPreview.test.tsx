import { fireEvent, render, screen } from '@testing-library/react';
import CompositionPreview from '../../src/components/CompositionPreview';
import ClipisodeComposition from '../../src/remotion/ClipisodeComposition';
import { Internals } from 'remotion';
import { createDefaultSettings } from '../../src/remotion/themes';
import type { ClipisodeCompositionProps } from '../../src/remotion/types';

const mockSeek = jest.fn();
const mockPause = jest.fn();
const mockPlayer = jest.fn();

jest.mock( '@remotion/player', () => {
	const { forwardRef, useImperativeHandle } = require( '@wordpress/element' );
	return {
		Player: forwardRef( ( props, ref ) => {
			useImperativeHandle( ref, () => ( {
				seekTo: mockSeek,
				pause: mockPause,
			} ) );
			mockPlayer( props );
			return <div data-testid="remotion-player" />;
		} ),
	};
} );

const input = (): ClipisodeCompositionProps => ( {
	settings: { ...createDefaultSettings(), title: 'A shared story' },
	clips: [
		{
			id: 'first',
			mediaId: 1,
			role: 'reply',
			name: 'Avery',
			url: 'https://example.com/video.mp4',
			duration: 10,
			trimStart: 2,
			trimEnd: 5,
			included: true,
		},
	],
} );

describe( 'CompositionPreview', () => {
	beforeEach( () => jest.clearAllMocks() );

	it( 'supplies trimmed duration and selected aspect ratio to the Remotion player, with sequence seeking', () => {
		const props = input();
		props.settings.format = 'landscape';
		render(
			<CompositionPreview { ...props } previewFrame={ { frame: 90 } } />
		);
		expect( mockPlayer ).toHaveBeenLastCalledWith(
			expect.objectContaining( {
				inputProps: props,
				durationInFrames: 270,
				compositionWidth: 1920,
				compositionHeight: 1080,
				fps: 30,
				controls: true,
				showVolumeControls: true,
			} )
		);
		expect( mockSeek ).toHaveBeenLastCalledWith( 90 );
		render(
			<CompositionPreview { ...props } previewFrame={ { frame: 180 } } />
		);
		expect( mockSeek ).toHaveBeenLastCalledWith( 180 );
	} );

	it( 'updates the player immediately when settings change and seeks back when the clip range changes', () => {
		const props = input();
		const { rerender } = render( <CompositionPreview { ...props } /> );
		const next = {
			...props,
			settings: {
				...props.settings,
				title: 'Updated title',
				accentColor: '#112233',
			},
			clips: props.clips.map( ( clip ) => ( { ...clip, trimEnd: 4 } ) ),
		};
		rerender( <CompositionPreview { ...next } /> );
		expect( mockPlayer ).toHaveBeenLastCalledWith(
			expect.objectContaining( {
				inputProps: next,
				durationInFrames: 240,
			} )
		);
		expect( mockPause ).toHaveBeenCalledTimes( 2 );
		expect( mockSeek ).toHaveBeenLastCalledWith( 0 );
	} );

	it( 'does not mount a player when all source clips are excluded', () => {
		const props = input();
		props.clips[ 0 ].included = false;
		render( <CompositionPreview { ...props } /> );
		expect(
			screen.getByText( 'Include a clip to preview your composition.' )
		).toBeInTheDocument();
		expect( mockPlayer ).not.toHaveBeenCalled();
	} );

	it( 'shows invalid media timing as an actionable error before constructing a player', () => {
		const props = input();
		props.clips[ 0 ].trimEnd = 20;
		const { container } = render( <CompositionPreview { ...props } /> );
		expect( container ).toHaveTextContent( /must stay within its video/ );
		expect( mockPlayer ).not.toHaveBeenCalled();
	} );

	it( 'propagates an actual HTML video load failure to the actual Player error boundary with the clip name', () => {
		const { Player: ActualPlayer } =
			jest.requireActual( '@remotion/player' );
		const props = input();
		props.settings = createDefaultSettings( 'none' );
		const pause = jest
			.spyOn( HTMLMediaElement.prototype, 'pause' )
			.mockImplementation( () => {} );
		const load = jest
			.spyOn( HTMLMediaElement.prototype, 'load' )
			.mockImplementation( () => {} );
		const { container } = render(
			<Internals.SequenceManager.Provider
				value={ {
					registerSequence: jest.fn(),
					unregisterSequence: jest.fn(),
					sequences: [],
				} }
			>
				<ActualPlayer
					component={ ClipisodeComposition }
					inputProps={ props }
					durationInFrames={ 90 }
					fps={ 30 }
					compositionWidth={ 1080 }
					compositionHeight={ 1920 }
					errorFallback={ ( { error } ) => (
						<div role="alert">{ error.message }</div>
					) }
				/>
			</Internals.SequenceManager.Provider>
		);
		const video = container.querySelector( 'video' );
		expect( video ).not.toBeNull();
		expect( video!.currentTime ).toBeCloseTo( 2 );
		Object.defineProperty( video, 'error', {
			value: { code: 4, message: 'Unsupported source' },
		} );
		fireEvent.error( video! );
		expect( screen.getByRole( 'alert' ) ).toHaveTextContent(
			'Video “Avery” could not play: Code 4: Unsupported source'
		);
		expect( console ).toHaveErrored();
		expect( console ).toHaveWarned();
		pause.mockRestore();
		load.mockRestore();
	} );
} );
