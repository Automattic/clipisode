import { OriginY, TextAlign, ThemeElement, VideoData } from '@clipisode/theme';
import { ForegroundMetaData } from '.';

export function titleCard(
	video: VideoData,
	meta: ForegroundMetaData
): ThemeElement[] {
	const cover = { x: 0, y: 0, width: meta.width, height: meta.height };

	const firstClip = video.clips[ 0 ];
	const finalClip = video.clips[ video.clips.length - 1 ];

	return [
		{
			type: 'rect',
			name: 'title.shade',
			startAt: 0,
			endAt: 2,
			props: { color: '#13191E', alpha: 0.65, ...cover },
			animations: [
				{
					startAt: meta.titleDuration - 0.4,
					endAt: meta.titleDuration,
					field: 'alpha',
					from: 0.65,
					to: 0.0,
				},
			],
		},
		{
			type: 'rect',
			name: 'title.line',
			startAt: 0,
			endAt: meta.titleDuration,
			props: {
				color: '#D8A45F',
				alpha: 1.0,
				x: 2 * meta.spacing,
				y: 880,
				width: 280,
				height: 3,
			},
			animations: [
				{
					startAt: meta.titleDuration - 0.5,
					endAt: meta.titleDuration - 0.1,
					field: 'alpha',
					from: 1.0,
					to: 0.0,
				},
				{
					startAt: meta.titleDuration - 0.1,
					endAt: meta.titleDuration,
					field: 'alpha',
					from: 0.0,
					to: 0.0,
				},
			],
		},
		{
			type: 'text',
			name: 'title.title',
			startAt: 0,
			endAt: meta.titleDuration - 0.1,
			props: {
				value: video.topic?.title ?? video.title,
				color: '#FFFFFF',
				fontName: 'FiraSans-ExtraBold',
				fontSize: 80,
				textAlign: TextAlign.Left,
				x: 2 * meta.spacing,
				y: 860,
				width: meta.width - 4 * meta.spacing,
				height: meta.titleHeight,
				originY: OriginY.Bottom,
				alpha: 1,
			},
			animations: [
				{
					startAt: meta.titleDuration - 0.5,
					endAt: meta.titleDuration - 0.1,
					field: 'alpha',
					from: 1.0,
					to: 0.0,
				},
			],
		},
		{
			type: 'text',
			name: 'title.host',
			startAt: 0,
			endAt: meta.titleDuration,
			props: {
				value: finalClip.displayName,
				color: '#D8A45F',
				fontName: 'OpenSans-Regular',
				fontSize: 36,
				lineHeight: 36,
				textAlign: TextAlign.Left,
				x: 2 * meta.spacing,
				y: 910,
				width: meta.width - 6 * meta.spacing,
				height: 54,
				alpha: 1,
			},
			animations: [
				{
					startAt: meta.titleDuration - 0.5,
					endAt: meta.titleDuration - 0.1,
					field: 'alpha',
					from: 1.0,
					to: 0.0,
				},
				{
					startAt: meta.titleDuration - 0.1,
					endAt: meta.titleDuration,
					field: 'alpha',
					from: 0.0,
					to: 0.0,
				},
			],
		},
		{
			type: 'text',
			name: 'title.guest',
			startAt: 0,
			endAt: meta.titleDuration,
			props: {
				value: 'and ' + firstClip.displayName,
				color: '#D8A45F',
				fontName: 'OpenSans-Regular',
				fontSize: 36,
				lineHeight: 36,
				textAlign: TextAlign.Left,
				x: 2 * meta.spacing,
				y: 966,
				width: meta.width - 6 * meta.spacing,
				height: 54,
				alpha: 1,
			},
			animations: [
				{
					startAt: meta.titleDuration - 0.5,
					endAt: meta.titleDuration - 0.1,
					field: 'alpha',
					from: 1.0,
					to: 0.0,
				},
				{
					startAt: meta.titleDuration - 0.1,
					endAt: meta.titleDuration,
					field: 'alpha',
					from: 0.0,
					to: 0.0,
				},
			],
		},
		{
			type: 'image',
			name: 'title.icon',
			startAt: 0,
			endAt: meta.titleDuration,
			props: {
				imageKey: 'icon.png',
				x: meta.width - 2 * meta.spacing - 150,
				y: meta.height - 3 * meta.spacing - 60,
				width: 150,
				height: 60,
				alpha: 1,
			},
			animations: [
				{
					startAt: meta.titleDuration - 0.5,
					endAt: meta.titleDuration - 0.1,
					field: 'alpha',
					from: 1.0,
					to: 0.0,
				},
				{
					startAt: meta.titleDuration - 0.1,
					endAt: meta.titleDuration,
					field: 'alpha',
					from: 0.0,
					to: 0.0,
				},
			],
		},
	];
}
