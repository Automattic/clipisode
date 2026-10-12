import themeJson from '../../../clipisode-nasa-theme/theme.json';
import { getVisibleGroups, validateThemeValues } from '../../src/remotion/theme-schema';
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
		expect( validateThemeValues( theme, settings, [ clip ] ) ).toEqual( [] );
		expect( theme.groups.flatMap( ( group ) => group.fields ) ).toHaveLength( 66 );
	} );

	it( 'reveals custom colors only in custom mode', () => {
		const presetFields = getVisibleGroups( theme, 'composition', settings )
			.flatMap( ( group ) => group.fields )
			.map( ( field ) => field.id );
		expect( presetFields ).not.toContain( 'accentColor' );
		const customFields = getVisibleGroups(
			theme,
			'composition',
			{ ...settings, visualStyle: 'custom' }
		)
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
} );
