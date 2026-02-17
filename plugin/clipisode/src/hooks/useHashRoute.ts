import { useState, useEffect, useCallback } from '@wordpress/element';

export default function useHashRoute(): { route: string; navigate: ( path: string | number ) => void } {
	const getRoute = (): string => window.location.hash.replace( /^#\/?/, '' ) || '';

	const [ route, setRouteState ] = useState< string >( getRoute );

	useEffect( () => {
		const onHashChange = () => setRouteState( getRoute() );
		window.addEventListener( 'hashchange', onHashChange );
		return () => window.removeEventListener( 'hashchange', onHashChange );
	}, [] );

	const navigate = useCallback( ( path: string | number ) => {
		window.location.hash = '#/' + path;
	}, [] );

	return { route, navigate };
}
