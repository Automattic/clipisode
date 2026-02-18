import './view.css';
import QRCode from 'qrcode';

function initFlow( root: HTMLElement ): void {
	const slug = root.dataset.slug || '';
	const restUrl = root.dataset.restUrl || '';
	const nonce = root.dataset.nonce || '';
	const uploadNonce = root.dataset.uploadNonce || '';

	const isMobile =
		navigator.maxTouchPoints > 0 && window.innerWidth < 1280;

	const stages = root.querySelectorAll< HTMLElement >( '[data-step]' );
	let attachmentId: number | null = null;
	let uploadComplete = false;

	function showStep( step: string ): void {
		stages.forEach( ( el ) => {
			el.style.display = el.dataset.step === step ? '' : 'none';
		} );
	}

	// Video play / pause — attach to every video-wrap pair.
	root.querySelectorAll< HTMLElement >( '.ci-video-wrap' ).forEach( ( wrap ) => {
		const vid = wrap.querySelector< HTMLVideoElement >( '.ci-video' );
		const btn = wrap.querySelector< HTMLElement >( '.ci-play-btn' );
		if ( ! vid || ! btn ) return;

		btn.addEventListener( 'click', () => {
			vid.play();
			btn.classList.add( 'ci-hidden' );
		} );

		vid.addEventListener( 'ended', () => {
			btn.classList.remove( 'ci-hidden' );
		} );
	} );

	// Terms modals — each terms element has its own modal.
	root.querySelectorAll< HTMLElement >( '.ci-el-terms' ).forEach( ( termsEl ) => {
		const modal = termsEl.querySelector< HTMLElement >( '.ci-terms-modal' );
		const content = termsEl.querySelector< HTMLElement >( '.ci-terms-content' );
		const close = termsEl.querySelector< HTMLElement >( '.ci-terms-close' );

		termsEl.querySelectorAll< HTMLAnchorElement >( '.ci-terms-open' ).forEach( ( link ) => {
			link.addEventListener( 'click', async ( e ) => {
				e.preventDefault();
				if ( ! modal || ! content ) return;

				const url = link.dataset.termsUrl;
				if ( ! url ) return;

				content.innerHTML = '<p style="opacity:0.5">Loading…</p>';
				modal.hidden = false;

				try {
					const res = await fetch( url );
					const html = await res.text();
					const doc = new DOMParser().parseFromString( html, 'text/html' );
					const body = doc.querySelector( '.entry-content' )
						|| doc.querySelector( 'article' )
						|| doc.querySelector( '.post-content' )
						|| doc.querySelector( 'main' )
						|| doc.body;
					content.innerHTML = body?.innerHTML || html;
				} catch {
					content.innerHTML = '<p>Could not load terms. Please try again.</p>';
				}
			} );
		} );

		close?.addEventListener( 'click', () => {
			if ( modal ) modal.hidden = true;
		} );
	} );

	// Desktop: add class (CSS handles visibility), render QR code.
	if ( ! isMobile ) {
		root.classList.add( 'ci-desktop' );

		const qrContainer = root.querySelector< HTMLElement >( '.ci-qr-canvas' );
		if ( qrContainer ) {
			QRCode.toCanvas(
				window.location.href,
				{ width: 200, margin: 2, color: { dark: '#000000', light: '#ffffff' } },
				( err: Error | null, canvas: HTMLCanvasElement ) => {
					if ( ! err && canvas ) {
						canvas.style.borderRadius = '12px';
						qrContainer.appendChild( canvas );
					}
				}
			);
		}

		return;
	}

	root.addEventListener( 'click', ( e: Event ) => {
		const btn = ( e.target as HTMLElement ).closest< HTMLElement >(
			'[data-goto]'
		);
		if ( ! btn ) return;
		e.preventDefault();

		const step = btn.dataset.goto!;
		root.querySelectorAll< HTMLVideoElement >( 'video' ).forEach( ( v ) => v.pause() );
		showStep( step );

		if ( step === 'record' ) {
			setTimeout( () => {
				const fileInput =
					root.querySelector< HTMLInputElement >( '.ci-file-input' );
				fileInput?.click();
			}, 150 );
		}
	} );

	const fileInput = root.querySelector< HTMLInputElement >( '.ci-file-input' );
	const chooseBtn = root.querySelector< HTMLElement >( '.ci-choose-btn' );
	const statusText = root.querySelector< HTMLElement >( '.ci-status-text' );
	const progressFill = root.querySelector< HTMLElement >( '.ci-progress-fill' );
	const progressBar = root.querySelector< HTMLElement >( '.ci-progress-bar' );
	const formSection = root.querySelector< HTMLElement >( '.ci-form-section' );
	const submitBtn = root.querySelector< HTMLButtonElement >( '.ci-submit' );
	const nameInput = root.querySelector< HTMLInputElement >( '.ci-name-input' );
	const handleInput = root.querySelector< HTMLInputElement >( '.ci-handle-input' );
	const errorBox = root.querySelector< HTMLElement >( '.ci-error' );

	chooseBtn?.addEventListener( 'click', () => fileInput?.click() );

	function checkSubmitReady(): void {
		if ( submitBtn ) {
			submitBtn.disabled =
				! uploadComplete || ! nameInput?.value.trim();
		}
	}

	nameInput?.addEventListener( 'input', checkSubmitReady );

	fileInput?.addEventListener( 'change', () => {
		const file = fileInput.files?.[ 0 ];
		if ( ! file ) return;

		if ( chooseBtn ) chooseBtn.style.display = 'none';
		if ( formSection ) formSection.style.display = 'block';

		startUpload( file );
	} );

	function startUpload( file: File ): void {
		if ( statusText ) statusText.textContent = 'Uploading 0%';

		const formData = new FormData();
		formData.append( 'video', file );
		formData.append( 'slug', slug );
		formData.append( '_clipisode_nonce', uploadNonce );

		const xhr = new XMLHttpRequest();

		xhr.upload.addEventListener( 'progress', ( e: ProgressEvent ) => {
			if ( e.lengthComputable ) {
				const pct = Math.round( ( e.loaded / e.total ) * 100 );
				if ( statusText ) statusText.textContent = `Uploading ${ pct }%`;
				if ( progressFill ) progressFill.style.width = `${ pct }%`;
			}
		} );

		xhr.addEventListener( 'load', () => {
			if ( xhr.status >= 200 && xhr.status < 300 ) {
				const result = JSON.parse( xhr.responseText );
				attachmentId = result.attachment_id;
				uploadComplete = true;
				if ( statusText ) statusText.textContent = 'Upload complete ✓';
				if ( progressFill ) progressFill.style.width = '100%';
				if ( progressBar ) progressBar.classList.add( 'ci-complete' );
				checkSubmitReady();
			} else {
				if ( statusText )
					statusText.textContent = 'Upload failed — please try again.';
				if ( progressBar ) progressBar.classList.add( 'ci-error-bar' );
			}
		} );

		xhr.addEventListener( 'error', () => {
			if ( statusText )
				statusText.textContent = 'Upload failed — please try again.';
			if ( progressBar ) progressBar.classList.add( 'ci-error-bar' );
		} );

		xhr.open( 'POST', `${ restUrl }clipisode/v1/invitation/upload` );
		xhr.setRequestHeader( 'X-WP-Nonce', nonce );
		xhr.send( formData );
	}

	submitBtn?.addEventListener( 'click', async () => {
		const name = nameInput?.value.trim();
		if ( ! name ) return;

		submitBtn.disabled = true;
		submitBtn.textContent = 'Saving…';

		if ( errorBox ) {
			errorBox.style.display = 'none';
			errorBox.textContent = '';
		}

		try {
			const res = await fetch(
				`${ restUrl }clipisode/v1/invitation/submit`,
				{
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						'X-WP-Nonce': nonce,
					},
					body: JSON.stringify( {
						slug,
						name,
						social_handle: handleInput?.value.trim() || null,
						attachment_id: attachmentId,
						_clipisode_nonce: uploadNonce,
					} ),
				}
			);

			if ( ! res.ok ) {
				const err = await res.json();
				throw new Error( err.message || 'Submission failed.' );
			}

			showStep( 'thanks' );
		} catch ( err: unknown ) {
			const message =
				err instanceof Error ? err.message : 'Submission failed.';
			if ( errorBox ) {
				errorBox.textContent = message;
				errorBox.style.display = '';
			}
			submitBtn.disabled = false;
			submitBtn.textContent = 'Save My Reply';
		}
	} );

	showStep( 'landing' );
}

document.addEventListener( 'DOMContentLoaded', () => {
	document
		.querySelectorAll< HTMLElement >( '.ci-flow-root' )
		.forEach( initFlow );
} );
