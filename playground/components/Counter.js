import { createComponent } from 'udodi';

export const Counter = createComponent({
	name: "counter",

	state: {
		count: 0,
	},

	handlers: {
		increment(ctx) {
			ctx.count = ctx.count + 1;
		},
	},

	template: () => /*html*/`
		<button @on="click:increment">
			Count: <span @text="count"></span>
		</button>
	`,
});