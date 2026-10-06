import { useEffect, useMemo, useRef, useState } from '@wordpress/element';
import { Button, Notice } from '@wordpress/components';
import { Player, type PlayerRef } from '@remotion/player';
import ClipisodeComposition from '../remotion/ClipisodeComposition';
import { buildTimeline, FPS, getCompositionSize } from '../remotion/timeline';
import type { ClipisodeCompositionProps } from '../remotion/types';

export default function CompositionPreview( props: ClipisodeCompositionProps ) {
	const player = useRef< PlayerRef >( null );
	const [ revision, setRevision ] = useState( 0 );
	const timeline = useMemo( () => {
		try {
			return {
				...buildTimeline( props.clips, props.settings ),
				error: '',
			};
		} catch ( error ) {
			return {
				durationInFrames: 0,
				segments: [],
				error: ( error as Error ).message,
			};
		}
	}, [ props.clips, props.settings ] );
	const size = getCompositionSize( props.settings.format );
	useEffect( () => {
		player.current?.pause();
		player.current?.seekTo( 0 );
	}, [ props.clips, timeline.durationInFrames ] );
	if ( timeline.error ) {
		return (
			<Notice status="error" isDismissible={ false }>
				{ timeline.error }
			</Notice>
		);
	}
	if ( ! props.clips.some( ( clip ) => clip.included ) ) {
		return (
			<div className="clipisode-empty">
				Include a clip to preview your composition.
			</div>
		);
	}
	return (
		<div className="clipisode-composition-preview">
			<div className="clipisode-composition-stage">
				<Player
					key={ revision }
					ref={ player }
					component={ ClipisodeComposition }
					inputProps={ props }
					durationInFrames={ timeline.durationInFrames }
					fps={ FPS }
					compositionWidth={ size.width }
					compositionHeight={ size.height }
					controls
					showVolumeControls
					clickToPlay
					doubleClickToFullscreen
					style={ {
						width: '100%',
						maxWidth: `calc(60vh * ${ size.width } / ${ size.height })`,
						aspectRatio: `${ size.width } / ${ size.height }`,
					} }
					errorFallback={ ( { error } ) => (
						<div className="clipisode-player-error" role="alert">
							<p>Preview could not play: { error.message }</p>
							<Button
								variant="secondary"
								onClick={ () => setRevision( revision + 1 ) }
							>
								Retry preview
							</Button>
						</div>
					) }
				/>
			</div>
			<p className="clipisode-composition-caption">
				{ ( timeline.durationInFrames / FPS ).toFixed( 1 ) } seconds ·{ ' ' }
				{ size.width } × { size.height } · { FPS } fps
			</p>
			<div
				className="clipisode-composition-chapters"
				aria-label="Preview chapters"
			>
				{ timeline.segments.map( ( segment, index ) => (
					<Button
						key={ index }
						variant="secondary"
						size="compact"
						onClick={ () =>
							player.current?.seekTo( segment.start )
						}
					>
						{ segment.type === 'clip'
							? segment.clip.name
							: { title: 'Title', ending: 'Ending' }[
									segment.type
							  ] }
					</Button>
				) ) }
			</div>
		</div>
	);
}
