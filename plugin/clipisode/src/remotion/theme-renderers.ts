import * as React from 'react';
import * as Remotion from 'remotion';
import type { ComponentType } from 'react';
import type { CompositionClip, CompositionSettings, ThemeDefinition } from './types';

export interface ThemeRenderer {
	Card: ComponentType< {
		settings: CompositionSettings;
		kind: 'title' | 'ending';
		hasBackground: boolean;
	} >;
	Overlay: ComponentType< {
		settings: CompositionSettings;
		name: string;
		clip?: CompositionClip;
	} >;
}

const renderers = new Map< string, ThemeRenderer >();
const loading = new Map< string, Promise< void > >();

function registerRenderer( id: string, renderer: ThemeRenderer ): void {
	if ( renderers.has( id ) || typeof renderer?.Card !== 'function' || typeof renderer?.Overlay !== 'function' ) {
		throw new Error( `Invalid or duplicate composition renderer: ${ id }` );
	}
	renderers.set( id, renderer );
}

window.ClipisodeThemeAPI = { React, Remotion, registerRenderer };

export function getThemeRenderer( id: string ): ThemeRenderer | undefined {
	return renderers.get( id );
}

export function isBuiltInRenderer( id: string ): boolean {
	return [ 'branded', 'editorial', 'baseball', 'plain' ].includes( id );
}

export function loadThemeRenderer( theme: ThemeDefinition ): Promise< void > {
	if ( isBuiltInRenderer( theme.renderer ) || renderers.has( theme.renderer ) ) {
		return Promise.resolve();
	}
	const existing = loading.get( theme.renderer );
	if ( existing ) {
		return existing;
	}
	if ( ! theme.rendererUrl ) {
		return Promise.reject(
			new Error( `Theme ${ theme.id } has no renderer URL.` )
		);
	}
	const promise = new Promise< void >( ( resolve, reject ) => {
		const script = document.createElement( 'script' );
		script.src = theme.rendererUrl!;
		script.onload = () => {
			if ( renderers.has( theme.renderer ) ) {
				resolve();
			} else {
				reject( new Error( `Theme ${ theme.id } did not register its renderer.` ) );
			}
		};
		script.onerror = () =>
			reject( new Error( `Theme ${ theme.id } renderer could not load.` ) );
		document.head.appendChild( script );
	} );
	loading.set( theme.renderer, promise );
	void promise.catch( () => loading.delete( theme.renderer ) );
	return promise;
}
