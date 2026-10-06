import { AbsoluteFill, Img, useCurrentFrame, useVideoConfig } from 'remotion';
import { useState } from '@wordpress/element';
import type { CSSProperties } from 'react';
import { getThemeDefinition, themeDefinitions } from './theme-schema';
import type { CompositionClip, CompositionSettings } from './types';

export { createDefaultSettings } from './theme-schema';
export const themePresets = themeDefinitions;

interface BrandedSettings extends CompositionSettings {
	title: string;
	subtitle: string;
	endingText: string;
	accentColor: string;
	backgroundColor: string;
	textColor: string;
	fontFamily: 'sans' | 'serif';
	logoUrl: string;
	showNames: boolean;
}

function rendererFor( settings: CompositionSettings ): string {
	const renderer = getThemeDefinition( settings.themeId ).renderer;
	if ( ! [ 'branded', 'editorial', 'plain' ].includes( renderer ) ) {
		throw new Error(
			`No composition renderer is registered for ${ renderer }.`
		);
	}
	return renderer;
}

export function getCompositionBackground(
	settings: CompositionSettings
): string {
	const { canvas } = getThemeDefinition( settings.themeId );
	const color = canvas.backgroundField
		? settings[ canvas.backgroundField ]
		: canvas.backgroundColor;
	if ( typeof color !== 'string' ) {
		throw new Error( 'The theme must supply a canvas background color.' );
	}
	return color;
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
	settings: BrandedSettings;
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
	settings: inputSettings,
	kind,
	hasBackground = false,
}: {
	settings: CompositionSettings;
	kind: 'title' | 'ending';
	hasBackground?: boolean;
} ) {
	const frame = useCurrentFrame();
	const { width, height, fps } = useVideoConfig();
	const renderer = rendererFor( inputSettings );
	if ( renderer === 'plain' ) {
		return null;
	}
	const settings = inputSettings as BrandedSettings;
	const unit = Math.min( width, height );
	const inset = unit * 0.085;
	const progress = entrance( frame, fps * 0.7 );
	const text = kind === 'title' ? settings.title : settings.endingText;
	const subtitle = kind === 'title' ? settings.subtitle : '';
	const editorial = renderer === 'editorial';
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
				backgroundColor: hasBackground
					? `${ settings.backgroundColor }cc`
					: settings.backgroundColor,
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
	settings: inputSettings,
	name,
	clip,
}: {
	settings: CompositionSettings;
	name: string;
	clip?: CompositionClip;
} ) {
	const frame = useCurrentFrame();
	const { width, height, fps } = useVideoConfig();
	const renderer = rendererFor( inputSettings );
	if ( renderer === 'plain' ) {
		return null;
	}
	const settings = inputSettings as BrandedSettings;
	const unit = Math.min( width, height );
	const inset = unit * 0.065;
	const progress = entrance( frame, fps * 0.5 );
	const editorial = renderer === 'editorial';
	const caption =
		typeof clip?.values?.caption === 'string' ? clip.values.caption : '';
	const movie =
		editorial &&
		clip?.role === 'reply' &&
		typeof clip.values?.favoriteMovie === 'string'
			? clip.values.favoriteMovie
			: '';
	const detail = [ caption, movie ? `Favorite movie: ${ movie }` : '' ]
		.filter( Boolean )
		.join( '\n' );

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
					{ detail && (
						<div
							style={ {
								marginTop: unit * 0.012,
								fontSize: unit * 0.025,
								fontWeight: 400,
								lineHeight: 1.4,
								whiteSpace: 'pre-wrap',
							} }
						>
							{ detail }
						</div>
					) }
				</div>
			) }
		</AbsoluteFill>
	);
}
