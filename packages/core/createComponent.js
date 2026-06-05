import {
	computed,
	effect,
	reactive,
	bindProp,
	isReactiveProp,
	unwrapReactiveProp,
} from "../reactivity/index.js";
import { addComponent } from "./componentRegistry.js";
import { runScopeCleanup } from "./lifecycle.js";

/**
 * createComponent - component factory
 *
 * **Reactivity Model:**
 * - State is reactive at the TOP LEVEL ONLY (shallow reactivity)
 * - Nested objects are NOT auto-proxied. Mutating nested properties won't trigger updates
 * - Watchers only track changes to first-level keys
 * - To track nested changes, watch the parent key or update it entirely: ctx.pricing = {...}
 *
 * **Props and Reactivity:**
 * - Regular props are plain value snapshots: Child({ name: "John" })
 * - Reactive props maintain live connections: Child({ data: bindProp(ctx.data) })
 * - Use bindProp() to explicitly share reactive state from parent to child
 * - Without bindProp(), changes in parent's state won't update child (intended behavior)
 */
export function createComponent({
	name = "",
	state = {}, // for reactive state (auto-tracked by framework)
	computed: computedProps = {}, // for computed properties
	interceptors = {}, // for data transformations before state updates
	handlers = {}, // for event handlers (auto-bound with context)
	methods = {}, // for normal functions (formatters, helpers, etc.)
	watch = {}, // for watching reactive state changes
	template = "",
	onMount = null,
	onUnmount = null,
}) {
	function Component(props = {}) {
		const context = reactive(state, { interceptors });

		// Computed properties
		Object.entries(computedProps).forEach(([key, computeFn]) => {
			context[key] = computed(() => computeFn(context));
		});

		// Props override / extension
		// - Regular props: plain values (snapshots)
		// - Reactive props: use bindProp() to maintain reactivity through component hierarchy
		Object.entries(props).forEach(([key, prop]) => {
			context[key] = unwrapReactiveProp(prop);
		});

		// Event handlers with enhanced signature: (ctx, event, data)
		Object.entries(handlers).forEach(([name, handlerFn]) => {
			context[name] = (event, ...args) =>
				handlerFn.call(context, context, event, ...args);
		});

		// Methods (utility/helper functions)
		Object.entries(methods).forEach(([name, fn]) => {
			if (typeof fn === "function") {
				context[name] = fn.bind(context);
			}
		});

		// Setup watchers (watches only top-level reactive state changes)
		const watcherScope = { effects: [], cleanups: [] };
		Object.entries(watch).forEach(([, watchConfig]) => {
			const { deps = [], handler } = watchConfig;
			const prevValues = {};
			let initialized = false;

			effect(() => {
				const newValues = {};
				const oldValues = {};
				let hasChanged = false;

				deps.forEach((dep) => {
					const getter = resolveContextPath(context, dep);
					const newVal = getter();

					// Capture old value before comparison
					oldValues[dep] = prevValues[dep];
					newValues[dep] = newVal;

					if (!Object.is(prevValues[dep], newVal)) {
						hasChanged = true;
					}
				});

				if (initialized && hasChanged) {
					handler.call(context, context, newValues, oldValues);
				}

				// Update prevValues for next run
				Object.assign(prevValues, newValues);
				initialized = true;
			}, watcherScope);
		});

		const html = typeof template === "function" ? template(context) : template;

		return {
			template: html,
			context,
			watcherScope,

			onMount(root, ctx) {
				onMount?.(root, ctx, context);
			},

			onUnmount(root, ctx) {
				runScopeCleanup(watcherScope, "[component]");

				try {
					onUnmount?.(root, ctx, context);
				} catch (err) {
					console.warn("[createComponent] onUnmount error:", err);
				}
			},
		};
	}

	return (props = {}, children = "") => {
		// Register this component
		const placeholder = addComponent(Component, props, children);

		// return the component insertion placeholder
		return placeholder;
	};
}

/**
 * Helper to resolve context paths for watchers
 */
function resolveContextPath(context, path) {
	const parts = path.split(".");

	return () => {
		try {
			let value = context;

			for (let i = 0; i < parts.length; i++) {
				const part = parts[i];

				if (value === null || value === undefined) {
					return undefined;
				}

				// If it's a function (signal), call it first to get the value
				if (typeof value === "function") {
					value = value();
				}

				// Access the property
				const nextValue = value[part];
				value = nextValue;
			}

			return typeof value === "function" ? value() : value;
		} catch (err) {
			return undefined;
		}
	};
}
