import catalog from '../../assets/composition-themes.json';
import type {
	ClipFilter,
	CompositionClip,
	CompositionSettings,
	ThemeDefinition,
	ThemeField,
	ThemeGroup,
	ThemeMediaSlot,
	ThemeValue,
	ThemeValues,
} from './types';

export const themeDefinitions = catalog.themes as ThemeDefinition[];

export function getThemeDefinition( id: string ): ThemeDefinition {
	const theme = themeDefinitions.find( ( item ) => item.id === id );
	if ( ! theme ) {
		throw new Error( `Unknown composition theme: ${ id }` );
	}
	return theme;
}

function fieldsFor( theme: ThemeDefinition, scope: ThemeGroup[ 'scope' ] ) {
	return theme.groups
		.filter( ( group ) => group.scope === scope )
		.flatMap( ( group ) => group.fields );
}

function defaultsFor(
	theme: ThemeDefinition,
	scope: ThemeGroup[ 'scope' ]
): ThemeValues {
	return Object.fromEntries(
		fieldsFor( theme, scope ).map( ( field ) => [
			field.id,
			Array.isArray( field.default )
				? [ ...field.default ]
				: field.default,
		] )
	);
}

export function createDefaultSettings(
	themeId = 'default'
): CompositionSettings {
	return {
		themeId,
		format: 'portrait',
		...defaultsFor( getThemeDefinition( themeId ), 'composition' ),
	};
}

export function createClipValues( themeId: string ): ThemeValues {
	return defaultsFor( getThemeDefinition( themeId ), 'clip' );
}

export function getMediaSlot(
	theme: ThemeDefinition,
	clip: CompositionClip
): ThemeMediaSlot | undefined {
	return (
		theme.timeline.mediaSlots.find(
			( slot ) => slot.tag && clip.tags?.includes( slot.tag )
		) ||
		theme.timeline.mediaSlots.find( ( slot ) => slot.id === clip.slotId ) ||
		theme.timeline.mediaSlots.find( ( slot ) => slot.mode === 'sequence' )
	);
}

export function clipsInSlot(
	theme: ThemeDefinition,
	clips: CompositionClip[],
	slotId: string
): CompositionClip[] {
	return clips.filter(
		( clip ) => getMediaSlot( theme, clip )?.id === slotId
	);
}

export function assignClipsToSlots(
	theme: ThemeDefinition,
	clips: CompositionClip[]
): CompositionClip[] {
	const counts = new Map< string, number >();
	return clips.map( ( clip ) => {
		const tagged = theme.timeline.mediaSlots.find(
			( slot ) => slot.tag && clip.tags?.includes( slot.tag )
		);
		const retained = theme.timeline.mediaSlots.find(
			( slot ) => slot.id === clip.slotId
		);
		const fits = ( slot: ThemeMediaSlot ) =>
			( ! slot.roles || slot.roles.includes( clip.role ) ) &&
			( slot.maxClips === undefined ||
				( counts.get( slot.id ) || 0 ) < slot.maxClips );
		const slot =
			tagged ||
			( retained && fits( retained ) ? retained : undefined ) ||
			theme.timeline.mediaSlots.find(
				( item ) => item.mode === 'sequence' && fits( item )
			) ||
			theme.timeline.mediaSlots.find(
				( item ) => item.mode === 'sequence'
			);
		if ( ! slot ) {
			throw new Error(
				`The theme has no sequence spot for ${ clip.name }.`
			);
		}
		counts.set( slot.id, ( counts.get( slot.id ) || 0 ) + 1 );
		const slotTags = theme.timeline.mediaSlots
			.map( ( item ) => item.tag )
			.filter( ( tag ): tag is string => Boolean( tag ) );
		return {
			...clip,
			slotId: slot.id,
			tags: [
				...( clip.tags || [] ).filter(
					( tag ) => ! slotTags.includes( tag )
				),
				...( slot.tag ? [ slot.tag ] : [] ),
			],
		};
	} );
}

export function matchesClipFilter(
	clip: CompositionClip,
	filter?: ClipFilter
): boolean {
	return (
		( ! filter?.roles?.length || filter.roles.includes( clip.role ) ) &&
		( ! filter?.tags?.length ||
			filter.tags.some( ( tag ) => clip.tags?.includes( tag ) ) )
	);
}

export function getFieldValue(
	field: ThemeField,
	values: ThemeValues
): ThemeValue {
	return Object.prototype.hasOwnProperty.call( values, field.id )
		? values[ field.id ]
		: field.default;
}

export function getFieldOptions(
	field: ThemeField,
	clips: CompositionClip[]
): { label: string; value: string }[] {
	if ( field.type === 'clip' || field.source?.kind === 'clips' ) {
		return clips
			.filter(
				( clip ) =>
					clip.included &&
					matchesClipFilter( clip, field.source?.filter )
			)
			.map( ( clip ) => ( {
				value: clip.id,
				label: clip.name || `Clip ${ clip.mediaId }`,
			} ) );
	}
	return field.options || [];
}

function fieldVisible(
	theme: ThemeDefinition,
	field: ThemeField,
	scope: ThemeGroup[ 'scope' ],
	settings: CompositionSettings,
	clip?: CompositionClip
): boolean {
	if ( ! field.when ) {
		return true;
	}
	const conditionScope = field.when.scope || scope;
	const values = {
		...defaultsFor( theme, conditionScope ),
		...( conditionScope === 'composition' ? settings : clip?.values ),
	};
	return (
		JSON.stringify( values?.[ field.when.field ] ) ===
		JSON.stringify( field.when.equals )
	);
}

export function getVisibleGroups(
	theme: ThemeDefinition,
	scope: ThemeGroup[ 'scope' ],
	settings: CompositionSettings,
	clip?: CompositionClip
): ThemeGroup[] {
	return theme.groups
		.filter(
			( group ) =>
				group.scope === scope &&
				( scope !== 'clip' ||
					( clip && matchesClipFilter( clip, group.appliesTo ) ) )
		)
		.map( ( group ) => ( {
			...group,
			fields: group.fields.filter( ( field ) =>
				fieldVisible( theme, field, scope, settings, clip )
			),
		} ) )
		.filter( ( group ) => group.fields.length > 0 );
}

function fieldError(
	field: ThemeField,
	value: ThemeValue | undefined,
	clips: CompositionClip[],
	required: boolean
): string | null {
	if ( value === undefined ) {
		return ! field.optional && required
			? `${ field.label } is required.`
			: null;
	}
	if ( value === null ) {
		return field.optional ? null : `${ field.label } cannot be empty.`;
	}
	if ( field.type === 'toggle' ) {
		return typeof value === 'boolean'
			? null
			: `${ field.label } must be on or off.`;
	}
	if ( field.type === 'number' || field.type === 'range' ) {
		if ( typeof value !== 'number' || ! Number.isFinite( value ) ) {
			return `${ field.label } must be a number.`;
		}
		if (
			( field.min !== undefined && value < field.min ) ||
			( field.max !== undefined && value > field.max )
		) {
			return `${ field.label } is outside its allowed range.`;
		}
		if ( field.step !== undefined ) {
			const steps = ( value - ( field.min ?? 0 ) ) / field.step;
			if ( Math.abs( steps - Math.round( steps ) ) > 0.00000001 ) {
				return `${ field.label } must use increments of ${ field.step }.`;
			}
		}
		return null;
	}
	if ( field.type === 'multiselect' ) {
		const options = getFieldOptions( field, clips ).map(
			( option ) => option.value
		);
		return Array.isArray( value ) &&
			value.every(
				( item ) => typeof item === 'string' && options.includes( item )
			) &&
			new Set( value ).size === value.length
			? null
			: `${ field.label } contains an unavailable selection.`;
	}
	if ( typeof value !== 'string' ) {
		return `${ field.label } must be text.`;
	}
	if ( field.type === 'color' && ! /^#[a-fA-F0-9]{6}$/.test( value ) ) {
		return `${ field.label } must be a six-digit hex color.`;
	}
	if ( field.type === 'image' && value ) {
		try {
			const url = new URL( value );
			if ( ! [ 'http:', 'https:' ].includes( url.protocol ) ) {
				return `${ field.label } must be an HTTP or HTTPS image URL.`;
			}
		} catch {
			return `${ field.label } must be an HTTP or HTTPS image URL.`;
		}
	}
	if (
		( field.type === 'select' || field.type === 'clip' ) &&
		! getFieldOptions( field, clips ).some(
			( option ) => option.value === value
		)
	) {
		return `${ field.label } must reference an available selection.`;
	}
	return null;
}

export function validateThemeValues(
	theme: ThemeDefinition,
	settings: CompositionSettings,
	clips: CompositionClip[]
): string[] {
	const errors: string[] = [];
	if ( settings.themeId !== theme.id ) {
		errors.push( 'The composition does not match its theme.' );
	}
	if ( ! [ 'portrait', 'square', 'landscape' ].includes( settings.format ) ) {
		errors.push( 'Choose a valid canvas format.' );
	}
	for ( const slot of theme.timeline.mediaSlots ) {
		const assigned = clipsInSlot( theme, clips, slot.id );
		if ( slot.maxClips !== undefined && assigned.length > slot.maxClips ) {
			errors.push(
				`${ slot.label } allows at most ${ slot.maxClips } clips.`
			);
		}
		if (
			slot.minClips !== undefined &&
			assigned.filter( ( clip ) => clip.included ).length < slot.minClips
		) {
			errors.push(
				`${ slot.label } needs at least ${ slot.minClips } included clips.`
			);
		}
		if ( slot.roles ) {
			for ( const clip of assigned ) {
				if ( ! slot.roles.includes( clip.role ) ) {
					errors.push(
						`${ clip.name } cannot be placed in ${ slot.label }.`
					);
				}
			}
		}
	}
	for ( const clip of clips ) {
		if (
			clip.slotId &&
			! theme.timeline.mediaSlots.some(
				( slot ) => slot.id === clip.slotId
			)
		) {
			errors.push( `${ clip.name } has an unavailable sequence spot.` );
		}
	}
	const validate = (
		scope: ThemeGroup[ 'scope' ],
		values: ThemeValues,
		clip?: CompositionClip
	) => {
		const fields = fieldsFor( theme, scope );
		const allowed = fields.map( ( field ) => field.id );
		const visible = new Set(
			getVisibleGroups( theme, scope, settings, clip ).flatMap(
				( group ) => group.fields.map( ( field ) => field.id )
			)
		);
		for ( const key of Object.keys( values ) ) {
			if (
				! allowed.includes( key ) &&
				! (
					scope === 'composition' &&
					[ 'themeId', 'format' ].includes( key )
				)
			) {
				errors.push( `Unknown ${ scope } field: ${ key }.` );
			}
		}
		for ( const field of fields ) {
			const error = fieldError(
				field,
				values[ field.id ],
				clips,
				visible.has( field.id )
			);
			if ( error ) {
				errors.push( clip ? `${ clip.name }: ${ error }` : error );
			}
		}
	};
	validate( 'composition', settings );
	for ( const clip of clips ) {
		const tags = clip.tags || [];
		if ( new Set( tags ).size !== tags.length ) {
			errors.push( `${ clip.name }: Clip tags must be unique.` );
		}
		const exclusive = new Set< string >();
		for ( const id of tags ) {
			const tag = theme.tags.find( ( item ) => item.id === id );
			if (
				! tag ||
				( tag.roles?.length && ! tag.roles.includes( clip.role ) )
			) {
				errors.push( `${ clip.name }: Unavailable clip tag: ${ id }.` );
				continue;
			}
			if ( tag.exclusiveGroup ) {
				if ( exclusive.has( tag.exclusiveGroup ) ) {
					errors.push(
						`${ clip.name }: Choose only one ${ tag.exclusiveGroup } tag.`
					);
				}
				exclusive.add( tag.exclusiveGroup );
			}
		}
		validate( 'clip', clip.values || {}, clip );
	}
	for ( const tag of theme.tags ) {
		if (
			tag.maxClips !== undefined &&
			clips.filter( ( clip ) => clip.tags?.includes( tag.id ) ).length >
				tag.maxClips
		) {
			errors.push(
				`${ tag.label } allows at most ${ tag.maxClips } clips.`
			);
		}
	}
	return errors;
}

export function changeTheme(
	settings: CompositionSettings,
	clips: CompositionClip[],
	nextThemeId: string
): { settings: CompositionSettings; clips: CompositionClip[] } {
	const previous = getThemeDefinition( settings.themeId );
	const next = getThemeDefinition( nextThemeId );
	const transfer = (
		scope: ThemeGroup[ 'scope' ],
		values: ThemeValues,
		nextClips: CompositionClip[]
	) => {
		const result = defaultsFor( next, scope );
		for ( const field of fieldsFor( next, scope ) ) {
			const old = fieldsFor( previous, scope ).find(
				( item ) => item.id === field.id && item.type === field.type
			);
			if (
				old &&
				values[ field.id ] !== undefined &&
				! fieldError( field, values[ field.id ], nextClips, true )
			) {
				result[ field.id ] = Array.isArray( values[ field.id ] )
					? [ ...( values[ field.id ] as string[] ) ]
					: values[ field.id ];
			}
		}
		return result;
	};
	const nextClips = clips.map( ( clip ) => ( {
		...clip,
		tags: ( clip.tags || [] ).filter( ( id ) =>
			next.tags.some(
				( tag ) =>
					tag.id === id &&
					( ! tag.roles?.length || tag.roles.includes( clip.role ) )
			)
		),
	} ) );
	const slottedClips = assignClipsToSlots( next, nextClips );
	return {
		settings: {
			themeId: nextThemeId,
			format: settings.format,
			...transfer( 'composition', settings, slottedClips ),
		},
		clips: slottedClips.map( ( clip ) => ( {
			...clip,
			values: transfer( 'clip', clip.values || {}, slottedClips ),
		} ) ),
	};
}
