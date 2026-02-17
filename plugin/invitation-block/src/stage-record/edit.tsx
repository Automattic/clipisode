import { useBlockProps, InnerBlocks } from '@wordpress/block-editor';

const TEMPLATE: [ string, Record< string, unknown > ][] = [
	[ 'clipisode/element', { type: 'upload-form', lock: { remove: true } } ],
];

export default function Edit() {
	return (
		<div
			{ ...useBlockProps( { className: 'ci-stage ci-stage-record' } ) }
		>
			<div className="ci-editor-label">Stage: Record</div>
			<InnerBlocks template={ TEMPLATE } />
		</div>
	);
}
