import { useState, useEffect } from '@wordpress/element';
import { Button, TextControl, SelectControl, Spinner, Notice } from '@wordpress/components';
import apiFetch from '@wordpress/api-fetch';
import VideoUploader from '../components/VideoUploader';
import type { Topic, VideoValue, CustomTermsItem } from '../types';

interface TopicFormProps {
	id?: string;
	navigate: ( path: string | number ) => void;
}

export default function TopicForm( { id, navigate }: TopicFormProps ) {
	const isEdit = Boolean( id );
	const [ form, setForm ] = useState( {
		title: '',
		hosted_by: '',
		custom_terms_id: '',
	} );
	const [ video, setVideo ] = useState< VideoValue | null >( null );
	const [ customTerms, setCustomTerms ] = useState< CustomTermsItem[] >( [] );
	const [ loading, setLoading ] = useState< boolean >( true );
	const [ saving, setSaving ] = useState< boolean >( false );
	const [ error, setError ] = useState< string | null >( null );

	useEffect( () => {
		const promises: Promise< any >[] = [
			apiFetch< CustomTermsItem[] >( { path: '/clipisode/v1/terms/custom' } ),
		];

		if ( isEdit ) {
			promises.push( apiFetch( { path: `/clipisode/v1/topics/${ id }` } ) );
		}

		Promise.all( promises )
			.then( ( [ terms, topic ]: [ CustomTermsItem[], Topic? ] ) => {
				setCustomTerms( terms );

				if ( topic ) {
					setForm( {
						title: topic.title || '',
						hosted_by: topic.hosted_by || '',
						custom_terms_id: topic.custom_terms_id ? String( topic.custom_terms_id ) : '',
					} );
					if ( topic.intro_video_id && topic.intro_video_url ) {
						setVideo( { id: topic.intro_video_id, url: topic.intro_video_url } );
					}
				}
			} )
			.finally( () => setLoading( false ) );
	}, [ id, isEdit ] );

	const updateField = ( field: string ) => ( value: string ) => {
		setForm( ( prev ) => ( { ...prev, [ field ]: value } ) );
	};

	const handleSubmit = () => {
		if ( ! form.title.trim() ) {
			setError( 'Title is required.' );
			return;
		}

		setSaving( true );
		setError( null );

		const data = {
			...form,
			custom_terms_id: form.custom_terms_id || null,
			intro_video_id: video?.id || null,
		};

		const request = isEdit
			? apiFetch( { path: `/clipisode/v1/topics/${ id }`, method: 'PUT', data } )
			: apiFetch( { path: '/clipisode/v1/topics', method: 'POST', data } );

		request
			.then( ( topic: Topic ) => navigate( String( topic.id ) ) )
			.catch( () => setError( 'Failed to save topic.' ) )
			.finally( () => setSaving( false ) );
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
			<a
				className="clipisode-back-link"
				onClick={ () => navigate( isEdit ? id : '' ) }
			>
				← { isEdit ? 'Back to Topic' : 'All Topics' }
			</a>

			<div className="clipisode-page-header">
				<h1>{ isEdit ? 'Edit Topic' : 'New Topic' }</h1>
			</div>

			{ error && (
				<Notice status="error" isDismissible={ false }>
					{ error }
				</Notice>
			) }

			<div style={ { maxWidth: 600 } }>
				<TextControl
					label="Title"
					value={ form.title }
					onChange={ updateField( 'title' ) }
					__nextHasNoMarginBottom
				/>
				<div style={ { marginTop: 16 } }>
					<TextControl
						label="Hosted By"
						value={ form.hosted_by }
						onChange={ updateField( 'hosted_by' ) }
						__nextHasNoMarginBottom
					/>
				</div>
				<div style={ { marginTop: 16 } }>
					<VideoUploader value={ video } onChange={ setVideo } />
				</div>
				<div style={ { marginTop: 16 } }>
					{ customTerms.length > 0 ? (
						<SelectControl
							label="Additional Custom Terms"
							value={ form.custom_terms_id }
							options={ [
								{ label: '— None —', value: '' },
								...customTerms.map( ( t ) => ( { label: t.title, value: String( t.id ) } ) ),
							] }
							onChange={ updateField( 'custom_terms_id' ) }
							help="Brand terms are automatically included. Optionally select additional custom terms."
							__nextHasNoMarginBottom
						/>
					) : (
						<div>
							<p style={ { fontSize: 13, color: '#646970', margin: 0 } }>
								Brand terms are automatically included. No custom terms have been created yet.
								{ ' ' }
								<a href="/wp-admin/post-new.php?post_type=clipisode_terms">
									Create custom terms
								</a>
							</p>
						</div>
					) }
				</div>
				<div style={ { marginTop: 24, display: 'flex', gap: 8 } }>
					<Button
						variant="primary"
						onClick={ handleSubmit }
						isBusy={ saving }
						disabled={ saving }
					>
						{ isEdit ? 'Update Topic' : 'Create Topic' }
					</Button>
					<Button
						variant="tertiary"
						onClick={ () => navigate( isEdit ? id : '' ) }
					>
						Cancel
					</Button>
				</div>
			</div>
		</>
	);
}
