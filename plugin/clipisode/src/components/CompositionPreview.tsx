import { useEffect, useMemo, useRef, useState } from '@wordpress/element';
import { Button, Notice } from '@wordpress/components';
import { Player, type PlayerRef } from '@remotion/player';
import ClipisodeComposition from '../remotion/ClipisodeComposition';
import { buildTimeline, FPS, getCompositionSize } from '../remotion/timeline';
import type { ClipisodeCompositionProps } from '../remotion/types';

interface Props extends ClipisodeCompositionProps {
	selectedClipId?: string | null;
	onSelectClip?: ( id: string ) => void;
}

export default function CompositionPreview( {
	selectedClipId,
	onSelectClip,
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
			<div className="clipisode-studio-sequence-heading">
				<h2>Sequence</h2>
				<span>Click to preview a moment</span>
			</div>
			<div
				className="clipisode-composition-chapters"
				aria-label="Preview chapters"
			>
				{ timeline.segments.map( ( segment, index ) => (
					<button
						key={ index }
						type="button"
						aria-label={ `Preview ${
							segment.type === 'clip'
								? segment.clip.name
								: { title: 'Title', ending: 'Ending' }[
										segment.type
								  ]
						}` }
						className={ `clipisode-sequence-item ${
							segment.type === 'clip' ? 'is-clip' : 'is-card'
						} ${
							segment.type === 'clip' &&
							selectedClipId === segment.clip.id
								? 'is-selected'
								: ''
						}` }
						style={ { flexGrow: segment.durationInFrames } }
						onClick={ () => {
							player.current?.seekTo( segment.start );
							if ( segment.type === 'clip' ) {
								onSelectClip?.( segment.clip.id );
							}
						} }
					>
						{ segment.type === 'clip' && (
							<video
								src={ segment.clip.url }
								muted
								playsInline
								preload="metadata"
								aria-hidden="true"
							/>
						) }
						<strong>
							{ segment.type === 'clip'
								? segment.clip.name
								: { title: 'Title', ending: 'Ending' }[
										segment.type
								  ] }
						</strong>
						<span>
							{ ( segment.durationInFrames / FPS ).toFixed( 1 ) }s
						</span>
					</button>
				) ) }
			</div>
		</div>
	);
}
