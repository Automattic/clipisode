import { useState, useEffect, useCallback } from '@wordpress/element';
import { Button, SelectControl, Spinner } from '@wordpress/components';
import apiFetch from '@wordpress/api-fetch';
import ClipModal from '../components/ClipModal';
import type { Clip, Topic } from '../types';

const STATUS_OPTIONS = [
	{ label: 'All Statuses', value: '' },
	{ label: 'Unapproved', value: 'unapproved' },
	{ label: 'Approved', value: 'approved' },
	{ label: 'On Hold', value: 'on_hold' },
	{ label: 'Rejected', value: 'rejected' },
];

const SORT_OPTIONS = [
	{ label: 'Newest', value: 'desc' },
	{ label: 'Oldest', value: 'asc' },
];

interface ClipListProps {
	topicId?: string | null;
}

export default function ClipList( { topicId }: ClipListProps ) {
	const [ clips, setClips ] = useState< Clip[] >( [] );
	const [ topics, setTopics ] = useState< Topic[] >( [] );
	const [ loading, setLoading ] = useState< boolean >( true );
	const [ statusFilter, setStatusFilter ] = useState< string >( '' );
	const [ topicFilter, setTopicFilter ] = useState< string >( topicId || '' );
	const [ sortOrder, setSortOrder ] = useState< string >( 'desc' );
	const [ selectedClip, setSelectedClip ] = useState< Clip | null >( null );
	const [ selected, setSelected ] = useState< number[] >( [] );

	const fetchClips = useCallback( () => {
		const params = new URLSearchParams();
		if ( statusFilter ) {
			params.set( 'status', statusFilter );
		}
		if ( topicFilter ) {
			params.set( 'topic_id', topicFilter );
		}
		params.set( 'order', sortOrder );

		apiFetch( { path: `/clipisode/v1/clips?${ params }` } )
			.then( setClips )
			.finally( () => setLoading( false ) );
	}, [ statusFilter, topicFilter, sortOrder ] );

	useEffect( () => {
		fetchClips();
	}, [ fetchClips ] );

	useEffect( () => {
		if ( ! topicId ) {
			apiFetch( { path: '/clipisode/v1/topics' } ).then( setTopics );
		}
	}, [ topicId ] );

	const onClipUpdated = ( updatedClip: Clip ) => {
		setClips( ( prev ) =>
			prev.map( ( c ) => ( c.id === updatedClip.id ? updatedClip : c ) )
		);
		setSelectedClip( null );
	};

	const bulkAction = ( status: string ) => {
		if ( selected.length === 0 ) {
			return;
		}
		Promise.all(
			selected.map( ( clipId ) =>
				apiFetch( {
					path: `/clipisode/v1/clips/${ clipId }`,
					method: 'PUT',
					data: { status },
				} )
			)
		).then( ( updatedClips: Clip[] ) => {
			setClips( ( prev ) =>
				prev.map( ( c ) => {
					const updated = updatedClips.find( ( u: Clip ) => u.id === c.id );
					return updated || c;
				} )
			);
			setSelected( [] );
		} );
	};

	const toggleSelect = ( clipId: number ) => {
		setSelected( ( prev ) =>
			prev.includes( clipId )
				? prev.filter( ( id ) => id !== clipId )
				: [ ...prev, clipId ]
		);
	};

	const toggleAll = () => {
		setSelected( ( prev ) =>
			prev.length === clips.length ? [] : clips.map( ( c ) => c.id )
		);
	};

	const topicOptions = [
		{ label: 'All Topics', value: '' },
		...topics.map( ( t ) => ( { label: t.title, value: String( t.id ) } ) ),
	];

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
				<h1>
					Clips
					{ topicId && (
						<span style={ { fontWeight: 300, fontSize: 16, marginLeft: 8 } }>
							(filtered by topic)
						</span>
					) }
				</h1>
			</div>

			<div className="clipisode-filters">
				<SelectControl
					value={ statusFilter }
					options={ STATUS_OPTIONS }
					onChange={ setStatusFilter }
					__nextHasNoMarginBottom
				/>
				{ ! topicId && (
					<SelectControl
						value={ topicFilter }
						options={ topicOptions }
						onChange={ setTopicFilter }
						__nextHasNoMarginBottom
					/>
				) }
				<SelectControl
					value={ sortOrder }
					options={ SORT_OPTIONS }
					onChange={ setSortOrder }
					__nextHasNoMarginBottom
				/>

				{ selected.length > 0 && (
					<>
						<span style={ { fontSize: 13, color: '#646970' } }>
							{ selected.length } selected:
						</span>
						<Button size="compact" variant="secondary" onClick={ () => bulkAction( 'approved' ) }>
							Approve
						</Button>
						<Button size="compact" variant="secondary" onClick={ () => bulkAction( 'rejected' ) }>
							Reject
						</Button>
						<Button size="compact" variant="secondary" onClick={ () => bulkAction( 'on_hold' ) }>
							On Hold
						</Button>
					</>
				) }
			</div>

			{ clips.length === 0 ? (
				<div className="clipisode-empty">
					<p>No clips match the current filters.</p>
				</div>
			) : (
				<table className="clipisode-table">
					<thead>
						<tr>
							<th style={ { width: 32 } }>
								<input
									type="checkbox"
									checked={ selected.length === clips.length }
									onChange={ toggleAll }
								/>
							</th>
							<th>Name</th>
							{ ! topicId && <th>Topic</th> }
							<th>Tag</th>
							<th>Status</th>
							<th>Transcript</th>
							<th>Created</th>
						</tr>
					</thead>
					<tbody>
						{ clips.map( ( clip ) => (
							<tr key={ clip.id }>
								<td>
									<input
										type="checkbox"
										checked={ selected.includes( clip.id ) }
										onChange={ () => toggleSelect( clip.id ) }
									/>
								</td>
								<td
									className="clickable"
									onClick={ () => setSelectedClip( clip ) }
								>
									{ clip.name }
								</td>
								{ ! topicId && <td>{ clip.topic_title || '—' }</td> }
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
