module.exports = {
	preset: '@wordpress/jest-preset-default',
	testMatch: [ '**/tests/js/**/*.test.[jt]s?(x)' ],
	setupFilesAfterEnv: [ '<rootDir>/tests/js/setup.js' ],
	moduleNameMapper: {
		'\\.svg$': '<rootDir>/tests/js/svg-mock.js',
		'^@remotion/(media|web-renderer)$':
			'<rootDir>/node_modules/@remotion/$1/dist/esm/index.mjs',
	},
	transform: {
		'^.+\\.(?:[jt]sx?|mjs)$': 'babel-jest',
	},
	transformIgnorePatterns: [
		'/node_modules/(?!@remotion/(?:media|web-renderer)/)',
	],
};
