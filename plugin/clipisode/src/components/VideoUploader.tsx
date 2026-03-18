import { useState, useEffect, useRef, useCallback } from '@wordpress/element';
import { Button, Spinner } from '@wordpress/components';
import apiFetch from '@wordpress/api-fetch';
import type { VideoValue, MediaItem } from '../types';

const ALLOWED_TYPES = [ 'video/mp4', 'video/quicktime', 'video/webm', 'video/x-m4v' ];
const ALLOWED_ACCEPT = '.mp4,.mov,.webm,.m4v';
const MAX_SIZE = 80 * 1024 * 1024;

interface VideoUploaderProps {
	value: VideoValue | null;
	onChange: ( value: VideoValue | null ) => void;
	videoRef?: React.RefObject< HTMLVideoElement >;
}

interface ValidationResult {
	valid: boolean;
	error?: string;
}

function validateVideo( src: string ): Promise< ValidationResult > {
	return new Promise( ( resolve ) => {
		const videoEl = document.createElement( 'video' );
		videoEl.preload = 'auto';
		videoEl.muted = true;
		videoEl.playsInline = true;
		videoEl.style.display = 'none';
		document.body.appendChild( videoEl );

		const timeout = setTimeout( () => {
			cleanup();
			resolve( { valid: true } );
		}, 10000 );

		const cleanup = () => {
			clearTimeout( timeout );
			videoEl.remove();
		};

		videoEl.onloadeddata = () => {
			const { videoWidth, videoHeight } = videoEl;

			if ( videoWidth && videoHeight && videoWidth >= videoHeight ) {
				cleanup();
				resolve( { valid: false, error: 'Video must be portrait orientation (taller than wide).' } );
				return;
			}

			const audioTracks = ( videoEl as any ).audioTracks;
			const mozHasAudio = ( videoEl as any ).mozHasAudio;

			if ( audioTracks !== undefined ) {
				if ( ! audioTracks.length ) {
					cleanup();
					resolve( { valid: false, error: 'Video must contain an audio track.' } );
					return;
				}
			} else if ( mozHasAudio !== undefined ) {
				if ( ! mozHasAudio ) {
					cleanup();
					resolve( { valid: false, error: 'Video must contain an audio track.' } );
					return;
				}
			}

			cleanup();
			resolve( { valid: true } );
		};

		videoEl.onerror = () => {
			cleanup();
			resolve( { valid: false, error: 'Could not play this video file.' } );
		};

		videoEl.src = src;
	} );
}

function uploadFile(
	file: File,
	onProgress: ( percent: number ) => void
): { promise: Promise< VideoValue >; abort: () => void } {
	const xhr = new XMLHttpRequest();

	const promise = new Promise< VideoValue >( ( resolve, reject ) => {
		const formData = new FormData();
		formData.append( 'video', file );

		xhr.upload.addEventListener( 'progress', ( e ) => {
			if ( e.lengthComputable ) {
				onProgress( Math.round( ( e.loaded / e.total ) * 100 ) );
			}
		} );

		xhr.addEventListener( 'load', () => {
			if ( xhr.status >= 200 && xhr.status < 300 ) {
				resolve( JSON.parse( xhr.responseText ) );
			} else {
				try {
					const err = JSON.parse( xhr.responseText );
					reject( new Error( err.message || 'Upload failed.' ) );
				} catch {
					reject( new Error( 'Upload failed.' ) );
				}
			}
		} );

		xhr.addEventListener( 'error', () => reject( new Error( 'Upload failed.' ) ) );
		xhr.addEventListener( 'abort', () => reject( new Error( 'Upload cancelled.' ) ) );

		const root = window.clipisodeAdmin?.rest_root || '/wp-json/';
		const nonce = window.clipisodeAdmin?.nonce || '';

		xhr.open( 'POST', `${ root }clipisode/v1/videos/upload` );
		xhr.setRequestHeader( 'X-WP-Nonce', nonce );
		xhr.send( formData );
	} );

	return { promise, abort: () => xhr.abort() };
}

function deleteAttachment( id: number ): void {
	apiFetch( { path: `/clipisode/v1/videos/${ id }`, method: 'DELETE' } ).catch( () => {} );
}

type Mode = 'none' | 'upload' | 'url' | 'existing';

export default function VideoUploader( { value, onChange, videoRef }: VideoUploaderProps ) {
	const [ mode, setMode ] = useState< Mode | null >( value ? null : 'none' );
	const [ url, setUrl ] = useState( '' );
	const [ uploading, setUploading ] = useState( false );
	const [ importing, setImporting ] = useState( false );
	const [ progress, setProgress ] = useState( 0 );
	const [ error, setError ] = useState< string | null >( null );
	const [ dragOver, setDragOver ] = useState( false );
	const fileInputRef = useRef< HTMLInputElement >( null );
	const abortRef = useRef< ( () => void ) | null >( null );
	const [ existingMedia, setExistingMedia ] = useState< MediaItem[] >( [] );
	const [ loadingMedia, setLoadingMedia ] = useState( false );

	useEffect( () => {
		if ( mode !== 'existing' || value ) {
			return;
		}
		setLoadingMedia( true );
		Promise.all( [
			apiFetch< MediaItem[] >( { path: '/clipisode/v1/media?type=video&label=asset' } ),
			apiFetch< MediaItem[] >( { path: '/clipisode/v1/media?type=video&label=intro' } ),
			apiFetch< MediaItem[] >( { path: '/clipisode/v1/media?type=video&label=original' } ),
		] )
			.then( ( [ assets, intros, originals ] ) => {
				setExistingMedia( [ ...assets, ...intros, ...originals ].filter( ( m ) => m.url ) );
			} )
			.finally( () => setLoadingMedia( false ) );
	}, [ mode, value ] );

	const handleFile = useCallback( async ( file: File ) => {
		setError( null );

		if ( ! ALLOWED_TYPES.includes( file.type ) ) {
			setError( 'Invalid video type. Allowed: MP4, MOV, WebM, M4V.' );
			return;
		}

		if ( file.size > MAX_SIZE ) {
			setError( 'File too large. Maximum 80 MB.' );
			return;
		}

		setUploading( true );
		setProgress( 0 );

		const objectUrl = URL.createObjectURL( file );
		const upload = uploadFile( file, setProgress );
		abortRef.current = upload.abort;

		try {
			const [ uploadResult, validation ] = await Promise.all( [
				upload.promise,
				validateVideo( objectUrl ),
			] );

			URL.revokeObjectURL( objectUrl );

			if ( ! validation.valid ) {
				deleteAttachment( uploadResult.id );
				setError( validation.error || 'Video validation failed.' );
				return;
			}

			onChange( uploadResult );
		} catch ( err: any ) {
			URL.revokeObjectURL( objectUrl );
			if ( err.message !== 'Upload cancelled.' ) {
				setError( err.message || 'Upload failed.' );
			}
		} finally {
			abortRef.current = null;
			setUploading( false );
			setProgress( 0 );
		}
	}, [ onChange ] );

	const handleImportUrl = useCallback( async () => {
		if ( ! url.trim() ) {
			return;
		}

		setError( null );
		setImporting( true );

		try {
			const result = await apiFetch< VideoValue >( {
				path: '/clipisode/v1/videos/sideload',
				method: 'POST',
				data: { url: url.trim() },
			} );

			const validation = await validateVideo( result.url );
			if ( ! validation.valid ) {
				deleteAttachment( result.id );
				setError( validation.error || 'Video validation failed.' );
				return;
			}

			onChange( result );
			setUrl( '' );
		} catch ( err: any ) {
			setError( err.message || 'Import failed.' );
		} finally {
			setImporting( false );
		}
	}, [ url, onChange ] );

	const handleDrop = useCallback( ( e: React.DragEvent ) => {
		e.preventDefault();
		setDragOver( false );
		const file = e.dataTransfer.files[ 0 ];
		if ( file ) {
			handleFile( file );
		}
	}, [ handleFile ] );

	const handleDragOver = useCallback( ( e: React.DragEvent ) => {
		e.preventDefault();
		setDragOver( true );
	}, [] );

	const handleDragLeave = useCallback( () => {
		setDragOver( false );
	}, [] );

	const handleFileInput = useCallback( ( e: React.ChangeEvent< HTMLInputElement > ) => {
		const file = e.target.files?.[ 0 ];
		if ( file ) {
			handleFile( file );
		}
		if ( fileInputRef.current ) {
			fileInputRef.current.value = '';
		}
	}, [ handleFile ] );

	const handleRemove = useCallback( () => {
		if ( value && ! value.reused ) {
			deleteAttachment( value.id );
		}
		onChange( null );
	}, [ value, onChange ] );

	const handleModeChange = ( newMode: Mode | null ) => {
		if ( value ) {
			handleRemove();
		}
		if ( newMode === 'existing' ) {
			setLoadingMedia( true );
			setExistingMedia( [] );
		}
		setMode( newMode );
	};

	const busy = uploading || importing;

	return (
		<div className="clipisode-video-uploader">
			<label className="components-base-control__label">Intro Video</label>

			<div className="clipisode-video-mode-toggle">
				<label>
					<input
						type="radio"
						name="clipisode-video-mode"
						checked={ mode === 'none' }
						onChange={ () => handleModeChange( 'none' ) }
						disabled={ busy }
					/>
					No Video
				</label>
				<label>
					<input
						type="radio"
						name="clipisode-video-mode"
						checked={ mode === 'upload' }
						onChange={ () => handleModeChange( 'upload' ) }
						disabled={ busy }
					/>
					Upload File
				</label>
				<label>
					<input
						type="radio"
						name="clipisode-video-mode"
						checked={ mode === 'url' }
						onChange={ () => handleModeChange( 'url' ) }
						disabled={ busy }
					/>
					Import from URL
				</label>
				<label>
					<input
						type="radio"
						name="clipisode-video-mode"
						checked={ mode === 'existing' }
						onChange={ () => handleModeChange( 'existing' ) }
						disabled={ busy }
					/>
					Use Existing Media
				</label>
			</div>

			{ value && (
				<div className="clipisode-video-preview">
					<video ref={ videoRef } src={ value.url } controls playsInline />
				</div>
			) }

			{ error && (
				<div className="clipisode-video-error">{ error }</div>
			) }

			{ ! value && mode === 'upload' && (
				<>
					<div
						className={ `clipisode-video-dropzone${ dragOver ? ' drag-over' : '' }${ busy ? ' busy' : '' }` }
						onClick={ () => ! busy && fileInputRef.current?.click() }
						onDrop={ handleDrop }
						onDragOver={ handleDragOver }
						onDragLeave={ handleDragLeave }
					>
						{ uploading ? (
							<div className="clipisode-video-progress">
								<Spinner />
								<span>Uploading&hellip; { progress }%</span>
								<div className="clipisode-progress-bar">
									<div
										className="clipisode-progress-fill"
										style={ { width: `${ progress }%` } }
									/>
								</div>
							</div>
						) : (
							<>
								<div className="clipisode-dropzone-icon">
									<svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#8c8f94" strokeWidth="1.5">
										<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
										<polyline points="17 8 12 3 7 8" />
										<line x1="12" y1="3" x2="12" y2="15" />
									</svg>
								</div>
								<div className="clipisode-dropzone-text">
									Drag &amp; drop a video or click to browse
								</div>
								<div className="clipisode-dropzone-hint">
									MP4, MOV, WebM, M4V &mdash; max 80 MB &mdash; portrait only
								</div>
							</>
						) }
					</div>
					<input
						ref={ fileInputRef }
						type="file"
						accept={ ALLOWED_ACCEPT }
						onChange={ handleFileInput }
						style={ { display: 'none' } }
					/>
				</>
			) }

			{ ! value && mode === 'url' && (
				<div className="clipisode-video-url-input">
					<input
						type="url"
						placeholder="https://example.com/video.mp4"
						value={ url }
						onChange={ ( e ) => setUrl( e.target.value ) }
						disabled={ busy }
						className="components-text-control__input"
					/>
					<Button
						variant="secondary"
						onClick={ handleImportUrl }
						disabled={ busy || ! url.trim() }
						isBusy={ importing }
					>
						Import
					</Button>
				</div>
			) }

			{ ! value && mode === 'existing' && (
				loadingMedia ? (
					<div className="clipisode-spinner-wrap">
						<Spinner />
					</div>
				) : existingMedia.length === 0 ? (
					<div className="clipisode-media-picker-empty">
						No existing videos found. Upload assets on the <a href="admin.php?page=clipisode-media">Media page</a>.
					</div>
				) : (
					<div className="clipisode-media-picker-grid">
						{ existingMedia.map( ( item ) => (
							<button
								key={ item.id }
								type="button"
								className="clipisode-media-picker-card"
								onClick={ () => onChange( { id: item.id, url: item.url!, reused: true } ) }
							>
								<video
									src={ item.url! }
									muted
									preload="metadata"
								/>
								<span className="clipisode-media-picker-label">
									{ item.used_by?.label || item.label }
								</span>
							</button>
						) ) }
					</div>
				)
			) }
		</div>
	);
}
