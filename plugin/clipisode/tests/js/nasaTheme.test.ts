import themeJson from '../../../clipisode-nasa-theme/theme.json';
import {
	getVisibleGroups,
	validateThemeValues,
} from '../../src/remotion/theme-schema';
import type {
	CompositionClip,
	CompositionSettings,
	ThemeDefinition,
	ThemeValues,
} from '../../src/remotion/types';

const theme = themeJson as ThemeDefinition;

function defaults( scope: 'composition' | 'clip' ): ThemeValues {
	return Object.fromEntries(
		theme.groups
			.filter( ( group ) => group.scope === scope )
			.flatMap( ( group ) => group.fields )
			.map( ( field ) => [ field.id, field.default ] )
	);
}

const settings: CompositionSettings = {
	themeId: theme.id,
	themeVersion: theme.version,
	format: 'portrait',
	...defaults( 'composition' ),
};

const clip: CompositionClip = {
	id: 'mission-report',
	mediaId: 1,
	role: 'reply',
	name: 'Mae Jemison',
	url: 'https://example.com/mission.mp4',
	duration: 8,
	trimStart: 0,
	trimEnd: 8,
	included: true,
	tags: [],
	values: defaults( 'clip' ),
	slotId: 'transmissions',
};

describe( 'NASA Mission Control theme', () => {
	it( 'ships a complete valid default composition', () => {
		expect( validateThemeValues( theme, settings, [ clip ] ) ).toEqual(
			[]
		);
		expect( theme.id ).toBe( 'nasa-mission-control-v2' );
		expect( theme.version ).toBe( '1.1.0' );
		expect(
			theme.groups.flatMap( ( group ) => group.fields )
		).toHaveLength( 69 );
	} );

	it( 'reveals custom colors only in custom mode', () => {
		const presetFields = getVisibleGroups( theme, 'composition', settings )
			.flatMap( ( group ) => group.fields )
			.map( ( field ) => field.id );
		expect( presetFields ).not.toContain( 'accentColor' );
		const customFields = getVisibleGroups( theme, 'composition', {
			...settings,
			visualStyle: 'custom',
		} )
			.flatMap( ( group ) => group.fields )
			.map( ( field ) => field.id );
		expect( customFields ).toEqual(
			expect.arrayContaining( [
				'backgroundColor',
				'accentColor',
				'secondaryColor',
				'textColor',
			] )
		);
	} );

	it( 'defaults to a poster-first launch clock and deliberate clip reveals', () => {
		expect( settings.titleDuration ).toBe( 4.5 );
		expect( settings.posterHoldDuration ).toBe( 0.35 );
		expect( settings.countdownStyle ).toBe( 'orbital-dial' );
		expect( settings.countdownScale ).toBe( 100 );
		expect( settings.transitionDuration ).toBe( 1.2 );
		const transitions = theme.groups
			.flatMap( ( group ) => group.fields )
			.find( ( field ) => field.id === 'transitionType' );
		expect(
			transitions?.options?.map( ( option ) => option.value )
		).toEqual( [
			'orbital-iris',
			'launch-wipe',
			'signal-scan',
			'clean-fade',
			'hangar-doors',
			'solar-eclipse',
			'radar-sweep',
			'constellation-tiles',
			'none',
		] );
	} );
} );
