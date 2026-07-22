import { useState, useEffect, useCallback } from '@wordpress/element';
import { Button, SelectControl, Spinner } from '@wordpress/components';
import apiFetch from '@wordpress/api-fetch';
import ReplyModal from '../components/ReplyModal';
import type { Reply, Topic } from '../types';

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

interface ReplyListProps {
	topicId?: string | null;
}

export default function ReplyList( { topicId }: ReplyListProps ) {
	const [ replies, setReplies ] = useState< Reply[] >( [] );
	const [ topics, setTopics ] = useState< Topic[] >( [] );
	const [ loading, setLoading ] = useState< boolean >( true );
	const [ statusFilter, setStatusFilter ] = useState< string >( '' );
	const [ topicFilter, setTopicFilter ] = useState< string >( topicId || '' );
	const [ sortOrder, setSortOrder ] = useState< string >( 'desc' );
	const [ selectedReply, setSelectedReply ] = useState< Reply | null >(
		null
	);
	const [ selected, setSelected ] = useState< number[] >( [] );

	const fetchReplies = useCallback( () => {
		const params = new URLSearchParams();
		if ( statusFilter ) {
			params.set( 'status', statusFilter );
		}
		if ( topicFilter ) {
			params.set( 'topic_id', topicFilter );
		}
		params.set( 'order', sortOrder );

		apiFetch< Reply[] >( { path: `/clipisode/v1/replies?${ params }` } )
			.then( setReplies )
			.finally( () => setLoading( false ) );
	}, [ statusFilter, topicFilter, sortOrder ] );

	useEffect( () => {
		fetchReplies();
	}, [ fetchReplies ] );

	useEffect( () => {
		if ( ! topicId ) {
			apiFetch< Topic[] >( { path: '/clipisode/v1/topics' } ).then(
				setTopics
			);
		}
	}, [ topicId ] );

	const onReplyUpdated = ( updatedReply: Reply ) => {
		setReplies( ( prev ) =>
			prev.map( ( r ) => ( r.id === updatedReply.id ? updatedReply : r ) )
		);
		setSelectedReply( null );
	};

	const bulkAction = ( status: string ) => {
		if ( selected.length === 0 ) {
			return;
		}
		Promise.all(
			selected.map( ( replyId ) =>
				apiFetch< Reply >( {
					path: `/clipisode/v1/replies/${ replyId }`,
					method: 'PUT',
					data: { status },
				} )
			)
		).then( ( updatedReplies: Reply[] ) => {
			setReplies( ( prev ) =>
				prev.map( ( r ) => {
					const updated = updatedReplies.find(
						( u: Reply ) => u.id === r.id
					);
					return updated || r;
				} )
			);
			setSelected( [] );
		} );
	};

	const toggleSelect = ( replyId: number ) => {
		setSelected( ( prev ) =>
			prev.includes( replyId )
				? prev.filter( ( id ) => id !== replyId )
				: [ ...prev, replyId ]
		);
	};

	const toggleAll = () => {
		setSelected( ( prev ) =>
			prev.length === replies.length ? [] : replies.map( ( r ) => r.id )
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
					Replies
					{ topicId && (
						<span
							style={ {
								fontWeight: 300,
								fontSize: 16,
								marginLeft: 8,
							} }
						>
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
					__next40pxDefaultSize
				/>
				{ ! topicId && (
					<SelectControl
						value={ topicFilter }
						options={ topicOptions }
						onChange={ setTopicFilter }
						__nextHasNoMarginBottom
						__next40pxDefaultSize
					/>
				) }
				<SelectControl
					value={ sortOrder }
					options={ SORT_OPTIONS }
					onChange={ setSortOrder }
					__nextHasNoMarginBottom
					__next40pxDefaultSize
				/>

				{ selected.length > 0 && (
					<>
						<span style={ { fontSize: 13, color: '#646970' } }>
							{ selected.length } selected:
						</span>
						<Button
							size="compact"
							variant="secondary"
							onClick={ () => bulkAction( 'approved' ) }
						>
							Approve
						</Button>
						<Button
							size="compact"
							variant="secondary"
							onClick={ () => bulkAction( 'rejected' ) }
						>
							Reject
						</Button>
						<Button
							size="compact"
							variant="secondary"
							onClick={ () => bulkAction( 'on_hold' ) }
						>
							On Hold
						</Button>
					</>
				) }
			</div>

			{ replies.length === 0 ? (
				<div className="clipisode-empty">
					<p>No replies match the current filters.</p>
				</div>
			) : (
				<table className="clipisode-table">
					<thead>
						<tr>
							<th style={ { width: 32 } }>
								<input
									type="checkbox"
									checked={
										selected.length === replies.length
									}
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
						{ replies.map( ( reply ) => (
							<tr key={ reply.id }>
								<td>
									<input
										type="checkbox"
										checked={ selected.includes(
											reply.id
										) }
										onChange={ () =>
											toggleSelect( reply.id )
										}
									/>
								</td>
								<td
									className="clickable"
									onClick={ () => setSelectedReply( reply ) }
								>
									{ reply.name }
								</td>
								{ ! topicId && (
									<td>{ reply.topic_title || '—' }</td>
								) }
								<td>{ reply.tag || '—' }</td>
								<td>
									<span
										className={ `clipisode-status-badge ${ reply.status }` }
									>
										{ reply.status.replace( '_', ' ' ) }
									</span>
								</td>
								<td>
									<div className="clipisode-transcript-preview">
										{ reply.transcript || '—' }
									</div>
								</td>
								<td>
									{ new Date(
										reply.created_at
									).toLocaleDateString() }
								</td>
							</tr>
						) ) }
					</tbody>
				</table>
			) }

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
