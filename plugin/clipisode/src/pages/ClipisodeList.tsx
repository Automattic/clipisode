import { useState, useEffect, useCallback } from '@wordpress/element';
import { Spinner } from '@wordpress/components';
import apiFetch from '@wordpress/api-fetch';
import type { MediaItem } from '../types';

function formatBytes( bytes: number | null ): string {
	if ( ! bytes ) return '—';
	if ( bytes < 1024 ) return `${ bytes } B`;
	if ( bytes < 1048576 ) return `${ ( bytes / 1024 ).toFixed( 1 ) } KB`;
	return `${ ( bytes / 1048576 ).toFixed( 1 ) } MB`;
}

export default function ClipisodeList() {
	const [ items, setItems ] = useState< MediaItem[] >( [] );
	const [ loading, setLoading ] = useState( true );

	const fetchClipisodes = useCallback( () => {
		setLoading( true );
		apiFetch< MediaItem[] >( { path: '/clipisode/v1/media?label=clipisode' } )
			.then( setItems )
			.finally( () => setLoading( false ) );
	}, [] );

	useEffect( () => {
		fetchClipisodes();
	}, [ fetchClipisodes ] );

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
				<h1>Clipisodes</h1>
				<span style={ { fontSize: 13, color: '#646970', alignSelf: 'center' } }>
					{ items.length } clipisode{ items.length !== 1 ? 's' : '' }
				</span>
			</div>

			{ items.length === 0 ? (
				<div className="clipisode-empty">
					<p>No clipisodes yet.</p>
				</div>
			) : (
				<table className="clipisode-table">
					<thead>
						<tr>
							<th>Name</th>
							<th>Topic</th>
							<th>Clips</th>
							<th>Size</th>
							<th>Created</th>
						</tr>
					</thead>
					<tbody>
						{ items.map( ( item ) => {
							const usage = item.used_by;
							const name = usage?.label || `Clipisode #${ item.id }`;
							const topicTitle = usage?.topic_title || '—';
							const topicLink = usage?.topic_id
								? `admin.php?page=clipisode#${ usage.topic_id }`
								: null;

							return (
								<tr key={ item.id }>
									<td>
										{ item.url ? (
											<a href={ item.url } target="_blank" rel="noopener noreferrer">
												{ name }
											</a>
										) : name }
									</td>
									<td>
										{ topicLink ? (
											<a href={ topicLink }>{ topicTitle }</a>
										) : topicTitle }
									</td>
									<td>{ usage?.clips_count || '—' }</td>
									<td>{ formatBytes( item.file_size ) }</td>
									<td>{ new Date( item.created_at ).toLocaleDateString() }</td>
								</tr>
							);
						} ) }
					</tbody>
				</table>
			) }
		</>
	);
}
