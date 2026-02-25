import { renderHook, act } from '@testing-library/react';
import useHashRoute from '../../src/hooks/useHashRoute';

describe( 'useHashRoute', () => {
	beforeEach( () => {
		window.location.hash = '';
	} );

	it( 'returns empty string when hash is empty', () => {
		window.location.hash = '';
		const { result } = renderHook( () => useHashRoute() );
		expect( result.current.route ).toBe( '' );
	} );

	it( 'parses hash without leading slash', () => {
		window.location.hash = '#topics';
		const { result } = renderHook( () => useHashRoute() );
		expect( result.current.route ).toBe( 'topics' );
	} );

	it( 'parses hash with leading slash', () => {
		window.location.hash = '#/topics/123';
		const { result } = renderHook( () => useHashRoute() );
		expect( result.current.route ).toBe( 'topics/123' );
	} );

	it( 'navigate sets hash with leading slash', () => {
		const { result } = renderHook( () => useHashRoute() );

		act( () => {
			result.current.navigate( 'replies' );
		} );

		expect( window.location.hash ).toBe( '#/replies' );
	} );

	it( 'navigate accepts number', () => {
		const { result } = renderHook( () => useHashRoute() );

		act( () => {
			result.current.navigate( 42 );
		} );

		expect( window.location.hash ).toBe( '#/42' );
	} );

	it( 'updates route on hashchange event', () => {
		window.location.hash = '';
		const { result } = renderHook( () => useHashRoute() );

		expect( result.current.route ).toBe( '' );

		act( () => {
			window.location.hash = '#/new-route';
			window.dispatchEvent( new HashChangeEvent( 'hashchange' ) );
		} );

		expect( result.current.route ).toBe( 'new-route' );
	} );
} );
