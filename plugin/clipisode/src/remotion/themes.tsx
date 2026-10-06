import { AbsoluteFill, Img, useCurrentFrame, useVideoConfig } from 'remotion';
import { useState } from '@wordpress/element';
import type { CSSProperties } from 'react';
import type { CompositionSettings, ThemeId } from './types';

interface ThemePreset {
	id: ThemeId;
	label: string;
	description: string;
	defaults: CompositionSettings;
}

const defaults: CompositionSettings = {
	themeId: 'default',
	format: 'portrait',
	title: '',
	subtitle: '',
	endingText: 'Thanks for watching',
	accentColor: '#f45b43',
	backgroundColor: '#171b2a',
	textColor: '#ffffff',
	fontFamily: 'sans',
	logoUrl: '',
	showNames: true,
	showTitle: true,
	showEnding: true,
	titleDuration: 3,
	endingDuration: 3,
	videoFit: 'cover',
};

export const themePresets: ThemePreset[] = [
	{
		id: 'default',
		label: 'Clipisode',
		description: 'Bold color, animated shapes, and confident name cards.',
		defaults,
	},
	{
		id: 'wpvip',
		label: 'Editorial',
		description:
			'Refined typography, clean rules, and understated name cards.',
		defaults: {
			...defaults,
			themeId: 'wpvip',
			accentColor: '#b79555',
			backgroundColor: '#f5f2ea',
			textColor: '#1e242b',
			fontFamily: 'serif',
		},
	},
	{
		id: 'none',
		label: 'No theme',
		description:
			'Video and original audio, without cards, names, or branding.',
		defaults: {
			...defaults,
			themeId: 'none',
			backgroundColor: '#000000',
			showNames: false,
			showTitle: false,
			showEnding: false,
		},
	},
];

export function createDefaultSettings(
	themeId: ThemeId = 'default'
): CompositionSettings {
	const preset = themePresets.find( ( theme ) => theme.id === themeId );
	if ( ! preset ) {
		throw new Error( `Unknown composition theme: ${ themeId }` );
	}
	return { ...preset.defaults };
}

export function getFontFamily( settings: CompositionSettings ): string {
	return settings.fontFamily === 'serif'
		? 'Georgia, "Times New Roman", serif'
		: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
}

function Logo( {
	settings,
	size,
}: {
	settings: CompositionSettings;
	size: number;
} ) {
	const [ error, setError ] = useState< Error | null >( null );
	if ( error ) {
		throw error;
	}
	if ( ! settings.logoUrl ) {
		return null;
	}
	return (
		<Img
			src={ settings.logoUrl }
			onError={ () =>
				setError(
					new Error( 'The logo could not load. Check its image URL.' )
				)
			}
			style={ {
				width: 'auto',
				height: size,
				maxWidth: size * 2.5,
				objectFit: 'contain',
			} }
		/>
	);
}

function entrance( frame: number, frames: number ): number {
	return 1 - Math.pow( 1 - Math.min( 1, Math.max( 0, frame / frames ) ), 3 );
}

export function ThemeCard( {
	settings,
	kind,
}: {
	settings: CompositionSettings;
	kind: 'title' | 'ending';
} ) {
	const frame = useCurrentFrame();
	const { width, height, fps } = useVideoConfig();
	if ( settings.themeId === 'none' ) {
		return null;
	}
	const unit = Math.min( width, height );
	const inset = unit * 0.085;
	const progress = entrance( frame, fps * 0.7 );
	const text = kind === 'title' ? settings.title : settings.endingText;
	const subtitle = kind === 'title' ? settings.subtitle : '';
	const editorial = settings.themeId === 'wpvip';
	const fontSize = Math.min(
		unit * 0.11,
		Math.max(
			unit * 0.042,
			( ( width - inset * 2 ) * 6 ) / Math.max( text.length, 1 )
		)
	);
	const textStyle: CSSProperties = {
		fontSize,
		lineHeight: editorial ? 1.12 : 1.06,
		fontWeight: editorial ? 400 : 750,
		letterSpacing: '-0.045em',
		whiteSpace: 'pre-wrap',
		overflowWrap: 'anywhere',
		margin: 0,
	};

	return (
		<AbsoluteFill
			style={ {
				backgroundColor: settings.backgroundColor,
				color: settings.textColor,
				fontFamily: getFontFamily( settings ),
				overflow: 'hidden',
			} }
		>
			{ editorial ? (
				<>
					<div
						style={ {
							position: 'absolute',
							top: inset,
							left: inset,
							right: inset,
							height: 3,
							backgroundColor: settings.accentColor,
							transform: `scaleX(${ progress })`,
							transformOrigin: 'left',
						} }
					/>
					<div
						style={ {
							position: 'absolute',
							bottom: inset,
							left: inset,
							right: inset,
							height: 3,
							backgroundColor: settings.accentColor,
						} }
					/>
				</>
			) : (
				<>
					<div
						style={ {
							position: 'absolute',
							width: unit * 0.95,
							height: unit * 0.95,
							borderRadius: '50%',
							backgroundColor: settings.accentColor,
							right: -unit * 0.3,
							top: -unit * 0.32,
							transform: `scale(${ 0.85 + progress * 0.15 })`,
						} }
					/>
					<div
						style={ {
							position: 'absolute',
							width: unit * 0.72,
							height: unit * 0.72,
							borderRadius: '50%',
							border: `${ unit * 0.002 }px solid ${
								settings.textColor
							}`,
							right: -unit * 0.22,
							top: -unit * 0.14,
							opacity: 0.3,
						} }
					/>
				</>
			) }
			<AbsoluteFill
				style={ {
					padding: inset,
					boxSizing: 'border-box',
					justifyContent: 'center',
					alignItems: 'flex-start',
				} }
			>
				<div
					style={ {
						position: 'absolute',
						top: inset * ( editorial ? 1.5 : 1 ),
						left: inset,
					} }
				>
					<Logo settings={ settings } size={ unit * 0.075 } />
				</div>
				<div
					style={ {
						width: '100%',
						transform: `translateY(${
							( 1 - progress ) * unit * 0.045
						}px)`,
					} }
				>
					{ ! editorial && (
						<div
							style={ {
								width: unit * 0.09,
								height: unit * 0.012,
								marginBottom: unit * 0.04,
								backgroundColor: settings.accentColor,
							} }
						/>
					) }
					<div style={ textStyle }>{ text }</div>
					{ subtitle && (
						<div
							style={ {
								marginTop: unit * 0.035,
								fontSize: unit * 0.032,
								lineHeight: 1.45,
								whiteSpace: 'pre-wrap',
								overflowWrap: 'anywhere',
								opacity: 0.8,
								maxWidth: '85%',
							} }
						>
							{ subtitle }
						</div>
					) }
				</div>
			</AbsoluteFill>
		</AbsoluteFill>
	);
}

export function ThemeOverlay( {
	settings,
	name,
}: {
	settings: CompositionSettings;
	name: string;
} ) {
	const frame = useCurrentFrame();
	const { width, height, fps } = useVideoConfig();
	if ( settings.themeId === 'none' ) {
		return null;
	}
	const unit = Math.min( width, height );
	const inset = unit * 0.065;
	const progress = entrance( frame, fps * 0.5 );
	const editorial = settings.themeId === 'wpvip';

	return (
		<AbsoluteFill
			style={ {
				color: settings.textColor,
				fontFamily: getFontFamily( settings ),
				pointerEvents: 'none',
			} }
		>
			{ settings.logoUrl && (
				<div
					style={ { position: 'absolute', top: inset, left: inset } }
				>
					<Logo settings={ settings } size={ unit * 0.065 } />
				</div>
			) }
			{ settings.showNames && name && (
				<div
					style={ {
						position: 'absolute',
						bottom: inset,
						left: inset,
						maxWidth: width - inset * 2,
						boxSizing: 'border-box',
						padding: `${ unit * 0.023 }px ${ unit * 0.032 }px`,
						backgroundColor: settings.backgroundColor,
						borderLeft: editorial
							? undefined
							: `${ unit * 0.008 }px solid ${
									settings.accentColor
							  }`,
						borderTop: editorial
							? `${ unit * 0.004 }px solid ${
									settings.accentColor
							  }`
							: undefined,
						borderRadius: editorial ? 0 : unit * 0.008,
						fontSize: unit * 0.043,
						fontWeight: editorial ? 400 : 650,
						lineHeight: 1.2,
						overflowWrap: 'anywhere',
						opacity: progress,
						transform: `translateY(${
							( 1 - progress ) * unit * 0.035
						}px)`,
					} }
				>
					{ name }
				</div>
			) }
		</AbsoluteFill>
	);
}
