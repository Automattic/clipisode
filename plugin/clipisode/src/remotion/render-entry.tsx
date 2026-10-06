import {
	Composition,
	getInputProps,
	registerRoot,
	type CalculateMetadataFunction,
} from 'remotion';
import ClipisodeComposition from './ClipisodeComposition';
import { buildTimeline, FPS, getCompositionSize } from './timeline';
import type { ClipisodeCompositionProps } from './types';

export const calculateCompositionMetadata: CalculateMetadataFunction<
	ClipisodeCompositionProps
> = ( { props } ) => {
	if ( ! props || ! Array.isArray( props.clips ) || ! props.settings ) {
		throw new Error( 'Rendering requires composition clips and settings.' );
	}
	if ( ! props.clips.some( ( clip ) => clip.included ) ) {
		throw new Error( 'Include at least one video clip before rendering.' );
	}
	const size = getCompositionSize( props.settings.format );
	if ( ! size ) {
		throw new Error(
			`Unknown composition format: ${ props.settings.format }`
		);
	}
	const { durationInFrames } = buildTimeline( props.clips, props.settings );
	if ( durationInFrames <= 0 ) {
		throw new Error( 'The composition must last at least one frame.' );
	}
	return {
		...size,
		durationInFrames,
		fps: FPS,
		defaultCodec: 'h264',
		defaultPixelFormat: 'yuv420p',
	};
};

function RenderRoot() {
	return (
		<Composition
			id="Clipisode"
			component={ ClipisodeComposition }
			defaultProps={ getInputProps< ClipisodeCompositionProps >() }
			calculateMetadata={ calculateCompositionMetadata }
		/>
	);
}

registerRoot( RenderRoot );
