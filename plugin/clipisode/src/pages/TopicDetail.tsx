import { useState, useEffect, useCallback } from '@wordpress/element';
import { Button, Modal, Spinner } from '@wordpress/components';
import apiFetch from '@wordpress/api-fetch';
import ReplyModal from '../components/ReplyModal';
import type { Topic, InvitationLink, Reply } from '../types';

function formatBytes( bytes: number | null ): string {
	if ( ! bytes ) {
		return '—';
	}
	if ( bytes < 1024 ) {
		return `${ bytes } B`;
	}
	if ( bytes < 1048576 ) {
		return `${ ( bytes / 1024 ).toFixed( 1 ) } KB`;
	}
	return `${ ( bytes / 1048576 ).toFixed( 1 ) } MB`;
}

interface TopicDetailProps {
	id: string;
	navigate: ( path: string | number ) => void;
}

export default function TopicDetail( { id, navigate }: TopicDetailProps ) {
	const [ topic, setTopic ] = useState< Topic | null >( null );
	const [ links, setLinks ] = useState< InvitationLink[] >( [] );
	const [ replies, setReplies ] = useState< Reply[] >( [] );
	const [ loading, setLoading ] = useState< boolean >( true );
	const [ deleting, setDeleting ] = useState< boolean >( false );
	const [ copiedId, setCopiedId ] = useState< number | null >( null );
	const [ editingSlug, setEditingSlug ] = useState<
		Record< number, string >
	>( {} );
	const [ slugError, setSlugError ] = useState< Record< number, string > >(
		{}
	);
	const [ savingSlug, setSavingSlug ] = useState< Record< number, boolean > >(
		{}
	);
	const [ selectedReply, setSelectedReply ] = useState< Reply | null >(
		null
	);
	const [ selectedReplyIds, setSelectedReplyIds ] = useState< Set< number > >(
		new Set()
	);
	const [ previewOutput, setPreviewOutput ] = useState< {
		name: string;
		url: string;
	} | null >( null );

	const deleteOutput = ( outputId: number, name: string ) => {
		if (
			! window.confirm(
				`Delete "${ name }"? The video will be permanently removed.`
			)
		) {
			return;
		}
		apiFetch( {
			path: `/clipisode/v1/outputs/${ outputId }`,
			method: 'DELETE',
		} ).then( () => {
			setTopic( ( prev ) => {
				if ( ! prev ) {
					return prev;
				}
				return {
					...prev,
					outputs: prev.outputs.filter( ( o ) => o.id !== outputId ),
				};
			} );
		} );
	};

	const load = useCallback( () => {
		Promise.all( [
			apiFetch< Topic >( { path: `/clipisode/v1/topics/${ id }` } ),
			apiFetch< InvitationLink[] >( {
				path: `/clipisode/v1/topics/${ id }/invitation-links`,
			} ),
			apiFetch< Reply[] >( {
				path: `/clipisode/v1/replies?topic_id=${ id }`,
			} ),
		] )
			.then( ( [ t, l, cl ] ) => {
				setTopic( t );
				setLinks( l );
				setReplies( cl );
				setSelectedReplyIds(
					new Set(
						cl
							.filter(
								( r ) => r.status === 'approved' && r.media_id
							)
							.map( ( r ) => r.id )
					)
				);
			} )
			.finally( () => setLoading( false ) );
	}, [ id ] );

	useEffect( () => {
		load();
	}, [ load ] );

	const createLink = () => {
		apiFetch< InvitationLink >( {
			path: `/clipisode/v1/topics/${ id }/invitation-links`,
			method: 'POST',
		} ).then( ( newLink ) => {
			setLinks( ( prev ) => [ newLink, ...prev ] );
		} );
	};

	const toggleLinkStatus = ( link: InvitationLink ) => {
		const newStatus = link.status === 'open' ? 'closed' : 'open';
		apiFetch< InvitationLink >( {
			path: `/clipisode/v1/invitation-links/${ link.id }`,
			method: 'PUT',
			data: { status: newStatus },
		} ).then( ( updated ) => {
			setLinks( ( prev ) =>
				prev.map( ( l ) => ( l.id === updated.id ? updated : l ) )
			);
		} );
	};

	const saveSlug = async ( link: InvitationLink ) => {
		const newSlug = editingSlug[ link.id ];
		if ( ! newSlug || newSlug === link.slug ) {
			setEditingSlug( ( prev ) => {
				const n = { ...prev };
				delete n[ link.id ];
				return n;
			} );
			return;
		}
		setSavingSlug( ( prev ) => ( { ...prev, [ link.id ]: true } ) );
		setSlugError( ( prev ) => {
			const n = { ...prev };
			delete n[ link.id ];
			return n;
		} );
		try {
			const updated = await apiFetch< InvitationLink >( {
				path: `/clipisode/v1/invitation-links/${ link.id }`,
				method: 'PUT',
				data: { slug: newSlug },
			} );
			setLinks( ( prev ) =>
				prev.map( ( l ) => ( l.id === updated.id ? updated : l ) )
			);
			setEditingSlug( ( prev ) => {
				const n = { ...prev };
				delete n[ link.id ];
				return n;
			} );
		} catch ( err: unknown ) {
			const message =
				err instanceof Error
					? err.message
					: ( err as { message?: string } )?.message ||
					  'Slug update failed.';
			setSlugError( ( prev ) => ( { ...prev, [ link.id ]: message } ) );
		} finally {
			setSavingSlug( ( prev ) => ( { ...prev, [ link.id ]: false } ) );
		}
	};

	const copyLinkUrl = ( link: InvitationLink ) => {
		const prefix = window.clipisodeAdmin?.invitation_prefix || 'invitation';
		const url = `${ window.location.origin }/${ prefix }/${ link.slug }`;
		navigator.clipboard.writeText( url );
		setCopiedId( link.id );
		setTimeout(
			() => setCopiedId( ( prev ) => ( prev === link.id ? null : prev ) ),
			3000
		);
	};

	const deleteTopic = () => {
		if (
			! window.confirm(
				'Delete this topic and all its replies? This cannot be undone.'
			)
		) {
			return;
		}
		setDeleting( true );
		apiFetch( { path: `/clipisode/v1/topics/${ id }`, method: 'DELETE' } )
			.then( () => navigate( '' ) )
			.finally( () => setDeleting( false ) );
	};

	const onReplyUpdated = ( updatedReply: Reply ) => {
		setReplies( ( prev ) =>
			prev.map( ( r ) => ( r.id === updatedReply.id ? updatedReply : r ) )
		);
		setSelectedReply( null );
	};

	if ( loading ) {
		return (
			<div className="clipisode-spinner-wrap">
				<Spinner />
			</div>
		);
	}

	if ( ! topic ) {
		return <div className="clipisode-empty">Topic not found.</div>;
	}

	const approvedCount = replies.filter(
		( r ) => r.status === 'approved'
	).length;

	return (
		<>
			<div className="clipisode-detail-header">
				<a
					className="clipisode-back-link"
					onClick={ () => navigate( '' ) }
				>
					← All Topics
				</a>
				<div className="clipisode-detail-header-row">
					<h1>{ topic.title }</h1>
					<div className="clipisode-detail-header-actions">
						<Button
							variant="primary"
							onClick={ () => navigate( `${ id }/edit` ) }
						>
							Edit Topic
						</Button>
						{ Number( topic.replies_count ) === 0 && (
							<Button
								variant="tertiary"
								isDestructive
								onClick={ deleteTopic }
								isBusy={ deleting }
								disabled={ deleting }
							>
								Delete
							</Button>
						) }
					</div>
				</div>
			</div>

			<div className="clipisode-detail-grid">
				<div className="clipisode-detail-main">
					<div className="clipisode-stats-row">
						<div className="clipisode-stat-card">
							<span className="clipisode-stat-value">
								{ Number( topic.clicks ).toLocaleString() }
							</span>
							<span className="clipisode-stat-label">Clicks</span>
						</div>
						<div className="clipisode-stat-card">
							<span className="clipisode-stat-value">
								{ Number(
									topic.replies_count
								).toLocaleString() }
							</span>
							<span className="clipisode-stat-label">
								Replies
							</span>
						</div>
						<div className="clipisode-stat-card">
							<span className="clipisode-stat-value">
								{ links.length.toLocaleString() }
							</span>
							<span className="clipisode-stat-label">Links</span>
						</div>
						<div className="clipisode-stat-card">
							<span className="clipisode-stat-value">
								{ approvedCount.toLocaleString() }
							</span>
							<span className="clipisode-stat-label">
								Approved
							</span>
						</div>
					</div>

					<div className="clipisode-section">
						<div className="clipisode-section-header">
							<h2>Invitation Links</h2>
							<Button
								variant="secondary"
								size="compact"
								onClick={ createLink }
							>
								New Link
							</Button>
						</div>

						{ links.length === 0 ? (
							<div className="clipisode-empty-section">
								<p>
									No invitation links yet. Create one to start
									collecting replies.
								</p>
							</div>
						) : (
							<table className="clipisode-table">
								<thead>
									<tr>
										<th>Slug</th>
										<th>Status</th>
										<th>Clicks</th>
										<th>Replies</th>
										<th>Created</th>
										<th></th>
									</tr>
								</thead>
								<tbody>
									{ links.map( ( link ) => (
										<tr key={ link.id }>
											<td>
												{ editingSlug[ link.id ] !==
												undefined ? (
													<span className="clipisode-slug-edit">
														<input
															type="text"
															value={
																editingSlug[
																	link.id
																]
															}
															maxLength={ 20 }
															onChange={ ( e ) =>
																setEditingSlug(
																	(
																		prev
																	) => ( {
																		...prev,
																		[ link.id ]:
																			e
																				.target
																				.value,
																	} )
																)
															}
															onKeyDown={ (
																e
															) => {
																if (
																	e.key ===
																	'Enter'
																) {
																	saveSlug(
																		link
																	);
																}
																if (
																	e.key ===
																	'Escape'
																) {
																	setEditingSlug(
																		(
																			prev
																		) => {
																			const n =
																				{
																					...prev,
																				};
																			delete n[
																				link
																					.id
																			];
																			return n;
																		}
																	);
																}
															} }
															disabled={
																savingSlug[
																	link.id
																]
															}
														/>
														<Button
															variant="tertiary"
															size="compact"
															onClick={ () =>
																saveSlug( link )
															}
															disabled={
																savingSlug[
																	link.id
																]
															}
														>
															{ savingSlug[
																link.id
															]
																? '…'
																: 'Save' }
														</Button>
														<Button
															variant="tertiary"
															size="compact"
															onClick={ () => {
																setEditingSlug(
																	(
																		prev
																	) => {
																		const n =
																			{
																				...prev,
																			};
																		delete n[
																			link
																				.id
																		];
																		return n;
																	}
																);
																setSlugError(
																	(
																		prev
																	) => {
																		const n =
																			{
																				...prev,
																			};
																		delete n[
																			link
																				.id
																		];
																		return n;
																	}
																);
															} }
														>
															Cancel
														</Button>
														{ slugError[
															link.id
														] && (
															<span className="clipisode-slug-error">
																{
																	slugError[
																		link.id
																	]
																}
															</span>
														) }
													</span>
												) : (
													<button
														type="button"
														className="clipisode-slug-btn"
														onClick={ () =>
															setEditingSlug(
																( prev ) => ( {
																	...prev,
																	[ link.id ]:
																		link.slug,
																} )
															)
														}
														title="Click to edit"
													>
														{ link.slug }
													</button>
												) }
											</td>
											<td>
												<span
													className={ `clipisode-status-badge ${ link.status }` }
												>
													{ link.status }
												</span>
											</td>
											<td>
												{ Number(
													link.clicks
												).toLocaleString() }
											</td>
											<td>
												{ Number(
													link.replies_count
												).toLocaleString() }
											</td>
											<td>
												{ new Date(
													link.created_at
												).toLocaleDateString() }
											</td>
											<td className="clipisode-link-actions">
												<Button
													variant="tertiary"
													size="compact"
													onClick={ () =>
														copyLinkUrl( link )
													}
													title={ `${
														window.location.origin
													}/${
														window.clipisodeAdmin
															?.invitation_prefix ||
														'invitation'
													}/${ link.slug }` }
												>
													{ copiedId === link.id
														? 'Copied!'
														: 'Copy URL' }
												</Button>
												<Button
													variant="tertiary"
													size="compact"
													isDestructive={
														link.status === 'open'
													}
													onClick={ () =>
														toggleLinkStatus( link )
													}
												>
													{ link.status === 'open'
														? 'Close'
														: 'Reopen' }
												</Button>
											</td>
										</tr>
									) ) }
								</tbody>
							</table>
						) }
					</div>

					<div className="clipisode-section">
						<div className="clipisode-section-header">
							<h2>Replies</h2>
							{ replies.length > 0 && (
								<Button
									variant="link"
									href={ `admin.php?page=clipisode-replies&topic_id=${ id }` }
								>
									View All ({ replies.length })
								</Button>
							) }
						</div>

						{ replies.length === 0 ? (
							<div className="clipisode-empty-section">
								<p>
									No replies yet. Share an invitation link to
									start collecting video replies.
								</p>
							</div>
						) : (
							<>
								<table className="clipisode-table clipisode-replies-table">
									<thead>
										<tr>
											<th style={ { width: 30 } }></th>
											<th>Name</th>
											<th>Tag</th>
											<th>Status</th>
											<th>Transcript</th>
											<th>Date</th>
										</tr>
									</thead>
									<tbody>
										{ replies
											.slice( 0, 10 )
											.map( ( reply ) => (
												<tr
													key={ reply.id }
													className="clickable"
													onClick={ () =>
														setSelectedReply(
															reply
														)
													}
												>
													<td
														onClick={ ( e ) =>
															e.stopPropagation()
														}
													>
														{ reply.status ===
															'approved' &&
															reply.media_id && (
																<input
																	type="checkbox"
																	checked={ selectedReplyIds.has(
																		reply.id
																	) }
																	onChange={ () => {
																		setSelectedReplyIds(
																			(
																				prev
																			) => {
																				const next =
																					new Set(
																						prev
																					);
																				if (
																					next.has(
																						reply.id
																					)
																				) {
																					next.delete(
																						reply.id
																					);
																				} else {
																					next.add(
																						reply.id
																					);
																				}
																				return next;
																			}
																		);
																	} }
																/>
															) }
													</td>
													<td className="clipisode-reply-name">
														{ reply.name }
													</td>
													<td>
														{ reply.tag || '—' }
													</td>
													<td>
														<span
															className={ `clipisode-status-badge ${ reply.status }` }
														>
															{ reply.status.replace(
																'_',
																' '
															) }
														</span>
													</td>
													<td>
														<div className="clipisode-transcript-preview">
															{ reply.transcript ||
																'—' }
														</div>
													</td>
													<td>
														{ new Date(
															reply.created_at
														).toLocaleDateString() }
													</td>
												</tr>
											) ) }
									</tbody>
								</table>
								{ selectedReplyIds.size > 0 && (
									<div style={ { marginTop: 12 } }>
										<Button
											variant="primary"
											onClick={ () => {
												const mediaIds = replies
													.filter(
														( r ) =>
															selectedReplyIds.has(
																r.id
															) && r.media_id
													)
													.map( ( r ) => r.media_id );
												if ( topic?.intro_media_id ) {
													mediaIds.unshift(
														topic.intro_media_id
													);
												}
												navigate(
													`create-clipisode/${ id }/${ mediaIds.join(
														','
													) }`
												);
											} }
										>
											Create Clipisode (
											{ selectedReplyIds.size } clip
											{ selectedReplyIds.size !== 1
												? 's'
												: '' }
											)
										</Button>
									</div>
								) }
							</>
						) }
					</div>

					<div className="clipisode-section">
						<div className="clipisode-section-header">
							<h2>Clipisodes</h2>
						</div>

						{ topic.outputs && topic.outputs.length > 0 ? (
							<table className="clipisode-table">
								<thead>
									<tr>
										<th>Name</th>
										<th>Clips</th>
										<th>Size</th>
										<th>Created</th>
										<th></th>
									</tr>
								</thead>
								<tbody>
									{ topic.outputs.map( ( o ) => (
										<tr key={ o.id }>
											<td>
												{ o.url ? (
													<button
														type="button"
														style={ {
															background: 'none',
															border: 'none',
															padding: 0,
															color: '#2271b1',
															cursor: 'pointer',
															font: 'inherit',
															textAlign: 'left',
														} }
														onClick={ () =>
															setPreviewOutput( {
																name: o.name,
																url: o.url!,
															} )
														}
													>
														{ o.name }
													</button>
												) : (
													o.name
												) }
											</td>
											<td>{ o.clips_count || '—' }</td>
											<td>
												{ formatBytes( o.file_size ) }
											</td>
											<td>
												{ new Date(
													o.created_at
												).toLocaleDateString() }
											</td>
											<td className="clipisode-link-actions">
												{ o.preview_url && (
													<a
														className="components-button is-tertiary is-compact"
														href={ o.preview_url }
														target="_blank"
														rel="noreferrer"
													>
														Preview
													</a>
												) }
												{ o.url && (
													<a
														className="components-button is-tertiary is-compact"
														href={ o.url }
														download={ `${ o.slug }.mp4` }
													>
														Download
													</a>
												) }
												<Button
													variant="tertiary"
													size="compact"
													isDestructive
													onClick={ () =>
														deleteOutput(
															o.id,
															o.name
														)
													}
												>
													Delete
												</Button>
											</td>
										</tr>
									) ) }
								</tbody>
							</table>
						) : (
							<div className="clipisode-empty-section">
								<p>No clipisodes yet.</p>
							</div>
						) }
					</div>
				</div>

				<aside className="clipisode-detail-sidebar">
					{ topic.intro_video_url && (
						<div className="clipisode-sidebar-card">
							<h3>Intro Video</h3>
							<video
								src={ topic.intro_video_url }
								controls
								playsInline
							/>
						</div>
					) }

					<div className="clipisode-sidebar-card">
						<h3>Details</h3>
						<dl className="clipisode-detail-meta">
							<dt>Created</dt>
							<dd>
								{ new Date(
									topic.created_at
								).toLocaleDateString() }
							</dd>

							<dt>Hosted By</dt>
							<dd>{ topic.hosted_by || '—' }</dd>

							<dt>Theme</dt>
							<dd>
								{ topic.invitation_title ? (
									topic.invitation_edit_url ? (
										<a
											href={ topic.invitation_edit_url }
											target="_blank"
											rel="noreferrer"
										>
											{ topic.invitation_title }
										</a>
									) : (
										topic.invitation_title
									)
								) : (
									'—'
								) }
							</dd>

							<dt>Terms</dt>
							<dd>
								{ topic.brand_terms_url ? (
									<a
										href={ topic.brand_terms_url }
										target="_blank"
										rel="noreferrer"
									>
										{ topic.brand_terms_title }
									</a>
								) : (
									topic.brand_terms_title || '—'
								) }
								{ topic.custom_terms_title && (
									<>
										{ ', ' }
										{ topic.custom_terms_url ? (
											<a
												href={ topic.custom_terms_url }
												target="_blank"
												rel="noreferrer"
											>
												{ topic.custom_terms_title }
											</a>
										) : (
											topic.custom_terms_title
										) }
									</>
								) }
							</dd>
						</dl>
					</div>
				</aside>
			</div>

			{ selectedReply && (
				<ReplyModal
					reply={ selectedReply }
					onClose={ () => setSelectedReply( null ) }
					onUpdated={ onReplyUpdated }
				/>
			) }

			{ previewOutput && (
				<Modal
					title={ previewOutput.name }
					onRequestClose={ () => setPreviewOutput( null ) }
					style={ { maxWidth: '90vw', maxHeight: '90vh' } }
				>
					<video
						src={ previewOutput.url }
						controls
						autoPlay
						playsInline
						style={ {
							display: 'block',
							maxWidth: '100%',
							maxHeight: 'calc(90vh - 120px)',
							borderRadius: 4,
						} }
					/>
				</Modal>
			) }
		</>
	);
}
