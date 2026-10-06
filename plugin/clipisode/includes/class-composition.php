<?php

defined( 'ABSPATH' ) || exit;

class Clipisode_Composition {

	private const FPS = 30;

	public static function sanitize( mixed $value ): array|WP_Error {
		if ( ! is_array( $value ) || ! isset( $value['settings'], $value['clips'] ) || ! is_array( $value['settings'] ) || ! is_array( $value['clips'] ) || ! array_is_list( $value['clips'] ) ) {
			return self::invalid( 'Composition settings and clips are required.' );
		}

		$settings = $value['settings'];
		$clean    = [];
		$choices  = [
			'themeId'    => [ 'default', 'wpvip', 'none' ],
			'format'     => [ 'portrait', 'square', 'landscape' ],
			'fontFamily' => [ 'sans', 'serif' ],
			'videoFit'   => [ 'cover', 'contain' ],
		];
		foreach ( $choices as $key => $allowed ) {
			if ( ! isset( $settings[ $key ] ) || ! in_array( $settings[ $key ], $allowed, true ) ) {
				return self::invalid( "Invalid composition setting: $key." );
			}
			$clean[ $key ] = $settings[ $key ];
		}

		foreach ( [ 'title', 'subtitle', 'endingText' ] as $key ) {
			if ( ! isset( $settings[ $key ] ) || ! is_string( $settings[ $key ] ) ) {
				return self::invalid( "Invalid composition setting: $key." );
			}
			$clean[ $key ] = sanitize_textarea_field( $settings[ $key ] );
		}
		foreach ( [ 'accentColor', 'backgroundColor', 'textColor' ] as $key ) {
			if ( ! isset( $settings[ $key ] ) || ! is_string( $settings[ $key ] ) || ! preg_match( '/^#[a-fA-F0-9]{6}$/', $settings[ $key ] ) ) {
				return self::invalid( "Invalid composition color: $key." );
			}
			$clean[ $key ] = strtolower( $settings[ $key ] );
		}
		foreach ( [ 'showNames', 'showTitle', 'showEnding' ] as $key ) {
			if ( ! isset( $settings[ $key ] ) || ! is_bool( $settings[ $key ] ) ) {
				return self::invalid( "Invalid composition setting: $key." );
			}
			$clean[ $key ] = $settings[ $key ];
		}
		foreach ( [ 'titleDuration', 'endingDuration' ] as $key ) {
			if ( ! isset( $settings[ $key ] ) || ! self::is_number( $settings[ $key ] ) || round( $settings[ $key ] * self::FPS ) < 1 ) {
				return self::invalid( "The composition duration $key must include at least one frame." );
			}
			$clean[ $key ] = (float) $settings[ $key ];
		}
		if ( ! isset( $settings['logoUrl'] ) || ! is_string( $settings['logoUrl'] ) ) {
			return self::invalid( 'Invalid composition logo URL.' );
		}
		$clean['logoUrl'] = esc_url_raw( $settings['logoUrl'], [ 'http', 'https' ] );
		if ( '' !== $settings['logoUrl'] && ( ! $clean['logoUrl'] || ! wp_parse_url( $clean['logoUrl'], PHP_URL_HOST ) ) ) {
			return self::invalid( 'The logo URL must be an HTTP or HTTPS URL.' );
		}

		$clips = [];
		$ids   = [];
		$has_segment = 'none' !== $clean['themeId'] && ( $clean['showTitle'] || $clean['showEnding'] );
		foreach ( $value['clips'] as $clip ) {
			if ( ! is_array( $clip ) || ! isset( $clip['id'] ) || ! is_string( $clip['id'] ) || ! preg_match( '/^[a-zA-Z0-9_-]+$/', $clip['id'] ) || isset( $ids[ $clip['id'] ] ) ) {
				return self::invalid( 'Every clip must have a unique ID.' );
			}
			$ids[ $clip['id'] ] = true;
			if ( ! isset( $clip['mediaId'] ) || ! is_int( $clip['mediaId'] ) || $clip['mediaId'] <= 0 || ! Clipisode_Media::get_video_url( $clip['mediaId'] ) ) {
				return self::invalid( 'Every clip must reference an available video.' );
			}
			if ( ! isset( $clip['role'] ) || ! in_array( $clip['role'], [ 'intro', 'reply' ], true ) || ! isset( $clip['name'] ) || ! is_string( $clip['name'] ) || ! isset( $clip['included'] ) || ! is_bool( $clip['included'] ) ) {
				return self::invalid( 'Invalid clip role, name, or inclusion setting.' );
			}
			foreach ( [ 'duration', 'trimStart', 'trimEnd' ] as $key ) {
				if ( ! isset( $clip[ $key ] ) || ! self::is_number( $clip[ $key ] ) ) {
					return self::invalid( 'Clip durations and trims must be numbers.' );
				}
			}
			if ( $clip['duration'] <= 0 || $clip['trimStart'] < 0 || $clip['trimEnd'] <= $clip['trimStart'] || $clip['trimEnd'] > $clip['duration'] ) {
				return self::invalid( 'Clip trims must select a positive range within the source duration.' );
			}
			if ( round( $clip['trimEnd'] * self::FPS ) <= round( $clip['trimStart'] * self::FPS ) ) {
				return self::invalid( 'Clip trims must include at least one frame.' );
			}
			$has_segment = $has_segment || $clip['included'];
			$clips[] = [
				'id'        => $clip['id'],
				'mediaId'   => $clip['mediaId'],
				'role'      => $clip['role'],
				'name'      => sanitize_text_field( $clip['name'] ),
				'duration'  => (float) $clip['duration'],
				'trimStart' => (float) $clip['trimStart'],
				'trimEnd'   => (float) $clip['trimEnd'],
				'included'  => $clip['included'],
			];
		}
		if ( ! $has_segment ) {
			return self::invalid( 'The composition must include a video or a title or ending card.' );
		}

		return [ 'settings' => $clean, 'clips' => $clips ];
	}

	public static function resolve( string $json ): array|WP_Error {
		$composition = json_decode( $json, true );
		if ( ! is_array( $composition ) || ! isset( $composition['settings'], $composition['clips'] ) ) {
			return self::invalid( 'The saved composition is invalid.' );
		}
		foreach ( $composition['clips'] as &$clip ) {
			$url = Clipisode_Media::get_video_url( (int) $clip['mediaId'] );
			if ( ! $url ) {
				return self::invalid( 'A source video in this composition is no longer available.' );
			}
			$clip['url'] = $url;
		}
		unset( $clip );
		return $composition;
	}

	private static function is_number( mixed $value ): bool {
		return ( is_int( $value ) || is_float( $value ) ) && is_finite( (float) $value );
	}

	private static function invalid( string $message ): WP_Error {
		return new WP_Error( 'invalid_composition', $message );
	}
}
