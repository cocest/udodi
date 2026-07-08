/**
 * @if Directive Test Suite
 *
 * Verifies the runtime behavior of the @if directive as implemented in
 * packages/core/bindDOM.js (processIfDirective).
 *
 * Behavior under test:
 * - Truthy expression  -> element is present in the DOM
 * - Falsy expression   -> element is replaced by a "@if" comment placeholder
 * - Reactive toggling   -> state changes mount/unmount the element live
 * - Errors in the expression are caught and treated as falsy
 * - The "@if" attribute is stripped once processed
 */

import { describe, it, expect, vi } from "vitest";
import { render, createComponent } from "udodi";

// Reactive updates are scheduled on a microtask queue, so tests must flush
// microtasks before asserting on the DOM after a state mutation.
function flushMicrotasks() {
  return Promise.resolve();
}

function mountToDOM(component) {
  const root = document.createElement("div");
  const instance = render(component(), root);
  return { root, instance, context: instance.context };
}

describe("@if directive", () => {
  it("renders the element when the expression is truthy", () => {
    const Component = createComponent({
      state: { visible: true },
      template: () => `
				<div>
					<p @if="visible" data-testid="target">Hello</p>
				</div>
			`,
    });

    const { root } = mountToDOM(Component);

    expect(root.querySelector('[data-testid="target"]')).not.toBeNull();
  });

  it("does not render the element when the expression is falsy", () => {
    const Component = createComponent({
      state: { visible: false },
      template: () => `
				<div>
					<p @if="visible" data-testid="target">Hello</p>
				</div>
			`,
    });

    const { root } = mountToDOM(Component);

    expect(root.querySelector('[data-testid="target"]')).toBeNull();
  });

  it("leaves a comment placeholder in place of a falsy element", () => {
    const Component = createComponent({
      state: { visible: false },
      template: () => `
				<div>
					<p @if="visible" data-testid="target">Hello</p>
				</div>
			`,
    });

    const { root } = mountToDOM(Component);
    const container = root.querySelector("div");

    const hasIfComment = Array.from(container.childNodes).some(
      (node) => node.nodeType === Node.COMMENT_NODE && node.data === "@if",
    );

    expect(hasIfComment).toBe(true);
  });

  it("re-inserts the element when state becomes truthy again", async () => {
    const Component = createComponent({
      state: { visible: false },
      template: () => `
				<div>
					<p @if="visible" data-testid="target">Hello</p>
				</div>
			`,
    });

    const { root, context } = mountToDOM(Component);

    expect(root.querySelector('[data-testid="target"]')).toBeNull();

    context.visible = true;
    await flushMicrotasks();

    expect(root.querySelector('[data-testid="target"]')).not.toBeNull();
  });

  it("supports rapid toggling without leaving duplicate nodes", async () => {
    const Component = createComponent({
      state: { visible: true },
      template: () => `
				<div>
					<p @if="visible" data-testid="target">Hello</p>
				</div>
			`,
    });

    const { root, context } = mountToDOM(Component);

    context.visible = false;
    context.visible = true;
    context.visible = false;
    await flushMicrotasks();

    expect(root.querySelectorAll('[data-testid="target"]').length).toBe(0);

    context.visible = true;
    await flushMicrotasks();

    expect(root.querySelectorAll('[data-testid="target"]').length).toBe(1);
  });

  it("evaluates dotted path expressions against nested-ish state", () => {
    // Note: Udodi's reactive state is shallow (top-level only), so this
    // verifies @if can still read a nested value on initial render.
    const Component = createComponent({
      state: { user: { isAdmin: true } },
      template: () => `
				<div>
					<p @if="user.isAdmin" data-testid="target">Admin</p>
				</div>
			`,
    });

    const { root } = mountToDOM(Component);

    expect(root.querySelector('[data-testid="target"]')).not.toBeNull();
  });

  it("treats a throwing state value as falsy and warns", () => {
    // @if unwraps function-valued state by calling it. If that call throws,
    // processIfDirective's catch should log a warning and fall back to false
    // instead of crashing the render.
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const Component = createComponent({
      state: {
        broken: () => {
          throw new Error("boom");
        },
      },
      template: () => `
				<div>
					<p @if="broken" data-testid="target">Hello</p>
				</div>
			`,
    });

    const { root } = mountToDOM(Component);

    expect(root.querySelector('[data-testid="target"]')).toBeNull();
    expect(warnSpy).toHaveBeenCalled();

    warnSpy.mockRestore();
  });

  it("treats a missing/undefined path as falsy without warning", () => {
    // Unlike a throwing value, a simply-missing path resolves safely to
    // undefined via readPath's null/undefined guards, so no warning fires.
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const Component = createComponent({
      state: {},
      template: () => `
				<div>
					<p @if="missing.deeply.nested" data-testid="target">Hello</p>
				</div>
			`,
    });

    const { root } = mountToDOM(Component);

    expect(root.querySelector('[data-testid="target"]')).toBeNull();
    expect(warnSpy).not.toHaveBeenCalled();

    warnSpy.mockRestore();
  });

  it("removes the @if attribute from the element once processed", () => {
    const Component = createComponent({
      state: { visible: true },
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

  // This test only works on real browser
  /*it("cleans up the element and placeholder on unmount", () => {
    const Component = createComponent({
      state: { visible: true },
      template: () => `
				<div>
					<p @if="visible" data-testid="target">Hello</p>
				</div>
			`,
    });

    const { root, instance } = mountToDOM(Component);

    instance.unmount();

    expect(root.querySelector('[data-testid="target"]')).toBeNull();
    expect(root.isConnected).toBe(false);
  });*/
});
