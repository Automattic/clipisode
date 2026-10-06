import { useEffect, useMemo, useRef, useState } from '@wordpress/element';
import { Button, Notice } from '@wordpress/components';
import { Player, type PlayerRef } from '@remotion/player';
import ClipisodeComposition from '../remotion/ClipisodeComposition';
import { buildTimeline, FPS, getCompositionSize } from '../remotion/timeline';
import type { ClipisodeCompositionProps } from '../remotion/types';

interface Props extends ClipisodeCompositionProps {
	previewFrame?: { frame: number } | null;
}

export default function CompositionPreview( {
	previewFrame,
	...props
}: Props ) {
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
	useEffect( () => {
		if ( previewFrame ) {
			player.current?.seekTo( previewFrame.frame );
		}
	}, [ previewFrame ] );
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
	if ( timeline.durationInFrames === 0 ) {
		return (
			<div className="clipisode-empty">
				Include a sequence clip or enable a title or ending card.
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
						maxWidth: `calc(var(--clipisode-player-height, 60vh) * ${ size.width } / ${ size.height })`,
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
		</div>
	);
}
