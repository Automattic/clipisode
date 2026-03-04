import { useState, useRef, useCallback } from '@wordpress/element';
import { Button, Spinner } from '@wordpress/components';
import apiFetch from '@wordpress/api-fetch';

interface SocialImagePickerProps {
	value: { id: number; url: string } | null;
	videoRef: React.RefObject< HTMLVideoElement >;
	hasVideo: boolean;
	onChange: ( value: { id: number; url: string } | null ) => void;
}

const ALLOWED_ACCEPT = 'image/jpeg,image/png,image/webp';

function uploadImage(
	file: Blob,
	filename: string,
	onProgress: ( percent: number ) => void
): { promise: Promise< { id: number; url: string } >; abort: () => void } {
	const xhr = new XMLHttpRequest();

	const promise = new Promise< { id: number; url: string } >( ( resolve, reject ) => {
		const formData = new FormData();
		formData.append( 'file', file, filename );

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

		xhr.open( 'POST', `${ root }clipisode/v1/media` );
		xhr.setRequestHeader( 'X-WP-Nonce', nonce );
		xhr.send( formData );
	} );

	return { promise, abort: () => xhr.abort() };
}

export default function SocialImagePicker( { value, videoRef, hasVideo, onChange }: SocialImagePickerProps ) {
	const [ uploading, setUploading ] = useState( false );
	const [ progress, setProgress ] = useState( 0 );
	const [ error, setError ] = useState< string | null >( null );
	const fileInputRef = useRef< HTMLInputElement >( null );
	const abortRef = useRef< ( () => void ) | null >( null );

	const doUpload = useCallback( async ( blob: Blob, filename: string ) => {
		setUploading( true );
		setProgress( 0 );
		setError( null );

		const upload = uploadImage( blob, filename, setProgress );
		abortRef.current = upload.abort;

		try {
			const result = await upload.promise;
			if ( value ) {
				apiFetch( { path: `/clipisode/v1/media/${ value.id }`, method: 'DELETE' } ).catch( () => {} );
			}
			onChange( result );
		} catch ( err: any ) {
			if ( err.message !== 'Upload cancelled.' ) {
				setError( err.message || 'Upload failed.' );
			}
		} finally {
			abortRef.current = null;
			setUploading( false );
			setProgress( 0 );
		}
	}, [ onChange, value ] );

	const handleFileInput = useCallback( ( e: React.ChangeEvent< HTMLInputElement > ) => {
		const file = e.target.files?.[ 0 ];
		if ( file ) {
			doUpload( file, file.name );
		}
		if ( fileInputRef.current ) {
			fileInputRef.current.value = '';
		}
	}, [ doUpload ] );

	const handleCaptureFrame = useCallback( () => {
		const videoEl = videoRef.current;
		if ( ! videoEl ) return;

		videoEl.pause();

		const canvas = document.createElement( 'canvas' );
		canvas.width = videoEl.videoWidth;
		canvas.height = videoEl.videoHeight;
		const ctx = canvas.getContext( '2d' );
		if ( ! ctx ) {
			setError( 'Could not create canvas context.' );
			return;
		}

		ctx.drawImage( videoEl, 0, 0 );

		canvas.toBlob( ( blob ) => {
			if ( ! blob ) {
				setError( 'Failed to capture frame.' );
				return;
			}
			doUpload( blob, 'social-image.jpg' );
		}, 'image/jpeg', 0.9 );
	}, [ videoRef, doUpload ] );

	const handleRemove = useCallback( () => {
		if ( value ) {
			apiFetch( { path: `/clipisode/v1/media/${ value.id }`, method: 'DELETE' } ).catch( () => {} );
		}
		onChange( null );
	}, [ onChange, value ] );

	return (
		<div>
			<label className="components-base-control__label">Social Image</label>
			<p style={ { fontSize: 12, color: '#646970', margin: '4px 0 8px' } }>
				Used for link previews on Facebook, Twitter, LinkedIn, etc.
				{ hasVideo ? ' Pause the intro video on the frame you want, then capture it.' : '' }
			</p>

			{ value && (
				<div style={ { marginBottom: 8 } }>
					<img
						src={ value.url }
						alt="Social preview"
						style={ { maxWidth: 300, maxHeight: 200, borderRadius: 4, display: 'block', border: '1px solid #ddd' } }
					/>
				</div>
			) }

			{ error && (
				<div style={ { color: '#d63638', fontSize: 13, marginBottom: 8 } }>{ error }</div>
			) }

			{ uploading && (
				<div style={ { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 } }>
					<Spinner />
					<span style={ { fontSize: 13 } }>Uploading... { progress }%</span>
				</div>
			) }

			<div style={ { display: 'flex', gap: 8, flexWrap: 'wrap' } }>
				<Button
					variant="secondary"
					onClick={ () => fileInputRef.current?.click() }
					disabled={ uploading }
					size="compact"
				>
					{ value ? 'Replace Image' : 'Upload Image' }
				</Button>
				{ hasVideo && (
					<Button
						variant="secondary"
						onClick={ handleCaptureFrame }
						disabled={ uploading }
						size="compact"
					>
						Capture Current Frame
					</Button>
				) }
				{ value && (
					<Button
						variant="tertiary"
						onClick={ handleRemove }
						disabled={ uploading }
						isDestructive
						size="compact"
					>
						Remove
					</Button>
				) }
			</div>

			<input
				ref={ fileInputRef }
				type="file"
				accept={ ALLOWED_ACCEPT }
				onChange={ handleFileInput }
				style={ { display: 'none' } }
			/>
		</div>
	);
}
