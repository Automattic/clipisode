import { useState, useEffect, useCallback } from '@wordpress/element';
import { Button, Modal, Notice, Spinner } from '@wordpress/components';
import apiFetch from '@wordpress/api-fetch';
import type { MediaItem, Output } from '../types';

type PreviewDraft = Pick<
	Output,
	'id' | 'name' | 'topic_id' | 'created_at' | 'clips_count' | 'has_composition'
>;

function formatBytes( bytes: number | null ): string {
	if ( ! bytes ) {
		return '—';
	}
	if ( bytes < 1024 ) {
		return `${ bytes } B`;
	}
	if ( bytes < 1048576 ) {
		return `${ ( bytes / 1024 ).toFixed( 1 ) } KB`;
	}
	return `${ ( bytes / 1048576 ).toFixed( 1 ) } MB`;
}

export default function ClipisodeList() {
	const [ items, setItems ] = useState< MediaItem[] >( [] );
	const [ drafts, setDrafts ] = useState< PreviewDraft[] >( [] );
	const [ loading, setLoading ] = useState( true );
	const [ error, setError ] = useState< string | null >( null );
	const [ previewItem, setPreviewItem ] = useState< {
		name: string;
		url: string;
	} | null >( null );

	const fetchClipisodes = useCallback( () => {
		setLoading( true );
		setError( null );
		Promise.all( [
			apiFetch< MediaItem[] >( {
				path: '/clipisode/v1/media?label=clipisode',
			} ),
			apiFetch< PreviewDraft[] >( { path: '/clipisode/v1/outputs' } ),
		] )
			.then( ( [ media, outputs ] ) => {
				setItems( media );
				setDrafts( outputs );
			} )
			.catch( () =>
				setError( 'Unable to load clipisodes. Please try again.' )
			)
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

	if ( error ) {
		return (
			<Notice status="error" isDismissible={ false }>
				<p>{ error }</p>
				<Button variant="secondary" onClick={ fetchClipisodes }>
					Try again
				</Button>
			</Notice>
		);
	}

	return (
		<>
			<div className="clipisode-page-header">
				<h1>Clipisodes</h1>
				<span
					style={ {
						fontSize: 13,
						color: '#646970',
						alignSelf: 'center',
					} }
				>
					{ drafts.length } saved preview
					{ drafts.length !== 1 ? 's' : '' }
					{ ' · ' }
					{ items.length } rendered video
					{ items.length !== 1 ? 's' : '' }
				</span>
			</div>

			<h2>Saved previews</h2>
			{ drafts.length === 0 ? (
				<div className="clipisode-empty-section">
					<p>
						No saved previews yet. Create a clipisode from a topic or
						the media library.
					</p>
				</div>
			) : (
				<table className="clipisode-table">
					<thead>
						<tr>
							<th>Name</th>
							<th>Topic</th>
							<th>Clips</th>
							<th>Created</th>
							<th></th>
						</tr>
					</thead>
					<tbody>
						{ drafts.map( ( draft ) => (
							<tr key={ draft.id }>
								<td>{ draft.name }</td>
								<td>
									{ draft.topic_id ? (
										<a
											href={ `admin.php?page=clipisode#${ draft.topic_id }` }
										>
											Topic #{ draft.topic_id }
										</a>
									) : (
										'—'
									) }
								</td>
								<td>{ draft.clips_count }</td>
								<td>
									{ new Date(
										draft.created_at
									).toLocaleDateString() }
								</td>
								<td>
									<Button
										variant="link"
										href={ `admin.php?page=clipisode#/compose/${ draft.id }` }
									>
										Edit preview
									</Button>
								</td>
							</tr>
						) ) }
					</tbody>
				</table>
			) }

			<h2>Rendered videos</h2>
			{ items.length === 0 ? (
				<div className="clipisode-empty">
					<p>No rendered videos yet.</p>
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
							<th></th>
						</tr>
					</thead>
					<tbody>
						{ items.map( ( item ) => {
							const usage = item.used_by;
							const name =
								usage?.label || `Clipisode #${ item.id }`;
							const topicTitle = usage?.topic_title || '—';
							const topicLink = usage?.topic_id
								? `admin.php?page=clipisode#${ usage.topic_id }`
								: null;

							return (
								<tr key={ item.id }>
									<td>
										{ item.url ? (
											<button
												type="button"
												style={ {
													background: 'none',
													border: 'none',
													padding: 0,
													color: '#2271b1',
													cursor: 'pointer',
													font: 'inherit',
													textAlign: 'left',
												} }
												onClick={ () =>
													setPreviewItem( {
														name,
														url: item.url!,
													} )
												}
											>
												{ name }
											</button>
										) : (
											name
										) }
									</td>
									<td>
										{ topicLink ? (
											<a href={ topicLink }>
												{ topicTitle }
											</a>
										) : (
											topicTitle
										) }
									</td>
									<td>{ usage?.clips_count || '—' }</td>
									<td>{ formatBytes( item.file_size ) }</td>
									<td>
										{ new Date(
											item.created_at
										).toLocaleDateString() }
									</td>
									<td>
										{ item.used_by?.preview_url && (
											<a
												href={
													item.used_by.preview_url
												}
												target="_blank"
												rel="noreferrer"
											>
												Preview
											</a>
										) }
									</td>
								</tr>
							);
						} ) }
					</tbody>
				</table>
			) }
			{ previewItem && (
				<Modal
					title={ previewItem.name }
					onRequestClose={ () => setPreviewItem( null ) }
					style={ { maxWidth: '90vw', maxHeight: '90vh' } }
				>
					<video
						src={ previewItem.url }
						controls
						autoPlay
						playsInline
						style={ {
							display: 'block',
							maxWidth: '100%',
							maxHeight: 'calc(90vh - 120px)',
							borderRadius: 4,
						} }
					/>
				</Modal>
			) }
		</>
	);
}
