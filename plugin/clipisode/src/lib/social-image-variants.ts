import {
	SOCIAL_IMAGE_FORMAT_ORDER,
	SOCIAL_IMAGE_FORMATS,
	type SocialImageBlobSet,
	type SocialImageFormat,
} from './social-image-formats';

function canvasBlob( canvas: HTMLCanvasElement ): Promise< Blob > {
	return new Promise( ( resolve, reject ) => {
		canvas.toBlob( ( blob ) => {
			if ( blob ) {
				resolve( blob );
			} else {
				reject( new Error( 'The social image could not be resized.' ) );
			}
		}, 'image/png' );
	} );
}

/**
 * Normalize manually uploaded images and captured video frames into the same
 * three-format set as theme-generated artwork. Images are contained rather
 * than cropped so user-supplied text and faces remain intact.
 *
 * @param input  Source image blob.
 * @param signal Optional cancellation signal.
 */
export async function createSocialImageVariants(
	input: Blob,
	signal?: AbortSignal
): Promise< SocialImageBlobSet > {
	signal?.throwIfAborted();
	const objectUrl = URL.createObjectURL( input );
	try {
		const image = new Image();
		image.decoding = 'async';
		await new Promise< void >( ( resolve, reject ) => {
			image.onload = () => resolve();
			image.onerror = () =>
				reject( new Error( 'The image could not be read.' ) );
			image.src = objectUrl;
		} );

		const variants = {} as SocialImageBlobSet;
		for ( const format of SOCIAL_IMAGE_FORMAT_ORDER ) {
			signal?.throwIfAborted();
			const definition = SOCIAL_IMAGE_FORMATS[ format ];
			const canvas = document.createElement( 'canvas' );
			canvas.width = definition.width;
			canvas.height = definition.height;
			const context = canvas.getContext( '2d' );
			if ( ! context ) {
				throw new Error( 'The image canvas could not be created.' );
			}
			context.fillStyle = '#111827';
			context.fillRect( 0, 0, canvas.width, canvas.height );
			const scale = Math.min(
				canvas.width / image.naturalWidth,
				canvas.height / image.naturalHeight
			);
			const width = image.naturalWidth * scale;
			const height = image.naturalHeight * scale;
			context.drawImage(
				image,
				( canvas.width - width ) / 2,
				( canvas.height - height ) / 2,
				width,
				height
			);
			variants[ format as SocialImageFormat ] =
				await canvasBlob( canvas );
		}
		return variants;
	} finally {
		URL.revokeObjectURL( objectUrl );
	}
}
