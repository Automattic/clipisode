import {
	CheckboxControl,
	RangeControl,
	SelectControl,
	TextControl,
	TextareaControl,
	ToggleControl,
} from '@wordpress/components';
import { getFieldOptions, getFieldValue } from '../remotion/theme-schema';
import type {
	CompositionClip,
	ThemeField,
	ThemeGroup,
	ThemeValue,
	ThemeValues,
} from '../remotion/types';

interface Props {
	groups: ThemeGroup[];
	values: ThemeValues;
	clips: CompositionClip[];
	onChange: ( values: ThemeValues ) => void;
	idPrefix: string;
}

function enabledValue( field: ThemeField ): ThemeValue {
	if ( field.default !== null ) {
		return field.default;
	}
	switch ( field.type ) {
		case 'toggle':
			return false;
		case 'number':
		case 'range':
			return field.min ?? 0;
		case 'multiselect':
			return [];
		case 'color':
			return '#ffffff';
		default:
			return '';
	}
}

export default function ThemeFields( {
	groups,
	values,
	clips,
	onChange,
	idPrefix,
}: Props ) {
	const update = ( field: ThemeField, value: ThemeValue ) =>
		onChange( { ...values, [ field.id ]: value } );
	return (
		<div className="clipisode-theme-fields">
			{ groups.map( ( group ) => (
				<fieldset className="clipisode-field-group" key={ group.id }>
					<legend>{ group.label }</legend>
					{ group.description && (
						<p className="clipisode-field-help">
							{ group.description }
						</p>
					) }
					{ group.fields.map( ( field ) => {
						const value = getFieldValue( field, values );
						const active = ! field.optional || value !== null;
						const id = `${ idPrefix }-${ group.id }-${ field.id }`;
						const options = [ ...getFieldOptions( field, clips ) ];
						if (
							[ 'select', 'clip', 'multiselect' ].includes(
								field.type
							)
						) {
							let selected: string[] = [];
							if ( Array.isArray( value ) ) {
								selected = value;
							} else if ( typeof value === 'string' && value ) {
								selected = [ value ];
							}
							for ( const item of selected ) {
								if (
									! options.some(
										( option ) => option.value === item
									)
								) {
									options.push( {
										value: item,
										label: `Unavailable selection (${ item })`,
									} );
								}
							}
						}
						let input;
						switch ( field.type ) {
							case 'toggle':
								input = (
									<ToggleControl
										label={ field.label }
										checked={ value === true }
										help={ field.help }
										onChange={ ( next ) =>
											update( field, next )
										}
									/>
								);
								break;
							case 'textarea':
								input = (
									<TextareaControl
										label={ field.label }
										value={
											typeof value === 'string'
												? value
												: ''
										}
										placeholder={ field.placeholder }
										help={ field.help }
										onChange={ ( next ) =>
											update( field, next )
										}
									/>
								);
								break;
							case 'range':
								input = (
									<RangeControl
										__next40pxDefaultSize
										label={ field.label }
										value={
											typeof value === 'number'
												? value
												: undefined
										}
										min={ field.min }
										max={ field.max }
										step={ field.step }
										help={ field.help }
										onChange={ ( next ) => {
											if ( next !== undefined ) {
												update( field, next );
											}
										} }
									/>
								);
								break;
							case 'number':
								input = (
									<TextControl
										__next40pxDefaultSize
										type="number"
										label={ field.label }
										value={
											typeof value === 'number'
												? value
												: ''
										}
										min={ field.min }
										max={ field.max }
										step={ field.step }
										help={ field.help }
										onChange={ ( next ) =>
											update(
												field,
												next === ''
													? ''
													: Number( next )
											)
										}
									/>
								);
								break;
							case 'select':
							case 'clip':
								input = (
									<SelectControl
										__next40pxDefaultSize
										label={ field.label }
										value={
											typeof value === 'string'
												? value
												: ''
										}
										options={ [
											{
												value: '',
												label:
													field.placeholder ||
													'Choose…',
											},
											...options,
										] }
										help={ field.help }
										onChange={ ( next ) =>
											update( field, next )
										}
									/>
								);
								break;
							case 'multiselect': {
								const selected = Array.isArray( value )
									? value
									: [];
								input = (
									<fieldset className="clipisode-field-options">
										<legend>{ field.label }</legend>
										{ options.map( ( option ) => (
											<CheckboxControl
												key={ option.value }
												label={ option.label }
												checked={ selected.includes(
													option.value
												) }
												onChange={ ( checked ) =>
													update(
														field,
														checked
															? [
																	...selected,
																	option.value,
															  ]
															: selected.filter(
																	( item ) =>
																		item !==
																		option.value
															  )
													)
												}
											/>
										) ) }
										{ field.help && (
											<p className="clipisode-field-help">
												{ field.help }
											</p>
										) }
									</fieldset>
								);
								break;
							}
							case 'color':
								input = (
									<div className="clipisode-color-field">
										<label htmlFor={ id }>
											{ field.label }
										</label>
										<div>
											<input
												id={ id }
												type="color"
												aria-label={ `${ field.label } color` }
												value={
													typeof value === 'string'
														? value
														: '#ffffff'
												}
												onChange={ ( event ) =>
													update(
														field,
														event.target.value
													)
												}
											/>
											<span>{ value }</span>
										</div>
										{ field.help && (
											<p className="clipisode-field-help">
												{ field.help }
											</p>
										) }
									</div>
								);
								break;
							case 'image':
								input = (
									<>
										<TextControl
											__next40pxDefaultSize
											type="url"
											label={ field.label }
											value={
												typeof value === 'string'
													? value
													: ''
											}
											placeholder={
												field.placeholder || 'https://'
											}
											help={ field.help }
											onChange={ ( next ) =>
												update( field, next )
											}
										/>
										{ typeof value === 'string' &&
											value && (
												<img
													className="clipisode-field-image"
													src={ value }
													alt={ `${ field.label } preview` }
												/>
											) }
									</>
								);
								break;
							default:
								input = (
									<TextControl
										__next40pxDefaultSize
										label={ field.label }
										value={
											typeof value === 'string'
												? value
												: ''
										}
										placeholder={ field.placeholder }
										help={ field.help }
										onChange={ ( next ) =>
											update( field, next )
										}
									/>
								);
						}
						return (
							<div
								className="clipisode-theme-field"
								key={ field.id }
							>
								{ field.optional && (
									<ToggleControl
										label={ `Enable ${ field.label }` }
										checked={ active }
										onChange={ ( checked ) =>
											update(
												field,
												checked
													? enabledValue( field )
													: null
											)
										}
									/>
								) }
								{ active && input }
							</div>
						);
					} ) }
				</fieldset>
			) ) }
		</div>
	);
}
