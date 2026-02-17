import { useBlockProps, InnerBlocks, InspectorControls } from '@wordpress/block-editor';
import { PanelBody, TextControl } from '@wordpress/components';

const STAGE_LOCK = { lock: { move: true, remove: true } };

const TEMPLATE: [ string, Record< string, unknown > ][] = [
	[ 'clipisode/invitation-landing', STAGE_LOCK ],
	[ 'clipisode/invitation-record', STAGE_LOCK ],
	[ 'clipisode/invitation-thanks', STAGE_LOCK ],
];

interface EditProps {
	attributes: { slug: string };
	setAttributes: ( attrs: Partial< { slug: string } > ) => void;
}

export default function Edit( { attributes, setAttributes }: EditProps ) {
	const { slug } = attributes;

	return (
		<>
			<InspectorControls>
				<PanelBody title="Invitation Settings">
					<TextControl
						label="Invitation Link Slug"
						help="The 6-character slug from Clipisode (e.g. d3137f). Used when the block is placed on a page."
						value={ slug }
						onChange={ ( v: string ) =>
							setAttributes( { slug: v } )
						}
					/>
				</PanelBody>
			</InspectorControls>

			<div { ...useBlockProps() }>
				<InnerBlocks
					template={ TEMPLATE }
					templateLock={ false }
					allowedBlocks={ [
						'clipisode/invitation-landing',
						'clipisode/invitation-record',
						'clipisode/invitation-thanks',
					] }
				/>
			</div>
		</>
	);
}
