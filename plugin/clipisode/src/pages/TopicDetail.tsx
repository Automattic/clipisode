import { useState, useEffect, useCallback, useRef } from '@wordpress/element';
import { Button, Spinner } from '@wordpress/components';
import apiFetch from '@wordpress/api-fetch';
import ReplyModal from '../components/ReplyModal';
import { getElements } from '../standard-theme';
import type { Topic, InvitationLink, Reply, Output } from '../types';

interface TopicDetailProps {
	id: string;
	navigate: ( path: string | number ) => void;
}

export default function TopicDetail( { id, navigate }: TopicDetailProps ) {
	const [ topic, setTopic ] = useState< Topic | null >( null );
	const [ links, setLinks ] = useState< InvitationLink[] >( [] );
	const [ replies, setReplies ] = useState< Reply[] >( [] );
	const [ loading, setLoading ] = useState< boolean >( true );
	const [ deleting, setDeleting ] = useState< boolean >( false );
	const [ copiedId, setCopiedId ] = useState< number | null >( null );
	const [ editingSlug, setEditingSlug ] = useState< Record< number, string > >( {} );
	const [ slugError, setSlugError ] = useState< Record< number, string > >( {} );
	const [ savingSlug, setSavingSlug ] = useState< Record< number, boolean > >( {} );
	const [ selectedReply, setSelectedReply ] = useState< Reply | null >( null );

	type RenderState = 'idle' | 'connecting' | 'processing' | 'done' | 'error';
	const [ renderState, setRenderState ] = useState< RenderState >( 'idle' );
	const [ renderPhase, setRenderPhase ] = useState( '' );
	const [ renderMessage, setRenderMessage ] = useState( '' );
	const [ renderProgress, setRenderProgress ] = useState( 0 );
	const [ renderError, setRenderError ] = useState( '' );
	const [ renderOutputUrl, setRenderOutputUrl ] = useState< string | null >( null );
	const [ renderOutputId, setRenderOutputId ] = useState< number | null >( null );
	const wsRef = useRef< WebSocket | null >( null );

	const WS_URL = 'ws://127.0.0.1:63481';

	const jobIdRef = useRef< string | null >( null );

	const generateJobId = () => {
		const now = new Date();
		const p = ( n: number, len = 2 ) => String( n ).padStart( len, '0' );
		return `${ now.getUTCFullYear() }${ p( now.getUTCMonth() + 1 ) }${ p( now.getUTCDate() ) }T${ p( now.getUTCHours() ) }${ p( now.getUTCMinutes() ) }${ p( now.getUTCSeconds() ) }Z`;
	};

	const startRendering = async () => {
		if ( ! topic ) return;

		const approved = replies.filter( ( r ) => r.status === 'approved' );
		if ( approved.length === 0 ) return;

		setRenderState( 'connecting' );
		setRenderPhase( '' );
		setRenderMessage( '' );
		setRenderProgress( 0 );
		setRenderError( '' );
		setRenderOutputUrl( null );
		setRenderOutputId( null );

		let output: Output;
		try {
			output = await apiFetch< Output >( {
				path: '/clipisode/v1/outputs',
				method: 'POST',
				data: { topic_id: topic.id, name: 'All Replies' },
			} );
		} catch {
			setRenderState( 'error' );
			setRenderError( 'Failed to create output record.' );
			return;
		}

		setRenderOutputId( output.id );

		const videos: Record< string, { url: string; filename: string; name: string } > = {};

		if ( topic.intro_video_url ) {
			videos.intro = {
				url: topic.intro_video_url,
				filename: topic.intro_video_filename || 'intro.mp4',
				name: topic.title,
			};
		}

		approved.forEach( ( reply, i ) => {
			const key = approved.length === 1 ? 'main' : `main_${ i + 1 }`;
			videos[ key ] = {
				url: reply.video_url,
				filename: reply.video_filename || `reply_${ i + 1 }.mp4`,
				name: reply.name,
			};
		} );

		const restRoot = window.clipisodeAdmin?.rest_root || `${ window.location.origin }/wp-json/`;
		const callbackUrl = `${ restRoot }clipisode/v1/outputs/${ output.id }/upload?token=${ output.upload_token }`;

		const jobId = generateJobId();
		jobIdRef.current = jobId;

		const payload = {
			type: 'start_job',
			job_id: jobId,
			callback_url: callbackUrl,
			videos,
			elements: getElements({
				id: topic.id.toString(),
				title: topic.title,
				clips: Object.entries(videos).map(([key, vid], i) => ({
					id: key,
					duration: 2, // TODO: use correct duration if available
					displayName: vid.name || key,
				}))
			}),
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
						done: 'Complete',
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
					load();
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

	const load = useCallback( () => {
		Promise.all( [
			apiFetch< Topic >( { path: `/clipisode/v1/topics/${ id }` } ),
			apiFetch< InvitationLink[] >( { path: `/clipisode/v1/topics/${ id }/invitation-links` } ),
			apiFetch< Reply[] >( { path: `/clipisode/v1/replies?topic_id=${ id }` } ),
		] ).then( ( [ t, l, cl ] ) => {
			setTopic( t );
			setLinks( l );
			setReplies( cl );
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

	const saveSlug = async ( link: InvitationLink ) => {
		const newSlug = editingSlug[ link.id ];
		if ( ! newSlug || newSlug === link.slug ) {
			setEditingSlug( ( prev ) => { const n = { ...prev }; delete n[ link.id ]; return n; } );
			return;
		}
		setSavingSlug( ( prev ) => ( { ...prev, [ link.id ]: true } ) );
		setSlugError( ( prev ) => { const n = { ...prev }; delete n[ link.id ]; return n; } );
		try {
			const updated = await apiFetch< InvitationLink >( {
				path: `/clipisode/v1/invitation-links/${ link.id }`,
				method: 'PUT',
				data: { slug: newSlug },
			} );
			setLinks( ( prev ) => prev.map( ( l ) => ( l.id === updated.id ? updated : l ) ) );
			setEditingSlug( ( prev ) => { const n = { ...prev }; delete n[ link.id ]; return n; } );
		} catch ( err: unknown ) {
			const message = err instanceof Error ? err.message
				: ( err as { message?: string } )?.message || 'Slug update failed.';
			setSlugError( ( prev ) => ( { ...prev, [ link.id ]: message } ) );
		} finally {
			setSavingSlug( ( prev ) => ( { ...prev, [ link.id ]: false } ) );
		}
	};

	const copyLinkUrl = ( link: InvitationLink ) => {
		const url = `${ window.location.origin }/invitation/${ link.slug }`;
		navigator.clipboard.writeText( url );
		setCopiedId( link.id );
		setTimeout( () => setCopiedId( ( prev ) => ( prev === link.id ? null : prev ) ), 3000 );
	};

	const deleteTopic = () => {
		if ( ! window.confirm( 'Delete this topic and all its replies? This cannot be undone.' ) ) {
			return;
		}
		setDeleting( true );
		apiFetch( { path: `/clipisode/v1/topics/${ id }`, method: 'DELETE' } )
			.then( () => navigate( '' ) )
			.finally( () => setDeleting( false ) );
	};

	const onReplyUpdated = ( updatedReply: Reply ) => {
		setReplies( ( prev ) =>
			prev.map( ( r ) => ( r.id === updatedReply.id ? updatedReply : r ) )
		);
		setSelectedReply( null );
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
					{ Number( topic.replies_count ) === 0 && (
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
								<span className="value">{ Number( topic.replies_count ).toLocaleString() }</span>
								<span className="label">Replies</span>
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
								<th>Replies</th>
								<th>Created</th>
								<th></th>
							</tr>
						</thead>
						<tbody>
							{ links.map( ( link ) => (
								<tr key={ link.id }>
									<td>
										{ editingSlug[ link.id ] !== undefined ? (
											<span className="clipisode-slug-edit">
												<input
													type="text"
													value={ editingSlug[ link.id ] }
													maxLength={ 20 }
													onChange={ ( e ) => setEditingSlug( ( prev ) => ( { ...prev, [ link.id ]: e.target.value } ) ) }
													onKeyDown={ ( e ) => {
														if ( e.key === 'Enter' ) saveSlug( link );
														if ( e.key === 'Escape' ) setEditingSlug( ( prev ) => { const n = { ...prev }; delete n[ link.id ]; return n; } );
													} }
													disabled={ savingSlug[ link.id ] }
												/>
												<Button variant="tertiary" size="compact" onClick={ () => saveSlug( link ) } disabled={ savingSlug[ link.id ] }>
													{ savingSlug[ link.id ] ? '…' : 'Save' }
												</Button>
												<Button variant="tertiary" size="compact" onClick={ () => {
													setEditingSlug( ( prev ) => { const n = { ...prev }; delete n[ link.id ]; return n; } );
													setSlugError( ( prev ) => { const n = { ...prev }; delete n[ link.id ]; return n; } );
												} }>
													Cancel
												</Button>
												{ slugError[ link.id ] && (
													<span className="clipisode-slug-error">{ slugError[ link.id ] }</span>
												) }
											</span>
										) : (
											<button
												type="button"
												className="clipisode-slug-btn"
												onClick={ () => setEditingSlug( ( prev ) => ( { ...prev, [ link.id ]: link.slug } ) ) }
												title="Click to edit"
											>
												{ link.slug }
											</button>
										) }
									</td>
									<td>
										<span className={ `clipisode-status-badge ${ link.status }` }>
											{ link.status }
										</span>
									</td>
									<td>{ Number( link.clicks ).toLocaleString() }</td>
									<td>{ Number( link.replies_count ).toLocaleString() }</td>
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
					Replies ({ replies.length })
					<Button
						variant="link"
						href={ `admin.php?page=clipisode-replies&topic_id=${ id }` }
					>
						See All
					</Button>
				</h2>

				{ replies.length > 0 && (
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
							{ replies.slice( 0, 10 ).map( ( reply ) => (
								<tr
									key={ reply.id }
									className="clickable"
									onClick={ () => setSelectedReply( reply ) }
									style={ { cursor: 'pointer' } }
								>
									<td>{ reply.name }</td>
									<td>{ reply.tag || '—' }</td>
									<td>
										<span className={ `clipisode-status-badge ${ reply.status }` }>
											{ reply.status.replace( '_', ' ' ) }
										</span>
									</td>
									<td>
										<div className="clipisode-transcript-preview">
											{ reply.transcript || '—' }
										</div>
									</td>
									<td>{ new Date( reply.created_at ).toLocaleDateString() }</td>
								</tr>
							) ) }
						</tbody>
					</table>
				) }
			</div>

			<div className="clipisode-section clipisode-output-section">
				<h2>Clipisode</h2>

				{ topic.outputs && topic.outputs.length > 0 && renderState === 'idle' && (
					<div className="clipisode-output-list">
						{ topic.outputs.map( ( o ) => (
							<div key={ o.id } className="clipisode-output-card">
								<div className="clipisode-output-header">
									<strong>{ o.name }</strong>
									<span className="clipisode-output-date">
										{ new Date( o.created_at ).toLocaleString() }
									</span>
								</div>
								{ o.url ? (
									<>
										<video src={ o.url } controls playsInline />
										<div className="clipisode-output-actions">
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
									<div className="clipisode-output-actions">
										<span className="clipisode-output-pending">Processing...</span>
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

				{ renderState === 'idle' && (
					<Button
						variant="primary"
						onClick={ startRendering }
						disabled={ replies.filter( ( r ) => r.status === 'approved' ).length === 0 }
					>
						Generate Clipisode
					</Button>
				) }

				{ renderState === 'connecting' && (
					<div className="clipisode-output-status">
						<Spinner />
						<span>Connecting to render service...</span>
					</div>
				) }

				{ renderState === 'processing' && (
					<div className="clipisode-output-status">
						<div className="clipisode-output-phase">{ renderPhase }</div>
						<div className="clipisode-output-message">{ renderMessage }</div>
						<div className="clipisode-progress-bar clipisode-output-progress">
							<div
								className="clipisode-progress-fill"
								style={ { width: `${ renderProgress }%` } }
							/>
						</div>
						<Button variant="tertiary" isDestructive onClick={ cancelRendering }>
							Cancel
						</Button>
					</div>
				) }

				{ renderState === 'done' && (
					<div className="clipisode-output-status">
						<div className="clipisode-output-phase">Complete</div>
						{ renderOutputUrl && (
							<>
								<video src={ renderOutputUrl } controls playsInline />
								<div className="clipisode-output-actions">
									<a
										className="components-button is-secondary is-compact"
										href={ renderOutputUrl }
										download
									>
										Download
									</a>
									{ renderOutputId && (
										<Button
											variant="tertiary"
											size="compact"
											isDestructive
											onClick={ () => {
												deleteOutput( renderOutputId, 'All Replies' );
												setRenderState( 'idle' );
											} }
										>
											Delete
										</Button>
									) }
								</div>
							</>
						) }
						{ ! renderOutputUrl && (
							<Button variant="secondary" onClick={ () => setRenderState( 'idle' ) }>
								OK
							</Button>
						) }
					</div>
				) }

				{ renderState === 'error' && (
					<div className="clipisode-output-status clipisode-output-error">
						<div className="clipisode-output-phase">Error</div>
						<div className="clipisode-output-message">{ renderError }</div>
						<Button variant="secondary" onClick={ () => setRenderState( 'idle' ) }>
							Retry
						</Button>
					</div>
				) }
			</div>

			{ selectedReply && (
				<ReplyModal
					reply={ selectedReply }
					onClose={ () => setSelectedReply( null ) }
					onUpdated={ onReplyUpdated }
				/>
			) }
		</>
	);
}
