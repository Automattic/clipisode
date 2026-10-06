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
import ThemeFields from '../components/ThemeFields';
import CompositionPreview from '../components/CompositionPreview';
import CompositionExport from '../components/CompositionExport';
import {
	changeTheme,
	createClipValues,
	createDefaultSettings,
	getThemeDefinition,
	getVisibleGroups,
	themeDefinitions,
	validateThemeValues,
} from '../remotion/theme-schema';
import { buildTimeline } from '../remotion/timeline';
import { getVideoDuration } from '../lib/video-metadata';
import type {
	CompositionClip,
	CompositionSettings,
	ThemeTag,
} from '../remotion/types';
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
	topic: Topic | null,
	themeId: string
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
		tags: [],
		values: createClipValues( themeId ),
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
	const [ pendingHref, setPendingHref ] = useState< string | null >( null );
	const [ loadRevision, setLoadRevision ] = useState( 0 );
	const [ selectedClipId, setSelectedClipId ] = useState< string | null >(
		null
	);
	const [ inspectorTab, setInspectorTab ] = useState<
		'theme' | 'clip' | 'export'
	>( 'theme' );
	const dragIndex = useRef< number | null >( null );
	const allowUnload = useRef( false );
	const mediaKey = mediaIds?.join( ',' ) || '';
	const snapshot = JSON.stringify( { name, clips, settings } );
	const latestSnapshot = useRef( snapshot );
	latestSnapshot.current = snapshot;
	const latestSettings = useRef( settings );
	latestSettings.current = settings;
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
					setSelectedClipId(
						output.composition.clips[ 0 ]?.id ?? null
					);
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
							makeClip(
								item,
								loadedTopic,
								loadedTopic?.invitation_renderer_theme ||
									'default'
							)
						)
					);
					if ( ! active ) {
						return;
					}
					const themeId = loadedTopic?.invitation_renderer_theme;
					if (
						themeId &&
						! themeDefinitions.some(
							( theme ) => theme.id === themeId
						)
					) {
						throw new Error(
							`Video theme "${ themeId }" is not registered.`
						);
					}
					const initialSettings = createDefaultSettings(
						( themeId ||
							'default' ) as CompositionSettings[ 'themeId' ]
					);
					if ( 'title' in initialSettings ) {
						initialSettings.title =
							loadedTopic?.title || 'Your story';
					}
					if ( 'subtitle' in initialSettings ) {
						initialSettings.subtitle = loadedTopic?.hosted_by || '';
					}
					setTopic( loadedTopic );
					setName( loadedTopic?.title || 'Untitled Clipisode' );
					setClips( loadedClips );
					setSelectedClipId( loadedClips[ 0 ]?.id ?? null );
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
			if ( allowUnload.current ) {
				return;
			}
			event.preventDefault();
			event.returnValue = '';
		};
		window.addEventListener( 'beforeunload', warn );
		return () => window.removeEventListener( 'beforeunload', warn );
	}, [ dirty ] );

	useEffect( () => {
		if ( ! dirty ) {
			return;
		}
		const handleSidebarClick = ( event: MouseEvent ) => {
			if (
				event.defaultPrevented ||
				event.button !== 0 ||
				event.metaKey ||
				event.ctrlKey ||
				event.shiftKey ||
				event.altKey ||
				! ( event.target instanceof Element )
			) {
				return;
			}
			const link =
				event.target.closest< HTMLAnchorElement >(
					'#adminmenu a[href]'
				);
			if ( ! link || link.target === '_blank' ) {
				return;
			}
			event.preventDefault();
			setPendingHref( link.href );
			setConfirmLeave( true );
		};
		document.addEventListener( 'click', handleSidebarClick );
		return () =>
			document.removeEventListener( 'click', handleSidebarClick );
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
				media.map( ( item ) =>
					makeClip( item, topic, settings.themeId )
				)
			);
			for ( const clip of added ) {
				clip.values = createClipValues(
					latestSettings.current.themeId
				);
			}
			setClips( ( previous ) => [ ...previous, ...added ] );
			if ( added.length ) {
				setSelectedClipId( added[ 0 ].id );
				setInspectorTab( 'clip' );
			}
		} catch ( caught ) {
			setError( ( caught as Error ).message );
		} finally {
			setAdding( false );
		}
	};
	const theme = getThemeDefinition( settings.themeId );
	const validationErrors = validateThemeValues( theme, settings, clips );
	try {
		if ( buildTimeline( clips, settings ).durationInFrames === 0 ) {
			validationErrors.push(
				'Include a sequence clip or enable a title or ending card.'
			);
		}
	} catch ( caught ) {
		validationErrors.push( ( caught as Error ).message );
	}
	const selectedIndex = clips.findIndex(
		( clip ) => clip.id === selectedClipId
	);
	const selectedClip = clips[ selectedIndex ];
	const selectClip = ( id: string ) => {
		setSelectedClipId( id );
		setInspectorTab( 'clip' );
	};
	const chooseTheme = ( themeId: string ) => {
		const next = changeTheme( settings, clips, themeId );
		setSettings( next.settings );
		setClips( next.clips );
	};
	const toggleTag = ( tag: ThemeTag, checked: boolean ) => {
		if ( ! selectedClip ) {
			return;
		}
		let tags = ( selectedClip.tags || [] ).filter(
			( id ) => id !== tag.id
		);
		if ( checked ) {
			if ( tag.exclusiveGroup ) {
				tags = tags.filter(
					( id ) =>
						theme.tags.find( ( item ) => item.id === id )
							?.exclusiveGroup !== tag.exclusiveGroup
				);
			}
			tags.push( tag.id );
		}
		updateClip( selectedClip.id, { tags } );
	};
	const duplicateClip = () => {
		if ( ! selectedClip ) {
			return;
		}
		const duplicate = {
			...selectedClip,
			id: createClipId(),
			tags: [ ...( selectedClip.tags || [] ) ],
			values: { ...selectedClip.values },
		};
		setClips( [
			...clips.slice( 0, selectedIndex + 1 ),
			duplicate,
			...clips.slice( selectedIndex + 1 ),
		] );
		setSelectedClipId( duplicate.id );
	};
	const removeClip = () => {
		if ( ! selectedClip ) {
			return;
		}
		setClips( clips.filter( ( clip ) => clip.id !== selectedClip.id ) );
		setSelectedClipId(
			clips[ selectedIndex + 1 ]?.id ??
				clips[ selectedIndex - 1 ]?.id ??
				null
		);
	};
	const save = async (): Promise< boolean > => {
		if ( validationErrors.length ) {
			return false;
		}
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
			return true;
		} catch ( caught ) {
			setError( ( caught as Error ).message );
			return false;
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
	const requestLeave = () => {
		setPendingHref( null );
		setConfirmLeave( true );
	};
	const cancelLeave = () => {
		setConfirmLeave( false );
		setPendingHref( null );
	};
	const leave = () => {
		allowUnload.current = true;
		if ( pendingHref ) {
			window.location.assign( pendingHref );
		} else {
			goBack();
		}
	};
	const cannotSave =
		saving ||
		rendering ||
		adding ||
		! name.trim() ||
		! clips.some( ( clip ) => clip.included ) ||
		validationErrors.length > 0;
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
		<div className="clipisode-studio">
			<header className="clipisode-studio-header">
				<Button
					variant="tertiary"
					onClick={ dirty ? requestLeave : goBack }
				>
					← { currentTopicId ? 'Back to topic' : 'Clipisodes' }
				</Button>
				<div className="clipisode-studio-identity">
					<h1>Clipisode studio</h1>
					<TextControl
						__next40pxDefaultSize
						label="Clipisode name"
						hideLabelFromVision
						value={ name }
						onChange={ setName }
					/>
				</div>
				<div className="clipisode-studio-save">
					<span role="status">
						{ dirty
							? 'Unsaved changes'
							: 'Preview saved. You can reopen it from Clipisodes.' }
					</span>
					<Button
						variant="primary"
						onClick={ save }
						isBusy={ saving }
						disabled={ cannotSave }
					>
						{ saving ? 'Saving…' : 'Save preview' }
					</Button>
				</div>
			</header>
			{ error && (
				<Notice status="error" isDismissible={ false }>
					{ error }
				</Notice>
			) }
			<div className="clipisode-studio-workspace">
				<aside
					className="clipisode-studio-library"
					aria-label="Clip library"
				>
					<div className="clipisode-studio-panel-heading">
						<h2>
							Clips <span>{ clips.length }</span>
						</h2>
						<Button
							variant="secondary"
							size="compact"
							onClick={ () => setShowAddMedia( true ) }
							disabled={ adding }
						>
							{ adding ? 'Loading…' : 'Add media' }
						</Button>
					</div>
					<p className="clipisode-studio-panel-help">
						Select a clip to edit. Drag to reorder.
					</p>
					<ol className="clipisode-studio-clip-list">
						{ clips.map( ( clip, index ) => (
							<li
								key={ clip.id }
								className={ `${
									selectedClipId === clip.id
										? 'is-selected'
										: ''
								} ${ clip.included ? '' : 'is-excluded' }` }
								draggable
								onDragStart={ () => {
									dragIndex.current = index;
								} }
								onDragOver={ ( event ) =>
									event.preventDefault()
								}
								onDrop={ ( event ) => {
									event.preventDefault();
									if ( dragIndex.current !== null ) {
										moveClip( dragIndex.current, index );
									}
									dragIndex.current = null;
								} }
								onDragEnd={ () => {
									dragIndex.current = null;
								} }
							>
								<button
									type="button"
									className="clipisode-studio-clip-select"
									onClick={ () => selectClip( clip.id ) }
									aria-pressed={ selectedClipId === clip.id }
									aria-label={ `Select clip ${ index + 1 }: ${
										clip.name
									}` }
								>
									<div className="clipisode-studio-thumbnail">
										<video
											src={ clip.url }
											muted
											playsInline
											preload="metadata"
											aria-hidden="true"
										/>
										<span>{ index + 1 }</span>
									</div>
									<div className="clipisode-studio-clip-summary">
										<strong>{ clip.name }</strong>
										<span>
											{ formatTime(
												clip.trimEnd - clip.trimStart
											) }{ ' ' }
											· { clip.role }
										</span>
										{ ( clip.tags || [] ).length > 0 && (
											<span className="clipisode-studio-tag-summary">
												{ clip
													.tags!.map(
														( id ) =>
															theme.tags.find(
																( tag ) =>
																	tag.id ===
																	id
															)?.label || id
													)
													.join( ' · ' ) }
											</span>
										) }
									</div>
								</button>
								<CheckboxControl
									label={ `Include clip ${ index + 1 }` }
									checked={ clip.included }
									onChange={ ( included ) =>
										updateClip( clip.id, { included } )
									}
								/>
							</li>
						) ) }
					</ol>
					{ ! clips.length && (
						<p className="clipisode-empty">
							Add a video to start your story.
						</p>
					) }
				</aside>
				<main
					className="clipisode-studio-monitor"
					aria-label="Live preview"
				>
					<div className="clipisode-studio-preview-heading">
						<span>PREVIEW</span>
						<span>
							{ clips.filter( ( clip ) => clip.included ).length }{ ' ' }
							clips included
						</span>
					</div>
					<CompositionPreview
						clips={ clips }
						settings={ settings }
						selectedClipId={ selectedClipId }
						onSelectClip={ selectClip }
					/>
				</main>
				<aside
					className="clipisode-studio-inspector"
					aria-label="Inspector"
				>
					<div
						className="clipisode-studio-tabs"
						role="tablist"
						aria-label="Inspector panels"
					>
						{ ( [ 'theme', 'clip', 'export' ] as const ).map(
							( tab, index, tabs ) => (
								<button
									key={ tab }
									id={ `inspector-tab-${ tab }` }
									type="button"
									role="tab"
									aria-selected={ inspectorTab === tab }
									aria-controls={ `inspector-panel-${ tab }` }
									tabIndex={ inspectorTab === tab ? 0 : -1 }
									onClick={ () => setInspectorTab( tab ) }
									onKeyDown={ ( event ) => {
										let direction = 0;
										if ( event.key === 'ArrowRight' ) {
											direction = 1;
										} else if (
											event.key === 'ArrowLeft'
										) {
											direction = -1;
										}
										if ( direction ) {
											event.preventDefault();
											const next =
												tabs[
													( index +
														direction +
														tabs.length ) %
														tabs.length
												];
											setInspectorTab( next );
											document
												.getElementById(
													`inspector-tab-${ next }`
												)
												?.focus();
										}
									} }
								>
									{
										{
											theme: 'Theme',
											clip: 'Clip',
											export: 'Export',
										}[ tab ]
									}
								</button>
							)
						) }
					</div>
					<div
						id="inspector-panel-theme"
						role="tabpanel"
						aria-labelledby="inspector-tab-theme"
						hidden={ inspectorTab !== 'theme' }
						className="clipisode-studio-inspector-panel"
					>
						<CompositionControls
							settings={ settings }
							clips={ clips }
							onChange={ setSettings }
							onThemeChange={ chooseTheme }
						/>
					</div>
					<div
						id="inspector-panel-clip"
						role="tabpanel"
						aria-labelledby="inspector-tab-clip"
						hidden={ inspectorTab !== 'clip' }
						className="clipisode-studio-inspector-panel"
					>
						{ selectedClip ? (
							<>
								<div className="clipisode-studio-selected-heading">
									<h2>Clip { selectedIndex + 1 }</h2>
									<span>{ selectedClip.role }</span>
								</div>
								<TextControl
									__next40pxDefaultSize
									label={ `Speaker for clip ${
										selectedIndex + 1
									}` }
									value={ selectedClip.name }
									onChange={ ( value ) =>
										updateClip( selectedClip.id, {
											name: value,
										} )
									}
								/>
								<div className="clipisode-studio-trim">
									<div>
										<span>Selected range</span>
										<strong>
											{ formatTime(
												selectedClip.trimStart
											) }{ ' ' }
											–{ ' ' }
											{ formatTime(
												selectedClip.trimEnd
											) }
										</strong>
									</div>
									<Button
										icon={ crop }
										variant="secondary"
										onClick={ () =>
											setTrimmingClip( selectedClip )
										}
									>
										Trim
									</Button>
								</div>
								<div className="clipisode-composition-clip-actions">
									<Button
										icon={ arrowUp }
										label="Move earlier"
										size="compact"
										disabled={ selectedIndex === 0 }
										onClick={ () =>
											moveClip(
												selectedIndex,
												selectedIndex - 1
											)
										}
									/>
									<Button
										icon={ arrowDown }
										label="Move later"
										size="compact"
										disabled={
											selectedIndex === clips.length - 1
										}
										onClick={ () =>
											moveClip(
												selectedIndex,
												selectedIndex + 1
											)
										}
									/>
									<Button
										icon={ copy }
										label="Duplicate"
										size="compact"
										onClick={ duplicateClip }
									/>
									<Button
										icon={ trash }
										label="Remove"
										size="compact"
										isDestructive
										onClick={ removeClip }
									/>
								</div>
								{ theme.tags.some(
									( tag ) =>
										! tag.roles ||
										tag.roles.includes( selectedClip.role )
								) && (
									<fieldset className="clipisode-field-group">
										<legend>Clip tags</legend>
										{ theme.tags
											.filter(
												( tag ) =>
													! tag.roles ||
													tag.roles.includes(
														selectedClip.role
													)
											)
											.map( ( tag ) => {
												const checked =
													selectedClip.tags?.includes(
														tag.id
													) || false;
												const atLimit =
													! checked &&
													tag.maxClips !==
														undefined &&
													clips.filter(
														( clip ) =>
															clip.tags?.includes(
																tag.id
															)
													).length >= tag.maxClips;
												return (
													<CheckboxControl
														key={ tag.id }
														label={ tag.label }
														checked={ checked }
														disabled={ atLimit }
														help={
															atLimit
																? `Limited to ${
																		tag.maxClips
																  } clip${
																		tag.maxClips ===
																		1
																			? ''
																			: 's'
																  }. Remove this tag from another clip first.`
																: tag.description
														}
														onChange={ ( next ) =>
															toggleTag(
																tag,
																next
															)
														}
													/>
												);
											} ) }
									</fieldset>
								) }
								<ThemeFields
									groups={ getVisibleGroups(
										theme,
										'clip',
										settings,
										selectedClip
									) }
									values={ selectedClip.values || {} }
									clips={ clips }
									idPrefix={ `clip-${ selectedClip.id }` }
									onChange={ ( values ) =>
										updateClip( selectedClip.id, {
											values,
										} )
									}
								/>
							</>
						) : (
							<p className="clipisode-empty">
								Select a clip from the library to edit its
								details.
							</p>
						) }
					</div>
					<div
						id="inspector-panel-export"
						role="tabpanel"
						aria-labelledby="inspector-tab-export"
						hidden={ inspectorTab !== 'export' }
						className="clipisode-studio-inspector-panel"
					>
						<CompositionExport
							key={ savedId ?? 'unsaved' }
							outputId={ savedId }
							dirty={ dirty }
							disabled={
								saving || adding || validationErrors.length > 0
							}
							onRenderingChange={ setRendering }
						/>
					</div>
					{ validationErrors.length > 0 && (
						<Notice status="warning" isDismissible={ false }>
							<p>Complete these fields before saving:</p>
							<ul>
								{ validationErrors.map( ( message, index ) => (
									<li key={ index }>{ message }</li>
								) ) }
							</ul>
						</Notice>
					) }
				</aside>
			</div>
			{ confirmLeave && (
				<Modal
					title="Unsaved preview changes"
					className="clipisode-leave-modal"
					onRequestClose={ cancelLeave }
				>
					<p>Save your preview changes before leaving?</p>
					{ error && (
						<Notice status="error" isDismissible={ false }>
							{ error }
						</Notice>
					) }
					<div className="clipisode-leave-modal-actions">
						<Button variant="secondary" onClick={ cancelLeave }>
							Keep editing
						</Button>
						<Button
							variant="secondary"
							isDestructive
							onClick={ leave }
						>
							Leave without saving
						</Button>
						<Button
							variant="primary"
							disabled={ cannotSave }
							onClick={ async () => {
								if ( await save() ) {
									leave();
								}
							} }
						>
							{ saving ? 'Saving…' : 'Save and leave' }
						</Button>
					</div>
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
		</div>
	);
}
