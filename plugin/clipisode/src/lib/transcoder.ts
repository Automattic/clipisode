export const WS_URL = 'ws://127.0.0.1:63481';

export function generateJobId(): string {
	const now = new Date();
	const p = ( n: number, len = 2 ) => String( n ).padStart( len, '0' );
	return `${ now.getUTCFullYear() }${ p( now.getUTCMonth() + 1 ) }${ p( now.getUTCDate() ) }T${ p( now.getUTCHours() ) }${ p( now.getUTCMinutes() ) }${ p( now.getUTCSeconds() ) }Z`;
}

export function getThemeAssets(): Record< string, { url: string; filename: string } > {
	return window.clipisodeAdmin?.theme_assets ?? {};
}
