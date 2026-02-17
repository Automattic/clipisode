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
		apiFetch( {
			path: `/clipisode/v1/topics/${ id }/invitation-links`,
			method: 'POST',
		} ).then( ( newLink ) => {
			setLinks( ( prev ) => [ newLink, ...prev ] );
		} );
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
				<Button
					className="clipisode-topic-edit"
					variant="primary"
					onClick={ () => navigate( `${ id }/edit` ) }
				>
					Edit
				</Button>

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
							<div><strong>Brand Terms</strong> { topic.brand_terms_title || '—' }</div>
							{ topic.custom_terms_title && (
								<div><strong>Custom Terms</strong> { topic.custom_terms_title }</div>
							) }
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
							</tr>
						</thead>
						<tbody>
							{ links.map( ( link ) => (
								<tr key={ link.id }>
									<td className="clickable">{ link.slug }</td>
									<td>
										<span className={ `clipisode-status-badge ${ link.status }` }>
											{ link.status }
										</span>
									</td>
									<td>{ Number( link.clicks ).toLocaleString() }</td>
									<td>{ Number( link.clips_count ).toLocaleString() }</td>
									<td>{ new Date( link.created_at ).toLocaleString() }</td>
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
