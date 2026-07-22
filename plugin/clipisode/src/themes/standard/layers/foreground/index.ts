import { ThemeElement, VideoData } from '@clipisode/theme';
import { combinationIcon } from './combinationIcon';
import { combinationGradient } from './combinationGradient';
import { titleCard } from './titleCard';
import { endingCard } from './endingCard';
import { clip } from './clip';

export type ForegroundMetaData = {
	titleDuration: number;
	endingDuration: number;
	width: number;
	height: number;
	spacing: number;
	logoWidth: number;
	logoHeight: number;
	titleHeight: number;
	yoyoMin: number;
};

export function foreground(
	video: VideoData,
	meta: ForegroundMetaData
): ThemeElement[] {
	const elements: ThemeElement[] = [];

	titleCard( video, meta ).forEach( ( e ) => elements.push( e ) );
	elements.push( combinationIcon( video, meta ) );
	elements.push( combinationGradient( video, meta ) );
	video.clips.forEach( ( _, index ) =>
		elements.push( clip( video, index, meta ) )
	);
	endingCard( video, meta ).forEach( ( e ) => elements.push( e ) );

	return elements;
}
