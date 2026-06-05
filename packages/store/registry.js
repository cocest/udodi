import { createNamespace, store } from "./store.js";

const modules = new Map();

/**
 * Create reactive state proxy
 */
function createStateProxy(ns) {
	return new Proxy(
		{},
		{
			get(_, key) {
				return ns.get(key);
			},

			set(_, key, value) {
				ns.set(key, value);
				return true;
			},
		},
	);
}

/**
 * Register a store module.
 *
 * @param {string} name - module name.
 * @param {object} def - module definition.
 * @param {object} def.state - initial state values.
 * @param {object} def.actions - action handlers.
 * @param {object} [def.polling] - optional polling configuration.
 * @returns {object} module api.
 */
export function registerStore(name, def) {
	// Prevent duplicate registration
	if (modules.has(name)) {
		return modules.get(name);
	}

	const ns = createNamespace(name);

	/**
	 * Cached state proxy
	 */
	const stateProxy = createStateProxy(ns);

	/**
	 * Initialize state
	 */
	for (const key in def.state || {}) {
		ns.set(key, def.state[key]);
	}

	/**
	 * Register actions
	 */
	for (const key in def.actions || {}) {
		const actionName = `${name}:${key}`;

		store.defineAction(actionName, (payload) => {
			const ctx = {
				state: stateProxy,
				get: ns.get,
				set: ns.set,
				update: ns.update,
			};

			return def.actions[key](ctx, payload);
		});
	}

	/**
	 * Module API
	 */
	const moduleApi = {
		...ns,

		/**
		 * Destroy module
		 */
		destroy() {
			/**
			 * Optional cleanup hook
			 */
			if (typeof moduleApi.__cleanup === "function") {
				try {
					moduleApi.__cleanup();
				} catch {}
			}

			/**
			 * Remove state
			 */
			for (const key in def.state || {}) {
				ns.delete(key);
			}

			/**
			 * Remove actions
			 */
			for (const key in def.actions || {}) {
				store.deleteAction(`${name}:${key}`);
			}

			/**
			 * Remove module
			 */
			modules.delete(name);
		},
	};

	modules.set(name, moduleApi);

	return moduleApi;
}

/**
 * Retrieve a registered store module by name.
 *
 * @param {string} name - module name.
 * @returns {object|undefined} module api or undefined if not found.
 */
export function useStore(name) {
	return modules.get(name);
}

/**
 * Destroy a store module and clean up its resources.
 *
 * @param {string} name - module name.
 */
export function destroyStore(name) {
	modules.get(name)?.destroy();
}
