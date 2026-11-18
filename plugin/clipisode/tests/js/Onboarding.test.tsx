import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import apiFetch from '@wordpress/api-fetch';
import TopicForm from '../../src/pages/TopicForm';
import TopicDetail from '../../src/pages/TopicDetail';
import Home from '../../src/pages/Home';
import { OnboardingProvider } from '../../src/hooks/useOnboarding';

jest.mock( '@wordpress/api-fetch', () => jest.fn() );
jest.mock( '../../src/components/VideoUploader', () => () => (
	<div>Optional intro uploader</div>
) );
jest.mock( '../../src/components/SocialImagePicker', () => () => (
	<div>Optional sharing image</div>
) );
jest.mock(
	'../../src/components/ReplyModal',
	() =>
		( { reply, onUpdated } ) => (
			<div role="dialog">
				<button
					onClick={ () =>
						onUpdated( { ...reply, status: 'approved' } )
					}
				>
					Approve reply
				</button>
				<button
					onClick={ () =>
						onUpdated( { ...reply, status: 'rejected' } )
					}
				>
					Reject reply
				</button>
			</div>
		)
);
const mockApi = apiFetch as jest.Mock;
const initial = {
	dismissed: false,
	topic_id: null,
	output_id: null,
	stage: 1,
	missing_topic: false,
	missing_output: false,
};
const topic = {
	id: 7,
	title: 'What inspired you?',
	outputs: [],
	replies_count: 1,
	clicks: 0,
	links_count: 1,
	status: 'active',
	created_at: '2026-11-17',
};
const reply = {
	id: 10,
	name: 'Guest',
	media_id: 20,
	status: 'unapproved',
	created_at: '2026-11-17',
};
const link = {
	id: 1,
	status: 'open',
	slug: 'invite',
	share_url: 'https://example.com/join/invite',
};

beforeEach( () => {
	jest.resetAllMocks();
} );

it( 'creates with configured defaults and preserves the real topic if saving guide progress fails', async () => {
	const navigate = jest.fn();
	let associationAttempts = 0;
	mockApi.mockImplementation( ( { path, method } ) => {
		if ( path === '/clipisode/v1/onboarding' ) {
			if ( method === 'POST' ) {
				associationAttempts++;
				return associationAttempts === 1
					? Promise.reject( new Error( 'Guide unavailable' ) )
					: Promise.resolve( { ...initial, topic_id: 7, stage: 2 } );
			}
			return Promise.resolve( initial );
		}
		if ( path.endsWith( '/terms/custom' ) ) {
			return Promise.resolve( [] );
		}
		if ( path.endsWith( '/hosts' ) ) {
			return Promise.resolve( [
				{ name: 'Configured host', is_default: true },
			] );
		}
		if ( path.endsWith( '/themes' ) ) {
			return Promise.resolve( [
				{ id: 9, title: 'Configured theme', is_default: true },
			] );
		}
		if ( path === '/clipisode/v1/topics' && method === 'POST' ) {
			return Promise.resolve( topic );
		}
		throw new Error( path );
	} );
	render(
		<OnboardingProvider>
			<TopicForm guided navigate={ navigate } />
		</OnboardingProvider>
	);
	fireEvent.change(
		await screen.findByRole( 'textbox', {
			name: 'Your question or topic',
		} ),
		{ target: { value: 'What inspired you?' } }
	);
	expect(
		screen
			.getByText( 'Customize host, theme and sharing' )
			.closest( 'details' )
	).not.toHaveAttribute( 'open' );
	fireEvent.click(
		screen.getByRole( 'button', { name: 'Create topic and continue' } )
	);
	await waitFor( () => expect( navigate ).toHaveBeenCalledWith( '7' ) );
	expect( mockApi ).toHaveBeenCalledWith(
		expect.objectContaining( {
			method: 'POST',
			path: '/clipisode/v1/topics',
			data: expect.objectContaining( {
				title: 'What inspired you?',
				hosted_by: 'Configured host',
				invitation_id: '9',
				intro_media_id: null,
			} ),
		} )
	);
	fireEvent.click( screen.getByRole( 'button', { name: 'Retry guide' } ) );
	await waitFor( () => expect( associationAttempts ).toBe( 2 ) );
	expect(
		mockApi.mock.calls.filter(
			( [ options ] ) =>
				options.path === '/clipisode/v1/topics' &&
				options.method === 'POST'
		)
	).toHaveLength( 1 );
} );

it( 'makes an approved reply immediately available, and removes rejected replies without reloading', async () => {
	mockApi.mockImplementation( ( { path } ) =>
		Promise.resolve(
			path.includes( 'invitation-links' )
				? [ link ]
				: path.includes( '/replies?' )
				? [ reply ]
				: topic
		)
	);
	render( <TopicDetail id="7" navigate={ jest.fn() } /> );
	fireEvent.click(
		await screen.findByRole( 'button', { name: 'Review Guest' } )
	);
	fireEvent.click( screen.getByRole( 'button', { name: 'Approve reply' } ) );
	expect(
		screen.getByRole( 'button', { name: 'Make your video (1)' } )
	).toBeInTheDocument();
	expect(
		screen.getByRole( 'checkbox', { name: 'Include reply from Guest' } )
	).toBeChecked();
	fireEvent.click( screen.getByRole( 'button', { name: 'Review Guest' } ) );
	fireEvent.click( screen.getByRole( 'button', { name: 'Reject reply' } ) );
	expect(
		screen.queryByRole( 'button', { name: 'Make your video (1)' } )
	).not.toBeInTheDocument();
	expect( screen.queryByRole( 'checkbox' ) ).not.toBeInTheDocument();
} );

it( 'shows every selected approved reply, including those beyond the old ten-row limit', async () => {
	const replies = Array.from( { length: 12 }, ( _, index ) => ( {
		...reply,
		id: index + 1,
		name: `Guest ${ index + 1 }`,
		status: 'approved',
	} ) );
	mockApi.mockImplementation( ( { path } ) =>
		Promise.resolve(
			path.includes( 'invitation-links' )
				? [ link ]
				: path.includes( '/replies?' )
				? replies
				: topic
		)
	);
	render( <TopicDetail id="7" navigate={ jest.fn() } /> );
	await screen.findByRole( 'button', { name: 'Review Guest 12' } );
	expect( screen.getAllByRole( 'checkbox' ) ).toHaveLength( 12 );
	expect(
		screen.getByRole( 'button', { name: 'Make your video (12)' } )
	).toBeInTheDocument();
} );

it( 'does not present a closed invitation as open', async () => {
	mockApi.mockImplementation( ( { path } ) =>
		Promise.resolve(
			path.includes( 'invitation-links' )
				? [ { ...link, status: 'closed' } ]
				: path.includes( '/replies?' )
				? []
				: topic
		)
	);
	render( <TopicDetail id="7" navigate={ jest.fn() } /> );
	await screen.findByRole( 'button', { name: 'Create invitation link' } );
	expect(
		screen.queryByRole( 'link', { name: 'Open invitation ↗' } )
	).not.toBeInTheDocument();
} );

it( 'keeps existing topics visible and makes the guide optional on an upgraded site', async () => {
	mockApi.mockImplementation( ( { path } ) =>
		Promise.resolve( path.endsWith( '/onboarding' ) ? initial : [ topic ] )
	);
	render(
		<OnboardingProvider>
			<Home navigate={ jest.fn() } />
		</OnboardingProvider>
	);
	await screen.findByRole( 'button', { name: 'Try the guided flow' } );
	expect(
		screen.getByRole( 'link', { name: 'What inspired you?' } )
	).toBeInTheDocument();
	expect(
		mockApi.mock.calls.every( ( [ options ] ) => ! options.method )
	).toBe( true );
} );
