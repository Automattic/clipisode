import { useState, useEffect } from '@wordpress/element';
import { Button, Spinner, TextControl } from '@wordpress/components';
import apiFetch from '@wordpress/api-fetch';
import type { Theme } from '../types';

export default function ThemeList() {
	const [ themes, setThemes ] = useState< Theme[] >( [] );
	const [ loading, setLoading ] = useState( true );
	const [ adding, setAdding ] = useState( false );
	const [ cloningId, setCloningId ] = useState< number | null >( null );
	const [ cloneTitle, setCloneTitle ] = useState( '' );
	const [ showCloneFor, setShowCloneFor ] = useState< number | null >( null );

	const load = () => {
		apiFetch< Theme[] >( { path: '/clipisode/v1/themes' } )
			.then( setThemes )
			.finally( () => setLoading( false ) );
	};

	useEffect( load, [] );

	const handleAddNew = () => {
		setAdding( true );
		apiFetch< { id: number; edit_url: string } >( {
			path: '/clipisode/v1/themes',
			method: 'POST',
			data: {},
		} ).then( ( result ) => {
			window.open( result.edit_url, '_blank' );
			load();
		} ).finally( () => setAdding( false ) );
	};

	const handleClone = ( sourceId: number ) => {
		setCloningId( sourceId );
		apiFetch< { id: number; edit_url: string } >( {
			path: '/clipisode/v1/themes',
			method: 'POST',
			data: { source_id: sourceId, title: cloneTitle || undefined },
		} ).then( ( result ) => {
			setShowCloneFor( null );
			setCloneTitle( '' );
			window.open( result.edit_url, '_blank' );
			load();
		} ).finally( () => setCloningId( null ) );
	};

	const handleDelete = ( id: number ) => {
		if ( ! window.confirm( 'Delete this theme? This cannot be undone.' ) ) {
			return;
		}
		apiFetch( { path: `/clipisode/v1/themes/${ id }`, method: 'DELETE' } )
			.then( load )
			.catch( ( err: { message?: string } ) => {
				window.alert( err.message || 'Failed to delete.' );
			} );
	};

	if ( loading ) {
		return (
			<div className="clipisode-spinner-wrap">
				<Spinner />
			</div>
		);
	}

	return (
		<>
			<div className="clipisode-page-header">
				<h1>Themes</h1>
				<Button
					variant="primary"
					onClick={ handleAddNew }
					isBusy={ adding }
					disabled={ adding }
				>
					Add New
				</Button>
			</div>

			<p style={ { color: '#646970', marginBottom: 24 } }>
				Themes control the look and feel of the guest-facing invitation page at <code>/invitation/&#123;slug&#125;</code>.
				Edit a theme in the block editor to rearrange elements or change styles.
			</p>

			<div className="clipisode-theme-grid">
				{ themes.map( ( theme ) => (
					<div key={ theme.id } className="clipisode-theme-card">
						<div className="clipisode-theme-card-header">
							<strong>{ theme.title }</strong>
							{ theme.is_default && (
								<span className="clipisode-status-badge open">default</span>
							) }
						</div>
						<div className="clipisode-theme-card-meta">
							{ theme.topic_count } { theme.topic_count === 1 ? 'topic' : 'topics' }
						</div>
						<div className="clipisode-theme-card-actions">
							<Button
								variant="primary"
								size="compact"
								href={ theme.edit_url }
								target="_blank"
							>
								Edit
							</Button>
							{ showCloneFor === theme.id ? (
								<div style={ { display: 'flex', gap: 4, alignItems: 'flex-end' } }>
									<TextControl
										placeholder="Clone name"
										value={ cloneTitle }
										onChange={ setCloneTitle }
										__nextHasNoMarginBottom
									/>
									<Button
										variant="secondary"
										size="compact"
										onClick={ () => handleClone( theme.id ) }
										isBusy={ cloningId === theme.id }
										disabled={ cloningId === theme.id }
									>
										Clone
									</Button>
									<Button
										variant="tertiary"
										size="compact"
										onClick={ () => { setShowCloneFor( null ); setCloneTitle( '' ); } }
									>
										Cancel
									</Button>
								</div>
							) : (
								<Button
									variant="secondary"
									size="compact"
									onClick={ () => setShowCloneFor( theme.id ) }
								>
									Clone
								</Button>
							) }
							{ ! theme.is_default && theme.topic_count === 0 && (
								<Button
									variant="tertiary"
									size="compact"
									isDestructive
									onClick={ () => handleDelete( theme.id ) }
								>
									Delete
								</Button>
							) }
						</div>
					</div>
				) ) }
			</div>
		</>
	);
}
