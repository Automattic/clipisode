import { AbsoluteFill, Img, useCurrentFrame, useVideoConfig } from 'remotion';
import { getThemeDefinition } from './theme-schema';
import { mlbTeamLogos } from './mlb-team-logos';
import type { CompositionClip, CompositionSettings } from './types';

interface BaseballSettings extends CompositionSettings {
	title: string;
	subtitle: string;
	endingText: string;
	backgroundColor: string;
	accentColor: string;
	textColor: string;
	showNames: boolean;
}

const teamField = getThemeDefinition( 'baseball' )
	.groups.flatMap( ( group ) => group.fields )
	.find( ( field ) => field.id === 'teamPick' );

export function getBaseballTeam( id: unknown ) {
	if ( id === null || id === undefined ) {
		return null;
	}
	if ( typeof id !== 'string' ) {
		throw new Error( 'The baseball team pick must be a team ID.' );
	}
	const name = teamField?.options?.find( ( option ) => option.value === id )
		?.label;
	const logo = mlbTeamLogos[ id ];
	if ( ! name || ! logo ) {
		throw new Error( `Unknown MLB team pick: ${ id }.` );
	}
	return { id, name, logo };
}

export function BaseballCard( {
	settings: inputSettings,
	kind,
	hasBackground,
}: {
	settings: CompositionSettings;
	kind: 'title' | 'ending';
	hasBackground: boolean;
} ) {
	const settings = inputSettings as BaseballSettings;
	const frame = useCurrentFrame();
	const { width, height, fps } = useVideoConfig();
	const unit = Math.min( width, height );
	const inset = unit * 0.08;
	const progress = Math.min( 1, frame / ( fps * 0.45 ) );
	const headline = kind === 'title' ? settings.title : settings.endingText;
	const subtitle = kind === 'title' ? settings.subtitle : '';
	return (
		<AbsoluteFill
			style={ {
				backgroundColor: hasBackground
					? `${ settings.backgroundColor }dd`
					: settings.backgroundColor,
				color: settings.textColor,
				fontFamily: 'Georgia, "Times New Roman", serif',
				overflow: 'hidden',
			} }
		>
			<div
				style={ {
					position: 'absolute',
					width: unit * 0.62,
					height: unit * 0.62,
					left: ( width - unit * 0.62 ) / 2,
					top: height * 0.2,
					border: `${ unit * 0.005 }px solid ${
						settings.accentColor
					}`,
					transform: 'rotate(45deg)',
					opacity: 0.38,
				} }
			/>
			<div
				style={ {
					position: 'absolute',
					top: inset,
					left: inset,
					right: inset,
					display: 'flex',
					justifyContent: 'space-between',
					borderTop: `${ unit * 0.007 }px solid ${
						settings.accentColor
					}`,
					paddingTop: unit * 0.024,
					fontFamily: 'Arial, sans-serif',
					fontSize: unit * 0.022,
					fontWeight: 700,
					letterSpacing: '0.13em',
				} }
			>
				<span>CLIPISODE BASEBALL</span>
				<span>{ kind === 'title' ? 'FIRST PITCH' : 'FINAL OUT' }</span>
			</div>
			<AbsoluteFill
				style={ {
					padding: inset,
					boxSizing: 'border-box',
					justifyContent: 'center',
					alignItems: 'center',
					textAlign: 'center',
					opacity: progress,
					transform: `translateY(${
						( 1 - progress ) * unit * 0.04
					}px)`,
				} }
			>
				<div
					style={ {
						fontFamily: 'Arial, sans-serif',
						fontSize: unit * 0.028,
						fontWeight: 700,
						letterSpacing: '0.16em',
						color: settings.accentColor,
						marginBottom: unit * 0.04,
					} }
				>
					{ kind === 'title' ? 'THE QUESTION' : 'THAT’S THE GAME' }
				</div>
				<div
					style={ {
						fontSize: unit * 0.085,
						fontWeight: 700,
						lineHeight: 1.08,
						overflowWrap: 'anywhere',
						whiteSpace: 'pre-wrap',
						maxWidth: width - inset * 2,
					} }
				>
					{ headline }
				</div>
				{ subtitle && (
					<div
						style={ {
							fontFamily: 'Arial, sans-serif',
							fontSize: unit * 0.031,
							lineHeight: 1.35,
							marginTop: unit * 0.045,
							whiteSpace: 'pre-wrap',
						} }
					>
						{ subtitle }
					</div>
				) }
			</AbsoluteFill>
			<div
				style={ {
					position: 'absolute',
					bottom: inset,
					left: inset,
					right: inset,
					borderBottom: `${ unit * 0.007 }px solid ${
						settings.accentColor
					}`,
				} }
			/>
		</AbsoluteFill>
	);
}

export function BaseballOverlay( {
	settings: inputSettings,
	clip,
}: {
	settings: CompositionSettings;
	clip?: CompositionClip;
} ) {
	const settings = inputSettings as BaseballSettings;
	const frame = useCurrentFrame();
	const { width, height, fps } = useVideoConfig();
	const unit = Math.min( width, height );
	const inset = unit * 0.055;
	const progress = Math.min( 1, frame / ( fps * 0.4 ) );
	const team = getBaseballTeam( clip?.values?.teamPick );
	return (
		<AbsoluteFill
			style={ {
				pointerEvents: 'none',
				fontFamily: 'Arial, sans-serif',
				color: settings.textColor,
			} }
		>
			{ team && (
				<div
					style={ {
						position: 'absolute',
						top: inset,
						right: inset,
						width: Math.min( width * 0.55, unit * 0.64 ),
						boxSizing: 'border-box',
						padding: unit * 0.02,
						backgroundColor: '#f6f1e7',
						color: '#071c32',
						borderBottom: `${ unit * 0.009 }px solid ${
							settings.accentColor
						}`,
						display: 'flex',
						alignItems: 'center',
						gap: unit * 0.018,
						opacity: progress,
					} }
				>
					<Img
						src={ team.logo }
						alt={ `${ team.name } logo` }
						style={ {
							width: unit * 0.12,
							height: unit * 0.12,
							objectFit: 'contain',
							flexShrink: 0,
						} }
					/>
					<div>
						<div
							style={ {
								fontSize: unit * 0.019,
								fontWeight: 700,
								letterSpacing: '0.12em',
								marginBottom: unit * 0.008,
							} }
						>
							TEAM PICK
						</div>
						<div
							style={ {
								fontSize: unit * 0.031,
								fontWeight: 750,
								lineHeight: 1.08,
							} }
						>
							{ team.name }
						</div>
					</div>
				</div>
			) }
			{ settings.showNames && clip?.name && (
				<div
					style={ {
						position: 'absolute',
						bottom: inset,
						left: inset,
						maxWidth: width - inset * 2,
						boxSizing: 'border-box',
						padding: `${ unit * 0.022 }px ${ unit * 0.03 }px`,
						backgroundColor: settings.backgroundColor,
						borderLeft: `${ unit * 0.009 }px solid ${
							settings.accentColor
						}`,
						fontSize: unit * 0.04,
						fontWeight: 700,
						lineHeight: 1.15,
						opacity: progress,
					} }
				>
					{ clip.name }
				</div>
			) }
		</AbsoluteFill>
	);
}
