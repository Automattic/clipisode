import {
	AbsoluteFill,
	Html5Video,
	OffthreadVideo,
	Sequence,
	useRemotionEnvironment,
} from 'remotion';
import { useState } from '@wordpress/element';
import { Video as BrowserVideo } from '@remotion/media';
import { buildTimeline, FPS } from './timeline';
import { ThemeCard, ThemeOverlay } from './themes';
import type { ClipisodeCompositionProps } from './types';

export default function ClipisodeComposition( {
	clips,
	settings,
}: ClipisodeCompositionProps ) {
	const [ playbackError, setPlaybackError ] = useState< Error | null >(
		null
	);
	const { isRendering, isClientSideRendering } = useRemotionEnvironment();
	if ( playbackError ) {
		throw playbackError;
	}
	const { segments } = buildTimeline( clips, settings );
	const Video = isRendering ? OffthreadVideo : Html5Video;
	const reportPlaybackError = ( name: string, error: Error ) => {
		setPlaybackError(
			new Error( `Video “${ name }” could not play: ${ error.message }` )
		);
	};

	return (
		<AbsoluteFill
			style={ {
				backgroundColor: settings.backgroundColor,
				overflow: 'hidden',
			} }
		>
			{ segments.map( ( segment ) => (
				<Sequence
					key={
						segment.type === 'clip' ? segment.clip.id : segment.type
					}
					from={ segment.start }
					durationInFrames={ segment.durationInFrames }
					premountFor={ segment.type === 'clip' ? FPS : 0 }
					name={
						segment.type === 'clip'
							? segment.clip.name
							: segment.type
					}
				>
					{ segment.type === 'clip' ? (
						<>
							{ isClientSideRendering ? (
								<BrowserVideo
									src={ segment.clip.url }
									trimBefore={ segment.trimBeforeInFrames }
									trimAfter={ segment.trimAfterInFrames }
									objectFit={ settings.videoFit }
									disallowFallbackToOffthreadVideo
									onError={ ( error ) => {
										reportPlaybackError(
											segment.clip.name,
											error
										);
										return 'fail';
									} }
									style={ { width: '100%', height: '100%' } }
								/>
							) : (
								<Video
									src={ segment.clip.url }
									trimBefore={ segment.trimBeforeInFrames }
									trimAfter={ segment.trimAfterInFrames }
									pauseWhenBuffering
									onError={ ( error ) =>
										reportPlaybackError(
											segment.clip.name,
											error
										)
									}
									style={ {
										width: '100%',
										height: '100%',
										objectFit: settings.videoFit,
									} }
								/>
							) }
							<ThemeOverlay
								settings={ settings }
								name={ segment.clip.name }
							/>
						</>
					) : (
						<ThemeCard
							settings={ settings }
							kind={ segment.type }
						/>
					) }
				</Sequence>
			) ) }
		</AbsoluteFill>
	);
}
