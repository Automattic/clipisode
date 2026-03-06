import { registerBlockType } from '@wordpress/blocks';
import type { BlockVariation } from '@wordpress/blocks';
import Edit from './edit';
import metadata from './block.json';

const variations: BlockVariation[] = [
	{
		name: 'player',
		title: 'Video Player',
		icon: 'format-video',
		attributes: { type: 'player' },
		isActive: ( attrs ) => attrs.type === 'player',
	},
	{
		name: 'name',
		title: 'Clipisode Name',
		icon: 'heading',
		attributes: { type: 'name' },
		isActive: ( attrs ) => attrs.type === 'name',
	},
	{
		name: 'topic-info',
		title: 'Topic Info',
		icon: 'info-outline',
		attributes: { type: 'topic-info' },
		isActive: ( attrs ) => attrs.type === 'topic-info',
	},
	{
		name: 'cta',
		title: 'Call to Action',
		icon: 'button',
		attributes: { type: 'cta' },
		isActive: ( attrs ) => attrs.type === 'cta',
	},
];

registerBlockType( metadata.name, {
	edit: Edit,
	save: () => null,
	variations,
} );
