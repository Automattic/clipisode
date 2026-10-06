import { useEffect, useRef, useState } from '@wordpress/element';
import { Button, Notice, Spinner } from '@wordpress/components';
import apiFetch from '@wordpress/api-fetch';
import {
	getBrowserRenderSupport,
	renderBrowserComposition,
} from '../lib/browser-renderer';
import type { OutputRenderStatus, SavedCompositionOutput } from '../types';

interface Props {
	outputId?: number;
	dirty: boolean;
	disabled: boolean;
	onRenderingChange: ( rendering: boolean ) => void;
}

interface BrowserVideo {
	blob: Blob;
	compositionHash: string;
	filename: string;
}

type BrowserPhase = 'idle' | 'checking' | 'rendering' | 'uploading';

function isActive( status?: OutputRenderStatus[ 'status' ] ): boolean {
	return (
		status === 'queued' || status === 'rendering' || status === 'uploading'
	);
}

function errorMessage( error: unknown ): string {
	return (
		( error as { message?: string } )?.message ||
		'The render request failed.'
	);
}

export default function CompositionExport( {
	outputId,
	dirty,
	disabled,
	onRenderingChange,
}: Props ) {
	const [ job, setJob ] = useState< OutputRenderStatus | null >( null );
	const [ checking, setChecking ] = useState( Boolean( outputId ) );
	const [ starting, setStarting ] = useState( false );
	const [ statusError, setStatusError ] = useState( '' );
	const [ startError, setStartError ] = useState( '' );
	const [ checkRevision, setCheckRevision ] = useState( 0 );
	const [ browserPhase, setBrowserPhase ] =
		useState< BrowserPhase >( 'idle' );
	const [ browserProgress, setBrowserProgress ] = useState( 0 );
	const [ browserError, setBrowserError ] = useState( '' );
	const [ cancelling, setCancelling ] = useState( false );
	const [ browserVideo, setBrowserVideo ] = useState< BrowserVideo | null >(
		null
	);
	const [ browserUrl, setBrowserUrl ] = useState( '' );
	const startController = useRef< AbortController | null >( null );
	const browserController = useRef< AbortController | null >( null );
	const browserBusy = browserPhase !== 'idle';
	const rendering = starting || isActive( job?.status ) || browserBusy;

	useEffect( () => {
		setJob( null );
		setStarting( false );
		setStartError( '' );
		setStatusError( '' );
		setBrowserPhase( 'idle' );
		setBrowserVideo( null );
		setBrowserError( '' );
		return () => {
			startController.current?.abort();
			browserController.current?.abort();
			browserController.current = null;
		};
	}, [ outputId ] );

	useEffect( () => {
		onRenderingChange( rendering );
	}, [ rendering, onRenderingChange ] );

	useEffect( () => () => onRenderingChange( false ), [ onRenderingChange ] );

	useEffect( () => {
		if ( ! browserVideo ) {
			setBrowserUrl( '' );
			return;
		}
		const url = URL.createObjectURL( browserVideo.blob );
		setBrowserUrl( url );
		return () => URL.revokeObjectURL( url );
	}, [ browserVideo ] );

	useEffect( () => {
		if ( ! browserBusy && ! browserVideo ) {
			return;
		}
		const warn = ( event: BeforeUnloadEvent ) => {
			event.preventDefault();
			event.returnValue = '';
		};
		window.addEventListener( 'beforeunload', warn );
		return () => window.removeEventListener( 'beforeunload', warn );
	}, [ browserBusy, browserVideo ] );

	useEffect( () => {
		if ( ! outputId ) {
			setChecking( false );
			return;
		}
		let active = true;
		let timer: ReturnType< typeof setTimeout >;
		const controller = new AbortController();
		const check = async () => {
			setChecking( true );
			try {
				const result = await apiFetch< OutputRenderStatus >( {
					path: `/clipisode/v1/outputs/${ outputId }/render`,
					signal: controller.signal,
				} );
				if ( ! active ) {
					return;
				}
				setJob( result );
				setStatusError( '' );
				if ( isActive( result.status ) || result.status === 'done' ) {
					setStartError( '' );
				}
				if ( isActive( result.status ) ) {
					timer = setTimeout( check, 2000 );
				}
			} catch ( error ) {
				if ( active ) {
					setStatusError( errorMessage( error ) );
				}
			} finally {
				if ( active ) {
					setChecking( false );
				}
			}
		};
		check();
		return () => {
			active = false;
			clearTimeout( timer );
			controller.abort();
		};
	}, [ outputId, checkRevision ] );

	const cannotStart =
		! outputId ||
		dirty ||
		disabled ||
		rendering ||
		checking ||
		Boolean( statusError ) ||
		Boolean( browserVideo );

	const startService = async () => {
		if ( cannotStart || ! job?.external_available ) {
			return;
		}
		const controller = new AbortController();
		startController.current = controller;
		setStarting( true );
		setStartError( '' );
		try {
			const result = await apiFetch< OutputRenderStatus >( {
				path: `/clipisode/v1/outputs/${ outputId }/render`,
				method: 'POST',
				signal: controller.signal,
			} );
			if ( ! controller.signal.aborted ) {
				setJob( result );
			}
		} catch ( error ) {
			if ( ! controller.signal.aborted ) {
				setStartError( errorMessage( error ) );
			}
		} finally {
			if ( ! controller.signal.aborted ) {
				setStarting( false );
				setChecking( true );
				// Confirm server state even if the start response was lost.
				setCheckRevision( ( previous ) => previous + 1 );
			}
		}
	};

	const uploadBrowserVideo = async (
		video: BrowserVideo,
		controller: AbortController
	) => {
		setBrowserPhase( 'uploading' );
		const body = new FormData();
		body.append( 'video', video.blob, video.filename );
		body.append( 'composition_hash', video.compositionHash );
		try {
			const result = await apiFetch< { id: number; url: string } >( {
				path: `/clipisode/v1/outputs/${ outputId }/browser-render`,
				method: 'POST',
				body,
				signal: controller.signal,
			} );
			if ( controller.signal.aborted ) {
				return;
			}
			setBrowserVideo( null );
			setJob( {
				id: null,
				status: 'done',
				progress: 1,
				error: null,
				url: result.url,
				external_available: Boolean( job?.external_available ),
			} );
			setCheckRevision( ( previous ) => previous + 1 );
		} catch ( error ) {
			if ( ! controller.signal.aborted ) {
				setBrowserError(
					`The MP4 is ready, but saving it to WordPress failed: ${ errorMessage(
						error
					) } Download it below or retry the upload.`
				);
			}
		}
	};

	const startBrowser = async () => {
		if ( cannotStart ) {
			return;
		}
		const controller = new AbortController();
		browserController.current = controller;
		setBrowserPhase( 'checking' );
		setBrowserProgress( 0 );
		setBrowserError( '' );
		setCancelling( false );
		try {
			const saved = await apiFetch< SavedCompositionOutput >( {
				path: `/clipisode/v1/outputs/${ outputId }`,
				signal: controller.signal,
			} );
			if ( controller.signal.aborted ) {
				return;
			}
			if ( ! saved.composition_hash ) {
				throw new Error(
					'Save this preview before rendering it in the browser.'
				);
			}
			const support = await getBrowserRenderSupport( saved.composition );
			if ( controller.signal.aborted ) {
				return;
			}
			if ( ! support.supported ) {
				throw new Error(
					support.message ||
						'This browser cannot export this preview as an MP4.'
				);
			}
			setBrowserPhase( 'rendering' );
			const blob = await renderBrowserComposition( saved.composition, {
				signal: controller.signal,
				onProgress: ( progress ) => {
					if ( ! controller.signal.aborted ) {
						setBrowserProgress( progress );
					}
				},
			} );
			if ( controller.signal.aborted ) {
				return;
			}
			const video = {
				blob,
				compositionHash: saved.composition_hash,
				filename: `${ saved.slug }.mp4`,
			};
			setBrowserVideo( video );
			await uploadBrowserVideo( video, controller );
		} catch ( error ) {
			if ( ! controller.signal.aborted ) {
				setBrowserError( errorMessage( error ) );
			}
		} finally {
			if ( browserController.current === controller ) {
				setBrowserPhase( 'idle' );
				setCancelling( false );
				browserController.current = null;
			}
		}
	};

	const retryUpload = async () => {
		if (
			! browserVideo ||
			rendering ||
			disabled ||
			checking ||
			statusError
		) {
			return;
		}
		const controller = new AbortController();
		browserController.current = controller;
		setBrowserError( '' );
		await uploadBrowserVideo( browserVideo, controller );
		if ( browserController.current === controller ) {
			setBrowserPhase( 'idle' );
			browserController.current = null;
		}
	};

	const error =
		statusError ||
		startError ||
		( job?.status === 'error' ? job.error : '' );
	const downloadUrl =
		job && ( job.status === 'done' || job.status === 'idle' )
			? job.url
			: null;
	const progress = Math.round( ( job?.progress || 0 ) * 100 );
	const progressLabel = {
		queued: 'Waiting to render',
		rendering: 'Rendering MP4',
		uploading: 'Uploading MP4',
	}[ job?.status || '' ];
	const browserProgressLabel = {
		idle: '',
		checking: 'Checking browser export support…',
		rendering: `Rendering in browser · ${ Math.round(
			browserProgress * 100
		) }%`,
		uploading: 'Saving MP4 to WordPress…',
	}[ browserPhase ];

	return (
		<section className="clipisode-section" aria-label="MP4 export">
			<h2>MP4 export</h2>
			<p>
				Render the saved preview as an MP4. You can keep editing while
				it renders; save those changes after the render finishes.
			</p>
			<Button
				variant="primary"
				onClick={ startBrowser }
				disabled={ cannotStart }
			>
				Render in browser
			</Button>
			{ job?.external_available && (
				<Button
					variant="secondary"
					onClick={ startService }
					isBusy={ starting }
					disabled={ cannotStart }
				>
					{ starting
						? 'Starting service render…'
						: 'Render with service' }
				</Button>
			) }
			{ ( ! outputId || dirty ) && (
				<p>Save your preview changes before rendering.</p>
			) }
			{ checking && ! job && <Spinner /> }
			{ browserBusy && (
				<div role="status">
					<p>{ browserProgressLabel }</p>
					<p>Keep this tab open until the MP4 has been saved.</p>
					{ browserPhase === 'rendering' && (
						<progress
							aria-label="Browser render progress"
							value={ browserProgress }
							max={ 1 }
						/>
					) }
					{ browserPhase !== 'uploading' && (
						<Button
							variant="secondary"
							disabled={ cancelling }
							onClick={ () => {
								setCancelling( true );
								browserController.current?.abort();
							} }
						>
							{ cancelling ? 'Cancelling…' : 'Cancel render' }
						</Button>
					) }
				</div>
			) }
			{ isActive( job?.status ) && (
				<div role="status">
					<p>
						{ progressLabel }
						{ ` · ${ progress }%` }
					</p>
					<progress
						aria-label="Service render progress"
						value={ job!.progress }
						max={ 1 }
					/>
				</div>
			) }
			{ error && (
				<Notice status="error" isDismissible={ false }>
					<p>{ error }</p>
					{ statusError && (
						<Button
							variant="secondary"
							disabled={ checking }
							onClick={ () =>
								setCheckRevision( ( previous ) => previous + 1 )
							}
						>
							Retry status
						</Button>
					) }
				</Notice>
			) }
			{ browserError && (
				<Notice status="error" isDismissible={ false }>
					<p>{ browserError }</p>
				</Notice>
			) }
			{ browserVideo && ! browserBusy && (
				<p>
					<a
						className="components-button is-secondary"
						href={ browserUrl }
						download={ browserVideo.filename }
					>
						Download MP4
					</a>
					<Button
						variant="secondary"
						onClick={ retryUpload }
						disabled={
							rendering ||
							disabled ||
							checking ||
							Boolean( statusError )
						}
					>
						Retry upload
					</Button>
					<Button
						variant="tertiary"
						onClick={ () => {
							setBrowserVideo( null );
							setBrowserError( '' );
						} }
					>
						Discard browser export
					</Button>
				</p>
			) }
			{ downloadUrl && ! browserVideo && (
				<p role="status">
					<a
						className="components-button is-secondary"
						href={ downloadUrl }
						download
					>
						Download MP4
					</a>
				</p>
			) }
		</section>
	);
}
