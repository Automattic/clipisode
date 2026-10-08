import type { CompositionSettings } from '../remotion/types';

export async function renderInvitationSocialImage(
	settings: CompositionSettings,
	signal?: AbortSignal
): Promise< Blob > {
	signal?.throwIfAborted();
	const [ { renderStillOnWeb }, { default: InvitationSocialImage } ] =
		await Promise.all( [
			import( '@remotion/web-renderer' ),
			import( '../remotion/InvitationSocialImage' ),
		] );
	signal?.throwIfAborted();

	const result = await renderStillOnWeb( {
		composition: {
			id: 'ClipisodeInvitationSocialImage',
			component: InvitationSocialImage,
			defaultProps: { settings },
			width: 1200,
			height: 630,
			durationInFrames: 31,
			fps: 30,
		},
		inputProps: { settings },
		frame: 30,
		licenseKey: window.clipisodeAdmin?.remotion_license_key ?? null,
		isProduction: window.clipisodeAdmin?.remotion_is_production ?? true,
		signal: signal ?? null,
	} );
	signal?.throwIfAborted();
	return result.blob( { format: 'png' } );
}
