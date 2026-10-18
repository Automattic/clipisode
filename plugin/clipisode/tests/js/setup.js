require( '@testing-library/jest-dom' );

const { TextDecoder, TextEncoder } = require( 'node:util' );
Object.assign( window, { TextDecoder, TextEncoder } );
