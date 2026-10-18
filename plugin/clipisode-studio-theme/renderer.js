( function () {
	const { React, Remotion, registerRenderer } = window.ClipisodeThemeAPI;
	const { createElement: element } = React;
	const { AbsoluteFill, useCurrentFrame, useVideoConfig } = Remotion;

	function Card( { settings, kind } ) {
		const frame = useCurrentFrame();
		const { fps, width, height } = useVideoConfig();
		const size = Math.min( width, height );
		const progress = Math.min( 1, frame / ( fps * 0.5 ) );
		return element(
			AbsoluteFill,
			{
				style: {
					backgroundColor: settings.backgroundColor,
					color: settings.textColor,
					fontFamily: 'Arial, sans-serif',
					justifyContent: 'center',
					padding: size * 0.1,
					boxSizing: 'border-box',
				},
			},
			element( 'div', {
				style: {
					width: size * 0.16,
					height: size * 0.012,
					backgroundColor: settings.accentColor,
					marginBottom: size * 0.045,
				},
			} ),
			element(
				'div',
				{
					style: {
						fontSize: size * 0.095,
						fontWeight: 800,
						lineHeight: 1.08,
						opacity: progress,
						transform: `translateY(${ ( 1 - progress ) * size * 0.06 }px)`,
					},
				},
				kind === 'title' ? settings.title : settings.endingText
			)
		);
	}

	function Overlay( { settings, name } ) {
		const frame = useCurrentFrame();
		const { fps, width, height } = useVideoConfig();
		if ( ! settings.showNames || ! name ) {
			return null;
		}
		const size = Math.min( width, height );
		return element(
			AbsoluteFill,
			{ style: { pointerEvents: 'none' } },
			element(
				'div',
				{
					style: {
						position: 'absolute',
						left: size * 0.06,
						bottom: size * 0.06,
						padding: `${ size * 0.02 }px ${ size * 0.035 }px`,
						backgroundColor: settings.backgroundColor,
						color: settings.textColor,
						borderBottom: `${ size * 0.009 }px solid ${ settings.accentColor }`,
						fontFamily: 'Arial, sans-serif',
						fontSize: size * 0.04,
						opacity: Math.min( 1, frame / ( fps * 0.4 ) ),
					},
				},
				name
			)
		);
	}

	registerRenderer( 'studio', { Card, Overlay } );
} )();
