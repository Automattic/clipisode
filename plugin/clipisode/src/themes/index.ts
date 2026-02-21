import type { GetElementsFn } from '@clipisode/theme';
import { getElements as standard } from './standard';
import { getElements as wpvip } from './wpvip';

export const themeRegistry: Record< string, GetElementsFn > = {
	standard,
	wpvip,
};
