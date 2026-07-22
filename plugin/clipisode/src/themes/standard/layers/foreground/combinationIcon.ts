import { ThemeElement, VideoData } from '@clipisode/theme';
import { ForegroundMetaData } from '.';

export function combinationIcon(
	video: VideoData,
	meta: ForegroundMetaData
): ThemeElement {
	const durationOfAllClips = video.clips.reduce(
		( totalDuration, clip ) => totalDuration + clip.duration,
		0
	);

	return {
		type: 'image',
		name: 'combination.icon',
		startAt: meta.titleDuration,
		endAt: meta.titleDuration + durationOfAllClips,
		props: {
			imageKey: 'icon.png',
			alpha: 0.8,
			x: 575,
			y: 50,
			width: 90,
			height: 90,
		},
		animations:
			durationOfAllClips < meta.yoyoMin
				? [
						{
							startAt: meta.titleDuration,
							endAt: meta.titleDuration + 1.0,
							field: 'alpha',
							from: 0,
							to: 0.8,
						},
						{
							startAt:
								meta.titleDuration + durationOfAllClips - 1.0,
							endAt: meta.titleDuration + durationOfAllClips,
							field: 'alpha',
							from: 0.8,
							to: 0,
						},
				  ]
				: [
						{
							startAt: meta.titleDuration,
							endAt: meta.titleDuration + 0.5,
							field: 'alpha',
							from: 0,
							to: 0,
						},
						{
							startAt: meta.titleDuration + 0.5,
							endAt: meta.titleDuration + 1.0,
							field: 'alpha',
							from: 0,
							to: 0.8,
						},
						{
							startAt: meta.titleDuration + 0.2,
							endAt: meta.titleDuration + 0.8,
							field: 'width',
							from: 0,
							to: 90,
						},
						{
							startAt: meta.titleDuration + 0.2,
							endAt: meta.titleDuration + 0.8,
							field: 'height',
							from: 0,
							to: 90,
						},
						{
							startAt: meta.titleDuration + 0.2,
							endAt: meta.titleDuration + 0.8,
							field: 'x',
							from: 620,
							to: 575,
						},
						{
							startAt: meta.titleDuration + 0.2,
							endAt: meta.titleDuration + 0.8,
							field: 'y',
							from: 95,
							to: 50,
						},

						{
							startAt: meta.titleDuration + 0.8,
							endAt: meta.titleDuration + 0.9,
							field: 'width',
							from: 90,
							to: 100,
						},
						{
							startAt: meta.titleDuration + 0.8,
							endAt: meta.titleDuration + 0.9,
							field: 'height',
							from: 90,
							to: 100,
						},
						{
							startAt: meta.titleDuration + 0.8,
							endAt: meta.titleDuration + 0.9,
							field: 'x',
							from: 575,
							to: 570,
						},
						{
							startAt: meta.titleDuration + 0.8,
							endAt: meta.titleDuration + 0.9,
							field: 'y',
							from: 50,
							to: 45,
						},

						{
							startAt: meta.titleDuration + 0.9,
							endAt: meta.titleDuration + 1.0,
							field: 'width',
							from: 100,
							to: 90,
						},
						{
							startAt: meta.titleDuration + 0.9,
							endAt: meta.titleDuration + 1.0,
							field: 'height',
							from: 100,
							to: 90,
						},
						{
							startAt: meta.titleDuration + 0.9,
							endAt: meta.titleDuration + 1.0,
							field: 'x',
							from: 570,
							to: 575,
						},
						{
							startAt: meta.titleDuration + 0.9,
							endAt: meta.titleDuration + 1.0,
							field: 'y',
							from: 45,
							to: 50,
						},

						{
							startAt:
								meta.titleDuration + durationOfAllClips - 1.0,
							endAt:
								meta.titleDuration + durationOfAllClips - 0.9,
							field: 'width',
							from: 90,
							to: 100,
						},
						{
							startAt:
								meta.titleDuration + durationOfAllClips - 1.0,
							endAt:
								meta.titleDuration + durationOfAllClips - 0.9,
							field: 'height',
							from: 90,
							to: 100,
						},
						{
							startAt:
								meta.titleDuration + durationOfAllClips - 1.0,
							endAt:
								meta.titleDuration + durationOfAllClips - 0.9,
							field: 'x',
							from: 575,
							to: 570,
						},
						{
							startAt:
								meta.titleDuration + durationOfAllClips - 1.0,
							endAt:
								meta.titleDuration + durationOfAllClips - 0.9,
							field: 'y',
							from: 50,
							to: 45,
						},

						{
							startAt:
								meta.titleDuration + durationOfAllClips - 0.9,
							endAt:
								meta.titleDuration + durationOfAllClips - 0.8,
							field: 'width',
							from: 100,
							to: 90,
						},
						{
							startAt:
								meta.titleDuration + durationOfAllClips - 0.9,
							endAt:
								meta.titleDuration + durationOfAllClips - 0.8,
							field: 'height',
							from: 100,
							to: 90,
						},
						{
							startAt:
								meta.titleDuration + durationOfAllClips - 0.9,
							endAt:
								meta.titleDuration + durationOfAllClips - 0.8,
							field: 'x',
							from: 570,
							to: 575,
						},
						{
							startAt:
								meta.titleDuration + durationOfAllClips - 0.9,
							endAt:
								meta.titleDuration + durationOfAllClips - 0.8,
							field: 'y',
							from: 45,
							to: 50,
						},

						{
							startAt:
								meta.titleDuration + durationOfAllClips - 0.8,
							endAt:
								meta.titleDuration + durationOfAllClips - 0.2,
							field: 'width',
							from: 90,
							to: 0,
						},
						{
							startAt:
								meta.titleDuration + durationOfAllClips - 0.8,
							endAt:
								meta.titleDuration + durationOfAllClips - 0.2,
							field: 'height',
							from: 90,
							to: 0,
						},
						{
							startAt:
								meta.titleDuration + durationOfAllClips - 0.8,
							endAt:
								meta.titleDuration + durationOfAllClips - 0.2,
							field: 'x',
							from: 575,
							to: 620,
						},
						{
							startAt:
								meta.titleDuration + durationOfAllClips - 0.8,
							endAt:
								meta.titleDuration + durationOfAllClips - 0.2,
							field: 'y',
							from: 50,
							to: 95,
						},

						{
							startAt:
								meta.titleDuration + durationOfAllClips - 1.0,
							endAt:
								meta.titleDuration + durationOfAllClips - 0.5,
							field: 'alpha',
							from: 0.8,
							to: 0,
						},
						{
							startAt:
								meta.titleDuration + durationOfAllClips - 0.5,
							endAt: meta.titleDuration + durationOfAllClips,
							field: 'alpha',
							from: 0,
							to: 0,
						},
				  ],
	};
}
