import { act, fireEvent, render, screen } from '@testing-library/react';
import apiFetch from '@wordpress/api-fetch';
import CompositionExport from '../../src/components/CompositionExport';
import {
	getBrowserRenderSupport,
	renderBrowserComposition,
} from '../../src/lib/browser-renderer';
import { createDefaultSettings } from '../../src/remotion/themes';
import type { OutputRenderStatus } from '../../src/types';

jest.mock( '@wordpress/api-fetch', () => jest.fn() );
jest.mock( '../../src/lib/browser-renderer', () => ( {
	getBrowserRenderSupport: jest.fn(),
	renderBrowserComposition: jest.fn(),
} ) );
const mockApi = apiFetch as jest.MockedFunction< typeof apiFetch >;
const idle: OutputRenderStatus = {
	id: null,
	status: 'idle',
	progress: 0,
	error: null,
	external_available: true,
};
const job = (
	status: OutputRenderStatus[ 'status' ],
	progress = 0
): OutputRenderStatus => ( {
	id: 'job-1',
	status,
	progress,
	error: null,
	external_available: true,
} );
const flush = async () => act( async () => {} );
const tick = async () =>
	act( async () => {
		jest.advanceTimersByTime( 2000 );
	} );

describe( 'CompositionExport', () => {
	beforeEach( () => {
		jest.useFakeTimers();
		jest.resetAllMocks();
		mockApi.mockResolvedValue( idle as never );
		( getBrowserRenderSupport as jest.Mock ).mockResolvedValue( {
			supported: true,
		} );
		URL.createObjectURL = jest.fn( () => 'blob:rendered-mp4' );
		URL.revokeObjectURL = jest.fn();
	} );

	afterEach( () => {
		jest.clearAllTimers();
		jest.useRealTimers();
	} );

	it( 'requires a saved, unchanged preview and waits for its current render status', async () => {
		const onRenderingChange = jest.fn();
		const { rerender } = render(
			<CompositionExport
				dirty
				disabled={ false }
				onRenderingChange={ onRenderingChange }
			/>
		);
		expect( mockApi ).not.toHaveBeenCalled();
		expect(
			screen.getByRole( 'button', { name: 'Render in browser' } )
		).toBeDisabled();
		rerender(
			<CompositionExport
				outputId={ 42 }
				dirty
				disabled={ false }
				onRenderingChange={ onRenderingChange }
			/>
		);
		await flush();
		expect( mockApi ).toHaveBeenCalledWith(
			expect.objectContaining( {
				path: '/clipisode/v1/outputs/42/render',
			} )
		);
		expect(
			screen.getByRole( 'button', { name: 'Render with service' } )
		).toBeDisabled();
		rerender(
			<CompositionExport
				outputId={ 42 }
				dirty={ false }
				disabled={ false }
				onRenderingChange={ onRenderingChange }
			/>
		);
		expect(
			screen.getByRole( 'button', { name: 'Render with service' } )
		).toBeEnabled();
		rerender(
			<CompositionExport
				outputId={ 42 }
				dirty={ false }
				disabled
				onRenderingChange={ onRenderingChange }
			/>
		);
		expect(
			screen.getByRole( 'button', { name: 'Render with service' } )
		).toBeDisabled();
	} );

	it( 'renders the saved output, polls through upload, and stops at the downloadable MP4', async () => {
		mockApi
			.mockResolvedValueOnce( idle as never )
			.mockResolvedValueOnce( job( 'queued' ) as never )
			.mockResolvedValueOnce( job( 'rendering', 0.4 ) as never )
			.mockResolvedValueOnce( job( 'uploading', 0.95 ) as never )
			.mockResolvedValueOnce( {
				...job( 'done', 1 ),
				url: 'https://example.com/render.mp4',
			} as never );
		const onRenderingChange = jest.fn();
		render(
			<CompositionExport
				outputId={ 42 }
				dirty={ false }
				disabled={ false }
				onRenderingChange={ onRenderingChange }
			/>
		);
		await flush();
		fireEvent.click(
			screen.getByRole( 'button', { name: 'Render with service' } )
		);
		await flush();
		expect( mockApi ).toHaveBeenCalledWith(
			expect.objectContaining( {
				path: '/clipisode/v1/outputs/42/render',
				method: 'POST',
			} )
		);
		expect( screen.getByText( 'Rendering MP4 · 40%' ) ).toBeInTheDocument();
		expect( screen.getByRole( 'progressbar' ) ).toHaveAttribute(
			'value',
			'0.4'
		);
		expect( onRenderingChange ).toHaveBeenLastCalledWith( true );
		await tick();
		expect( screen.getByText( 'Uploading MP4 · 95%' ) ).toBeInTheDocument();
		await tick();
		expect(
			screen.getByRole( 'link', { name: 'Download MP4' } )
		).toHaveAttribute( 'href', 'https://example.com/render.mp4' );
		expect( onRenderingChange ).toHaveBeenLastCalledWith( false );
		await tick();
		expect( mockApi ).toHaveBeenCalledTimes( 5 );
	} );

	it( 'resumes an active job after reload and cancels polling on unmount', async () => {
		mockApi.mockResolvedValue( job( 'queued' ) as never );
		const onRenderingChange = jest.fn();
		const { unmount } = render(
			<CompositionExport
				outputId={ 42 }
				dirty={ false }
				disabled={ false }
				onRenderingChange={ onRenderingChange }
			/>
		);
		await flush();
		expect(
			screen.getByText( 'Waiting to render · 0%' )
		).toBeInTheDocument();
		expect( onRenderingChange ).toHaveBeenLastCalledWith( true );
		unmount();
		await tick();
		expect( mockApi ).toHaveBeenCalledTimes( 1 );
		expect( mockApi.mock.calls[ 0 ][ 0 ].signal?.aborted ).toBe( true );
		expect( onRenderingChange ).toHaveBeenLastCalledWith( false );
	} );

	it( 'retains active state after a status failure and retries observation without starting another job', async () => {
		mockApi
			.mockResolvedValueOnce( job( 'rendering', 0.2 ) as never )
			.mockRejectedValueOnce(
				new Error( 'The local renderer is unavailable.' )
			)
			.mockResolvedValueOnce( {
				...job( 'done', 1 ),
				url: 'https://example.com/render.mp4',
			} as never );
		const onRenderingChange = jest.fn();
		render(
			<CompositionExport
				outputId={ 42 }
				dirty={ false }
				disabled={ false }
				onRenderingChange={ onRenderingChange }
			/>
		);
		await flush();
		await tick();
		expect(
			screen.getByText( 'The local renderer is unavailable.', {
				selector: 'p',
			} )
		).toBeInTheDocument();
		expect(
			screen.getByRole( 'button', { name: 'Render with service' } )
		).toBeDisabled();
		expect( onRenderingChange ).toHaveBeenLastCalledWith( true );
		await tick();
		expect( mockApi ).toHaveBeenCalledTimes( 2 );
		fireEvent.click(
			screen.getByRole( 'button', { name: 'Retry status' } )
		);
		await flush();
		expect(
			screen.queryByText( 'The local renderer is unavailable.', {
				selector: 'p',
			} )
		).not.toBeInTheDocument();
		expect(
			screen.getByRole( 'link', { name: 'Download MP4' } )
		).toBeInTheDocument();
		expect(
			mockApi.mock.calls.every(
				( [ request ] ) => request.method !== 'POST'
			)
		).toBe( true );
	} );

	it( 'offers a render retry only after a confirmed failed job', async () => {
		mockApi
			.mockResolvedValueOnce( {
				...job( 'error' ),
				error: 'Source video could not load.',
			} as never )
			.mockResolvedValue( job( 'queued' ) as never );
		render(
			<CompositionExport
				outputId={ 42 }
				dirty={ false }
				disabled={ false }
				onRenderingChange={ jest.fn() }
			/>
		);
		await flush();
		expect(
			screen.getByText( 'Source video could not load.', {
				selector: 'p',
			} )
		).toBeInTheDocument();
		fireEvent.click(
			screen.getByRole( 'button', { name: 'Render with service' } )
		);
		await flush();
		expect(
			screen.queryByText( 'Source video could not load.', {
				selector: 'p',
			} )
		).not.toBeInTheDocument();
		expect(
			screen.getByText( 'Waiting to render · 0%' )
		).toBeInTheDocument();
	} );

	it( 'checks authoritative status when a start response is lost', async () => {
		mockApi
			.mockResolvedValueOnce( idle as never )
			.mockRejectedValueOnce( new Error( 'The response was lost.' ) )
			.mockResolvedValue( job( 'rendering', 0.1 ) as never );
		render(
			<CompositionExport
				outputId={ 42 }
				dirty={ false }
				disabled={ false }
				onRenderingChange={ jest.fn() }
			/>
		);
		await flush();
		fireEvent.click(
			screen.getByRole( 'button', { name: 'Render with service' } )
		);
		await flush();
		expect( screen.getByText( 'Rendering MP4 · 10%' ) ).toBeInTheDocument();
		expect(
			screen.queryByText( 'The response was lost.', { selector: 'p' } )
		).not.toBeInTheDocument();
		expect(
			mockApi.mock.calls.filter(
				( [ request ] ) => request.method === 'POST'
			)
		).toHaveLength( 1 );
	} );

	it( 'aborts a pending start request on unmount without scheduling a status fetch', async () => {
		let finishStart: ( result: unknown ) => void;
		mockApi.mockResolvedValueOnce( idle as never ).mockImplementationOnce(
			() =>
				new Promise( ( resolve ) => {
					finishStart = resolve;
				} ) as never
		);
		const { unmount } = render(
			<CompositionExport
				outputId={ 42 }
				dirty={ false }
				disabled={ false }
				onRenderingChange={ jest.fn() }
			/>
		);
		await flush();
		fireEvent.click(
			screen.getByRole( 'button', { name: 'Render with service' } )
		);
		unmount();
		expect( mockApi.mock.calls[ 1 ][ 0 ].signal?.aborted ).toBe( true );
		await act( async () => finishStart!( job( 'queued' ) ) );
		expect( mockApi ).toHaveBeenCalledTimes( 2 );
	} );
} );

const saved = {
	id: 42,
	slug: 'community-stories',
	composition_hash: 'saved-composition-hash',
	composition: { clips: [], settings: createDefaultSettings() },
};

describe( 'Browser MP4 export', () => {
	beforeEach( () => {
		jest.resetAllMocks();
		( getBrowserRenderSupport as jest.Mock ).mockResolvedValue( {
			supported: true,
		} );
		( renderBrowserComposition as jest.Mock ).mockResolvedValue(
			new Blob( [ 'mp4' ], { type: 'video/mp4' } )
		);
		URL.createObjectURL = jest.fn( () => 'blob:rendered-mp4' );
		URL.revokeObjectURL = jest.fn();
		let uploaded = false;
		mockApi.mockImplementation( async ( request ) => {
			if ( request.path?.endsWith( '/browser-render' ) ) {
				uploaded = true;
				return {
					id: 91,
					url: 'https://example.com/browser.mp4',
				} as never;
			}
			if ( request.path?.endsWith( '/render' ) ) {
				return {
					...idle,
					external_available: false,
					...( uploaded
						? {
								status: 'done',
								url: 'https://example.com/browser.mp4',
						  }
						: {} ),
				} as never;
			}
			return saved as never;
		} );
	} );

	it( 'renders fresh saved inputs and uploads the MP4 with their exact composition hash', async () => {
		const onRenderingChange = jest.fn();
		let finishRender: ( blob: Blob ) => void;
		( renderBrowserComposition as jest.Mock ).mockImplementation(
			( _composition, options ) => {
				options.onProgress( 0.35 );
				return new Promise( ( resolve ) => {
					finishRender = resolve;
				} );
			}
		);
		render(
			<CompositionExport
				outputId={ 42 }
				dirty={ false }
				disabled={ false }
				onRenderingChange={ onRenderingChange }
			/>
		);
		await flush();
		expect(
			screen.queryByRole( 'button', { name: 'Render with service' } )
		).not.toBeInTheDocument();
		fireEvent.click(
			screen.getByRole( 'button', { name: 'Render in browser' } )
		);
		await flush();
		expect( getBrowserRenderSupport ).toHaveBeenCalledWith(
			saved.composition
		);
		expect( renderBrowserComposition ).toHaveBeenCalledWith(
			saved.composition,
			expect.objectContaining( {
				signal: expect.any( AbortSignal ),
				onProgress: expect.any( Function ),
			} )
		);
		expect(
			screen.getByText( 'Rendering in browser · 35%' )
		).toBeInTheDocument();
		expect(
			screen.getByRole( 'progressbar', {
				name: 'Browser render progress',
			} )
		).toHaveAttribute( 'value', '0.35' );
		expect( onRenderingChange ).toHaveBeenLastCalledWith( true );
		const unload = new Event( 'beforeunload', { cancelable: true } );
		window.dispatchEvent( unload );
		expect( unload.defaultPrevented ).toBe( true );
		await act( async () =>
			finishRender!( new Blob( [ 'mp4' ], { type: 'video/mp4' } ) )
		);
		const upload = mockApi.mock.calls.find(
			( [ request ] ) => request.path?.endsWith( '/browser-render' )
		)![ 0 ];
		expect( upload.method ).toBe( 'POST' );
		const body = upload.body as FormData;
		expect( body.get( 'composition_hash' ) ).toBe( saved.composition_hash );
		expect( ( body.get( 'video' ) as File ).name ).toBe(
			'community-stories.mp4'
		);
		expect( ( body.get( 'video' ) as File ).type ).toBe( 'video/mp4' );
		expect( onRenderingChange ).toHaveBeenLastCalledWith( false );
		expect(
			screen.getByRole( 'link', { name: 'Download MP4' } )
		).toHaveAttribute( 'href', 'https://example.com/browser.mp4' );
		expect(
			mockApi.mock.calls.filter(
				( [ request ] ) => request.path?.endsWith( '/render' )
			)
		).toHaveLength( 2 );
		const completedUnload = new Event( 'beforeunload', {
			cancelable: true,
		} );
		window.dispatchEvent( completedUnload );
		expect( completedUnload.defaultPrevented ).toBe( false );
	} );

	it( 'explains unsupported encoding before rendering or uploading', async () => {
		( getBrowserRenderSupport as jest.Mock ).mockResolvedValue( {
			supported: false,
			message: 'H.264 encoding is unavailable in this browser.',
		} );
		render(
			<CompositionExport
				outputId={ 42 }
				dirty={ false }
				disabled={ false }
				onRenderingChange={ jest.fn() }
			/>
		);
		await flush();
		fireEvent.click(
			screen.getByRole( 'button', { name: 'Render in browser' } )
		);
		await flush();
		expect(
			screen.getByText(
				'H.264 encoding is unavailable in this browser.',
				{
					selector: 'p',
				}
			)
		).toBeInTheDocument();
		expect( renderBrowserComposition ).not.toHaveBeenCalled();
		expect(
			mockApi.mock.calls.every(
				( [ request ] ) => request.method !== 'POST'
			)
		).toBe( true );
		expect(
			screen.getByRole( 'button', { name: 'Render in browser' } )
		).toBeEnabled();
	} );

	it( 'cancels rendering without an upload and releases the editor once cancellation settles', async () => {
		const onRenderingChange = jest.fn();
		( renderBrowserComposition as jest.Mock ).mockImplementation(
			( _composition, { signal } ) =>
				new Promise( ( _resolve, reject ) => {
					signal.addEventListener( 'abort', () =>
						reject( new DOMException( 'Aborted', 'AbortError' ) )
					);
				} )
		);
		render(
			<CompositionExport
				outputId={ 42 }
				dirty={ false }
				disabled={ false }
				onRenderingChange={ onRenderingChange }
			/>
		);
		await flush();
		fireEvent.click(
			screen.getByRole( 'button', { name: 'Render in browser' } )
		);
		await flush();
		fireEvent.click(
			screen.getByRole( 'button', { name: 'Cancel render' } )
		);
		await flush();
		expect(
			( renderBrowserComposition as jest.Mock ).mock.calls[ 0 ][ 1 ]
				.signal.aborted
		).toBe( true );
		expect( onRenderingChange ).toHaveBeenLastCalledWith( false );
		expect(
			screen.queryByRole( 'button', { name: 'Cancel render' } )
		).not.toBeInTheDocument();
		expect( screen.queryByText( 'Aborted' ) ).not.toBeInTheDocument();
		expect(
			mockApi.mock.calls.every(
				( [ request ] ) => request.method !== 'POST'
			)
		).toBe( true );
	} );

	it( 'retains a finished MP4 after an upload error and retries without rendering again', async () => {
		let uploads = 0;
		mockApi.mockImplementation( async ( request ) => {
			if ( request.path?.endsWith( '/browser-render' ) ) {
				if ( ++uploads === 1 ) {
					throw new Error( 'Upload connection failed.' );
				}
				return {
					id: 91,
					url: 'https://example.com/browser.mp4',
				} as never;
			}
			if ( request.path?.endsWith( '/render' ) ) {
				return {
					...idle,
					external_available: false,
					...( uploads === 2
						? {
								status: 'done',
								url: 'https://example.com/browser.mp4',
						  }
						: {} ),
				} as never;
			}
			return saved as never;
		} );
		const { unmount } = render(
			<CompositionExport
				outputId={ 42 }
				dirty={ false }
				disabled={ false }
				onRenderingChange={ jest.fn() }
			/>
		);
		await flush();
		fireEvent.click(
			screen.getByRole( 'button', { name: 'Render in browser' } )
		);
		await flush();
		expect(
			screen.getByText(
				/The MP4 is ready, but saving it to WordPress failed:/,
				{
					selector: 'p',
				}
			)
		).toHaveTextContent( 'Upload connection failed.' );
		expect(
			screen.getByRole( 'link', { name: 'Download MP4' } )
		).toHaveAttribute( 'href', 'blob:rendered-mp4' );
		expect(
			screen.getByRole( 'button', { name: 'Render in browser' } )
		).toBeDisabled();
		fireEvent.click(
			screen.getByRole( 'button', { name: 'Retry upload' } )
		);
		await flush();
		expect( renderBrowserComposition ).toHaveBeenCalledTimes( 1 );
		expect( uploads ).toBe( 2 );
		expect(
			screen.getByRole( 'link', { name: 'Download MP4' } )
		).toHaveAttribute( 'href', 'https://example.com/browser.mp4' );
		expect( URL.revokeObjectURL ).toHaveBeenCalledWith(
			'blob:rendered-mp4'
		);
		unmount();
	} );

	it( 'aborts on unmount and ignores late browser completion', async () => {
		let finishRender: ( blob: Blob ) => void;
		( renderBrowserComposition as jest.Mock ).mockImplementation(
			() =>
				new Promise( ( resolve ) => {
					finishRender = resolve;
				} )
		);
		const { unmount } = render(
			<CompositionExport
				outputId={ 42 }
				dirty={ false }
				disabled={ false }
				onRenderingChange={ jest.fn() }
			/>
		);
		await flush();
		fireEvent.click(
			screen.getByRole( 'button', { name: 'Render in browser' } )
		);
		await flush();
		unmount();
		expect(
			( renderBrowserComposition as jest.Mock ).mock.calls[ 0 ][ 1 ]
				.signal.aborted
		).toBe( true );
		await act( async () => finishRender!( new Blob( [ 'mp4' ] ) ) );
		expect(
			mockApi.mock.calls.every(
				( [ request ] ) => request.method !== 'POST'
			)
		).toBe( true );
	} );
} );
