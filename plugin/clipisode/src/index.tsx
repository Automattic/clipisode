import { createRoot } from '@wordpress/element';
import App from './App';
import './index.scss';

const root = document.getElementById( 'clipisode-root' );
if ( root ) {
	createRoot( root ).render( <App /> );
}
