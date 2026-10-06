import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import apiFetch from '@wordpress/api-fetch';
import CreateClipisode from '../../src/pages/CreateClipisode';
import { createDefaultSettings } from '../../src/remotion/themes';
import type { ClipisodeCompositionProps } from '../../src/remotion/types';
import { getVideoDuration } from '../../src/lib/video-metadata';
import {
	getBrowserRenderSupport,
	renderBrowserComposition,
} from '../../src/lib/browser-renderer';

const mockPlayer = jest.fn();
jest.mock( '@wordpress/api-fetch', () => jest.fn() );
jest.mock( '../../src/lib/browser-renderer', () => ( {
	getBrowserRenderSupport: jest.fn(),
	renderBrowserComposition: jest.fn(),
} ) );
jest.mock( '../../src/lib/video-metadata', () => ( {
	getVideoDuration: jest.fn(),
} ) );
jest.mock( '@remotion/player', () => {
	const { forwardRef, useImperativeHandle } = require( '@wordpress/element' );
	return {
		Player: forwardRef( ( props, ref ) => {
			useImperativeHandle( ref, () => ( {
				seekTo: jest.fn(),
				pause: jest.fn(),
			} ) );
			mockPlayer( props );
			return <div data-testid="remotion-player" />;
		} ),
	};
} );

const composition = (): ClipisodeCompositionProps => ( {
	settings: {
		...createDefaultSettings(),
		title: 'The original title',
		subtitle: 'Our community',
	},
	clips: [
		{
			id: 'intro',
			mediaId: 1,
			role: 'intro',
			name: 'Host',
			url: 'https://example.com/intro.mp4',
			duration: 10,
			trimStart: 1,
			trimEnd: 8,
			included: true,
		},
		{
			id: 'reply',
			mediaId: 2,
			role: 'reply',
			name: 'Guest',
			url: 'https://example.com/reply.mp4',
			duration: 8,
			trimStart: 0,
			trimEnd: 6,
			included: true,
		},
	],
} );

const savedOutput = () => ( {
	id: 42,
	name: 'Community stories',
	topic_id: 7,
	composition: composition(),
} );
const mockApi = apiFetch as jest.MockedFunction< typeof apiFetch >;

const openTitleCard = async () => {
	fireEvent.click(
		await screen.findByRole( 'button', { name: 'Configure Opening card' } )
	);
};

const mockEditorApi = (
	implementation: (
		options: Parameters< typeof apiFetch >[ 0 ]
	) => Promise< never >
) => {
	mockApi.mockImplementation( ( options ) => {
		if ( options.path?.endsWith( '/render' ) ) {
			return Promise.resolve( {
				id: null,
				status: 'idle',
				progress: 0,
				error: null,
			} ) as never;
		}
		return implementation( options );
	} );
};

describe( 'Clipisode editor', () => {
	beforeEach( () => {
		jest.resetAllMocks();
		window.history.replaceState( null, '', '#/compose/42' );
	} );

	it( 'restores a saved composition, previews edits, saves them, and reopens the same customized result without a transcoder', async () => {
		let stored = savedOutput();
		mockEditorApi( async ( options ) => {
			if ( options.path === '/clipisode/v1/topics/7' ) {
				return {
					id: 7,
					title: 'Our community',
					hosted_by: 'Host',
					intro_media_id: 1,
				} as never;
			}
			if ( options.method === 'PUT' ) {
				stored = { ...stored, ...( options.data as object ) };
			}
			return stored as never;
		} );
		const websocket = jest.spyOn( window, 'WebSocket' );
		const { unmount } = render(
			<CreateClipisode outputId={ 42 } navigate={ jest.fn() } />
		);
		await openTitleCard();
		await screen.findByDisplayValue( 'The original title' );
		expect(
			screen.getByText(
				'Preview saved. You can reopen it from Clipisodes.'
			)
		).toBeInTheDocument();
		fireEvent.change( screen.getByLabelText( 'Video theme' ), {
			target: { value: 'wpvip' },
		} );
		fireEvent.change( screen.getByLabelText( 'Title' ), {
			target: { value: 'Voices from the team' },
		} );
		fireEvent.change( screen.getByLabelText( 'Accent color' ), {
			target: { value: '#123456' },
		} );
		fireEvent.change( screen.getByLabelText( 'Format' ), {
			target: { value: 'square' },
		} );
		fireEvent.change( screen.getByLabelText( 'Video fit' ), {
			target: { value: 'contain' },
		} );
		fireEvent.click(
			screen.getByRole( 'button', { name: 'Select clip 2: Guest' } )
		);
		fireEvent.change( screen.getByLabelText( 'Speaker for clip 2' ), {
			target: { value: 'Avery' },
		} );
		fireEvent.click(
			screen.getByRole( 'button', { name: 'Move earlier' } )
		);
		fireEvent.click( screen.getByLabelText( 'Include clip 2' ) );
		expect( screen.getByText( 'Unsaved changes' ) ).toBeInTheDocument();
		const preview =
			mockPlayer.mock.calls[ mockPlayer.mock.calls.length - 1 ][ 0 ];
		expect( preview.inputProps.settings ).toMatchObject( {
			themeId: 'wpvip',
			title: 'Voices from the team',
			accentColor: '#123456',
			format: 'square',
			videoFit: 'contain',
		} );
		expect( preview.inputProps.clips ).toMatchObject( [
			{ id: 'reply', name: 'Avery', trimEnd: 6, included: true },
			{ id: 'intro', included: false },
		] );
		fireEvent.click(
			screen.getByRole( 'button', { name: 'Save preview' } )
		);
		await waitFor( () =>
			expect(
				screen.getByText(
					'Preview saved. You can reopen it from Clipisodes.'
				)
			).toBeInTheDocument()
		);
		expect( mockApi ).toHaveBeenCalledWith(
			expect.objectContaining( {
				path: '/clipisode/v1/outputs/42',
				method: 'PUT',
				data: {
					name: 'Community stories',
					topic_id: 7,
					composition: preview.inputProps,
				},
			} )
		);
		expect( websocket ).not.toHaveBeenCalled();
		unmount();
		render( <CreateClipisode outputId={ 42 } navigate={ jest.fn() } /> );
		await openTitleCard();
		await screen.findByDisplayValue( 'Voices from the team' );
		expect( screen.getByLabelText( 'Accent color' ) ).toHaveValue(
			'#123456'
		);
		expect( screen.getByLabelText( 'Speaker for clip 1' ) ).toHaveValue(
			'Avery'
		);
		expect( screen.getByLabelText( 'Include clip 2' ) ).not.toBeChecked();
		expect( getVideoDuration ).not.toHaveBeenCalled();
		websocket.mockRestore();
	} );

	it( 'retains unsaved edits and reports an API save error', async () => {
		mockEditorApi( async ( options ) => {
			if ( options.path === '/clipisode/v1/topics/7' ) {
				return {
					id: 7,
					title: 'Our community',
					hosted_by: 'Host',
					intro_media_id: 1,
				} as never;
			}
			if ( options.method === 'PUT' ) {
				throw new Error( 'Saving is currently unavailable.' );
			}
			return savedOutput() as never;
		} );
		render( <CreateClipisode outputId={ 42 } navigate={ jest.fn() } /> );
		await openTitleCard();
		await screen.findByDisplayValue( 'The original title' );
		fireEvent.change( screen.getByLabelText( 'Title' ), {
			target: { value: 'Keep my edit' },
		} );
		fireEvent.click(
			screen.getByRole( 'button', { name: 'Save preview' } )
		);
		await screen.findByText( 'Saving is currently unavailable.' );
		expect( screen.getByLabelText( 'Title' ) ).toHaveValue(
			'Keep my edit'
		);
		expect( screen.getByText( 'Unsaved changes' ) ).toBeInTheDocument();
		expect(
			screen.getByRole( 'button', { name: 'Save preview' } )
		).toBeEnabled();
	} );

	it( 'loads selected media in the requested order, measures duration, and creates a reloadable preview', async () => {
		( getVideoDuration as jest.Mock ).mockImplementation( async ( url ) =>
			url.endsWith( 'intro.mp4' ) ? 12 : 8
		);
		mockEditorApi( async ( options ) => {
			if ( options.path === '/clipisode/v1/media?ids=1,2' ) {
				return [
					{
						id: 2,
						label: 'Guest',
						url: 'https://example.com/reply.mp4',
						path: 'reply.mp4',
					},
					{
						id: 1,
						label: 'Introduction',
						url: 'https://example.com/intro.mp4',
						path: 'intro.mp4',
					},
				] as never;
			}
			if ( options.path === '/clipisode/v1/topics/7' ) {
				return {
					id: 7,
					title: 'Tell your story',
					intro_media_id: 1,
					hosted_by: 'Jordan',
					invitation_renderer_theme: 'wpvip',
				} as never;
			}
			return { id: 99, ...( options.data as object ) } as never;
		} );
		render(
			<CreateClipisode
				topicId={ 7 }
				mediaIds={ [ 1, 2 ] }
				navigate={ jest.fn() }
			/>
		);
		await screen.findByLabelText( 'Speaker for clip 1' );
		const preview =
			mockPlayer.mock.calls[ mockPlayer.mock.calls.length - 1 ][ 0 ];
		expect( preview.inputProps.settings ).toMatchObject( {
			themeId: 'wpvip',
			title: 'Tell your story',
			subtitle: 'Jordan',
		} );
		expect( preview.inputProps.clips ).toMatchObject( [
			{
				mediaId: 1,
				role: 'intro',
				name: 'Jordan',
				duration: 12,
				trimStart: 0,
				trimEnd: 12,
			},
			{
				mediaId: 2,
				role: 'reply',
				name: 'Guest',
				duration: 8,
				trimEnd: 8,
			},
		] );
		fireEvent.click(
			screen.getByRole( 'button', { name: 'Save preview' } )
		);
		await screen.findByText(
			'Preview saved. You can reopen it from Clipisodes.'
		);
		expect( mockApi ).toHaveBeenCalledWith(
			expect.objectContaining( {
				path: '/clipisode/v1/outputs',
				method: 'POST',
			} )
		);
		expect( window.location.hash ).toBe( '#/compose/99' );
		await openTitleCard();
		fireEvent.change( screen.getByLabelText( 'Title' ), {
			target: { value: 'Changed title' },
		} );
		fireEvent.click(
			screen.getByRole( 'button', { name: 'Save preview' } )
		);
		await screen.findByText(
			'Preview saved. You can reopen it from Clipisodes.'
		);
		expect( mockApi ).toHaveBeenCalledWith(
			expect.objectContaining( {
				path: '/clipisode/v1/outputs/99',
				method: 'PUT',
			} )
		);
	} );

	it( 'reports failed media metadata and retries loading the selected clip', async () => {
		mockApi.mockResolvedValue( [
			{
				id: 2,
				label: 'Guest',
				url: 'https://example.com/reply.mp4',
				path: 'reply.mp4',
			},
		] as never );
		( getVideoDuration as jest.Mock )
			.mockRejectedValueOnce( new Error( 'The video could not load.' ) )
			.mockResolvedValue( 8 );
		const { container } = render(
			<CreateClipisode mediaIds={ [ 2 ] } navigate={ jest.fn() } />
		);
		await screen.findByRole( 'button', { name: 'Retry loading' } );
		expect( container ).toHaveTextContent( 'The video could not load.' );
		expect(
			screen.queryByRole( 'button', { name: 'Save preview' } )
		).not.toBeInTheDocument();
		fireEvent.click(
			screen.getByRole( 'button', { name: 'Retry loading' } )
		);
		await screen.findByLabelText( 'Speaker for clip 1' );
		expect( screen.getByLabelText( 'Speaker for clip 1' ) ).toHaveValue(
			'Guest'
		);
		expect(
			screen.getByRole( 'button', { name: 'Save preview' } )
		).toBeEnabled();
		expect( getVideoDuration ).toHaveBeenCalledTimes( 2 );
	} );

	it( 'keeps editing actions unavailable when an existing composition fails to load', async () => {
		mockApi.mockRejectedValueOnce(
			new Error( 'The saved preview could not load.' )
		);
		render( <CreateClipisode outputId={ 42 } navigate={ jest.fn() } /> );
		await screen.findByRole( 'button', { name: 'Retry loading' } );
		expect(
			screen.queryByRole( 'button', { name: 'Save preview' } )
		).not.toBeInTheDocument();
		expect(
			screen.queryByRole( 'button', { name: 'Add media to Story clips' } )
		).not.toBeInTheDocument();
		expect( screen.queryByLabelText( 'Title' ) ).not.toBeInTheDocument();
		expect( mockPlayer ).not.toHaveBeenCalled();
	} );

	it( 'disables saving when no clip is included', async () => {
		mockEditorApi( async ( options ) =>
			options.path === '/clipisode/v1/topics/7'
				? ( { id: 7, intro_media_id: 1, hosted_by: 'Host' } as never )
				: ( savedOutput() as never )
		);
		render( <CreateClipisode outputId={ 42 } navigate={ jest.fn() } /> );
		await openTitleCard();
		await screen.findByDisplayValue( 'The original title' );
		fireEvent.click( screen.getByLabelText( 'Include clip 1' ) );
		fireEvent.click( screen.getByLabelText( 'Include clip 2' ) );
		expect(
			screen.getByRole( 'button', { name: 'Save preview' } )
		).toBeDisabled();
		expect(
			screen.queryByTestId( 'remotion-player' )
		).not.toBeInTheDocument();
	} );
	it( 'adopts the canonical server values after saving', async () => {
		mockEditorApi( async ( options ) => {
			if ( options.path === '/clipisode/v1/topics/7' ) {
				return { id: 7 } as never;
			}
			if ( options.method === 'PUT' ) {
				const saved = savedOutput();
				saved.composition.settings.title = 'Hello';
				return saved as never;
			}
			return savedOutput() as never;
		} );
		render( <CreateClipisode outputId={ 42 } navigate={ jest.fn() } /> );
		await openTitleCard();
		await screen.findByDisplayValue( 'The original title' );
		fireEvent.change( screen.getByLabelText( 'Title' ), {
			target: { value: '<b>Hello</b>' },
		} );
		fireEvent.click(
			screen.getByRole( 'button', { name: 'Save preview' } )
		);
		await screen.findByDisplayValue( 'Hello' );
		expect(
			screen.getByText(
				'Preview saved. You can reopen it from Clipisodes.'
			)
		).toBeInTheDocument();
	} );

	it( 'keeps edits made while the save request is in flight', async () => {
		let finishSave: ( value: unknown ) => void;
		mockEditorApi( async ( options ) => {
			if ( options.path === '/clipisode/v1/topics/7' ) {
				return { id: 7 } as never;
			}
			if ( options.method === 'PUT' ) {
				return new Promise( ( resolve ) => {
					finishSave = resolve;
				} ) as never;
			}
			return savedOutput() as never;
		} );
		render( <CreateClipisode outputId={ 42 } navigate={ jest.fn() } /> );
		await openTitleCard();
		await screen.findByDisplayValue( 'The original title' );
		fireEvent.click(
			screen.getByRole( 'button', { name: 'Save preview' } )
		);
		fireEvent.change( screen.getByLabelText( 'Title' ), {
			target: { value: 'A newer edit' },
		} );
		finishSave!( savedOutput() );
		await waitFor( () =>
			expect(
				screen.getByRole( 'button', { name: 'Save preview' } )
			).toBeEnabled()
		);
		expect( screen.getByLabelText( 'Title' ) ).toHaveValue(
			'A newer edit'
		);
		expect( screen.getByText( 'Unsaved changes' ) ).toBeInTheDocument();
	} );

	it( 'locks saving during a browser export while letting preview edits continue', async () => {
		( getBrowserRenderSupport as jest.Mock ).mockResolvedValue( {
			supported: true,
		} );
		( renderBrowserComposition as jest.Mock ).mockImplementation(
			( _composition, { signal } ) =>
				new Promise( ( _resolve, reject ) => {
					signal.addEventListener( 'abort', () =>
						reject( new DOMException( 'Aborted', 'AbortError' ) )
					);
				} )
		);
		mockEditorApi( async ( options ) =>
			options.path === '/clipisode/v1/topics/7'
				? ( { id: 7 } as never )
				: ( {
						...savedOutput(),
						slug: 'community-stories',
						composition_hash: 'saved-version',
				  } as never )
		);
		render( <CreateClipisode outputId={ 42 } navigate={ jest.fn() } /> );
		await openTitleCard();
		await screen.findByDisplayValue( 'The original title' );
		fireEvent.click( screen.getByRole( 'tab', { name: 'Export' } ) );
		await waitFor( () =>
			expect(
				screen.getByRole( 'button', { name: 'Render in browser' } )
			).toBeEnabled()
		);
		fireEvent.click(
			screen.getByRole( 'button', { name: 'Render in browser' } )
		);
		await screen.findByText( 'Rendering in browser · 0%' );
		expect(
			screen.getByRole( 'button', { name: 'Save preview' } )
		).toBeDisabled();
		fireEvent.change( screen.getByLabelText( 'Title' ), {
			target: { value: 'A later version' },
		} );
		expect( screen.getByLabelText( 'Title' ) ).toHaveValue(
			'A later version'
		);
		expect(
			( renderBrowserComposition as jest.Mock ).mock.calls[ 0 ][ 0 ]
				.settings.title
		).toBe( 'The original title' );
		fireEvent.click(
			screen.getByRole( 'button', { name: 'Cancel render' } )
		);
		await waitFor( () =>
			expect(
				screen.getByRole( 'button', { name: 'Save preview' } )
			).toBeEnabled()
		);
		expect( screen.getByText( 'Unsaved changes' ) ).toBeInTheDocument();
	} );

	it( 'keeps preview editing available but disables saving during an active MP4 render', async () => {
		mockApi.mockImplementation( async ( options ) => {
			if ( options.path?.endsWith( '/render' ) ) {
				return {
					id: 'job-1',
					status: 'rendering',
					progress: 0.3,
					error: null,
				} as never;
			}
			if ( options.path === '/clipisode/v1/topics/7' ) {
				return { id: 7 } as never;
			}
			return savedOutput() as never;
		} );
		render( <CreateClipisode outputId={ 42 } navigate={ jest.fn() } /> );
		await openTitleCard();
		await screen.findByDisplayValue( 'The original title' );
		fireEvent.click( screen.getByRole( 'tab', { name: 'Export' } ) );
		await waitFor( () =>
			expect(
				screen.getByRole( 'button', { name: 'Save preview' } )
			).toBeDisabled()
		);
		expect( screen.getByText( 'Rendering MP4 · 30%' ) ).toBeInTheDocument();
		fireEvent.change( screen.getByLabelText( 'Title' ), {
			target: { value: 'For the next render' },
		} );
		expect( screen.getByLabelText( 'Title' ) ).toHaveValue(
			'For the next render'
		);
		expect( screen.getByText( 'Unsaved changes' ) ).toBeInTheDocument();
		expect(
			screen.getByRole( 'button', { name: 'Render in browser' } )
		).toBeDisabled();
	} );
	it( 'builds clip fields from the selected theme and keeps edits isolated to each clip', async () => {
		mockEditorApi( async ( options ) =>
			options.path === '/clipisode/v1/topics/7'
				? ( { id: 7 } as never )
				: ( savedOutput() as never )
		);
		render( <CreateClipisode outputId={ 42 } navigate={ jest.fn() } /> );
		await openTitleCard();
		await screen.findByDisplayValue( 'The original title' );
		fireEvent.change( screen.getByLabelText( 'Video theme' ), {
			target: { value: 'wpvip' },
		} );
		fireEvent.click(
			screen.getByRole( 'button', { name: 'Select clip 2: Guest' } )
		);
		expect( screen.getByRole( 'tab', { name: 'Clip' } ) ).toHaveAttribute(
			'aria-selected',
			'true'
		);
		fireEvent.click( screen.getByLabelText( 'Enable Favorite movie' ) );
		fireEvent.change( screen.getByLabelText( 'Favorite movie' ), {
			target: { value: 'Arrival' },
		} );
		fireEvent.click( screen.getByLabelText( 'Enable Caption' ) );
		fireEvent.change( screen.getByLabelText( 'Caption' ), {
			target: { value: 'A community voice' },
		} );
		fireEvent.click(
			screen.getByRole( 'button', { name: 'Select clip 1: Host' } )
		);
		expect(
			screen.queryByLabelText( 'Enable Favorite movie' )
		).not.toBeInTheDocument();
		expect( screen.getByLabelText( 'Enable Caption' ) ).not.toBeChecked();
		fireEvent.click(
			screen.getByRole( 'button', { name: 'Select clip 2: Guest' } )
		);
		expect( screen.getByLabelText( 'Favorite movie' ) ).toHaveValue(
			'Arrival'
		);
		expect( screen.getByLabelText( 'Caption' ) ).toHaveValue(
			'A community voice'
		);
		fireEvent.click( screen.getByRole( 'tab', { name: 'Theme' } ) );
		fireEvent.change( screen.getByLabelText( 'Video theme' ), {
			target: { value: 'none' },
		} );
		const preview =
			mockPlayer.mock.calls[ mockPlayer.mock.calls.length - 1 ][ 0 ]
				.inputProps;
		expect( preview.settings ).toEqual( {
			themeId: 'none',
			format: 'portrait',
			videoFit: 'cover',
		} );
		expect(
			preview.clips.every(
				( clip ) => Object.keys( clip.values ).length === 0
			)
		).toBe( true );
	} );

	it( 'retains an unavailable background reference and blocks saving until it is resolved', async () => {
		mockEditorApi( async ( options ) =>
			options.path === '/clipisode/v1/topics/7'
				? ( { id: 7 } as never )
				: ( savedOutput() as never )
		);
		render( <CreateClipisode outputId={ 42 } navigate={ jest.fn() } /> );
		await openTitleCard();
		await screen.findByDisplayValue( 'The original title' );
		fireEvent.click(
			screen.getByRole( 'button', { name: 'Select clip 2: Guest' } )
		);
		fireEvent.click( screen.getByLabelText( 'Background clip' ) );
		fireEvent.click( screen.getByRole( 'tab', { name: 'Theme' } ) );
		fireEvent.click( screen.getByLabelText( 'Enable Card background' ) );
		fireEvent.change( screen.getByLabelText( 'Card background' ), {
			target: { value: 'reply' },
		} );
		expect(
			screen.getByRole( 'button', { name: 'Save preview' } )
		).toBeEnabled();
		fireEvent.click( screen.getByRole( 'tab', { name: 'Clip' } ) );
		fireEvent.click( screen.getByRole( 'button', { name: 'Remove' } ) );
		fireEvent.click( screen.getByRole( 'tab', { name: 'Theme' } ) );
		expect( screen.getByLabelText( 'Card background' ) ).toHaveValue(
			'reply'
		);
		expect(
			screen.getByRole( 'option', {
				name: 'Unavailable selection (reply)',
			} )
		).toBeInTheDocument();
		expect(
			screen.getByText(
				'Card background must reference an available selection.'
			)
		).toBeInTheDocument();
		expect(
			screen.getByRole( 'button', { name: 'Save preview' } )
		).toBeDisabled();
		fireEvent.click( screen.getByLabelText( 'Enable Card background' ) );
		expect(
			screen.getByRole( 'button', { name: 'Save preview' } )
		).toBeEnabled();
	} );

	it( 'preserves duplicate, keyboard reorder, and remove actions in the clip inspector', async () => {
		mockEditorApi( async ( options ) =>
			options.path === '/clipisode/v1/topics/7'
				? ( { id: 7 } as never )
				: ( savedOutput() as never )
		);
		render( <CreateClipisode outputId={ 42 } navigate={ jest.fn() } /> );
		await openTitleCard();
		await screen.findByDisplayValue( 'The original title' );
		fireEvent.click(
			screen.getByRole( 'button', { name: 'Select clip 2: Guest' } )
		);
		fireEvent.click( screen.getByRole( 'button', { name: 'Duplicate' } ) );
		fireEvent.change( screen.getByLabelText( 'Speaker for clip 3' ), {
			target: { value: 'Second take' },
		} );
		fireEvent.click(
			screen.getByRole( 'button', { name: 'Move earlier' } )
		);
		expect( screen.getByLabelText( 'Speaker for clip 2' ) ).toHaveValue(
			'Second take'
		);
		let preview =
			mockPlayer.mock.calls[ mockPlayer.mock.calls.length - 1 ][ 0 ]
				.inputProps;
		expect( preview.clips.map( ( clip ) => clip.name ) ).toEqual( [
			'Host',
			'Second take',
			'Guest',
		] );
		expect( new Set( preview.clips.map( ( clip ) => clip.id ) ).size ).toBe(
			3
		);
		fireEvent.click( screen.getByLabelText( 'Background clip' ) );
		fireEvent.click( screen.getByLabelText( 'End clip' ) );
		expect( screen.getByLabelText( 'Background clip' ) ).not.toBeChecked();
		expect( screen.getByLabelText( 'End clip' ) ).toBeChecked();
		fireEvent.click( screen.getByRole( 'button', { name: 'Remove' } ) );
		preview =
			mockPlayer.mock.calls[ mockPlayer.mock.calls.length - 1 ][ 0 ]
				.inputProps;
		expect( preview.clips.map( ( clip ) => clip.name ) ).toEqual( [
			'Host',
			'Guest',
		] );
	} );

	it( 'does not preview or save an empty sequence made only of a background clip', async () => {
		const output = savedOutput();
		output.composition.settings.showTitle = false;
		output.composition.settings.showEnding = false;
		output.composition.clips = [
			{ ...output.composition.clips[ 0 ], tags: [ 'background' ] },
		];
		mockEditorApi( async ( options ) =>
			options.path === '/clipisode/v1/topics/7'
				? ( { id: 7 } as never )
				: ( output as never )
		);
		render( <CreateClipisode outputId={ 42 } navigate={ jest.fn() } /> );
		await screen.findByDisplayValue( 'Community stories' );
		expect(
			screen.getAllByText(
				'Include a sequence clip or enable a title or ending card.'
			).length
		).toBeGreaterThan( 0 );
		expect(
			screen.queryByTestId( 'remotion-player' )
		).not.toBeInTheDocument();
		expect(
			screen.getByRole( 'button', { name: 'Save preview' } )
		).toBeDisabled();
		fireEvent.click(
			screen.getByRole( 'button', { name: 'Select clip 1: Host' } )
		);
		fireEvent.click( screen.getByLabelText( 'Background clip' ) );
		expect( screen.getByTestId( 'remotion-player' ) ).toBeInTheDocument();
		expect(
			screen.getByRole( 'button', { name: 'Save preview' } )
		).toBeEnabled();
	} );

	it( 'asks how to handle unsaved changes before following a sidebar link', async () => {
		mockEditorApi( async ( options ) =>
			options.path === '/clipisode/v1/topics/7'
				? ( { id: 7 } as never )
				: ( savedOutput() as never )
		);
		const menu = document.createElement( 'nav' );
		menu.id = 'adminmenu';
		menu.innerHTML = '<a href="#sidebar-destination">Replies</a>';
		document.body.appendChild( menu );
		try {
			render(
				<CreateClipisode outputId={ 42 } navigate={ jest.fn() } />
			);
			await screen.findByDisplayValue( 'Community stories' );
			fireEvent.change( screen.getByLabelText( 'Clipisode name' ), {
				target: { value: 'My edited clipisode' },
			} );
			const link = screen.getByRole( 'link', { name: 'Replies' } );
			expect( fireEvent.click( link ) ).toBe( false );
			expect(
				screen.getByRole( 'dialog', {
					name: 'Unsaved preview changes',
				} )
			).toBeInTheDocument();
			fireEvent.click(
				screen.getByRole( 'button', { name: 'Keep editing' } )
			);
			expect(
				screen.getByDisplayValue( 'My edited clipisode' )
			).toBeInTheDocument();
			expect( window.location.hash ).toBe( '#/compose/42' );
			fireEvent.click( link );
			fireEvent.click(
				screen.getByRole( 'button', { name: 'Save and leave' } )
			);
			await waitFor( () =>
				expect( window.location.hash ).toBe( '#sidebar-destination' )
			);
			expect( mockApi ).toHaveBeenCalledWith(
				expect.objectContaining( {
					method: 'PUT',
					data: expect.objectContaining( {
						name: 'My edited clipisode',
					} ),
				} )
			);
		} finally {
			menu.remove();
		}
	} );
} );
