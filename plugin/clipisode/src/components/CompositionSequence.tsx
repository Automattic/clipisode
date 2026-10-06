import { useRef, useState } from '@wordpress/element';
import { Button, CheckboxControl } from '@wordpress/components';
import { trash } from '@wordpress/icons';
import ThemeFields from './ThemeFields';
import { buildTimeline } from '../remotion/timeline';
import { clipsInSlot, getVisibleGroups } from '../remotion/theme-schema';
import type {
	CompositionClip,
	CompositionSettings,
	ThemeDefinition,
	ThemeMediaSlot,
	TimelineSegment,
} from '../remotion/types';

interface Props {
	theme: ThemeDefinition;
	clips: CompositionClip[];
	settings: CompositionSettings;
	selectedClipId: string | null;
	adding: boolean;
	onAddMedia: ( slotId: string ) => void;
	onSelectClip: ( id: string ) => void;
	onUpdateClip: ( id: string, patch: Partial< CompositionClip > ) => void;
	onRemoveClip: ( id: string ) => void;
	onMoveClip: ( from: number, to: number ) => void;
	onChangeSettings: ( settings: CompositionSettings ) => void;
	onPreviewFrame: ( frame: number ) => void;
}

function duration( seconds: number ): string {
	return `${ seconds.toFixed( 1 ) }s`;
}

export default function CompositionSequence( {
	theme,
	clips,
	settings,
	selectedClipId,
	adding,
	onAddMedia,
	onSelectClip,
	onUpdateClip,
	onRemoveClip,
	onMoveClip,
	onChangeSettings,
	onPreviewFrame,
}: Props ) {
	const [ selectedCard, setSelectedCard ] = useState<
		'title' | 'ending' | null
	>( null );
	const draggedClip = useRef< string | null >( null );
	let segments: TimelineSegment[];
	try {
		segments = buildTimeline( clips, settings ).segments;
	} catch {
		segments = [];
	}
	const preview = ( type: 'title' | 'ending' | 'clip', id?: string ) => {
		const segment = segments.find(
			( item ) =>
				item.type === type &&
				( type !== 'clip' ||
					( item.type === 'clip' && item.clip.id === id ) )
		);
		if ( segment ) {
			onPreviewFrame( segment.start );
		}
	};
	const card = ( type: 'title' | 'ending' ) => {
		const definition = theme.timeline[ type ];
		if ( ! definition ) {
			return null;
		}
		const enabled = settings[ definition.enabledField ] === true;
		return (
			<button
				key={ type }
				type="button"
				className={ `clipisode-sequence-card is-${ type } ${
					selectedCard === type ? 'is-selected' : ''
				} ${ enabled ? '' : 'is-disabled' }` }
				aria-label={ `Configure ${ definition.label }` }
				aria-pressed={ selectedCard === type }
				onClick={ () => {
					setSelectedCard( type );
					preview( type );
				} }
			>
				<span className="clipisode-sequence-card-kind">Card</span>
				<strong>{ definition.label }</strong>
				<span>
					{ enabled
						? duration(
								Number( settings[ definition.durationField ] )
						  )
						: 'Off' }
				</span>
			</button>
		);
	};
	const slot = ( definition: ThemeMediaSlot ) => {
		const assigned = clipsInSlot( theme, clips, definition.id );
		const remaining =
			definition.maxClips === undefined
				? undefined
				: definition.maxClips - assigned.length;
		return (
			<section
				className="clipisode-sequence-slot"
				key={ definition.id }
				aria-label={ definition.label }
			>
				<div className="clipisode-sequence-slot-heading">
					<strong>{ definition.label }</strong>
					<span>
						{ assigned.length }
						{ definition.maxClips === undefined
							? ''
							: ` / ${ definition.maxClips }` }
					</span>
				</div>
				<div className="clipisode-sequence-slot-items">
					{ assigned.map( ( clip ) => {
						const index = clips.findIndex(
							( item ) => item.id === clip.id
						);
						return (
							<div
								className={ `clipisode-sequence-clip ${
									clip.included ? '' : 'is-excluded'
								}` }
								key={ clip.id }
								draggable
								onDragStart={ () => {
									draggedClip.current = clip.id;
								} }
								onDragOver={ ( event ) =>
									event.preventDefault()
								}
								onDrop={ ( event ) => {
									event.preventDefault();
									const source = clips.findIndex(
										( item ) =>
											item.id === draggedClip.current
									);
									if (
										source >= 0 &&
										assigned.some(
											( item ) =>
												item.id === draggedClip.current
										)
									) {
										onMoveClip( source, index );
									}
									draggedClip.current = null;
								} }
								onDragEnd={ () => {
									draggedClip.current = null;
								} }
							>
								<button
									type="button"
									className={ `clipisode-sequence-clip-select ${
										selectedClipId === clip.id
											? 'is-selected'
											: ''
									}` }
									aria-label={ `Select clip ${ index + 1 }: ${
										clip.name
									}` }
									aria-pressed={ selectedClipId === clip.id }
									onClick={ () => {
										setSelectedCard( null );
										onSelectClip( clip.id );
										preview( 'clip', clip.id );
									} }
								>
									<video
										src={ clip.url }
										muted
										playsInline
										preload="metadata"
										aria-hidden="true"
									/>
									<span className="clipisode-sequence-clip-name">
										{ clip.name }
									</span>
									<span className="clipisode-sequence-clip-duration">
										{ duration(
											clip.trimEnd - clip.trimStart
										) }
									</span>
								</button>
								<div className="clipisode-sequence-clip-actions">
									<CheckboxControl
										label={ `Include clip ${ index + 1 }` }
										checked={ clip.included }
										onChange={ ( included ) =>
											onUpdateClip( clip.id, {
												included,
											} )
										}
									/>
									<Button
										icon={ trash }
										label={ `Remove clip ${ index + 1 }: ${
											clip.name
										}` }
										isDestructive
										onClick={ () =>
											onRemoveClip( clip.id )
										}
									/>
								</div>
							</div>
						);
					} ) }
					{ remaining === undefined || remaining > 0 ? (
						<button
							type="button"
							className="clipisode-sequence-add"
							aria-label={ `Add media to ${ definition.label }` }
							disabled={ adding }
							onClick={ () => onAddMedia( definition.id ) }
						>
							<span aria-hidden="true">+</span>
							<strong>
								{ adding ? 'Loading…' : 'Add media' }
							</strong>
						</button>
					) : null }
				</div>
				{ definition.description && <p>{ definition.description }</p> }
			</section>
		);
	};
	const cardGroups = selectedCard
		? getVisibleGroups( theme, 'composition', settings ).filter(
				( group ) => group.card === selectedCard
		  )
		: [];
	return (
		<section
			className="clipisode-composition-sequence"
			aria-label="Sequence"
		>
			<div className="clipisode-studio-sequence-heading">
				<h2>Sequence</h2>
				<span>Arrange clips and configure cards</span>
			</div>
			<div className="clipisode-sequence-lane">
				{ card( 'title' ) }
				{ theme.timeline.mediaSlots
					.filter( ( item ) => item.mode === 'sequence' )
					.map( slot ) }
				{ card( 'ending' ) }
			</div>
			{ theme.timeline.mediaSlots
				.filter( ( item ) => item.mode === 'background' )
				.map( slot ) }
			{ selectedCard && cardGroups.length > 0 && (
				<div className="clipisode-sequence-card-fields">
					<ThemeFields
						groups={ cardGroups }
						values={ settings }
						clips={ clips }
						idPrefix={ `sequence-${ selectedCard }` }
						onChange={ ( values ) =>
							onChangeSettings( values as CompositionSettings )
						}
					/>
				</div>
			) }
		</section>
	);
}
