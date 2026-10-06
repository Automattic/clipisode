import {
	SelectControl,
	TextControl,
	ToggleControl,
	RangeControl,
	Button,
} from '@wordpress/components';
import { themePresets, createDefaultSettings } from '../remotion/themes';
import type { CompositionSettings } from '../remotion/types';

interface Props {
	settings: CompositionSettings;
	onChange: ( settings: CompositionSettings ) => void;
}

export default function CompositionControls( { settings, onChange }: Props ) {
	const update = < K extends keyof CompositionSettings >(
		key: K,
		value: CompositionSettings[ K ]
	) => onChange( { ...settings, [ key ]: value } );
	const chooseTheme = ( themeId: CompositionSettings[ 'themeId' ] ) => {
		const defaults = createDefaultSettings( themeId );
		onChange( {
			...settings,
			themeId,
			accentColor: defaults.accentColor,
			backgroundColor: defaults.backgroundColor,
			textColor: defaults.textColor,
			fontFamily: defaults.fontFamily,
		} );
	};
	return (
		<div className="clipisode-composition-controls">
			<SelectControl
				__next40pxDefaultSize
				label="Video theme"
				value={ settings.themeId }
				options={ themePresets.map( ( theme ) => ( {
					value: theme.id,
					label: theme.label,
				} ) ) }
				onChange={ ( value ) =>
					chooseTheme( value as CompositionSettings[ 'themeId' ] )
				}
			/>
			<SelectControl
				__next40pxDefaultSize
				label="Format"
				value={ settings.format }
				options={ [
					{ value: 'portrait', label: 'Portrait · 9:16' },
					{ value: 'square', label: 'Square · 1:1' },
					{ value: 'landscape', label: 'Landscape · 16:9' },
				] }
				onChange={ ( value ) =>
					update( 'format', value as CompositionSettings[ 'format' ] )
				}
			/>
			<SelectControl
				__next40pxDefaultSize
				label="Video fit"
				value={ settings.videoFit }
				options={ [
					{ value: 'cover', label: 'Fill frame (crop)' },
					{ value: 'contain', label: 'Fit entire video' },
				] }
				onChange={ ( value ) =>
					update(
						'videoFit',
						value as CompositionSettings[ 'videoFit' ]
					)
				}
			/>
			{ settings.themeId !== 'none' && (
				<>
					<div className="clipisode-composition-colors">
						{ (
							[
								[ 'accentColor', 'Accent' ],
								[ 'backgroundColor', 'Background' ],
								[ 'textColor', 'Text' ],
							] as const
						 ).map( ( [ key, label ] ) => (
							<label
								key={ key }
								htmlFor={ `composition-${ key }` }
							>
								{ label }
								<input
									id={ `composition-${ key }` }
									type="color"
									aria-label={ `${ label } color` }
									value={ settings[ key ] }
									onChange={ ( event ) =>
										update( key, event.target.value )
									}
								/>
							</label>
						) ) }
					</div>
					<SelectControl
						__next40pxDefaultSize
						label="Typography"
						value={ settings.fontFamily }
						options={ [
							{ value: 'sans', label: 'Sans serif' },
							{ value: 'serif', label: 'Serif' },
						] }
						onChange={ ( value ) =>
							update(
								'fontFamily',
								value as CompositionSettings[ 'fontFamily' ]
							)
						}
					/>
					<TextControl
						__next40pxDefaultSize
						label="Logo URL"
						type="url"
						value={ settings.logoUrl }
						onChange={ ( value ) => update( 'logoUrl', value ) }
						help="Use an image URL from your media library."
					/>
					<ToggleControl
						label="Show speaker names"
						checked={ settings.showNames }
						onChange={ ( value ) => update( 'showNames', value ) }
					/>
					<ToggleControl
						label="Title card"
						checked={ settings.showTitle }
						onChange={ ( value ) => update( 'showTitle', value ) }
					/>
					{ settings.showTitle && (
						<>
							<TextControl
								__next40pxDefaultSize
								label="Title"
								value={ settings.title }
								onChange={ ( value ) =>
									update( 'title', value )
								}
							/>
							<TextControl
								__next40pxDefaultSize
								label="Subtitle"
								value={ settings.subtitle }
								onChange={ ( value ) =>
									update( 'subtitle', value )
								}
							/>
							<RangeControl
								__next40pxDefaultSize
								label="Title duration (seconds)"
								value={ settings.titleDuration }
								min={ 0.5 }
								max={ 10 }
								step={ 0.5 }
								onChange={ ( value ) =>
									update( 'titleDuration', value! )
								}
							/>
						</>
					) }
					<ToggleControl
						label="Ending card"
						checked={ settings.showEnding }
						onChange={ ( value ) => update( 'showEnding', value ) }
					/>
					{ settings.showEnding && (
						<>
							<TextControl
								__next40pxDefaultSize
								label="Ending text"
								value={ settings.endingText }
								onChange={ ( value ) =>
									update( 'endingText', value )
								}
							/>
							<RangeControl
								__next40pxDefaultSize
								label="Ending duration (seconds)"
								value={ settings.endingDuration }
								min={ 0.5 }
								max={ 10 }
								step={ 0.5 }
								onChange={ ( value ) =>
									update( 'endingDuration', value! )
								}
							/>
						</>
					) }
					<Button
						variant="tertiary"
						onClick={ () => chooseTheme( settings.themeId ) }
					>
						Reset theme colors and type
					</Button>
				</>
			) }
		</div>
	);
}
