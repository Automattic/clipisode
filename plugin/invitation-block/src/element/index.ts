import { registerBlockType } from '@wordpress/blocks';
import type { BlockVariation } from '@wordpress/blocks';
import Edit from './edit';
import metadata from './block.json';

const variations: BlockVariation[] = [
	{
		name: 'video',
		title: 'Intro Video',
		icon: 'format-video',
		attributes: { type: 'video' },
		isActive: ( attrs ) => attrs.type === 'video',
	},
	{
		name: 'title',
		title: 'Topic Title',
		icon: 'heading',
		attributes: { type: 'title' },
		isActive: ( attrs ) => attrs.type === 'title',
	},
	{
		name: 'hosted',
		title: 'Hosted By',
		icon: 'admin-users',
		attributes: { type: 'hosted' },
		isActive: ( attrs ) => attrs.type === 'hosted',
	},
	{
		name: 'cta',
		title: 'CTA Button',
		icon: 'button',
		attributes: { type: 'cta' },
		isActive: ( attrs ) => attrs.type === 'cta',
	},
	{
		name: 'terms',
		title: 'Terms Link',
		icon: 'media-text',
		attributes: { type: 'terms' },
		isActive: ( attrs ) => attrs.type === 'terms',
	},
	{
		name: 'upload-form',
		title: 'Upload & Form',
		icon: 'upload',
		attributes: { type: 'upload-form' },
		isActive: ( attrs ) => attrs.type === 'upload-form',
	},
	{
		name: 'thanks-heading',
		title: 'Thanks Heading',
		icon: 'smiley',
		attributes: { type: 'thanks-heading' },
		isActive: ( attrs ) => attrs.type === 'thanks-heading',
	},
	{
		name: 'thanks-body',
		title: 'Thanks Message',
		icon: 'editor-paragraph',
		attributes: { type: 'thanks-body' },
		isActive: ( attrs ) => attrs.type === 'thanks-body',
	},
	{
		name: 'thanks-cta',
		title: 'Stay Tuned',
		icon: 'megaphone',
		attributes: { type: 'thanks-cta' },
		isActive: ( attrs ) => attrs.type === 'thanks-cta',
	},
];

registerBlockType( metadata.name, {
	edit: Edit,
	save: () => null,
	variations,
} );
