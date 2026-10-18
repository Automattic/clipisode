import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from '@wordpress/element';
import ThemeFields from '../../src/components/ThemeFields';
import type {
	CompositionClip,
	ThemeGroup,
	ThemeValues,
} from '../../src/remotion/types';

const clips: CompositionClip[] = [
	{
		id: 'host',
		mediaId: 1,
		role: 'intro',
		name: 'Host',
		url: '/host.mp4',
		duration: 2,
		trimStart: 0,
		trimEnd: 2,
		included: true,
	},
	{
		id: 'backdrop',
		mediaId: 2,
		role: 'reply',
		name: 'Backdrop',
		url: '/backdrop.mp4',
		duration: 2,
		trimStart: 0,
		trimEnd: 2,
		included: true,
		tags: [ 'background' ],
	},
];

function Fields( {
	groups,
	initial = {},
	onChange = () => {},
}: {
	groups: ThemeGroup[];
	initial?: ThemeValues;
	onChange?: ( values: ThemeValues ) => void;
} ) {
	const [ values, setValues ] = useState( initial );
	return (
		<ThemeFields
			groups={ groups }
			values={ values }
			clips={ clips }
			idPrefix="test"
			onChange={ ( next ) => {
				setValues( next );
				onChange( next );
			} }
		/>
	);
}

describe( 'Schema-generated theme fields', () => {
	it( 'supports optional image values without treating an enabled empty value as disabled', () => {
		const onChange = jest.fn();
		render(
			<Fields
				onChange={ onChange }
				groups={ [
					{
						id: 'brand',
						label: 'Brand',
						scope: 'composition',
						fields: [
							{
								id: 'customMark',
								label: 'Custom mark',
								type: 'image',
								default: null,
								optional: true,
							},
						],
					},
				] }
			/>
		);
		expect(
			screen.queryByLabelText( 'Custom mark' )
		).not.toBeInTheDocument();
		fireEvent.click( screen.getByLabelText( 'Enable Custom mark' ) );
		expect( screen.getByLabelText( 'Custom mark' ) ).toHaveValue( '' );
		fireEvent.change( screen.getByLabelText( 'Custom mark' ), {
			target: { value: 'https://example.com/logo.png' },
		} );
		expect(
			screen.getByRole( 'img', { name: 'Custom mark preview' } )
		).toHaveAttribute( 'src', 'https://example.com/logo.png' );
		fireEvent.click( screen.getByLabelText( 'Enable Custom mark' ) );
		expect( onChange ).toHaveBeenLastCalledWith( { customMark: null } );
		expect( screen.queryByRole( 'img' ) ).not.toBeInTheDocument();
	} );

	it( 'generates filtered clip options and preserves missing selections for correction', () => {
		render(
			<Fields
				initial={ { selectedSource: 'removed' } }
				groups={ [
					{
						id: 'sources',
						label: 'Sources',
						scope: 'composition',
						fields: [
							{
								id: 'selectedSource',
								label: 'Selected source',
								type: 'clip',
								default: null,
								optional: true,
								source: {
									kind: 'clips',
									filter: { tags: [ 'background' ] },
								},
							},
						],
					},
				] }
			/>
		);
		expect(
			screen.getByRole( 'option', { name: 'Backdrop' } )
		).toBeInTheDocument();
		expect(
			screen.queryByRole( 'option', { name: 'Host' } )
		).not.toBeInTheDocument();
		expect(
			screen.getByRole( 'option', {
				name: 'Unavailable selection (removed)',
			} )
		).toBeInTheDocument();
		expect( screen.getByLabelText( 'Selected source' ) ).toHaveValue(
			'removed'
		);
		fireEvent.change( screen.getByLabelText( 'Selected source' ), {
			target: { value: 'backdrop' },
		} );
		expect( screen.getByLabelText( 'Selected source' ) ).toHaveValue(
			'backdrop'
		);
	} );

	it( 'keeps number, boolean, and multiselect types when editing arbitrary schema keys', () => {
		const onChange = jest.fn();
		render(
			<Fields
				onChange={ onChange }
				groups={ [
					{
						id: 'custom',
						label: 'Custom controls',
						scope: 'composition',
						fields: [
							{
								id: 'amount',
								label: 'Amount',
								type: 'number',
								optional: true,
								default: 2,
								min: 0,
								max: 10,
								step: 1,
							},
							{
								id: 'active',
								label: 'Active',
								type: 'toggle',
								default: false,
							},
							{
								id: 'choices',
								label: 'Choices',
								type: 'multiselect',
								default: [],
								options: [
									{ value: 'one', label: 'First choice' },
									{ value: 'two', label: 'Second choice' },
								],
							},
						],
					},
				] }
			/>
		);
		fireEvent.change( screen.getByLabelText( 'Amount' ), {
			target: { value: '0' },
		} );
		fireEvent.click( screen.getByLabelText( 'Active' ) );
		fireEvent.click( screen.getByLabelText( 'Second choice' ) );
		expect( onChange ).toHaveBeenLastCalledWith( {
			amount: 0,
			active: true,
			choices: [ 'two' ],
		} );
		fireEvent.change( screen.getByLabelText( 'Amount' ), {
			target: { value: '' },
		} );
		expect( screen.getByLabelText( 'Enable Amount' ) ).toBeChecked();
		expect( screen.getByLabelText( 'Amount' ) ).toHaveValue( null );
	} );
} );
