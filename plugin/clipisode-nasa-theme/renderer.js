( function () {
	const { React, Remotion, registerRenderer } = window.ClipisodeThemeAPI;
	const { createElement: el } = React;
	const { AbsoluteFill, Img, useCurrentFrame, useVideoConfig } = Remotion;
	const sans = '"Avenir Next", "Helvetica Neue", Arial, sans-serif';
	const archive = '"Courier New", "SFMono-Regular", Consolas, monospace';
	const future = '"Arial Narrow", "Avenir Next Condensed", "Helvetica Neue", sans-serif';
	const mono = '"SFMono-Regular", Consolas, "Liberation Mono", monospace';
	const stars = Array.from( { length: 80 }, ( _, index ) => ( {
		x: ( index * 47 + index * index * 13 ) % 997 / 10,
		y: ( index * 71 + index * index * 7 ) % 991 / 10,
		size: 0.7 + ( index * 17 % 24 ) / 10,
		phase: index * 0.71,
	} ) );

	function clamp( value, minimum = 0, maximum = 1 ) {
		return Math.min( maximum, Math.max( minimum, value ) );
	}

	function enter( frame, frames ) {
		const progress = clamp( frame / Math.max( 1, frames ) );
		return 1 - Math.pow( 1 - progress, 3 );
	}

	function rgba( hex, alpha ) {
		const value = /^#[0-9a-f]{6}$/i.test( hex || '' ) ? hex : '#ffffff';
		return `rgba(${ parseInt( value.slice( 1, 3 ), 16 ) }, ${ parseInt( value.slice( 3, 5 ), 16 ) }, ${ parseInt( value.slice( 5, 7 ), 16 ) }, ${ alpha })`;
	}

	function palette( settings ) {
		if ( settings.visualStyle === 'lunar-archive' ) {
			return { background: '#eee4cf', panel: '#ded0b4', accent: '#d84b20', secondary: '#2d5669', text: '#1b2529', muted: '#5e625f' };
		}
		if ( settings.visualStyle === 'deep-space' ) {
			return { background: '#070817', panel: '#11152d', accent: '#65e5ff', secondary: '#9a74ff', text: '#f8f8ff', muted: '#afb5d9' };
		}
		if ( settings.visualStyle === 'custom' ) {
			return { background: settings.backgroundColor, panel: settings.backgroundColor, accent: settings.accentColor, secondary: settings.secondaryColor, text: settings.textColor, muted: rgba( settings.textColor, 0.68 ) };
		}
		return { background: '#061528', panel: '#0b2340', accent: '#f04438', secondary: '#48a9ff', text: '#f7f3e8', muted: '#a9b8c8' };
	}

	function typeface( settings ) {
		return settings.typographyStyle === 'archive' ? archive : settings.typographyStyle === 'future' ? future : sans;
	}

	function RocketMark( { style = 'multistage', color, secondary, size, frame = 0, motion = true } ) {
		const rotate = motion ? Math.sin( frame * 0.025 ) * 1.5 : 0;
		const common = { fill: 'none', stroke: color, strokeWidth: 5, strokeLinecap: 'round', strokeLinejoin: 'round' };
		let art;
		if ( style === 'capsule' ) {
			art = [
				el( 'path', { key: 'body', ...common, d: 'M50 15 C35 28 31 51 34 72 L66 72 C69 51 65 28 50 15Z' } ),
				el( 'path', { key: 'window', ...common, d: 'M41 43 H59' } ),
				el( 'path', { key: 'fins', ...common, d: 'M34 58 L22 77 L35 73 M66 58 L78 77 L65 73' } ),
				el( 'path', { key: 'flame', fill: secondary, d: 'M42 75 C43 87 48 94 50 97 C52 94 57 87 58 75Z' } ),
			];
		} else if ( style === 'shuttle' ) {
			art = [
				el( 'path', { key: 'body', fill: color, d: 'M51 8 C44 22 42 41 43 56 L27 72 L33 80 L47 72 L48 88 L40 94 L60 94 L52 88 L53 72 L67 80 L73 72 L57 56 C58 41 56 22 51 8Z' } ),
				el( 'path', { key: 'window', fill: secondary, d: 'M47 31 H55 L53 40 H46Z' } ),
			];
		} else if ( style === 'swoosh' ) {
			art = [
				el( 'path', { key: 'rocket', fill: color, d: 'M68 10 C48 20 37 34 31 51 L45 55 L50 69 C67 61 79 49 88 29Z' } ),
				el( 'circle', { key: 'window', cx: 64, cy: 32, r: 6, fill: secondary } ),
				el( 'path', { key: 'swoosh', ...common, stroke: secondary, d: 'M14 88 C24 65 45 59 70 70' } ),
			];
		} else if ( style === 'patch' ) {
			art = [
				el( 'circle', { key: 'ring', ...common, cx: 50, cy: 50, r: 42 } ),
				el( 'ellipse', { key: 'orbit', ...common, stroke: secondary, cx: 50, cy: 50, rx: 37, ry: 15, transform: 'rotate(-32 50 50)' } ),
				el( 'path', { key: 'rocket', fill: color, d: 'M56 18 C44 29 40 43 42 59 L52 65 L61 56 C65 40 63 28 56 18Z' } ),
				el( 'path', { key: 'flame', fill: secondary, d: 'M43 58 C36 67 35 76 36 82 C43 78 49 72 51 64Z' } ),
			];
		} else if ( style === 'toy' ) {
			art = [
				el( 'path', { key: 'body', fill: color, d: 'M50 12 C37 26 32 42 34 65 Q50 75 66 65 C68 42 63 26 50 12Z' } ),
				el( 'circle', { key: 'window', cx: 50, cy: 42, r: 10, fill: secondary } ),
				el( 'path', { key: 'fins', fill: secondary, d: 'M34 56 L19 73 L35 70 M66 56 L81 73 L65 70' } ),
				el( 'path', { key: 'flame', fill: secondary, d: 'M42 71 Q50 96 58 71Z' } ),
			];
		} else {
			art = [
				el( 'path', { key: 'nose', fill: color, d: 'M50 7 L61 27 H39Z' } ),
				el( 'rect', { key: 'upper', x: 39, y: 28, width: 22, height: 30, rx: 2, fill: color } ),
				el( 'rect', { key: 'lower', x: 35, y: 60, width: 30, height: 19, rx: 2, fill: secondary } ),
				el( 'path', { key: 'fins', fill: color, d: 'M35 64 L22 80 H35 M65 64 L78 80 H65' } ),
				el( 'path', { key: 'flame', fill: secondary, d: 'M42 81 Q50 101 58 81Z' } ),
			];
		}
		return el( 'svg', { viewBox: '0 0 100 100', width: size, height: size, style: { display: 'block', transform: `rotate(${ rotate }deg)` } }, art );
	}

	function MissionPatch( { settings, colors, size, frame = 0, compact = false } ) {
		if ( ! settings.showPatch ) {
			return null;
		}
		const shape = settings.patchShape;
		const radius = shape === 'circle' ? '50%' : shape === 'shield' ? `${ size * 0.18 }px ${ size * 0.18 }px ${ size * 0.38 }px ${ size * 0.38 }px` : 0;
		return el( 'div', {
			style: {
				width: size, height: size, flex: '0 0 auto', boxSizing: 'border-box', position: 'relative',
				border: shape === 'none' ? 'none' : `${ Math.max( 1.5, size * 0.018 ) }px solid ${ rgba( colors.text, 0.65 ) }`,
				borderRadius: radius, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
				background: shape === 'none' ? 'transparent' : `radial-gradient(circle at 50% 38%, ${ rgba( colors.secondary, 0.2 ) }, ${ rgba( colors.background, 0.88 ) } 70%)`,
				boxShadow: shape === 'none' ? 'none' : `inset 0 0 0 ${ size * 0.035 }px ${ rgba( colors.accent, 0.4 ) }, 0 0 ${ size * 0.14 }px ${ rgba( colors.secondary, 0.18 ) }`,
				overflow: 'hidden',
			},
		},
		settings.logoStyle === 'custom' && settings.customLogoUrl
			? el( Img, { src: settings.customLogoUrl, style: { width: size * 0.52, height: size * 0.52, objectFit: 'contain' } } )
			: el( RocketMark, { style: settings.logoStyle, color: colors.text, secondary: colors.accent, size: size * ( compact ? 0.54 : 0.58 ), frame, motion: settings.motionLevel !== 'none' } ),
		! compact && el( 'div', { style: { position: 'absolute', bottom: size * 0.105, left: size * 0.08, right: size * 0.08, textAlign: 'center', fontFamily: mono, fontSize: size * 0.075, fontWeight: 800, lineHeight: 1, letterSpacing: '0.08em', color: colors.text, whiteSpace: 'nowrap', overflow: 'hidden' } }, settings.patchLabel )
		);
	}

	function Starfield( { settings, colors, frame, unit } ) {
		if ( ! settings.showStars ) {
			return null;
		}
		const density = Math.round( Number( settings.starDensity ) || 60 );
		const moving = settings.motionLevel !== 'none';
		return el( 'div', { style: { position: 'absolute', inset: 0, overflow: 'hidden' } }, stars.slice( 0, density ).map( ( star, index ) => el( 'span', {
			key: index,
			style: {
				position: 'absolute', left: `${ star.x }%`, top: `${ star.y }%`,
				width: star.size * unit * 0.0016, height: star.size * unit * 0.0016, borderRadius: '50%',
				backgroundColor: index % 13 === 0 ? colors.secondary : colors.text,
				transform: `translateY(${ moving && settings.starDrift ? Math.sin( frame * 0.008 + star.phase ) * unit * 0.012 : 0 }px)`,
				opacity: moving ? 0.28 + ( Math.sin( frame * 0.035 + star.phase ) + 1 ) * 0.22 : 0.5,
			},
		} ) ) );
	}

	function Grid( { settings, colors, frame, unit } ) {
		if ( ! settings.showGrid ) {
			return null;
		}
		const offset = settings.motionLevel === 'none' ? 0 : frame * 0.08;
		return el( 'div', { style: { position: 'absolute', inset: 0, opacity: settings.scene === 'technical-grid' ? 0.32 : 0.16, backgroundImage: `linear-gradient(${ rgba( colors.secondary, 0.46 ) } 1px, transparent 1px), linear-gradient(90deg, ${ rgba( colors.secondary, 0.46 ) } 1px, transparent 1px)`, backgroundSize: `${ unit * 0.075 }px ${ unit * 0.075 }px`, backgroundPosition: `${ offset }px ${ offset * 0.6 }px`, maskImage: 'linear-gradient(to bottom, black, transparent 88%)' } } );
	}

	function OrbitScene( { settings, colors, frame, width, height, unit, scale = 1 } ) {
		const rotate = settings.motionLevel !== 'none' && settings.orbitRotation ? frame * ( settings.motionLevel === 'cinematic' ? 0.11 : 0.035 ) : -12;
		const scene = settings.scene;
		const planetSize = unit * 0.92 * scale;
		if ( ! settings.showPlanet ) {
			return null;
		}
		if ( scene === 'lunar-surface' ) {
			return el( 'div', { style: { position: 'absolute', width: width * 1.15, height: height * 0.35, left: -width * 0.08, bottom: -height * 0.19, borderRadius: '50% 50% 0 0', background: `radial-gradient(circle at 25% 22%, ${ rgba( colors.text, 0.17 ) } 0 2%, transparent 2.5%), radial-gradient(circle at 62% 12%, ${ rgba( colors.text, 0.15 ) } 0 3%, transparent 3.5%), radial-gradient(circle at 78% 30%, ${ rgba( colors.text, 0.12 ) } 0 5%, transparent 5.5%), linear-gradient(${ colors.panel }, ${ rgba( colors.text, 0.35 ) })`, boxShadow: `0 -${ unit * 0.018 }px ${ unit * 0.08 }px ${ rgba( colors.text, 0.2 ) }` } } );
		}
		if ( scene === 'deep-field' ) {
			return el( 'div', { style: { position: 'absolute', width: planetSize * 0.55, height: planetSize * 0.55, right: -planetSize * 0.12, top: height * 0.08, borderRadius: '50%', background: `radial-gradient(circle at 35% 30%, ${ colors.secondary }, ${ colors.panel } 52%, ${ colors.background } 74%)`, boxShadow: `0 0 ${ unit * 0.16 }px ${ rgba( colors.secondary, 0.38 ) }` } }, settings.showOrbitLines && el( 'div', { style: { position: 'absolute', width: planetSize * 0.82, height: planetSize * 0.13, left: -planetSize * 0.14, top: planetSize * 0.2, border: `${ unit * 0.006 }px solid ${ rgba( colors.accent, 0.72 ) }`, borderRadius: '50%', transform: `rotate(${ -18 + rotate * 0.05 }deg)` } } ) );
		}
		if ( scene === 'technical-grid' ) {
			return el( 'div', { style: { position: 'absolute', width: planetSize * 0.72, height: planetSize * 0.72, right: -planetSize * 0.05, top: height * 0.14, borderRadius: '50%', border: `${ unit * 0.002 }px solid ${ rgba( colors.secondary, 0.55 ) }`, background: `repeating-radial-gradient(circle, transparent 0 ${ unit * 0.055 }px, ${ rgba( colors.secondary, 0.22 ) } ${ unit * 0.057 }px ${ unit * 0.059 }px)`, transform: `rotate(${ rotate }deg)` } } );
		}
		return el( 'div', { style: { position: 'absolute', width: planetSize, height: planetSize, right: -planetSize * 0.32, bottom: -planetSize * 0.38, borderRadius: '50%', background: `radial-gradient(circle at 28% 22%, ${ rgba( colors.secondary, 0.96 ) }, ${ colors.panel } 42%, ${ colors.background } 72%)`, boxShadow: `0 0 ${ unit * 0.12 }px ${ rgba( colors.secondary, 0.3 ) }, inset ${ unit * 0.08 }px ${ unit * 0.04 }px ${ unit * 0.16 }px ${ rgba( colors.background, 0.72 ) }` } }, settings.showOrbitLines && [ 0, 1, 2 ].map( ( index ) => el( 'div', { key: index, style: { position: 'absolute', width: planetSize * ( 1.05 + index * 0.16 ), height: planetSize * ( 0.34 + index * 0.05 ), left: -planetSize * ( 0.04 + index * 0.08 ), top: planetSize * ( 0.33 - index * 0.025 ), border: `${ unit * 0.0015 }px ${ index === 1 ? 'dashed' : 'solid' } ${ rgba( index === 2 ? colors.accent : colors.text, 0.34 ) }`, borderRadius: '50%', transform: `rotate(${ -18 + index * 14 + rotate }deg)` } } ) ) );
	}

	function FilmTexture( { settings, frame } ) {
		if ( ! settings.filmGrain ) {
			return null;
		}
		const angle = settings.motionLevel === 'none' ? 45 : 45 + frame % 3;
		return el( 'div', { style: { position: 'absolute', inset: 0, pointerEvents: 'none', opacity: 0.08, backgroundImage: `repeating-linear-gradient(${ angle }deg, rgba(255,255,255,.22) 0 1px, transparent 1px 4px)`, mixBlendMode: 'overlay' } } );
	}

	function Backdrop( { settings, colors, frame, width, height, unit, hasBackground = false, scale = 1 } ) {
		const vignette = Number( settings.vignetteStrength ) || 0;
		return el( React.Fragment, null,
			el( 'div', { style: { position: 'absolute', inset: 0, background: hasBackground ? rgba( colors.background, 0.82 ) : colors.background } } ),
			el( Grid, { settings, colors, frame, unit } ),
			el( Starfield, { settings, colors, frame, unit } ),
			el( OrbitScene, { settings, colors, frame, width, height, unit, scale } ),
			vignette > 0 && el( 'div', { style: { position: 'absolute', inset: 0, boxShadow: `inset 0 0 ${ unit * vignette / 170 }px ${ rgba( '#000000', vignette / ( settings.visualStyle === 'lunar-archive' ? 210 : 120 ) ) }` } } ),
			el( FilmTexture, { settings, frame } )
		);
	}

	function StatusPill( { settings, colors, unit, progress, label } ) {
		return el( 'div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: unit * 0.012, maxWidth: unit * 0.33, fontFamily: mono, fontSize: unit * 0.017, fontWeight: 800, letterSpacing: '0.1em', lineHeight: 1.25, textAlign: 'right', overflowWrap: 'anywhere', color: colors.text } },
			el( 'span', { style: { width: unit * 0.014, height: unit * 0.014, borderRadius: '50%', backgroundColor: colors.accent, boxShadow: `0 0 ${ unit * 0.025 }px ${ colors.accent }`, opacity: 0.55 + progress * 0.45 } } ),
			label || settings.statusLabel
		);
	}

	function Countdown( { settings, colors, frame, fps, unit } ) {
		if ( ! settings.showCountdown ) {
			return null;
		}
		const start = Math.max( 3, Math.min( 10, Number( settings.countdownFrom ) || 3 ) );
		const availableFrames = Math.max( 1, Number( settings.titleDuration ) * fps );
		const stepFrames = availableFrames / ( start + 1 );
		const value = Math.max( 0, start - Math.floor( frame / stepFrames ) );
		const pulse = settings.motionLevel === 'none' ? 1 : 0.7 + enter( frame % Math.max( 1, stepFrames ), stepFrames * 0.35 ) * 0.3;
		return el( 'div', { style: { display: 'flex', alignItems: 'baseline', gap: unit * 0.012, fontFamily: mono, color: colors.accent } },
			el( 'span', { style: { fontSize: unit * 0.015, letterSpacing: '0.12em', fontWeight: 800 } }, value > 0 ? 'T MINUS' : 'LIFTOFF' ),
			el( 'span', { style: { fontSize: unit * 0.05, lineHeight: 1, fontWeight: 900, transform: `scale(${ pulse })` } }, String( value ).padStart( 2, '0' ) )
		);
	}

	function Flyby( { settings, colors, frame, width, height, unit } ) {
		if ( ! settings.rocketFlyby || settings.motionLevel === 'none' ) {
			return null;
		}
		const x = -unit * 0.2 + ( frame * ( settings.motionLevel === 'cinematic' ? 5.3 : 2.2 ) ) % ( width + unit * 0.5 );
		return el( 'div', { style: { position: 'absolute', left: x, top: height * 0.16, transform: 'rotate(65deg)', opacity: 0.72 } }, el( RocketMark, { style: settings.logoStyle === 'custom' ? 'swoosh' : settings.logoStyle, color: colors.text, secondary: colors.accent, size: unit * 0.09, frame, motion: true } ) );
	}

	function Astronaut( { settings, colors, frame, width, height, unit } ) {
		if ( ! settings.floatingAstronaut ) {
			return null;
		}
		const bob = settings.motionLevel === 'none' ? 0 : Math.sin( frame * 0.025 ) * unit * 0.014;
		return el( 'svg', { viewBox: '0 0 100 140', width: unit * 0.105, height: unit * 0.147, style: { position: 'absolute', right: width * 0.08, top: height * 0.21 + bob, transform: `rotate(${ settings.motionLevel === 'none' ? -8 : -8 + Math.sin( frame * 0.012 ) * 6 }deg)`, opacity: 0.85 } },
			el( 'circle', { cx: 50, cy: 31, r: 23, fill: colors.text } ),
			el( 'circle', { cx: 50, cy: 32, r: 15, fill: colors.panel } ),
			el( 'rect', { x: 29, y: 52, width: 42, height: 49, rx: 15, fill: colors.text } ),
			el( 'path', { d: 'M30 61 L9 83 M70 61 L91 45 M40 98 L27 132 M60 98 L74 132', fill: 'none', stroke: colors.text, strokeWidth: 12, strokeLinecap: 'round' } ),
			el( 'rect', { x: 41, y: 67, width: 18, height: 14, fill: colors.accent } )
		);
	}

	function Satellite( { settings, colors, frame, width, height, unit } ) {
		if ( ! settings.satellitePass || settings.motionLevel === 'none' ) {
			return null;
		}
		const x = width + unit * 0.15 - ( frame * 1.7 ) % ( width + unit * 0.35 );
		return el( 'svg', { viewBox: '0 0 140 70', width: unit * 0.12, height: unit * 0.06, style: { position: 'absolute', left: x, top: height * 0.1, opacity: 0.72, transform: 'rotate(-9deg)' } },
			el( 'rect', { x: 52, y: 18, width: 36, height: 34, rx: 5, fill: colors.text } ),
			el( 'rect', { x: 2, y: 13, width: 43, height: 44, fill: colors.secondary } ),
			el( 'rect', { x: 95, y: 13, width: 43, height: 44, fill: colors.secondary } ),
			el( 'path', { d: 'M45 35 H52 M88 35 H95 M70 18 V3', stroke: colors.accent, strokeWidth: 4 } )
		);
	}

	function Card( { settings, kind, hasBackground } ) {
		const frame = useCurrentFrame();
		const { fps, width, height } = useVideoConfig();
		const unit = Math.min( width, height );
		const colors = palette( settings );
		const portrait = height > width * 1.15;
		const wide = width > height * 1.25;
		const centered = settings.titleAlignment === 'center';
		const inset = unit * 0.072;
		const still = settings.motionLevel === 'none';
		const primary = still ? 1 : enter( frame, fps * 0.72 );
		const secondary = still ? 1 : enter( Math.max( 0, frame - fps * 0.18 ), fps * 0.72 );
		const closing = kind === 'ending';
		const headline = closing ? settings.endingText : settings.missionName;
		const body = closing ? settings.endingMessage : settings.subtitle;
		const artScale = ( Number( settings.artworkScale ) || 100 ) / 100;
		const textWidth = centered ? width - inset * 2 : wide ? width * 0.58 : width - inset * 2;
		const headlineSize = Math.min( unit * ( portrait ? 0.09 : 0.098 ), Math.max( unit * 0.046, textWidth * 2.65 / Math.max( String( headline ).length, 19 ) ) );
		const patchSize = unit * ( portrait ? 0.17 : 0.15 );

		return el( AbsoluteFill, { style: { color: colors.text, fontFamily: typeface( settings ), overflow: 'hidden' } },
			el( Backdrop, { settings, colors, frame, width, height, unit, hasBackground, scale: artScale } ),
			closing && settings.missionCompleteStars && stars.slice( 0, 16 ).map( ( star, index ) => {
				const burst = still ? 1 : enter( Math.max( 0, frame - fps * 0.35 - index ), fps * 0.45 );
				return el( 'span', { key: `burst-${ index }`, style: { position: 'absolute', right: `${ 5 + Math.cos( index * 2.4 ) * ( 3 + index * 0.8 ) * burst }%`, bottom: `${ 7 + Math.sin( index * 2.4 ) * ( 3 + index * 0.65 ) * burst }%`, width: unit * 0.007, height: unit * 0.007, backgroundColor: index % 3 ? colors.text : colors.accent, transform: 'rotate(45deg)', opacity: burst * 0.72 } } );
			} ),
			el( Flyby, { settings, colors, frame, width, height, unit } ),
			el( Astronaut, { settings, colors, frame, width, height, unit } ),
			el( Satellite, { settings, colors, frame, width, height, unit } ),
			el( 'div', { style: { position: 'absolute', left: inset, right: inset, top: inset, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: unit * 0.035, opacity: secondary } },
				el( 'div', { style: { display: 'flex', alignItems: 'center', gap: unit * 0.025 } },
					el( MissionPatch, { settings, colors, size: patchSize, frame, compact: false } ),
					el( 'div', { style: { maxWidth: portrait ? width * 0.43 : width * 0.4, overflowWrap: 'anywhere' } },
						el( 'div', { style: { fontFamily: mono, fontSize: unit * 0.018, fontWeight: 800, lineHeight: 1.25, letterSpacing: '0.13em', color: colors.accent } }, settings.programName ),
						el( 'div', { style: { marginTop: unit * 0.009, fontFamily: mono, fontSize: unit * 0.015, letterSpacing: '0.1em', color: colors.muted } }, settings.designation )
					)
				),
				el( 'div', { style: { display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: unit * 0.016 } },
					el( StatusPill, { settings, colors, unit, progress: secondary, label: closing ? settings.closingStatusLabel : settings.statusLabel } ),
					! closing && el( Countdown, { settings, colors, frame, fps, unit } )
				)
			),
			el( 'div', { style: { position: 'absolute', left: centered ? inset : inset, right: centered ? inset : wide ? width * 0.34 : inset, top: portrait ? height * 0.39 : height * 0.31, textAlign: centered ? 'center' : 'left', opacity: primary, transform: `translateY(${ ( 1 - primary ) * unit * 0.065 }px)`, display: 'flex', flexDirection: 'column', alignItems: centered ? 'center' : 'flex-start' } },
				el( 'div', { style: { display: 'flex', alignItems: 'center', gap: unit * 0.016, marginBottom: unit * 0.03, fontFamily: mono, fontSize: unit * 0.017, fontWeight: 800, letterSpacing: '0.15em', color: colors.accent } },
					el( 'span', { style: { width: unit * 0.07, height: unit * 0.006, backgroundColor: colors.accent } } ),
					closing ? 'RETURN / DEBRIEF' : 'LAUNCH / TRANSMISSION'
				),
				el( 'div', { style: { maxWidth: textWidth, fontSize: headlineSize, lineHeight: 0.98, fontWeight: settings.typographyStyle === 'archive' ? 700 : 850, letterSpacing: settings.typographyStyle === 'future' ? '0.035em' : '-0.035em', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', textTransform: settings.typographyStyle === 'future' ? 'uppercase' : 'none', textShadow: `0 ${ unit * 0.01 }px ${ unit * 0.04 }px ${ rgba( colors.background, 0.72 ) }` } }, headline ),
				body && el( 'div', { style: { maxWidth: textWidth * 0.78, marginTop: unit * 0.03, fontSize: unit * 0.027, lineHeight: 1.35, color: colors.muted, whiteSpace: 'pre-wrap' } }, body ),
				closing && ( settings.ctaText || settings.ctaUrl ) && el( 'div', { style: { marginTop: unit * 0.04, display: 'flex', flexWrap: 'wrap', gap: unit * 0.02, alignItems: 'center', fontFamily: mono, fontSize: unit * 0.016, letterSpacing: '0.1em' } },
					settings.ctaText && el( 'span', { style: { padding: `${ unit * 0.012 }px ${ unit * 0.018 }px`, backgroundColor: colors.accent, color: colors.background, fontWeight: 900 } }, settings.ctaText ),
					settings.ctaUrl && el( 'span', { style: { color: colors.text } }, settings.ctaUrl )
				)
			),
			closing && settings.showMissionComplete && el( 'div', { style: { position: 'absolute', right: inset, bottom: inset * 1.45, opacity: secondary, transform: `rotate(${ -8 + ( settings.motionLevel === 'none' ? 0 : Math.sin( frame * 0.02 ) * 2 ) }deg)` } },
				el( 'div', { style: { width: unit * 0.17, height: unit * 0.17, boxSizing: 'border-box', padding: unit * 0.018, borderRadius: '50%', border: `${ unit * 0.006 }px double ${ colors.accent }`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: mono, fontSize: unit * 0.014, fontWeight: 900, lineHeight: 1.18, letterSpacing: '0.055em', textAlign: 'center', color: colors.accent, backgroundColor: rgba( colors.background, 0.72 ) } },
					el( 'span', { style: { display: 'block' } }, 'MISSION' ),
					el( 'span', { style: { display: 'block' } }, 'COMPLETE' )
				)
			),
			el( 'div', { style: { position: 'absolute', left: inset, right: inset, bottom: inset, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: `${ unit * 0.0015 }px solid ${ rgba( colors.text, 0.38 ) }`, paddingTop: unit * 0.018, fontFamily: mono, fontSize: unit * 0.014, letterSpacing: '0.1em', color: colors.muted } },
				el( 'span', null, closing ? 'END OF TRANSMISSION' : 'FLIGHT SYSTEMS NOMINAL' ),
				el( 'span', { style: { color: colors.accent } }, settings.designation )
			)
		);
	}

	function Transition( { type, duration, settings, colors, frame, fps, width, height, unit } ) {
		if ( type === 'none' || settings.motionLevel === 'none' ) {
			return null;
		}
		const progress = enter( frame, fps * Number( duration || 0.45 ) );
		if ( progress >= 1 ) {
			return null;
		}
		if ( type === 'launch-wipe' ) {
			return el( 'div', { style: { position: 'absolute', inset: 0, backgroundColor: colors.background, transform: `translateY(${ -progress * 104 }%)`, boxShadow: `0 ${ unit * 0.02 }px 0 ${ colors.accent }, 0 ${ unit * 0.05 }px ${ unit * 0.08 }px ${ rgba( colors.accent, 0.35 ) }` } } );
		}
		if ( type === 'signal-scan' ) {
			return el( React.Fragment, null,
				el( 'div', { style: { position: 'absolute', inset: 0, backgroundColor: colors.background, opacity: 1 - progress } } ),
				Array.from( { length: 12 }, ( _, index ) => el( 'div', { key: index, style: { position: 'absolute', left: 0, right: 0, top: `${ index * 9 + progress * 18 - 16 }%`, height: `${ 8 - progress * 6 }%`, backgroundColor: index % 3 === 0 ? colors.accent : colors.background, opacity: ( 1 - progress ) * ( index % 3 === 0 ? 0.9 : 0.65 ), transform: `translateX(${ ( index % 2 ? 1 : -1 ) * progress * width * 0.12 }px)` } } ) )
			);
		}
		if ( type === 'clean-fade' ) {
			return el( 'div', { style: { position: 'absolute', inset: 0, backgroundColor: colors.background, opacity: 1 - progress } } );
		}
		const diameter = Math.max( width, height ) * ( 0.02 + progress * 1.7 );
		return el( 'div', { style: { position: 'absolute', width: diameter, height: diameter, borderRadius: '50%', left: width * 0.5 - diameter * 0.5, top: height * 0.5 - diameter * 0.5, boxShadow: `0 0 0 ${ Math.max( width, height ) * 2 }px ${ colors.background }, 0 0 ${ unit * 0.08 }px ${ unit * 0.015 }px ${ colors.secondary }`, border: `${ unit * 0.005 }px solid ${ colors.accent }` } } );
	}

	function FrameCorners( { colors, unit, inset } ) {
		const length = unit * 0.07;
		const border = `${ unit * 0.003 }px solid ${ rgba( colors.text, 0.64 ) }`;
		return [ [ 'top', 'left' ], [ 'top', 'right' ], [ 'bottom', 'left' ], [ 'bottom', 'right' ] ].map( ( sides, index ) => {
			const style = { position: 'absolute', width: length, height: length, [ sides[ 0 ] ]: inset, [ sides[ 1 ] ]: inset };
			style[ `border${ sides[ 0 ][ 0 ].toUpperCase() + sides[ 0 ].slice( 1 ) }` ] = border;
			style[ `border${ sides[ 1 ][ 0 ].toUpperCase() + sides[ 1 ].slice( 1 ) }` ] = border;
			return el( 'div', { key: index, style } );
		} );
	}

	function timecode( frame, fps ) {
		const seconds = Math.floor( frame / fps );
		return `${ String( Math.floor( seconds / 60 ) ).padStart( 2, '0' ) }:${ String( seconds % 60 ).padStart( 2, '0' ) }:${ String( frame % fps ).padStart( 2, '0' ) }`;
	}

	function Overlay( { settings, name, clip } ) {
		const frame = useCurrentFrame();
		const { fps, width, height } = useVideoConfig();
		const unit = Math.min( width, height );
		const colors = palette( settings );
		const values = clip?.values || {};
		const transition = values.transitionOverride && values.transitionOverride !== 'theme' ? values.transitionOverride : settings.transitionType;
		const lowerThird = values.lowerThirdOverride && values.lowerThirdOverride !== 'theme' ? values.lowerThirdOverride : settings.lowerThirdStyle;
		const corner = values.overlayCornerOverride && values.overlayCornerOverride !== 'theme' ? values.overlayCornerOverride : settings.overlayCorner || 'bottom-left';
		const top = corner.startsWith( 'top' );
		const right = corner.endsWith( 'right' );
		const inset = unit * 0.052;
		const progress = settings.motionLevel === 'none' ? 1 : enter( frame, fps * 0.48 );
		const clipDuration = clip ? Math.max( 1 / fps, clip.trimEnd - clip.trimStart ) : Number( settings.transitionDuration );
		const transitionDuration = Math.min( Number( settings.transitionDuration ), clipDuration * 0.35 );
		const callsign = values.callsign;
		const role = values.speakerRole;
		const location = values.locationLabel;
		const segment = values.segmentLabel || 'FIELD REPORT';
		if ( values.hideOverlay ) {
			return el( AbsoluteFill, { style: { pointerEvents: 'none' } }, el( Transition, { type: transition, duration: transitionDuration, settings, colors, frame, fps, width, height, unit } ) );
		}
		const label = callsign || name;
		const align = right ? 'right' : 'left';
		const lowerStyle = lowerThird === 'minimal'
			? { backgroundColor: rgba( colors.background, 0.78 ), borderBottom: `${ unit * 0.003 }px solid ${ colors.accent }` }
			: lowerThird === 'mission-patch'
				? { backgroundColor: rgba( colors.panel, 0.92 ), border: `${ unit * 0.0015 }px solid ${ rgba( colors.text, 0.45 ) }`, borderRadius: unit * 0.012 }
				: { background: `linear-gradient(90deg, ${ rgba( colors.background, 0.96 ) }, ${ rgba( colors.panel, 0.84 ) })`, borderLeft: `${ unit * 0.009 }px solid ${ colors.accent }` };

		return el( AbsoluteFill, { style: { pointerEvents: 'none', color: colors.text, fontFamily: typeface( settings ) } },
			el( 'div', { style: { position: 'absolute', inset: 0, background: `linear-gradient(to ${ top ? 'bottom' : 'top' }, ${ rgba( colors.background, 0.74 ) }, transparent 34%)` } } ),
			settings.showFrameCorners && el( FrameCorners, { colors, unit, inset } ),
			settings.showPatchWatermark && el( 'div', { style: { position: 'absolute', top: inset, [ right ? 'left' : 'right' ]: inset, opacity: 0.28 } }, el( MissionPatch, { settings, colors, size: unit * 0.12, frame, compact: true } ) ),
			settings.showTelemetry && el( 'div', { style: { position: 'absolute', top: inset, [ right ? 'right' : 'left' ]: inset, display: 'flex', alignItems: 'center', gap: unit * 0.016, fontFamily: mono, fontSize: unit * 0.014, letterSpacing: '0.1em', color: colors.text, opacity: 0.82 } },
				el( 'span', { style: { width: unit * 0.012, height: unit * 0.012, borderRadius: '50%', backgroundColor: colors.accent, boxShadow: `0 0 ${ unit * 0.02 }px ${ colors.accent }`, opacity: settings.motionLevel === 'none' ? 1 : 0.65 + Math.sin( frame * 0.16 ) * 0.35 } } ),
				el( 'span', null, settings.telemetryLabel ),
				el( 'span', { style: { color: colors.secondary } }, settings.showTimer ? timecode( frame, fps ) : 'SIGNAL LOCKED' )
			),
			settings.signalStamp && ( settings.motionLevel === 'none' || ( frame > fps * 0.58 && frame < fps * 2.2 ) ) && el( 'div', { style: { position: 'absolute', [ right ? 'left' : 'right' ]: inset, [ top ? 'bottom' : 'top' ]: top ? height * 0.13 : height * 0.22, padding: `${ unit * 0.012 }px ${ unit * 0.02 }px`, border: `${ unit * 0.004 }px solid ${ colors.accent }`, color: colors.accent, fontFamily: mono, fontSize: unit * 0.018, fontWeight: 900, letterSpacing: '0.12em', transform: 'rotate(-6deg)', opacity: settings.motionLevel === 'none' ? 1 : clamp( ( frame - fps * 0.58 ) / ( fps * 0.2 ) ) } }, 'SIGNAL ACQUIRED' ),
			( settings.showNames || role || location ) && el( 'div', { style: { position: 'absolute', [ top ? 'top' : 'bottom' ]: top ? height * 0.14 : inset, [ right ? 'right' : 'left' ]: inset, maxWidth: Math.min( width - inset * 2, width * ( height > width ? 0.86 : 0.58 ) ), minWidth: lowerThird === 'minimal' ? 0 : unit * 0.34, boxSizing: 'border-box', padding: lowerThird === 'minimal' ? `${ unit * 0.015 }px 0` : `${ unit * 0.021 }px ${ unit * 0.027 }px`, textAlign: align, opacity: progress, transform: `translate${ right ? 'X' : 'Y' }(${ ( 1 - progress ) * ( right ? unit * 0.04 : unit * 0.045 ) }px)`, ...lowerStyle } },
				el( 'div', { style: { display: 'flex', justifyContent: right ? 'flex-end' : 'flex-start', alignItems: 'center', gap: unit * 0.014, marginBottom: unit * 0.012, color: colors.accent, fontFamily: mono, fontSize: unit * 0.014, fontWeight: 800, letterSpacing: '0.13em' } },
					lowerThird === 'mission-patch' && el( RocketMark, { style: settings.logoStyle === 'custom' ? 'patch' : settings.logoStyle, color: colors.text, secondary: colors.accent, size: unit * 0.045, frame, motion: settings.motionLevel !== 'none' } ),
					segment
				),
				settings.showNames && label && el( 'div', { style: { fontSize: unit * 0.036, fontWeight: 820, lineHeight: 1.08, overflowWrap: 'anywhere', letterSpacing: '-0.012em' } }, label ),
				name && callsign && settings.showNames && el( 'div', { style: { marginTop: unit * 0.006, fontSize: unit * 0.019, color: colors.muted } }, name ),
				( role || location ) && el( 'div', { style: { display: 'flex', justifyContent: right ? 'flex-end' : 'flex-start', flexWrap: 'wrap', gap: unit * 0.018, maxWidth: '100%', marginTop: unit * 0.012, fontFamily: mono, fontSize: unit * 0.015, lineHeight: 1.25, letterSpacing: '0.07em', overflowWrap: 'anywhere', color: colors.muted } },
					role && el( 'span', { style: { maxWidth: '100%' } }, role ),
					location && el( 'span', { style: { maxWidth: '100%', color: colors.secondary } }, `◉ ${ location }` )
				)
			),
			el( Transition, { type: transition, duration: transitionDuration, settings, colors, frame, fps, width, height, unit } )
		);
	}

	registerRenderer( 'nasa-mission-control', { Card, Overlay } );
} )();
