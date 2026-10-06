import type {
	CompositionClip,
	CompositionFormat,
	CompositionSettings,
	CompositionTimeline,
	TimelineSegment,
} from './types';

export const FPS = 30;

const compositionSizes: Record<
	CompositionFormat,
	{ width: number; height: number }
> = {
	portrait: { width: 1080, height: 1920 },
	square: { width: 1080, height: 1080 },
	landscape: { width: 1920, height: 1080 },
};

export function getCompositionSize( format: CompositionFormat ) {
	return compositionSizes[ format ];
}

function cardFrames( seconds: number, label: string ): number {
	if (
		! Number.isFinite( seconds ) ||
		seconds <= 0 ||
		Math.round( seconds * FPS ) < 1
	) {
		throw new Error( `${ label } must last at least one frame.` );
	}
	return Math.round( seconds * FPS );
}

export function buildTimeline(
	clips: CompositionClip[],
	settings: CompositionSettings
): CompositionTimeline {
	const segments: TimelineSegment[] = [];
	let cursor = 0;
	const hasTheme = settings.themeId !== 'none';

	if ( hasTheme && settings.showTitle ) {
		const durationInFrames = cardFrames(
			settings.titleDuration,
			'The title card'
		);
		segments.push( { type: 'title', start: cursor, durationInFrames } );
		cursor += durationInFrames;
	}

	for ( const clip of clips ) {
		if ( ! clip.included ) {
			continue;
		}
		if ( ! Number.isFinite( clip.duration ) || clip.duration <= 0 ) {
			throw new Error(
				`The duration of “${ clip.name }” is unavailable. Wait for its video to load.`
			);
		}
		if (
			! Number.isFinite( clip.trimStart ) ||
			! Number.isFinite( clip.trimEnd ) ||
			clip.trimStart < 0 ||
			clip.trimEnd > clip.duration ||
			clip.trimEnd <= clip.trimStart
		) {
			throw new Error(
				`The trim for “${ clip.name }” must stay within its video and end after it starts.`
			);
		}
		const trimBeforeInFrames = Math.round( clip.trimStart * FPS );
		const trimAfterInFrames = Math.round( clip.trimEnd * FPS );
		const durationInFrames = trimAfterInFrames - trimBeforeInFrames;
		if ( durationInFrames < 1 ) {
			throw new Error(
				`The trim for “${ clip.name }” must include at least one frame.`
			);
		}
		segments.push( {
			type: 'clip',
			start: cursor,
			durationInFrames,
			trimBeforeInFrames,
			trimAfterInFrames,
			clip,
		} );
		cursor += durationInFrames;
	}

	if ( hasTheme && settings.showEnding ) {
		const durationInFrames = cardFrames(
			settings.endingDuration,
			'The ending card'
		);
		segments.push( { type: 'ending', start: cursor, durationInFrames } );
		cursor += durationInFrames;
	}

	return { durationInFrames: cursor, segments };
}
