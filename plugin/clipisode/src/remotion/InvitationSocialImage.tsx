import { AbsoluteFill } from 'remotion';
import { ThemeCard } from './themes';
import type { CompositionSettings } from './types';

export interface InvitationSocialImageProps {
	settings: CompositionSettings;
}

export default function InvitationSocialImage( {
	settings,
}: InvitationSocialImageProps ) {
	return (
		<AbsoluteFill>
			<ThemeCard settings={ settings } kind="title" />
		</AbsoluteFill>
	);
}
