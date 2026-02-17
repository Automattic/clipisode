import { useBlockProps } from '@wordpress/block-editor';

interface EditProps {
	attributes: { type: string };
}

export default function Edit( { attributes }: EditProps ) {
	const { type } = attributes;
	const blockProps = useBlockProps( { className: `ci-el ci-el-${ type }` } );

	switch ( type ) {
		case 'video':
			return (
				<div { ...blockProps }>
					<div className="ci-video-placeholder">
						<span>▶ Intro Video</span>
					</div>
				</div>
			);

		case 'title':
			return (
				<div { ...blockProps }>
					<h1 className="ci-el-heading">Topic Title</h1>
				</div>
			);

		case 'hosted':
			return (
				<div { ...blockProps }>
					<p className="ci-el-text">Hosted by Host Name</p>
				</div>
			);

		case 'cta':
			return (
				<div { ...blockProps }>
					<span className="ci-cta ci-cta-preview">
						Record Your Reply
					</span>
				</div>
			);

		case 'terms':
			return (
				<div { ...blockProps }>
					<p className="ci-el-small">
						By participating you agree to the <u>terms</u>.
					</p>
				</div>
			);

		case 'upload-form':
			return (
				<div { ...blockProps }>
					<h2 className="ci-el-heading">Uploading 0%</h2>
					<div className="ci-progress-bar-preview">
						<div className="ci-progress-fill-preview" />
					</div>
					<div className="ci-form-preview">
						<label className="ci-label">Name</label>
						<div className="ci-input-preview" />
						<label className="ci-label">Instagram handle</label>
						<div className="ci-input-preview" />
						<span className="ci-cta ci-cta-preview">
							Save My Reply
						</span>
					</div>
				</div>
			);

		case 'thanks-heading':
			return (
				<div { ...blockProps }>
					<h2 className="ci-el-heading">Awesome… all done!</h2>
				</div>
			);

		case 'thanks-body':
			return (
				<div { ...blockProps }>
					<p className="ci-el-text">Thanks for your reply.</p>
				</div>
			);

		case 'thanks-cta':
			return (
				<div { ...blockProps }>
					<p className="ci-el-text ci-el-bold">Stay tuned!</p>
				</div>
			);

		default:
			return (
				<div { ...blockProps }>
					<p>Unknown element: { type }</p>
				</div>
			);
	}
}
