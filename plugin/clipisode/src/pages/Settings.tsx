import { useState, useEffect } from '@wordpress/element';
import { Button, Card, CardBody, CardHeader, Spinner } from '@wordpress/components';
import apiFetch from '@wordpress/api-fetch';
import type { BrandTerms, CustomTermsItem } from '../types';

function formatDate( dateStr: string ): string {
	const d = new Date( dateStr );
	return d.toLocaleDateString( undefined, {
		year: 'numeric',
		month: 'short',
		day: 'numeric',
	} );
}

export default function Settings(): JSX.Element {
	const [ brandTerms, setBrandTerms ] = useState< BrandTerms | null >( null );
	const [ customTerms, setCustomTerms ] = useState< CustomTermsItem[] >( [] );
	const [ loading, setLoading ] = useState< boolean >( true );

	useEffect( () => {
		Promise.all( [
			apiFetch< BrandTerms >( { path: '/clipisode/v1/terms/brand' } ),
			apiFetch< CustomTermsItem[] >( { path: '/clipisode/v1/terms/custom' } ),
		] )
			.then( ( [ brand, custom ] ) => {
				setBrandTerms( brand );
				setCustomTerms( custom );
			} )
			.finally( () => setLoading( false ) );
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
						<strong>Storage</strong>
					</CardHeader>
					<CardBody>
						<p style={ { margin: 0, color: '#646970', fontSize: 13 } }>
							Storage configuration coming soon. Clips currently use the WordPress media library.
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
		</>
	);
}
