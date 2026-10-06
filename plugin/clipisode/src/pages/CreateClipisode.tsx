import { useState, useEffect, useRef } from '@wordpress/element';
import {
	Button,
	CheckboxControl,
	Notice,
	Modal,
	SelectControl,
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
import CompositionSequence from '../components/CompositionSequence';
import CompositionExport from '../components/CompositionExport';
import {
	assignClipsToSlots,
	changeTheme,
	createClipValues,
	createDefaultSettings,
	getThemeDefinition,
	getMediaSlot,
	clipsInSlot,
	canMoveClipToSlot,
	moveClipToSlot,
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
	const [ addingToSlot, setAddingToSlot ] = useState< string | null >( null );
	const [ previewFrame, setPreviewFrame ] = useState< {
		frame: number;
	} | null >( null );
	const [ confirmLeave, setConfirmLeave ] = useState( false );
	const [ pendingHref, setPendingHref ] = useState< string | null >( null );
	const [ loadRevision, setLoadRevision ] = useState( 0 );
	const [ selectedClipId, setSelectedClipId ] = useState< string | null >(
		null
	);
	const [ inspectorTab, setInspectorTab ] = useState<
		'theme' | 'clip' | 'export'
	>( 'theme' );
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
					const loadedClips = output.composition.clips.filter(
						( clip ) => clip.included
					);
					setClips( loadedClips );
					setSelectedClipId( loadedClips[ 0 ]?.id ?? null );
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
					const assignedClips = assignClipsToSlots(
						getThemeDefinition( initialSettings.themeId ),
						loadedClips
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
					setClips( assignedClips );
					setSelectedClipId( assignedClips[ 0 ]?.id ?? null );
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
	const moveClip = (
		clipId: string,
		slotId: string,
		targetClipId?: string,
		after = false
	) => {
		const currentSettings = latestSettings.current;
		const currentTheme = getThemeDefinition( currentSettings.themeId );
		const next = moveClipToSlot(
			currentTheme,
			clips,
			clipId,
			slotId,
			targetClipId,
			after
		);
		if ( next === clips ) {
			return;
		}
		setClips( next );
		const backgroundField = currentTheme.timeline.backgroundField;
		const backgroundClipId = backgroundField
			? currentSettings[ backgroundField ]
			: null;
		if (
			backgroundField &&
			typeof backgroundClipId === 'string' &&
			getMediaSlot(
				currentTheme,
				next.find( ( clip ) => clip.id === backgroundClipId )!
			)?.mode !== 'background'
		) {
			setSettings( { ...currentSettings, [ backgroundField ]: null } );
		}
	};
	const addMedia = async ( media: MediaItem[], slotId: string ) => {
		setAddingToSlot( null );
		setAdding( true );
		setError( '' );
		try {
			const currentTheme = getThemeDefinition(
				latestSettings.current.themeId
			);
			const slot = currentTheme.timeline.mediaSlots.find(
				( item ) => item.id === slotId
			)!;
			const added = await Promise.all(
				media.map( ( item ) =>
					makeClip( item, topic, settings.themeId )
				)
			);
			for ( const clip of added ) {
				clip.slotId = slot.id;
				clip.tags = slot.tag ? [ slot.tag ] : [];
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
	const activeAddSlot = theme.timeline.mediaSlots.find(
		( slot ) => slot.id === addingToSlot
	);
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
	const selectedSlot = selectedClip
		? getMediaSlot( theme, selectedClip )
		: undefined;
	const selectedSlotClips = selectedSlot
		? clipsInSlot( theme, clips, selectedSlot.id )
		: [];
	const selectedSlotIndex = selectedSlotClips.findIndex(
		( clip ) => clip.id === selectedClipId
	);
	const moveSelectedInSlot = ( direction: number ) => {
		const neighbor = selectedSlotClips[ selectedSlotIndex + direction ];
		if ( neighbor && selectedSlot ) {
			moveClip(
				selectedClip.id,
				selectedSlot.id,
				neighbor.id,
				direction > 0
			);
		}
	};
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
		const targetSlot = theme.timeline.mediaSlots.find(
			( slot ) => slot.tag === tag.id
		);
		const primarySlot = theme.timeline.mediaSlots.find(
			( slot ) => slot.mode === 'sequence'
		)!;
		let slotId = selectedClip.slotId;
		if ( targetSlot ) {
			slotId = checked ? targetSlot.id : primarySlot.id;
		}
		updateClip( selectedClip.id, {
			tags,
			slotId,
		} );
	};
	const moveToSlot = ( clip: CompositionClip, slotId: string ) => {
		moveClip( clip.id, slotId );
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
		const slot = getMediaSlot( theme, selectedClip );
		if (
			slot?.maxClips !== undefined &&
			clipsInSlot( theme, clips, slot.id ).length >= slot.maxClips
		) {
			return;
		}
		setClips( [
			...clips.slice( 0, selectedIndex + 1 ),
			duplicate,
			...clips.slice( selectedIndex + 1 ),
		] );
		setSelectedClipId( duplicate.id );
	};
	const removeClip = ( id: string ) => {
		const index = clips.findIndex( ( clip ) => clip.id === id );
		setClips( clips.filter( ( clip ) => clip.id !== id ) );
		if ( selectedClipId === id ) {
			setSelectedClipId(
				clips[ index + 1 ]?.id ?? clips[ index - 1 ]?.id ?? null
			);
		}
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
		clips.length === 0 ||
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
				<main
					className="clipisode-studio-monitor"
					aria-label="Live preview"
				>
					<div className="clipisode-studio-preview-heading">
						<span>PREVIEW</span>
						<span>{ clips.length } clips</span>
					</div>
					<CompositionPreview
						clips={ clips }
						settings={ settings }
						previewFrame={ previewFrame }
					/>
					<CompositionSequence
						theme={ theme }
						clips={ clips }
						settings={ settings }
						selectedClipId={ selectedClipId }
						adding={ adding }
						onAddMedia={ setAddingToSlot }
						onSelectClip={ selectClip }
						onRemoveClip={ removeClip }
						onMoveClip={ moveClip }
						onChangeSettings={ setSettings }
						onPreviewFrame={ ( frame ) =>
							setPreviewFrame( { frame } )
						}
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
								{ theme.timeline.mediaSlots.length > 1 && (
									<SelectControl
										__next40pxDefaultSize
										label="Sequence spot"
										value={ selectedSlot?.id || '' }
										options={ theme.timeline.mediaSlots
											.filter( ( slot ) =>
												canMoveClipToSlot(
													theme,
													clips,
													selectedClip.id,
													slot.id
												)
											)
											.map( ( slot ) => ( {
												value: slot.id,
												label: slot.label,
											} ) ) }
										onChange={ ( slotId ) =>
											moveToSlot( selectedClip, slotId )
										}
									/>
								) }
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
										disabled={ selectedSlotIndex <= 0 }
										onClick={ () =>
											moveSelectedInSlot( -1 )
										}
									/>
									<Button
										icon={ arrowDown }
										label="Move later"
										size="compact"
										disabled={
											selectedSlotIndex >=
											selectedSlotClips.length - 1
										}
										onClick={ () =>
											moveSelectedInSlot( 1 )
										}
									/>
									<Button
										icon={ copy }
										label="Duplicate"
										size="compact"
										disabled={
											selectedSlot?.maxClips !==
												undefined &&
											selectedSlotClips.length >=
												selectedSlot.maxClips
										}
										onClick={ duplicateClip }
									/>
									<Button
										icon={ trash }
										label="Remove"
										size="compact"
										isDestructive
										onClick={ () =>
											removeClip( selectedClip.id )
										}
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
								Select a clip from the sequence to edit its
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
			{ activeAddSlot && (
				<AddMediaModal
					key={ activeAddSlot.id }
					existingMediaIds={ clips.map( ( clip ) => clip.mediaId ) }
					topicId={ currentTopicId ?? undefined }
					introMediaId={ topic?.intro_media_id }
					allowedRoles={ activeAddSlot.roles }
					maxSelection={
						activeAddSlot.maxClips === undefined
							? undefined
							: activeAddSlot.maxClips -
							  clipsInSlot( theme, clips, activeAddSlot.id )
									.length
					}
					onAdd={ ( media ) => addMedia( media, activeAddSlot.id ) }
					onClose={ () => setAddingToSlot( null ) }
				/>
			) }
		</div>
	);
}
