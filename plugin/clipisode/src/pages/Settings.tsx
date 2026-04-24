import { useState, useEffect, useCallback } from '@wordpress/element';
import { Button, Card, CardBody, CardHeader, SelectControl, Spinner, TextControl, Notice, ToggleControl } from '@wordpress/components';
import apiFetch from '@wordpress/api-fetch';
import type { BrandTerms, CustomTermsItem, Host } from '../types';

function formatDate( dateStr: string ): string {
	const d = new Date( dateStr );
	return d.toLocaleDateString( undefined, {
		year: 'numeric',
		month: 'short',
		day: 'numeric',
	} );
}

interface PluginSettings {
	invitation_prefix: string;
	preview_prefix: string;
	debug_mode: boolean;
}

export default function Settings(): JSX.Element {
	const [ brandTerms, setBrandTerms ] = useState< BrandTerms | null >( null );
	const [ customTerms, setCustomTerms ] = useState< CustomTermsItem[] >( [] );
	const [ hosts, setHosts ] = useState< Host[] >( [] );
	const [ loading, setLoading ] = useState< boolean >( true );
	const [ invitationPrefix, setInvitationPrefix ] = useState( '' );
	const [ savedInvitationPrefix, setSavedInvitationPrefix ] = useState( '' );
	const [ previewPrefix, setPreviewPrefix ] = useState( '' );
	const [ savedPreviewPrefix, setSavedPreviewPrefix ] = useState( '' );
	const [ savingPrefix, setSavingPrefix ] = useState( false );
	const [ prefixNotice, setPrefixNotice ] = useState< string | null >( null );
	const [ debugMode, setDebugMode ] = useState( false );
	const [ savingDebug, setSavingDebug ] = useState( false );

	useEffect( () => {
		Promise.all( [
			apiFetch< BrandTerms >( { path: '/clipisode/v1/terms/brand' } ),
			apiFetch< CustomTermsItem[] >( { path: '/clipisode/v1/terms/custom' } ),
			apiFetch< Host[] >( { path: '/clipisode/v1/hosts' } ),
			apiFetch< PluginSettings >( { path: '/clipisode/v1/settings' } ),
		] )
			.then( ( [ brand, custom, h, settings ] ) => {
				setBrandTerms( brand );
				setCustomTerms( custom );
				setHosts( h );
				setInvitationPrefix( settings.invitation_prefix );
				setSavedInvitationPrefix( settings.invitation_prefix );
				setPreviewPrefix( settings.preview_prefix );
				setSavedPreviewPrefix( settings.preview_prefix );
				setDebugMode( settings.debug_mode );
			} )
			.finally( () => setLoading( false ) );
	}, [] );

	const savePrefixes = useCallback( () => {
		setSavingPrefix( true );
		setPrefixNotice( null );
		apiFetch< PluginSettings >( {
			path: '/clipisode/v1/settings',
			method: 'PUT',
			data: { invitation_prefix: invitationPrefix, preview_prefix: previewPrefix },
		} )
			.then( ( settings ) => {
				setInvitationPrefix( settings.invitation_prefix );
				setSavedInvitationPrefix( settings.invitation_prefix );
				setPreviewPrefix( settings.preview_prefix );
				setSavedPreviewPrefix( settings.preview_prefix );
				setPrefixNotice( 'URL prefixes updated.' );
			} )
			.finally( () => setSavingPrefix( false ) );
	}, [ invitationPrefix, previewPrefix ] );

	const deleteHost = ( id: number ) => {
		apiFetch( { path: `/clipisode/v1/hosts/${ id }`, method: 'DELETE' } )
			.then( () => setHosts( ( prev ) => prev.filter( ( h ) => h.id !== id ) ) );
	};

	const setDefaultHost = ( value: string ) => {
		const id = value ? Number( value ) : null;
		apiFetch< Host[] >( {
			path: '/clipisode/v1/hosts/default',
			method: 'PUT',
			data: { id },
		} ).then( setHosts );
	};

	const toggleDebugMode = useCallback( ( enabled: boolean ) => {
		setDebugMode( enabled );
		setSavingDebug( true );
		apiFetch< PluginSettings >( {
			path: '/clipisode/v1/settings',
			method: 'PUT',
			data: { debug_mode: enabled },
		} )
			.then( ( settings ) => setDebugMode( settings.debug_mode ) )
			.finally( () => setSavingDebug( false ) );
	}, [] );

	const newTermsUrl = 'post-new.php?post_type=clipisode_terms';

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
				<h1>Settings</h1>
			</div>

			<div className="clipisode-settings-section">
				<h2>Hosts</h2>
				<p className="clipisode-empty-hint" style={ { marginTop: 0 } }>
					Host names appear as autocomplete suggestions when creating a topic. Deleting a host here only removes it from suggestions — existing topics keep their host name.
				</p>

				{ hosts.length === 0 ? (
					<p className="clipisode-empty-hint">No hosts yet. They are added automatically when you create a topic.</p>
				) : (
					<>
						<table className="clipisode-table">
							<thead>
								<tr>
									<th>Name</th>
									<th></th>
								</tr>
							</thead>
							<tbody>
								{ hosts.map( ( host ) => (
									<tr key={ host.id }>
										<td>{ host.name }</td>
										<td style={ { textAlign: 'right' } }>
											<Button
												variant="tertiary"
												isDestructive
												size="compact"
												onClick={ () => deleteHost( host.id ) }
											>
												Delete
											</Button>
										</td>
									</tr>
								) ) }
							</tbody>
						</table>
						<div style={ { maxWidth: 300, marginTop: 12 } }>
							<SelectControl
								label="Default Host"
								value={ String( hosts.find( ( h ) => h.is_default )?.id ?? '' ) }
								options={ [
									{ label: '— None —', value: '' },
									...hosts.map( ( h ) => ( { label: h.name, value: String( h.id ) } ) ),
								] }
								onChange={ setDefaultHost }
								help="Pre-fills the host field when creating a new topic."
								__nextHasNoMarginBottom
								__next40pxDefaultSize
							/>
						</div>
					</>
				) }
			</div>

			<div className="clipisode-settings-section">
				<h2>Terms</h2>

				<Card>
					<CardHeader>
						<strong>Brand Terms</strong>
						{ brandTerms && (
							<div className="clipisode-brand-terms-actions">
								<Button
									variant="secondary"
									size="compact"
									href={ brandTerms.edit_url }
								>
									Edit
								</Button>
								<Button
									variant="tertiary"
									size="compact"
									href={ brandTerms.preview_url }
									target="_blank"
								>
									Preview
								</Button>
							</div>
						) }
					</CardHeader>
				</Card>

				<div className="clipisode-custom-terms">
					<div className="clipisode-custom-terms-header">
						<h3>Custom Terms</h3>
						<Button
							variant="secondary"
							size="compact"
							href={ newTermsUrl }
						>
							Add New
						</Button>
					</div>

					{ customTerms.length === 0 ? (
						<p className="clipisode-empty-hint">
							No custom terms yet. Custom terms can be optionally assigned to individual topics.
						</p>
					) : (
						<table className="clipisode-table">
							<thead>
								<tr>
									<th>Title</th>
									<th>Date</th>
									<th></th>
								</tr>
							</thead>
							<tbody>
								{ customTerms.map( ( term ) => (
									<tr key={ term.id }>
										<td>
											<a className="row-title" href={ term.edit_url }>
												{ term.title }
											</a>
										</td>
										<td>{ formatDate( term.modified ) }</td>
										<td>
											<a href={ term.preview_url } target="_blank" rel="noreferrer">
												Preview
											</a>
										</td>
									</tr>
								) ) }
							</tbody>
						</table>
					) }
				</div>
			</div>

			<div className="clipisode-settings-section">
				<h2>General</h2>

			<Card>
				<CardHeader>
					<strong>URL Prefixes</strong>
				</CardHeader>
				<CardBody>
					{ prefixNotice && (
						<Notice status="success" isDismissible onDismiss={ () => setPrefixNotice( null ) }>
							{ prefixNotice }
						</Notice>
					) }
					<TextControl
						label="Invitation URL Prefix"
						value={ invitationPrefix }
						onChange={ setInvitationPrefix }
						help={ `${ window.location.origin }/${ invitationPrefix || 'invitation' }/{code}` }
						__nextHasNoMarginBottom
						__next40pxDefaultSize
					/>
					<div style={ { marginTop: 16 } }>
						<TextControl
							label="Clipisode Preview URL Prefix"
							value={ previewPrefix }
							onChange={ setPreviewPrefix }
							help={ `${ window.location.origin }/${ previewPrefix || 'clipisode' }/{id}/{media_id}/{slug}` }
							__nextHasNoMarginBottom
							__next40pxDefaultSize
						/>
					</div>
					<div style={ { display: 'flex', alignItems: 'center', gap: 12, marginTop: 16 } }>
						<Button
							variant="primary"
							size="compact"
							onClick={ savePrefixes }
							isBusy={ savingPrefix }
							disabled={ savingPrefix || ( invitationPrefix === savedInvitationPrefix && previewPrefix === savedPreviewPrefix ) }
						>
							Save
						</Button>
						<p style={ { margin: 0, color: '#d63638', fontSize: 13 } }>
							Changing prefixes will break previously shared links.
						</p>
					</div>
				</CardBody>
			</Card>

				<Card>
					<CardHeader>
						<strong>Storage</strong>
					</CardHeader>
					<CardBody>
						<p style={ { margin: 0, color: '#646970', fontSize: 13 } }>
							Storage configuration coming soon. Replies currently use the WordPress media library.
						</p>
					</CardBody>
				</Card>
			</div>

			<div className="clipisode-settings-section">
				<Card>
					<CardHeader>
						<strong>Transcription</strong>
					</CardHeader>
					<CardBody>
						<p style={ { margin: 0, color: '#646970', fontSize: 13 } }>
							Transcription configuration coming soon.
						</p>
					</CardBody>
				</Card>
			</div>

			<div className="clipisode-settings-section">
				<h2>Developer</h2>
				<Card>
					<CardBody>
						<ToggleControl
							label="Debug Mode"
							checked={ debugMode }
							onChange={ toggleDebugMode }
							disabled={ savingDebug }
							help="Enables debug tools like the manifest inspector on the Create Clipisode screen."
							__nextHasNoMarginBottom
						/>
					</CardBody>
				</Card>
			</div>
		</>
	);
}
