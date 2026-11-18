import { useState } from '@wordpress/element';
import { Modal, Button, TextControl, Notice } from '@wordpress/components';
import apiFetch from '@wordpress/api-fetch';
import type { Reply } from '../types';

interface ReplyModalProps {
	reply: Reply;
	onClose: () => void;
	onUpdated: ( reply: Reply ) => void;
}

export default function ReplyModal( {
	reply,
	onClose,
	onUpdated,
}: ReplyModalProps ) {
	const [ tag, setTag ] = useState< string >( reply.tag || '' );
	const [ saving, setSaving ] = useState< boolean >( false );
	const [ error, setError ] = useState( '' );

	const updateStatus = ( status: string ) => {
		setSaving( true );
		setError( '' );
		apiFetch( {
			path: `/clipisode/v1/replies/${ reply.id }`,
			method: 'PUT',
			data: { status, tag },
		} )
			.then( onUpdated )
			.catch( () =>
				setError( 'Unable to save this review. Please try again.' )
			)
			.finally( () => setSaving( false ) );
	};

	return (
		<Modal title={ reply.name } onRequestClose={ onClose } size="large">
			{ error && (
				<Notice status="error" isDismissible={ false }>
					{ error }
				</Notice>
			) }
			<div className="clipisode-modal-body">
				{ reply.video_url && (
					<div className="clipisode-modal-video">
						<video
							src={ reply.video_url }
							controls
							autoPlay
							playsInline
						/>
					</div>
				) }

				<div className="clipisode-modal-info">
					<dl className="clipisode-modal-meta">
						<dt>Status</dt>
						<dd>
							<span
								className={ `clipisode-status-badge ${ reply.status }` }
							>
								{ reply.status.replace( '_', ' ' ) }
							</span>
						</dd>

						{ reply.social_handle && (
							<>
								<dt>Social</dt>
								<dd>
									{ reply.social_handle } (
									{ reply.social_network })
								</dd>
							</>
						) }

						{ reply.email && (
							<>
								<dt>Email</dt>
								<dd>{ reply.email }</dd>
							</>
						) }

						<dt>Created</dt>
						<dd>
							{ new Date( reply.created_at ).toLocaleString() }
						</dd>

						{ reply.topic_title && (
							<>
								<dt>Topic</dt>
								<dd>{ reply.topic_title }</dd>
							</>
						) }
					</dl>

					{ reply.transcript && (
						<div className="clipisode-modal-transcript">
							{ reply.transcript }
						</div>
					) }

					<TextControl
						label="Tag"
						value={ tag }
						onChange={ setTag }
						__nextHasNoMarginBottom
						__next40pxDefaultSize
					/>

					<div className="clipisode-modal-actions">
						<Button
							variant="primary"
							onClick={ () => updateStatus( 'approved' ) }
							disabled={ saving }
							style={ {
								background: '#00a32a',
								borderColor: '#00a32a',
							} }
						>
							Approve
						</Button>
						<Button
							variant="secondary"
							onClick={ () => updateStatus( 'on_hold' ) }
							disabled={ saving }
						>
							On Hold
						</Button>
						<Button
							isDestructive
							variant="secondary"
							onClick={ () => updateStatus( 'rejected' ) }
							disabled={ saving }
						>
							Reject
						</Button>
					</div>
				</div>
			</div>
		</Modal>
	);
}
