import {
	buildTimeline,
	FPS,
	getCardBackgroundClip,
	getCompositionSize,
} from '../../src/remotion/timeline';
import { createDefaultSettings } from '../../src/remotion/themes';
import type { CompositionClip } from '../../src/remotion/types';

const clip = (
	id: string,
	overrides: Partial< CompositionClip > = {}
): CompositionClip => ( {
	id,
	mediaId: Number( id ),
	role: 'reply',
	name: `Speaker ${ id }`,
	url: `https://example.com/${ id }.mp4`,
	duration: 10,
	trimStart: 0,
	trimEnd: 10,
	included: true,
	...overrides,
} );

describe( 'Remotion composition timeline', () => {
	it( 'places cards and included clips on consecutive, exclusive frame boundaries in the selected order', () => {
		const settings = {
			...createDefaultSettings(),
			titleDuration: 2,
			endingDuration: 1,
		};
		const clips = [
			clip( '2', { role: 'intro', trimStart: 1, trimEnd: 4 } ),
			clip( '3', { included: false } ),
			clip( '1', { trimStart: 0.5, trimEnd: 2.5 } ),
		];
		const timeline = buildTimeline( clips, settings );

		expect( timeline.durationInFrames ).toBe( 8 * FPS );
		expect(
			timeline.segments.map( ( segment ) => ( {
				type: segment.type,
				start: segment.start,
				duration: segment.durationInFrames,
			} ) )
		).toEqual( [
			{ type: 'title', start: 0, duration: 60 },
			{ type: 'clip', start: 60, duration: 90 },
			{ type: 'clip', start: 150, duration: 60 },
			{ type: 'ending', start: 210, duration: 30 },
		] );
		expect( timeline.segments[ 1 ] ).toMatchObject( {
			clip: { id: '2' },
			trimBeforeInFrames: 30,
			trimAfterInFrames: 120,
		} );
		expect( timeline.segments[ 2 ] ).toMatchObject( {
			clip: { id: '1' },
			trimBeforeInFrames: 15,
			trimAfterInFrames: 75,
		} );
	} );

	it( 'rounds the source boundaries before deriving duration so video and sequence cannot disagree by a frame', () => {
		const timeline = buildTimeline(
			[ clip( '1', { trimStart: 0.05, trimEnd: 1.02 } ) ],
			createDefaultSettings( 'none' )
		);
		expect( timeline.segments[ 0 ] ).toMatchObject( {
			start: 0,
			trimBeforeInFrames: 2,
			trimAfterInFrames: 31,
			durationInFrames: 29,
		} );
		expect( timeline.durationInFrames ).toBe( 29 );
	} );

	it( 'removes disabled cards completely and preserves source order when clips move', () => {
		const settings = {
			...createDefaultSettings(),
			showTitle: false,
			showEnding: false,
		};
		const timeline = buildTimeline(
			[ clip( '2' ), clip( '1' ) ],
			settings
		);
		expect( timeline.durationInFrames ).toBe( 600 );
		expect(
			timeline.segments.map(
				( segment ) => segment.type === 'clip' && segment.clip.id
			)
		).toEqual( [ '2', '1' ] );
		expect( timeline.segments[ 0 ].start ).toBe( 0 );
	} );

	it( 'makes the no-theme timeline raw footage even when saved card toggles are enabled', () => {
		const timeline = buildTimeline( [ clip( '1' ) ], {
			...createDefaultSettings(),
			themeId: 'none',
		} );
		expect( timeline.segments ).toHaveLength( 1 );
		expect( timeline.segments[ 0 ].type ).toBe( 'clip' );
		expect( timeline.durationInFrames ).toBe( 300 );
	} );

	it( 'reports an empty composition without inventing a duration', () => {
		expect( buildTimeline( [], createDefaultSettings( 'none' ) ) ).toEqual(
			{ durationInFrames: 0, segments: [] }
		);
	} );

	it( 'removes backgrounds from the main sequence and moves end clips after ordinary clips without changing their relative order', () => {
		const timeline = buildTimeline(
			[
				clip( '1', { tags: [ 'end' ], trimEnd: 1 } ),
				clip( '2', { trimEnd: 2 } ),
				clip( '3', { tags: [ 'background' ], trimEnd: 9 } ),
				clip( '4', { tags: [ 'end' ], trimEnd: 1 } ),
				clip( '5', { trimEnd: 2 } ),
				clip( '6', { tags: [ 'end' ], included: false } ),
			],
			{ ...createDefaultSettings(), titleDuration: 1, endingDuration: 1 }
		);
		expect(
			timeline.segments.map( ( segment ) => ( {
				id: segment.type === 'clip' ? segment.clip.id : segment.type,
				start: segment.start,
				duration: segment.durationInFrames,
			} ) )
		).toEqual( [
			{ id: 'title', start: 0, duration: 30 },
			{ id: '2', start: 30, duration: 60 },
			{ id: '5', start: 90, duration: 60 },
			{ id: '1', start: 150, duration: 30 },
			{ id: '4', start: 180, duration: 30 },
			{ id: 'ending', start: 210, duration: 30 },
		] );
		expect( timeline.durationInFrames ).toBe( 240 );
	} );

	it( 'does not create a playable sequence from background clips when both cards are disabled', () => {
		expect(
			buildTimeline( [ clip( '1', { tags: [ 'background' ] } ) ], {
				...createDefaultSettings(),
				backgroundClip: '1',
				showTitle: false,
				showEnding: false,
			} )
		).toEqual( { durationInFrames: 0, segments: [] } );
	} );

	it( 'selects a background by clip instance and preserves its trim for looping', () => {
		const background = clip( '2', {
			mediaId: 1,
			tags: [ 'background' ],
			trimStart: 1,
			trimEnd: 3,
		} );
		const clips = [ clip( '1', { tags: [ 'background' ] } ), background ];
		expect(
			getCardBackgroundClip( clips, {
				...createDefaultSettings(),
				backgroundClip: '2',
			} )
		).toBe( background );
		expect(
			getCardBackgroundClip( clips, createDefaultSettings() )
		).toBeUndefined();
		expect(
			getCardBackgroundClip( clips, createDefaultSettings( 'none' ) )
		).toBeUndefined();
	} );

	it.each( [
		{ clips: [] },
		{ clips: [ clip( '1' ) ] },
		{ clips: [ clip( '1', { tags: [ 'background' ], included: false } ) ] },
	] )(
		'rejects a missing, untagged, or excluded selected background',
		( { clips } ) => {
			expect( () =>
				getCardBackgroundClip( clips, {
					...createDefaultSettings(),
					backgroundClip: '1',
				} )
			).toThrow( 'included background clip' );
		}
	);

	it.each( [ 0, -1, NaN, Infinity ] )(
		'rejects unavailable or invalid source duration %s',
		( duration ) => {
			expect( () =>
				buildTimeline(
					[ clip( '1', { duration } ) ],
					createDefaultSettings()
				)
			).toThrow( 'duration' );
		}
	);

	it.each( [
		{ trimStart: -1, trimEnd: 3 },
		{ trimStart: 2, trimEnd: 2 },
		{ trimStart: 3, trimEnd: 2 },
		{ trimStart: 0, trimEnd: 11 },
		{ trimStart: NaN, trimEnd: 3 },
		{ trimStart: 0, trimEnd: Infinity },
	] )( 'rejects an invalid source interval %o', ( trim ) => {
		expect( () =>
			buildTimeline( [ clip( '1', trim ) ], createDefaultSettings() )
		).toThrow( 'trim' );
	} );

	it( 'rejects trim intervals shorter than one frame', () => {
		expect( () =>
			buildTimeline(
				[ clip( '1', { trimStart: 1, trimEnd: 1.001 } ) ],
				createDefaultSettings()
			)
		).toThrow( 'at least one frame' );
	} );

	it.each( [ 0, -1, NaN, Infinity, 0.001 ] )(
		'rejects a visible card with an invalid duration %s',
		( titleDuration ) => {
			expect( () =>
				buildTimeline( [], {
					...createDefaultSettings(),
					titleDuration,
				} )
			).toThrow( 'title card' );
		}
	);

	it( 'does not validate media or cards that are excluded from the composition', () => {
		expect(
			buildTimeline(
				[ clip( '1', { included: false, duration: NaN } ) ],
				{
					...createDefaultSettings(),
					showTitle: false,
					titleDuration: 0,
					showEnding: false,
					endingDuration: 0,
				}
			)
		).toEqual( { durationInFrames: 0, segments: [] } );
	} );

	it( 'provides the three output aspect ratios', () => {
		expect( getCompositionSize( 'portrait' ) ).toEqual( {
			width: 1080,
			height: 1920,
		} );
		expect( getCompositionSize( 'square' ) ).toEqual( {
			width: 1080,
			height: 1080,
		} );
		expect( getCompositionSize( 'landscape' ) ).toEqual( {
			width: 1920,
			height: 1080,
		} );
	} );

	it( 'returns independent, customizable preset settings', () => {
		const custom = createDefaultSettings();
		custom.accentColor = '#000000';
		expect( createDefaultSettings().accentColor ).toBe( '#f45b43' );
		expect( createDefaultSettings( 'wpvip' ) ).toMatchObject( {
			themeId: 'wpvip',
			fontFamily: 'serif',
		} );
	} );
} );
