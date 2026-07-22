import { useRef, useEffect, useCallback } from '@wordpress/element';

interface TrimTimelineProps {
	duration: number;
	trimStart: number;
	trimEnd: number;
	currentTime: number;
	onTrimChange: ( start: number, end: number ) => void;
	onSeek: ( time: number ) => void;
}

const HANDLE_WIDTH = 12;
const BAR_HEIGHT = 48;
const PLAYHEAD_COLOR = '#fff';
const REGION_COLOR = 'rgba(0, 124, 186, 0.35)';
const OUTSIDE_COLOR = 'rgba(0, 0, 0, 0.55)';
const HANDLE_COLOR = '#007cba';

export default function TrimTimeline( {
	duration,
	trimStart,
	trimEnd,
	currentTime,
	onTrimChange,
	onSeek,
}: TrimTimelineProps ) {
	const canvasRef = useRef< HTMLCanvasElement | null >( null );
	const dragging = useRef< 'in' | 'out' | 'seek' | null >( null );

	const timeToX = useCallback(
		( time: number, width: number ) =>
			HANDLE_WIDTH + ( time / duration ) * ( width - HANDLE_WIDTH * 2 ),
		[ duration ]
	);

	const xToTime = useCallback(
		( x: number, width: number ) => {
			const clamped = Math.max(
				HANDLE_WIDTH,
				Math.min( x, width - HANDLE_WIDTH )
			);
			return (
				( ( clamped - HANDLE_WIDTH ) / ( width - HANDLE_WIDTH * 2 ) ) *
				duration
			);
		},
		[ duration ]
	);

	const draw = useCallback( () => {
		const canvas = canvasRef.current;
		if ( ! canvas || duration <= 0 ) {
			return;
		}

		const ctx = canvas.getContext( '2d' );
		if ( ! ctx ) {
			return;
		}

		const dpr = window.devicePixelRatio || 1;
		const rect = canvas.getBoundingClientRect();
		canvas.width = rect.width * dpr;
		canvas.height = BAR_HEIGHT * dpr;
		ctx.scale( dpr, dpr );

		const w = rect.width;
		const h = BAR_HEIGHT;

		ctx.clearRect( 0, 0, w, h );

		// Track background
		ctx.fillStyle = '#1e1e1e';
		ctx.fillRect( 0, 0, w, h );

		const inX = timeToX( trimStart, w );
		const outX = timeToX( trimEnd, w );

		// Dimmed outside regions
		ctx.fillStyle = OUTSIDE_COLOR;
		ctx.fillRect( 0, 0, inX, h );
		ctx.fillRect( outX, 0, w - outX, h );

		// Selected region
		ctx.fillStyle = REGION_COLOR;
		ctx.fillRect( inX, 0, outX - inX, h );

		// In handle — styled as ]
		ctx.fillStyle = HANDLE_COLOR;
		ctx.fillRect( inX - HANDLE_WIDTH, 0, HANDLE_WIDTH, h );
		ctx.fillStyle = '#fff';
		ctx.font = `bold ${ Math.round( h * 0.45 ) }px monospace`;
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		ctx.fillText( ']', inX - HANDLE_WIDTH / 2, h / 2 );

		// Out handle — styled as [
		ctx.fillStyle = HANDLE_COLOR;
		ctx.fillRect( outX, 0, HANDLE_WIDTH, h );
		ctx.fillStyle = '#fff';
		ctx.fillText( '[', outX + HANDLE_WIDTH / 2, h / 2 );

		// Playhead
		const phX = timeToX( currentTime, w );
		ctx.fillStyle = PLAYHEAD_COLOR;
		ctx.fillRect( phX - 1, 0, 2, h );
	}, [ duration, trimStart, trimEnd, currentTime, timeToX ] );

	useEffect( () => {
		draw();
	}, [ draw ] );

	useEffect( () => {
		const canvas = canvasRef.current;
		if ( ! canvas ) {
			return;
		}

		const observer = new ResizeObserver( () => draw() );
		observer.observe( canvas );
		return () => observer.disconnect();
	}, [ draw ] );

	const getPointerTime = ( e: React.PointerEvent ) => {
		const canvas = canvasRef.current;
		if ( ! canvas ) {
			return 0;
		}
		const rect = canvas.getBoundingClientRect();
		return xToTime( e.clientX - rect.left, rect.width );
	};

	const hitTest = ( e: React.PointerEvent ): 'in' | 'out' | 'seek' => {
		const canvas = canvasRef.current;
		if ( ! canvas ) {
			return 'seek';
		}
		const rect = canvas.getBoundingClientRect();
		const x = e.clientX - rect.left;
		const w = rect.width;
		const inX = timeToX( trimStart, w );
		const outX = timeToX( trimEnd, w );

		if ( Math.abs( x - inX ) < HANDLE_WIDTH + 4 ) {
			return 'in';
		}
		if ( Math.abs( x - outX ) < HANDLE_WIDTH + 4 ) {
			return 'out';
		}
		return 'seek';
	};

	const onPointerDown = ( e: React.PointerEvent ) => {
		const target = hitTest( e );
		dragging.current = target;
		( e.target as HTMLElement ).setPointerCapture( e.pointerId );

		if ( target === 'seek' ) {
			onSeek( getPointerTime( e ) );
		}
	};

	const onPointerMove = ( e: React.PointerEvent ) => {
		if ( ! dragging.current ) {
			return;
		}
		const time = getPointerTime( e );

		if ( dragging.current === 'in' ) {
			onTrimChange( Math.min( time, trimEnd - 0.1 ), trimEnd );
		} else if ( dragging.current === 'out' ) {
			onTrimChange( trimStart, Math.max( time, trimStart + 0.1 ) );
		} else {
			onSeek( time );
		}
	};

	const onPointerUp = () => {
		dragging.current = null;
	};

	return (
		<canvas
			ref={ canvasRef }
			style={ {
				width: '100%',
				height: BAR_HEIGHT,
				cursor: 'pointer',
				borderRadius: 4,
				display: 'block',
			} }
			onPointerDown={ onPointerDown }
			onPointerMove={ onPointerMove }
			onPointerUp={ onPointerUp }
		/>
	);
}
