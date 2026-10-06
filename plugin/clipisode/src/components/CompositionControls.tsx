import { SelectControl } from '@wordpress/components';
import ThemeFields from './ThemeFields';
import {
	getThemeDefinition,
	getVisibleGroups,
	themeDefinitions,
} from '../remotion/theme-schema';
import type { CompositionClip, CompositionSettings } from '../remotion/types';

interface Props {
	settings: CompositionSettings;
	clips: CompositionClip[];
	onChange: ( settings: CompositionSettings ) => void;
	onThemeChange: ( themeId: string ) => void;
}

export default function CompositionControls( {
	settings,
	clips,
	onChange,
	onThemeChange,
}: Props ) {
	const theme = getThemeDefinition( settings.themeId );
	return (
		<div className="clipisode-composition-controls">
			<SelectControl
				__next40pxDefaultSize
				label="Video theme"
				value={ settings.themeId }
				options={ themeDefinitions.map( ( item ) => ( {
					value: item.id,
					label: item.label,
				} ) ) }
				onChange={ onThemeChange }
				help={ theme.description }
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
					onChange( {
						...settings,
						format: value as CompositionSettings[ 'format' ],
					} )
				}
			/>
			<ThemeFields
				groups={ getVisibleGroups(
					theme,
					'composition',
					settings
				).filter( ( group ) => ! group.card ) }
				values={ settings }
				clips={ clips }
				idPrefix="composition"
				onChange={ ( values ) =>
					onChange( { ...settings, ...values } )
				}
			/>
		</div>
	);
}
