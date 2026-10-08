import { useEffect, useMemo, useState } from '@wordpress/element';
import { Button, Modal, Notice, Spinner } from '@wordpress/components';
import { Player } from '@remotion/player';
import ThemeFields from './ThemeFields';
import InvitationSocialImage from '../remotion/InvitationSocialImage';
import {
	createDefaultSettings,
	getThemeDefinition,
	getVisibleGroups,
} from '../remotion/theme-schema';
import { renderInvitationSocialImage } from '../lib/social-image-renderer';
import type { CompositionSettings, ThemeGroup } from '../remotion/types';

interface SocialImageComposerProps {
	themeId: string;
	title: string;
	hostedBy: string;
	disabled?: boolean;
	onCreate: ( blob: Blob ) => Promise< void >;
}

const EXCLUDED_FIELDS = new Set( [
	'videoFit',
	'showNames',
	'backgroundClip',
	'showTitle',
	'titleDuration',
	'showEnding',
	'endingText',
	'endingDuration',
] );

function socialImageGroups( settings: CompositionSettings ): ThemeGroup[] {
	return getVisibleGroups(
		getThemeDefinition( settings.themeId ),
		'composition',
		settings
	)
		.filter( ( group ) => group.card !== 'ending' )
		.map( ( group ) => ( {
			...group,
			fields: group.fields.filter(
				( field ) => ! EXCLUDED_FIELDS.has( field.id )
			),
		} ) )
		.filter( ( group ) => group.fields.length > 0 );
}

function initialSettings(
	themeId: string,
	title: string,
	hostedBy: string
): CompositionSettings {
	return {
		...createDefaultSettings( themeId ),
		format: 'landscape',
		title: title || 'You’re invited',
		subtitle: hostedBy ? `Hosted by ${ hostedBy }` : '',
	};
}

export default function SocialImageComposer( {
	themeId,
	title,
	hostedBy,
	disabled = false,
	onCreate,
}: SocialImageComposerProps ) {
	const [ open, setOpen ] = useState( false );
	const [ rendering, setRendering ] = useState( false );
	const [ error, setError ] = useState< string | null >( null );
	const [ settings, setSettings ] = useState< CompositionSettings >( () =>
		initialSettings( themeId, title, hostedBy )
	);

	useEffect( () => {
		if ( ! open ) {
			setSettings( initialSettings( themeId, title, hostedBy ) );
			setError( null );
		}
	}, [ hostedBy, open, themeId, title ] );

	const theme = useMemo(
		() => getThemeDefinition( settings.themeId ),
		[ settings.themeId ]
	);
	const groups = useMemo( () => socialImageGroups( settings ), [ settings ] );
	const canGenerate = theme.renderer !== 'plain';

	const create = async () => {
		setRendering( true );
		setError( null );
		try {
			const blob = await renderInvitationSocialImage( settings );
			await onCreate( blob );
			setOpen( false );
		} catch ( err ) {
			setError(
				err instanceof Error
					? err.message
					: 'The social image could not be generated.'
			);
		} finally {
			setRendering( false );
		}
	};

	return (
		<>
			<Button
				variant="secondary"
				size="compact"
				disabled={ disabled || ! canGenerate }
				title={
					canGenerate
						? undefined
						: 'This theme does not define a title-card design.'
				}
				onClick={ () => setOpen( true ) }
			>
				Generate from Theme
			</Button>
			{ open && (
				<Modal
					title="Create social preview image"
					className="clipisode-social-image-modal"
					onRequestClose={ () => ! rendering && setOpen( false ) }
				>
					<p className="clipisode-social-image-intro">
						This 1200 × 630 image uses the { theme.label } Remotion
						theme. Customize it, then generate and save it to
						WordPress.
					</p>
					<div className="clipisode-social-image-layout">
						<div className="clipisode-social-image-preview">
							<Player
								component={ InvitationSocialImage }
								inputProps={ { settings } }
								durationInFrames={ 31 }
								compositionWidth={ 1200 }
								compositionHeight={ 630 }
								fps={ 30 }
								initialFrame={ 30 }
								controls={ false }
								style={ {
									width: '100%',
									aspectRatio: '1200 / 630',
								} }
							/>
						</div>
						<div className="clipisode-social-image-controls">
							<ThemeFields
								groups={ groups }
								values={ settings }
								clips={ [] }
								idPrefix="social-image"
								onChange={ ( values ) =>
									setSettings( { ...settings, ...values } )
								}
							/>
						</div>
					</div>
					{ error && (
						<Notice status="error" isDismissible={ false }>
							{ error }
						</Notice>
					) }
					<div className="clipisode-social-image-actions">
						<Button
							variant="tertiary"
							disabled={ rendering }
							onClick={ () => setOpen( false ) }
						>
							Cancel
						</Button>
						<Button
							variant="primary"
							disabled={ rendering }
							onClick={ create }
						>
							{ rendering && <Spinner /> }
							{ rendering ? 'Generating…' : 'Generate Image' }
						</Button>
					</div>
				</Modal>
			) }
		</>
	);
}
