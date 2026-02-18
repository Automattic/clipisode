import TopicList from './pages/TopicList';
import TopicDetail from './pages/TopicDetail';
import TopicForm from './pages/TopicForm';
import ReplyList from './pages/ReplyList';
import MediaList from './pages/MediaList';
import ClipisodeList from './pages/ClipisodeList';
import ThemeList from './pages/ThemeList';
import Settings from './pages/Settings';
import useHashRoute from './hooks/useHashRoute';

export default function App() {
	const page = window.clipisodeAdmin?.page || 'clipisode';
	const { route, navigate } = useHashRoute();

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
