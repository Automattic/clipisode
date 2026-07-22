import { GetElementsFn } from '@clipisode/theme';
import { background } from './layers/background';
import { foreground } from './layers/foreground';

export const getElements: GetElementsFn = ( video ) => {
	const width = 720;
	const height = 1280;
	const spacing = 25;
	const titleHeight = 760;
	const yoyoMin = 5.0;
	const titleDuration = 2.0;
	const endingDuration = 3.0;

	return [
		...background( video, {
			titleDuration,
			endingDuration,
			width,
			height,
		} ),
		...foreground( video, {
			endingDuration,
			titleDuration,
			width,
			height,
			spacing,
			titleHeight,
			yoyoMin,
		} ),
	];
};
