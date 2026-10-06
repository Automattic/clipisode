import { useState, useEffect, useRef } from '@wordpress/element';
import {
	Button,
	CheckboxControl,
	Notice,
	Modal,
	Spinner,
	TextControl,
} from '@wordpress/components';
import apiFetch from '@wordpress/api-fetch';
import { crop, copy, trash, arrowUp, arrowDown } from '@wordpress/icons';
import TrimModal from '../components/TrimModal';
import AddMediaModal from '../components/AddMediaModal';
import CompositionControls from '../components/CompositionControls';
import CompositionPreview from '../components/CompositionPreview';
import CompositionExport from '../components/CompositionExport';
import { createDefaultSettings, themePresets } from '../remotion/themes';
import { getVideoDuration } from '../lib/video-metadata';
import type { CompositionClip, CompositionSettings } from '../remotion/types';
import type { Topic, MediaItem, SavedCompositionOutput } from '../types';

interface Props {
	topicId?: number;
	mediaIds?: number[];
	outputId?: number;
	navigate: ( path: string | number ) => void;
}

function formatTime( seconds: number ): string {
	return `${ Math.floor( seconds / 60 ) }:${ ( seconds % 60 )
		.toFixed( 1 )
		.padStart( 4, '0' ) }`;
}

function createClipId(): string {
	return Array.from(
		crypto.getRandomValues( new Uint32Array( 4 ) ),
		( value ) => value.toString( 16 )
	).join( '-' );
}

async function makeClip(
	media: MediaItem,
	topic: Topic | null
): Promise< CompositionClip > {
	if ( ! media.url ) {
		throw new Error( `Media #${ media.id } has no playable URL.` );
	}
	const duration = await getVideoDuration( media.url );
	const intro = Number( topic?.intro_media_id ) === Number( media.id );
	return {
		id: createClipId(),
		mediaId: Number( media.id ),
		role: intro ? 'intro' : 'reply',
		name:
			intro && topic?.hosted_by
				? topic.hosted_by
				: media.used_by?.label ||
				  media.label ||
				  media.path.split( '/' ).pop()!,
		url: media.url,
		duration,
		trimStart: 0,
		trimEnd: duration,
		included: true,
	};
}

export default function CreateClipisode( {
	topicId,
	mediaIds,
	outputId,
	navigate,
}: Props ) {
	const [ topic, setTopic ] = useState< Topic | null >( null );
	const [ currentTopicId, setCurrentTopicId ] = useState< number | null >(
		topicId ?? null
	);
	const [ clips, setClips ] = useState< CompositionClip[] >( [] );
	const [ settings, setSettings ] = useState< CompositionSettings >( () =>
		createDefaultSettings()
	);
	const [ name, setName ] = useState( '' );
	const [ savedId, setSavedId ] = useState< number | undefined >( outputId );
	const [ loading, setLoading ] = useState( true );
	const [ loadError, setLoadError ] = useState( '' );
	const [ error, setError ] = useState( '' );
	const [ saving, setSaving ] = useState( false );
	const [ rendering, setRendering ] = useState( false );
	const [ adding, setAdding ] = useState( false );
	const [ savedSnapshot, setSavedSnapshot ] = useState( '' );
	const [ trimmingClip, setTrimmingClip ] =
		useState< CompositionClip | null >( null );
	const [ showAddMedia, setShowAddMedia ] = useState( false );
	const [ confirmLeave, setConfirmLeave ] = useState( false );
	const [ loadRevision, setLoadRevision ] = useState( 0 );
	const dragIndex = useRef< number | null >( null );
	const mediaKey = mediaIds?.join( ',' ) || '';
	const snapshot = JSON.stringify( { name, clips, settings } );
	const latestSnapshot = useRef( snapshot );
	latestSnapshot.current = snapshot;
	const dirty = ! loading && snapshot !== savedSnapshot;

	useEffect( () => {
		let active = true;
		setLoading( true );
		setLoadError( '' );
		setError( '' );
		const load = async () => {
			try {
				if ( outputId ) {
					const output = await apiFetch< SavedCompositionOutput >( {
						path: `/clipisode/v1/outputs/${ outputId }`,
					} );
					if ( ! output.composition ) {
						throw new Error(
							'This output has no editable composition.'
						);
					}
					const loadedTopic = output.topic_id
						? await apiFetch< Topic >( {
								path: `/clipisode/v1/topics/${ output.topic_id }`,
						  } )
						: null;
					if ( ! active ) {
						return;
					}
					setName( output.name );
					setTopic( loadedTopic );
					setClips( output.composition.clips );
					setSettings( output.composition.settings );
					setSavedId( output.id );
					setCurrentTopicId( output.topic_id );
					setSavedSnapshot(
						JSON.stringify( {
							name: output.name,
							clips: output.composition.clips,
							settings: output.composition.settings,
						} )
					);
				} else {
					const [ media, loadedTopic ] = await Promise.all( [
						mediaKey
							? apiFetch< MediaItem[] >( {
									path: `/clipisode/v1/media?ids=${ mediaKey }`,
							  } )
							: Promise.resolve( [] ),
						topicId
							? apiFetch< Topic >( {
									path: `/clipisode/v1/topics/${ topicId }`,
							  } )
							: Promise.resolve( null ),
					] );
					const byId = new Map(
						media.map( ( item ) => [ Number( item.id ), item ] )
					);
					const selected = mediaKey
						? mediaKey.split( ',' ).map( ( id ) => {
								const item = byId.get( Number( id ) );
								if ( ! item ) {
									throw new Error(
										`Media #${ id } is no longer available.`
									);
								}
								return item;
						  } )
						: [];
					const loadedClips = await Promise.all(
						selected.map( ( item ) =>
							makeClip( item, loadedTopic )
						)
					);
					if ( ! active ) {
						return;
					}
					const themeId = loadedTopic?.invitation_renderer_theme;
					if (
						themeId &&
						! themePresets.some( ( theme ) => theme.id === themeId )
					) {
						throw new Error(
							`Video theme "${ themeId }" is not registered.`
						);
					}
					const initialSettings = createDefaultSettings(
						( themeId ||
							'default' ) as CompositionSettings[ 'themeId' ]
					);
					initialSettings.title = loadedTopic?.title || 'Your story';
					initialSettings.subtitle = loadedTopic?.hosted_by || '';
					setTopic( loadedTopic );
					setName( loadedTopic?.title || 'Untitled Clipisode' );
					setClips( loadedClips );
					setSettings( initialSettings );
				}
			} catch ( caught ) {
				if ( active ) {
					setLoadError( ( caught as Error ).message );
				}
			} finally {
				if ( active ) {
					setLoading( false );
				}
			}
		};
		load();
		return () => {
			active = false;
		};
	}, [ outputId, topicId, mediaKey, loadRevision ] );

	useEffect( () => {
		if ( ! dirty ) {
			return;
		}
		const warn = ( event: BeforeUnloadEvent ) => {
			event.preventDefault();
			event.returnValue = '';
		};
		window.addEventListener( 'beforeunload', warn );
		return () => window.removeEventListener( 'beforeunload', warn );
	}, [ dirty ] );

	const updateClip = ( id: string, patch: Partial< CompositionClip > ) =>
		setClips( ( previous ) =>
			previous.map( ( clip ) =>
				clip.id === id ? { ...clip, ...patch } : clip
			)
		);
	const moveClip = ( from: number, to: number ) =>
		setClips( ( previous ) => {
			const next = [ ...previous ];
			const [ item ] = next.splice( from, 1 );
			next.splice( to, 0, item );
			return next;
		} );
	const addMedia = async ( media: MediaItem[] ) => {
		setShowAddMedia( false );
		setAdding( true );
		setError( '' );
		try {
			const added = await Promise.all(
				media.map( ( item ) => makeClip( item, topic ) )
			);
			setClips( ( previous ) => [ ...previous, ...added ] );
		} catch ( caught ) {
			setError( ( caught as Error ).message );
		} finally {
			setAdding( false );
		}
	};
	const save = async () => {
		setSaving( true );
		setError( '' );
		try {
			const result = await apiFetch< SavedCompositionOutput >( {
				path: savedId
					? `/clipisode/v1/outputs/${ savedId }`
					: '/clipisode/v1/outputs',
				method: savedId ? 'PUT' : 'POST',
				data: {
					name: name.trim(),
					topic_id: currentTopicId,
					composition: { clips, settings },
				},
			} );
			setSavedId( result.id );
			const saved = {
				name: result.name,
				clips: result.composition.clips,
				settings: result.composition.settings,
			};
			setSavedSnapshot( JSON.stringify( saved ) );
			if ( latestSnapshot.current === snapshot ) {
				setName( saved.name );
				setClips( saved.clips );
				setSettings( saved.settings );
			}
			// Keep the editor mounted while giving the saved preview a reloadable URL.
			window.history.replaceState( null, '', `#/compose/${ result.id }` );
		} catch ( caught ) {
			setError( ( caught as Error ).message );
		} finally {
			setSaving( false );
		}
	};
	const goBack = () => {
		if ( currentTopicId ) {
			navigate( currentTopicId );
		} else {
			window.location.href = 'admin.php?page=clipisode-clipisodes';
		}
	};
	if ( loading ) {
		return (
			<div className="clipisode-spinner-wrap">
				<Spinner />
			</div>
		);
	}
	if ( loadError ) {
		return (
			<>
				<Button variant="tertiary" onClick={ goBack }>
					← Back
				</Button>
				<Notice status="error" isDismissible={ false }>
					<p>{ loadError }</p>
					<Button
						variant="secondary"
						onClick={ () => setLoadRevision( loadRevision + 1 ) }
					>
						Retry loading
					</Button>
				</Notice>
			</>
		);
	}
	return (
		<>
			<div className="clipisode-page-header">
				<Button
					variant="tertiary"
					onClick={ () =>
						dirty ? setConfirmLeave( true ) : goBack()
					}
				>
					← { currentTopicId ? 'Back to topic' : 'Clipisodes' }
				</Button>
				<h1>{ savedId ? 'Edit Clipisode' : 'Create Clipisode' }</h1>
				<Button
					variant="primary"
					onClick={ save }
					isBusy={ saving }
					disabled={
						saving ||
						rendering ||
						adding ||
						! name.trim() ||
						! clips.some( ( clip ) => clip.included )
					}
				>
					{ saving ? 'Saving…' : 'Save preview' }
				</Button>
			</div>
			{ error && (
				<Notice status="error" isDismissible={ false }>
					{ error }
				</Notice>
			) }
			{ savedId && (
				<p role="status">
					{ dirty
						? 'Unsaved changes'
						: 'Preview saved. You can reopen it from Clipisodes.' }
				</p>
			) }
			<div className="clipisode-composition-editor">
				<section
					className="clipisode-composition-monitor"
					aria-label="Live preview"
				>
					<CompositionPreview clips={ clips } settings={ settings } />
				</section>
				<aside
					className="clipisode-composition-sidebar"
					aria-label="Theme settings"
				>
					<TextControl
						__next40pxDefaultSize
						label="Clipisode name"
						value={ name }
						onChange={ setName }
					/>
					<CompositionControls
						settings={ settings }
						onChange={ setSettings }
					/>
				</aside>
			</div>
			<CompositionExport
				key={ savedId ?? 'unsaved' }
				outputId={ savedId }
				dirty={ dirty }
				disabled={ saving || adding }
				onRenderingChange={ setRendering }
			/>
			<section className="clipisode-section">
				<div className="clipisode-page-header">
					<h2>
						Clips (
						{ clips.filter( ( clip ) => clip.included ).length })
					</h2>
					<Button
						variant="secondary"
						onClick={ () => setShowAddMedia( true ) }
						disabled={ adding }
					>
						{ adding ? 'Loading media…' : 'Add media' }
					</Button>
				</div>
				<div className="clipisode-composition-clips">
					<table className="clipisode-table">
						<thead>
							<tr>
								<th>Include</th>
								<th>Speaker name</th>
								<th>Role</th>
								<th>Selected range</th>
								<th>Order and edit</th>
							</tr>
						</thead>
						<tbody>
							{ clips.map( ( clip, index ) => (
								<tr
									key={ clip.id }
									draggable
									onDragStart={ () => {
										dragIndex.current = index;
									} }
									onDragOver={ ( event ) =>
										event.preventDefault()
									}
									onDrop={ () => {
										if ( dragIndex.current !== null ) {
											moveClip(
												dragIndex.current,
												index
											);
										}
										dragIndex.current = null;
									} }
									onDragEnd={ () => {
										dragIndex.current = null;
									} }
								>
									<td>
										<CheckboxControl
											label={ `Include clip ${
												index + 1
											}` }
											checked={ clip.included }
											onChange={ ( included ) =>
												updateClip( clip.id, {
													included,
												} )
											}
										/>
									</td>
									<td>
										<TextControl
											__next40pxDefaultSize
											label={ `Speaker for clip ${
												index + 1
											}` }
											hideLabelFromVision
											value={ clip.name }
											onChange={ ( value ) =>
												updateClip( clip.id, {
													name: value,
												} )
											}
										/>
									</td>
									<td>{ clip.role }</td>
									<td>
										{ formatTime( clip.trimStart ) } –{ ' ' }
										{ formatTime( clip.trimEnd ) }
									</td>
									<td>
										<div className="clipisode-composition-clip-actions">
											<Button
												icon={ arrowUp }
												label="Move earlier"
												size="compact"
												disabled={ index === 0 }
												onClick={ () =>
													moveClip( index, index - 1 )
												}
											/>
											<Button
												icon={ arrowDown }
												label="Move later"
												size="compact"
												disabled={
													index === clips.length - 1
												}
												onClick={ () =>
													moveClip( index, index + 1 )
												}
											/>
											<Button
												icon={ crop }
												label="Trim"
												size="compact"
												onClick={ () =>
													setTrimmingClip( clip )
												}
											/>
											<Button
												icon={ copy }
												label="Duplicate"
												size="compact"
												onClick={ () =>
													setClips( ( previous ) => [
														...previous.slice(
															0,
															index + 1
														),
														{
															...clip,
															id: createClipId(),
														},
														...previous.slice(
															index + 1
														),
													] )
												}
											/>
											<Button
												icon={ trash }
												label="Remove"
												size="compact"
												isDestructive
												onClick={ () =>
													setClips( ( previous ) =>
														previous.filter(
															( item ) =>
																item.id !==
																clip.id
														)
													)
												}
											/>
										</div>
									</td>
								</tr>
							) ) }
						</tbody>
					</table>
				</div>
			</section>
			{ confirmLeave && (
				<Modal
					title="Unsaved preview changes"
					onRequestClose={ () => setConfirmLeave( false ) }
				>
					<p>Leave without saving your preview changes?</p>
					<Button
						variant="secondary"
						onClick={ () => setConfirmLeave( false ) }
					>
						Keep editing
					</Button>
					<Button variant="primary" isDestructive onClick={ goBack }>
						Leave without saving
					</Button>
				</Modal>
			) }

			{ trimmingClip && (
				<TrimModal
					url={ trimmingClip.url }
					name={ trimmingClip.name }
					duration={ trimmingClip.duration }
					initialStart={ trimmingClip.trimStart }
					initialEnd={ trimmingClip.trimEnd }
					onDone={ ( trimStart, trimEnd ) => {
						updateClip( trimmingClip.id, { trimStart, trimEnd } );
						setTrimmingClip( null );
					} }
					onClose={ () => setTrimmingClip( null ) }
				/>
			) }
			{ showAddMedia && (
				<AddMediaModal
					existingMediaIds={ clips.map( ( clip ) => clip.mediaId ) }
					topicId={ currentTopicId ?? undefined }
					onAdd={ addMedia }
					onClose={ () => setShowAddMedia( false ) }
				/>
			) }
		</>
	);
}
