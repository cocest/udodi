import { describe, expect, it } from "vitest";
import { createComponent, render, bindProp } from "udodi";

describe("createComponent props", () => {
	it("exposes non-colliding props on the public context", () => {
		const Message = createComponent({
			template: (ctx) => `<p>${ctx.message}</p>`,
		});

		const root = document.createElement("div");

		render(Message({ message: "Hello from props" }), root);

		expect(root.textContent).toBe("Hello from props");
	});

	it("exposes props to computed properties through the public context", () => {
		const Greeting = createComponent({
			computed: {
				greeting(ctx) {
					return `Hello, ${ctx.username}`;
				},
			},
			template: () => `<p @text="greeting"></p>`,
		});

		const root = document.createElement("div");

		render(Greeting({ username: "Ada" }), root);

		expect(root.textContent).toBe("Hello, Ada");
	});

	it("rejects props that collide with existing state keys", () => {
		const Counter = createComponent({
			state() {
				return {
					count: 0,
				};
			},
			template: () => `<p @text="count"></p>`,
		});

		const root = document.createElement("div");

		expect(() => {
			render(Counter({ count: 10 }), root);
		}).toThrow(/conflicts/);
	});
});

describe("createComponent methods", () => {
	it("keeps methods flat on the public context", () => {
		const Profile = createComponent({
			state() {
				return {
					firstName: "Ada",
					lastName: "Lovelace",
				};
			},

			methods: {
				getFullname() {
					return `${this.firstName} ${this.lastName}`;
				},
			},

			template: (ctx) => `<p>${ctx.getFullname()}</p>`,
		});

		const root = document.createElement("div");

		render(Profile(), root);

		expect(root.textContent).toBe("Ada Lovelace");
	});

	it("keeps handlers flat on the internal context", async () => {
		const Counter = createComponent({
			state() {
				return {
					count: 0,
				};
			},

			methods: {
				increment() {
					this.count = this.count + 1;
				},
			},

			template: () => `
				<button>
					<span @text="count"></span>
				</button>
			`,
		});

		const root = document.createElement("div");

		const instance = render(Counter(), root);

		instance.context.increment(new Event("click"));
		await Promise.resolve();

		expect(root.textContent.trim()).toBe("1");
	});
});

describe("createComponent computed", () => {
	it("updates computed DOM bindings when state dependencies change", async () => {
		const Counter = createComponent({
			state() {
				return {
					count: 1,
				};
			},

			methods: {
				setCount(value) {
					this.count = value;
				},
			},

			computed: {
				doubled(ctx) {
					return ctx.count * 2;
				},
			},

			template: () => `<p @text="doubled"></p>`,
		});

		const root = document.createElement("div");
		const instance = render(Counter(), root);

		expect(root.textContent).toBe("2");

		instance.context.setCount(2);
		await Promise.resolve();

		expect(root.textContent).toBe("4");
	});

	it("cleans computed subscriptions on unmount", async () => {
		let calls = 0;

		const Counter = createComponent({
			state() {
				return {
					count: 1,
				};
			},

			methods: {
				setCount(value) {
					this.count = value;
				},
			},

			computed: {
				doubled(ctx) {
					calls++;
					return ctx.count * 2;
				},
			},

			template: () => `<p @text="doubled"></p>`,
		});

		const root = document.createElement("div");
		const instance = render(Counter(), root);

		expect(root.textContent).toBe("2");
		expect(calls).toBe(1);

		instance.unmount();
		instance.context.setCount(2);
		await Promise.resolve();

		expect(calls).toBe(1);
	});
});

describe("createComponent validation errors", () => {
	it("reacts to @validate errors rendered from form controller errors", async () => {
		const Form = createComponent({
			methods: {
				between(value, min, max) {
					if (value.length >= min && value.length <= max) {
						return true;
					}

					return "Value is not within the specified range";
				},

				validName(value) {
					return /^[A-Za-z]+(?:[ '-][A-Za-z]+)*$/.test(value)
						? true
						: "Invalid name format";
				},
			},

			template: () => `
				<form @form="login">
					<input
						name="message"
						type="text"
						@validate="between:2:100 validName"
					>

					<div @text="ud.forms.login.errors.message"></div>
				</form>
			`,
		});

		const root = document.createElement("div");
		render(Form(), root);

		await Promise.resolve();

		expect(root.textContent).not.toContain(
			"Value is not within the specified range"
		);

		const input = root.querySelector("input");

		if (!input) {
			throw new Error("Expected input element to exist");
		}

		input.value = "1";
		input.dispatchEvent(
			new Event("input", { bubbles: true })
		);

		await Promise.resolve();

		expect(root.textContent).toContain(
			"Value is not within the specified range"
		);
	});
});

describe("createComponent instance creation", () => {
	it("supports creating multiple instances when state contains functions", () => {
		const formatter = () => "ready";

		const Example = createComponent({
			state() {
				return {
					label: "initial",
					formatter,
				};
			},

			template: () => `<p @text="label"></p>`,
		});

		const rootA = document.createElement("div");
		const rootB = document.createElement("div");

		expect(() => {
			render(Example(), rootA);
			render(Example(), rootB);
		}).not.toThrow();

		return Promise.resolve().then(() => {
			expect(rootA.textContent).toContain("initial");
			expect(rootB.textContent).toContain("initial");
		});
	});
});

describe("bindProp", () => {
	it("keeps child props synchronized with parent state", async () => {
		const Child = createComponent({
			template: () => `<span @text="message"></span>`,
		});

		const Parent = createComponent({
			state() {
				return {
					message: "Hello",
				};
			},

			methods: {
				setMessage(value) {
					this.message = value;
				},
			},

			template: (ctx) => `
				<div>
					${Child({
						message: bindProp(() => ctx.message)
					})}
				</div>
			`,
		});

		const root = document.createElement("div");
		const instance = render(Parent(), root);

		expect(root.textContent.trim()).toBe("Hello");

		instance.context.setMessage("Updated");

		await Promise.resolve();

		expect(root.textContent.trim()).toBe("Updated");
	});

	it("does not make normal props reactive", async () => {
		const Child = createComponent({
			template: () => `<span @text="message"></span>`,
		});

		const Parent = createComponent({
			state() {
				return {
					message: "Hello",
				};
			},

			methods: {
				setMessage(value) {
					this.message = value;
				},
			},

			template: (ctx) => `
				<div>
					${Child({
						message: ctx.message
					})}
				</div>
			`,
		});

		const root = document.createElement("div");
		const instance = render(Parent(), root);

		expect(root.textContent.trim()).toBe("Hello");

		instance.context.setMessage("Updated");

		await Promise.resolve();

		expect(root.textContent.trim()).toBe("Hello");
	});

	it("supports binding computed values", async () => {
		const Child = createComponent({
			template: () => `<span @text="fullName"></span>`,
		});

		const Parent = createComponent({
			state() {
				return {
					firstName: "Ada",
					lastName: "Lovelace",
				};
			},

			methods: {
				setFirstName(value) {
					this.firstName = value;
				},
			},

			computed: {
				fullName(ctx) {
					return `${ctx.firstName} ${ctx.lastName}`;
				},
			},

			template: (ctx) => `
				<div>
					${Child({
						fullName: bindProp(() => ctx.fullName)
					})}
				</div>
			`,
		});

		const root = document.createElement("div");
		const instance = render(Parent(), root);

		expect(root.textContent.trim()).toBe("Ada Lovelace");

		instance.context.setFirstName("Grace");

		await Promise.resolve();

		expect(root.textContent.trim()).toBe("Grace Lovelace");
	});
});
