import { useBlockProps, InnerBlocks } from '@wordpress/block-editor';

const L = { lock: { remove: true } };

const TEMPLATE: [ string, Record< string, unknown > ][] = [
	[ 'clipisode/element', { type: 'video', ...L } ],
	[ 'clipisode/element', { type: 'title', ...L } ],
	[ 'clipisode/element', { type: 'hosted', ...L } ],
	[ 'clipisode/element', { type: 'qr-code', ...L } ],
	[ 'clipisode/element', { type: 'terms', ...L } ],
];

export default function Edit() {
	return (
		<div
			{ ...useBlockProps( { className: 'ci-stage ci-stage-desktop' } ) }
		>
			<div className="ci-editor-label">Stage: Desktop</div>
			<InnerBlocks template={ TEMPLATE } />
		</div>
	);
}
