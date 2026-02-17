import { useState, useEffect, useCallback } from '@wordpress/element';
import { Button, Spinner } from '@wordpress/components';
import apiFetch from '@wordpress/api-fetch';
import ClipModal from '../components/ClipModal';
import type { Topic, InvitationLink, Clip } from '../types';

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

	const load = useCallback( () => {
		Promise.all( [
			apiFetch( { path: `/clipisode/v1/topics/${ id }` } ),
			apiFetch( { path: `/clipisode/v1/topics/${ id }/invitation-links` } ),
			apiFetch( { path: `/clipisode/v1/clips?topic_id=${ id }` } ),
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
