import {
	createContext,
	useContext,
	useEffect,
	useState,
	useCallback,
	useRef,
} from '@wordpress/element';
import { Button, Notice } from '@wordpress/components';
import apiFetch from '@wordpress/api-fetch';
import type { ReactNode } from 'react';
import type { OnboardingState, OnboardingAction } from '../types';

const Context = createContext< {
	state: OnboardingState | null;
	busy: boolean;
	refresh: () => Promise< void >;
	update: ( action: OnboardingAction ) => Promise< boolean >;
} >( {
	state: null,
	busy: false,
	refresh: async () => {},
	update: async () => false,
} );

export function OnboardingProvider( { children }: { children: ReactNode } ) {
	const [ state, setState ] = useState< OnboardingState | null >( null );
	const [ busy, setBusy ] = useState( false );
	const [ error, setError ] = useState( '' );
	const [ pending, setPending ] = useState< OnboardingAction | null >( null );
	const revision = useRef( 0 );
	const writing = useRef( false );
	const pendingAction = useRef< OnboardingAction | null >( null );
	const refresh = useCallback( async () => {
		if ( writing.current || pendingAction.current ) {
			return;
		}
		const current = ++revision.current;
		try {
			const result = await apiFetch< OnboardingState >( {
				path: '/clipisode/v1/onboarding',
			} );
			if ( revision.current === current ) {
				setState( result );
				setError( '' );
			}
		} catch ( caught ) {
			if ( revision.current === current ) {
				setError(
					( caught as Error ).message ||
						'Unable to load the getting-started guide.'
				);
			}
		}
	}, [] );
	const update = useCallback( async ( action: OnboardingAction ) => {
		if ( writing.current ) {
			return false;
		}
		writing.current = true;
		++revision.current;
		setBusy( true );
		setError( '' );
		try {
			setState(
				await apiFetch< OnboardingState >( {
					path: '/clipisode/v1/onboarding',
					method: 'POST',
					data: action,
				} )
			);
			setPending( null );
			pendingAction.current = null;
			return true;
		} catch ( caught ) {
			setPending( action );
			pendingAction.current = action;
			setError(
				( caught as Error ).message ||
					'Your work is saved, but guide progress could not be saved.'
			);
			return false;
		} finally {
			writing.current = false;
			setBusy( false );
		}
	}, [] );
	useEffect( () => {
		refresh();
	}, [ refresh ] );
	return (
		<Context.Provider value={ { state, busy, refresh, update } }>
			{ error && (
				<Notice status="warning" isDismissible={ false }>
					<p>{ error }</p>
					<Button
						variant="secondary"
						disabled={ busy }
						onClick={ () =>
							pending ? update( pending ) : refresh()
						}
					>
						Retry guide
					</Button>
				</Notice>
			) }
			{ children }
		</Context.Provider>
	);
}

export default function useOnboarding() {
	return useContext( Context );
}
