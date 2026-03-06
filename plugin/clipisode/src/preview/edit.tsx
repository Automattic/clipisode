import { useBlockProps, InnerBlocks } from '@wordpress/block-editor';

const L = { lock: { move: true, remove: true } };

const TEMPLATE: [ string, Record< string, unknown > ][] = [
	[ 'clipisode/preview-element', { type: 'player', ...L } ],
	[ 'clipisode/preview-element', { type: 'name', ...L } ],
	[ 'clipisode/preview-element', { type: 'topic-info', ...L } ],
	[ 'clipisode/preview-element', { type: 'cta', ...L } ],
];

export default function Edit() {
	return (
		<div { ...useBlockProps() }>
			<InnerBlocks
				template={ TEMPLATE }
				templateLock={ false }
				allowedBlocks={ [ 'clipisode/preview-element' ] }
			/>
		</div>
	);
}
