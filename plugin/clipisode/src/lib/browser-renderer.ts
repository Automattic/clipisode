import { buildTimeline, FPS, getCompositionSize } from '../remotion/timeline';
import type { ClipisodeCompositionProps } from '../remotion/types';

export interface BrowserRenderSupport {
	supported: boolean;
	message?: string;
}

interface BrowserRenderOptions {
	signal: AbortSignal;
	onProgress: ( progress: number ) => void;
}

function videoConfiguration( composition: ClipisodeCompositionProps ) {
	if ( ! composition.clips.some( ( clip ) => clip.included ) ) {
		throw new Error( 'Include at least one video clip before rendering.' );
	}
	const size = getCompositionSize( composition.settings.format );
	const { durationInFrames } = buildTimeline(
		composition.clips,
		composition.settings
	);
	return { ...size, durationInFrames, fps: FPS };
}

export async function getBrowserRenderSupport(
	composition: ClipisodeCompositionProps
): Promise< BrowserRenderSupport > {
	try {
		if ( window.isSecureContext === false ) {
			return {
				supported: false,
				message: 'Browser rendering requires HTTPS or localhost.',
			};
		}
		const { width, height } = videoConfiguration( composition );
		const { canRenderMediaOnWeb } = await import(
			'@remotion/web-renderer'
		);
		const support = await canRenderMediaOnWeb( {
			width,
			height,
			container: 'mp4',
			videoCodec: 'h264',
			audioCodec: 'aac',
		} );
		if ( ! support.canRender ) {
			return {
				supported: false,
				message: support.issues
					.filter( ( issue ) => issue.severity === 'error' )
					.map( ( issue ) => issue.message )
					.join( ' ' ),
			};
		}
		if (
			support.resolvedVideoCodec !== 'h264' ||
			support.resolvedAudioCodec !== 'aac'
		) {
			return {
				supported: false,
				message:
					'This browser cannot export an MP4 with H.264 video and AAC audio.',
			};
		}
		return { supported: true };
	} catch ( error ) {
		return { supported: false, message: ( error as Error ).message };
	}
}

export async function renderBrowserComposition(
	composition: ClipisodeCompositionProps,
	{ signal, onProgress }: BrowserRenderOptions
): Promise< Blob > {
	signal.throwIfAborted();
	const [ { renderMediaOnWeb }, { default: ClipisodeComposition } ] =
		await Promise.all( [
			import( '@remotion/web-renderer' ),
			import( '../remotion/ClipisodeComposition' ),
		] );
	signal.throwIfAborted();
	const result = await renderMediaOnWeb( {
		composition: {
			id: 'Clipisode',
			component: ClipisodeComposition,
			defaultProps: composition,
			...videoConfiguration( composition ),
		},
		inputProps: composition,
		container: 'mp4',
		videoCodec: 'h264',
		audioCodec: 'aac',
		videoBitrate: 'high',
		pageResponsiveness: 'high',
		licenseKey: window.clipisodeAdmin?.remotion_license_key ?? null,
		isProduction: window.clipisodeAdmin?.remotion_is_production ?? true,
		signal,
		onProgress: ( { progress } ) => onProgress( progress ),
	} );
	signal.throwIfAborted();
	return result.getBlob();
}
