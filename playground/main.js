import { render } from 'udodi';
import { Counter } from './components/Counter.js';

// Render the component
const root = document.getElementById('root');
render(Counter(), root);