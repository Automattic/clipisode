import { useBlockProps, InnerBlocks } from '@wordpress/block-editor';

const L = { lock: { remove: true } };

const TEMPLATE: [ string, Record< string, unknown > ][] = [
	[ 'clipisode/element', { type: 'thanks-heading', ...L } ],
	[ 'clipisode/element', { type: 'thanks-body', ...L } ],
	[ 'clipisode/element', { type: 'thanks-cta', ...L } ],
];

export default function Edit() {
	return (
		<div
			{ ...useBlockProps( { className: 'ci-stage ci-stage-thanks' } ) }
		>
			<div className="ci-editor-label">Stage: Thanks</div>
			<InnerBlocks template={ TEMPLATE } />
		</div>
	);
}
