import {
	renderInvitationSocialImage,
	renderInvitationSocialImages,
} from '../../src/lib/social-image-renderer';
import { createDefaultSettings } from '../../src/remotion/themes';

const mockRenderStill = jest.fn();
const mockBlob = jest.fn();

jest.mock(
	'@remotion/web-renderer',
	() => ( {
		renderStillOnWeb: ( ...args ) => mockRenderStill( ...args ),
	} ),
	{ virtual: true }
);
jest.mock( '../../src/remotion/InvitationSocialImage', () => ( {
	__esModule: true,
	default: () => null,
} ) );

beforeEach( () => {
	jest.clearAllMocks();
	delete window.clipisodeAdmin;
	mockBlob.mockResolvedValue(
		new Blob( [ 'social-image' ], { type: 'image/png' } )
	);
	mockRenderStill.mockResolvedValue( { blob: mockBlob } );
} );

it( 'renders a stable 1200 by 630 frame from the selected theme', async () => {
	const settings = {
		...createDefaultSettings( 'wpvip' ),
		format: 'landscape' as const,
		title: 'An invitation',
		subtitle: 'Hosted by Max',
	};
	const result = await renderInvitationSocialImage( settings );

	expect( result.type ).toBe( 'image/png' );
	expect( mockRenderStill ).toHaveBeenCalledWith(
		expect.objectContaining( {
			frame: 30,
			inputProps: { settings },
			composition: expect.objectContaining( {
				width: 1200,
				height: 630,
				durationInFrames: 31,
				fps: 30,
			} ),
			licenseKey: null,
			isProduction: true,
			signal: null,
		} )
	);
	expect( mockBlob ).toHaveBeenCalledWith( { format: 'png' } );
} );

it( 'renders wide, square, and portrait variants from one theme', async () => {
	const settings = {
		...createDefaultSettings( 'wpvip' ),
		format: 'landscape' as const,
		title: 'An invitation',
		subtitle: 'Hosted by Max',
	};
	await renderInvitationSocialImages( settings );

	expect( mockRenderStill ).toHaveBeenCalledTimes( 3 );
	expect( mockRenderStill ).toHaveBeenNthCalledWith(
		1,
		expect.objectContaining( {
			composition: expect.objectContaining( {
				width: 1200,
				height: 630,
			} ),
			inputProps: {
				settings: expect.objectContaining( { format: 'landscape' } ),
			},
		} )
	);
	expect( mockRenderStill ).toHaveBeenNthCalledWith(
		2,
		expect.objectContaining( {
			composition: expect.objectContaining( {
				width: 1200,
				height: 1200,
			} ),
			inputProps: {
				settings: expect.objectContaining( { format: 'square' } ),
			},
		} )
	);
	expect( mockRenderStill ).toHaveBeenNthCalledWith(
		3,
		expect.objectContaining( {
			composition: expect.objectContaining( {
				width: 1000,
				height: 1500,
			} ),
			inputProps: {
				settings: expect.objectContaining( { format: 'portrait' } ),
			},
		} )
	);
} );
