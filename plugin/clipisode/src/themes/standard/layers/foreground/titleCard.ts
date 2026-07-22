import { OriginY, TextAlign, ThemeElement, VideoData } from '@clipisode/theme';
import { ForegroundMetaData } from '.';

export function titleCard(
	video: VideoData,
	meta: ForegroundMetaData
): ThemeElement[] {
	const cover = { x: 0, y: 0, width: meta.width, height: meta.height };

	const firstClip = video.clips[ 0 ];
	const finalClip = video.clips[ video.clips.length - 1 ];

	const uniqueNames = new Set( video.clips.map( ( c ) => c.displayName ) );
	const showBothNames = uniqueNames.size === 2;

	return [
		{
			type: 'rect',
			name: 'title.shade',
			startAt: 0,
			endAt: 2,
			props: { color: '#000000', alpha: 0.65, ...cover },
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
				color: '#0066BB',
				alpha: 1.0,
				x: 2 * meta.spacing,
				y: 880,
				width: 280,
				height: 2.5,
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
				value: video.topic?.title ?? video.title, // " 🔥🔥🔥 mighty mighty bosstones carl weathers scarlett johansson arnold schwarzenegger"
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
				value: showBothNames
					? finalClip.displayName
					: firstClip.displayName,
				color: '#FFFFFF',
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
		...( showBothNames
			? [
					{
						type: 'text' as const,
						name: 'title.guest',
						startAt: 0,
						endAt: meta.titleDuration,
						props: {
							value: 'and ' + firstClip.displayName,
							color: '#FFFFFF',
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
								field: 'alpha' as const,
								from: 1.0,
								to: 0.0,
							},
							{
								startAt: meta.titleDuration - 0.1,
								endAt: meta.titleDuration,
								field: 'alpha' as const,
								from: 0.0,
								to: 0.0,
							},
						],
					},
			  ]
			: [] ),
		{
			type: 'image',
			name: 'title.logo',
			startAt: 0,
			endAt: meta.titleDuration,
			props: {
				imageKey: 'logo.png',
				x: meta.width - 2 * meta.spacing - meta.logoWidth,
				y: meta.height - 3 * meta.spacing - meta.logoHeight,
				width: meta.logoWidth,
				height: meta.logoHeight,
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
