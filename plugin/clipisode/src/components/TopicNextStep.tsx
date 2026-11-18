import { useState } from '@wordpress/element';
import { Button, Notice } from '@wordpress/components';
import type { Reply, InvitationLink, Output } from '../types';
import useOnboarding from '../hooks/useOnboarding';

export default function TopicNextStep( {
	topicId,
	outputs,
	replies,
	links,
	selectedIds,
	review,
	compose,
	refresh,
	createLink,
	busy,
}: {
	topicId: number;
	outputs: Output[];
	replies: Reply[];
	links: InvitationLink[];
	selectedIds: Set< number >;
	review: ( reply: Reply ) => void;
	compose: () => void;
	refresh: () => void;
	createLink: () => void;
	busy: boolean;
} ) {
	const { state } = useOnboarding();
	const saved =
		state?.topic_id === topicId
			? outputs.find( ( output ) => output.id === state.output_id )
			: null;
	const [ copied, setCopied ] = useState( false );
	const [ error, setError ] = useState( '' );
	const open = links.find( ( link ) => link.status === 'open' );
	const pending = replies.find(
		( reply ) => reply.status === 'unapproved' || reply.status === 'on_hold'
	);
	const ready = replies.filter(
		( reply ) =>
			reply.status === 'approved' &&
			reply.media_id &&
			selectedIds.has( reply.id )
	);
	let eyebrow = 'LET’S GET YOUR FIRST REPLY';
	let title = 'Invite people into the conversation.';
	let description =
		'Share this link, or open the invitation yourself and submit a short video to try the whole flow.';
	if ( pending ) {
		eyebrow = 'A REPLY IS WAITING';
		title = 'Choose what goes in your video.';
		description =
			'Watch each reply and approve the ones you want to include. Nothing is approved automatically.';
	}
	if ( ready.length ) {
		eyebrow = 'READY TO CREATE';
		title = 'Bring your replies together.';
		description = `${ ready.length } approved ${
			ready.length === 1 ? 'clip is' : 'clips are'
		} selected. Your title and theme are ready; you can reorder or trim in the studio.`;
	}
	if ( saved ) {
		eyebrow = 'YOUR VIDEO';
		title =
			state.stage === 5
				? 'Your Clipisode is ready.'
				: 'Finish your saved video.';
		description =
			state.stage === 5
				? 'Your MP4 is saved. Open your video to download it or share its watch page.'
				: 'Your preview is saved. Continue in the studio to create an MP4 and share it.';
	}
	return (
		<section className="clipisode-next-step" aria-label="Next step">
			<div>
				<span className="clipisode-eyebrow">{ eyebrow }</span>
				<h2>{ title }</h2>
				<p>{ description }</p>
				<div className="clipisode-action-row">
					{ saved && (
						<Button
							variant="primary"
							href={ `admin.php?page=clipisode-clipisodes#/compose/${ saved.id }` }
						>
							{ state.stage === 5
								? 'View your video'
								: 'Continue saved video' }
						</Button>
					) }
					{ ready.length > 0 && (
						<Button
							variant={ saved ? 'secondary' : 'primary' }
							onClick={ compose }
						>
							{ saved ? 'Make another video' : 'Make your video' }{ ' ' }
							({ ready.length })
						</Button>
					) }
					{ pending && (
						<Button
							variant={ ready.length ? 'secondary' : 'primary' }
							onClick={ () => review( pending ) }
						>
							Review replies
						</Button>
					) }
					<Button
						variant="secondary"
						onClick={ refresh }
						disabled={ busy }
					>
						Check for replies
					</Button>
				</div>
			</div>
			<div className="clipisode-invite-card">
				<strong>Your invitation link</strong>
				{ open ? (
					<>
						<label
							className="screen-reader-text"
							htmlFor="clipisode-share-url"
						>
							Invitation URL
						</label>
						<input
							id="clipisode-share-url"
							readOnly
							value={ open.share_url }
							onFocus={ ( event ) => event.target.select() }
						/>
						<div className="clipisode-action-row">
							<Button
								variant="secondary"
								onClick={ async () => {
									setError( '' );
									setCopied( false );
									try {
										await navigator.clipboard.writeText(
											open.share_url
										);
										setCopied( true );
									} catch {
										setError(
											'Could not copy the link. Select and copy the URL above.'
										);
									}
								} }
							>
								Copy invitation link
							</Button>
							<Button
								variant="tertiary"
								href={ open.share_url }
								target="_blank"
								rel="noreferrer"
							>
								Open invitation ↗
							</Button>
						</div>
						<p role="status">
							{ copied
								? 'Invitation link copied.'
								: 'Guests can record or upload a video. This opens in a new tab.' }
						</p>
					</>
				) : (
					<>
						<p>
							All invitations are closed, or there is no link yet.
							Create an open invitation when you’re ready to
							collect replies.
						</p>
						<Button
							variant="secondary"
							disabled={ busy }
							onClick={ createLink }
						>
							Create invitation link
						</Button>
					</>
				) }
				{ error && (
					<Notice status="error" isDismissible={ false }>
						{ error }
					</Notice>
				) }
			</div>
		</section>
	);
}
