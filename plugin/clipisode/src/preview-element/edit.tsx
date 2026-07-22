import { useBlockProps } from '@wordpress/block-editor';

interface EditProps {
	attributes: { type: string };
}

export default function Edit( { attributes }: EditProps ) {
	const { type } = attributes;
	const blockProps = useBlockProps( { className: `cp-el cp-el-${ type }` } );

	switch ( type ) {
		case 'player':
			return (
				<div { ...blockProps }>
					<div className="cp-video-placeholder">
						<span>▶ Clipisode Video</span>
					</div>
				</div>
			);

		case 'name':
			return (
				<div { ...blockProps }>
					<h1 className="cp-el-heading">Clipisode Name</h1>
				</div>
			);

		case 'topic-info':
			return (
				<div { ...blockProps }>
					<p className="cp-el-text">
						Topic Name &middot; Hosted by Host Name
					</p>
				</div>
			);

		case 'cta':
			return (
				<div { ...blockProps }>
					<span className="cp-cta cp-cta-preview">
						Record Your Own
					</span>
				</div>
			);

		default:
			return (
				<div { ...blockProps }>
					<p>Unknown preview element: { type }</p>
				</div>
			);
	}
}
