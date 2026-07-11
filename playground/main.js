import { render } from 'udodi';
import { Counter } from './components/Counter.js';

// Render the component
const root = document.getElementById('root');

console.log("Starting render...");

performance.mark("render-start");

// Render the component
render(Counter(), root);

performance.mark("render-end");

const measure = performance.measure(
    "Udodi Render Time",
    "render-start",
    "render-end"
);

console.log(`Render completed in ${measure.duration.toFixed(2)}ms`);

// Optional: Log to console with more details
console.group("Performance");
console.log("Duration:", measure.duration.toFixed(2) + "ms");
console.log("Start:", measure.startTime.toFixed(2) + "ms");
console.groupEnd();