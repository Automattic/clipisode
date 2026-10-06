export function getVideoDuration( url: string ): Promise< number > {
	return new Promise( ( resolve, reject ) => {
		const video = document.createElement( 'video' );
		const cleanup = () => {
			clearTimeout( timeout );
			video.onloadedmetadata = null;
			video.onerror = null;
			video.removeAttribute( 'src' );
			video.load();
		};
		const fail = () => {
			cleanup();
			reject(
				new Error(
					'Video metadata could not be loaded. Check that the media URL is accessible and the video format is supported by your browser.'
				)
			);
		};
		const timeout = window.setTimeout( fail, 30000 );
		video.preload = 'metadata';
		video.onloadedmetadata = () => {
			const duration = video.duration;
			if ( ! Number.isFinite( duration ) || duration <= 0 ) {
				fail();
				return;
			}
			cleanup();
			resolve( duration );
		};
		video.onerror = fail;
		video.src = url;
	} );
}
