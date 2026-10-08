import { useState, useRef, useCallback } from '@wordpress/element';
import { Button, Spinner } from '@wordpress/components';
import apiFetch from '@wordpress/api-fetch';
import SocialImageComposer from './SocialImageComposer';
import { createSocialImageVariants } from '../lib/social-image-variants';
import {
	SOCIAL_IMAGE_FORMAT_ORDER,
	SOCIAL_IMAGE_FORMATS,
	type SocialImageBlobSet,
} from '../lib/social-image-formats';
import type { SocialImageValue, SocialImageVariants } from '../types';

interface SocialImagePickerProps {
	value: SocialImageValue | null;
	videoRef: React.RefObject< HTMLVideoElement >;
	hasVideo: boolean;
	onChange: ( value: SocialImageValue | null ) => void | Promise< void >;
	themeId?: string;
	title?: string;
	hostedBy?: string;
	inheritedValue?: Omit< SocialImageValue, 'id' > | null;
	label?: string;
}

const ALLOWED_ACCEPT = 'image/jpeg,image/png,image/webp';

function uploadImage(
	file: Blob,
	filename: string,
	label: string,
	parentId: number | null,
	onProgress: ( percent: number ) => void
): { promise: Promise< { id: number; url: string } >; abort: () => void } {
	const xhr = new XMLHttpRequest();

	const promise = new Promise< { id: number; url: string } >(
		( resolve, reject ) => {
			const formData = new FormData();
			formData.append( 'file', file, filename );
			formData.append( 'label', label );
			if ( parentId ) {
				formData.append( 'parent_id', String( parentId ) );
			}

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

			xhr.addEventListener( 'error', () =>
				reject( new Error( 'Upload failed.' ) )
			);
			xhr.addEventListener( 'abort', () =>
				reject( new Error( 'Upload cancelled.' ) )
			);

			const root = window.clipisodeAdmin?.rest_root || '/wp-json/';
			const nonce = window.clipisodeAdmin?.nonce || '';

			xhr.open( 'POST', `${ root }clipisode/v1/media` );
			xhr.setRequestHeader( 'X-WP-Nonce', nonce );
			xhr.send( formData );
		}
	);

	return { promise, abort: () => xhr.abort() };
}

export default function SocialImagePicker( {
	value,
	videoRef,
	hasVideo,
	onChange,
	themeId,
	title = '',
	hostedBy = '',
	inheritedValue = null,
	label = 'Social Image',
}: SocialImagePickerProps ) {
	const [ uploading, setUploading ] = useState( false );
	const [ progress, setProgress ] = useState( 0 );
	const [ error, setError ] = useState< string | null >( null );
	const fileInputRef = useRef< HTMLInputElement >( null );
	const abortRef = useRef< ( () => void ) | null >( null );

	const doUpload = useCallback(
		async ( images: SocialImageBlobSet, throwOnError = false ) => {
			setUploading( true );
			setProgress( 0 );
			setError( null );

			let rootId = 0;
			try {
				const uploaded = {} as SocialImageVariants;
				for ( const [
					index,
					format,
				] of SOCIAL_IMAGE_FORMAT_ORDER.entries() ) {
					const upload = uploadImage(
						images[ format ],
						`clipisode-social-preview-${ format }.png`,
						`social-${ format }`,
						format === 'wide' ? null : rootId,
						( percent ) =>
							setProgress(
								Math.round(
									( ( index + percent / 100 ) /
										SOCIAL_IMAGE_FORMAT_ORDER.length ) *
										100
								)
							)
					);
					abortRef.current = upload.abort;
					const result = await upload.promise;
					if ( format === 'wide' ) {
						rootId = result.id;
					}
					const dimensions = SOCIAL_IMAGE_FORMATS[ format ];
					uploaded[ format ] = {
						...result,
						width: dimensions.width,
						height: dimensions.height,
						type: 'image/png',
					};
				}
				const result: SocialImageValue = {
					id: rootId,
					url: uploaded.wide?.url || '',
					variants: uploaded,
				};
				try {
					await onChange( result );
				} catch ( err ) {
					apiFetch( {
						path: `/clipisode/v1/media/${ rootId }`,
						method: 'DELETE',
					} ).catch( () => {} );
					throw err;
				}
				if ( value && value.id !== rootId ) {
					apiFetch( {
						path: `/clipisode/v1/media/${ value.id }`,
						method: 'DELETE',
					} ).catch( () => {} );
				}
			} catch ( err: any ) {
				if ( rootId ) {
					apiFetch( {
						path: `/clipisode/v1/media/${ rootId }`,
						method: 'DELETE',
					} ).catch( () => {} );
				}
				if ( err.message !== 'Upload cancelled.' ) {
					setError( err.message || 'Upload failed.' );
				}
				if ( throwOnError ) {
					throw err;
				}
			} finally {
				abortRef.current = null;
				setUploading( false );
				setProgress( 0 );
			}
		},
		[ onChange, value ]
	);

	const normalizeAndUpload = useCallback(
		async ( blob: Blob ) => {
			setError( null );
			try {
				const images = await createSocialImageVariants( blob );
				await doUpload( images, true );
			} catch ( err ) {
				setError(
					err instanceof Error
						? err.message
						: 'The social images could not be created.'
				);
			}
		},
		[ doUpload ]
	);

	const handleFileInput = useCallback(
		( e: React.ChangeEvent< HTMLInputElement > ) => {
			const file = e.target.files?.[ 0 ];
			if ( file ) {
				normalizeAndUpload( file ).catch( () => {} );
			}
			if ( fileInputRef.current ) {
				fileInputRef.current.value = '';
			}
		},
		[ normalizeAndUpload ]
	);

	const handleCaptureFrame = useCallback( () => {
		const videoEl = videoRef.current;
		if ( ! videoEl ) {
			return;
		}

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

		canvas.toBlob(
			( blob ) => {
				if ( ! blob ) {
					setError( 'Failed to capture frame.' );
					return;
				}
				normalizeAndUpload( blob ).catch( () => {} );
			},
			'image/jpeg',
			0.9
		);
	}, [ videoRef, normalizeAndUpload ] );

	const handleRemove = useCallback( async () => {
		setError( null );
		try {
			await onChange( null );
			if ( value ) {
				apiFetch( {
					path: `/clipisode/v1/media/${ value.id }`,
					method: 'DELETE',
				} ).catch( () => {} );
			}
		} catch ( err ) {
			setError(
				err instanceof Error
					? err.message
					: 'The image could not be removed.'
			);
		}
	}, [ onChange, value ] );

	const displayedImage = value || inheritedValue;

	return (
		<div>
			<span className="components-base-control__label">{ label }</span>
			<p
				style={ {
					fontSize: 12,
					color: '#646970',
					margin: '4px 0 8px',
				} }
			>
				Stored as wide, square, and portrait images for social networks
				and messaging apps.
				{ ! value && inheritedValue
					? ' This invitation currently inherits the topic image.'
					: '' }
				{ hasVideo
					? ' Pause the intro video on the frame you want, then capture it.'
					: '' }
			</p>

			{ displayedImage && (
				<div className="clipisode-social-image-variants">
					{ displayedImage.variants ? (
						SOCIAL_IMAGE_FORMAT_ORDER.map( ( format ) => {
							const variant = displayedImage.variants?.[ format ];
							return variant ? (
								<figure key={ format }>
									<img
										src={ variant.url }
										alt={ `${ format } social preview` }
									/>
									<figcaption>{ format }</figcaption>
								</figure>
							) : null;
						} )
					) : (
						<img src={ displayedImage.url } alt="Social preview" />
					) }
				</div>
			) }

			{ error && (
				<div
					style={ {
						color: '#d63638',
						fontSize: 13,
						marginBottom: 8,
					} }
				>
					{ error }
				</div>
			) }

			{ uploading && (
				<div
					style={ {
						display: 'flex',
						alignItems: 'center',
						gap: 8,
						marginBottom: 8,
					} }
				>
					<Spinner />
					<span style={ { fontSize: 13 } }>
						Uploading... { progress }%
					</span>
				</div>
			) }

			<div style={ { display: 'flex', gap: 8, flexWrap: 'wrap' } }>
				{ themeId && (
					<SocialImageComposer
						themeId={ themeId }
						title={ title }
						hostedBy={ hostedBy }
						disabled={ uploading }
						onCreate={ ( images ) => doUpload( images, true ) }
					/>
				) }
				<Button
					variant="secondary"
					onClick={ () => fileInputRef.current?.click() }
					disabled={ uploading }
					size="compact"
				>
					{ value || inheritedValue
						? 'Upload Override'
						: 'Upload Image' }
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
