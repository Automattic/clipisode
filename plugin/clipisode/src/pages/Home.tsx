import { useState, useEffect, useCallback } from '@wordpress/element';
import { Button, Notice, Spinner } from '@wordpress/components';
import apiFetch from '@wordpress/api-fetch';
import useOnboarding from '../hooks/useOnboarding';
import OnboardingGuide from '../components/OnboardingGuide';
import type { Topic } from '../types';

export default function Home( {
	navigate,
}: {
	navigate: ( path: string | number ) => void;
} ) {
	const { state, busy, update } = useOnboarding();
	const [ topics, setTopics ] = useState< Topic[] | null >( null );
	const [ error, setError ] = useState( '' );
	const load = useCallback( () => {
		setError( '' );
		apiFetch< Topic[] >( { path: '/clipisode/v1/topics' } )
			.then( setTopics )
			.catch( () => setError( 'Unable to load your topics.' ) );
	}, [] );
	useEffect( load, [ load ] );
	const start = async () => {
		if ( await update( { action: 'start' } ) ) {
			navigate( 'get-started' );
		}
	};
	const hasProject = state?.topic_id && ! state.missing_topic;
	let heading = 'Your next video starts with a question.';
	if ( hasProject ) {
		heading =
			state.stage === 5
				? 'Your Clipisode is ready.'
				: 'Pick up where you left off.';
	}
	return (
		<div className="clipisode-home">
			<div className="clipisode-page-header">
				<h1>Home</h1>
				<Button variant="secondary" onClick={ () => navigate( 'new' ) }>
					New topic
				</Button>
			</div>
			<section className="clipisode-welcome">
				<div>
					<span className="clipisode-eyebrow">
						MAKE SOMETHING TOGETHER
					</span>
					<h2>{ heading }</h2>
					<p>
						{ hasProject
							? state.topic_title
							: 'Ask your audience a question. Collect their video replies. Bring it all together in a Clipisode.' }
					</p>
					{ ! state?.dismissed && (
						<div className="clipisode-action-row">
							{ hasProject ? (
								<Button
									variant="primary"
									href={ state.next_url }
								>
									{ state.stage === 5
										? 'View your video'
										: 'Continue creating' }
								</Button>
							) : (
								<Button
									variant="primary"
									disabled={ ! state || busy }
									onClick={ start }
								>
									{ topics?.length
										? 'Try the guided flow'
										: 'Make my first Clipisode' }
								</Button>
							) }
							{ hasProject && (
								<Button
									variant="tertiary"
									disabled={ busy }
									onClick={ start }
								>
									Start another
								</Button>
							) }
						</div>
					) }
					{ state?.dismissed && (
						<Button
							variant="secondary"
							disabled={ busy }
							onClick={ () => update( { action: 'resume' } ) }
						>
							Show getting-started guide
						</Button>
					) }
					{ ( state?.missing_topic || state?.missing_output ) && (
						<p role="status">
							The selected{ ' ' }
							{ state.missing_topic ? 'topic' : 'saved video' }{ ' ' }
							was deleted. Your other work is unchanged.{ ' ' }
							{ state.missing_topic
								? 'Start again or choose a topic below.'
								: 'Continue from your topic to make another video.' }
						</p>
					) }
				</div>
				<div className="clipisode-welcome-note">
					<span aria-hidden="true">01 → 04</span>
					<strong>One question. Many perspectives.</strong>
					<p>
						Try a short reply of your own, then invite your audience
						to add their voices.
					</p>
				</div>
			</section>
			<OnboardingGuide />
			<div className="clipisode-section-header">
				<h2>Your topics</h2>
				<Button variant="link" href="admin.php?page=clipisode-topics">
					View all topics
				</Button>
			</div>
			{ error && (
				<Notice status="error" isDismissible={ false }>
					<p>{ error }</p>
					<Button onClick={ load }>Try again</Button>
				</Notice>
			) }
			{ ! error && ! topics && <Spinner /> }
			{ ! error && topics && topics.length > 0 && (
				<div className="clipisode-projects">
					{ topics.slice( 0, 6 ).map( ( topic ) => (
						<article
							className="clipisode-project-card"
							key={ topic.id }
						>
							<span className="clipisode-eyebrow">
								{ topic.status }
							</span>
							<h3>
								<a
									href={ `admin.php?page=clipisode#/${ topic.id }` }
								>
									{ topic.title }
								</a>
							</h3>
							<p>
								{ topic.replies_count } replies ·{ ' ' }
								{ topic.outputs.length } videos
							</p>
							<div className="clipisode-action-row">
								<Button
									variant="secondary"
									href={ `admin.php?page=clipisode#/${ topic.id }` }
								>
									Open topic
								</Button>
								<Button
									variant="tertiary"
									disabled={ busy }
									onClick={ async () => {
										if (
											await update( {
												action: 'select',
												topic_id: topic.id,
												show_guide: true,
												output_id:
													topic.outputs.find(
														( o ) =>
															o.has_composition
													)?.id || null,
											} )
										) {
											navigate( topic.id );
										}
									} }
								>
									Walk me through this
								</Button>
							</div>
						</article>
					) ) }
				</div>
			) }
			{ ! error && topics?.length === 0 && (
				<p className="clipisode-empty-section">
					Your topics will appear here. Start with one question you’d
					love people to answer.
				</p>
			) }
		</div>
	);
}
