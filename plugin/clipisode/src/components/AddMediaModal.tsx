import { useState, useEffect, useCallback } from '@wordpress/element';
import { Button, Modal, SelectControl, Spinner } from '@wordpress/components';
import apiFetch from '@wordpress/api-fetch';
import type { MediaItem } from '../types';

interface AddMediaModalProps {
	existingMediaIds: number[];
	topicId?: number;
	onAdd: ( items: MediaItem[] ) => void;
	onClose: () => void;
}

const LABEL_OPTIONS = [
	{ label: 'All Labels', value: '' },
	{ label: 'Asset', value: 'asset' },
	{ label: 'Original', value: 'original' },
	{ label: 'Intro', value: 'intro' },
	{ label: 'Trim', value: 'trim' },
];

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

export default function AddMediaModal( {
	existingMediaIds,
	topicId,
	onAdd,
	onClose,
}: AddMediaModalProps ) {
	const [ items, setItems ] = useState< MediaItem[] >( [] );
	const [ loading, setLoading ] = useState( true );
	const [ selectedIds, setSelectedIds ] = useState< Set< number > >(
		new Set()
	);
	const [ labelFilter, setLabelFilter ] = useState( '' );
	const [ thisTopicOnly, setThisTopicOnly ] = useState( false );

	const existingSet = new Set( existingMediaIds );

	const visibleItems = items.filter( ( item ) => {
		if ( existingSet.has( item.id ) ) {
			return false;
		}
		if ( thisTopicOnly && topicId ) {
			const u = item.used_by;
			if ( ! u ) {
				return false;
			}
			if ( u.type === 'topic' && u.id === topicId ) {
				return true;
			}
			if ( u.type === 'reply' && u.topic_id === topicId ) {
				return true;
			}
			return false;
		}
		return true;
	} );

	const fetchMedia = useCallback( () => {
		setLoading( true );
		const params = new URLSearchParams( {
			type: 'video',
			exclude_label: 'clipisode',
		} );
		if ( labelFilter ) {
			params.set( 'label', labelFilter );
		}
		apiFetch< MediaItem[] >( { path: `/clipisode/v1/media?${ params }` } )
			.then( setItems )
			.finally( () => setLoading( false ) );
	}, [ labelFilter ] );

	useEffect( () => {
		fetchMedia();
	}, [ fetchMedia ] );

	const toggleSelection = ( id: number ) => {
		setSelectedIds( ( prev ) => {
			const next = new Set( prev );
			if ( next.has( id ) ) {
				next.delete( id );
			} else {
				next.add( id );
			}
			return next;
		} );
	};

	const handleAdd = () => {
		const selected = items.filter( ( i ) => selectedIds.has( i.id ) );
		onAdd( selected );
	};

	return (
		<Modal title="Add Media" onRequestClose={ onClose } size="large">
			<div
				style={ {
					display: 'flex',
					alignItems: 'center',
					gap: 8,
					marginBottom: 12,
				} }
			>
				<SelectControl
					value={ labelFilter }
					options={ LABEL_OPTIONS }
					onChange={ setLabelFilter }
					__nextHasNoMarginBottom
					__next40pxDefaultSize
					style={ { maxWidth: 150 } }
				/>
				{ topicId && (
					<label
						style={ {
							display: 'flex',
							alignItems: 'center',
							gap: 4,
							fontSize: 13,
							whiteSpace: 'nowrap',
						} }
					>
						<input
							type="checkbox"
							checked={ thisTopicOnly }
							onChange={ ( e ) =>
								setThisTopicOnly( e.target.checked )
							}
						/>
						Media from this topic only
					</label>
				) }
				<span
					style={ {
						fontSize: 13,
						color: '#646970',
						marginLeft: 'auto',
					} }
				>
					{ visibleItems.length } item
					{ visibleItems.length !== 1 ? 's' : '' }
				</span>
			</div>
			{ loading ? (
				<div className="clipisode-spinner-wrap">
					<Spinner />
				</div>
			) : visibleItems.length === 0 ? (
				<p>No video media matches the current filter.</p>
			) : (
				<table
					className="clipisode-table"
					style={ { width: '100%', borderCollapse: 'collapse' } }
				>
					<thead>
						<tr>
							<th style={ { width: 30 } }></th>
							<th style={ { width: 80 } }>Preview</th>
							<th>Name</th>
							<th>Used By</th>
							<th>Size</th>
						</tr>
					</thead>
					<tbody>
						{ visibleItems.map( ( item ) => (
							<tr key={ item.id }>
								<td>
									<input
										type="checkbox"
										checked={ selectedIds.has( item.id ) }
										disabled={ ! item.url }
										onChange={ () =>
											toggleSelection( item.id )
										}
									/>
								</td>
								<td>
									{ item.url ? (
										<video
											src={ item.url }
											style={ {
												width: 64,
												height: 48,
												objectFit: 'cover',
												borderRadius: 4,
												background: '#000',
											} }
											muted
											preload="metadata"
										/>
									) : (
										<span
											style={ {
												color: '#a7aaad',
												fontSize: 12,
											} }
										>
											—
										</span>
									) }
								</td>
								<td>
									{ item.used_by?.label ||
										item.label ||
										item.path.split( '/' ).pop() ||
										`media_${ item.id }` }
								</td>
								<td>
									{ item.used_by
										? `${
												item.used_by.type
													.charAt( 0 )
													.toUpperCase() +
												item.used_by.type.slice( 1 )
										  }: ${ item.used_by.label }`
										: '—' }
								</td>
								<td>{ formatBytes( item.file_size ) }</td>
							</tr>
						) ) }
					</tbody>
				</table>
			) }
			<div
				style={ {
					display: 'flex',
					justifyContent: 'flex-end',
					gap: 8,
					marginTop: 16,
				} }
			>
				<Button variant="tertiary" onClick={ onClose }>
					Cancel
				</Button>
				<Button
					variant="primary"
					disabled={ selectedIds.size === 0 }
					onClick={ handleAdd }
				>
					Add Selected ({ selectedIds.size })
				</Button>
			</div>
		</Modal>
	);
}
