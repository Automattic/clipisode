import { useEffect } from '@wordpress/element';
import TopicList from './pages/TopicList';
import TopicDetail from './pages/TopicDetail';
import TopicForm from './pages/TopicForm';
import ReplyList from './pages/ReplyList';
import MediaList from './pages/MediaList';
import ClipisodeList from './pages/ClipisodeList';
import CreateClipisode from './pages/CreateClipisode';
import ThemeList from './pages/ThemeList';
import Settings from './pages/Settings';
import useHashRoute from './hooks/useHashRoute';

export default function App() {
	const page = window.clipisodeAdmin?.page || 'clipisode';
	const { route, navigate } = useHashRoute();
	const compositionMatch = route.match( /^compose\/(\d+)$/ );
	const createClipisodeWithTopicMatch = route.match(
		/^create-clipisode\/(\d+)\/([\d,]+)$/
	);
	const createClipisodeMatch = route.match( /^create-clipisode\/([\d,]+)$/ );
	const isComposerRoute =
		!! compositionMatch ||
		!! createClipisodeWithTopicMatch ||
		!! createClipisodeMatch;
	useEffect( () => {
		if ( isComposerRoute && page !== 'clipisode-clipisodes' ) {
			const url = new URL( window.location.href );
			url.searchParams.set( 'page', 'clipisode-clipisodes' );
			window.location.replace( url.toString() );
		}
	}, [ isComposerRoute, page, route ] );
	if ( isComposerRoute && page !== 'clipisode-clipisodes' ) {
		return null;
	}
	if ( compositionMatch ) {
		return (
			<CreateClipisode
				key={ route }
				outputId={ Number( compositionMatch[ 1 ] ) }
				navigate={ navigate }
			/>
		);
	}
	if ( createClipisodeWithTopicMatch ) {
		const mediaIds = createClipisodeWithTopicMatch[ 2 ]
			.split( ',' )
			.map( Number );
		return (
			<CreateClipisode
				topicId={ Number( createClipisodeWithTopicMatch[ 1 ] ) }
				mediaIds={ mediaIds }
				navigate={ navigate }
			/>
		);
	}
	if ( createClipisodeMatch ) {
		const mediaIds = createClipisodeMatch[ 1 ].split( ',' ).map( Number );
		return <CreateClipisode mediaIds={ mediaIds } navigate={ navigate } />;
	}

	if ( page === 'clipisode-replies' ) {
		const params = new URLSearchParams( window.location.search );
		const topicId = params.get( 'topic_id' );
		return <ReplyList topicId={ topicId } />;
	}

	if ( page === 'clipisode-clipisodes' ) {
		return <ClipisodeList />;
	}

	if ( page === 'clipisode-media' ) {
		return <MediaList />;
	}

	if ( page === 'clipisode-themes' ) {
		return <ThemeList />;
	}

	if ( page === 'clipisode-settings' ) {
		return <Settings />;
	}

	// Topics routing.
	if ( route === 'new' ) {
		return <TopicForm navigate={ navigate } />;
	}

	const editMatch = route.match( /^(\d+)\/edit$/ );
	if ( editMatch ) {
		return <TopicForm id={ editMatch[ 1 ] } navigate={ navigate } />;
	}

	const detailMatch = route.match( /^(\d+)$/ );
	if ( detailMatch ) {
		return <TopicDetail id={ detailMatch[ 1 ] } navigate={ navigate } />;
	}

	return <TopicList navigate={ navigate } />;
}
