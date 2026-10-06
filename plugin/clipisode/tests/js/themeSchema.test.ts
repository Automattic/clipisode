import {
	assignClipsToSlots,
	changeTheme,
	createClipValues,
	createDefaultSettings,
	getFieldOptions,
	getFieldValue,
	clipsInSlot,
	canMoveClipToSlot,
	getThemeDefinition,
	getVisibleGroups,
	themeDefinitions,
	moveClipToSlot,
	validateThemeValues,
} from '../../src/remotion/theme-schema';
import type {
	CompositionClip,
	CompositionSettings,
	ThemeDefinition,
	ThemeField,
} from '../../src/remotion/types';
import { buildTimeline } from '../../src/remotion/timeline';
import { mlbTeamLogos } from '../../src/remotion/mlb-team-logos';

const clip = (
	id: string,
	overrides: Partial< CompositionClip > = {}
): CompositionClip => ( {
	id,
	mediaId: 1,
	role: 'reply',
	name: `Speaker ${ id }`,
	url: `https://example.com/${ id }.mp4`,
	duration: 10,
	trimStart: 0,
	trimEnd: 10,
	included: true,
	tags: [],
	values: {},
	...overrides,
} );

const featuredField: ThemeField = {
	id: 'featured',
	label: 'Featured speaker',
	type: 'clip',
	default: null,
	optional: true,
	source: {
		kind: 'clips',
		filter: { roles: [ 'reply' ], tags: [ 'highlight' ] },
	},
};

const theme: ThemeDefinition = {
	id: 'one-color',
	label: 'One color',
	description: 'A fixture with a different set of controls.',
	renderer: 'default',
	groups: [
		{
			id: 'appearance',
			label: 'Appearance',
			scope: 'composition',
			fields: [
				{ id: 'ink', label: 'Ink', type: 'color', default: '#123456' },
				{
					id: 'showHeading',
					label: 'Show heading',
					type: 'toggle',
					default: true,
				},
				{
					id: 'heading',
					label: 'Heading',
					type: 'text',
					default: 'Our story',
					when: { field: 'showHeading', equals: true },
				},
				{
					id: 'opacity',
					label: 'Opacity',
					type: 'range',
					default: 0.5,
					min: 0,
					max: 1,
					step: 0.1,
				},
				{
					id: 'mark',
					label: 'Mark',
					type: 'image',
					default: null,
					optional: true,
				},
				featuredField,
				{
					id: 'credits',
					label: 'Credits',
					type: 'multiselect',
					default: [],
					optional: true,
					source: { kind: 'clips' },
				},
			],
		},
		{
			id: 'speaker',
			label: 'Speaker',
			scope: 'clip',
			appliesTo: { roles: [ 'reply' ], tags: [ 'highlight' ] },
			fields: [
				{
					id: 'affiliation',
					label: 'Affiliation',
					type: 'text',
					default: null,
					optional: true,
				},
				{
					id: 'caption',
					label: 'Caption',
					type: 'textarea',
					default: 'Featured guest',
					when: {
						field: 'showHeading',
						equals: true,
						scope: 'composition',
					},
				},
			],
		},
	],
	tags: [
		{
			id: 'highlight',
			label: 'Highlight',
			roles: [ 'reply' ],
			maxClips: 1,
		},
	],
	timeline: {
		mediaSlots: [ { id: 'main', label: 'Clips', mode: 'sequence' } ],
	},
	canvas: { backgroundColor: '#000000' },
};

const settings = (
	overrides: Partial< CompositionSettings > = {}
): CompositionSettings => ( {
	themeId: theme.id,
	format: 'portrait',
	ink: '#123456',
	showHeading: true,
	heading: 'Our story',
	opacity: 0.5,
	mark: null,
	featured: null,
	credits: [],
	...overrides,
} );

describe( 'theme schemas', () => {
	it( 'reorders clips within theme slots and rejects disallowed drops', () => {
		const fixed: ThemeDefinition = {
			...theme,
			timeline: {
				mediaSlots: [
					{
						id: 'replies',
						label: 'Replies',
						mode: 'sequence',
						roles: [ 'reply' ],
					},
					{
						id: 'intro',
						label: 'Intro',
						mode: 'sequence',
						roles: [ 'intro' ],
						maxClips: 1,
					},
				],
			},
		};
		const initial = [
			clip( 'a', { slotId: 'replies' } ),
			clip( 'b', { slotId: 'replies' } ),
			clip( 'intro', { role: 'intro', slotId: 'intro' } ),
		];
		expect(
			moveClipToSlot( fixed, initial, 'a', 'replies', 'b', true ).map(
				( item ) => item.id
			)
		).toEqual( [ 'b', 'a', 'intro' ] );
		expect( canMoveClipToSlot( fixed, initial, 'a', 'intro' ) ).toBe(
			false
		);
		expect( moveClipToSlot( fixed, initial, 'a', 'intro' ) ).toBe(
			initial
		);
		const open = {
			...fixed,
			timeline: {
				mediaSlots: [
					fixed.timeline.mediaSlots[ 0 ],
					{ ...fixed.timeline.mediaSlots[ 1 ], maxClips: 2 },
				],
			},
		};
		expect( canMoveClipToSlot( open, initial, 'a', 'intro' ) ).toBe(
			false
		);
		const allowed = {
			...open,
			timeline: {
				mediaSlots: [
					open.timeline.mediaSlots[ 0 ],
					{ ...open.timeline.mediaSlots[ 1 ], roles: undefined },
				],
			},
		};
		const moved = moveClipToSlot( allowed, initial, 'a', 'intro' );
		expect(
			clipsInSlot( allowed, moved, 'intro' ).map( ( item ) => item.id )
		).toEqual( [ 'intro', 'a' ] );
		expect( moved.find( ( item ) => item.id === 'a' )?.slotId ).toBe(
			'intro'
		);
		const required = {
			...allowed,
			timeline: {
				mediaSlots: [
					{ ...allowed.timeline.mediaSlots[ 0 ], minClips: 2 },
					allowed.timeline.mediaSlots[ 1 ],
				],
			},
		};
		expect( canMoveClipToSlot( required, initial, 'a', 'intro' ) ).toBe(
			false
		);
		const branded = getThemeDefinition( 'default' );
		const retagged = moveClipToSlot(
			branded,
			[ clip( 'a', { slotId: 'background', tags: [ 'background' ] } ) ],
			'a',
			'end'
		);
		expect( retagged[ 0 ] ).toMatchObject( {
			slotId: 'end',
			tags: [ 'end' ],
		} );
		const twoSpots: ThemeDefinition = {
			...theme,
			timeline: {
				mediaSlots: [
					{
						id: 'first',
						label: 'First',
						mode: 'sequence',
						maxClips: 1,
					},
					{
						id: 'second',
						label: 'Second',
						mode: 'sequence',
						maxClips: 1,
					},
				],
			},
		};
		const filled = [
			clip( 'first', { slotId: 'first' } ),
			clip( 'second', { slotId: 'second' } ),
		];
		expect( canMoveClipToSlot( twoSpots, filled, 'first', 'second' ) ).toBe(
			false
		);
		expect(
			canMoveClipToSlot( twoSpots, filled, 'first', 'second', 'second' )
		).toBe( true );
		expect(
			moveClipToSlot( twoSpots, filled, 'first', 'second', 'second' ).map(
				( item ) => [ item.id, item.slotId ]
			)
		).toEqual( [
			[ 'second', 'first' ],
			[ 'first', 'second' ],
		] );
	} );
	it( 'provides a logo-backed choice for every MLB team', () => {
		const baseball = getThemeDefinition( 'baseball' );
		const field = baseball.groups
			.flatMap( ( group ) => group.fields )
			.find( ( item ) => item.id === 'teamPick' );
		expect( field?.options ).toHaveLength( 30 );
		expect(
			field?.options?.map( ( option ) => option.value ).sort()
		).toEqual( Object.keys( mlbTeamLogos ).sort() );
		const baseballSettings = createDefaultSettings( 'baseball' );
		expect(
			validateThemeValues( baseball, baseballSettings, [
				clip( 'fan', { values: { teamPick: '119' } } ),
			] )
		).toEqual( [] );
		expect(
			validateThemeValues( baseball, baseballSettings, [
				clip( 'fan', { values: { teamPick: 'unknown' } } ),
			] )
		).toContain(
			'Speaker fan: MLB team must reference an available selection.'
		);
	} );
	it( 'uses theme-defined spots to order clips and enforce fixed capacities', () => {
		const fixed: ThemeDefinition = {
			...theme,
			id: 'two-spots',
			timeline: {
				mediaSlots: [
					{
						id: 'first',
						label: 'First',
						mode: 'sequence',
						minClips: 1,
						maxClips: 1,
					},
					{
						id: 'second',
						label: 'Second',
						mode: 'sequence',
						minClips: 1,
						maxClips: 1,
					},
				],
			},
		};
		const second = clip( 'second', { slotId: 'second' } );
		const first = clip( 'first', { slotId: 'first' } );
		expect(
			assignClipsToSlots( fixed, [ clip( 'a' ), clip( 'b' ) ] ).map(
				( item ) => item.slotId
			)
		).toEqual( [ 'first', 'second' ] );
		const fixedSettings = settings( { themeId: fixed.id } );
		themeDefinitions.push( fixed );
		try {
			expect( clipsInSlot( fixed, [ second, first ], 'first' ) ).toEqual(
				[ first ]
			);
			expect(
				validateThemeValues( fixed, fixedSettings, [ second, first ] )
			).toEqual( [] );
			expect(
				buildTimeline( [ second, first ], fixedSettings ).segments.map(
					( segment ) =>
						segment.type === 'clip' ? segment.clip.id : segment.type
				)
			).toEqual( [ 'first', 'second' ] );
			expect(
				validateThemeValues( fixed, fixedSettings, [ first ] )
			).toContain( 'Second needs at least 1 included clips.' );
			expect(
				validateThemeValues( fixed, fixedSettings, [
					first,
					clip( 'extra', { slotId: 'first' } ),
					second,
				] )
			).toContain( 'First allows at most 1 clips.' );
		} finally {
			themeDefinitions.pop();
		}
	} );
	it( 'exposes each theme’s own grouped controls without imposing branding fields on no-theme videos', () => {
		const colors = ( definition: ThemeDefinition ) =>
			definition.groups
				.flatMap( ( group ) => group.fields )
				.filter( ( field ) => field.type === 'color' );
		expect( colors( getThemeDefinition( 'none' ) ) ).toHaveLength( 0 );
		expect( createDefaultSettings( 'none' ) ).not.toHaveProperty(
			'accentColor'
		);
		expect( colors( theme ) ).toHaveLength( 1 );
		expect( colors( getThemeDefinition( 'default' ) ) ).toHaveLength( 3 );
		expect( getThemeDefinition( 'default' ).groups.length ).toBeGreaterThan(
			1
		);
		expect(
			themeDefinitions.map( ( definition ) => definition.id )
		).toEqual( expect.arrayContaining( [ 'default', 'wpvip', 'none' ] ) );
	} );

	it( 'hides conditional fields without dropping the rest of their group', () => {
		const visible = getVisibleGroups(
			theme,
			'composition',
			settings( { showHeading: false } )
		);
		expect( visible.map( ( group ) => group.id ) ).toEqual( [
			'appearance',
		] );
		expect(
			visible[ 0 ].fields.map( ( field ) => field.id )
		).not.toContain( 'heading' );
		expect( visible[ 0 ].fields.map( ( field ) => field.id ) ).toContain(
			'ink'
		);
		expect(
			getVisibleGroups(
				theme,
				'composition',
				settings()
			)[ 0 ].fields.map( ( field ) => field.id )
		).toContain( 'heading' );
	} );

	it( 'limits clip groups by both role and tag and resolves composition-scoped conditions', () => {
		expect(
			getVisibleGroups(
				theme,
				'clip',
				settings(),
				clip( 'intro', { role: 'intro', tags: [ 'highlight' ] } )
			)
		).toEqual( [] );
		expect(
			getVisibleGroups( theme, 'clip', settings(), clip( 'untagged' ) )
		).toEqual( [] );
		const highlighted = clip( 'guest', { tags: [ 'highlight' ] } );
		expect(
			getVisibleGroups(
				theme,
				'clip',
				settings(),
				highlighted
			)[ 0 ].fields.map( ( field ) => field.id )
		).toEqual( [ 'affiliation', 'caption' ] );
		expect(
			getVisibleGroups(
				theme,
				'clip',
				settings( { showHeading: false } ),
				highlighted
			)[ 0 ].fields.map( ( field ) => field.id )
		).toEqual( [ 'affiliation' ] );
	} );

	it( 'updates clip selector choices from included input clips and uses instance IDs', () => {
		const inputs = [
			clip( 'a', { name: 'Alex', tags: [ 'highlight' ] } ),
			clip( 'b', { name: 'Alex again', tags: [ 'highlight' ] } ),
			clip( 'c', { role: 'intro', tags: [ 'highlight' ] } ),
			clip( 'd', { included: false, tags: [ 'highlight' ] } ),
			clip( 'e' ),
		];
		expect( getFieldOptions( featuredField, inputs ) ).toEqual( [
			{ label: 'Alex', value: 'a' },
			{ label: 'Alex again', value: 'b' },
		] );
		expect(
			getFieldOptions( featuredField, [
				clip( 'f', { name: 'New speaker', tags: [ 'highlight' ] } ),
			] )
		).toEqual( [ { label: 'New speaker', value: 'f' } ] );
		expect( getFieldOptions( featuredField, [] ) ).toEqual( [] );
	} );

	it( 'offers every included clip when a clip field has no source filter', () => {
		const field: ThemeField = { ...featuredField };
		delete field.source;
		expect(
			getFieldOptions( field, [
				clip( 'intro', { role: 'intro', name: 'Host' } ),
				clip( 'reply', { name: 'Guest' } ),
				clip( 'excluded', { included: false } ),
			] )
		).toEqual( [
			{ label: 'Host', value: 'intro' },
			{ label: 'Guest', value: 'reply' },
		] );
	} );

	it( 'uses an absent optional toggle’s default to show and require dependent fields', () => {
		const conditionalTheme: ThemeDefinition = {
			...theme,
			groups: theme.groups.map( ( group ) => ( {
				...group,
				fields: group.fields.map( ( field ) =>
					field.id === 'showHeading'
						? { ...field, optional: true }
						: field
				),
			} ) ),
		};
		const missing = settings();
		delete missing.showHeading;
		delete missing.heading;
		expect(
			getVisibleGroups(
				conditionalTheme,
				'composition',
				missing
			)[ 0 ].fields.map( ( field ) => field.id )
		).toContain( 'heading' );
		expect( validateThemeValues( conditionalTheme, missing, [] ) ).toEqual(
			[ 'Heading is required.' ]
		);
		expect(
			validateThemeValues(
				conditionalTheme,
				{ ...missing, heading: 'Visible by default' },
				[]
			)
		).toEqual( [] );
	} );

	it( 'retains static options and distinguishes an absent default from an explicit optional null', () => {
		const field: ThemeField = {
			id: 'position',
			label: 'Position',
			type: 'select',
			default: 'left',
			optional: true,
			options: [
				{ label: 'Left', value: 'left' },
				{ label: 'Right', value: 'right' },
			],
		};
		expect( getFieldOptions( field, [] ) ).toEqual( field.options );
		expect( getFieldValue( field, {} ) ).toBe( 'left' );
		expect( getFieldValue( field, { position: null } ) ).toBeNull();
	} );

	it( 'changes themes while preserving compatible shared fields and dropping undeclared composition and clip values', () => {
		const changed = changeTheme(
			{
				...createDefaultSettings(),
				format: 'landscape',
				videoFit: 'contain',
				customProperty: 'discard me',
			},
			[
				clip( 'a', {
					values: { customProperty: 'discard me' },
					tags: [ 'undeclared' ],
				} ),
			],
			'none'
		);
		expect( changed.settings ).toMatchObject( {
			themeId: 'none',
			format: 'landscape',
			videoFit: 'contain',
		} );
		expect( changed.settings ).not.toHaveProperty( 'accentColor' );
		expect( changed.settings ).not.toHaveProperty( 'customProperty' );
		expect( changed.clips[ 0 ].values ).not.toHaveProperty(
			'customProperty'
		);
		expect( changed.clips[ 0 ].tags ).not.toContain( 'undeclared' );
		expect( changed.clips[ 0 ] ).toMatchObject( {
			id: 'a',
			mediaId: 1,
			trimStart: 0,
			trimEnd: 10,
		} );
	} );

	it( 'returns independent defaults for composition and per-clip values', () => {
		const first = createDefaultSettings();
		first.accentColor = '#000000';
		expect( createDefaultSettings().accentColor ).toBe( '#f45b43' );
		const values = createClipValues( 'default' );
		values.customProperty = 'local edit';
		expect( createClipValues( 'default' ) ).not.toHaveProperty(
			'customProperty'
		);
	} );

	it( 'accepts optional nulls and requires a value only when its field is visible and applicable', () => {
		const hiddenHeading = settings( { showHeading: false } );
		delete hiddenHeading.heading;
		expect( validateThemeValues( theme, settings(), [] ) ).toEqual( [] );
		expect(
			validateThemeValues( theme, settings( { heading: null } ), [] )
				.length
		).toBeGreaterThan( 0 );
		expect( validateThemeValues( theme, hiddenHeading, [] ) ).toEqual( [] );
		expect(
			validateThemeValues(
				theme,
				settings( { showHeading: false, heading: null } ),
				[]
			).length
		).toBeGreaterThan( 0 );
		expect(
			validateThemeValues( theme, settings(), [
				clip( 'a', { values: { affiliation: null } } ),
			] )
		).toEqual( [] );
		expect(
			validateThemeValues( theme, settings(), [
				clip( 'a', { values: { affiliation: null, caption: null } } ),
			] ).length
		).toBeGreaterThan( 0 );
		expect(
			validateThemeValues( theme, settings(), [
				clip( 'a', {
					tags: [ 'highlight' ],
					values: { affiliation: null },
				} ),
			] ).length
		).toBeGreaterThan( 0 );
	} );

	it.each( [
		{ ink: 'red' },
		{ showHeading: 'yes' },
		{ opacity: 2 },
		{ opacity: '0.5' },
		{ mark: 'javascript:alert(1)' },
		{ featured: 'missing-clip' },
		{ credits: [ 'missing-clip' ] },
		{ unknown: 'undeclared' },
	] )( 'rejects invalid field values %o', ( invalid ) => {
		expect(
			validateThemeValues( theme, settings( invalid ), [] ).length
		).toBeGreaterThan( 0 );
	} );

	it( 'rejects invalid hidden values and invalid clip tags instead of silently dropping them', () => {
		expect(
			validateThemeValues(
				theme,
				settings( { showHeading: false, heading: 42 } ),
				[]
			).length
		).toBeGreaterThan( 0 );
		expect(
			validateThemeValues( theme, settings(), [
				clip( 'a', { tags: [ 'unknown' ] } ),
			] ).length
		).toBeGreaterThan( 0 );
		expect(
			validateThemeValues( theme, settings(), [
				clip( 'a', { role: 'intro', tags: [ 'highlight' ] } ),
			] ).length
		).toBeGreaterThan( 0 );
		expect(
			validateThemeValues( theme, settings(), [
				clip( 'a', {
					tags: [ 'highlight' ],
					values: { caption: 'Alex', affiliation: null },
				} ),
				clip( 'b', {
					tags: [ 'highlight' ],
					values: { caption: 'Morgan', affiliation: null },
				} ),
			] ).length
		).toBeGreaterThan( 0 );
	} );
} );
