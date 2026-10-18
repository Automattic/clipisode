import type { CompositionSettings } from '../remotion/types';
import {
	SOCIAL_IMAGE_FORMAT_ORDER,
	SOCIAL_IMAGE_FORMATS,
	type SocialImageBlobSet,
	type SocialImageFormat,
} from './social-image-formats';

export async function renderInvitationSocialImage(
	settings: CompositionSettings,
	format: SocialImageFormat = 'wide',
	signal?: AbortSignal
): Promise< Blob > {
	signal?.throwIfAborted();
	const [ { renderStillOnWeb }, { default: InvitationSocialImage } ] =
		await Promise.all( [
			import( '@remotion/web-renderer' ),
			import( '../remotion/InvitationSocialImage' ),
		] );
	signal?.throwIfAborted();

	const definition = SOCIAL_IMAGE_FORMATS[ format ];
	const formatSettings = {
		...settings,
		format: definition.compositionFormat,
	};
	const result = await renderStillOnWeb( {
		composition: {
			id: `ClipisodeInvitationSocialImage-${ format }`,
			component: InvitationSocialImage,
			defaultProps: { settings: formatSettings },
			width: definition.width,
			height: definition.height,
			durationInFrames: 31,
			fps: 30,
		},
		inputProps: { settings: formatSettings },
		frame: 30,
		licenseKey: window.clipisodeAdmin?.remotion_license_key ?? null,
		isProduction: window.clipisodeAdmin?.remotion_is_production ?? true,
		signal: signal ?? null,
	} );
	signal?.throwIfAborted();
	return result.blob( { format: 'png' } );
}

export async function renderInvitationSocialImages(
	settings: CompositionSettings,
	signal?: AbortSignal
): Promise< SocialImageBlobSet > {
	const images = {} as SocialImageBlobSet;
	for ( const format of SOCIAL_IMAGE_FORMAT_ORDER ) {
		images[ format ] = await renderInvitationSocialImage(
			settings,
			format,
			signal
		);
	}
	return images;
}
