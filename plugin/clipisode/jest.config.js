module.exports = {
	preset: '@wordpress/jest-preset-default',
	testMatch: [ '**/tests/js/**/*.test.[jt]s?(x)' ],
	setupFilesAfterEnv: [ '<rootDir>/tests/js/setup.js' ],
	transform: {
		'^.+\\.[jt]sx?$': 'babel-jest',
	},
};
