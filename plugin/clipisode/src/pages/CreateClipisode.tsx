import { useState, useEffect, useCallback, useRef } from '@wordpress/element';
import { Button, SelectControl, Spinner } from '@wordpress/components';
import apiFetch from '@wordpress/api-fetch';
import TrimModal from '../components/TrimModal';
import { themeRegistry } from '../themes';
import { WS_URL, generateJobId, getThemeAssets, getAvailableThemes } from '../lib/transcoder';
import type { Topic, Output, MediaItem } from '../types';

interface CreateClipisodeProps {
	topicId?: number;
	mediaIds: number[];
	navigate: ( path: string | number ) => void;
}

interface ClipItem {
	id: string;
	mediaId: number;
	role: 'intro' | 'reply';
	name: string;
	url: string;
	filename: string;
	duration: number;
	trimStart: number;
	trimEnd: number;
	included: boolean;
}

type RenderState = 'idle' | 'connecting' | 'processing' | 'done' | 'error';

function formatTime( seconds: number ): string {
	const m = Math.floor( seconds / 60 );
	const s = seconds % 60;
	return `${ m }:${ s.toFixed( 1 ).padStart( 4, '0' ) }`;
}

function getDuration( url: string ): Promise< number > {
	return new Promise( ( resolve, reject ) => {
		const video = document.createElement( 'video' );
		video.preload = 'metadata';
		video.onloadedmetadata = () => resolve( video.duration );
		video.onerror = reject;
		video.src = url;
	} );
}

export default function CreateClipisode( { topicId, mediaIds, navigate }: CreateClipisodeProps ) {
	const [ topic, setTopic ] = useState< Topic | null >( null );
	const [ clips, setClips ] = useState< ClipItem[] >( [] );
	const [ loading, setLoading ] = useState( true );
	const [ trimmingClip, setTrimmingClip ] = useState< ClipItem | null >( null );
	const availableThemes = getAvailableThemes();
	const [ selectedTheme, setSelectedTheme ] = useState( availableThemes[ 0 ]?.id || 'standard' );
	const [ renderState, setRenderState ] = useState< RenderState >( 'idle' );
	const [ renderPhase, setRenderPhase ] = useState( '' );
	const [ renderMessage, setRenderMessage ] = useState( '' );
	const [ renderProgress, setRenderProgress ] = useState( 0 );
	const [ renderError, setRenderError ] = useState( '' );
	const [ renderOutputUrl, setRenderOutputUrl ] = useState< string | null >( null );
	const wsRef = useRef< WebSocket | null >( null );
	const jobIdRef = useRef< string | null >( null );
	const dragItem = useRef< number | null >( null );
	const dragOver = useRef< number | null >( null );

	useEffect( () => {
		const warn = ( e: BeforeUnloadEvent ) => {
			if ( renderState === 'connecting' || renderState === 'processing' ) {
				e.preventDefault();
			}
		};
		window.addEventListener( 'beforeunload', warn );
		return () => window.removeEventListener( 'beforeunload', warn );
	}, [ renderState ] );

	const loadData = useCallback( async () => {
		const mediaItems = await apiFetch< MediaItem[] >( {
			path: `/clipisode/v1/media?ids=${ mediaIds.join( ',' ) }`,
		} );

		let t: Topic | null = null;
		if ( topicId ) {
			t = await apiFetch< Topic >( { path: `/clipisode/v1/topics/${ topicId }` } );
			setTopic( t );
		}

		const mediaById = new Map( mediaItems.map( ( m ) => [ Number( m.id ), m ] ) );

		const items: ClipItem[] = mediaIds
			.map( ( id ) => mediaById.get( id ) )
			.filter( ( m ): m is MediaItem => !! m && !! m.url )
			.map( ( m ) => ( {
				id: `media-${ m.id }`,
				mediaId: m.id,
				role: ( t?.intro_media_id === m.id ? 'intro' : 'reply' ) as 'intro' | 'reply',
				name: ( t?.intro_media_id === m.id && t?.hosted_by ) ? t.hosted_by : ( m.used_by?.label || m.label || m.path.split( '/' ).pop() || `media_${ m.id }` ),
				url: m.url!,
				filename: m.path.split( '/' ).pop() || `media_${ m.id }.mp4`,
				duration: 0,
				trimStart: 0,
				trimEnd: 0,
				included: true,
			} ) );

		const withDurations = await Promise.all(
			items.map( async ( item ) => {
				try {
					const dur = await getDuration( item.url );
					return { ...item, duration: dur, trimEnd: dur };
				} catch {
					return { ...item, duration: 0, trimEnd: 0 };
				}
			} )
		);

		setClips( withDurations );
		setLoading( false );
	}, [ topicId, mediaIds ] );

	useEffect( () => {
		loadData();
	}, [ loadData ] );

	const toggleIncluded = ( id: string ) => {
		setClips( ( prev ) => prev.map( ( c ) => ( c.id === id ? { ...c, included: ! c.included } : c ) ) );
	};

	const handleTrimDone = ( start: number, end: number ) => {
		if ( ! trimmingClip ) return;
		setClips( ( prev ) =>
			prev.map( ( c ) => ( c.id === trimmingClip.id ? { ...c, trimStart: start, trimEnd: end } : c ) )
		);
		setTrimmingClip( null );
	};

	const handleDragStart = ( index: number ) => {
		dragItem.current = index;
	};

	const handleDragEnter = ( index: number ) => {
		dragOver.current = index;
	};

	const handleDragEnd = () => {
		if ( dragItem.current === null || dragOver.current === null ) return;
		const from = dragItem.current;
		const to = dragOver.current;
		if ( from === to ) return;

		setClips( ( prev ) => {
			const next = [ ...prev ];
			const [ moved ] = next.splice( from, 1 );
			next.splice( to, 0, moved );
			return next;
		} );
		dragItem.current = null;
		dragOver.current = null;
	};

	const includedClips = clips.filter( ( c ) => c.included );

	const startRendering = async () => {
		if ( includedClips.length === 0 ) return;

		setRenderState( 'connecting' );
		setRenderPhase( '' );
		setRenderMessage( '' );
		setRenderProgress( 0 );
		setRenderError( '' );
		setRenderOutputUrl( null );

		let output: Output;
		try {
			output = await apiFetch< Output >( {
				path: '/clipisode/v1/outputs',
				method: 'POST',
				data: { ...( topicId ? { topic_id: topicId } : {} ), name: topic?.title || 'Clipisode' },
			} );
		} catch {
			setRenderState( 'error' );
			setRenderError( 'Failed to create output record.' );
			return;
		}

		const contents = includedClips.map( ( clip, i ) => ( {
			media_id: clip.mediaId,
			position: i,
			role: clip.role,
			trim_start: clip.trimStart,
			trim_end: clip.trimEnd,
			duration: clip.duration,
		} ) );

		try {
			await apiFetch( {
				path: `/clipisode/v1/outputs/${ output.id }/contents`,
				method: 'POST',
				data: { contents },
			} );
		} catch {
			setRenderState( 'error' );
			setRenderError( 'Failed to save clip contents.' );
			return;
		}

		const restRoot = window.clipisodeAdmin?.rest_root || `${ window.location.origin }/wp-json/`;
		const callbackUrl = `${ restRoot }clipisode/v1/outputs/${ output.id }/upload?token=${ output.upload_token }`;

		const jobId = generateJobId();
		jobIdRef.current = jobId;

		const videos: Record< string, object > = {};
		includedClips.forEach( ( clip, i ) => {
			videos[ `clip_${ i }` ] = {
				url: clip.url,
				filename: clip.filename,
				name: clip.name,
				trim_start: clip.trimStart,
				trim_end: clip.trimEnd,
				duration: clip.duration,
			};
		} );

		const getElements = themeRegistry[ selectedTheme ];
		const videoData = {
			id: String( topicId || 0 ),
			title: topic?.title || 'Clipisode',
			clips: includedClips.map( ( clip, i ) => ( {
				id: `clip_${ i }`,
				duration: clip.trimEnd - clip.trimStart,
				displayName: clip.name,
			} ) ),
		};

		const payload = {
			type: 'start_job',
			job_id: jobId,
			callback_url: callbackUrl,
			videos,
			assets: getThemeAssets( selectedTheme ),
			elements: getElements( videoData ),
		};

		const ws = new WebSocket( WS_URL );
		wsRef.current = ws;

		ws.onopen = () => {
			ws.send( JSON.stringify( { type: 'hello', client: 'clipisode-admin', version: 1 } ) );
		};

		ws.onmessage = ( event ) => {
			const msg = JSON.parse( event.data );
			switch ( msg.type ) {
				case 'hello_ack':
					setRenderState( 'processing' );
					setRenderPhase( 'Starting' );
					setRenderMessage( 'Sending to render service...' );
					ws.send( JSON.stringify( payload ) );
					break;

				case 'job_status': {
					const phaseLabels: Record< string, string > = {
						downloading: 'Downloading',
						rendering: 'Rendering',
						uploading: 'Uploading',
					};
					setRenderPhase( phaseLabels[ msg.phase ] || msg.phase );
					setRenderMessage( msg.message || '' );
					if ( msg.total > 0 ) {
						setRenderProgress( ( msg.current / msg.total ) * 100 );
					}
					break;
				}

				case 'job_done':
					setRenderOutputUrl( msg.output_url || null );
					setRenderState( 'done' );
					ws.close();
					wsRef.current = null;
					jobIdRef.current = null;
					break;

				case 'job_error':
					setRenderError( msg.message || 'Rendering failed.' );
					setRenderState( 'error' );
					ws.close();
					wsRef.current = null;
					jobIdRef.current = null;
					break;

				case 'job_cancelled':
					setRenderState( 'idle' );
					ws.close();
					wsRef.current = null;
					jobIdRef.current = null;
					break;

				case 'connection_rejected':
					setRenderError( msg.reason || 'Connection rejected.' );
					setRenderState( 'error' );
					break;
			}
		};

		ws.onclose = () => {
			if ( renderState === 'connecting' ) {
				setRenderError( 'Could not connect to render service.' );
				setRenderState( 'error' );
			}
		};

		ws.onerror = () => {
			ws.close();
		};
	};

	const cancelRendering = () => {
		const ws = wsRef.current;
		if ( ws && ws.readyState === WebSocket.OPEN ) {
			ws.send( JSON.stringify( { type: 'cancel_job', job_id: jobIdRef.current } ) );
		}
		wsRef.current?.close();
		wsRef.current = null;
		jobIdRef.current = null;
		setRenderState( 'idle' );
	};

	if ( loading ) {
		return (
			<div className="clipisode-spinner-wrap">
				<Spinner />
			</div>
		);
	}

	const isTrimmed = ( clip: ClipItem ) => clip.trimStart > 0 || clip.trimEnd < clip.duration;
	const totalDuration = includedClips.reduce( ( sum, c ) => sum + ( c.trimEnd - c.trimStart ), 0 );

	return (
		<>
			<div className="clipisode-page-header">
				<Button variant="tertiary" onClick={ () => navigate( topicId ? String( topicId ) : 'media' ) }>
					&larr; { topicId ? 'Back to Topic' : 'Back to Media' }
				</Button>
				<h1>Create Clipisode</h1>
				{ topic && <p style={ { color: '#646970', margin: 0 } }>{ topic.title }</p> }
			</div>

			{ renderState === 'idle' && (
				<>
					<div className="clipisode-section">
						<h2>Clips ({ includedClips.length }) &middot; { formatTime( totalDuration ) }</h2>

						<table className="clipisode-table">
							<thead>
								<tr>
									<th style={ { width: 30 } }></th>
									<th style={ { width: 30 } }></th>
									<th>Name</th>
									<th>Role</th>
									<th>Duration</th>
									<th>Trim</th>
									<th></th>
								</tr>
							</thead>
							<tbody>
								{ clips.map( ( clip, index ) => (
									<tr
										key={ clip.id }
										draggable
										onDragStart={ () => handleDragStart( index ) }
										onDragEnter={ () => handleDragEnter( index ) }
										onDragEnd={ handleDragEnd }
										onDragOver={ ( e ) => e.preventDefault() }
										style={ { opacity: clip.included ? 1 : 0.4 } }
									>
										<td>
											<input
												type="checkbox"
												checked={ clip.included }
												onChange={ () => toggleIncluded( clip.id ) }
											/>
										</td>
										<td style={ { cursor: 'grab', userSelect: 'none' } }>&#x2630;</td>
										<td>{ clip.name }</td>
										<td>
											<span className={ `clipisode-status-badge ${ clip.role === 'intro' ? 'approved' : '' }` }>
												{ clip.role }
											</span>
										</td>
										<td>{ clip.duration > 0 ? formatTime( clip.duration ) : '—' }</td>
										<td>
											{ isTrimmed( clip )
												? `${ formatTime( clip.trimStart ) } – ${ formatTime( clip.trimEnd ) }`
												: 'Full'
											}
										</td>
										<td>
											<Button
												variant="tertiary"
												size="compact"
												disabled={ clip.duration <= 0 }
												onClick={ () => setTrimmingClip( clip ) }
											>
												Trim
											</Button>
										</td>
									</tr>
								) ) }
							</tbody>
						</table>
					</div>

					<div style={ { marginTop: 16, display: 'flex', alignItems: 'flex-end', gap: 16 } }>
						<SelectControl
							label="Theme"
							value={ selectedTheme }
							options={ availableThemes.map( ( t ) => ( { value: t.id, label: t.label } ) ) }
							onChange={ setSelectedTheme }
							__nextHasNoMarginBottom
						/>
						<Button
							variant="primary"
							onClick={ startRendering }
							disabled={ includedClips.length === 0 }
						>
							Create Clipisode
						</Button>
					</div>
				</>
			) }

			{ ( renderState === 'connecting' || renderState === 'processing' ) && (
				<div className="clipisode-output-status">
					<Spinner />
					<div className="clipisode-output-phase">{ renderPhase || 'Connecting...' }</div>
					{ renderMessage && <div className="clipisode-output-message">{ renderMessage }</div> }
					{ renderProgress > 0 && (
						<div className="clipisode-output-progress">
							<div className="clipisode-output-progress-track">
								<div className="clipisode-output-progress-bar" style={ { width: `${ renderProgress }%` } } />
							</div>
							<span className="clipisode-output-progress-label">{ Math.round( renderProgress ) }%</span>
						</div>
					) }
					<Button variant="tertiary" isDestructive onClick={ cancelRendering }>
						Cancel
					</Button>
				</div>
			) }

			{ renderState === 'error' && (
				<div className="clipisode-output-status">
					<div className="clipisode-output-error">{ renderError }</div>
					<Button variant="secondary" onClick={ () => setRenderState( 'idle' ) }>
						Try Again
					</Button>
				</div>
			) }

			{ renderState === 'done' && (
				<div className="clipisode-output-status">
					<div className="clipisode-output-phase">Complete</div>
					{ renderOutputUrl && (
						<video src={ renderOutputUrl } controls playsInline style={ { maxWidth: '50%' } } />
					) }
					<div style={ { display: 'flex', gap: 8, marginTop: 12 } }>
						<Button variant="secondary" onClick={ () => navigate( topicId ? String( topicId ) : 'media' ) }>
							{ topicId ? 'Back to Topic' : 'Back to Media' }
						</Button>
						<Button variant="primary" onClick={ () => setRenderState( 'idle' ) }>
							Create Another
						</Button>
					</div>
				</div>
			) }

			{ trimmingClip && (
				<TrimModal
					url={ trimmingClip.url }
					name={ trimmingClip.name }
					duration={ trimmingClip.duration }
					initialStart={ trimmingClip.trimStart }
					initialEnd={ trimmingClip.trimEnd }
					onDone={ handleTrimDone }
					onClose={ () => setTrimmingClip( null ) }
				/>
			) }
		</>
	);
}
