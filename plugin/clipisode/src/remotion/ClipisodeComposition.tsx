import {
	AbsoluteFill,
	Html5Video,
	Loop,
	OffthreadVideo,
	Sequence,
	useRemotionEnvironment,
} from 'remotion';
import { useState } from '@wordpress/element';
import { Video as BrowserVideo } from '@remotion/media';
import { buildTimeline, FPS, getCardBackgroundClip } from './timeline';
import { getCompositionBackground, ThemeCard, ThemeOverlay } from './themes';
import type { ClipisodeCompositionProps, CompositionClip } from './types';

function SourceVideo( {
	clip,
	videoFit,
	muted = false,
	onError,
}: {
	clip: CompositionClip;
	videoFit: 'cover' | 'contain';
	muted?: boolean;
	onError: ( name: string, error: Error ) => void;
} ) {
	const { isRendering, isClientSideRendering } = useRemotionEnvironment();
	const trimBefore = Math.round( clip.trimStart * FPS );
	const trimAfter = Math.round( clip.trimEnd * FPS );
	if ( isClientSideRendering ) {
		return (
			<BrowserVideo
				src={ clip.url }
				trimBefore={ trimBefore }
				trimAfter={ trimAfter }
				objectFit={ videoFit }
				muted={ muted }
				disallowFallbackToOffthreadVideo
				onError={ ( error ) => {
					onError( clip.name, error );
					return 'fail';
				} }
				style={ { width: '100%', height: '100%' } }
			/>
		);
	}
	const Video = isRendering ? OffthreadVideo : Html5Video;
	return (
		<Video
			src={ clip.url }
			trimBefore={ trimBefore }
			trimAfter={ trimAfter }
			muted={ muted }
			pauseWhenBuffering
			onError={ ( error ) => onError( clip.name, error ) }
			style={ { width: '100%', height: '100%', objectFit: videoFit } }
		/>
	);
}

export default function ClipisodeComposition( {
	clips,
	settings,
}: ClipisodeCompositionProps ) {
	const [ playbackError, setPlaybackError ] = useState< Error | null >(
		null
	);
	if ( playbackError ) {
		throw playbackError;
	}
	const { segments } = buildTimeline( clips, settings );
	const background = getCardBackgroundClip( clips, settings );
	const reportPlaybackError = ( name: string, error: Error ) => {
		setPlaybackError(
			new Error( `Video “${ name }” could not play: ${ error.message }` )
		);
	};

	return (
		<AbsoluteFill
			style={ {
				backgroundColor: getCompositionBackground( settings ),
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
							<SourceVideo
								clip={ segment.clip }
								videoFit={
									settings.videoFit as 'cover' | 'contain'
								}
								onError={ reportPlaybackError }
							/>
							<ThemeOverlay
								settings={ settings }
								name={ segment.clip.name }
								clip={ segment.clip }
							/>
						</>
					) : (
						<>
							{ background && (
								<Loop
									durationInFrames={
										Math.round( background.trimEnd * FPS ) -
										Math.round( background.trimStart * FPS )
									}
								>
									<SourceVideo
										clip={ background }
										videoFit="cover"
										muted
										onError={ reportPlaybackError }
									/>
								</Loop>
							) }
							<ThemeCard
								settings={ settings }
								kind={ segment.type }
								hasBackground={ Boolean( background ) }
							/>
						</>
					) }
				</Sequence>
			) ) }
		</AbsoluteFill>
	);
}
