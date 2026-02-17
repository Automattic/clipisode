import { useState, useEffect } from '@wordpress/element';
import { Button, Spinner } from '@wordpress/components';
import apiFetch from '@wordpress/api-fetch';
import type { Topic } from '../types';

interface TopicListProps {
	navigate: ( path: string | number ) => void;
}

export default function TopicList( { navigate }: TopicListProps ) {
	const [ topics, setTopics ] = useState< Topic[] >( [] );
	const [ loading, setLoading ] = useState< boolean >( true );

	useEffect( () => {
		apiFetch( { path: '/clipisode/v1/topics' } )
			.then( setTopics )
			.finally( () => setLoading( false ) );
	}, [] );

	if ( loading ) {
		return (
			<div className="clipisode-spinner-wrap">
				<Spinner />
			</div>
		);
	}

	return (
		<>
			<div className="clipisode-page-header">
				<h1>Topics</h1>
				<Button variant="primary" onClick={ () => navigate( 'new' ) }>
					New Topic
				</Button>
			</div>

			{ topics.length === 0 ? (
				<div className="clipisode-empty">
					<p>No topics yet. Create your first one to start collecting clips.</p>
				</div>
			) : (
				<table className="clipisode-table">
					<thead>
						<tr>
							<th>Title</th>
							<th>Hosted By</th>
							<th>Clicks</th>
							<th>Clips</th>
							<th>Status</th>
							<th>Created</th>
						</tr>
					</thead>
					<tbody>
						{ topics.map( ( topic ) => (
							<tr key={ topic.id }>
								<td
									className="clickable"
									onClick={ () => navigate( topic.id ) }
								>
									{ topic.title }
								</td>
								<td>{ topic.hosted_by || '—' }</td>
								<td>{ Number( topic.clicks ).toLocaleString() }</td>
								<td>{ Number( topic.clips_count ).toLocaleString() }</td>
								<td>
									<span className={ `clipisode-status-badge ${ topic.status }` }>
										{ topic.status }
									</span>
								</td>
								<td>{ new Date( topic.created_at ).toLocaleDateString() }</td>
							</tr>
						) ) }
					</tbody>
				</table>
			) }
		</>
	);
}
