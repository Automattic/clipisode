export type ThemeId = string;
export type CompositionFormat = 'portrait' | 'square' | 'landscape';
export type ThemeValue = string | number | boolean | string[] | null;
export type ThemeValues = Record< string, ThemeValue >;

export interface ClipFilter {
	roles?: string[];
	tags?: string[];
}

export interface ThemeField {
	id: string;
	label: string;
	type:
		| 'text'
		| 'textarea'
		| 'number'
		| 'range'
		| 'select'
		| 'toggle'
		| 'color'
		| 'image'
		| 'clip'
		| 'multiselect';
	default: ThemeValue;
	optional?: boolean;
	help?: string;
	placeholder?: string;
	min?: number;
	max?: number;
	step?: number;
	options?: { label: string; value: string }[];
	source?: { kind: 'clips'; filter?: ClipFilter };
	when?: {
		field: string;
		equals: ThemeValue;
		scope?: 'composition' | 'clip';
	};
}

export interface ThemeGroup {
	id: string;
	label: string;
	scope: 'composition' | 'clip';
	description?: string;
	appliesTo?: ClipFilter;
	fields: ThemeField[];
}

export interface ThemeTag {
	id: string;
	label: string;
	description?: string;
	color?: string;
	roles?: string[];
	exclusiveGroup?: string;
	maxClips?: number;
}

export interface ThemeDefinition {
	id: ThemeId;
	label: string;
	description: string;
	renderer: string;
	groups: ThemeGroup[];
	tags: ThemeTag[];
	canvas: { backgroundField?: string; backgroundColor?: string };
	timeline: {
		title?: { enabledField: string; durationField: string };
		ending?: { enabledField: string; durationField: string };
		backgroundTag?: string;
		backgroundField?: string;
		endTag?: string;
	};
}

export interface CompositionSettings extends ThemeValues {
	themeId: ThemeId;
	format: CompositionFormat;
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
	tags?: string[];
	values?: ThemeValues;
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
