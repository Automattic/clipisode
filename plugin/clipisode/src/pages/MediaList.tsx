import { useState, useEffect, useCallback, useRef } from '@wordpress/element';
import { Button, SelectControl, Spinner } from '@wordpress/components';
import apiFetch from '@wordpress/api-fetch';
import type { MediaItem } from '../types';

const TYPE_OPTIONS = [
	{ label: 'All Types', value: '' },
	{ label: 'Video', value: 'video' },
	{ label: 'Photo', value: 'photo' },
	{ label: 'Audio', value: 'audio' },
];

const LABEL_OPTIONS = [
	{ label: 'All Labels', value: '' },
	{ label: 'Asset', value: 'asset' },
	{ label: 'Original', value: 'original' },
	{ label: 'Intro', value: 'intro' },
	{ label: 'Mux', value: 'mux' },
	{ label: 'Trim', value: 'trim' },
	{ label: 'Thumbnail', value: 'thumbnail' },
];

function formatBytes( bytes: number | null ): string {
	if ( ! bytes ) return '—';
	if ( bytes < 1024 ) return `${ bytes } B`;
	if ( bytes < 1048576 ) return `${ ( bytes / 1024 ).toFixed( 1 ) } KB`;
	return `${ ( bytes / 1048576 ).toFixed( 1 ) } MB`;
}

function UsedByCell( { item }: { item: MediaItem } ) {
	const usage = item.used_by;
	if ( ! usage ) {
		return <span className="clipisode-status-badge rejected">Unused</span>;
	}

	const href = usage.type === 'topic' || usage.type === 'output'
		? `admin.php?page=clipisode#${ usage.topic_id || usage.id }`
		: `admin.php?page=clipisode-replies`;

	const prefix = usage.type.charAt( 0 ).toUpperCase() + usage.type.slice( 1 );
	const detail = usage.type === 'output' || usage.type === 'reply'
		? ` (${ usage.topic_title || 'Unknown topic' })`
		: '';

	return (
		<a href={ href }>
			<strong>{ prefix }:</strong> { usage.label }{ detail }
		</a>
	);
}

export default function MediaList() {
	const [ items, setItems ] = useState< MediaItem[] >( [] );
	const [ loading, setLoading ] = useState( true );
	const [ typeFilter, setTypeFilter ] = useState( '' );
	const [ labelFilter, setLabelFilter ] = useState( '' );
	const [ uploading, setUploading ] = useState( false );
	const [ uploadProgress, setUploadProgress ] = useState( 0 );
	const [ uploadError, setUploadError ] = useState< string | null >( null );
	const fileInputRef = useRef< HTMLInputElement >( null );

	const fetchMedia = useCallback( () => {
		setLoading( true );
		const params = new URLSearchParams();
		if ( typeFilter ) params.set( 'type', typeFilter );
		if ( labelFilter ) params.set( 'label', labelFilter );

		apiFetch< MediaItem[] >( { path: `/clipisode/v1/media?${ params }` } )
			.then( setItems )
			.finally( () => setLoading( false ) );
	}, [ typeFilter, labelFilter ] );

	useEffect( () => {
		fetchMedia();
	}, [ fetchMedia ] );

	const handleUpload = useCallback( ( file: File ) => {
		setUploadError( null );
		setUploading( true );
		setUploadProgress( 0 );

		const formData = new FormData();
		formData.append( 'file', file );

		const xhr = new XMLHttpRequest();
		const root = window.clipisodeAdmin?.rest_root || '/wp-json/';
		const nonce = window.clipisodeAdmin?.nonce || '';

		xhr.upload.addEventListener( 'progress', ( e ) => {
			if ( e.lengthComputable ) {
				setUploadProgress( Math.round( ( e.loaded / e.total ) * 100 ) );
			}
		} );

		xhr.addEventListener( 'load', () => {
			setUploading( false );
			if ( xhr.status >= 200 && xhr.status < 300 ) {
				fetchMedia();
			} else {
				try {
					const err = JSON.parse( xhr.responseText );
					setUploadError( err.message || 'Upload failed.' );
				} catch {
					setUploadError( 'Upload failed.' );
				}
			}
		} );

		xhr.addEventListener( 'error', () => {
			setUploading( false );
			setUploadError( 'Upload failed.' );
		} );

		xhr.open( 'POST', `${ root }clipisode/v1/media` );
		xhr.setRequestHeader( 'X-WP-Nonce', nonce );
		xhr.send( formData );
	}, [ fetchMedia ] );

	const onFileChange = useCallback( ( e: React.ChangeEvent< HTMLInputElement > ) => {
		const file = e.target.files?.[ 0 ];
		if ( file ) {
			handleUpload( file );
		}
		if ( fileInputRef.current ) {
			fileInputRef.current.value = '';
		}
	}, [ handleUpload ] );

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
				<h1>Media</h1>
				<Button
					variant="primary"
					onClick={ () => fileInputRef.current?.click() }
					isBusy={ uploading }
					disabled={ uploading }
				>
					{ uploading ? `Uploading… ${ uploadProgress }%` : 'Upload Media Asset' }
				</Button>
				<input
					ref={ fileInputRef }
					type="file"
					accept="video/*,image/*,audio/*"
					onChange={ onFileChange }
					style={ { display: 'none' } }
				/>
			</div>

			{ uploadError && (
				<div className="clipisode-video-error" style={ { marginBottom: 12 } }>
					{ uploadError }
				</div>
			) }

			<div className="clipisode-filters">
				<SelectControl
					value={ typeFilter }
					options={ TYPE_OPTIONS }
					onChange={ setTypeFilter }
					__nextHasNoMarginBottom
				/>
				<SelectControl
					value={ labelFilter }
					options={ LABEL_OPTIONS }
					onChange={ setLabelFilter }
					__nextHasNoMarginBottom
				/>
				<span style={ { fontSize: 13, color: '#646970', alignSelf: 'center' } }>
					{ items.length } item{ items.length !== 1 ? 's' : '' }
				</span>
			</div>

			{ items.length === 0 ? (
				<div className="clipisode-empty">
					<p>No media matches the current filters.</p>
				</div>
			) : (
				<table className="clipisode-table">
					<thead>
						<tr>
							<th style={ { width: 80 } }>Preview</th>
							<th>Type</th>
							<th>Label</th>
							<th>Used By</th>
							<th>Parent</th>
							<th>Derivatives</th>
							<th>Size</th>
							<th>MIME</th>
							<th>Storage</th>
							<th>Path</th>
							<th>Created</th>
						</tr>
					</thead>
					<tbody>
						{ items.map( ( item ) => (
							<tr key={ item.id }>
								<td>
									{ item.url && item.type === 'video' ? (
										<video
											src={ item.url }
											style={ { width: 64, height: 48, objectFit: 'cover', borderRadius: 4, background: '#000' } }
											muted
											preload="metadata"
										/>
									) : item.url && item.type === 'photo' ? (
										<img
											src={ item.url }
											alt=""
											style={ { width: 64, height: 48, objectFit: 'cover', borderRadius: 4 } }
										/>
									) : (
										<span style={ { color: '#a7aaad', fontSize: 12 } }>—</span>
									) }
								</td>
								<td>
									<span className={ `clipisode-status-badge ${ item.type }` }>
										{ item.type }
									</span>
								</td>
								<td>{ item.label }</td>
								<td><UsedByCell item={ item } /></td>
								<td>
									{ item.parent_id
										? `#${ item.parent_id }`
										: '—'
									}
								</td>
								<td>{ Number( item.children_count ) || '—' }</td>
								<td>{ formatBytes( item.file_size ) }</td>
								<td style={ { fontSize: 12 } }>{ item.mime_type || '—' }</td>
								<td>{ item.storage }</td>
								<td>
									<div className="clipisode-transcript-preview" title={ item.path }>
										{ item.path }
									</div>
								</td>
								<td>{ new Date( item.created_at ).toLocaleDateString() }</td>
							</tr>
						) ) }
					</tbody>
				</table>
			) }
		</>
	);
}
