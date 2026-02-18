import { useState, useEffect, useCallback, useRef } from '@wordpress/element';
import { Button, Spinner } from '@wordpress/components';
import apiFetch from '@wordpress/api-fetch';
import ClipModal from '../components/ClipModal';
import type { Topic, InvitationLink, Clip, Output } from '../types';

interface TopicDetailProps {
	id: string;
	navigate: ( path: string | number ) => void;
}

export default function TopicDetail( { id, navigate }: TopicDetailProps ) {
	const [ topic, setTopic ] = useState< Topic | null >( null );
	const [ links, setLinks ] = useState< InvitationLink[] >( [] );
	const [ clips, setClips ] = useState< Clip[] >( [] );
	const [ loading, setLoading ] = useState< boolean >( true );
	const [ deleting, setDeleting ] = useState< boolean >( false );
	const [ copiedId, setCopiedId ] = useState< number | null >( null );
	const [ selectedClip, setSelectedClip ] = useState< Clip | null >( null );

	type MuxState = 'idle' | 'connecting' | 'processing' | 'done' | 'error';
	const [ muxState, setMuxState ] = useState< MuxState >( 'idle' );
	const [ muxPhase, setMuxPhase ] = useState( '' );
	const [ muxMessage, setMuxMessage ] = useState( '' );
	const [ muxProgress, setMuxProgress ] = useState( 0 );
	const [ muxError, setMuxError ] = useState( '' );
	const [ muxOutputUrl, setMuxOutputUrl ] = useState< string | null >( null );
	const [ muxOutputId, setMuxOutputId ] = useState< number | null >( null );
	const wsRef = useRef< WebSocket | null >( null );

	const WS_URL = 'ws://127.0.0.1:63481';

	const generateJobId = () => {
		const now = new Date();
		const p = ( n: number, len = 2 ) => String( n ).padStart( len, '0' );
		return `${ now.getUTCFullYear() }${ p( now.getUTCMonth() + 1 ) }${ p( now.getUTCDate() ) }T${ p( now.getUTCHours() ) }${ p( now.getUTCMinutes() ) }${ p( now.getUTCSeconds() ) }Z`;
	};

	const startMuxing = async () => {
		if ( ! topic ) return;

		const approved = clips.filter( ( c ) => c.status === 'approved' );
		if ( approved.length === 0 ) return;

		setMuxState( 'connecting' );
		setMuxPhase( '' );
		setMuxMessage( '' );
		setMuxProgress( 0 );
		setMuxError( '' );
		setMuxOutputUrl( null );
		setMuxOutputId( null );

		let output: Output;
		try {
			output = await apiFetch< Output >( {
				path: '/clipisode/v1/outputs',
				method: 'POST',
				data: { topic_id: topic.id, name: 'All Clips' },
			} );
		} catch {
			setMuxState( 'error' );
			setMuxError( 'Failed to create output record.' );
			return;
		}

		setMuxOutputId( output.id );

		const segments = [
			...( topic.intro_video_url ? [ { url: topic.intro_video_url, order: 1 } ] : [] ),
			...approved.map( ( c, i ) => ( {
				url: c.video_url,
				order: ( topic.intro_video_url ? 2 : 1 ) + i,
			} ) ),
		];

		const restRoot = window.clipisodeAdmin?.rest_root || `${ window.location.origin }/wp-json/`;
		const callbackUrl = `${ restRoot }clipisode/v1/outputs/${ output.id }/upload?token=${ output.upload_token }`;

		const jobId = generateJobId();
		const topicSlug = topic.title.toLowerCase().replace( /[^a-z0-9]+/g, '-' ).replace( /^-|-$/g, '' );
		const payload = {
			type: 'start_job',
			job_id: jobId,
			output_name: `${ topicSlug }-all.mp4`,
			callback_url: callbackUrl,
			segments,
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
					setMuxState( 'processing' );
					setMuxPhase( 'Starting' );
					setMuxMessage( 'Initializing job...' );
					ws.send( JSON.stringify( payload ) );
					break;

				case 'job_status': {
					const phaseLabels: Record< string, string > = {
						downloading: 'Downloading',
						trimming: 'Trimming',
						joining: 'Joining',
						done: 'Complete',
					};
					setMuxPhase( phaseLabels[ msg.phase ] || msg.phase );
					setMuxMessage( msg.message || '' );
					if ( msg.total > 0 ) {
						setMuxProgress( ( msg.current / msg.total ) * 100 );
					}
					break;
				}

				case 'job_done':
					setMuxOutputUrl( msg.output_url || null );
					setMuxState( 'done' );
					load();
					break;

				case 'job_error':
					setMuxError( msg.message || 'Muxing failed.' );
					setMuxState( 'error' );
					break;

				case 'job_cancelled':
					setMuxState( 'idle' );
					break;

				case 'connection_rejected':
					setMuxError( msg.reason || 'Connection rejected.' );
					setMuxState( 'error' );
					break;
			}
		};

		ws.onclose = () => {
			if ( muxState === 'connecting' ) {
				setMuxError( 'Could not connect to muxing service.' );
				setMuxState( 'error' );
			}
		};

		ws.onerror = () => {
			ws.close();
		};
	};

	const deleteOutput = ( outputId: number, name: string ) => {
		if ( ! window.confirm( `Delete "${ name }"? The video will be permanently removed.` ) ) {
			return;
		}
		apiFetch( {
			path: `/clipisode/v1/outputs/${ outputId }`,
			method: 'DELETE',
		} ).then( () => {
			setTopic( ( prev ) => {
				if ( ! prev ) return prev;
				return {
					...prev,
					outputs: prev.outputs.filter( ( o ) => o.id !== outputId ),
				};
			} );
		} );
	};

	const cancelMuxing = () => {
		const ws = wsRef.current;
		if ( ws && ws.readyState === WebSocket.OPEN ) {
			ws.send( JSON.stringify( { type: 'cancel_job' } ) );
		}
		wsRef.current?.close();
		wsRef.current = null;
		setMuxState( 'idle' );
	};

	const load = useCallback( () => {
		Promise.all( [
			apiFetch< Topic >( { path: `/clipisode/v1/topics/${ id }` } ),
			apiFetch< InvitationLink[] >( { path: `/clipisode/v1/topics/${ id }/invitation-links` } ),
			apiFetch< Clip[] >( { path: `/clipisode/v1/clips?topic_id=${ id }` } ),
		] ).then( ( [ t, l, cl ] ) => {
			setTopic( t );
			setLinks( l );
			setClips( cl );
		} ).finally( () => setLoading( false ) );
	}, [ id ] );

	useEffect( () => {
		load();
	}, [ load ] );

	const createLink = () => {
		apiFetch< InvitationLink >( {
			path: `/clipisode/v1/topics/${ id }/invitation-links`,
			method: 'POST',
		} ).then( ( newLink ) => {
			setLinks( ( prev ) => [ newLink, ...prev ] );
		} );
	};

	const toggleLinkStatus = ( link: InvitationLink ) => {
		const newStatus = link.status === 'open' ? 'closed' : 'open';
		apiFetch< InvitationLink >( {
			path: `/clipisode/v1/invitation-links/${ link.id }`,
			method: 'PUT',
			data: { status: newStatus },
		} ).then( ( updated ) => {
			setLinks( ( prev ) => prev.map( ( l ) => ( l.id === updated.id ? updated : l ) ) );
		} );
	};

	const copyLinkUrl = ( link: InvitationLink ) => {
		const url = `${ window.location.origin }/c/${ link.slug }`;
		navigator.clipboard.writeText( url );
		setCopiedId( link.id );
		setTimeout( () => setCopiedId( ( prev ) => ( prev === link.id ? null : prev ) ), 3000 );
	};

	const deleteTopic = () => {
		if ( ! window.confirm( 'Delete this topic and all its clips? This cannot be undone.' ) ) {
			return;
		}
		setDeleting( true );
		apiFetch( { path: `/clipisode/v1/topics/${ id }`, method: 'DELETE' } )
			.then( () => navigate( '' ) )
			.finally( () => setDeleting( false ) );
	};

	const onClipUpdated = ( updatedClip: Clip ) => {
		setClips( ( prev ) =>
			prev.map( ( c ) => ( c.id === updatedClip.id ? updatedClip : c ) )
		);
		setSelectedClip( null );
	};

	if ( loading ) {
		return (
			<div className="clipisode-spinner-wrap">
				<Spinner />
			</div>
		);
	}

	if ( ! topic ) {
		return <div className="clipisode-empty">Topic not found.</div>;
	}

	return (
		<>
			<a className="clipisode-back-link" onClick={ () => navigate( '' ) }>
				← All Topics
			</a>

			<div className="clipisode-topic-summary">
				<div className="clipisode-topic-actions">
					<Button
						variant="primary"
						onClick={ () => navigate( `${ id }/edit` ) }
					>
						Edit
					</Button>
					{ Number( topic.clips_count ) === 0 && (
						<Button
							variant="tertiary"
							isDestructive
							onClick={ deleteTopic }
							isBusy={ deleting }
							disabled={ deleting }
						>
							Delete
						</Button>
					) }
				</div>

				<h1 className="clipisode-topic-title">{ topic.title }</h1>

				<div className="clipisode-topic-body">
					<div className="clipisode-topic-info">
						<div className="clipisode-stats">
							<div className="clipisode-stat">
								<span className="value">{ Number( topic.clicks ).toLocaleString() }</span>
								<span className="label">Clicks</span>
							</div>
							<div className="clipisode-stat">
								<span className="value">{ Number( topic.clips_count ).toLocaleString() }</span>
								<span className="label">Clips</span>
							</div>
						</div>

						<div className="clipisode-meta">
							<div><strong>Created</strong> { new Date( topic.created_at ).toLocaleString() }</div>
							<div><strong>Hosted By</strong> { topic.hosted_by || '—' }</div>
							<div>
								<strong>Theme</strong>
								{ topic.invitation_title ? (
									topic.invitation_edit_url ? (
										<a href={ topic.invitation_edit_url } target="_blank" rel="noreferrer">
											{ topic.invitation_title }
										</a>
									) : (
										topic.invitation_title
									)
								) : '—' }
							</div>
							<div>
								<strong>Terms</strong>
								{ topic.brand_terms_url ? (
									<a href={ topic.brand_terms_url } target="_blank" rel="noreferrer">
										{ topic.brand_terms_title }
									</a>
								) : (
									topic.brand_terms_title || '—'
								) }
								{ topic.custom_terms_title && (
									<>
										{ ', ' }
										{ topic.custom_terms_url ? (
											<a href={ topic.custom_terms_url } target="_blank" rel="noreferrer">
												{ topic.custom_terms_title }
											</a>
										) : (
											topic.custom_terms_title
										) }
									</>
								) }
							</div>
						</div>
					</div>

					{ topic.intro_video_url && (
						<div className="clipisode-topic-video">
							<video src={ topic.intro_video_url } controls playsInline />
						</div>
					) }
				</div>
			</div>

			<div className="clipisode-section">
				<h2>
					Invitation Links ({ links.length })
					<Button variant="secondary" size="compact" onClick={ createLink }>
						New
					</Button>
				</h2>

				{ links.length > 0 && (
					<table className="clipisode-table">
						<thead>
							<tr>
								<th>Link</th>
								<th>Status</th>
								<th>Clicks</th>
								<th>Clips</th>
								<th>Created</th>
								<th></th>
							</tr>
						</thead>
						<tbody>
							{ links.map( ( link ) => (
								<tr key={ link.id }>
									<td>{ link.slug }</td>
									<td>
										<span className={ `clipisode-status-badge ${ link.status }` }>
											{ link.status }
										</span>
									</td>
									<td>{ Number( link.clicks ).toLocaleString() }</td>
									<td>{ Number( link.clips_count ).toLocaleString() }</td>
									<td>{ new Date( link.created_at ).toLocaleString() }</td>
									<td className="clipisode-link-actions">
										<Button
											variant="tertiary"
											size="compact"
											onClick={ () => copyLinkUrl( link ) }
										>
											{ copiedId === link.id ? 'Copied' : 'Copy' }
										</Button>
										<Button
											variant="tertiary"
											size="compact"
											isDestructive={ link.status === 'open' }
											onClick={ () => toggleLinkStatus( link ) }
										>
											{ link.status === 'open' ? 'Close' : 'Open' }
										</Button>
									</td>
								</tr>
							) ) }
						</tbody>
					</table>
				) }
			</div>

			<div className="clipisode-section">
				<h2>
					Clips ({ clips.length })
					<Button
						variant="link"
						href={ `admin.php?page=clipisode-clips&topic_id=${ id }` }
					>
						See All
					</Button>
				</h2>

				{ clips.length > 0 && (
					<table className="clipisode-table">
						<thead>
							<tr>
								<th>Name</th>
								<th>Tag</th>
								<th>Status</th>
								<th>Transcript</th>
								<th>Created</th>
							</tr>
						</thead>
						<tbody>
							{ clips.slice( 0, 10 ).map( ( clip ) => (
								<tr
									key={ clip.id }
									className="clickable"
									onClick={ () => setSelectedClip( clip ) }
									style={ { cursor: 'pointer' } }
								>
									<td>{ clip.name }</td>
									<td>{ clip.tag || '—' }</td>
									<td>
										<span className={ `clipisode-status-badge ${ clip.status }` }>
											{ clip.status.replace( '_', ' ' ) }
										</span>
									</td>
									<td>
										<div className="clipisode-transcript-preview">
											{ clip.transcript || '—' }
										</div>
									</td>
									<td>{ new Date( clip.created_at ).toLocaleDateString() }</td>
								</tr>
							) ) }
						</tbody>
					</table>
				) }
			</div>

			<div className="clipisode-section clipisode-mux-section">
				<h2>Clipisode</h2>

				{ topic.outputs && topic.outputs.length > 0 && muxState === 'idle' && (
					<div className="clipisode-mux-outputs">
						{ topic.outputs.map( ( o ) => (
							<div key={ o.id } className="clipisode-mux-output">
								<div className="clipisode-mux-output-header">
									<strong>{ o.name }</strong>
									<span className="clipisode-mux-output-date">
										{ new Date( o.created_at ).toLocaleString() }
									</span>
								</div>
								{ o.url ? (
									<>
										<video src={ o.url } controls playsInline />
										<div className="clipisode-mux-output-actions">
											<a
												className="components-button is-secondary is-compact"
												href={ o.url }
												download={ `${ o.slug }.mp4` }
											>
												Download
											</a>
											<Button
												variant="tertiary"
												size="compact"
												isDestructive
												onClick={ () => deleteOutput( o.id, o.name ) }
											>
												Delete
											</Button>
										</div>
									</>
								) : (
									<div className="clipisode-mux-output-actions">
										<span className="clipisode-mux-pending">Processing...</span>
										<Button
											variant="tertiary"
											size="compact"
											isDestructive
											onClick={ () => deleteOutput( o.id, o.name ) }
										>
											Delete
										</Button>
									</div>
								) }
							</div>
						) ) }
					</div>
				) }

				{ muxState === 'idle' && (
					<Button
						variant="primary"
						onClick={ startMuxing }
						disabled={ clips.filter( ( c ) => c.status === 'approved' ).length === 0 }
					>
						Generate Clipisode
					</Button>
				) }

				{ muxState === 'connecting' && (
					<div className="clipisode-mux-status">
						<Spinner />
						<span>Connecting to muxing service...</span>
					</div>
				) }

				{ muxState === 'processing' && (
					<div className="clipisode-mux-status">
						<div className="clipisode-mux-phase">{ muxPhase }</div>
						<div className="clipisode-mux-message">{ muxMessage }</div>
						<div className="clipisode-progress-bar clipisode-mux-progress">
							<div
								className="clipisode-progress-fill"
								style={ { width: `${ muxProgress }%` } }
							/>
						</div>
						<Button variant="tertiary" isDestructive onClick={ cancelMuxing }>
							Cancel
						</Button>
					</div>
				) }

				{ muxState === 'done' && (
					<div className="clipisode-mux-status">
						<div className="clipisode-mux-phase">Complete</div>
						{ muxOutputUrl && (
							<>
								<video src={ muxOutputUrl } controls playsInline />
								<div className="clipisode-mux-output-actions">
									<a
										className="components-button is-secondary is-compact"
										href={ muxOutputUrl }
										download
									>
										Download
									</a>
									{ muxOutputId && (
										<Button
											variant="tertiary"
											size="compact"
											isDestructive
											onClick={ () => {
												deleteOutput( muxOutputId, 'All Clips' );
												setMuxState( 'idle' );
											} }
										>
											Delete
										</Button>
									) }
								</div>
							</>
						) }
						{ ! muxOutputUrl && (
							<Button variant="secondary" onClick={ () => setMuxState( 'idle' ) }>
								OK
							</Button>
						) }
					</div>
				) }

				{ muxState === 'error' && (
					<div className="clipisode-mux-status clipisode-mux-error">
						<div className="clipisode-mux-phase">Error</div>
						<div className="clipisode-mux-message">{ muxError }</div>
						<Button variant="secondary" onClick={ () => setMuxState( 'idle' ) }>
							Retry
						</Button>
					</div>
				) }
			</div>

			{ selectedClip && (
				<ClipModal
					clip={ selectedClip }
					onClose={ () => setSelectedClip( null ) }
					onUpdated={ onClipUpdated }
				/>
			) }
		</>
	);
}
