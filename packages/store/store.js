import { createSignal, effect } from "../reactivity/index.js";

/** @type {Map<string, any>} */
const state = new Map();

/** @type {Map<string, Function>} */
const actions = new Map();

const devtools = globalThis.__STORE_DEVTOOLS__ || null;

/**
 * Emit devtools events
 */
function emit(event, payload) {
	devtools?.emit?.(event, payload);
}

// Batching

let batching = false;

let queue = new Set();

function schedule(fn) {
	if (batching) {
		queue.add(fn);
	} else {
		fn();
	}
}

/**
 * Batch updates within a single transaction.
 *
 * @param {Function} fn - update function containing store operations.
 */
export function batch(fn) {
	batching = true;

	try {
		fn();
	} finally {
		batching = false;

		for (const queuedFn of queue) {
			queuedFn();
		}

		queue.clear();
	}
}

// Store Core

export const store = {
	/**
	 * Get value
	 */
	get(key) {
		if (!state.has(key)) {
			const [get, set] = createSignal(undefined);

			state.set(key, {
				get,
				set,
			});
		}

		return state.get(key).get();
	},

	/**
	 * Set value
	 */
	set(key, value) {
		let entry = state.get(key);
		const prev = entry ? entry.get() : undefined;

		// avoid unnecessary updates
		if (Object.is(prev, value)) {
			return;
		}

		if (!entry) {
			const [get, set] = createSignal(value);

			state.set(key, {
				get,
				set,
			});
		} else {
			schedule(() => {
				entry.set(value);
			});
		}

		emit("set", {
			key,
			prev,
			value,
		});
	},

	update(key, fn) {
		this.set(key, fn(this.get(key)));
	},

	defineAction(name, fn) {
		actions.set(
			name,

			async (payload) => {
				emit("action:start", {
					name,
				});

				try {
					const result = await fn(payload, store);

					emit("action:end", {
						name,
					});

					return result;
				} catch (err) {
					emit("action:error", {
						name,
						err,
					});

					throw err;
				}
			},
		);
	},

	dispatch(name, payload) {
		return actions.get(name)?.(payload);
	},

	subscribe(key, cb) {
		let prev;

		return effect(() => {
			const next = this.get(key);

			if (next !== prev) {
				cb(next, prev);

				prev = next;
			}
		});
	},

	keys() {
		return Array.from(state.keys());
	},

	/**
	 * Remove state key
	 */
	delete(key) {
		state.delete(key);

		emit("delete", { key });
	},

	/**
	 * Remove action
	 */
	deleteAction(name) {
		actions.delete(name);

		emit("action:delete", {
			name,
		});
	},

	/**
	 * Check existence
	 */
	has(key) {
		return state.has(key);
	},

	/**
	 * Clear all state/actions
	 */
	clear() {
		state.clear();
		actions.clear();

		emit("clear");
	},
};

/**
 * Create a namespaced store helper.
 *
 * @param {string} ns - namespace prefix for all state keys and actions.
 * @returns {{get: function(string): any, set: function(string, any): void, update: function(string, function(any): any): void, subscribe: function(string, function(any, any)): any, dispatch: function(string, any): any, delete: function(string): void, has: function(string): boolean}}
 */
export function createNamespace(ns) {
	const k = (key) => `${ns}:${key}`;

	return {
		get: (key) => store.get(k(key)),
		set: (key, value) => store.set(k(key), value),
		update: (key, fn) => store.update(k(key), fn),
		subscribe: (key, callback) => store.subscribe(k(key), callback),
		dispatch: (action, payload) => store.dispatch(`${ns}:${action}`, payload),
		delete: (key) => store.delete(k(key)),
		has: (key) => store.has(k(key)),
	};
}
