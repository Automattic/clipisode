import { useState, useRef, useEffect, useCallback } from '@wordpress/element';
import { Button, Modal } from '@wordpress/components';
import TrimTimeline from './TrimTimeline';

interface TrimModalProps {
	url: string;
	name: string;
	duration: number;
	initialStart: number;
	initialEnd: number;
	onDone: ( start: number, end: number ) => void;
	onClose: () => void;
}

function formatTime( seconds: number ): string {
	const m = Math.floor( seconds / 60 );
	const s = seconds % 60;
	return `${ m }:${ s.toFixed( 1 ).padStart( 4, '0' ) }`;
}

export default function TrimModal( {
	url,
	name,
	duration,
	initialStart,
	initialEnd,
	onDone,
	onClose,
}: TrimModalProps ) {
	const videoRef = useRef< HTMLVideoElement | null >( null );
	const rafRef = useRef< number >( 0 );
	const [ trimStart, setTrimStart ] = useState( initialStart );
	const [ trimEnd, setTrimEnd ] = useState( initialEnd );
	const [ currentTime, setCurrentTime ] = useState( initialStart );
	const [ playing, setPlaying ] = useState( false );

	const trimStartRef = useRef( trimStart );
	const trimEndRef = useRef( trimEnd );
	const playingRef = useRef( playing );
	trimStartRef.current = trimStart;
	trimEndRef.current = trimEnd;
	playingRef.current = playing;

	const syncPlayhead = useCallback( () => {
		const video = videoRef.current;
		if ( ! video ) return;

		setCurrentTime( video.currentTime );

		if ( video.currentTime >= trimEndRef.current ) {
			video.pause();
			setPlaying( false );
			video.currentTime = trimStartRef.current;
			return;
		}

		rafRef.current = requestAnimationFrame( syncPlayhead );
	}, [] );

	useEffect( () => {
		return () => cancelAnimationFrame( rafRef.current );
	}, [] );

	const togglePlay = useCallback( () => {
		const video = videoRef.current;
		if ( ! video ) return;

		if ( playingRef.current ) {
			video.pause();
			setPlaying( false );
			cancelAnimationFrame( rafRef.current );
		} else {
			if ( video.currentTime < trimStartRef.current || video.currentTime >= trimEndRef.current ) {
				video.currentTime = trimStartRef.current;
			}
			video.play();
			setPlaying( true );
			rafRef.current = requestAnimationFrame( syncPlayhead );
		}
	}, [ syncPlayhead ] );

	const handleTrimChange = ( start: number, end: number ) => {
		setTrimStart( Math.max( 0, start ) );
		setTrimEnd( Math.min( duration, end ) );
	};

	const handleSeek = ( time: number ) => {
		const clamped = Math.max( 0, Math.min( time, duration ) );
		setCurrentTime( clamped );
		if ( videoRef.current ) {
			videoRef.current.currentTime = clamped;
		}
	};

	const handleReset = () => {
		setTrimStart( 0 );
		setTrimEnd( duration );
		if ( videoRef.current ) {
			videoRef.current.currentTime = 0;
		}
		setCurrentTime( 0 );
	};

	const setInPoint = useCallback( () => {
		const time = videoRef.current?.currentTime ?? 0;
		setTrimStart( Math.max( 0, Math.min( time, trimEndRef.current - 0.1 ) ) );
	}, [] );

	const setOutPoint = useCallback( () => {
		const time = videoRef.current?.currentTime ?? duration;
		setTrimEnd( Math.min( duration, Math.max( time, trimStartRef.current + 0.1 ) ) );
	}, [ duration ] );

	useEffect( () => {
		const onKeyDown = ( e: KeyboardEvent ) => {
			const tag = ( e.target as HTMLElement )?.tagName;
			if ( tag === 'INPUT' || tag === 'TEXTAREA' ) return;

			if ( e.key === ' ' ) {
				e.preventDefault();
				togglePlay();
			} else if ( e.key === 'i' || e.key === 'I' ) {
				e.preventDefault();
				setInPoint();
			} else if ( e.key === 'o' || e.key === 'O' ) {
				e.preventDefault();
				setOutPoint();
			}
		};

		window.addEventListener( 'keydown', onKeyDown );
		return () => window.removeEventListener( 'keydown', onKeyDown );
	}, [ togglePlay, setInPoint, setOutPoint ] );

	const trimmedDuration = trimEnd - trimStart;

	return (
		<Modal title={ `Trim: ${ name }` } onRequestClose={ onClose } isFullScreen>
			<div className="clipisode-trim-modal">
				<div className="clipisode-trim-video-wrap">
					<video
						ref={ videoRef }
						src={ url }
						playsInline
						onClick={ togglePlay }
						style={ { width: '100%', maxHeight: '60vh', background: '#000', cursor: 'pointer' } }
					/>
				</div>

				<div className="clipisode-trim-timeline-wrap" style={ { margin: '16px 0' } }>
					<TrimTimeline
						duration={ duration }
						trimStart={ trimStart }
						trimEnd={ trimEnd }
						currentTime={ currentTime }
						onTrimChange={ handleTrimChange }
						onSeek={ handleSeek }
					/>
				</div>

				<div className="clipisode-trim-controls" style={ { display: 'flex', justifyContent: 'center', gap: 12, margin: '8px 0' } }>
					<Button variant="secondary" onClick={ togglePlay }>
						{ playing ? '⏸ Pause' : '▶ Play' }
					</Button>
					<Button variant="secondary" onClick={ setInPoint }>
						Set In (I)
					</Button>
					<Button variant="secondary" onClick={ setOutPoint }>
						Set Out (O)
					</Button>
				</div>

				<div className="clipisode-trim-info" style={ { display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13, color: '#646970', marginBottom: 16 } }>
					<span>In: { formatTime( trimStart ) }</span>
					<span>Out: { formatTime( trimEnd ) }</span>
					<span>Trimmed: { formatTime( trimmedDuration ) } / { formatTime( duration ) }</span>
				</div>

				<div className="clipisode-trim-actions" style={ { display: 'flex', gap: 8, justifyContent: 'flex-end' } }>
					<Button variant="secondary" onClick={ () => {
						const video = videoRef.current;
						if ( ! video ) return;
						video.currentTime = trimStartRef.current;
						video.play();
						setPlaying( true );
						rafRef.current = requestAnimationFrame( syncPlayhead );
					} }>
						Preview Trim
					</Button>
					<Button variant="tertiary" onClick={ handleReset }>
						Reset
					</Button>
					<Button variant="primary" onClick={ () => onDone( trimStart, trimEnd ) }>
						Done
					</Button>
				</div>
			</div>
		</Modal>
	);
}
