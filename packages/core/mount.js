import { getComponent } from "./componentRegistry.js";
import { extractAllDirectives } from "./directive.js";
import { bindDOM } from "./bindDOM.js";
import {
	getCleanupObserver,
	registerRoot,
	unregisterRoot,
	runScopeCleanup,
} from "./lifecycle.js";

/**
 * Queries all nodes including the root element itself that match a selector.
 * @param {HTMLElement} root - The root element to query.
 * @param {string} selector - The CSS selector to match.
 * @returns {HTMLElement[]} An array of matching elements.
 */
function queryAllIncludingRoot(root, selector) {
	const nodes = [];

	if (root.matches?.(selector)) {
		nodes.push(root);
	}

	nodes.push(...root.querySelectorAll(selector));
	return nodes;
}

/**
 * Replaces comment placeholders directly with the mounted component
 */
function resolveComponents(root, mount) {
	if (!root) return;

	const nodes = queryAllIncludingRoot(root, "[data-component-id]");
	const node_length = nodes.length;

	// No components found
	if (node_length === 0) return;

	let i = 0;
	for (; i < node_length; i++) {
		const el = nodes[i];
		const id = parseInt(el.getAttribute("data-component-id"), 10);

		if (isNaN(id) || !getComponent(id)) {
			continue;
		}

		const { Component, props, children } = getComponent(id);

		// Mount the actual component
		mount(() => Component(props, children), el);

		// Replace the temp container with the actual component root element
		const realRoot = el.firstElementChild;
		if (realRoot) {
			el.replaceWith(realRoot);
		} else {
			el.remove();
		}
	}
}

/**
 * Mounts a component to a DOM container.
 *
 * @param {Function} component - A function that returns a component instance with a template and optional context.
 * @param {HTMLElement} container - The DOM element to mount the component to.
 * @returns {Object} The mounted component instance.
 */
export function mount(component, container) {
	if (!container) {
		throw new Error("[mount] Container element is required");
	}

	const instance = component();
	if (!instance?.template) {
		throw new Error(
			`[mount] Component "${component.name || ""}" must return { template }`,
		);
	}

	const scope = { effects: [], cleanups: [] };

	const fragment = document
		.createRange()
		.createContextualFragment(instance.template);
	const root = fragment.firstElementChild;

	if (!root) {
		throw new Error(
			`[mount] Component "${component.name || "anonymous"}" must have one root element`,
		);
	}
	if (fragment.children.length > 1) {
		throw new Error(`[mount] Component must have exactly ONE root element`);
	}

	let destroyed = false;

	let registeredRoot = false;

	const unregister = () => {
		if (!registeredRoot) return;
		unregisterRoot(root);
		registeredRoot = false;
	};

	const cleanup = () => {
		if (destroyed) return;

		destroyed = true;

		try {
			instance.onUnmount?.(root, instance.context);
		} catch (err) {
			console.warn("[mount] onUnmount error:", err);
		}

		runScopeCleanup(scope, "[mount]");
		unregister();
	};

	const unmount = () => {
		cleanup();

		if (root.isConnected) {
			root.remove();
		}
	};

	// Replace container's content with component
	container.appendChild(fragment);

	// Resolve nested components (they will replace their own placeholders)
	resolveComponents(root, mount);

	const directives = extractAllDirectives(root);
	const context = instance.context || {};

	try {
		bindDOM(directives, context, {
			...scope,
			_root: root,
		});

		registerRoot(root, cleanup, unmount);
		registeredRoot = true;

		instance.onMount?.(root, {
			...context,
			cleanup: (fn) => scope.cleanups.push(fn),
		});
	} catch (err) {
		cleanup();
		throw err;
	}

	instance.unmount = unmount;

	getCleanupObserver();

	return instance;
}

