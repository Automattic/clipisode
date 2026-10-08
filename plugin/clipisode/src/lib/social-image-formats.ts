import type { CompositionFormat } from '../remotion/types';

export type SocialImageFormat = 'wide' | 'square' | 'portrait';

export interface SocialImageFormatDefinition {
	label: string;
	width: number;
	height: number;
	compositionFormat: CompositionFormat;
}

export const SOCIAL_IMAGE_FORMATS: Record<
	SocialImageFormat,
	SocialImageFormatDefinition
> = {
	wide: {
		label: 'Wide',
		width: 1200,
		height: 630,
		compositionFormat: 'landscape',
	},
	square: {
		label: 'Square',
		width: 1200,
		height: 1200,
		compositionFormat: 'square',
	},
	portrait: {
		label: 'Portrait',
		width: 1000,
		height: 1500,
		compositionFormat: 'portrait',
	},
};

export const SOCIAL_IMAGE_FORMAT_ORDER = [
	'wide',
	'square',
	'portrait',
] as const;

export type SocialImageBlobSet = Record< SocialImageFormat, Blob >;
