import { useState } from '@wordpress/element';
import { Modal, Button, TextControl } from '@wordpress/components';
import apiFetch from '@wordpress/api-fetch';
import type { Clip } from '../types';

interface ClipModalProps {
	clip: Clip;
	onClose: () => void;
	onUpdated: ( clip: Clip ) => void;
}

export default function ClipModal( { clip, onClose, onUpdated }: ClipModalProps ) {
	const [ tag, setTag ] = useState< string >( clip.tag || '' );
	const [ saving, setSaving ] = useState< boolean >( false );

	const updateStatus = ( status: string ) => {
		setSaving( true );
		apiFetch( {
			path: `/clipisode/v1/clips/${ clip.id }`,
			method: 'PUT',
			data: { status, tag },
		} )
			.then( onUpdated )
			.finally( () => setSaving( false ) );
	};

	return (
		<Modal title={ clip.name } onRequestClose={ onClose } size="medium">
			<div className="clipisode-modal-body">
				<dl className="clipisode-modal-meta">
					<dt>Status</dt>
					<dd>
						<span className={ `clipisode-status-badge ${ clip.status }` }>
							{ clip.status.replace( '_', ' ' ) }
						</span>
					</dd>

					{ clip.social_handle && (
						<>
							<dt>Social</dt>
							<dd>{ clip.social_handle } ({ clip.social_network })</dd>
						</>
					) }

					{ clip.email && (
						<>
							<dt>Email</dt>
							<dd>{ clip.email }</dd>
						</>
					) }

					<dt>Created</dt>
					<dd>{ new Date( clip.created_at ).toLocaleString() }</dd>

					{ clip.topic_title && (
						<>
							<dt>Topic</dt>
							<dd>{ clip.topic_title }</dd>
						</>
					) }
				</dl>

				{ clip.transcript && (
					<div className="clipisode-modal-transcript">
						{ clip.transcript }
					</div>
				) }

				<TextControl
					label="Tag"
					value={ tag }
					onChange={ setTag }
					__nextHasNoMarginBottom
				/>

				<div className="clipisode-modal-actions">
					<Button
						variant="primary"
						onClick={ () => updateStatus( 'approved' ) }
						disabled={ saving }
						style={ { background: '#00a32a', borderColor: '#00a32a' } }
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
		</Modal>
	);
}
