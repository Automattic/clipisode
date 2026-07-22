import type { GetElementsFn } from '@clipisode/theme';
import { getElements as defaultTheme } from './standard';
import { getElements as wpvip } from './wpvip';

export const themeRegistry: Record< string, GetElementsFn > = {
	default: defaultTheme,
	wpvip,
};
