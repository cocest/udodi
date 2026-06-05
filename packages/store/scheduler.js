import { useStore } from "./registry.js";

// Scheduler core (single execution authority)

const scheduled = new Map(); // name -> config
const intervals = new Map();
const focusListeners = new Map(); // name -> listener function
const reconnectListeners = new Map(); // name -> listener function

// Execute query via store dispatch (important)
function runQuery(name, payload) {
	const store = useStore(name);
	if (!store?.dispatch) return;

	store.dispatch(`${name}:fetch`, payload);
}

/**
 * Register a query scheduler for polling, focus, and reconnect refresh.
 *
 * @param {string} name - query store name.
 * @param {object} [config={}] - schedule configuration.
 * @param {object} [config.polling] - polling options.
 * @param {number} [config.polling.interval] - interval in milliseconds.
 * @param {boolean} [config.polling.immediate=false] - run once immediately.
 * @param {boolean} [config.refetchOnFocus=false] - refetch when window gains focus.
 * @param {boolean} [config.refetchOnReconnect=false] - refetch when network reconnects.
 * @returns {function(): void} cleanup function that destroys the schedule.
 */
export function registerQuerySchedule(name, config = {}) {
	const {
		polling = null,
		refetchOnFocus = false,
		refetchOnReconnect = false,
	} = config;

	scheduled.set(name, {
		polling,
		refetchOnFocus,
		refetchOnReconnect,
	});

	// Polling
	if (polling?.interval) {
		const id = setInterval(() => {
			runQuery(name);
		}, polling.interval);

		intervals.set(name, id);

		if (polling.immediate) {
			runQuery(name);
		}
	}

	// Focus event (scoped listener)
	if (typeof window !== "undefined" && refetchOnFocus) {
		const focusHandler = () => runQuery(name);
		focusListeners.set(name, focusHandler);
		window.addEventListener("focus", focusHandler);
	}

	// Reconnect event (scoped listener)
	if (typeof window !== "undefined" && refetchOnReconnect) {
		const reconnectHandler = () => runQuery(name);
		reconnectListeners.set(name, reconnectHandler);
		window.addEventListener("online", reconnectHandler);
	}

	return () => destroySchedule(name);
}

/**
 * Destroy a registered query schedule.
 *
 * @param {string} name - query store name.
 */
export function destroySchedule(name) {
	const id = intervals.get(name);
	if (id) clearInterval(id);

	intervals.delete(name);
	scheduled.delete(name);

	// remove event listeners
	if (typeof window !== "undefined") {
		const focusHandler = focusListeners.get(name);
		if (focusHandler) {
			window.removeEventListener("focus", focusHandler);
			focusListeners.delete(name);
		}

		const reconnectHandler = reconnectListeners.get(name);
		if (reconnectHandler) {
			window.removeEventListener("online", reconnectHandler);
			reconnectListeners.delete(name);
		}
	}
}

/**
 * Trigger a scheduled query fetch manually.
 *
 * @param {string} name - query store name.
 * @param {any} [payload] - optional payload forwarded to query dispatch.
 */
export function triggerQuery(name, payload) {
	runQuery(name, payload);
}
