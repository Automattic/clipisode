import { useState, useEffect } from '@wordpress/element';
import { Button, Spinner, TextControl } from '@wordpress/components';
import apiFetch from '@wordpress/api-fetch';
import type { Theme } from '../types';

interface PreviewLayout {
	id: number;
	title: string;
	edit_url: string;
	is_default: boolean;
	created_at: string;
}

export default function ThemeList() {
	const [ themes, setThemes ] = useState< Theme[] >( [] );
	const [ previews, setPreviews ] = useState< PreviewLayout[] >( [] );
	const [ loading, setLoading ] = useState( true );

	const [ addingTheme, setAddingTheme ] = useState( false );
	const [ addingPreview, setAddingPreview ] = useState( false );
	const [ cloningId, setCloningId ] = useState< number | null >( null );
	const [ cloneTitle, setCloneTitle ] = useState( '' );
	const [ showCloneFor, setShowCloneFor ] = useState< string | null >( null );

	const loadThemes = () => apiFetch< Theme[] >( { path: '/clipisode/v1/themes' } ).then( setThemes );
	const loadPreviews = () => apiFetch< PreviewLayout[] >( { path: '/clipisode/v1/preview-layouts' } ).then( setPreviews );

	useEffect( () => {
		Promise.all( [ loadThemes(), loadPreviews() ] ).finally( () => setLoading( false ) );
	}, [] );

	const handleAddTheme = () => {
		setAddingTheme( true );
		apiFetch< { id: number; edit_url: string } >( {
			path: '/clipisode/v1/themes',
			method: 'POST',
			data: {},
		} ).then( ( result ) => {
			window.open( result.edit_url, '_blank' );
			loadThemes();
		} ).finally( () => setAddingTheme( false ) );
	};

	const handleAddPreview = () => {
		setAddingPreview( true );
		apiFetch< { id: number; edit_url: string } >( {
			path: '/clipisode/v1/preview-layouts',
			method: 'POST',
			data: {},
		} ).then( ( result ) => {
			window.open( result.edit_url, '_blank' );
			loadPreviews();
		} ).finally( () => setAddingPreview( false ) );
	};

	const handleCloneTheme = ( sourceId: number ) => {
		setCloningId( sourceId );
		apiFetch< { id: number; edit_url: string } >( {
			path: '/clipisode/v1/themes',
			method: 'POST',
			data: { source_id: sourceId, title: cloneTitle || undefined },
		} ).then( ( result ) => {
			resetClone();
			window.open( result.edit_url, '_blank' );
			loadThemes();
		} ).finally( () => setCloningId( null ) );
	};

	const handleClonePreview = ( sourceId: number ) => {
		setCloningId( sourceId );
		apiFetch< { id: number; edit_url: string } >( {
			path: '/clipisode/v1/preview-layouts',
			method: 'POST',
			data: { source_id: sourceId, title: cloneTitle || undefined },
		} ).then( ( result ) => {
			resetClone();
			window.open( result.edit_url, '_blank' );
			loadPreviews();
		} ).finally( () => setCloningId( null ) );
	};

	const handleDeleteTheme = ( id: number ) => {
		if ( ! window.confirm( 'Delete this theme? This cannot be undone.' ) ) return;
		apiFetch( { path: `/clipisode/v1/themes/${ id }`, method: 'DELETE' } )
			.then( loadThemes )
			.catch( ( err: { message?: string } ) => window.alert( err.message || 'Failed to delete.' ) );
	};

	const handleDeletePreview = ( id: number ) => {
		if ( ! window.confirm( 'Delete this preview layout? This cannot be undone.' ) ) return;
		apiFetch( { path: `/clipisode/v1/preview-layouts/${ id }`, method: 'DELETE' } )
			.then( loadPreviews )
			.catch( ( err: { message?: string } ) => window.alert( err.message || 'Failed to delete.' ) );
	};

	const resetClone = () => {
		setShowCloneFor( null );
		setCloneTitle( '' );
	};

	if ( loading ) {
		return (
			<div className="clipisode-spinner-wrap">
				<Spinner />
			</div>
		);
	}

	const renderCloneUI = ( key: string, onClone: () => void ) => (
		showCloneFor === key ? (
			<div style={ { display: 'flex', gap: 4, alignItems: 'flex-end' } }>
				<TextControl
					placeholder="Clone name"
					value={ cloneTitle }
					onChange={ setCloneTitle }
					__nextHasNoMarginBottom
					__next40pxDefaultSize
				/>
				<Button
					variant="secondary"
					size="compact"
					onClick={ onClone }
					isBusy={ cloningId !== null }
					disabled={ cloningId !== null }
				>
					Clone
				</Button>
				<Button variant="tertiary" size="compact" onClick={ resetClone }>
					Cancel
				</Button>
			</div>
		) : (
			<Button variant="secondary" size="compact" onClick={ () => setShowCloneFor( key ) }>
				Clone
			</Button>
		)
	);

	return (
		<>
			<div className="clipisode-page-header">
				<h1>Themes</h1>
			</div>

			<div className="clipisode-settings-section">
				<div style={ { display: 'flex', alignItems: 'center', justifyContent: 'space-between' } }>
					<h2>Invitation Page</h2>
					<Button
						variant="primary"
						size="compact"
						onClick={ handleAddTheme }
						isBusy={ addingTheme }
						disabled={ addingTheme }
					>
						Add New
					</Button>
				</div>
				<p style={ { color: '#646970', margin: '0 0 16px' } }>
					Controls the look and feel of public invitation pages.
				</p>
				<div className="clipisode-theme-grid">
					{ themes.map( ( theme ) => (
						<div key={ theme.id } className="clipisode-theme-card">
							<div className="clipisode-theme-card-header">
								<strong>{ theme.title }</strong>
								{ theme.is_default && <span className="clipisode-status-badge open">default</span> }
							</div>
							<div className="clipisode-theme-card-meta">
								{ theme.topic_count } { theme.topic_count === 1 ? 'topic' : 'topics' }
							</div>
							<div className="clipisode-theme-card-actions">
								<Button variant="primary" size="compact" href={ theme.edit_url } target="_blank">Edit</Button>
								{ renderCloneUI( `theme-${ theme.id }`, () => handleCloneTheme( theme.id ) ) }
								{ ! theme.is_default && theme.topic_count === 0 && (
									<Button variant="tertiary" size="compact" isDestructive onClick={ () => handleDeleteTheme( theme.id ) }>Delete</Button>
								) }
							</div>
						</div>
					) ) }
				</div>
			</div>

			<div className="clipisode-settings-section">
				<div style={ { display: 'flex', alignItems: 'center', justifyContent: 'space-between' } }>
					<h2>Preview Page</h2>
					<Button
						variant="primary"
						size="compact"
						onClick={ handleAddPreview }
						isBusy={ addingPreview }
						disabled={ addingPreview }
					>
						Add New
					</Button>
				</div>
				<p style={ { color: '#646970', margin: '0 0 16px' } }>
					Controls the look and feel of public clipisode preview pages.
				</p>
				<div className="clipisode-theme-grid">
					{ previews.map( ( layout ) => (
						<div key={ layout.id } className="clipisode-theme-card">
							<div className="clipisode-theme-card-header">
								<strong>{ layout.title }</strong>
								{ layout.is_default && <span className="clipisode-status-badge open">default</span> }
							</div>
							<div className="clipisode-theme-card-actions">
								<Button variant="primary" size="compact" href={ layout.edit_url } target="_blank">Edit</Button>
								{ renderCloneUI( `preview-${ layout.id }`, () => handleClonePreview( layout.id ) ) }
								{ ! layout.is_default && (
									<Button variant="tertiary" size="compact" isDestructive onClick={ () => handleDeletePreview( layout.id ) }>Delete</Button>
								) }
							</div>
						</div>
					) ) }
				</div>
			</div>
		</>
	);
}
