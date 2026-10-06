import { act, render, screen } from '@testing-library/react';
import { Component } from '@wordpress/element';
import type { ReactNode } from 'react';
import ClipisodeComposition from '../../src/remotion/ClipisodeComposition';
import { createDefaultSettings } from '../../src/remotion/themes';
import type { ClipisodeCompositionProps } from '../../src/remotion/types';

const mockBrowserVideo = jest.fn( () => null );
const mockHtml5Video = jest.fn( () => null );
const mockOffthreadVideo = jest.fn( () => null );
let mockEnvironment = { isRendering: false, isClientSideRendering: false };

jest.mock( '@remotion/media', () => ( {
	Video: ( props ) => mockBrowserVideo( props ),
} ) );

jest.mock( 'remotion', () => ( {
	AbsoluteFill: ( { children } ) => <div>{ children }</div>,
	Sequence: ( { children } ) => <>{ children }</>,
	Html5Video: ( props ) => mockHtml5Video( props ),
	OffthreadVideo: ( props ) => mockOffthreadVideo( props ),
	useRemotionEnvironment: () => mockEnvironment,
	useCurrentFrame: () => 0,
	useVideoConfig: () => ( { width: 1080, height: 1920, fps: 30 } ),
} ) );

class ErrorBoundary extends Component<
	{ children: ReactNode },
	{ error: Error | null }
> {
	state = { error: null as Error | null };

	static getDerivedStateFromError( error: Error ) {
		return { error };
	}

	render() {
		return this.state.error ? (
			<div role="alert">{ this.state.error.message }</div>
		) : (
			this.props.children
		);
	}
}

const input = (): ClipisodeCompositionProps => ( {
	settings: { ...createDefaultSettings( 'none' ), videoFit: 'contain' },
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

describe( 'composition media across render environments', () => {
	beforeEach( () => {
		jest.clearAllMocks();
		mockEnvironment = {
			isRendering: false,
			isClientSideRendering: false,
		};
	} );

	it( 'keeps native playback with audio and exact trims in the Player', () => {
		render( <ClipisodeComposition { ...input() } /> );
		expect( mockHtml5Video ).toHaveBeenCalledWith(
			expect.objectContaining( {
				src: 'https://example.com/avery.mp4',
				trimBefore: 60,
				trimAfter: 150,
				pauseWhenBuffering: true,
				style: expect.objectContaining( { objectFit: 'contain' } ),
			} )
		);
		expect( mockBrowserVideo ).not.toHaveBeenCalled();
		expect( mockOffthreadVideo ).not.toHaveBeenCalled();
	} );

	it( 'keeps the server frame extractor when rendering externally', () => {
		mockEnvironment.isRendering = true;
		render( <ClipisodeComposition { ...input() } /> );
		expect( mockOffthreadVideo ).toHaveBeenCalledWith(
			expect.objectContaining( { trimBefore: 60, trimAfter: 150 } )
		);
		expect( mockBrowserVideo ).not.toHaveBeenCalled();
		expect( mockHtml5Video ).not.toHaveBeenCalled();
	} );

	it( 'uses browser frame extraction with identical trims and fit without requiring a server', () => {
		mockEnvironment = {
			isRendering: true,
			isClientSideRendering: true,
		};
		render( <ClipisodeComposition { ...input() } /> );
		expect( mockBrowserVideo ).toHaveBeenCalledWith(
			expect.objectContaining( {
				src: 'https://example.com/avery.mp4',
				trimBefore: 60,
				trimAfter: 150,
				objectFit: 'contain',
				disallowFallbackToOffthreadVideo: true,
			} )
		);
		expect( mockOffthreadVideo ).not.toHaveBeenCalled();
		expect( mockHtml5Video ).not.toHaveBeenCalled();
	} );

	it( 'stops browser export and identifies the clip when its codec cannot decode', () => {
		mockEnvironment.isClientSideRendering = true;
		render(
			<ErrorBoundary>
				<ClipisodeComposition { ...input() } />
			</ErrorBoundary>
		);
		const { onError } = mockBrowserVideo.mock.calls[ 0 ][ 0 ];
		act( () => {
			expect( onError( new Error( 'Unsupported codec' ) ) ).toBe(
				'fail'
			);
		} );
		expect( screen.getByRole( 'alert' ) ).toHaveTextContent(
			'Video “Avery” could not play: Unsupported codec'
		);
		expect( console ).toHaveErrored();
		expect( mockOffthreadVideo ).not.toHaveBeenCalled();
	} );
} );
