export type ThemeId = 'default' | 'wpvip' | 'none';
export type CompositionFormat = 'portrait' | 'square' | 'landscape';

export interface CompositionSettings {
	themeId: ThemeId;
	format: CompositionFormat;
	title: string;
	subtitle: string;
	endingText: string;
	accentColor: string;
	backgroundColor: string;
	textColor: string;
	fontFamily: 'sans' | 'serif';
	logoUrl: string;
	showNames: boolean;
	showTitle: boolean;
	showEnding: boolean;
	titleDuration: number;
	endingDuration: number;
	videoFit: 'cover' | 'contain';
}

export interface CompositionClip {
	id: string;
	mediaId: number;
	role: 'intro' | 'reply';
	name: string;
	url: string;
	duration: number;
	trimStart: number;
	trimEnd: number;
	included: boolean;
}

export type ClipisodeCompositionProps = {
	clips: CompositionClip[];
	settings: CompositionSettings;
};

export interface CardSegment {
	type: 'title' | 'ending';
	start: number;
	durationInFrames: number;
}

export interface ClipSegment {
	type: 'clip';
	start: number;
	durationInFrames: number;
	trimBeforeInFrames: number;
	trimAfterInFrames: number;
	clip: CompositionClip;
}

export type TimelineSegment = CardSegment | ClipSegment;

export interface CompositionTimeline {
	durationInFrames: number;
	segments: TimelineSegment[];
}
