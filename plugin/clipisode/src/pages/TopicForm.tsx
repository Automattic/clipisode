import { useState, useEffect, useRef } from '@wordpress/element';
import {
	Button,
	TextControl,
	SelectControl,
	Spinner,
	Notice,
} from '@wordpress/components';
import apiFetch from '@wordpress/api-fetch';
import VideoUploader from '../components/VideoUploader';
import SocialImagePicker from '../components/SocialImagePicker';
import type { Topic, VideoValue, CustomTermsItem, Host, Theme } from '../types';

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
		invitation_id: '',
	} );
	const [ video, setVideo ] = useState< VideoValue | null >( null );
	const [ socialImage, setSocialImage ] = useState< {
		id: number;
		url: string;
	} | null >( null );
	const [ customTerms, setCustomTerms ] = useState< CustomTermsItem[] >( [] );
	const [ themes, setThemes ] = useState< Theme[] >( [] );
	const [ hostNames, setHostNames ] = useState< string[] >( [] );
	const [ hostFocused, setHostFocused ] = useState( false );
	const hostRef = useRef< HTMLDivElement >( null );
	const introVideoRef = useRef< HTMLVideoElement >( null );
	const [ loading, setLoading ] = useState< boolean >( true );
	const [ saving, setSaving ] = useState< boolean >( false );
	const [ error, setError ] = useState< string | null >( null );

	useEffect( () => {
		const promises: Promise< any >[] = [
			apiFetch< CustomTermsItem[] >( {
				path: '/clipisode/v1/terms/custom',
			} ),
			apiFetch< Host[] >( { path: '/clipisode/v1/hosts' } ),
			apiFetch< Theme[] >( { path: '/clipisode/v1/themes' } ),
		];

		if ( isEdit ) {
			promises.push(
				apiFetch( { path: `/clipisode/v1/topics/${ id }` } )
			);
		}

		Promise.all( promises )
			.then(
				( [ terms, hosts, themeList, topic ]: [
					CustomTermsItem[],
					Host[],
					Theme[],
					Topic?,
				] ) => {
					setCustomTerms( terms );
					setHostNames( hosts.map( ( h ) => h.name ) );
					setThemes( themeList );

					if ( topic ) {
						setForm( {
							title: topic.title || '',
							hosted_by: topic.hosted_by || '',
							custom_terms_id: topic.custom_terms_id
								? String( topic.custom_terms_id )
								: '',
							invitation_id: topic.invitation_id
								? String( topic.invitation_id )
								: '',
						} );
						if ( topic.intro_media_id && topic.intro_video_url ) {
							setVideo( {
								id: topic.intro_media_id,
								url: topic.intro_video_url,
								reused: true,
							} );
						}
						if (
							topic.social_image_media_id &&
							topic.social_image_url
						) {
							setSocialImage( {
								id: topic.social_image_media_id,
								url: topic.social_image_url,
							} );
						}
					} else {
						const defaultHost = hosts.find( ( h ) => h.is_default );
						const defaultTheme =
							themeList.length > 0
								? themeList.find( ( t ) => t.is_default ) ||
								  themeList[ 0 ]
								: null;
						setForm( ( prev ) => ( {
							...prev,
							...( defaultHost
								? { hosted_by: defaultHost.name }
								: {} ),
							...( defaultTheme
								? { invitation_id: String( defaultTheme.id ) }
								: {} ),
						} ) );
					}
				}
			)
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
			hosted_by: form.hosted_by.trim(),
			custom_terms_id: form.custom_terms_id || null,
			invitation_id: form.invitation_id || null,
			intro_media_id: video?.id || null,
			social_image_media_id: socialImage?.id || null,
		};

		const request = isEdit
			? apiFetch( {
					path: `/clipisode/v1/topics/${ id }`,
					method: 'PUT',
					data,
			  } )
			: apiFetch( {
					path: '/clipisode/v1/topics',
					method: 'POST',
					data,
			  } );

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

	const selectedTheme = themes.find(
		( t ) => String( t.id ) === form.invitation_id
	);

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
					__next40pxDefaultSize
				/>
				<div
					style={ { marginTop: 16, position: 'relative' } }
					ref={ hostRef }
				>
					<TextControl
						label="Hosted By"
						value={ form.hosted_by }
						onChange={ updateField( 'hosted_by' ) }
						onFocus={ () => setHostFocused( true ) }
						onBlur={ () =>
							setTimeout( () => setHostFocused( false ), 150 )
						}
						autoComplete="off"
						__nextHasNoMarginBottom
						__next40pxDefaultSize
					/>
					{ hostFocused &&
						form.hosted_by.length > 0 &&
						( () => {
							const filtered = hostNames.filter(
								( n ) =>
									n
										.toLowerCase()
										.includes(
											form.hosted_by.toLowerCase()
										) && n !== form.hosted_by
							);
							if ( ! filtered.length ) {
								return null;
							}
							return (
								<ul className="clipisode-host-suggestions">
									{ filtered.map( ( name ) => (
										<li
											key={ name }
											onMouseDown={ () => {
												setForm( ( prev ) => ( {
													...prev,
													hosted_by: name,
												} ) );
												setHostFocused( false );
											} }
										>
											{ name }
										</li>
									) ) }
								</ul>
							);
						} )() }
				</div>
				<div style={ { marginTop: 16 } }>
					<VideoUploader
						value={ video }
						onChange={ setVideo }
						videoRef={ introVideoRef }
					/>
				</div>
				<div style={ { marginTop: 16 } }>
					<SocialImagePicker
						value={ socialImage }
						videoRef={ introVideoRef }
						hasVideo={ Boolean( video ) }
						onChange={ setSocialImage }
					/>
				</div>
				<div style={ { marginTop: 16 } }>
					{ themes.length > 1 ? (
						<SelectControl
							label="Theme"
							value={ form.invitation_id }
							options={ themes.map( ( t ) => ( {
								label:
									t.title +
									( t.is_default ? ' (default)' : '' ),
								value: String( t.id ),
							} ) ) }
							onChange={ updateField( 'invitation_id' ) }
							help="Choose which theme guests will see on the invitation page."
							__nextHasNoMarginBottom
							__next40pxDefaultSize
						/>
					) : (
						<div>
							<p
								style={ {
									fontSize: 13,
									color: '#646970',
									margin: 0,
								} }
							>
								<strong>Theme:</strong>{ ' ' }
								{ selectedTheme?.title || 'Default' }
								{ selectedTheme?.edit_url && (
									<>
										{ ' — ' }
										<a
											href={ selectedTheme.edit_url }
											target="_blank"
											rel="noreferrer"
										>
											Edit in block editor
										</a>
									</>
								) }
							</p>
						</div>
					) }
				</div>
				<div style={ { marginTop: 16 } }>
					{ customTerms.length > 0 ? (
						<SelectControl
							label="Additional Custom Terms"
							value={ form.custom_terms_id }
							options={ [
								{ label: '— None —', value: '' },
								...customTerms.map( ( t ) => ( {
									label: t.title,
									value: String( t.id ),
								} ) ),
							] }
							onChange={ updateField( 'custom_terms_id' ) }
							help="Brand terms are automatically included. Optionally select additional custom terms."
							__nextHasNoMarginBottom
							__next40pxDefaultSize
						/>
					) : (
						<div>
							<p
								style={ {
									fontSize: 13,
									color: '#646970',
									margin: 0,
								} }
							>
								Brand terms are automatically included. No
								custom terms have been created yet.{ ' ' }
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
