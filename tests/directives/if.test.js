/**
 * @if Directive Test Suite
 *
 * Verifies the runtime behavior of the @if directive as implemented in
 * packages/core/bindDOM.js (processIfDirective).
 *
 * Behavior under test:
 * - Truthy expression  -> element is present in the DOM
 * - Falsy expression   -> element is replaced by an "@if" comment placeholder
 * - Reactive toggling  -> state changes mount/unmount the element live
 * - Errors in the expression are caught and treated as falsy
 * - The "@if" attribute is stripped once processed
 */

import { describe, it, expect, vi } from "vitest";
import { render, createComponent } from "udodi";

// Reactive updates are scheduled on a microtask queue.
function flushMicrotasks() {
	return Promise.resolve();
}

function mountToDOM(component) {
	const root = document.createElement("div");
	const instance = render(component(), root);

	return {
		root,
		instance,
		context: instance.context,
	};
}

describe("@if directive", () => {
	it("renders the element when the expression is truthy", () => {
		const Component = createComponent({
			state() {
				return {
					visible: true,
				};
			},

			template: () => `
				<div>
					<p @if="visible" data-testid="target">Hello</p>
				</div>
			`,
		});

		const { root } = mountToDOM(Component);

		expect(
			root.querySelector('[data-testid="target"]')
		).not.toBeNull();
	});

	it("does not render the element when the expression is falsy", () => {
		const Component = createComponent({
			state() {
				return {
					visible: false,
				};
			},

			template: () => `
				<div>
					<p @if="visible" data-testid="target">Hello</p>
				</div>
			`,
		});

		const { root } = mountToDOM(Component);

		expect(
			root.querySelector('[data-testid="target"]')
		).toBeNull();
	});

	it("leaves a comment placeholder in place of a falsy element", () => {
		const Component = createComponent({
			state() {
				return {
					visible: false,
				};
			},

			template: () => `
				<div>
					<p @if="visible" data-testid="target">Hello</p>
				</div>
			`,
		});

		const { root } = mountToDOM(Component);
		const container = root.querySelector("div");

		const hasIfComment = Array.from(container.childNodes).some(
			(node) =>
				node.nodeType === Node.COMMENT_NODE &&
				node.data === "@if"
		);

		expect(hasIfComment).toBe(true);
	});

	it("re-inserts the element when state becomes truthy again", async () => {
		const Component = createComponent({
			state() {
				return {
					visible: false,
				};
			},

			methods: {
				show() {
					this.visible = true;
				},
			},

			template: () => `
				<div>
					<p @if="visible" data-testid="target">Hello</p>
				</div>
			`,
		});

		const { root, context } = mountToDOM(Component);

		expect(
			root.querySelector('[data-testid="target"]')
		).toBeNull();

		context.show();

		await flushMicrotasks();

		expect(
			root.querySelector('[data-testid="target"]')
		).not.toBeNull();
	});

	it("supports toggling without leaving duplicate nodes", async () => {
		const Component = createComponent({
			state() {
				return {
					visible: true,
				};
			},

			methods: {
				show() {
					this.visible = true;
				},

				hide() {
					this.visible = false;
				},
			},

			template: () => `
				<div>
					<p @if="visible" data-testid="target">Hello</p>
				</div>
			`,
		});

		const { root, context } = mountToDOM(Component);

		expect(
			root.querySelectorAll('[data-testid="target"]').length
		).toBe(1);

		context.hide();
		await flushMicrotasks();

		expect(
			root.querySelectorAll('[data-testid="target"]').length
		).toBe(0);

		context.show();
		await flushMicrotasks();

		expect(
			root.querySelectorAll('[data-testid="target"]').length
		).toBe(1);

		context.hide();
		await flushMicrotasks();

		expect(
			root.querySelectorAll('[data-testid="target"]').length
		).toBe(0);
	});

	it("evaluates dotted path expressions against nested-ish state", () => {
		const Component = createComponent({
			state() {
				return {
					user: {
						isAdmin: true,
					},
				};
			},

			template: () => `
				<div>
					<p @if="user.isAdmin" data-testid="target">Admin</p>
				</div>
			`,
		});

		const { root } = mountToDOM(Component);

		expect(
			root.querySelector('[data-testid="target"]')
		).not.toBeNull();
	});

	it("treats a throwing state value as falsy and warns", () => {
		const warnSpy = vi
			.spyOn(console, "warn")
			.mockImplementation(() => {});

		const Component = createComponent({
			state() {
				return {
					broken: () => {
						throw new Error("boom");
					},
				};
			},

			template: () => `
				<div>
					<p @if="broken" data-testid="target">Hello</p>
				</div>
			`,
		});

		const { root } = mountToDOM(Component);

		expect(
			root.querySelector('[data-testid="target"]')
		).toBeNull();

		expect(warnSpy).toHaveBeenCalled();

		warnSpy.mockRestore();
	});

	it("treats a missing/undefined path as falsy without warning", () => {
		const warnSpy = vi
			.spyOn(console, "warn")
			.mockImplementation(() => {});

		const Component = createComponent({
			state() {
				return {};
			},

			template: () => `
				<div>
					<p @if="missing.deeply.nested" data-testid="target">Hello</p>
				</div>
			`,
		});

		const { root } = mountToDOM(Component);

		expect(
			root.querySelector('[data-testid="target"]')
		).toBeNull();

		expect(warnSpy).not.toHaveBeenCalled();

		warnSpy.mockRestore();
	});

	it("removes the @if attribute from the element once processed", () => {
		const Component = createComponent({
			state() {
				return {
					visible: true,
				};
			},

			template: () => `
				<div>
					<p @if="visible" data-testid="target">Hello</p>
				</div>
			`,
		});

		const { root } = mountToDOM(Component);
		const target = root.querySelector('[data-testid="target"]');

		expect(target.hasAttribute("@if")).toBe(false);
	});

	it("creates isolated state per component instance", async () => {
		const Component = createComponent({
			state() {
				return {
					visible: true,
				};
			},

			methods: {
				hide() {
					this.visible = false;
				},
			},

			template: () => `
				<div>
					<p @if="visible" data-testid="target">Hello</p>
				</div>
			`,
		});

		const firstRoot = document.createElement("div");
		const secondRoot = document.createElement("div");

		const first = render(Component(), firstRoot);
		const second = render(Component(), secondRoot);

		first.context.hide();

		await flushMicrotasks();

		expect(
			firstRoot.querySelector('[data-testid="target"]')
		).toBeNull();

		expect(
			secondRoot.querySelector('[data-testid="target"]')
		).not.toBeNull();
	});

	// This test only works on a real browser.
	/*
	it("cleans up the element and placeholder on unmount", () => {
		const Component = createComponent({
			state() {
				return {
					visible: true,
				};
			},

			template: () => `
				<div>
					<p @if="visible" data-testid="target">Hello</p>
				</div>
			`,
		});

		const { root, instance } = mountToDOM(Component);

		instance.unmount();

		expect(
			root.querySelector('[data-testid="target"]')
		).toBeNull();

		expect(root.isConnected).toBe(false);
	});
	*/
});
