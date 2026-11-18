import { Button } from '@wordpress/components';
import useOnboarding from '../hooks/useOnboarding';

const steps = [
	'Create a topic',
	'Collect a reply',
	'Make your video',
	'Export and share',
];

export default function OnboardingGuide( {
	stage,
	compact = false,
}: {
	stage?: number;
	compact?: boolean;
} ) {
	const { state, busy, update } = useOnboarding();
	if ( ! state || state.dismissed ) {
		return null;
	}
	const current = stage ?? state.stage;
	return (
		<nav
			className={ `clipisode-guide ${ compact ? 'is-compact' : '' }` }
			aria-label="Your Clipisode walkthrough"
		>
			<div className="clipisode-guide-heading">
				<strong>
					{ current > 4
						? 'You made a Clipisode'
						: 'Your Clipisode, step by step' }
				</strong>
				<Button
					variant="tertiary"
					disabled={ busy }
					onClick={ () => update( { action: 'dismiss' } ) }
				>
					Hide guide
				</Button>
			</div>
			<ol>
				{ steps.map( ( label, index ) => {
					let status = 'Up next';
					if ( current === index + 1 ) {
						status = 'You are here';
					}
					if ( current > index + 1 ) {
						status = 'Complete';
					}
					return (
						<li
							key={ label }
							aria-current={
								current === index + 1 ? 'step' : undefined
							}
							className={
								current > index + 1 ? 'is-complete' : ''
							}
						>
							<span aria-hidden="true">
								{ current > index + 1 ? '✓' : index + 1 }
							</span>
							<span>
								{ label }
								<small>{ status }</small>
							</span>
						</li>
					);
				} ) }
			</ol>
		</nav>
	);
}
