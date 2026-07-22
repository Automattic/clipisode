import { ThemeElement, VideoData } from '@clipisode/theme';
import { ForegroundMetaData } from '.';

export function combinationGradient(
	video: VideoData,
	meta: ForegroundMetaData
): ThemeElement {
	const durationOfAllClips = video.clips.reduce(
		( totalDuration, clip ) => totalDuration + clip.duration,
		0
	);

	const bottomFadeRect = {
		x: 0,
		y: meta.height - 210,
		width: meta.width,
		height: 210,
	};

	const firstClipShort = video.clips[ 0 ].duration < meta.yoyoMin;
	const finalClipShort =
		video.clips[ video.clips.length - 1 ].duration < meta.yoyoMin;

	const startAt = meta.titleDuration + ( firstClipShort ? 0 : 0.4 );
	const endAt =
		meta.titleDuration + durationOfAllClips - ( finalClipShort ? 0 : 0.4 );

	return {
		type: 'gradient',
		name: 'gradient.name-background',
		startAt,
		endAt,
		props: {
			alpha: 1,
			rVal: 216,
			gVal: 164,
			bVal: 95,
			...bottomFadeRect,
		},
		animations: [
			{
				startAt,
				endAt: startAt + ( firstClipShort ? 0.4 : 0.8 ),
				field: 'alpha',
				from: 0,
				to: 1,
			},
			{
				startAt: endAt - ( finalClipShort ? 0.4 : 0.8 ),
				endAt,
				field: 'alpha',
				from: 1,
				to: 0,
			},
		],
	};
}
